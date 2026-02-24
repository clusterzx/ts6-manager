import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { musicLibraryApi } from '../api/music.api';

export function useSongs(configId: number | null) {
  return useQuery({
    queryKey: ['songs', configId],
    queryFn: () => musicLibraryApi.songs(configId!),
    enabled: !!configId,
  });
}

export function useUploadSong() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ configId, formData }: { configId: number; formData: FormData }) =>
      musicLibraryApi.upload(configId, formData),
    onSuccess: (_, { configId }) => qc.invalidateQueries({ queryKey: ['songs', configId] }),
  });
}

export function useDeleteSong() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ configId, songId }: { configId: number; songId: number }) =>
      musicLibraryApi.deleteSong(configId, songId),
    onSuccess: (_, { configId }) => qc.invalidateQueries({ queryKey: ['songs', configId] }),
  });
}

export function useYouTubeSearch() {
  return useMutation({
    mutationFn: ({ configId, query }: { configId: number; query: string }) =>
      musicLibraryApi.youtubeSearch(configId, query),
  });
}

export function useYouTubeDownload() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ configId, url }: { configId: number; url: string }) =>
      musicLibraryApi.youtubeDownload(configId, url),
    onSuccess: (_, { configId }) => qc.invalidateQueries({ queryKey: ['songs', configId] }),
  });
}

export function useYouTubeInfo() {
  return useMutation({
    mutationFn: ({ configId, url }: { configId: number; url: string }) =>
      musicLibraryApi.youtubeInfo(configId, url),
  });
}

export function useYouTubeDownloadBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ configId, urls }: { configId: number; urls: string[] }) =>
      musicLibraryApi.youtubeDownloadBatch(configId, urls),
    onSuccess: (_, { configId }) => qc.invalidateQueries({ queryKey: ['songs', configId] }),
  });
}
