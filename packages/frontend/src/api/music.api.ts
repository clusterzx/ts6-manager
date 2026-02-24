import api from './client';

// === Music Bot API ===

export const musicBotsApi = {
  list: () => api.get('/music-bots').then((r) => r.data),
  get: (id: number) => api.get(`/music-bots/${id}`).then((r) => r.data),
  create: (data: any) => api.post('/music-bots', data).then((r) => r.data),
  update: (id: number, data: any) => api.put(`/music-bots/${id}`, data).then((r) => r.data),
  delete: (id: number) => api.delete(`/music-bots/${id}`),
  start: (id: number) => api.post(`/music-bots/${id}/start`).then((r) => r.data),
  stop: (id: number) => api.post(`/music-bots/${id}/stop`).then((r) => r.data),
  restart: (id: number) => api.post(`/music-bots/${id}/restart`).then((r) => r.data),

  // Playback
  playRadio: (id: number, stationId: number) => api.post(`/music-bots/${id}/play-radio`, { stationId }).then((r) => r.data),
  play: (id: number, songId: number) => api.post(`/music-bots/${id}/play`, { songId }).then((r) => r.data),
  pause: (id: number) => api.post(`/music-bots/${id}/pause`).then((r) => r.data),
  resume: (id: number) => api.post(`/music-bots/${id}/resume`).then((r) => r.data),
  stopPlayback: (id: number) => api.post(`/music-bots/${id}/stop-playback`).then((r) => r.data),
  skip: (id: number) => api.post(`/music-bots/${id}/skip`).then((r) => r.data),
  previous: (id: number) => api.post(`/music-bots/${id}/previous`).then((r) => r.data),
  seek: (id: number, seconds: number) => api.post(`/music-bots/${id}/seek`, { seconds }).then((r) => r.data),
  volume: (id: number, volume: number) => api.post(`/music-bots/${id}/volume`, { volume }).then((r) => r.data),
  state: (id: number) => api.get(`/music-bots/${id}/state`).then((r) => r.data),

  // Queue
  queue: (id: number) => api.get(`/music-bots/${id}/queue`).then((r) => r.data),
  enqueue: (id: number, songId: number) => api.post(`/music-bots/${id}/queue`, { songId }).then((r) => r.data),
  loadPlaylist: (id: number, playlistId: number, clearFirst?: boolean) =>
    api.post(`/music-bots/${id}/queue/playlist`, { playlistId, clearFirst }).then((r) => r.data),
  removeFromQueue: (id: number, index: number) => api.delete(`/music-bots/${id}/queue/${index}`).then((r) => r.data),
  clearQueue: (id: number) => api.delete(`/music-bots/${id}/queue`).then((r) => r.data),
  shuffle: (id: number, enabled: boolean) => api.post(`/music-bots/${id}/queue/shuffle`, { enabled }).then((r) => r.data),
  repeat: (id: number, mode: string) => api.post(`/music-bots/${id}/queue/repeat`, { mode }).then((r) => r.data),
};

// === Music Library API ===

export const musicLibraryApi = {
  songs: (configId: number) => api.get(`/servers/${configId}/music-library/songs`).then((r) => r.data),
  upload: (configId: number, formData: FormData) =>
    api.post(`/servers/${configId}/music-library/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 300000, // 5 min for large uploads
    }).then((r) => r.data),
  deleteSong: (configId: number, songId: number) =>
    api.delete(`/servers/${configId}/music-library/songs/${songId}`).then((r) => r.data),
  youtubeSearch: (configId: number, query: string) =>
    api.post(`/servers/${configId}/music-library/youtube/search`, { query }).then((r) => r.data),
  youtubeDownload: (configId: number, url: string) =>
    api.post(`/servers/${configId}/music-library/youtube/download`, { url }).then((r) => r.data),
  youtubeInfo: (configId: number, url: string) =>
    api.post(`/servers/${configId}/music-library/youtube/info`, { url }).then((r) => r.data),
  youtubeDownloadBatch: (configId: number, urls: string[]) =>
    api.post(`/servers/${configId}/music-library/youtube/download-batch`, { urls }, { timeout: 600000 }).then((r) => r.data),
};

// === Radio Station API ===

export const radioStationsApi = {
  list: (configId: number) => api.get(`/servers/${configId}/radio-stations`).then((r) => r.data),
  presets: (configId: number) => api.get(`/servers/${configId}/radio-stations/presets`).then((r) => r.data),
  create: (configId: number, data: { name: string; url: string; genre?: string }) =>
    api.post(`/servers/${configId}/radio-stations`, data).then((r) => r.data),
  delete: (configId: number, id: number) =>
    api.delete(`/servers/${configId}/radio-stations/${id}`).then((r) => r.data),
};

// === Playlist API ===

export const playlistsApi = {
  list: (musicBotId?: number) =>
    api.get('/playlists', { params: musicBotId ? { musicBotId } : undefined }).then((r) => r.data),
  get: (id: number) => api.get(`/playlists/${id}`).then((r) => r.data),
  create: (data: { name: string; musicBotId?: number }) => api.post('/playlists', data).then((r) => r.data),
  update: (id: number, data: any) => api.put(`/playlists/${id}`, data).then((r) => r.data),
  delete: (id: number) => api.delete(`/playlists/${id}`),
  addSong: (id: number, songId: number) => api.post(`/playlists/${id}/songs`, { songId }).then((r) => r.data),
  removeSong: (id: number, songId: number) => api.delete(`/playlists/${id}/songs/${songId}`).then((r) => r.data),
  reorder: (id: number, songIds: number[]) => api.put(`/playlists/${id}/songs/reorder`, { songIds }).then((r) => r.data),
};
