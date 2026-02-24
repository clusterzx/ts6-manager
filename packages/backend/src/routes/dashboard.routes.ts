import { Router, Request, Response } from 'express';
import type { ConnectionPool } from '../ts-client/connection-pool.js';

export const dashboardRoutes: Router = Router({ mergeParams: true });

const getClient = (req: Request) => {
  const pool: ConnectionPool = req.app.locals.connectionPool;
  return pool.getClient(parseInt(String(req.params.configId)));
};

dashboardRoutes.get('/', async (req: Request, res: Response, next) => {
  try {
    const sid = parseInt(String(req.params.sid));
    const client = getClient(req);

    const [serverInfo, clientList, channelList, connectionInfo] = await Promise.all([
      client.execute(sid, 'serverinfo'),
      client.execute(sid, 'clientlist'),
      client.execute(sid, 'channellist'),
      client.execute(sid, 'serverrequestconnectioninfo'),
    ]);

    const info = Array.isArray(serverInfo) ? serverInfo[0] : serverInfo;
    const connInfo = Array.isArray(connectionInfo) ? connectionInfo[0] : connectionInfo;
    const clients = Array.isArray(clientList) ? clientList : [];
    const channels = Array.isArray(channelList) ? channelList : [];

    const onlineClients = clients.filter((c: any) => String(c.client_type) === '0');

    res.json({
      serverName: info.virtualserver_name,
      platform: info.virtualserver_platform,
      version: info.virtualserver_version,
      onlineUsers: onlineClients.length,
      maxClients: Number(info.virtualserver_maxclients) || 0,
      uptime: Number(info.virtualserver_uptime) || 0,
      channelCount: channels.length,
      bandwidth: {
        incoming: Number(connInfo.connection_bandwidth_received_last_second_total) || 0,
        outgoing: Number(connInfo.connection_bandwidth_sent_last_second_total) || 0,
      },
      packetloss: Number(info.virtualserver_total_packetloss_total) || 0,
      ping: Number(info.virtualserver_total_ping) || 0,
    });
  } catch (err) { next(err); }
});
