import api from './client';

const base = (configId: number, sid: number) =>
  `/servers/${configId}/vs/${sid}/bans`;

export const bansApi = {
  list: (configId: number, sid: number) =>
    api.get(base(configId, sid)).then((r) => r.data),
  add: (configId: number, sid: number, data: any) =>
    api.post(base(configId, sid), data).then((r) => r.data),
  delete: (configId: number, sid: number, banid: number) =>
    api.delete(`${base(configId, sid)}/${banid}`),
  deleteAll: (configId: number, sid: number) =>
    api.delete(base(configId, sid)),
};

export const tokensApi = {
  list: (configId: number, sid: number) =>
    api.get(`/servers/${configId}/vs/${sid}/tokens`).then((r) => r.data),
  add: (configId: number, sid: number, data: any) =>
    api.post(`/servers/${configId}/vs/${sid}/tokens`, data).then((r) => r.data),
  delete: (configId: number, sid: number, token: string) =>
    api.delete(`/servers/${configId}/vs/${sid}/tokens/${encodeURIComponent(token)}`),
};

export const complaintsApi = {
  list: (configId: number, sid: number) =>
    api.get(`/servers/${configId}/vs/${sid}/complaints`).then((r) => r.data),
  delete: (configId: number, sid: number, tcldbid: number, fcldbid: number) =>
    api.delete(`/servers/${configId}/vs/${sid}/complaints/${tcldbid}/${fcldbid}`),
};

export const messagesApi = {
  list: (configId: number, sid: number) =>
    api.get(`/servers/${configId}/vs/${sid}/messages`).then((r) => r.data),
  get: (configId: number, sid: number, msgid: number) =>
    api.get(`/servers/${configId}/vs/${sid}/messages/${msgid}`).then((r) => r.data),
  send: (configId: number, sid: number, data: any) =>
    api.post(`/servers/${configId}/vs/${sid}/messages`, data).then((r) => r.data),
  delete: (configId: number, sid: number, msgid: number) =>
    api.delete(`/servers/${configId}/vs/${sid}/messages/${msgid}`),
};

export const logsApi = {
  get: (configId: number, sid: number, lines = 100) =>
    api.get(`/servers/${configId}/vs/${sid}/logs`, { params: { lines, reverse: 1 } }).then((r) => r.data),
};

export const filesApi = {
  list: (configId: number, sid: number, cid: number, path = '/') =>
    api.get(`/servers/${configId}/vs/${sid}/files/${cid}`, { params: { path } }).then((r) => r.data),
};

export const permissionsApi = {
  list: (configId: number, sid: number) =>
    api.get(`/servers/${configId}/vs/${sid}/permissions`).then((r) => r.data),
  find: (configId: number, sid: number, permsid: string) =>
    api.get(`/servers/${configId}/vs/${sid}/permissions/find`, { params: { permsid } }).then((r) => r.data),
  overview: (configId: number, sid: number, cldbid: number) =>
    api.get(`/servers/${configId}/vs/${sid}/permissions/overview/${cldbid}`).then((r) => r.data),
};
