import axios, { AxiosInstance } from 'axios';
import http from 'http';
import https from 'https';
import { TSApiError } from '../middleware/error-handler.js';

export class WebQueryClient {
  private http: AxiosInstance;
  private agent: http.Agent | https.Agent;

  constructor(
    host: string,
    port: number,
    apiKey: string,
    useHttps: boolean = false,
  ) {
    const protocol = useHttps ? 'https' : 'http';

    // Use a single persistent TCP connection (keep-alive) to the TS WebQuery API.
    // Without this, each concurrent request opens a new TCP connection, and the
    // TS server registers each one as a separate "serveradmin" query client
    // (serveradmin, serveradmin1, serveradmin2, ...).
    this.agent = useHttps
      ? new https.Agent({ keepAlive: true, maxSockets: 1 })
      : new http.Agent({ keepAlive: true, maxSockets: 1 });

    this.http = axios.create({
      baseURL: `${protocol}://${host}:${port}`,
      headers: { 'x-api-key': apiKey },
      timeout: 15000,
      httpAgent: useHttps ? undefined : this.agent,
      httpsAgent: useHttps ? this.agent : undefined,
    });
  }

  async execute(sid: number, command: string, params?: Record<string, any>): Promise<any> {
    try {
      // WebQuery URL pattern: /{sid}/{command}
      // For instance-level commands (sid=0): /{command}
      const path = sid > 0 ? `/${sid}/${command}` : `/${command}`;

      const response = await this.http.get(path, {
        params: this.cleanParams(params),
      });

      const data = response.data;

      if (data.status && data.status.code !== 0) {
        throw new TSApiError(data.status.code, data.status.message);
      }

      return data.body || data;
    } catch (error: any) {
      if (error instanceof TSApiError) throw error;
      if (error.response?.data?.status) {
        throw new TSApiError(
          error.response.data.status.code,
          error.response.data.status.message,
        );
      }
      throw new TSApiError(-1, error.message || 'Connection failed');
    }
  }

  async executePost(sid: number, command: string, params?: Record<string, any>): Promise<any> {
    try {
      const path = sid > 0 ? `/${sid}/${command}` : `/${command}`;
      const response = await this.http.post(path, null, {
        params: this.cleanParams(params),
      });

      const data = response.data;
      if (data.status && data.status.code !== 0) {
        throw new TSApiError(data.status.code, data.status.message);
      }

      return data.body || data;
    } catch (error: any) {
      if (error instanceof TSApiError) throw error;
      if (error.response?.data?.status) {
        throw new TSApiError(
          error.response.data.status.code,
          error.response.data.status.message,
        );
      }
      throw new TSApiError(-1, error.message || 'Connection failed');
    }
  }

  // Remove undefined/null values from params
  private cleanParams(params?: Record<string, any>): Record<string, any> | undefined {
    if (!params) return undefined;
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        cleaned[key] = value;
      }
    }
    return Object.keys(cleaned).length > 0 ? cleaned : undefined;
  }

  // Test connection
  async testConnection(): Promise<boolean> {
    try {
      await this.execute(0, 'version');
      return true;
    } catch {
      return false;
    }
  }

  // Destroy the HTTP agent, closing all keep-alive sockets.
  // Call this for temporary clients (e.g. test connection) to avoid lingering query logins.
  destroy(): void {
    this.agent.destroy();
  }
}
