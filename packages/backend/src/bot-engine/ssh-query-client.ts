import { Client as SSH2Client, type ClientChannel } from 'ssh2';
import { EventEmitter } from 'events';
import { parseQueryResponse } from '@ts6/common';
import { TS_EVENT_TYPES } from '@ts6/common';

export interface SshQueryClientOptions {
  host: string;
  port: number;
  username: string;
  password: string;
}

interface QueuedCommand {
  command: string;
  resolve: (result: string) => void;
  reject: (err: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
  responseLines: string[];
}

export declare interface SshQueryClient {
  on(event: 'ready', listener: () => void): this;
  on(event: 'event', listener: (eventName: string, data: Record<string, string>) => void): this;
  on(event: 'error', listener: (err: Error) => void): this;
  on(event: 'close', listener: () => void): this;
  emit(event: 'ready'): boolean;
  emit(event: 'event', eventName: string, data: Record<string, string>): boolean;
  emit(event: 'error', err: Error): boolean;
  emit(event: 'close'): boolean;
}

export class SshQueryClient extends EventEmitter {
  private ssh: SSH2Client | null = null;
  private shell: ClientChannel | null = null;
  private commandQueue: QueuedCommand[] = [];
  private currentCommand: QueuedCommand | null = null;
  private responseBuffer: string = '';
  private connected: boolean = false;
  private destroyed: boolean = false;
  private bannerReceived: boolean = false;
  private reconnectAttempt: number = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private keepaliveTimer: ReturnType<typeof setInterval> | null = null;
  private fatalError: boolean = false;

  constructor(private options: SshQueryClientOptions) {
    super();
  }

  async connect(): Promise<void> {
    if (this.destroyed) return;

    return new Promise<void>((resolve, reject) => {
      this.ssh = new SSH2Client();
      let settled = false;

      // Timeout for the entire connect+banner sequence
      const connectTimeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          const err = new Error(`SSH connect timeout for ${this.options.host}:${this.options.port}`);
          console.error(`[SshQueryClient] ${err.message}`);
          this.emit('error', err);
          reject(err);
          try { this.ssh?.end(); } catch {}
        }
      }, 15000);

      this.ssh.on('ready', () => {
        this.ssh!.shell(false, (err, channel) => {
          if (err) {
            if (!settled) { settled = true; clearTimeout(connectTimeout); reject(err); }
            this.emit('error', err);
            return;
          }

          this.shell = channel;
          this.responseBuffer = '';
          this.bannerReceived = false;

          channel.on('data', (data: Buffer) => {
            this.onShellData(data);
            // Check if banner has been received after processing data
            if (!this.connected && this.bannerReceived) {
              this.connected = true;
              this.reconnectAttempt = 0;
              this.startKeepalive();
              this.emit('ready');
              if (!settled) { settled = true; clearTimeout(connectTimeout); resolve(); }
            }
          });

          channel.on('close', () => {
            this.connected = false;
            this.bannerReceived = false;
            this.rejectAllPending('SSH channel closed');
            if (!this.destroyed) {
              this.emit('close');
              this.scheduleReconnect();
            }
          });

          channel.stderr.on('data', (data: Buffer) => {
            console.error(`[SshQueryClient] stderr: ${data.toString('utf-8')}`);
          });
        });
      });

      this.ssh.on('error', (err: Error) => {
        const isAuthError = err.message.includes('authentication') || err.message.includes('Auth');
        if (isAuthError) {
          this.fatalError = true;
          console.error(`[SshQueryClient] Fatal auth error for ${this.options.host}:${this.options.port}: ${err.message}`);
        }
        this.emit('error', err);
        if (!settled) {
          settled = true;
          clearTimeout(connectTimeout);
          reject(err);
        }
      });

      this.ssh.on('close', () => {
        const wasConnected = this.connected;
        this.connected = false;
        this.bannerReceived = false;
        this.stopKeepalive();
        this.rejectAllPending('SSH connection closed');
        if (!this.destroyed && wasConnected) {
          this.emit('close');
          this.scheduleReconnect();
        }
      });

      this.ssh.connect({
        host: this.options.host,
        port: this.options.port,
        username: this.options.username,
        password: this.options.password,
        keepaliveInterval: 0, // We handle keepalive ourselves
        readyTimeout: 10000,
      });
    });
  }

  async executeCommand(command: string, timeoutMs: number = 10000): Promise<string> {
    if (!this.connected || !this.shell) {
      throw new Error('SSH not connected');
    }

    return new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (this.currentCommand === entry) {
          this.currentCommand = null;
          this.processQueue();
        } else {
          const idx = this.commandQueue.indexOf(entry);
          if (idx !== -1) this.commandQueue.splice(idx, 1);
        }
        reject(new Error(`Command timed out after ${timeoutMs}ms: ${command}`));
      }, timeoutMs);

      const entry: QueuedCommand = {
        command,
        resolve,
        reject,
        timeout,
        responseLines: [],
      };

      this.commandQueue.push(entry);
      if (!this.currentCommand) {
        this.processQueue();
      }
    });
  }

  async registerEvents(sid: number): Promise<void> {
    console.log(`[SshQueryClient] Registering events for sid=${sid} on ${this.options.host}`);
    await this.executeCommand(`use sid=${sid}`);

    // Set nickname so the bot is identifiable, and mark as query client type
    try {
      await this.executeCommand('clientupdate client_nickname=TS6-WebUI-Bot');
    } catch {
      // Nickname might already be taken; not critical
    }

    for (const eventType of TS_EVENT_TYPES) {
      const cmd = eventType === 'channel'
        ? `servernotifyregister event=${eventType} id=0`
        : `servernotifyregister event=${eventType}`;
      try {
        await this.executeCommand(cmd);
      } catch (err: any) {
        // error id=516 = already registered, ignore
        if (!err.message?.includes('516')) {
          console.warn(`[SshQueryClient] Failed to register event ${eventType}: ${err.message}`);
        }
      }
    }

    console.log(`[SshQueryClient] Events registered for sid=${sid}`);
  }

  get isConnected(): boolean {
    return this.connected;
  }

  get hasFatalError(): boolean {
    return this.fatalError;
  }

  destroy(): void {
    this.destroyed = true;
    this.stopKeepalive();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.rejectAllPending('Client destroyed');
    if (this.shell) {
      this.shell.close();
      this.shell = null;
    }
    if (this.ssh) {
      this.ssh.end();
      this.ssh = null;
    }
    this.connected = false;
  }

  // --- Internals ---

  private onShellData(data: Buffer): void {
    this.responseBuffer += data.toString('utf-8');
    const lines = this.responseBuffer.split(/\r?\n/);
    // Keep the last (possibly incomplete) line in the buffer
    this.responseBuffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Wait for banner before processing commands
      if (!this.bannerReceived) {
        // TS SSH banner: "TS3" followed by "Welcome to the TeamSpeak ServerQuery interface..."
        // Some versions also send "virtualserver_status=..." + "error id=0 msg=ok" after Welcome.
        // We mark the banner as complete once we see the Welcome line, since commands can be
        // sent immediately after it. Any trailing status/error lines are consumed below.
        if (trimmed === 'TS3' || trimmed.includes('TS3 Client')) {
          continue;
        }
        if (trimmed.startsWith('Welcome')) {
          this.bannerReceived = true;
          continue;
        }
        // Consume any other banner lines (e.g., virtualserver_status=, error id=0)
        if (trimmed.startsWith('virtualserver_status=') || trimmed.startsWith('error id=0')) {
          continue;
        }
        continue;
      }

      // Notify events start with "notify"
      if (trimmed.startsWith('notify')) {
        this.handleNotifyLine(trimmed);
        continue;
      }

      // Error line terminates a command response
      if (trimmed.startsWith('error ')) {
        this.handleErrorLine(trimmed);
        continue;
      }

      // Regular response data line — accumulate for current command
      if (this.currentCommand) {
        this.currentCommand.responseLines.push(trimmed);
      }
    }
  }

  private handleNotifyLine(line: string): void {
    // Extract event name (everything before first space)
    const spaceIdx = line.indexOf(' ');
    if (spaceIdx === -1) {
      this.emit('event', line, {});
      return;
    }

    const eventName = line.substring(0, spaceIdx);
    const dataStr = line.substring(spaceIdx + 1);

    try {
      const entries = parseQueryResponse(dataStr);
      // Emit once per pipe-separated entry (usually just one for events)
      for (const entry of entries) {
        this.emit('event', eventName, entry);
      }
    } catch {
      this.emit('event', eventName, {});
    }
  }

  private handleErrorLine(line: string): void {
    if (!this.currentCommand) return;

    const cmd = this.currentCommand;
    clearTimeout(cmd.timeout);
    this.currentCommand = null;

    // Parse "error id=N msg=..."
    const parsed = parseQueryResponse(line.substring(6))[0] || {};
    const errorId = parseInt(parsed.id || '0');

    if (errorId === 0) {
      // Success
      cmd.resolve(cmd.responseLines.join('\n'));
    } else {
      cmd.reject(new Error(`TS error ${errorId}: ${parsed.msg || 'Unknown error'}`));
    }

    this.processQueue();
  }

  private processQueue(): void {
    if (this.currentCommand || this.commandQueue.length === 0) return;
    if (!this.shell || !this.connected) return;

    this.currentCommand = this.commandQueue.shift()!;
    this.currentCommand.responseLines = [];
    this.shell.write(this.currentCommand.command + '\n');
  }

  private startKeepalive(): void {
    this.stopKeepalive();
    this.keepaliveTimer = setInterval(() => {
      if (this.connected) {
        this.executeCommand('whoami', 5000).catch(() => {
          // Keepalive failure will trigger disconnect detection
        });
      }
    }, 60000);
  }

  private stopKeepalive(): void {
    if (this.keepaliveTimer) {
      clearInterval(this.keepaliveTimer);
      this.keepaliveTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.destroyed || this.fatalError) return;

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempt), 30000);
    console.log(`[SshQueryClient] Reconnecting to ${this.options.host}:${this.options.port} in ${delay}ms (attempt ${this.reconnectAttempt + 1})`);

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectAttempt++;
      try {
        await this.connect();
      } catch (err: any) {
        console.error(`[SshQueryClient] Reconnect failed: ${err.message}`);
        // connect() failure will trigger another reconnect via the error/close handlers
      }
    }, delay);
  }

  private rejectAllPending(reason: string): void {
    if (this.currentCommand) {
      clearTimeout(this.currentCommand.timeout);
      this.currentCommand.reject(new Error(reason));
      this.currentCommand = null;
    }
    for (const cmd of this.commandQueue) {
      clearTimeout(cmd.timeout);
      cmd.reject(new Error(reason));
    }
    this.commandQueue = [];
  }
}
