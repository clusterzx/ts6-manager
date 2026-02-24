import api from './client';

const base = (configId: number, sid: number) =>
  `/servers/${configId}/vs/${sid}/channels`;

export const channelsApi = {
  list: (configId: number, sid: number) =>
    api.get(base(configId, sid)).then((r) => r.data),
  get: (configId: number, sid: number, cid: number) =>
    api.get(`${base(configId, sid)}/${cid}`).then((r) => r.data),
  create: (configId: number, sid: number, data: any) =>
    api.post(base(configId, sid), data).then((r) => r.data),
  edit: (configId: number, sid: number, cid: number, data: any) =>
    api.put(`${base(configId, sid)}/${cid}`, data).then((r) => r.data),
  delete: (configId: number, sid: number, cid: number) =>
    api.delete(`${base(configId, sid)}/${cid}`),
  move: (configId: number, sid: number, cid: number, data: any) =>
    api.post(`${base(configId, sid)}/${cid}/move`, data).then((r) => r.data),
  permissions: (configId: number, sid: number, cid: number) =>
    api.get(`${base(configId, sid)}/${cid}/permissions`).then((r) => r.data),
};
