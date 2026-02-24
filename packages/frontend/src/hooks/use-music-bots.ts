import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { musicBotsApi } from '../api/music.api';

export function useMusicBots() {
  return useQuery({
    queryKey: ['music-bots'],
    queryFn: musicBotsApi.list,
  });
}

export function useMusicBot(id: number | null) {
  return useQuery({
    queryKey: ['music-bot', id],
    queryFn: () => musicBotsApi.get(id!),
    enabled: !!id,
  });
}

export function useCreateMusicBot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => musicBotsApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['music-bots'] }),
  });
}

export function useUpdateMusicBot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => musicBotsApi.update(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['music-bots'] });
      qc.invalidateQueries({ queryKey: ['music-bot', id] });
    },
  });
}

export function useDeleteMusicBot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => musicBotsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['music-bots'] }),
  });
}

export function useStartMusicBot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => musicBotsApi.start(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['music-bots'] }),
  });
}

export function useStopMusicBot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => musicBotsApi.stop(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['music-bots'] }),
  });
}

export function useRestartMusicBot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => musicBotsApi.restart(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['music-bots'] }),
  });
}

export function useMusicBotState(id: number | null) {
  return useQuery({
    queryKey: ['music-bot-state', id],
    queryFn: () => musicBotsApi.state(id!),
    enabled: !!id,
    refetchInterval: 2000,
  });
}

export function usePlaySong() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ botId, songId }: { botId: number; songId: number }) =>
      musicBotsApi.play(botId, songId),
    onSuccess: (_, { botId }) => qc.invalidateQueries({ queryKey: ['music-bot-state', botId] }),
  });
}

export function usePausePlayback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (botId: number) => musicBotsApi.pause(botId),
    onSuccess: (_, botId) => qc.invalidateQueries({ queryKey: ['music-bot-state', botId] }),
  });
}

export function useResumePlayback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (botId: number) => musicBotsApi.resume(botId),
    onSuccess: (_, botId) => qc.invalidateQueries({ queryKey: ['music-bot-state', botId] }),
  });
}

export function useStopPlayback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (botId: number) => musicBotsApi.stopPlayback(botId),
    onSuccess: (_, botId) => qc.invalidateQueries({ queryKey: ['music-bot-state', botId] }),
  });
}

export function useSkipTrack() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (botId: number) => musicBotsApi.skip(botId),
    onSuccess: (_, botId) => qc.invalidateQueries({ queryKey: ['music-bot-state', botId] }),
  });
}

export function usePreviousTrack() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (botId: number) => musicBotsApi.previous(botId),
    onSuccess: (_, botId) => qc.invalidateQueries({ queryKey: ['music-bot-state', botId] }),
  });
}

export function useSeek() {
  return useMutation({
    mutationFn: ({ botId, seconds }: { botId: number; seconds: number }) =>
      musicBotsApi.seek(botId, seconds),
  });
}

export function useSetVolume() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ botId, volume }: { botId: number; volume: number }) =>
      musicBotsApi.volume(botId, volume),
    onSuccess: (_, { botId }) => qc.invalidateQueries({ queryKey: ['music-bot-state', botId] }),
  });
}

export function useEnqueue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ botId, songId }: { botId: number; songId: number }) =>
      musicBotsApi.enqueue(botId, songId),
    onSuccess: (_, { botId }) => qc.invalidateQueries({ queryKey: ['music-bot-state', botId] }),
  });
}

export function useLoadPlaylist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ botId, playlistId, clearFirst }: { botId: number; playlistId: number; clearFirst?: boolean }) =>
      musicBotsApi.loadPlaylist(botId, playlistId, clearFirst),
    onSuccess: (_, { botId }) => qc.invalidateQueries({ queryKey: ['music-bot-state', botId] }),
  });
}

export function useRemoveFromQueue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ botId, index }: { botId: number; index: number }) =>
      musicBotsApi.removeFromQueue(botId, index),
    onSuccess: (_, { botId }) => qc.invalidateQueries({ queryKey: ['music-bot-state', botId] }),
  });
}

export function useClearQueue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (botId: number) => musicBotsApi.clearQueue(botId),
    onSuccess: (_, botId) => qc.invalidateQueries({ queryKey: ['music-bot-state', botId] }),
  });
}

export function useSetShuffle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ botId, enabled }: { botId: number; enabled: boolean }) =>
      musicBotsApi.shuffle(botId, enabled),
    onSuccess: (_, { botId }) => qc.invalidateQueries({ queryKey: ['music-bot-state', botId] }),
  });
}

export function useSetRepeat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ botId, mode }: { botId: number; mode: string }) =>
      musicBotsApi.repeat(botId, mode),
    onSuccess: (_, { botId }) => qc.invalidateQueries({ queryKey: ['music-bot-state', botId] }),
  });
}
