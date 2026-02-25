import { Router, Request, Response } from 'express';
import { requireRole } from '../middleware/rbac.js';
import { AppError } from '../middleware/error-handler.js';
import { WebQueryClient } from '../ts-client/webquery-client.js';
import type { ConnectionPool } from '../ts-client/connection-pool.js';
import { encrypt, decrypt } from '../utils/crypto.js';

export const serverRoutes: Router = Router();

// List all configured TS server connections
serverRoutes.get('/', async (req: Request, res: Response, next) => {
  try {
    const prisma = req.app.locals.prisma;
    const servers = await prisma.tsServerConfig.findMany({
      select: {
        id: true, name: true, host: true, webqueryPort: true,
        useHttps: true, sshPort: true, enabled: true,
        createdAt: true, sshUsername: true,
      },
      orderBy: { id: 'asc' },
    });

    res.json(servers.map((s: any) => ({
      ...s,
      hasSshCredentials: !!s.sshUsername,
      sshUsername: undefined,
    })));
  } catch (err) { next(err); }
});

// Add new TS server connection
serverRoutes.post('/', requireRole('admin'), async (req: Request, res: Response, next) => {
  try {
    const { name, host, webqueryPort, apiKey, useHttps, sshPort, sshUsername, sshPassword } = req.body;
    if (!name || !host || !apiKey) throw new AppError(400, 'Name, host, and API key are required');

    const prisma = req.app.locals.prisma;
    // H8: Encrypt sensitive fields at rest
    const server = await prisma.tsServerConfig.create({
      data: {
        name,
        host,
        webqueryPort: webqueryPort || 10080,
        apiKey: encrypt(apiKey),
        useHttps: useHttps || false,
        sshPort: sshPort || 10022,
        sshUsername: sshUsername || null,
        sshPassword: sshPassword ? encrypt(sshPassword) : null,
      },
    });

    // Add to connection pool (use plaintext key for connection)
    const pool: ConnectionPool = req.app.locals.connectionPool;
    pool.addClient(server.id, server.host, server.webqueryPort, apiKey, server.useHttps);

    res.status(201).json({ id: server.id, name: server.name });
  } catch (err) { next(err); }
});

// Get server connection details
serverRoutes.get('/:configId', async (req: Request, res: Response, next) => {
  try {
    const prisma = req.app.locals.prisma;
    const server = await prisma.tsServerConfig.findUnique({
      where: { id: parseInt(String(req.params.configId)) },
    });
    if (!server) throw new AppError(404, 'Server config not found');

    res.json({
      id: server.id, name: server.name, host: server.host,
      webqueryPort: server.webqueryPort, useHttps: server.useHttps,
      sshPort: server.sshPort, hasSshCredentials: !!server.sshUsername,
      enabled: server.enabled, createdAt: server.createdAt,
    });
  } catch (err) { next(err); }
});

// Update server connection
serverRoutes.put('/:configId', requireRole('admin'), async (req: Request, res: Response, next) => {
  try {
    const prisma = req.app.locals.prisma;
    const id = parseInt(String(req.params.configId));
    const data: any = {};

    const fields = ['name', 'host', 'webqueryPort', 'apiKey', 'useHttps', 'sshPort', 'sshUsername', 'sshPassword', 'enabled'];
    for (const field of fields) {
      if (req.body[field] !== undefined) {
        // Don't overwrite API key or SSH password with empty strings
        if ((field === 'apiKey' || field === 'sshPassword') && req.body[field] === '') continue;
        // H8: Encrypt sensitive fields
        if (field === 'apiKey' || field === 'sshPassword') {
          data[field] = encrypt(req.body[field]);
        } else {
          data[field] = req.body[field];
        }
      }
    }

    const server = await prisma.tsServerConfig.update({ where: { id }, data });

    // Refresh connection pool
    const pool: ConnectionPool = req.app.locals.connectionPool;
    await pool.refreshClient(id);

    res.json({ id: server.id, name: server.name });
  } catch (err) { next(err); }
});

// Delete server connection
serverRoutes.delete('/:configId', requireRole('admin'), async (req: Request, res: Response, next) => {
  try {
    const prisma = req.app.locals.prisma;
    const id = parseInt(String(req.params.configId));
    await prisma.tsServerConfig.delete({ where: { id } });

    const pool: ConnectionPool = req.app.locals.connectionPool;
    pool.removeClient(id);

    res.status(204).send();
  } catch (err) { next(err); }
});

// Test connection
serverRoutes.post('/:configId/test', requireRole('admin'), async (req: Request, res: Response, next) => {
  try {
    const prisma = req.app.locals.prisma;
    const server = await prisma.tsServerConfig.findUnique({
      where: { id: parseInt(String(req.params.configId)) },
    });
    if (!server) throw new AppError(404, 'Server config not found');

    const client = new WebQueryClient(server.host, server.webqueryPort, decrypt(server.apiKey), server.useHttps);
    const ok = await client.testConnection();
    client.destroy(); // Close the temporary TCP connection immediately

    res.json({ success: ok });
  } catch (err) { next(err); }
});
