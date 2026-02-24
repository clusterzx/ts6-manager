import { Router, Request, Response } from 'express';
import { requireRole } from '../middleware/rbac.js';
import type { ConnectionPool } from '../ts-client/connection-pool.js';

export const complaintRoutes: Router = Router({ mergeParams: true });

const getClient = (req: Request) => {
  const pool: ConnectionPool = req.app.locals.connectionPool;
  return pool.getClient(parseInt(String(req.params.configId)));
};
const getSid = (req: Request) => parseInt(String(req.params.sid));

complaintRoutes.get('/', async (req: Request, res: Response, next) => {
  try {
    const params = req.query.tcldbid ? { tcldbid: req.query.tcldbid } : undefined;
    res.json(await getClient(req).execute(getSid(req), 'complainlist', params));
  } catch (err) { next(err); }
});

complaintRoutes.post('/', requireRole('admin'), async (req: Request, res: Response, next) => {
  try {
    res.status(201).json(await getClient(req).execute(getSid(req), 'complainadd', req.body));
  } catch (err) { next(err); }
});

complaintRoutes.delete('/:tcldbid/:fcldbid', requireRole('admin'), async (req: Request, res: Response, next) => {
  try {
    res.json(await getClient(req).execute(getSid(req), 'complaindel', {
      tcldbid: String(req.params.tcldbid), fcldbid: String(req.params.fcldbid),
    }));
  } catch (err) { next(err); }
});
