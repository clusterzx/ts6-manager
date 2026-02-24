import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { channelsApi } from '../api/channels.api';
import { useServerStore } from '../stores/server.store';

export function useChannels() {
  const { selectedConfigId: c, selectedSid: s } = useServerStore();
  return useQuery({
    queryKey: ['channels', c, s],
    queryFn: () => channelsApi.list(c!, s!),
    enabled: !!c && !!s,
    refetchInterval: 15000,
  });
}

export function useCreateChannel() {
  const qc = useQueryClient();
  const { selectedConfigId: c, selectedSid: s } = useServerStore();
  return useMutation({
    mutationFn: (data: any) => channelsApi.create(c!, s!, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['channels'] }),
  });
}

export function useDeleteChannel() {
  const qc = useQueryClient();
  const { selectedConfigId: c, selectedSid: s } = useServerStore();
  return useMutation({
    mutationFn: (cid: number) => channelsApi.delete(c!, s!, cid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['channels'] }),
  });
}

export function useEditChannel() {
  const qc = useQueryClient();
  const { selectedConfigId: c, selectedSid: s } = useServerStore();
  return useMutation({
    mutationFn: ({ cid, data }: { cid: number; data: any }) => channelsApi.edit(c!, s!, cid, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['channels'] }),
  });
}

export function useMoveChannel() {
  const qc = useQueryClient();
  const { selectedConfigId: c, selectedSid: s } = useServerStore();
  return useMutation({
    mutationFn: ({ cid, data }: { cid: number; data: any }) => channelsApi.move(c!, s!, cid, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['channels'] }),
  });
}
