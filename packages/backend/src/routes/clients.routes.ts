import { Router, Request, Response } from 'express';
import { requireRole } from '../middleware/rbac.js';
import type { ConnectionPool } from '../ts-client/connection-pool.js';

export const clientRoutes: Router = Router({ mergeParams: true });

const getClient = (req: Request) => {
  const pool: ConnectionPool = req.app.locals.connectionPool;
  return pool.getClient(parseInt(String(req.params.configId)));
};
const getSid = (req: Request) => parseInt(String(req.params.sid));

clientRoutes.get('/', async (req: Request, res: Response, next) => {
  try {
    // M2: Only include -ip flag for admin users
    const flags: Record<string, string> = {
      '-uid': '', '-away': '', '-voice': '', '-times': '', '-groups': '', '-info': '', '-country': '',
    };
    if (req.user?.role === 'admin') {
      flags['-ip'] = '';
    }
    const result = await getClient(req).execute(getSid(req), 'clientlist', flags);
    res.json(result);
  } catch (err) { next(err); }
});

clientRoutes.get('/database', async (req: Request, res: Response, next) => {
  try {
    const result = await getClient(req).execute(getSid(req), 'clientdblist', {
      start: req.query.start || 0, duration: req.query.duration || 100,
    });
    res.json(result);
  } catch (err) { next(err); }
});

clientRoutes.get('/database/:cldbid', async (req: Request, res: Response, next) => {
  try {
    const result = await getClient(req).execute(getSid(req), 'clientdbinfo', { cldbid: String(req.params.cldbid) });
    res.json(result);
  } catch (err) { next(err); }
});

clientRoutes.get('/:clid', async (req: Request, res: Response, next) => {
  try {
    const result = await getClient(req).execute(getSid(req), 'clientinfo', { clid: String(req.params.clid) });
    res.json(result);
  } catch (err) { next(err); }
});

clientRoutes.post('/:clid/kick', requireRole('admin'), async (req: Request, res: Response, next) => {
  try {
    const result = await getClient(req).execute(getSid(req), 'clientkick', {
      clid: String(req.params.clid), reasonid: req.body.reasonid || 5, reasonmsg: req.body.reasonmsg,
    });
    res.json(result);
  } catch (err) { next(err); }
});

clientRoutes.post('/:clid/ban', requireRole('admin'), async (req: Request, res: Response, next) => {
  try {
    const result = await getClient(req).execute(getSid(req), 'banclient', {
      clid: String(req.params.clid), time: req.body.time || 0, banreason: req.body.banreason,
    });
    res.json(result);
  } catch (err) { next(err); }
});

clientRoutes.post('/:clid/move', requireRole('admin'), async (req: Request, res: Response, next) => {
  try {
    const result = await getClient(req).execute(getSid(req), 'clientmove', {
      clid: String(req.params.clid), cid: req.body.cid, cpw: req.body.cpw,
    });
    res.json(result);
  } catch (err) { next(err); }
});

clientRoutes.post('/:clid/poke', requireRole('admin'), async (req: Request, res: Response, next) => {
  try {
    const result = await getClient(req).execute(getSid(req), 'clientpoke', {
      clid: String(req.params.clid), msg: req.body.msg,
    });
    res.json(result);
  } catch (err) { next(err); }
});

clientRoutes.post('/:clid/message', requireRole('admin'), async (req: Request, res: Response, next) => {
  try {
    const result = await getClient(req).execute(getSid(req), 'sendtextmessage', {
      targetmode: 1, target: String(req.params.clid), msg: req.body.msg,
    });
    res.json(result);
  } catch (err) { next(err); }
});

clientRoutes.get('/:clid/permissions', async (req: Request, res: Response, next) => {
  try {
    const result = await getClient(req).execute(getSid(req), 'clientpermlist', {
      cldbid: String(req.params.clid), '-permsid': '',
    });
    res.json(result);
  } catch (err) { next(err); }
});

clientRoutes.get('/:clid/groups', async (req: Request, res: Response, next) => {
  try {
    const result = await getClient(req).execute(getSid(req), 'servergroupsbyclientid', {
      cldbid: String(req.params.clid),
    });
    res.json(result);
  } catch (err) { next(err); }
});
