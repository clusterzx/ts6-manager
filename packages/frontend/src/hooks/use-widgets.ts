import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { widgetApi } from '@/api/widget.api';
import type { CreateWidgetRequest, UpdateWidgetRequest } from '@ts6/common';

export function useWidgets() {
  return useQuery({
    queryKey: ['widgets'],
    queryFn: widgetApi.list,
  });
}

export function useCreateWidget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateWidgetRequest) => widgetApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['widgets'] }),
  });
}

export function useUpdateWidget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateWidgetRequest }) => widgetApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['widgets'] }),
  });
}

export function useDeleteWidget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => widgetApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['widgets'] }),
  });
}

export function useRegenerateWidgetToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => widgetApi.regenerateToken(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['widgets'] }),
  });
}
