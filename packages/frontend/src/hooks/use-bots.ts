import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { botsApi } from '../api/bots.api';

export function useBots() {
  return useQuery({
    queryKey: ['bots'],
    queryFn: botsApi.list,
  });
}

export function useBot(id: number | null) {
  return useQuery({
    queryKey: ['bot', id],
    queryFn: () => botsApi.get(id!),
    enabled: !!id,
  });
}

export function useCreateBot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => botsApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bots'] }),
  });
}

export function useUpdateBot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => botsApi.update(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['bots'] });
      qc.invalidateQueries({ queryKey: ['bot', id] });
    },
  });
}

export function useToggleBot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      enabled ? botsApi.enable(id) : botsApi.disable(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bots'] }),
  });
}
