import { Router, Request, Response } from 'express';
import { requireRole } from '../middleware/rbac.js';
import { AppError } from '../middleware/error-handler.js';

export const playlistRoutes: Router = Router();

playlistRoutes.use(requireRole('admin'));

// GET / — List playlists
playlistRoutes.get('/', async (req: Request, res: Response, next) => {
  try {
    const prisma = req.app.locals.prisma;
    const musicBotId = req.query.musicBotId ? parseInt(String(req.query.musicBotId)) : undefined;
    const playlists = await prisma.playlist.findMany({
      where: musicBotId ? { musicBotId } : undefined,
      include: { _count: { select: { songs: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(playlists.map((p: any) => ({
      id: p.id,
      name: p.name,
      musicBotId: p.musicBotId,
      songCount: p._count.songs,
      createdAt: p.createdAt,
    })));
  } catch (err) { next(err); }
});

// GET /:id — Get playlist with songs
playlistRoutes.get('/:id', async (req: Request, res: Response, next) => {
  try {
    const prisma = req.app.locals.prisma;
    const id = parseInt(req.params.id as string);
    const playlist = await prisma.playlist.findUnique({
      where: { id },
      include: {
        songs: {
          include: { song: true },
          orderBy: { position: 'asc' },
        },
      },
    });
    if (!playlist) throw new AppError(404, 'Playlist not found');

    res.json({
      id: playlist.id,
      name: playlist.name,
      musicBotId: playlist.musicBotId,
      songCount: playlist.songs.length,
      createdAt: playlist.createdAt,
      songs: playlist.songs.map((ps: any) => ({
        id: ps.song.id,
        title: ps.song.title,
        artist: ps.song.artist,
        duration: ps.song.duration,
        source: ps.song.source,
        sourceUrl: ps.song.sourceUrl,
        fileSize: ps.song.fileSize,
        createdAt: ps.song.createdAt,
        position: ps.position,
      })),
    });
  } catch (err) { next(err); }
});

// POST / — Create playlist
playlistRoutes.post('/', async (req: Request, res: Response, next) => {
  try {
    const prisma = req.app.locals.prisma;
    const { name, musicBotId } = req.body;
    if (!name) throw new AppError(400, 'name is required');

    const playlist = await prisma.playlist.create({
      data: {
        name,
        musicBotId: musicBotId ? parseInt(musicBotId) : null,
      },
    });

    res.status(201).json({ id: playlist.id, name: playlist.name });
  } catch (err) { next(err); }
});

// PUT /:id — Update playlist
playlistRoutes.put('/:id', async (req: Request, res: Response, next) => {
  try {
    const prisma = req.app.locals.prisma;
    const id = parseInt(req.params.id as string);
    const { name, musicBotId } = req.body;

    await prisma.playlist.update({
      where: { id },
      data: {
        ...(name != null && { name }),
        ...(musicBotId !== undefined && { musicBotId: musicBotId ? parseInt(musicBotId) : null }),
      },
    });

    res.json({ success: true });
  } catch (err) { next(err); }
});

// DELETE /:id — Delete playlist
playlistRoutes.delete('/:id', async (req: Request, res: Response, next) => {
  try {
    const prisma = req.app.locals.prisma;
    await prisma.playlist.delete({ where: { id: parseInt(req.params.id as string) } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// POST /:id/songs — Add song to playlist
playlistRoutes.post('/:id/songs', async (req: Request, res: Response, next) => {
  try {
    const prisma = req.app.locals.prisma;
    const playlistId = parseInt(req.params.id as string);
    const { songId } = req.body;
    if (!songId) throw new AppError(400, 'songId is required');

    // Get next position
    const maxPos = await prisma.playlistSong.aggregate({
      where: { playlistId },
      _max: { position: true },
    });
    const nextPosition = (maxPos._max.position ?? -1) + 1;

    await prisma.playlistSong.create({
      data: {
        playlistId,
        songId: parseInt(songId),
        position: nextPosition,
      },
    });

    res.status(201).json({ success: true });
  } catch (err) { next(err); }
});

// DELETE /:id/songs/:songId — Remove song from playlist
playlistRoutes.delete('/:id/songs/:songId', async (req: Request, res: Response, next) => {
  try {
    const prisma = req.app.locals.prisma;
    const playlistId = parseInt(req.params.id as string);
    const songId = parseInt(req.params.songId as string);

    await prisma.playlistSong.deleteMany({
      where: { playlistId, songId },
    });

    res.json({ success: true });
  } catch (err) { next(err); }
});

// PUT /:id/songs/reorder — Reorder songs
playlistRoutes.put('/:id/songs/reorder', async (req: Request, res: Response, next) => {
  try {
    const prisma = req.app.locals.prisma;
    const playlistId = parseInt(req.params.id as string);
    const { songIds } = req.body;
    if (!Array.isArray(songIds)) throw new AppError(400, 'songIds array is required');

    // Update positions in a transaction
    await prisma.$transaction(
      songIds.map((songId: number, index: number) =>
        prisma.playlistSong.updateMany({
          where: { playlistId, songId },
          data: { position: index },
        })
      )
    );

    res.json({ success: true });
  } catch (err) { next(err); }
});
