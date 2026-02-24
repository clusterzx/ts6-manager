import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { serversApi } from '../api/servers.api';
import { useServerStore } from '../stores/server.store';

export function useServers() {
  return useQuery({
    queryKey: ['servers'],
    queryFn: serversApi.list,
  });
}

export function useVirtualServers() {
  const { selectedConfigId } = useServerStore();
  return useQuery({
    queryKey: ['virtual-servers', selectedConfigId],
    queryFn: () => serversApi.listVirtual(selectedConfigId!),
    enabled: !!selectedConfigId,
  });
}

export function useVirtualServerInfo() {
  const { selectedConfigId, selectedSid } = useServerStore();
  return useQuery({
    queryKey: ['virtual-server-info', selectedConfigId, selectedSid],
    queryFn: () => serversApi.getVirtualInfo(selectedConfigId!, selectedSid!),
    enabled: !!selectedConfigId && !!selectedSid,
  });
}

export function useCreateServer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => serversApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['servers'] }),
  });
}

export function useTestConnection() {
  return useMutation({
    mutationFn: (id: number) => serversApi.test(id),
  });
}
