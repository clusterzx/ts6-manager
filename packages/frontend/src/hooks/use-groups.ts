import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { groupsApi } from '../api/groups.api';
import { useServerStore } from '../stores/server.store';

export function useServerGroups() {
  const { selectedConfigId: c, selectedSid: s } = useServerStore();
  return useQuery({
    queryKey: ['server-groups', c, s],
    queryFn: () => groupsApi.serverGroups(c!, s!),
    enabled: !!c && !!s,
  });
}

export function useChannelGroups() {
  const { selectedConfigId: c, selectedSid: s } = useServerStore();
  return useQuery({
    queryKey: ['channel-groups', c, s],
    queryFn: () => groupsApi.channelGroups(c!, s!),
    enabled: !!c && !!s,
  });
}

export function useServerGroupMembers(sgid: number | null) {
  const { selectedConfigId: c, selectedSid: s } = useServerStore();
  return useQuery({
    queryKey: ['server-group-members', c, s, sgid],
    queryFn: () => groupsApi.serverGroupMembers(c!, s!, sgid!),
    enabled: !!c && !!s && !!sgid,
  });
}

export function useCreateServerGroup() {
  const qc = useQueryClient();
  const { selectedConfigId: c, selectedSid: s } = useServerStore();
  return useMutation({
    mutationFn: (name: string) => groupsApi.createServerGroup(c!, s!, name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['server-groups'] }),
  });
}

export function useDeleteServerGroup() {
  const qc = useQueryClient();
  const { selectedConfigId: c, selectedSid: s } = useServerStore();
  return useMutation({
    mutationFn: (sgid: number) => groupsApi.deleteServerGroup(c!, s!, sgid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['server-groups'] }),
  });
}
