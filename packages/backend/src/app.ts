import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config.js';
import { errorHandler } from './middleware/error-handler.js';
import { authMiddleware } from './middleware/auth.js';
import { authRoutes } from './routes/auth.routes.js';
import { serverRoutes } from './routes/servers.routes.js';
import { virtualServerRoutes } from './routes/virtual-servers.routes.js';
import { channelRoutes } from './routes/channels.routes.js';
import { clientRoutes } from './routes/clients.routes.js';
import { serverGroupRoutes } from './routes/server-groups.routes.js';
import { channelGroupRoutes } from './routes/channel-groups.routes.js';
import { permissionRoutes } from './routes/permissions.routes.js';
import { banRoutes } from './routes/bans.routes.js';
import { tokenRoutes } from './routes/tokens.routes.js';
import { fileRoutes } from './routes/files.routes.js';
import { complaintRoutes } from './routes/complaints.routes.js';
import { messageRoutes } from './routes/messages.routes.js';
import { logRoutes } from './routes/logs.routes.js';
import { instanceRoutes } from './routes/instance.routes.js';
import { dashboardRoutes } from './routes/dashboard.routes.js';
import { botRoutes } from './routes/bots.routes.js';
import { userRoutes } from './routes/users.routes.js';
import { musicBotRoutes } from './routes/music-bots.routes.js';
import { musicLibraryRoutes } from './routes/music-library.routes.js';
import { playlistRoutes } from './routes/playlists.routes.js';
import { radioStationRoutes } from './routes/radio-stations.routes.js';

export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: config.frontendUrl, credentials: true }));
  app.use(express.json({ limit: '10mb' }));

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Public routes
  app.use('/api/auth', authRoutes);

  // Bot webhook route (unauthenticated — called by external systems)
  app.all('/api/bots/webhook/:path(*)', (req, res) => {
    const engine = req.app.locals.botEngine;
    if (!engine) return res.status(503).json({ error: 'Bot engine not running' });
    engine.handleWebhookRequest(req, res);
  });

  // Protected routes
  app.use('/api', authMiddleware);
  app.use('/api/servers', serverRoutes);
  app.use('/api/servers/:configId/virtual-servers', virtualServerRoutes);
  app.use('/api/servers/:configId/vs/:sid/channels', channelRoutes);
  app.use('/api/servers/:configId/vs/:sid/clients', clientRoutes);
  app.use('/api/servers/:configId/vs/:sid/server-groups', serverGroupRoutes);
  app.use('/api/servers/:configId/vs/:sid/channel-groups', channelGroupRoutes);
  app.use('/api/servers/:configId/vs/:sid/permissions', permissionRoutes);
  app.use('/api/servers/:configId/vs/:sid/bans', banRoutes);
  app.use('/api/servers/:configId/vs/:sid/tokens', tokenRoutes);
  app.use('/api/servers/:configId/vs/:sid/files', fileRoutes);
  app.use('/api/servers/:configId/vs/:sid/complaints', complaintRoutes);
  app.use('/api/servers/:configId/vs/:sid/messages', messageRoutes);
  app.use('/api/servers/:configId/vs/:sid/logs', logRoutes);
  app.use('/api/servers/:configId/instance', instanceRoutes);
  app.use('/api/servers/:configId/vs/:sid/dashboard', dashboardRoutes);
  app.use('/api/bots', botRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/music-bots', musicBotRoutes);
  app.use('/api/servers/:configId/music-library', musicLibraryRoutes);
  app.use('/api/playlists', playlistRoutes);
  app.use('/api/servers/:configId/radio-stations', radioStationRoutes);

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}
