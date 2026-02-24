// TeamSpeak WebQuery API response wrapper
export interface TSResponse<T = Record<string, any>[]> {
  body: T;
  status: {
    code: number;
    message: string;
  };
}

// Virtual Server
export interface VirtualServer {
  virtualserver_id: number;
  virtualserver_port: number;
  virtualserver_status: 'online' | 'offline';
  virtualserver_name: string;
  virtualserver_clientsonline: number;
  virtualserver_queryclientsonline: number;
  virtualserver_maxclients: number;
  virtualserver_uptime: number;
  virtualserver_autostart: number;
  virtualserver_unique_identifier?: string;
}

export interface VirtualServerInfo extends VirtualServer {
  virtualserver_welcomemessage: string;
  virtualserver_platform: string;
  virtualserver_version: string;
  virtualserver_password: string;
  virtualserver_hostbanner_url: string;
  virtualserver_hostbanner_gfx_url: string;
  virtualserver_hostbanner_gfx_interval: number;
  virtualserver_hostbanner_mode: number;
  virtualserver_hostbutton_tooltip: string;
  virtualserver_hostbutton_url: string;
  virtualserver_hostbutton_gfx_url: string;
  virtualserver_hostmessage: string;
  virtualserver_hostmessage_mode: number;
  virtualserver_default_server_group: number;
  virtualserver_default_channel_group: number;
  virtualserver_default_channel_admin_group: number;
  virtualserver_codec_encryption_mode: number;
  virtualserver_antiflood_points_tick_reduce: number;
  virtualserver_antiflood_points_needed_command_block: number;
  virtualserver_antiflood_points_needed_ip_block: number;
  virtualserver_log_client: number;
  virtualserver_log_query: number;
  virtualserver_log_channel: number;
  virtualserver_log_permissions: number;
  virtualserver_log_server: number;
  virtualserver_log_filetransfer: number;
  virtualserver_icon_id: number;
  virtualserver_reserved_slots: number;
  virtualserver_total_packetloss_speech: number;
  virtualserver_total_packetloss_keepalive: number;
  virtualserver_total_packetloss_control: number;
  virtualserver_total_packetloss_total: number;
  virtualserver_total_ping: number;
  virtualserver_created: number;
  virtualserver_channel_temp_delete_delay_default: number;
  virtualserver_min_client_version: number;
}

// Channel
export interface Channel {
  cid: number;
  pid: number;
  channel_order: number;
  channel_name: string;
  channel_topic: string;
  total_clients: number;
  channel_needed_subscribe_power: number;
  channel_flag_default: number;
  channel_flag_password: number;
  channel_flag_permanent: number;
  channel_flag_semi_permanent: number;
  channel_codec: number;
  channel_codec_quality: number;
  channel_icon_id: number;
  channel_maxclients: number;
  channel_maxfamilyclients: number;
  seconds_empty: number;
}

export interface ChannelInfo extends Channel {
  channel_description: string;
  channel_password: string;
  channel_codec_latency_factor: number;
  channel_flag_temporary: number;
  channel_flag_maxclients_unlimited: number;
  channel_flag_maxfamilyclients_unlimited: number;
  channel_flag_maxfamilyclients_inherited: number;
  channel_needed_talk_power: number;
  channel_forced_silence: number;
  channel_filepath: string;
  channel_security_salt: string;
  channel_delete_delay: number;
  channel_unique_identifier: string;
}

// Channel tree node (frontend representation)
export interface ChannelTreeNode extends Channel {
  children: ChannelTreeNode[];
  clients?: Client[];
}

// Client (online)
export interface Client {
  clid: number;
  cid: number;
  client_database_id: number;
  client_nickname: string;
  client_type: number; // 0=normal, 1=serverquery
  client_unique_identifier: string;
  client_away: number;
  client_away_message: string;
  client_flag_talking: number;
  client_input_muted: number;
  client_output_muted: number;
  client_input_hardware: number;
  client_output_hardware: number;
  client_talk_power: number;
  client_is_talker: number;
  client_is_priority_speaker: number;
  client_is_recording: number;
  client_is_channel_commander: number;
  client_servergroups: string;
  client_channel_group_id: number;
  client_channel_group_inherited_channel_id: number;
  client_country: string;
  client_idle_time: number;
  client_created: number;
  client_lastconnected: number;
  connection_client_ip?: string;
}

export interface ClientInfo extends Client {
  client_version: string;
  client_platform: string;
  client_login_name: string;
  client_totalconnections: number;
  client_description: string;
  client_month_bytes_uploaded: number;
  client_month_bytes_downloaded: number;
  client_total_bytes_uploaded: number;
  client_total_bytes_downloaded: number;
  connection_connected_time: number;
  connection_bandwidth_sent_last_second_total: number;
  connection_bandwidth_received_last_second_total: number;
}

// Client Database Entry
export interface ClientDBEntry {
  cldbid: number;
  client_unique_identifier: string;
  client_nickname: string;
  client_created: number;
  client_lastconnected: number;
  client_totalconnections: number;
  client_description: string;
  client_lastip: string;
}

// Server Group
export interface ServerGroup {
  sgid: number;
  name: string;
  type: number;
  iconid: number;
  savedb: number;
  sortid: number;
  namemode: number;
  n_modifyp: number;
  n_member_addp: number;
  n_member_removep: number;
}

// Channel Group
export interface ChannelGroup {
  cgid: number;
  name: string;
  type: number;
  iconid: number;
  savedb: number;
  sortid: number;
  namemode: number;
  n_modifyp: number;
  n_member_addp: number;
  n_member_removep: number;
}

// Permission
export interface Permission {
  permid: number;
  permsid: string;
  permname: string;
  permdesc: string;
}

export interface PermissionAssignment {
  permid: number;
  permsid?: string;
  permvalue: number;
  permnegated: number;
  permskip: number;
}

// Ban
export interface Ban {
  banid: number;
  ip: string;
  name: string;
  uid: string;
  mytsid: string;
  lastnickname: string;
  created: number;
  duration: number;
  invokername: string;
  invokercldbid: number;
  invokeruid: string;
  reason: string;
  enforcements: number;
}

// Privilege Key / Token
export interface PrivilegeKey {
  token: string;
  token_type: number; // 0=server group, 1=channel group
  token_id1: number;
  token_id2: number;
  token_created: number;
  token_description: string;
  token_customset: string;
}

// Complaint
export interface Complaint {
  tcldbid: number;
  tname: string;
  fcldbid: number;
  fname: string;
  message: string;
  timestamp: number;
}

// Offline Message
export interface OfflineMessage {
  msgid: number;
  cluid: string;
  subject: string;
  message?: string;
  timestamp: number;
  flag_read: number;
}

// Log Entry
export interface LogEntry {
  last_pos: number;
  file_size: number;
  l: string; // log line string
}

// Server Connection Info
export interface ConnectionInfo {
  connection_filetransfer_bandwidth_sent: number;
  connection_filetransfer_bandwidth_received: number;
  connection_filetransfer_bytes_sent_total: number;
  connection_filetransfer_bytes_received_total: number;
  connection_packets_sent_total: number;
  connection_bytes_sent_total: number;
  connection_packets_received_total: number;
  connection_bytes_received_total: number;
  connection_bandwidth_sent_last_second_total: number;
  connection_bandwidth_sent_last_minute_total: number;
  connection_bandwidth_received_last_second_total: number;
  connection_bandwidth_received_last_minute_total: number;
  connection_connected_time: number;
  connection_packetloss_total: number;
  connection_ping: number;
}

// Host Info
export interface HostInfo {
  instance_uptime: number;
  host_timestamp_utc: number;
  virtualservers_running_total: number;
  virtualservers_total_maxclients: number;
  virtualservers_total_clients_online: number;
  virtualservers_total_channels_online: number;
  connection_filetransfer_bandwidth_sent: number;
  connection_filetransfer_bandwidth_received: number;
  connection_packets_sent_total: number;
  connection_bytes_sent_total: number;
  connection_packets_received_total: number;
  connection_bytes_received_total: number;
  connection_bandwidth_sent_last_second_total: number;
  connection_bandwidth_sent_last_minute_total: number;
  connection_bandwidth_received_last_second_total: number;
  connection_bandwidth_received_last_minute_total: number;
}

// Instance Info
export interface InstanceInfo {
  serverinstance_database_version: number;
  serverinstance_filetransfer_port: number;
  serverinstance_max_download_total_bandwidth: number;
  serverinstance_max_upload_total_bandwidth: number;
  serverinstance_guest_serverquery_group: number;
  serverinstance_serverquery_flood_commands: number;
  serverinstance_serverquery_flood_time: number;
  serverinstance_serverquery_ban_time: number;
  serverinstance_template_serveradmin_group: number;
  serverinstance_template_serverdefault_group: number;
  serverinstance_template_channeladmin_group: number;
  serverinstance_template_channeldefault_group: number;
  serverinstance_permissions_version: number;
}

// Version
export interface ServerVersion {
  version: string;
  build: number;
  platform: string;
}

// File Transfer
export interface FileEntry {
  cid: number;
  path: string;
  name: string;
  size: number;
  datetime: number;
  type: number; // 0=file, 1=directory
}

// Temporary Password
export interface TempPassword {
  nickname: string;
  uid: string;
  desc: string;
  pw_clear: string;
  start: number;
  end: number;
  tcid: number;
}

// Codecs
export enum Codec {
  SPEEX_NARROWBAND = 0,
  SPEEX_WIDEBAND = 1,
  SPEEX_ULTRAWIDEBAND = 2,
  CELT_MONO = 3,
  OPUS_VOICE = 4,
  OPUS_MUSIC = 5,
}

export const CodecNames: Record<number, string> = {
  0: 'Speex Narrowband',
  1: 'Speex Wideband',
  2: 'Speex Ultra-Wideband',
  3: 'CELT Mono',
  4: 'Opus Voice',
  5: 'Opus Music',
};
