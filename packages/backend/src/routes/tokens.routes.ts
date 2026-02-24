import { Router, Request, Response } from 'express';
import { requireRole } from '../middleware/rbac.js';
import type { ConnectionPool } from '../ts-client/connection-pool.js';

export const tokenRoutes: Router = Router({ mergeParams: true });

const getClient = (req: Request) => {
  const pool: ConnectionPool = req.app.locals.connectionPool;
  return pool.getClient(parseInt(String(req.params.configId)));
};
const getSid = (req: Request) => parseInt(String(req.params.sid));

tokenRoutes.get('/', async (req: Request, res: Response, next) => {
  try { res.json(await getClient(req).execute(getSid(req), 'privilegekeylist')); } catch (err) { next(err); }
});

tokenRoutes.post('/', requireRole('admin'), async (req: Request, res: Response, next) => {
  try { res.status(201).json(await getClient(req).execute(getSid(req), 'privilegekeyadd', req.body)); } catch (err) { next(err); }
});

tokenRoutes.delete('/:token', requireRole('admin'), async (req: Request, res: Response, next) => {
  try { res.json(await getClient(req).execute(getSid(req), 'privilegekeydelete', { token: String(req.params.token) })); } catch (err) { next(err); }
});
