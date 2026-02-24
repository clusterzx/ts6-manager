import { EventEmitter } from 'events';
import type { PrismaClient } from '../../generated/prisma/index.js';
import type { WebSocketServer } from 'ws';
import { VoiceBot, type VoiceBotConfig, type VoiceBotStatus } from './voice-bot.js';
import { generateIdentity, restoreIdentity, type IdentityData } from './tslib/index.js';
import type { QueueItem } from './playlist/queue.js';
import type { MusicCommandHandler } from './music-command-handler.js';

const PROGRESS_INTERVAL_MS = 1000;
const MAX_RECONNECT_ATTEMPTS = 10;
const MAX_RECONNECT_DELAY_MS = 30000;

interface ReconnectState {
  attempts: number;
  timer: ReturnType<typeof setTimeout> | null;
}

export class VoiceBotManager extends EventEmitter {
  private bots = new Map<number, VoiceBot>();
  private progressTimers = new Map<number, ReturnType<typeof setInterval>>();
  private reconnectState = new Map<number, ReconnectState>();
  private musicCmdHandler: MusicCommandHandler | null = null;

  constructor(
    private prisma: PrismaClient,
    private wss: WebSocketServer,
  ) {
    super();
  }

  setMusicCommandHandler(handler: MusicCommandHandler): void {
    this.musicCmdHandler = handler;
    // Register all existing bots
    for (const [id, bot] of this.bots) {
      handler.registerBot(id, bot);
    }
  }

  async start(): Promise<void> {
    const dbBots = await this.prisma.musicBot.findMany({
      include: { serverConfig: true },
    });

    console.log(`[VoiceBotManager] Loading ${dbBots.length} music bot(s)...`);

    for (const dbBot of dbBots) {
      let identity: IdentityData | undefined;
      if (dbBot.identityData) {
        const parsed = JSON.parse(dbBot.identityData);
        // Reconstruct KeyObjects from serialized scalar data
        identity = restoreIdentity(parsed);
      }
      const config: VoiceBotConfig = {
        id: dbBot.id,
        name: dbBot.name,
        serverHost: dbBot.serverConfig.host,
        serverPort: 9987, // Default TS3 voice port
        nickname: dbBot.nickname,
        defaultChannel: dbBot.defaultChannel ?? undefined,
        channelPassword: dbBot.channelPassword ?? undefined,
        volume: dbBot.volume,
        identity,
      };

      const bot = this.createBotInstance(config);
      this.bots.set(dbBot.id, bot);

      if (dbBot.autoStart) {
        bot.start().catch((err) => {
          console.error(`[VoiceBotManager] Auto-start failed for bot ${dbBot.id}: ${err.message}`);
        });
      }
    }
  }

  private createBotInstance(config: VoiceBotConfig): VoiceBot {
    const bot = new VoiceBot(config);

    bot.on('statusChange', (status: VoiceBotStatus) => {
      this.broadcast('music:bot:status', { botId: config.id, status });

      if (status === 'playing') {
        this.startProgressBroadcast(config.id);
      } else {
        this.stopProgressBroadcast(config.id);
      }
    });

    bot.on('error', (err: Error) => {
      console.error(`[VoiceBotManager] Bot ${config.id} error: ${err.message}`);
    });

    bot.on('nowPlaying', (item: QueueItem) => {
      const progress = bot.playbackProgress;
      this.broadcast('music:bot:nowPlaying', {
        botId: config.id,
        song: { id: item.id, title: item.title, artist: item.artist, duration: item.duration, source: item.source },
        progress: progress ? { position: progress.position, duration: progress.duration } : null,
      });
    });

    bot.on('trackEnd', (item: QueueItem | null) => {
      this.broadcast('music:bot:trackEnd', { botId: config.id, songId: item?.id ?? null });
    });

    bot.on('volumeChange', (volume: number) => {
      this.broadcast('music:bot:volumeChange', { botId: config.id, volume });
    });

    bot.on('metadataChange', (item: QueueItem) => {
      this.broadcast('music:bot:nowPlaying', {
        botId: config.id,
        song: { id: item.id, title: item.title, artist: item.artist, duration: item.duration, source: item.source },
        progress: null,
      });
    });

    bot.on('disconnected', () => {
      if (!bot.manuallyStopped) {
        console.log(`[VoiceBotManager] Bot ${config.id}: unexpected disconnect, scheduling reconnect`);
        this.scheduleReconnect(config.id);
      }
    });

    // Register for music text commands
    if (this.musicCmdHandler) {
      this.musicCmdHandler.registerBot(config.id, bot);
    }

    return bot;
  }

  async createBot(data: {
    name: string;
    serverConfigId: number;
    nickname?: string;
    defaultChannel?: string;
    channelPassword?: string;
    volume?: number;
    autoStart?: boolean;
  }): Promise<{ id: number }> {
    // Enforce bot limit
    const limitSetting = await this.prisma.appSetting.findUnique({ where: { key: 'max_music_bots' } });
    const limit = parseInt(limitSetting?.value ?? '10') || 10;
    const currentCount = await this.prisma.musicBot.count();
    if (currentCount >= limit) {
      throw new Error(`Music bot limit reached (${limit}). Adjust the limit in Settings.`);
    }

    // Generate identity (BigInt fields must be serialized as strings)
    const identity = generateIdentity(8);
    const identityData = JSON.stringify(identity, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    );

    // Get server config for host
    const serverConfig = await this.prisma.tsServerConfig.findUnique({ where: { id: data.serverConfigId } });
    if (!serverConfig) throw new Error('Server config not found');

    const dbBot = await this.prisma.musicBot.create({
      data: {
        name: data.name,
        serverConfigId: data.serverConfigId,
        nickname: data.nickname ?? 'MusicBot',
        defaultChannel: data.defaultChannel,
        channelPassword: data.channelPassword,
        volume: data.volume ?? 50,
        autoStart: data.autoStart ?? false,
        identityData,
      },
    });

    const config: VoiceBotConfig = {
      id: dbBot.id,
      name: dbBot.name,
      serverHost: serverConfig.host,
      serverPort: 9987,
      nickname: dbBot.nickname,
      defaultChannel: dbBot.defaultChannel ?? undefined,
      channelPassword: dbBot.channelPassword ?? undefined,
      volume: dbBot.volume,
      identity,
    };

    const bot = this.createBotInstance(config);
    this.bots.set(dbBot.id, bot);

    return { id: dbBot.id };
  }

  getBot(id: number): VoiceBot | undefined {
    return this.bots.get(id);
  }

  async removeBot(id: number): Promise<void> {
    this.clearReconnect(id);
    const bot = this.bots.get(id);
    if (bot && bot.status !== 'stopped') {
      await bot.stop();
    }
    this.stopProgressBroadcast(id);
    this.bots.delete(id);
    await this.prisma.musicBot.delete({ where: { id } });
  }

  async getBotsForServer(configId: number): Promise<Array<{ botId: number; bot: VoiceBot }>> {
    const dbBots = await this.prisma.musicBot.findMany({
      where: { serverConfigId: configId },
      select: { id: true },
    });
    const result: Array<{ botId: number; bot: VoiceBot }> = [];
    for (const db of dbBots) {
      const bot = this.bots.get(db.id);
      if (bot && bot.status !== 'stopped') {
        result.push({ botId: db.id, bot });
      }
    }
    return result;
  }

  listBots(): Array<{ id: number; status: VoiceBotStatus; nowPlaying: QueueItem | null }> {
    const list: Array<{ id: number; status: VoiceBotStatus; nowPlaying: QueueItem | null }> = [];
    for (const [id, bot] of this.bots) {
      list.push({ id, status: bot.status, nowPlaying: bot.nowPlaying });
    }
    return list;
  }

  async startBot(id: number): Promise<void> {
    const bot = this.bots.get(id);
    if (!bot) throw new Error(`Music bot ${id} not found`);
    this.clearReconnect(id);
    await bot.start();
  }

  async stopBot(id: number): Promise<void> {
    const bot = this.bots.get(id);
    if (!bot) throw new Error(`Music bot ${id} not found`);
    this.clearReconnect(id);
    await bot.stop();
  }

  async stopAll(): Promise<void> {
    // Clear all reconnect timers first to prevent reconnect during shutdown
    for (const [id, state] of this.reconnectState) {
      if (state.timer) clearTimeout(state.timer);
    }
    this.reconnectState.clear();

    const promises: Promise<void>[] = [];
    for (const bot of this.bots.values()) {
      if (bot.status !== 'stopped') {
        promises.push(bot.stop());
      }
    }
    this.progressTimers.forEach((timer) => clearInterval(timer));
    this.progressTimers.clear();
    await Promise.allSettled(promises);
  }

  // --- Auto-reconnect logic ---

  private scheduleReconnect(botId: number): void {
    const bot = this.bots.get(botId);
    if (!bot) return;

    let state = this.reconnectState.get(botId);
    if (!state) {
      state = { attempts: 0, timer: null };
      this.reconnectState.set(botId, state);
    }

    // Prevent double-scheduling (can happen when both 'disconnected' handler
    // and attemptReconnect catch block trigger simultaneously)
    if (state.timer) return;

    if (state.attempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error(`[VoiceBotManager] Bot ${botId}: max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached, giving up`);
      this.broadcast('music:bot:reconnectFailed', { botId });
      this.reconnectState.delete(botId);
      return;
    }

    const delay = Math.min(Math.pow(2, state.attempts) * 1000, MAX_RECONNECT_DELAY_MS);
    state.attempts++;
    console.log(`[VoiceBotManager] Bot ${botId}: reconnect attempt ${state.attempts}/${MAX_RECONNECT_ATTEMPTS} in ${delay / 1000}s`);

    state.timer = setTimeout(() => this.attemptReconnect(botId), delay);
  }

  private async attemptReconnect(botId: number): Promise<void> {
    const bot = this.bots.get(botId);
    const state = this.reconnectState.get(botId);
    if (!bot || !state) return;

    // Mark timer as executed so scheduleReconnect can run again
    state.timer = null;

    try {
      await bot.start();
      console.log(`[VoiceBotManager] Bot ${botId}: reconnected successfully after ${state.attempts} attempt(s)`);
      this.reconnectState.delete(botId);
    } catch (err: any) {
      console.error(`[VoiceBotManager] Bot ${botId}: reconnect attempt ${state.attempts} failed: ${err.message}`);
      // Schedule next attempt (guard in scheduleReconnect prevents double-scheduling
      // if 'disconnected' event also fires from the failed connect)
      this.scheduleReconnect(botId);
    }
  }

  private clearReconnect(botId: number): void {
    const state = this.reconnectState.get(botId);
    if (state?.timer) {
      clearTimeout(state.timer);
    }
    this.reconnectState.delete(botId);
  }

  private startProgressBroadcast(botId: number): void {
    this.stopProgressBroadcast(botId);
    const timer = setInterval(() => {
      const bot = this.bots.get(botId);
      if (!bot || bot.status !== 'playing') {
        this.stopProgressBroadcast(botId);
        return;
      }
      const progress = bot.playbackProgress;
      if (progress) {
        this.broadcast('music:bot:progress', {
          botId,
          position: progress.position,
          duration: progress.duration,
        });
      }
    }, PROGRESS_INTERVAL_MS);
    this.progressTimers.set(botId, timer);
  }

  private stopProgressBroadcast(botId: number): void {
    const timer = this.progressTimers.get(botId);
    if (timer) {
      clearInterval(timer);
      this.progressTimers.delete(botId);
    }
  }

  private broadcast(type: string, payload: any): void {
    const msg = JSON.stringify({ type, ...payload });
    this.wss.clients.forEach((client) => {
      if (client.readyState === 1) {
        client.send(msg);
      }
    });
  }
}
