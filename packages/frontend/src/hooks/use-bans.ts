import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bansApi } from '../api/bans.api';
import { useServerStore } from '../stores/server.store';

export function useBans() {
  const { selectedConfigId: c, selectedSid: s } = useServerStore();
  return useQuery({
    queryKey: ['bans', c, s],
    queryFn: () => bansApi.list(c!, s!),
    enabled: !!c && !!s,
  });
}

export function useAddBan() {
  const qc = useQueryClient();
  const { selectedConfigId: c, selectedSid: s } = useServerStore();
  return useMutation({
    mutationFn: (data: any) => bansApi.add(c!, s!, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bans'] }),
  });
}

export function useDeleteBan() {
  const qc = useQueryClient();
  const { selectedConfigId: c, selectedSid: s } = useServerStore();
  return useMutation({
    mutationFn: (banid: number) => bansApi.delete(c!, s!, banid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bans'] }),
  });
}
