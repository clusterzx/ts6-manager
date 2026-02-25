import { PrismaClient } from '../../generated/prisma/index.js';
import { WebQueryClient } from './webquery-client.js';
import { decrypt } from '../utils/crypto.js';

export class ConnectionPool {
  private clients: Map<number, WebQueryClient> = new Map();

  constructor(private prisma: PrismaClient) {}

  async initialize(): Promise<void> {
    const servers = await this.prisma.tsServerConfig.findMany({
      where: { enabled: true },
    });

    for (const server of servers) {
      // H8: Decrypt API key before use
      this.addClient(server.id, server.host, server.webqueryPort, decrypt(server.apiKey), server.useHttps);
    }

    console.log(`[ConnectionPool] Initialized ${this.clients.size} server connection(s)`);
  }

  addClient(id: number, host: string, port: number, apiKey: string, useHttps: boolean): void {
    const client = new WebQueryClient(host, port, apiKey, useHttps);
    this.clients.set(id, client);
  }

  removeClient(id: number): void {
    const client = this.clients.get(id);
    if (client) {
      client.destroy();
      this.clients.delete(id);
    }
  }

  getClient(configId: number): WebQueryClient {
    const client = this.clients.get(configId);
    if (!client) {
      throw new Error(`No connection configured for server config ID ${configId}`);
    }
    return client;
  }

  hasClient(configId: number): boolean {
    return this.clients.has(configId);
  }

  async refreshClient(configId: number): Promise<void> {
    const server = await this.prisma.tsServerConfig.findUnique({
      where: { id: configId },
    });
    if (server && server.enabled) {
      this.addClient(server.id, server.host, server.webqueryPort, decrypt(server.apiKey), server.useHttps);
    } else {
      this.removeClient(configId);
    }
  }

  destroy(): void {
    for (const client of this.clients.values()) {
      client.destroy();
    }
    this.clients.clear();
  }
}
