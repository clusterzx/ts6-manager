import { createApp } from './app.js';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { PrismaClient } from '../generated/prisma/index.js';
import { ConnectionPool } from './ts-client/connection-pool.js';
import { BotEngine } from './bot-engine/engine.js';
import { VoiceBotManager } from './voice/voice-bot-manager.js';
import { MusicCommandHandler } from './voice/music-command-handler.js';
import { config } from './config.js';

async function main() {
  const prisma = new PrismaClient();
  const app = createApp();
  const server = createServer(app);

  // WebSocket for real-time frontend updates
  const wss = new WebSocketServer({ server, path: '/ws' });

  // Initialize TS connection pool
  const connectionPool = new ConnectionPool(prisma);
  await connectionPool.initialize();

  // Make services available via app.locals
  app.locals.prisma = prisma;
  app.locals.connectionPool = connectionPool;
  app.locals.wss = wss;

  // Initialize Bot Engine
  const botEngine = new BotEngine(prisma, connectionPool, wss, app);
  app.locals.botEngine = botEngine;
  await botEngine.start();

  // Initialize Voice Bot Manager (Music Bots)
  const voiceBotManager = new VoiceBotManager(prisma, wss);
  app.locals.voiceBotManager = voiceBotManager;
  await voiceBotManager.start();

  // Wire VoiceBotManager into BotEngine for voice action nodes in flows
  botEngine.setVoiceBotManager(voiceBotManager);

  // Wire Music Command Handler for text-based music bot control (!radio, !play, etc.)
  // Listens directly on each VoiceBot's TS3 connection (no SSH needed)
  const musicCommandHandler = new MusicCommandHandler(prisma, voiceBotManager);
  voiceBotManager.setMusicCommandHandler(musicCommandHandler);

  server.listen(config.port, () => {
    console.log(`[TS6 WebUI] Backend running on http://localhost:${config.port}`);
    console.log(`[TS6 WebUI] WebSocket available at ws://localhost:${config.port}/ws`);
    console.log(`[TS6 WebUI] Environment: ${config.nodeEnv}`);
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\n[TS6 WebUI] Shutting down...');
    await voiceBotManager.stopAll();
    botEngine.destroy();
    connectionPool.destroy();
    wss.close();
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
