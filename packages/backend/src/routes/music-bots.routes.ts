import { Router, Request, Response } from 'express';
import { requireRole } from '../middleware/rbac.js';
import { AppError } from '../middleware/error-handler.js';
import type { VoiceBotManager } from '../voice/voice-bot-manager.js';

export const musicBotRoutes: Router = Router();

// All routes require admin role
musicBotRoutes.use(requireRole('admin'));

// GET / — List all music bots
musicBotRoutes.get('/', async (req: Request, res: Response, next) => {
  try {
    const prisma = req.app.locals.prisma;
    const manager: VoiceBotManager = req.app.locals.voiceBotManager;
    const dbBots = await prisma.musicBot.findMany({
      include: { serverConfig: { select: { id: true, name: true, host: true } } },
      orderBy: { id: 'asc' },
    });

    const runtimeInfo = manager.listBots();
    const runtimeMap = new Map(runtimeInfo.map((b: any) => [b.id, b]));

    res.json(dbBots.map((b: any) => {
      const runtime = runtimeMap.get(b.id);
      return {
        id: b.id,
        name: b.name,
        serverConfigId: b.serverConfigId,
        serverConfig: b.serverConfig,
        nickname: b.nickname,
        defaultChannel: b.defaultChannel,
        volume: b.volume,
        autoStart: b.autoStart,
        status: runtime?.status ?? 'stopped',
        nowPlaying: runtime?.nowPlaying ?? null,
        createdAt: b.createdAt,
      };
    }));
  } catch (err) { next(err); }
});

// GET /:id — Get bot details + runtime status
musicBotRoutes.get('/:id', async (req: Request, res: Response, next) => {
  try {
    const prisma = req.app.locals.prisma;
    const manager: VoiceBotManager = req.app.locals.voiceBotManager;
    const id = parseInt(req.params.id as string);
    const dbBot = await prisma.musicBot.findUnique({
      where: { id },
      include: { serverConfig: { select: { id: true, name: true, host: true } } },
    });
    if (!dbBot) throw new AppError(404, 'Music bot not found');

    const bot = manager.getBot(id);
    res.json({
      ...dbBot,
      identityData: undefined, // don't expose identity
      status: bot?.status ?? 'stopped',
      nowPlaying: bot?.nowPlaying ?? null,
      playbackProgress: bot?.playbackProgress ?? null,
    });
  } catch (err) { next(err); }
});

// POST / — Create bot
musicBotRoutes.post('/', async (req: Request, res: Response, next) => {
  try {
    const manager: VoiceBotManager = req.app.locals.voiceBotManager;
    const { name, serverConfigId, nickname, defaultChannel, channelPassword, volume, autoStart } = req.body;
    if (!name || !serverConfigId) throw new AppError(400, 'name and serverConfigId are required');

    const result = await manager.createBot({
      name,
      serverConfigId: parseInt(serverConfigId),
      nickname,
      defaultChannel,
      channelPassword,
      volume: volume != null ? parseInt(volume) : undefined,
      autoStart: autoStart ?? false,
    });

    res.status(201).json(result);
  } catch (err) { next(err); }
});

// PUT /:id — Update bot config
musicBotRoutes.put('/:id', async (req: Request, res: Response, next) => {
  try {
    const prisma = req.app.locals.prisma;
    const manager: VoiceBotManager = req.app.locals.voiceBotManager;
    const id = parseInt(req.params.id as string);
    const { name, nickname, defaultChannel, channelPassword, volume, autoStart } = req.body;

    const dbBot = await prisma.musicBot.update({
      where: { id },
      data: {
        ...(name != null && { name }),
        ...(nickname != null && { nickname }),
        ...(defaultChannel !== undefined && { defaultChannel }),
        ...(channelPassword !== undefined && { channelPassword }),
        ...(volume != null && { volume: parseInt(volume) }),
        ...(autoStart != null && { autoStart }),
      },
    });

    // Update runtime config if bot is loaded
    const bot = manager.getBot(id);
    if (bot) {
      bot.updateConfig({
        ...(name != null && { name }),
        ...(nickname != null && { nickname }),
        ...(defaultChannel !== undefined && { defaultChannel: defaultChannel || undefined }),
        ...(channelPassword !== undefined && { channelPassword: channelPassword || undefined }),
        ...(volume != null && { volume: parseInt(volume) }),
      });
    }

    res.json({ success: true });
  } catch (err) { next(err); }
});

// DELETE /:id — Delete bot
musicBotRoutes.delete('/:id', async (req: Request, res: Response, next) => {
  try {
    const manager: VoiceBotManager = req.app.locals.voiceBotManager;
    const id = parseInt(req.params.id as string);
    await manager.removeBot(id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// POST /:id/start — Start bot
musicBotRoutes.post('/:id/start', async (req: Request, res: Response, next) => {
  try {
    const manager: VoiceBotManager = req.app.locals.voiceBotManager;
    const id = parseInt(req.params.id as string);
    await manager.startBot(id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// POST /:id/stop — Stop bot
musicBotRoutes.post('/:id/stop', async (req: Request, res: Response, next) => {
  try {
    const manager: VoiceBotManager = req.app.locals.voiceBotManager;
    const id = parseInt(req.params.id as string);
    await manager.stopBot(id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// POST /:id/restart — Restart bot
musicBotRoutes.post('/:id/restart', async (req: Request, res: Response, next) => {
  try {
    const manager: VoiceBotManager = req.app.locals.voiceBotManager;
    const id = parseInt(req.params.id as string);
    const bot = manager.getBot(id);
    if (!bot) throw new AppError(404, 'Music bot not found');
    await bot.restart();
    res.json({ success: true });
  } catch (err) { next(err); }
});

// === Playback Control ===

// POST /:id/play — Play a song
musicBotRoutes.post('/:id/play', async (req: Request, res: Response, next) => {
  try {
    const prisma = req.app.locals.prisma;
    const manager: VoiceBotManager = req.app.locals.voiceBotManager;
    const id = parseInt(req.params.id as string);
    const { songId } = req.body;
    if (!songId) throw new AppError(400, 'songId is required');

    const bot = manager.getBot(id);
    if (!bot) throw new AppError(404, 'Music bot not found');
    if (bot.status !== 'connected' && bot.status !== 'playing' && bot.status !== 'paused') {
      throw new AppError(400, 'Bot is not connected');
    }

    const song = await prisma.song.findUnique({ where: { id: parseInt(songId) } });
    if (!song) throw new AppError(404, 'Song not found');

    const queueItem = {
      id: String(song.id),
      title: song.title,
      artist: song.artist ?? undefined,
      duration: song.duration ?? undefined,
      filePath: song.filePath,
      source: song.source as 'local' | 'youtube' | 'url',
      sourceUrl: song.sourceUrl ?? undefined,
    };

    // Add to queue so repeat modes work, then play
    bot.queue.add(queueItem);
    bot.queue.playAt(bot.queue.length - 1);
    await bot.play(queueItem);

    res.json({ success: true });
  } catch (err) { next(err); }
});

// POST /:id/play-radio — Play a radio station (streaming)
musicBotRoutes.post('/:id/play-radio', async (req: Request, res: Response, next) => {
  try {
    const prisma = req.app.locals.prisma;
    const manager: VoiceBotManager = req.app.locals.voiceBotManager;
    const id = parseInt(req.params.id as string);
    const { stationId } = req.body;
    if (!stationId) throw new AppError(400, 'stationId is required');

    const bot = manager.getBot(id);
    if (!bot) throw new AppError(404, 'Music bot not found');
    if (bot.status !== 'connected' && bot.status !== 'playing' && bot.status !== 'paused') {
      throw new AppError(400, 'Bot is not connected');
    }

    const station = await prisma.radioStation.findUnique({ where: { id: parseInt(stationId) } });
    if (!station) throw new AppError(404, 'Radio station not found');

    const queueItem = {
      id: `radio_${station.id}`,
      title: station.name,
      artist: station.genre ?? 'Radio',
      filePath: '',
      source: 'radio' as const,
      streamUrl: station.url,
    };

    await bot.playStream(queueItem);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// POST /:id/pause
musicBotRoutes.post('/:id/pause', async (req: Request, res: Response, next) => {
  try {
    const manager: VoiceBotManager = req.app.locals.voiceBotManager;
    const bot = manager.getBot(parseInt(req.params.id as string));
    if (!bot) throw new AppError(404, 'Music bot not found');
    bot.pause();
    res.json({ success: true });
  } catch (err) { next(err); }
});

// POST /:id/resume
musicBotRoutes.post('/:id/resume', async (req: Request, res: Response, next) => {
  try {
    const manager: VoiceBotManager = req.app.locals.voiceBotManager;
    const bot = manager.getBot(parseInt(req.params.id as string));
    if (!bot) throw new AppError(404, 'Music bot not found');
    bot.resume();
    res.json({ success: true });
  } catch (err) { next(err); }
});

// POST /:id/stop-playback
musicBotRoutes.post('/:id/stop-playback', async (req: Request, res: Response, next) => {
  try {
    const manager: VoiceBotManager = req.app.locals.voiceBotManager;
    const bot = manager.getBot(parseInt(req.params.id as string));
    if (!bot) throw new AppError(404, 'Music bot not found');
    bot.stopAudio();
    res.json({ success: true });
  } catch (err) { next(err); }
});

// POST /:id/skip
musicBotRoutes.post('/:id/skip', async (req: Request, res: Response, next) => {
  try {
    const manager: VoiceBotManager = req.app.locals.voiceBotManager;
    const bot = manager.getBot(parseInt(req.params.id as string));
    if (!bot) throw new AppError(404, 'Music bot not found');
    bot.skip();
    res.json({ success: true });
  } catch (err) { next(err); }
});

// POST /:id/previous
musicBotRoutes.post('/:id/previous', async (req: Request, res: Response, next) => {
  try {
    const manager: VoiceBotManager = req.app.locals.voiceBotManager;
    const bot = manager.getBot(parseInt(req.params.id as string));
    if (!bot) throw new AppError(404, 'Music bot not found');
    bot.previous();
    res.json({ success: true });
  } catch (err) { next(err); }
});

// POST /:id/seek
musicBotRoutes.post('/:id/seek', async (req: Request, res: Response, next) => {
  try {
    const manager: VoiceBotManager = req.app.locals.voiceBotManager;
    const bot = manager.getBot(parseInt(req.params.id as string));
    if (!bot) throw new AppError(404, 'Music bot not found');
    const { seconds } = req.body;
    bot.seek(parseFloat(seconds) || 0);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// POST /:id/volume
musicBotRoutes.post('/:id/volume', async (req: Request, res: Response, next) => {
  try {
    const prisma = req.app.locals.prisma;
    const manager: VoiceBotManager = req.app.locals.voiceBotManager;
    const id = parseInt(req.params.id as string);
    const { volume } = req.body;
    const vol = Math.max(0, Math.min(100, parseInt(volume) || 50));

    const bot = manager.getBot(id);
    if (bot) bot.setVolume(vol);
    await prisma.musicBot.update({ where: { id }, data: { volume: vol } });

    res.json({ success: true, volume: vol });
  } catch (err) { next(err); }
});

// GET /:id/state — Full playback state
musicBotRoutes.get('/:id/state', async (req: Request, res: Response, next) => {
  try {
    const manager: VoiceBotManager = req.app.locals.voiceBotManager;
    const bot = manager.getBot(parseInt(req.params.id as string));
    if (!bot) throw new AppError(404, 'Music bot not found');

    const progress = bot.playbackProgress;
    res.json({
      status: bot.status,
      nowPlaying: bot.nowPlaying,
      position: progress?.position ?? 0,
      duration: progress?.duration ?? 0,
      volume: bot.currentConfig.volume,
      queue: bot.queue.getAll(),
      currentIndex: -1, // PlayQueue doesn't expose this directly
      shuffle: bot.queue.shuffle,
      repeat: bot.queue.repeat,
      isStreaming: bot.isStreaming,
    });
  } catch (err) { next(err); }
});

// === Queue ===

// GET /:id/queue
musicBotRoutes.get('/:id/queue', async (req: Request, res: Response, next) => {
  try {
    const manager: VoiceBotManager = req.app.locals.voiceBotManager;
    const bot = manager.getBot(parseInt(req.params.id as string));
    if (!bot) throw new AppError(404, 'Music bot not found');
    res.json({
      items: bot.queue.getAll(),
      shuffle: bot.queue.shuffle,
      repeat: bot.queue.repeat,
    });
  } catch (err) { next(err); }
});

// POST /:id/queue — Enqueue a song
musicBotRoutes.post('/:id/queue', async (req: Request, res: Response, next) => {
  try {
    const prisma = req.app.locals.prisma;
    const manager: VoiceBotManager = req.app.locals.voiceBotManager;
    const bot = manager.getBot(parseInt(req.params.id as string));
    if (!bot) throw new AppError(404, 'Music bot not found');

    const { songId } = req.body;
    const song = await prisma.song.findUnique({ where: { id: parseInt(songId) } });
    if (!song) throw new AppError(404, 'Song not found');

    bot.queue.add({
      id: String(song.id),
      title: song.title,
      artist: song.artist ?? undefined,
      duration: song.duration ?? undefined,
      filePath: song.filePath,
      source: song.source as any,
      sourceUrl: song.sourceUrl ?? undefined,
    });

    res.json({ success: true, queueLength: bot.queue.length });
  } catch (err) { next(err); }
});

// POST /:id/queue/playlist — Load playlist into queue
musicBotRoutes.post('/:id/queue/playlist', async (req: Request, res: Response, next) => {
  try {
    const prisma = req.app.locals.prisma;
    const manager: VoiceBotManager = req.app.locals.voiceBotManager;
    const bot = manager.getBot(parseInt(req.params.id as string));
    if (!bot) throw new AppError(404, 'Music bot not found');

    const { playlistId, clearFirst } = req.body;
    const playlist = await prisma.playlist.findUnique({
      where: { id: parseInt(playlistId) },
      include: { songs: { include: { song: true }, orderBy: { position: 'asc' } } },
    });
    if (!playlist) throw new AppError(404, 'Playlist not found');

    if (clearFirst) bot.queue.clear();

    const items = playlist.songs.map((ps: any) => ({
      id: String(ps.song.id),
      title: ps.song.title,
      artist: ps.song.artist ?? undefined,
      duration: ps.song.duration ?? undefined,
      filePath: ps.song.filePath,
      source: ps.song.source as any,
      sourceUrl: ps.song.sourceUrl ?? undefined,
    }));

    bot.queue.addMany(items);
    res.json({ success: true, queueLength: bot.queue.length });
  } catch (err) { next(err); }
});

// DELETE /:id/queue/:index — Remove from queue
musicBotRoutes.delete('/:id/queue/:index', async (req: Request, res: Response, next) => {
  try {
    const manager: VoiceBotManager = req.app.locals.voiceBotManager;
    const bot = manager.getBot(parseInt(req.params.id as string));
    if (!bot) throw new AppError(404, 'Music bot not found');

    const items = bot.queue.getAll();
    const index = parseInt(req.params.index as string);
    if (index >= 0 && index < items.length) {
      bot.queue.remove(items[index].id);
    }
    res.json({ success: true });
  } catch (err) { next(err); }
});

// DELETE /:id/queue — Clear queue
musicBotRoutes.delete('/:id/queue', async (req: Request, res: Response, next) => {
  try {
    const manager: VoiceBotManager = req.app.locals.voiceBotManager;
    const bot = manager.getBot(parseInt(req.params.id as string));
    if (!bot) throw new AppError(404, 'Music bot not found');
    bot.queue.clear();
    res.json({ success: true });
  } catch (err) { next(err); }
});

// POST /:id/queue/shuffle
musicBotRoutes.post('/:id/queue/shuffle', async (req: Request, res: Response, next) => {
  try {
    const manager: VoiceBotManager = req.app.locals.voiceBotManager;
    const bot = manager.getBot(parseInt(req.params.id as string));
    if (!bot) throw new AppError(404, 'Music bot not found');
    bot.queue.setShuffle(req.body.enabled ?? true);
    res.json({ success: true, shuffle: bot.queue.shuffle });
  } catch (err) { next(err); }
});

// POST /:id/queue/repeat
musicBotRoutes.post('/:id/queue/repeat', async (req: Request, res: Response, next) => {
  try {
    const manager: VoiceBotManager = req.app.locals.voiceBotManager;
    const bot = manager.getBot(parseInt(req.params.id as string));
    if (!bot) throw new AppError(404, 'Music bot not found');
    const mode = req.body.mode ?? 'off';
    if (!['off', 'track', 'queue'].includes(mode)) throw new AppError(400, 'Invalid repeat mode');
    bot.queue.setRepeat(mode);
    res.json({ success: true, repeat: bot.queue.repeat });
  } catch (err) { next(err); }
});
