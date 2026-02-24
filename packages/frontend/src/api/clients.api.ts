import api from './client';

const base = (configId: number, sid: number) =>
  `/servers/${configId}/vs/${sid}/clients`;

export const clientsApi = {
  list: (configId: number, sid: number) =>
    api.get(base(configId, sid)).then((r) => r.data),
  get: (configId: number, sid: number, clid: number) =>
    api.get(`${base(configId, sid)}/${clid}`).then((r) => r.data),
  database: (configId: number, sid: number, start = 0, duration = 100) =>
    api.get(`${base(configId, sid)}/database`, { params: { start, duration } }).then((r) => r.data),
  kick: (configId: number, sid: number, clid: number, reasonid: number, reasonmsg?: string) =>
    api.post(`${base(configId, sid)}/${clid}/kick`, { reasonid, reasonmsg }).then((r) => r.data),
  ban: (configId: number, sid: number, clid: number, time?: number, banreason?: string) =>
    api.post(`${base(configId, sid)}/${clid}/ban`, { time, banreason }).then((r) => r.data),
  move: (configId: number, sid: number, clid: number, cid: number) =>
    api.post(`${base(configId, sid)}/${clid}/move`, { cid }).then((r) => r.data),
  poke: (configId: number, sid: number, clid: number, msg: string) =>
    api.post(`${base(configId, sid)}/${clid}/poke`, { msg }).then((r) => r.data),
  message: (configId: number, sid: number, clid: number, msg: string) =>
    api.post(`${base(configId, sid)}/${clid}/message`, { msg }).then((r) => r.data),
};
