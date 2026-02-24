import api from './client';

const sgBase = (configId: number, sid: number) =>
  `/servers/${configId}/vs/${sid}/server-groups`;
const cgBase = (configId: number, sid: number) =>
  `/servers/${configId}/vs/${sid}/channel-groups`;

export const groupsApi = {
  // Server groups
  serverGroups: (configId: number, sid: number) =>
    api.get(sgBase(configId, sid)).then((r) => r.data),
  createServerGroup: (configId: number, sid: number, name: string) =>
    api.post(sgBase(configId, sid), { name }).then((r) => r.data),
  deleteServerGroup: (configId: number, sid: number, sgid: number) =>
    api.delete(`${sgBase(configId, sid)}/${sgid}`),
  renameServerGroup: (configId: number, sid: number, sgid: number, name: string) =>
    api.put(`${sgBase(configId, sid)}/${sgid}`, { name }).then((r) => r.data),
  serverGroupMembers: (configId: number, sid: number, sgid: number) =>
    api.get(`${sgBase(configId, sid)}/${sgid}/members`).then((r) => r.data),
  addServerGroupMember: (configId: number, sid: number, sgid: number, cldbid: number) =>
    api.post(`${sgBase(configId, sid)}/${sgid}/members`, { cldbid }).then((r) => r.data),
  removeServerGroupMember: (configId: number, sid: number, sgid: number, cldbid: number) =>
    api.delete(`${sgBase(configId, sid)}/${sgid}/members/${cldbid}`),
  serverGroupPerms: (configId: number, sid: number, sgid: number) =>
    api.get(`${sgBase(configId, sid)}/${sgid}/permissions`).then((r) => r.data),

  // Channel groups
  channelGroups: (configId: number, sid: number) =>
    api.get(cgBase(configId, sid)).then((r) => r.data),
  createChannelGroup: (configId: number, sid: number, name: string) =>
    api.post(cgBase(configId, sid), { name }).then((r) => r.data),
  deleteChannelGroup: (configId: number, sid: number, cgid: number) =>
    api.delete(`${cgBase(configId, sid)}/${cgid}`),
  channelGroupPerms: (configId: number, sid: number, cgid: number) =>
    api.get(`${cgBase(configId, sid)}/${cgid}/permissions`).then((r) => r.data),
};
