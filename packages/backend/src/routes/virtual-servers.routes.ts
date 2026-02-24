import { Router, Request, Response } from 'express';
import { requireRole } from '../middleware/rbac.js';
import type { ConnectionPool } from '../ts-client/connection-pool.js';

export const virtualServerRoutes: Router = Router({ mergeParams: true });

const getClient = (req: Request) => {
  const pool: ConnectionPool = req.app.locals.connectionPool;
  return pool.getClient(parseInt(String(req.params.configId)));
};

virtualServerRoutes.get('/', async (req: Request, res: Response, next) => {
  try {
    const result = await getClient(req).execute(0, 'serverlist');
    res.json(result);
  } catch (err) { next(err); }
});

virtualServerRoutes.get('/:sid/info', async (req: Request, res: Response, next) => {
  try {
    const sid = parseInt(String(req.params.sid));
    const result = await getClient(req).execute(sid, 'serverinfo');
    res.json(result);
  } catch (err) { next(err); }
});

virtualServerRoutes.put('/:sid', requireRole('admin'), async (req: Request, res: Response, next) => {
  try {
    const sid = parseInt(String(req.params.sid));
    const result = await getClient(req).execute(sid, 'serveredit', req.body);
    res.json(result);
  } catch (err) { next(err); }
});

virtualServerRoutes.post('/', requireRole('admin'), async (req: Request, res: Response, next) => {
  try {
    const result = await getClient(req).execute(0, 'servercreate', req.body);
    res.status(201).json(result);
  } catch (err) { next(err); }
});

virtualServerRoutes.post('/:sid/start', requireRole('admin'), async (req: Request, res: Response, next) => {
  try {
    const sid = parseInt(String(req.params.sid));
    const result = await getClient(req).execute(0, 'serverstart', { sid });
    res.json(result);
  } catch (err) { next(err); }
});

virtualServerRoutes.post('/:sid/stop', requireRole('admin'), async (req: Request, res: Response, next) => {
  try {
    const sid = parseInt(String(req.params.sid));
    const result = await getClient(req).execute(0, 'serverstop', { sid });
    res.json(result);
  } catch (err) { next(err); }
});

virtualServerRoutes.delete('/:sid', requireRole('admin'), async (req: Request, res: Response, next) => {
  try {
    const sid = parseInt(String(req.params.sid));
    const result = await getClient(req).execute(0, 'serverdelete', { sid });
    res.json(result);
  } catch (err) { next(err); }
});

virtualServerRoutes.post('/:sid/snapshot', requireRole('admin'), async (req: Request, res: Response, next) => {
  try {
    const sid = parseInt(String(req.params.sid));
    const result = await getClient(req).execute(sid, 'serversnapshotcreate');
    res.json(result);
  } catch (err) { next(err); }
});

virtualServerRoutes.post('/:sid/snapshot/deploy', requireRole('admin'), async (req: Request, res: Response, next) => {
  try {
    const sid = parseInt(String(req.params.sid));
    const result = await getClient(req).executePost(sid, 'serversnapshotdeploy', req.body);
    res.json(result);
  } catch (err) { next(err); }
});

virtualServerRoutes.get('/:sid/connection-info', async (req: Request, res: Response, next) => {
  try {
    const sid = parseInt(String(req.params.sid));
    const result = await getClient(req).execute(sid, 'serverrequestconnectioninfo');
    res.json(result);
  } catch (err) { next(err); }
});
