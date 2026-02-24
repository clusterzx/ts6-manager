import api from './client';

export const botsApi = {
  list: () => api.get('/bots').then((r) => r.data),
  get: (id: number) => api.get(`/bots/${id}`).then((r) => r.data),
  create: (data: any) => api.post('/bots', data).then((r) => r.data),
  update: (id: number, data: any) => api.put(`/bots/${id}`, data).then((r) => r.data),
  delete: (id: number) => api.delete(`/bots/${id}`),
  enable: (id: number) => api.post(`/bots/${id}/enable`).then((r) => r.data),
  disable: (id: number) => api.post(`/bots/${id}/disable`).then((r) => r.data),
  executions: (id: number) => api.get(`/bots/${id}/executions`).then((r) => r.data),
  executionLogs: (botId: number, execId: number) =>
    api.get(`/bots/${botId}/executions/${execId}/logs`).then((r) => r.data),
};

export const usersApi = {
  list: () => api.get('/users').then((r) => r.data),
  create: (data: any) => api.post('/users', data).then((r) => r.data),
  update: (id: number, data: any) => api.put(`/users/${id}`, data),
  delete: (id: number) => api.delete(`/users/${id}`),
};
