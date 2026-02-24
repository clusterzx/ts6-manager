import { Router, Request, Response } from 'express';
import { requireRole } from '../middleware/rbac.js';
import type { ConnectionPool } from '../ts-client/connection-pool.js';

export const instanceRoutes: Router = Router({ mergeParams: true });

const getClient = (req: Request) => {
  const pool: ConnectionPool = req.app.locals.connectionPool;
  return pool.getClient(parseInt(String(req.params.configId)));
};

instanceRoutes.get('/', async (req: Request, res: Response, next) => {
  try { res.json(await getClient(req).execute(0, 'instanceinfo')); } catch (err) { next(err); }
});

instanceRoutes.put('/', requireRole('admin'), async (req: Request, res: Response, next) => {
  try { res.json(await getClient(req).execute(0, 'instanceedit', req.body)); } catch (err) { next(err); }
});

instanceRoutes.get('/host', async (req: Request, res: Response, next) => {
  try { res.json(await getClient(req).execute(0, 'hostinfo')); } catch (err) { next(err); }
});

instanceRoutes.get('/version', async (req: Request, res: Response, next) => {
  try { res.json(await getClient(req).execute(0, 'version')); } catch (err) { next(err); }
});
