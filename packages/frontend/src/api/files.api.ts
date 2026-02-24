import api from './client';

const base = (configId: number, sid: number) =>
  `/servers/${configId}/vs/${sid}/files`;

export const filesApi = {
  list: (configId: number, sid: number, cid: number, path = '/') =>
    api.get(`${base(configId, sid)}/${cid}`, { params: { path } }).then((r) => r.data),
  createDir: (configId: number, sid: number, cid: number, dirname: string) =>
    api.post(`${base(configId, sid)}/${cid}/mkdir`, { dirname }).then((r) => r.data),
  delete: (configId: number, sid: number, cid: number, name: string) =>
    api.delete(`${base(configId, sid)}/${cid}/file`, { data: { name } }).then((r) => r.data),
};
