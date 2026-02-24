import { EventEmitter } from 'events';
import { Ts3Client, type Ts3ClientOptions, generateIdentity, type IdentityData, buildCommand } from './tslib/index.js';
import { AudioPipeline, FRAME_MS, BYTES_PER_FRAME } from './audio/pipeline.js';
import { PlayQueue, type QueueItem } from './playlist/queue.js';
import { fetchIcyMetadata } from './audio/icy-metadata.js';

export type VoiceBotStatus = 'stopped' | 'starting' | 'connected' | 'playing' | 'paused' | 'error';

export interface PlaybackProgress {
  position: number;  // seconds
  duration: number;  // seconds
}

export interface VoiceBotConfig {
  id: number;
  name: string;
  serverHost: string;
  serverPort: number;
  nickname: string;
  serverPassword?: string;
  defaultChannel?: string;
  channelPassword?: string;
  volume: number; // 0-100
  identity?: IdentityData;
}

export class VoiceBot extends EventEmitter {
  private client: Ts3Client;
  private pipeline: AudioPipeline;
  readonly queue: PlayQueue;
  private config: VoiceBotConfig;
  private _status: VoiceBotStatus = 'stopped';
  private identity: IdentityData | null = null;
  private playbackTimer: ReturnType<typeof setTimeout> | null = null;
  private _nowPlaying: QueueItem | null = null;

  // PCM-level playback state
  private pcmFrames: Buffer[] = [];
  private frameIndex: number = 0;
  private pausedAtFrame: number = 0;
  private loopEpoch: number = 0;

  // Streaming state (radio)
  private _isStreaming: boolean = false;
  private streamKill: (() => void) | null = null;
  private streamBuffer: Buffer = Buffer.alloc(0);
  private streamStartTime: number = 0;

  // Nickname "now playing" state
  private _originalNickname: string;

  // ICY metadata polling (radio)
  private icyPollTimer: ReturnType<typeof setInterval> | null = null;
  private lastStreamTitle: string = '';

  // Reconnect: distinguishes manual stop from unexpected disconnect
  private _manuallyStopped: boolean = false;

  constructor(config: VoiceBotConfig) {
    super();
    this.config = config;
    this._originalNickname = config.nickname;
    this.client = new Ts3Client();
    this.pipeline = new AudioPipeline();
    this.queue = new PlayQueue();

    this.client.on('error', (err) => {
      this._status = 'error';
      this.emit('error', err);
      this.emit('statusChange', this._status);
    });

    this.client.on('disconnected', () => {
      this.stopIcyPolling();
      this.stopPlayback();
      this._status = 'stopped';
      this._nowPlaying = null;
      this.emit('statusChange', this._status);
      this.emit('disconnected');
    });

    this.client.on('command', (cmd) => {
      this.emit('command', cmd);
    });

    this.client.on('textMessage', (data: Record<string, string>) => {
      this.emit('textMessage', data);
    });
  }

  get id(): number {
    return this.config.id;
  }

  get status(): VoiceBotStatus {
    return this._status;
  }

  get nowPlaying(): QueueItem | null {
    return this._nowPlaying;
  }

  get isStreaming(): boolean {
    return this._isStreaming;
  }

  get manuallyStopped(): boolean {
    return this._manuallyStopped;
  }

  get playbackProgress(): PlaybackProgress | null {
    if (!this._nowPlaying) return null;
    if (this._isStreaming) {
      return {
        position: (Date.now() - this.streamStartTime) / 1000,
        duration: 0, // Live stream — no known duration
      };
    }
    if (this.pcmFrames.length === 0) return null;
    return {
      position: (this.frameIndex * FRAME_MS) / 1000,
      duration: (this.pcmFrames.length * FRAME_MS) / 1000,
    };
  }

  get ts3ClientId(): number {
    return this.client.getClientId();
  }

  sendTextMessage(targetClid: number, msg: string): void {
    const cmd = buildCommand('sendtextmessage', {
      targetmode: 1,
      target: targetClid,
      msg,
    });
    this.client.sendCommand(cmd);
  }

  get currentConfig(): VoiceBotConfig {
    return { ...this.config };
  }

  updateConfig(partial: Partial<VoiceBotConfig>): void {
    Object.assign(this.config, partial);
    if (partial.nickname) this._originalNickname = partial.nickname;
  }

  /** Update the TS3 nickname to show what's playing. Max 30 chars. */
  private updateNowPlayingNickname(title: string): void {
    if (this._status === 'stopped') return;
    const prefix = this._originalNickname;
    const sep = ' \u266A '; // ♪
    const maxLen = 30;
    let nick = prefix + sep + title;
    if (nick.length > maxLen) {
      const available = maxLen - prefix.length - sep.length - 1; // -1 for …
      nick = prefix + sep + (available > 0 ? title.substring(0, available) + '\u2026' : '\u2026');
    }
    try {
      this.client.sendCommand(buildCommand('clientupdate', { client_nickname: nick }));
    } catch {}
  }

  /** Reset TS3 nickname to original. */
  private resetNickname(): void {
    if (this._status === 'stopped') return;
    try {
      this.client.sendCommand(buildCommand('clientupdate', { client_nickname: this._originalNickname }));
    } catch {}
  }

  /** Start polling ICY metadata for a radio stream. */
  private startIcyPolling(streamUrl: string): void {
    this.stopIcyPolling();
    this.lastStreamTitle = '';

    // Immediate first fetch
    this.fetchAndUpdateIcy(streamUrl);

    this.icyPollTimer = setInterval(() => {
      this.fetchAndUpdateIcy(streamUrl);
    }, 15000);
  }

  private async fetchAndUpdateIcy(streamUrl: string): Promise<void> {
    try {
      const title = await fetchIcyMetadata(streamUrl);
      if (!title || title === this.lastStreamTitle || !this._nowPlaying) return;
      this.lastStreamTitle = title;

      // Parse "Artist - Title" format
      const dashIdx = title.indexOf(' - ');
      if (dashIdx > 0) {
        this._nowPlaying.artist = title.substring(0, dashIdx).trim();
        this._nowPlaying.title = title.substring(dashIdx + 3).trim();
      } else {
        this._nowPlaying.title = title;
      }

      this.updateNowPlayingNickname(title);
      this.emit('metadataChange', this._nowPlaying);
    } catch {}
  }

  private stopIcyPolling(): void {
    if (this.icyPollTimer) {
      clearInterval(this.icyPollTimer);
      this.icyPollTimer = null;
    }
    this.lastStreamTitle = '';
  }

  async start(): Promise<void> {
    if (this._status === 'connected' || this._status === 'playing' || this._status === 'paused') {
      throw new Error('Bot is already running');
    }

    this._manuallyStopped = false;
    this._status = 'starting';
    this.emit('statusChange', this._status);

    this.identity = this.config.identity ?? generateIdentity(8);

    const opts: Ts3ClientOptions = {
      host: this.config.serverHost,
      port: this.config.serverPort,
      identity: this.identity,
      nickname: this.config.nickname,
      serverPassword: this.config.serverPassword,
      defaultChannel: this.config.defaultChannel,
      channelPassword: this.config.channelPassword,
    };

    await this.client.connect(opts);
    this._status = 'connected';
    this.emit('statusChange', this._status);
    this.emit('connected');
  }

  async stop(): Promise<void> {
    this._manuallyStopped = true;
    this.stopIcyPolling();
    this.resetNickname();
    this.stopPlayback();
    this._nowPlaying = null;
    this.client.disconnect();
  }

  async restart(): Promise<void> {
    await this.stop();
    await new Promise<void>((resolve) => {
      const check = () => {
        if (this._status === 'stopped') resolve();
        else setTimeout(check, 100);
      };
      setTimeout(check, 600);
    });
    await this.start();
  }

  async play(item: QueueItem): Promise<void> {
    if (this._status !== 'connected' && this._status !== 'playing' && this._status !== 'paused') {
      throw new Error('Bot is not connected');
    }

    this.stopIcyPolling();
    this.stopPlayback();
    this._nowPlaying = item;
    this._status = 'playing';
    this.emit('statusChange', this._status);
    this.emit('nowPlaying', item);
    this.updateNowPlayingNickname(item.title);

    try {
      const pcmData = await this.pipeline.toPcm(item.filePath);
      this.pcmFrames = this.pipeline.splitFrames(pcmData);
      this.frameIndex = 0;
      this.startPlaybackLoop();
    } catch (err) {
      this._status = 'connected';
      this._nowPlaying = null;
      this.emit('statusChange', this._status);
      throw err;
    }
  }

  async playStream(item: QueueItem): Promise<void> {
    if (this._status !== 'connected' && this._status !== 'playing' && this._status !== 'paused') {
      throw new Error('Bot is not connected');
    }
    if (!item.streamUrl) {
      throw new Error('No streamUrl provided');
    }

    this.stopIcyPolling();
    this.stopPlayback();
    this._nowPlaying = item;
    this._isStreaming = true;
    this._status = 'playing';
    this.streamStartTime = Date.now();
    this.emit('statusChange', this._status);
    this.emit('nowPlaying', item);
    this.updateNowPlayingNickname(item.title);
    this.startIcyPolling(item.streamUrl);

    try {
      const stream = this.pipeline.toPcmStream(item.streamUrl);
      this.streamKill = stream.kill;
      this.streamBuffer = Buffer.alloc(0);

      const epoch = ++this.loopEpoch;
      let framesSent = 0;
      const startTime = performance.now();

      stream.stdout.on('data', (chunk: Buffer) => {
        if (epoch !== this.loopEpoch) return;
        this.streamBuffer = Buffer.concat([this.streamBuffer, chunk]);
      });

      stream.process.on('close', () => {
        if (epoch !== this.loopEpoch) return;
        this.client.sendVoiceStop();
        this._isStreaming = false;
        this.streamKill = null;
        this._nowPlaying = null;
        this._status = 'connected';
        this.emit('statusChange', this._status);
        this.emit('trackEnd', item);
      });

      stream.process.on('error', (err) => {
        if (epoch !== this.loopEpoch) return;
        this._isStreaming = false;
        this.streamKill = null;
        this._status = 'error';
        this.emit('error', err);
        this.emit('statusChange', this._status);
      });

      // Playback loop: send frames at 20ms intervals from the buffer
      const sendLoop = () => {
        if (epoch !== this.loopEpoch) return;

        const elapsed = performance.now() - startTime;
        const targetFrames = Math.floor(elapsed / FRAME_MS);

        while (framesSent < targetFrames && this.streamBuffer.length >= BYTES_PER_FRAME) {
          const frame = this.streamBuffer.subarray(0, BYTES_PER_FRAME);
          this.streamBuffer = this.streamBuffer.subarray(BYTES_PER_FRAME);
          const opusFrame = this.pipeline.encodeFrame(frame, this.config.volume);
          this.client.sendVoice(opusFrame);
          framesSent++;
        }

        this.playbackTimer = setTimeout(sendLoop, 5);
      };

      this.playbackTimer = setTimeout(sendLoop, 200); // Initial buffer delay
    } catch (err) {
      this._isStreaming = false;
      this.streamKill = null;
      this._status = 'connected';
      this._nowPlaying = null;
      this.emit('statusChange', this._status);
      throw err;
    }
  }

  pause(): void {
    if (this._status !== 'playing') return;
    this.pausedAtFrame = this.frameIndex;
    this.clearTimer();
    this.client.sendVoiceStop();
    this._status = 'paused';
    this.emit('statusChange', this._status);
  }

  resume(): void {
    if (this._status !== 'paused') return;
    this.frameIndex = this.pausedAtFrame;
    this._status = 'playing';
    this.emit('statusChange', this._status);
    this.startPlaybackLoop();
  }

  seek(seconds: number): void {
    if (this._status !== 'playing' && this._status !== 'paused') return;
    if (this.pcmFrames.length === 0) return;

    const targetFrame = Math.max(0, Math.min(
      Math.floor(seconds / (FRAME_MS / 1000)),
      this.pcmFrames.length - 1
    ));

    if (this._status === 'playing') {
      this.clearTimer();
      this.frameIndex = targetFrame;
      this.startPlaybackLoop();
    } else {
      this.frameIndex = targetFrame;
      this.pausedAtFrame = targetFrame;
    }
  }

  setVolume(volume: number): void {
    this.config.volume = Math.max(0, Math.min(100, volume));
    this.emit('volumeChange', this.config.volume);
  }

  skip(): void {
    this.stopIcyPolling();
    this.stopPlayback();
    this._nowPlaying = null;
    this._status = 'connected';
    this.emit('statusChange', this._status);

    const next = this.queue.next();
    if (next) {
      this.play(next).catch((err) => this.emit('error', err));
    } else {
      this.resetNickname();
    }
  }

  previous(): void {
    this.stopIcyPolling();
    this.stopPlayback();
    this._nowPlaying = null;
    this._status = 'connected';
    this.emit('statusChange', this._status);

    const prev = this.queue.previous();
    if (prev) {
      this.play(prev).catch((err) => this.emit('error', err));
    } else {
      this.resetNickname();
    }
  }

  stopAudio(): void {
    this.stopIcyPolling();
    this.stopPlayback();
    this.client.sendVoiceStop();
    this._nowPlaying = null;
    this.resetNickname();
    if (this._status === 'playing' || this._status === 'paused') {
      this._status = 'connected';
      this.emit('statusChange', this._status);
    }
  }

  private startPlaybackLoop(): void {
    const epoch = ++this.loopEpoch;
    const startTime = performance.now();
    const startFrame = this.frameIndex;

    const sendNext = () => {
      if (epoch !== this.loopEpoch) return;

      const elapsed = performance.now() - startTime;
      const targetFrame = startFrame + Math.floor(elapsed / FRAME_MS);

      while (this.frameIndex < this.pcmFrames.length && this.frameIndex <= targetFrame) {
        const opusFrame = this.pipeline.encodeFrame(this.pcmFrames[this.frameIndex], this.config.volume);
        this.client.sendVoice(opusFrame);
        this.frameIndex++;
      }

      if (this.frameIndex >= this.pcmFrames.length) {
        this.client.sendVoiceStop();
        this.clearTimer();
        const finished = this._nowPlaying;
        this._nowPlaying = null;
        this._status = 'connected';
        this.emit('statusChange', this._status);
        this.emit('trackEnd', finished);

        // Track repeat: replay the same song (works even without queue)
        if (this.queue.repeat === 'track' && finished) {
          this.play(finished).catch((err) => this.emit('error', err));
          return;
        }

        const next = this.queue.next();
        if (next) {
          this.play(next).catch((err) => this.emit('error', err));
        } else {
          this.resetNickname();
        }
        return;
      }

      const nextFrameTime = startTime + (this.frameIndex - startFrame) * FRAME_MS;
      const delay = Math.max(1, nextFrameTime - performance.now());
      this.playbackTimer = setTimeout(sendNext, delay);
    };

    this.playbackTimer = setTimeout(sendNext, 0);
  }

  private clearTimer(): void {
    this.loopEpoch++;
    if (this.playbackTimer) {
      clearTimeout(this.playbackTimer);
      this.playbackTimer = null;
    }
  }

  private stopPlayback(): void {
    this.clearTimer();
    this.pcmFrames = [];
    this.frameIndex = 0;
    this.pausedAtFrame = 0;

    // Kill streaming FFmpeg if active
    if (this.streamKill) {
      this.streamKill();
      this.streamKill = null;
    }
    this._isStreaming = false;
    this.streamBuffer = Buffer.alloc(0);
  }
}
