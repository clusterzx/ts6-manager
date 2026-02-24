import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { radioStationsApi, musicBotsApi } from '../api/music.api';

export function useRadioStations(configId: number | null) {
  return useQuery({
    queryKey: ['radio-stations', configId],
    queryFn: () => radioStationsApi.list(configId!),
    enabled: !!configId,
  });
}

export function useRadioPresets(configId: number | null) {
  return useQuery({
    queryKey: ['radio-presets', configId],
    queryFn: () => radioStationsApi.presets(configId!),
    enabled: !!configId,
  });
}

export function useCreateRadioStation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ configId, data }: { configId: number; data: { name: string; url: string; genre?: string } }) =>
      radioStationsApi.create(configId, data),
    onSuccess: (_, { configId }) => qc.invalidateQueries({ queryKey: ['radio-stations', configId] }),
  });
}

export function useDeleteRadioStation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ configId, id }: { configId: number; id: number }) =>
      radioStationsApi.delete(configId, id),
    onSuccess: (_, { configId }) => qc.invalidateQueries({ queryKey: ['radio-stations', configId] }),
  });
}

export function usePlayRadio() {
  return useMutation({
    mutationFn: ({ botId, stationId }: { botId: number; stationId: number }) =>
      musicBotsApi.playRadio(botId, stationId),
  });
}
