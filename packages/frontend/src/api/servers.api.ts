import api from './client';

export const serversApi = {
  list: () => api.get('/servers').then((r) => r.data),
  get: (id: number) => api.get(`/servers/${id}`).then((r) => r.data),
  create: (data: any) => api.post('/servers', data).then((r) => r.data),
  update: (id: number, data: any) => api.put(`/servers/${id}`, data).then((r) => r.data),
  delete: (id: number) => api.delete(`/servers/${id}`),
  test: (id: number) => api.post(`/servers/${id}/test`).then((r) => r.data),

  // Virtual servers
  listVirtual: (configId: number) =>
    api.get(`/servers/${configId}/virtual-servers`).then((r) => r.data),
  getVirtualInfo: (configId: number, sid: number) =>
    api.get(`/servers/${configId}/virtual-servers/${sid}/info`).then((r) => r.data),
  editVirtual: (configId: number, sid: number, data: any) =>
    api.put(`/servers/${configId}/virtual-servers/${sid}`, data).then((r) => r.data),
  createVirtual: (configId: number, data: any) =>
    api.post(`/servers/${configId}/virtual-servers`, data).then((r) => r.data),
  startVirtual: (configId: number, sid: number) =>
    api.post(`/servers/${configId}/virtual-servers/${sid}/start`).then((r) => r.data),
  stopVirtual: (configId: number, sid: number) =>
    api.post(`/servers/${configId}/virtual-servers/${sid}/stop`).then((r) => r.data),
  deleteVirtual: (configId: number, sid: number) =>
    api.delete(`/servers/${configId}/virtual-servers/${sid}`),
  createSnapshot: (configId: number, sid: number) =>
    api.post(`/servers/${configId}/virtual-servers/${sid}/snapshot`).then((r) => r.data),

  // Instance
  instanceInfo: (configId: number) =>
    api.get(`/servers/${configId}/instance`).then((r) => r.data),
  instanceEdit: (configId: number, data: any) =>
    api.put(`/servers/${configId}/instance`, data).then((r) => r.data),
  hostInfo: (configId: number) =>
    api.get(`/servers/${configId}/instance/host`).then((r) => r.data),
  version: (configId: number) =>
    api.get(`/servers/${configId}/instance/version`).then((r) => r.data),
};
