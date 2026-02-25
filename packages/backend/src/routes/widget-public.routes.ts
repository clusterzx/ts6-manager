import { Router, Request, Response } from 'express';
import type { ConnectionPool } from '../ts-client/connection-pool.js';
import { buildWidgetTree } from '../widget/build-widget-tree.js';
import { renderWidgetSvg } from '../widget/widget-svg.js';
import type { WidgetData } from '@ts6/common';

// Simple in-process cache (45s TTL)
interface CacheEntry { data: WidgetData; expiresAt: number; }
export const widgetDataCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 45_000;

async function getWidgetData(token: string, req: Request): Promise<WidgetData | null> {
  const cached = widgetDataCache.get(token);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const prisma = req.app.locals.prisma;
  const widget = await prisma.widget.findUnique({ where: { token } });
  if (!widget) return null;

  const pool: ConnectionPool = req.app.locals.connectionPool;
  let client;
  try {
    client = pool.getClient(widget.serverConfigId);
  } catch {
    return null; // server offline
  }

  const sid = widget.virtualServerId;

  const [serverInfoRaw, channelListRaw, clientListRaw] = await Promise.all([
    client.execute(sid, 'serverinfo'),
    client.execute(sid, 'channellist'),
    client.execute(sid, 'clientlist'),
  ]);

  const info = Array.isArray(serverInfoRaw) ? serverInfoRaw[0] : serverInfoRaw;
  const channels = Array.isArray(channelListRaw) ? channelListRaw : [];
  const clients = Array.isArray(clientListRaw) ? clientListRaw : [];
  const onlineClients = clients.filter((c: any) => String(c.client_type) === '0');

  const data: WidgetData = {
    serverName: info.virtualserver_name || 'TeamSpeak Server',
    onlineUsers: onlineClients.length,
    maxClients: Number(info.virtualserver_maxclients) || 0,
    uptime: Number(info.virtualserver_uptime) || 0,
    platform: info.virtualserver_platform || '',
    version: info.virtualserver_version || '',
    theme: widget.theme as any,
    showChannelTree: widget.showChannelTree,
    showClients: widget.showClients,
    channelTree: widget.showChannelTree
      ? buildWidgetTree(channels, clients, widget.maxChannelDepth, widget.showClients)
      : [],
    fetchedAt: new Date().toISOString(),
  };

  widgetDataCache.set(token, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  return data;
}

export const widgetPublicRoutes: Router = Router();

// GET /:token/data — JSON widget data
widgetPublicRoutes.get('/:token/data', async (req: Request, res: Response, next) => {
  try {
    const token = req.params.token as string;
    const data = await getWidgetData(token, req);
    if (!data) return res.status(404).json({ error: 'Widget not found or server offline' });
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=45');
    res.json(data);
  } catch (err) { next(err); }
});

// GET /:token/image.svg — SVG image
widgetPublicRoutes.get('/:token/image.svg', async (req: Request, res: Response, next) => {
  try {
    const token = req.params.token as string;
    const data = await getWidgetData(token, req);
    if (!data) return res.status(404).send('Widget not found');
    const svg = renderWidgetSvg(data);
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=45');
    res.send(svg);
  } catch (err) { next(err); }
});

// GET /:token/image.png — PNG image
widgetPublicRoutes.get('/:token/image.png', async (req: Request, res: Response, next) => {
  try {
    const token = req.params.token as string;
    const data = await getWidgetData(token, req);
    if (!data) return res.status(404).send('Widget not found');
    const svg = renderWidgetSvg(data);

    let pngBuffer: Buffer;
    try {
      const { Resvg } = await import('@resvg/resvg-js');
      const resvg = new Resvg(svg, { fitTo: { mode: 'width' as const, value: 400 } });
      pngBuffer = Buffer.from(resvg.render().asPng());
    } catch {
      // If @resvg/resvg-js is not available, fall back to SVG
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.send(svg);
    }

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=45');
    res.send(pngBuffer);
  } catch (err) { next(err); }
});
