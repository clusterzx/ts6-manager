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

// M3: Whitelist safe parameters for instanceedit
const ALLOWED_INSTANCE_PARAMS = new Set([
  'serverinstance_guest_serverquery_group',
  'serverinstance_template_serveradmin_group',
  'serverinstance_template_serverdefault_group',
  'serverinstance_template_channeladmin_group',
  'serverinstance_template_channeldefault_group',
  'serverinstance_filetransfer_port',
  'serverinstance_serverquery_flood_commands',
  'serverinstance_serverquery_flood_time',
  'serverinstance_serverquery_ban_time',
]);

instanceRoutes.put('/', requireRole('admin'), async (req: Request, res: Response, next) => {
  try {
    const filtered: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(req.body)) {
      if (ALLOWED_INSTANCE_PARAMS.has(key)) filtered[key] = val;
    }
    res.json(await getClient(req).execute(0, 'instanceedit', filtered));
  } catch (err) { next(err); }
});

instanceRoutes.get('/host', async (req: Request, res: Response, next) => {
  try { res.json(await getClient(req).execute(0, 'hostinfo')); } catch (err) { next(err); }
});

instanceRoutes.get('/version', async (req: Request, res: Response, next) => {
  try { res.json(await getClient(req).execute(0, 'version')); } catch (err) { next(err); }
});
