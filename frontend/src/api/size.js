import request from './client.js';

export const listSizes = (page = 1, pageSize = 10, { q = '', sortBy = '', sortDir = '' } = {}) =>
  request(`/size?page=${page}&pageSize=${pageSize}&q=${encodeURIComponent(q)}&sortBy=${sortBy}&sortDir=${sortDir}`);
export const createSize = (data) => request('/size', { method: 'POST', body: data });
export const updateSize = (uid, data) => request(`/size/${uid}`, { method: 'PUT', body: data });
export const deleteSize = (uid) => request(`/size/${uid}`, { method: 'DELETE' });
