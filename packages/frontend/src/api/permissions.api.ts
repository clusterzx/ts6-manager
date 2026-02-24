import api from './client';

const base = (configId: number, sid: number) =>
  `/servers/${configId}/vs/${sid}/permissions`;
const sgBase = (configId: number, sid: number) =>
  `/servers/${configId}/vs/${sid}/server-groups`;
const cgBase = (configId: number, sid: number) =>
  `/servers/${configId}/vs/${sid}/channel-groups`;
const chBase = (configId: number, sid: number) =>
  `/servers/${configId}/vs/${sid}/channels`;
const clBase = (configId: number, sid: number) =>
  `/servers/${configId}/vs/${sid}/clients`;

export const permissionsApi = {
  // All known permissions (definitions)
  list: (configId: number, sid: number) =>
    api.get(base(configId, sid)).then((r) => r.data),

  // Server Group permissions
  serverGroupPerms: (configId: number, sid: number, sgid: number) =>
    api.get(`${sgBase(configId, sid)}/${sgid}/permissions`).then((r) => r.data),
  addServerGroupPerm: (configId: number, sid: number, sgid: number, data: any) =>
    api.put(`${sgBase(configId, sid)}/${sgid}/permissions`, data).then((r) => r.data),
  delServerGroupPerm: (configId: number, sid: number, sgid: number, data: any) =>
    api.delete(`${sgBase(configId, sid)}/${sgid}/permissions`, { data }).then((r) => r.data),

  // Channel Group permissions
  channelGroupPerms: (configId: number, sid: number, cgid: number) =>
    api.get(`${cgBase(configId, sid)}/${cgid}/permissions`).then((r) => r.data),
  addChannelGroupPerm: (configId: number, sid: number, cgid: number, data: any) =>
    api.put(`${cgBase(configId, sid)}/${cgid}/permissions`, data).then((r) => r.data),
  delChannelGroupPerm: (configId: number, sid: number, cgid: number, data: any) =>
    api.delete(`${cgBase(configId, sid)}/${cgid}/permissions`, { data }).then((r) => r.data),

  // Channel permissions
  channelPerms: (configId: number, sid: number, cid: number) =>
    api.get(`${chBase(configId, sid)}/${cid}/permissions`).then((r) => r.data),
  addChannelPerm: (configId: number, sid: number, cid: number, data: any) =>
    api.put(`${chBase(configId, sid)}/${cid}/permissions`, data).then((r) => r.data),
  delChannelPerm: (configId: number, sid: number, cid: number, data: any) =>
    api.delete(`${chBase(configId, sid)}/${cid}/permissions`, { data }).then((r) => r.data),

  // Client permissions
  clientPerms: (configId: number, sid: number, cldbid: number) =>
    api.get(`${clBase(configId, sid)}/${cldbid}/permissions`).then((r) => r.data),

  // Server groups & channel groups list
  serverGroups: (configId: number, sid: number) =>
    api.get(sgBase(configId, sid)).then((r) => r.data),
  channelGroups: (configId: number, sid: number) =>
    api.get(cgBase(configId, sid)).then((r) => r.data),

  // Channels and clients for entity selectors
  channels: (configId: number, sid: number) =>
    api.get(chBase(configId, sid)).then((r) => r.data),
  clients: (configId: number, sid: number) =>
    api.get(clBase(configId, sid)).then((r) => r.data),
};
