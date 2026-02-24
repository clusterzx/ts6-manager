import { Router, Request, Response } from 'express';
import { requireRole } from '../middleware/rbac.js';
import type { ConnectionPool } from '../ts-client/connection-pool.js';

export const channelRoutes: Router = Router({ mergeParams: true });

const getClient = (req: Request) => {
  const pool: ConnectionPool = req.app.locals.connectionPool;
  return pool.getClient(parseInt(String(req.params.configId)));
};
const getSid = (req: Request) => parseInt(String(req.params.sid));

channelRoutes.get('/', async (req: Request, res: Response, next) => {
  try {
    const result = await getClient(req).execute(getSid(req), 'channellist', {
      '-topic': '', '-flags': '', '-voice': '', '-limits': '', '-icon': '', '-secondsempty': '',
    });
    res.json(result);
  } catch (err) { next(err); }
});

channelRoutes.get('/:cid', async (req: Request, res: Response, next) => {
  try {
    const result = await getClient(req).execute(getSid(req), 'channelinfo', { cid: String(req.params.cid) });
    res.json(result);
  } catch (err) { next(err); }
});

channelRoutes.post('/', requireRole('admin'), async (req: Request, res: Response, next) => {
  try {
    const result = await getClient(req).execute(getSid(req), 'channelcreate', req.body);
    res.status(201).json(result);
  } catch (err) { next(err); }
});

channelRoutes.put('/:cid', requireRole('admin'), async (req: Request, res: Response, next) => {
  try {
    const result = await getClient(req).execute(getSid(req), 'channeledit', { cid: String(req.params.cid), ...req.body });
    res.json(result);
  } catch (err) { next(err); }
});

channelRoutes.delete('/:cid', requireRole('admin'), async (req: Request, res: Response, next) => {
  try {
    const result = await getClient(req).execute(getSid(req), 'channeldelete', {
      cid: String(req.params.cid), force: req.query.force || 1,
    });
    res.json(result);
  } catch (err) { next(err); }
});

channelRoutes.post('/:cid/move', requireRole('admin'), async (req: Request, res: Response, next) => {
  try {
    const result = await getClient(req).execute(getSid(req), 'channelmove', {
      cid: String(req.params.cid), ...req.body,
    });
    res.json(result);
  } catch (err) { next(err); }
});

channelRoutes.get('/:cid/permissions', async (req: Request, res: Response, next) => {
  try {
    const result = await getClient(req).execute(getSid(req), 'channelpermlist', {
      cid: String(req.params.cid), '-permsid': '',
    });
    res.json(result);
  } catch (err) { next(err); }
});

channelRoutes.put('/:cid/permissions', requireRole('admin'), async (req: Request, res: Response, next) => {
  try {
    const result = await getClient(req).execute(getSid(req), 'channeladdperm', {
      cid: String(req.params.cid), ...req.body,
    });
    res.json(result);
  } catch (err) { next(err); }
});

channelRoutes.delete('/:cid/permissions', requireRole('admin'), async (req: Request, res: Response, next) => {
  try {
    const result = await getClient(req).execute(getSid(req), 'channeldelperm', {
      cid: String(req.params.cid), ...req.body,
    });
    res.json(result);
  } catch (err) { next(err); }
});
