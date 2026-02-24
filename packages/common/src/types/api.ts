// REST API Types between Frontend <-> Backend

// Auth
export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: UserInfo;
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

export interface UserInfo {
  id: number;
  username: string;
  displayName: string;
  role: 'admin' | 'moderator' | 'viewer';
}

// Server Connection Config
export interface ServerConfig {
  id: number;
  name: string;
  host: string;
  webqueryPort: number;
  useHttps: boolean;
  sshPort: number;
  hasSshCredentials: boolean;
  enabled: boolean;
  createdAt: string;
}

export interface CreateServerConfig {
  name: string;
  host: string;
  webqueryPort: number;
  apiKey: string;
  useHttps: boolean;
  sshPort: number;
  sshUsername?: string;
  sshPassword?: string;
}

export interface UpdateServerConfig {
  name?: string;
  host?: string;
  webqueryPort?: number;
  apiKey?: string;
  useHttps?: boolean;
  sshPort?: number;
  sshUsername?: string;
  sshPassword?: string;
  enabled?: boolean;
}

// Dashboard
export interface DashboardData {
  serverName: string;
  platform: string;
  version: string;
  onlineUsers: number;
  maxClients: number;
  uptime: number;
  channelCount: number;
  bandwidth: {
    incoming: number;
    outgoing: number;
  };
  packetloss: number;
  ping: number;
}

// Channel operations
export interface CreateChannelRequest {
  channel_name: string;
  channel_topic?: string;
  channel_description?: string;
  channel_password?: string;
  cpid?: number;
  channel_order?: number;
  channel_codec?: number;
  channel_codec_quality?: number;
  channel_maxclients?: number;
  channel_maxfamilyclients?: number;
  channel_flag_permanent?: number;
  channel_flag_semi_permanent?: number;
  channel_flag_temporary?: number;
  channel_flag_default?: number;
  channel_needed_talk_power?: number;
}

export interface MoveChannelRequest {
  cpid: number;
  order?: number;
}

// Client actions
export interface KickClientRequest {
  reasonid: 4 | 5; // 4=channel, 5=server
  reasonmsg?: string;
}

export interface BanClientRequest {
  time?: number; // seconds, 0=permanent
  banreason?: string;
}

export interface MoveClientRequest {
  cid: number;
  cpw?: string;
}

export interface PokeClientRequest {
  msg: string;
}

export interface MessageRequest {
  targetmode: 1 | 2 | 3; // 1=client, 2=channel, 3=server
  target?: number;
  msg: string;
}

// Ban
export interface CreateBanRequest {
  ip?: string;
  name?: string;
  uid?: string;
  time?: number;
  banreason?: string;
}

// Token
export interface CreateTokenRequest {
  tokentype: 0 | 1; // 0=server group, 1=channel group
  tokenid1: number; // group id
  tokenid2: number; // channel id (for channel group tokens)
  tokendescription?: string;
}

// Group operations
export interface CreateGroupRequest {
  name: string;
  type?: number;
}

export interface GroupMemberAction {
  cldbid: number;
}

// Permission operations
export interface SetPermissionRequest {
  permid?: number;
  permsid?: string;
  permvalue: number;
  permnegated?: number;
  permskip?: number;
}

// User management (webapp)
export interface CreateUserRequest {
  username: string;
  password: string;
  displayName: string;
  role: 'admin' | 'moderator' | 'viewer';
}

export interface UpdateUserRequest {
  displayName?: string;
  role?: 'admin' | 'moderator' | 'viewer';
  enabled?: boolean;
  password?: string;
}

// Generic API response wrapper
export interface ApiResponse<T> {
  data: T;
}

export interface ApiError {
  error: string;
  code?: number;
  details?: string;
}

// Paginated response
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  offset: number;
  limit: number;
}
