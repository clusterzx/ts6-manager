import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
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
import { widgetPublicRoutes } from './routes/widget-public.routes.js';
import { widgetRoutes } from './routes/widget.routes.js';
import { setupRoutes } from './routes/setup.routes.js';
import { requireServerAccess } from './middleware/server-access.js';

export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: config.frontendUrl, credentials: true }));
  app.use(express.json({ limit: '10mb' }));

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // H1: Rate limiting on auth endpoints
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many attempts, please try again later' },
  });
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/refresh', authLimiter);

  // Public routes
  app.use('/api/setup', setupRoutes);
  app.use('/api/auth', authRoutes);

  // Bot webhook route (unauthenticated — called by external systems)
  app.all('/api/bots/webhook/:path(*)', (req, res) => {
    const engine = req.app.locals.botEngine;
    if (!engine) return res.status(503).json({ error: 'Bot engine not running' });
    engine.handleWebhookRequest(req, res);
  });

  // Public widget routes (unauthenticated — embeddable on external sites)
  app.use('/api/widget', widgetPublicRoutes);

  // Protected routes
  app.use('/api', authMiddleware);
  app.use('/api/servers', serverRoutes);

  // H9: Server access control on all :configId routes
  const serverAccess = requireServerAccess();
  app.use('/api/servers/:configId/virtual-servers', serverAccess, virtualServerRoutes);
  app.use('/api/servers/:configId/vs/:sid/channels', serverAccess, channelRoutes);
  app.use('/api/servers/:configId/vs/:sid/clients', serverAccess, clientRoutes);
  app.use('/api/servers/:configId/vs/:sid/server-groups', serverAccess, serverGroupRoutes);
  app.use('/api/servers/:configId/vs/:sid/channel-groups', serverAccess, channelGroupRoutes);
  app.use('/api/servers/:configId/vs/:sid/permissions', serverAccess, permissionRoutes);
  app.use('/api/servers/:configId/vs/:sid/bans', serverAccess, banRoutes);
  app.use('/api/servers/:configId/vs/:sid/tokens', serverAccess, tokenRoutes);
  app.use('/api/servers/:configId/vs/:sid/files', serverAccess, fileRoutes);
  app.use('/api/servers/:configId/vs/:sid/complaints', serverAccess, complaintRoutes);
  app.use('/api/servers/:configId/vs/:sid/messages', serverAccess, messageRoutes);
  app.use('/api/servers/:configId/vs/:sid/logs', serverAccess, logRoutes);
  app.use('/api/servers/:configId/instance', serverAccess, instanceRoutes);
  app.use('/api/servers/:configId/vs/:sid/dashboard', serverAccess, dashboardRoutes);
  app.use('/api/bots', botRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/music-bots', musicBotRoutes);
  app.use('/api/servers/:configId/music-library', serverAccess, musicLibraryRoutes);
  app.use('/api/playlists', playlistRoutes);
  app.use('/api/servers/:configId/radio-stations', serverAccess, radioStationRoutes);
  app.use('/api/widgets', widgetRoutes);

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}
