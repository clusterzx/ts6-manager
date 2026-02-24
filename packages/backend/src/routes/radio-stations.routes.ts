import { Router, Request, Response } from 'express';
import { requireRole } from '../middleware/rbac.js';
import { AppError } from '../middleware/error-handler.js';
import type { RadioPreset } from '@ts6/common';

export const radioStationRoutes: Router = Router({ mergeParams: true });

radioStationRoutes.use(requireRole('admin'));

// Built-in radio station presets
const RADIO_PRESETS: RadioPreset[] = [
  { name: '1LIVE', url: 'https://wdr-1live-live.icecast.wdr.de/wdr/1live/live/mp3/128/stream.mp3', genre: 'Pop/Rock' },
  { name: 'WDR 2', url: 'https://wdr-wdr2-rheinland.icecast.wdr.de/wdr/wdr2/rheinland/mp3/128/stream.mp3', genre: 'Pop' },
  { name: 'SWR3', url: 'https://liveradio.swr.de/sw282p3/swr3/play.mp3', genre: 'Pop' },
  { name: 'BigFM', url: 'https://streams.bigfm.de/bigfm-deutschland-128-mp3', genre: 'Pop/Dance' },
  { name: 'Technobase.FM', url: 'https://listen.technobase.fm/tunein-mp3-pls', genre: 'Techno/Dance' },
  { name: 'HardBase.FM', url: 'https://listen.hardbase.fm/tunein-mp3-pls', genre: 'Hardstyle' },
  { name: 'HouseTime.FM', url: 'https://listen.housetime.fm/tunein-mp3-pls', genre: 'House' },
  { name: 'TranceBase.FM', url: 'https://listen.trancebase.fm/tunein-mp3-pls', genre: 'Trance' },
  { name: 'Lofi Hip Hop', url: 'https://play.streamafrica.net/lofiradio', genre: 'Lofi/Chill' },
  { name: 'BBC Radio 1', url: 'http://stream.live.vc.bbcmedia.co.uk/bbc_radio_one', genre: 'Pop/Chart' },
  { name: 'Classic FM', url: 'https://media-ice.musicradio.com/ClassicFMMP3', genre: 'Classical' },
  { name: 'Absolute Radio', url: 'https://ais-sa5.cdnstream1.com/b75154_128mp3', genre: 'Rock' },
  { name: 'Jazz Radio', url: 'http://jazz-wr04.ice.infomaniak.ch/jazz-wr04-128.mp3', genre: 'Jazz' },
  { name: 'Sunshine Live', url: 'https://stream.sunshine-live.de/live/mp3-192/stream.sunshine-live.de/', genre: 'Electronic' },
  { name: 'Radio BOB!', url: 'https://streams.radiobob.de/bob-live/mp3-192/mediaplayer', genre: 'Rock' },
  { name: 'Deutschlandfunk', url: 'https://st01.dlf.de/dlf/01/128/mp3/stream.mp3', genre: 'News/Culture' },
];

// GET /presets — Built-in radio station presets
radioStationRoutes.get('/presets', (_req: Request, res: Response) => {
  res.json(RADIO_PRESETS);
});

// GET / — List radio stations for this server
radioStationRoutes.get('/', async (req: Request, res: Response, next) => {
  try {
    const prisma = req.app.locals.prisma;
    const configId = parseInt(req.params.configId as string);
    const stations = await prisma.radioStation.findMany({
      where: { serverConfigId: configId },
      orderBy: { name: 'asc' },
    });
    res.json(stations);
  } catch (err) { next(err); }
});

// POST / — Add radio station
radioStationRoutes.post('/', async (req: Request, res: Response, next) => {
  try {
    const prisma = req.app.locals.prisma;
    const configId = parseInt(req.params.configId as string);
    const { name, url, genre, imageUrl } = req.body;
    if (!name || !url) throw new AppError(400, 'name and url are required');

    const station = await prisma.radioStation.create({
      data: {
        name,
        url,
        genre: genre || null,
        imageUrl: imageUrl || null,
        serverConfigId: configId,
      },
    });
    res.status(201).json(station);
  } catch (err) { next(err); }
});

// DELETE /:id — Remove radio station
radioStationRoutes.delete('/:id', async (req: Request, res: Response, next) => {
  try {
    const prisma = req.app.locals.prisma;
    const id = parseInt(req.params.id as string);
    await prisma.radioStation.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) { next(err); }
});
