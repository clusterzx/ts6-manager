import { Router, Request, Response } from 'express';
import { nanoid } from 'nanoid';
import { requireRole } from '../middleware/rbac.js';
import { AppError } from '../middleware/error-handler.js';
import { widgetDataCache } from './widget-public.routes.js';

export const widgetRoutes: Router = Router();

// GET / — List all widgets
widgetRoutes.get('/', async (req: Request, res: Response, next) => {
  try {
    const prisma = req.app.locals.prisma;
    const widgets = await prisma.widget.findMany({
      orderBy: { createdAt: 'desc' },
      include: { serverConfig: { select: { id: true, name: true, host: true } } },
    });
    res.json(widgets);
  } catch (err) { next(err); }
});

// POST / — Create widget (admin only)
widgetRoutes.post('/', requireRole('admin'), async (req: Request, res: Response, next) => {
  try {
    const prisma = req.app.locals.prisma;
    const { name, serverConfigId, virtualServerId, theme, showChannelTree, showClients, maxChannelDepth } = req.body;

    if (!name || !serverConfigId) throw new AppError(400, 'name and serverConfigId are required');

    const serverConfig = await prisma.tsServerConfig.findUnique({ where: { id: serverConfigId } });
    if (!serverConfig) throw new AppError(404, 'Server config not found');

    const widget = await prisma.widget.create({
      data: {
        name,
        token: nanoid(21),
        serverConfigId,
        virtualServerId: virtualServerId ?? 1,
        theme: theme ?? 'dark',
        showChannelTree: showChannelTree ?? true,
        showClients: showClients ?? true,
        maxChannelDepth: maxChannelDepth ?? 5,
      },
      include: { serverConfig: { select: { id: true, name: true, host: true } } },
    });

    res.status(201).json(widget);
  } catch (err) { next(err); }
});

// PATCH /:id — Update widget (admin only)
widgetRoutes.patch('/:id', requireRole('admin'), async (req: Request, res: Response, next) => {
  try {
    const prisma = req.app.locals.prisma;
    const id = parseInt(req.params.id as string);
    const { name, theme, showChannelTree, showClients, maxChannelDepth } = req.body;

    // Invalidate cache for this widget's token
    const existing = await prisma.widget.findUnique({ where: { id } });
    if (!existing) throw new AppError(404, 'Widget not found');
    widgetDataCache.delete(existing.token);

    const widget = await prisma.widget.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(theme !== undefined && { theme }),
        ...(showChannelTree !== undefined && { showChannelTree }),
        ...(showClients !== undefined && { showClients }),
        ...(maxChannelDepth !== undefined && { maxChannelDepth }),
      },
      include: { serverConfig: { select: { id: true, name: true, host: true } } },
    });

    res.json(widget);
  } catch (err) { next(err); }
});

// DELETE /:id — Delete widget (admin only)
widgetRoutes.delete('/:id', requireRole('admin'), async (req: Request, res: Response, next) => {
  try {
    const prisma = req.app.locals.prisma;
    const id = parseInt(req.params.id as string);

    const existing = await prisma.widget.findUnique({ where: { id } });
    if (!existing) throw new AppError(404, 'Widget not found');
    widgetDataCache.delete(existing.token);

    await prisma.widget.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// POST /:id/regenerate-token — Rotate token (admin only)
widgetRoutes.post('/:id/regenerate-token', requireRole('admin'), async (req: Request, res: Response, next) => {
  try {
    const prisma = req.app.locals.prisma;
    const id = parseInt(req.params.id as string);

    const existing = await prisma.widget.findUnique({ where: { id } });
    if (!existing) throw new AppError(404, 'Widget not found');
    widgetDataCache.delete(existing.token);

    const widget = await prisma.widget.update({
      where: { id },
      data: { token: nanoid(21) },
      include: { serverConfig: { select: { id: true, name: true, host: true } } },
    });

    res.json(widget);
  } catch (err) { next(err); }
});
