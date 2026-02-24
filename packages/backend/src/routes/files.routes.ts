import { Router, Request, Response } from 'express';
import { requireRole } from '../middleware/rbac.js';
import { AppError, TSApiError } from '../middleware/error-handler.js';
import { parseQueryResponse, tsEscape } from '@ts6/common';
import type { BotEngine } from '../bot-engine/engine.js';

export const fileRoutes: Router = Router({ mergeParams: true });

const getConfigId = (req: Request) => parseInt(String(req.params.configId));
const getSid = (req: Request) => parseInt(String(req.params.sid));

/**
 * Execute a ServerQuery command via the shared SSH connection (EventBridge).
 * Reuses the same SSH session used for bot events — no extra server slots.
 */
async function sshExecute(
  req: Request,
  command: string,
  params: Record<string, string>,
): Promise<Record<string, string>[]> {
  const engine: BotEngine = req.app.locals.botEngine;
  if (!engine) throw new AppError(503, 'Bot engine not available');

  const bridge = engine.getEventBridge();
  const configId = getConfigId(req);
  const sid = getSid(req);

  // Build raw ServerQuery command string
  const paramStr = Object.entries(params)
    .map(([k, v]) => `${k}=${tsEscape(v)}`)
    .join(' ');
  const fullCommand = paramStr ? `${command} ${paramStr}` : command;

  let rawResponse: string;
  try {
    rawResponse = await bridge.executeCommand(configId, sid, fullCommand);
  } catch (err: any) {
    // Convert "TS error {code}: {msg}" to TSApiError
    const match = err.message?.match(/^TS error (\d+): (.+)$/);
    if (match) {
      throw new TSApiError(parseInt(match[1]), match[2]);
    }
    throw err;
  }

  if (!rawResponse.trim()) return [];
  return parseQueryResponse(rawResponse);
}

// List files in a channel directory
// Uses shared SSH connection because ft* commands are not supported via WebQuery HTTP
fileRoutes.get('/:cid', async (req: Request, res: Response, next) => {
  try {
    const result = await sshExecute(req, 'ftgetfilelist', {
      cid: String(req.params.cid),
      cpw: String(req.query.cpw || ''),
      path: String(req.query.path || '/'),
    });
    res.json(result);
  } catch (err: any) {
    // TS3 error 1281 = database_empty_result → empty directory
    if (err instanceof TSApiError && err.code === 1281) {
      return res.json([]);
    }
    if (err.message?.includes('SSH not connected') || err.message?.includes('SSH credentials')) {
      return next(new AppError(400, 'SSH credentials not configured for this server. File browsing requires SSH access because WebQuery HTTP does not support ft* commands.'));
    }
    next(err);
  }
});

// Create directory
fileRoutes.post('/:cid/mkdir', requireRole('admin'), async (req: Request, res: Response, next) => {
  try {
    const result = await sshExecute(req, 'ftcreatedir', {
      cid: String(req.params.cid),
      cpw: '',
      dirname: req.body.dirname,
    });
    res.json(result);
  } catch (err) { next(err); }
});

// Delete file
fileRoutes.delete('/:cid/file', requireRole('admin'), async (req: Request, res: Response, next) => {
  try {
    const result = await sshExecute(req, 'ftdeletefile', {
      cid: String(req.params.cid),
      cpw: '',
      name: req.body.name,
    });
    res.json(result);
  } catch (err) { next(err); }
});
