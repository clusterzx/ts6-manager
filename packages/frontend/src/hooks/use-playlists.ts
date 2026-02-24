import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { playlistsApi } from '../api/music.api';

export function usePlaylists(musicBotId?: number) {
  return useQuery({
    queryKey: ['playlists', musicBotId],
    queryFn: () => playlistsApi.list(musicBotId),
  });
}

export function usePlaylist(id: number | null) {
  return useQuery({
    queryKey: ['playlist', id],
    queryFn: () => playlistsApi.get(id!),
    enabled: !!id,
  });
}

export function useCreatePlaylist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; musicBotId?: number }) => playlistsApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['playlists'] }),
  });
}

export function useUpdatePlaylist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => playlistsApi.update(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['playlists'] });
      qc.invalidateQueries({ queryKey: ['playlist', id] });
    },
  });
}

export function useDeletePlaylist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => playlistsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['playlists'] }),
  });
}

export function useAddSongToPlaylist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ playlistId, songId }: { playlistId: number; songId: number }) =>
      playlistsApi.addSong(playlistId, songId),
    onSuccess: (_, { playlistId }) => qc.invalidateQueries({ queryKey: ['playlist', playlistId] }),
  });
}

export function useRemoveSongFromPlaylist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ playlistId, songId }: { playlistId: number; songId: number }) =>
      playlistsApi.removeSong(playlistId, songId),
    onSuccess: (_, { playlistId }) => qc.invalidateQueries({ queryKey: ['playlist', playlistId] }),
  });
}

export function useReorderPlaylistSongs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ playlistId, songIds }: { playlistId: number; songIds: number[] }) =>
      playlistsApi.reorder(playlistId, songIds),
    onSuccess: (_, { playlistId }) => qc.invalidateQueries({ queryKey: ['playlist', playlistId] }),
  });
}
