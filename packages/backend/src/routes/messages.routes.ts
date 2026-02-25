import { Router, Request, Response } from 'express';
import type { ConnectionPool } from '../ts-client/connection-pool.js';
import { requireRole } from '../middleware/rbac.js';

export const messageRoutes: Router = Router({ mergeParams: true });

const getClient = (req: Request) => {
  const pool: ConnectionPool = req.app.locals.connectionPool;
  return pool.getClient(parseInt(String(req.params.configId)));
};
const getSid = (req: Request) => parseInt(String(req.params.sid));

messageRoutes.get('/', async (req: Request, res: Response, next) => {
  try { res.json(await getClient(req).execute(getSid(req), 'messagelist')); } catch (err) { next(err); }
});

messageRoutes.get('/:msgid', async (req: Request, res: Response, next) => {
  try { res.json(await getClient(req).execute(getSid(req), 'messageget', { msgid: String(req.params.msgid) })); } catch (err) { next(err); }
});

// M1: Write operations require admin role
messageRoutes.post('/', requireRole('admin'), async (req: Request, res: Response, next) => {
  try { res.status(201).json(await getClient(req).execute(getSid(req), 'messageadd', req.body)); } catch (err) { next(err); }
});

messageRoutes.delete('/:msgid', requireRole('admin'), async (req: Request, res: Response, next) => {
  try { res.json(await getClient(req).execute(getSid(req), 'messagedel', { msgid: String(req.params.msgid) })); } catch (err) { next(err); }
});
