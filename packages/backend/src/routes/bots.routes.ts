import { Router, Request, Response } from 'express';
import { requireRole } from '../middleware/rbac.js';
import { AppError } from '../middleware/error-handler.js';

export const botRoutes: Router = Router();

botRoutes.get('/', async (req: Request, res: Response, next) => {
  try {
    const prisma = req.app.locals.prisma;
    const bots = await prisma.botFlow.findMany({
      include: { _count: { select: { executions: true } } },
      orderBy: { id: 'asc' },
    });
    res.json(bots.map((b: any) => ({
      id: b.id, name: b.name, description: b.description,
      serverConfigId: b.serverConfigId, virtualServerId: b.virtualServerId,
      enabled: b.enabled, createdAt: b.createdAt, updatedAt: b.updatedAt,
      executionCount: b._count.executions,
    })));
  } catch (err) { next(err); }
});

botRoutes.get('/:botId', async (req: Request, res: Response, next) => {
  try {
    const prisma = req.app.locals.prisma;
    const bot = await prisma.botFlow.findUnique({ where: { id: parseInt(String(req.params.botId)) } });
    if (!bot) throw new AppError(404, 'Bot flow not found');
    res.json({
      ...bot,
      flowData: JSON.parse(bot.flowData),
    });
  } catch (err) { next(err); }
});

botRoutes.post('/', requireRole('admin'), async (req: Request, res: Response, next) => {
  try {
    const prisma = req.app.locals.prisma;
    const { name, description, serverConfigId, virtualServerId, flowData } = req.body;

    const parsedConfigId = parseInt(serverConfigId);
    if (!name || isNaN(parsedConfigId)) {
      return res.status(400).json({ error: 'Name and valid serverConfigId are required' });
    }

    // Verify server config exists
    const serverConfig = await prisma.tsServerConfig.findUnique({ where: { id: parsedConfigId } });
    if (!serverConfig) {
      return res.status(400).json({ error: `Server config ${parsedConfigId} does not exist` });
    }

    const bot = await prisma.botFlow.create({
      data: {
        name, description,
        serverConfigId: parsedConfigId,
        virtualServerId: parseInt(virtualServerId) || 1,
        flowData: flowData ? JSON.stringify(flowData) : '{"nodes":[],"edges":[]}',
      },
    });
    res.status(201).json({ id: bot.id, name: bot.name });
  } catch (err) { next(err); }
});

botRoutes.put('/:botId', requireRole('admin'), async (req: Request, res: Response, next) => {
  try {
    const prisma = req.app.locals.prisma;
    const data: any = {};
    if (req.body.name !== undefined) data.name = req.body.name;
    if (req.body.description !== undefined) data.description = req.body.description;
    if (req.body.flowData !== undefined) data.flowData = JSON.stringify(req.body.flowData);
    if (req.body.serverConfigId !== undefined) data.serverConfigId = parseInt(req.body.serverConfigId);
    if (req.body.virtualServerId !== undefined) data.virtualServerId = parseInt(req.body.virtualServerId);

    const botId = parseInt(String(req.params.botId));
    const bot = await prisma.botFlow.update({
      where: { id: botId },
      data,
    });

    // Notify bot engine of flow update
    const botEngine = req.app.locals.botEngine;
    if (botEngine) await botEngine.reloadFlow(botId);

    res.json({ id: bot.id, name: bot.name });
  } catch (err) { next(err); }
});

botRoutes.delete('/:botId', requireRole('admin'), async (req: Request, res: Response, next) => {
  try {
    const prisma = req.app.locals.prisma;
    const botId = parseInt(String(req.params.botId));

    // Disable in engine before deleting
    const botEngine = req.app.locals.botEngine;
    if (botEngine) await botEngine.disableFlow(botId);

    await prisma.botFlow.delete({ where: { id: botId } });
    res.status(204).send();
  } catch (err) { next(err); }
});

botRoutes.post('/:botId/enable', requireRole('admin'), async (req: Request, res: Response, next) => {
  try {
    const prisma = req.app.locals.prisma;
    const botId = parseInt(String(req.params.botId));
    await prisma.botFlow.update({ where: { id: botId }, data: { enabled: true } });

    // Enable in bot engine
    const botEngine = req.app.locals.botEngine;
    if (botEngine) await botEngine.enableFlow(botId);

    res.json({ enabled: true });
  } catch (err) { next(err); }
});

botRoutes.post('/:botId/disable', requireRole('admin'), async (req: Request, res: Response, next) => {
  try {
    const prisma = req.app.locals.prisma;
    const botId = parseInt(String(req.params.botId));
    await prisma.botFlow.update({ where: { id: botId }, data: { enabled: false } });

    // Disable in bot engine
    const botEngine = req.app.locals.botEngine;
    if (botEngine) await botEngine.disableFlow(botId);

    res.json({ enabled: false });
  } catch (err) { next(err); }
});

botRoutes.get('/:botId/executions', async (req: Request, res: Response, next) => {
  try {
    const prisma = req.app.locals.prisma;
    const executions = await prisma.botExecution.findMany({
      where: { flowId: parseInt(String(req.params.botId)) },
      orderBy: { startedAt: 'desc' },
      take: 50,
    });
    res.json(executions);
  } catch (err) { next(err); }
});

botRoutes.get('/:botId/executions/:execId/logs', async (req: Request, res: Response, next) => {
  try {
    const prisma = req.app.locals.prisma;
    const logs = await prisma.botExecutionLog.findMany({
      where: { executionId: parseInt(String(req.params.execId)) },
      orderBy: { timestamp: 'asc' },
    });
    res.json(logs);
  } catch (err) { next(err); }
});
