import { Router, Request, Response } from 'express';
import { requireRole } from '../middleware/rbac.js';
import type { ConnectionPool } from '../ts-client/connection-pool.js';

export const channelGroupRoutes: Router = Router({ mergeParams: true });

const getClient = (req: Request) => {
  const pool: ConnectionPool = req.app.locals.connectionPool;
  return pool.getClient(parseInt(String(req.params.configId)));
};
const getSid = (req: Request) => parseInt(String(req.params.sid));

channelGroupRoutes.get('/', async (req: Request, res: Response, next) => {
  try { res.json(await getClient(req).execute(getSid(req), 'channelgrouplist')); } catch (err) { next(err); }
});

channelGroupRoutes.post('/', requireRole('admin'), async (req: Request, res: Response, next) => {
  try { res.status(201).json(await getClient(req).execute(getSid(req), 'channelgroupadd', req.body)); } catch (err) { next(err); }
});

channelGroupRoutes.put('/:cgid', requireRole('admin'), async (req: Request, res: Response, next) => {
  try {
    res.json(await getClient(req).execute(getSid(req), 'channelgrouprename', { cgid: String(req.params.cgid), ...req.body }));
  } catch (err) { next(err); }
});

channelGroupRoutes.delete('/:cgid', requireRole('admin'), async (req: Request, res: Response, next) => {
  try {
    res.json(await getClient(req).execute(getSid(req), 'channelgroupdel', { cgid: String(req.params.cgid), force: 1 }));
  } catch (err) { next(err); }
});

channelGroupRoutes.get('/:cgid/clients', async (req: Request, res: Response, next) => {
  try {
    res.json(await getClient(req).execute(getSid(req), 'channelgroupclientlist', { cgid: String(req.params.cgid) }));
  } catch (err) { next(err); }
});

channelGroupRoutes.post('/:cgid/assign', requireRole('admin'), async (req: Request, res: Response, next) => {
  try {
    res.json(await getClient(req).execute(getSid(req), 'setclientchannelgroup', { cgid: String(req.params.cgid), ...req.body }));
  } catch (err) { next(err); }
});

channelGroupRoutes.get('/:cgid/permissions', async (req: Request, res: Response, next) => {
  try {
    res.json(await getClient(req).execute(getSid(req), 'channelgrouppermlist', { cgid: String(req.params.cgid), '-permsid': '' }));
  } catch (err) { next(err); }
});

channelGroupRoutes.put('/:cgid/permissions', requireRole('admin'), async (req: Request, res: Response, next) => {
  try {
    res.json(await getClient(req).execute(getSid(req), 'channelgroupaddperm', { cgid: String(req.params.cgid), ...req.body }));
  } catch (err) { next(err); }
});

channelGroupRoutes.delete('/:cgid/permissions', requireRole('admin'), async (req: Request, res: Response, next) => {
  try {
    res.json(await getClient(req).execute(getSid(req), 'channelgroupdelperm', { cgid: String(req.params.cgid), ...req.body }));
  } catch (err) { next(err); }
});
