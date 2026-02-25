// === Music / Voice Bot Types ===

export type VoiceBotStatus = 'stopped' | 'starting' | 'connected' | 'playing' | 'paused' | 'error';

export interface MusicBotSummary {
  id: number;
  name: string;
  serverConfigId: number;
  serverConfig?: { id: number; name: string; host: string };
  nickname: string;
  serverPassword: string | null;
  defaultChannel: string | null;
  channelPassword: string | null;
  volume: number;
  autoStart: boolean;
  status: VoiceBotStatus;
  nowPlaying: QueueItemInfo | null;
  createdAt: string;
}

export interface MusicBotDetail extends MusicBotSummary {
  updatedAt: string;
  playbackProgress: { position: number; duration: number } | null;
}

export interface CreateMusicBotRequest {
  name: string;
  serverConfigId: number;
  nickname?: string;
  serverPassword?: string;
  defaultChannel?: string;
  channelPassword?: string;
  volume?: number;
  autoStart?: boolean;
}

export interface UpdateMusicBotRequest {
  name?: string;
  nickname?: string;
  serverPassword?: string;
  defaultChannel?: string;
  channelPassword?: string;
  volume?: number;
  autoStart?: boolean;
}

// === Song Types ===

export interface SongInfo {
  id: number;
  title: string;
  artist: string | null;
  duration: number | null;
  filePath: string;
  source: 'local' | 'youtube' | 'url';
  sourceUrl: string | null;
  fileSize: number | null;
  serverConfigId: number;
  createdAt: string;
}

export interface QueueItemInfo {
  id: string;
  title: string;
  artist?: string;
  duration?: number;
  source: string;
  streamUrl?: string;
}

export type RepeatMode = 'off' | 'track' | 'queue';

export interface PlaybackState {
  status: VoiceBotStatus;
  nowPlaying: QueueItemInfo | null;
  position: number;
  duration: number;
  volume: number;
  queue: QueueItemInfo[];
  currentIndex: number;
  shuffle: boolean;
  repeat: RepeatMode;
  isStreaming?: boolean;
}

// === Playlist Types ===

export interface PlaylistSummary {
  id: number;
  name: string;
  musicBotId: number | null;
  songCount: number;
  createdAt: string;
}

export interface PlaylistDetail extends PlaylistSummary {
  songs: (SongInfo & { position: number })[];
}

// === YouTube Types ===

export interface YouTubeSearchResult {
  id: string;
  title: string;
  artist: string;
  duration: number;
  thumbnail: string;
}

// === Radio Station Types ===

export interface RadioStationInfo {
  id: number;
  name: string;
  url: string;
  genre: string | null;
  imageUrl: string | null;
  serverConfigId: number;
}

export interface RadioPreset {
  name: string;
  url: string;
  genre: string;
}

export interface YouTubeUrlInfo {
  type: 'video' | 'playlist';
  items: YouTubeSearchResult[];
}
