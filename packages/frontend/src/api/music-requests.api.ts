import api from './client';

export interface MusicRequest {
    id: number;
    title: string;
    url: string;
    serverConfigId: number;
    requestedAt: string;
}

export const musicRequestsApi = {
    list: (configId: number): Promise<MusicRequest[]> =>
        api.get(`/servers/${configId}/music-requests`).then((r) => r.data),
};
