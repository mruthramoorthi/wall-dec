import request from './client.js';

export const listDealers = (page = 1, pageSize = 10, { q = '', sortBy = '', sortDir = '' } = {}) =>
  request(`/dealer?page=${page}&pageSize=${pageSize}&q=${encodeURIComponent(q)}&sortBy=${sortBy}&sortDir=${sortDir}`);
export const createDealer = (data) => request('/dealer', { method: 'POST', body: data });
export const updateDealer = (uid, data) => request(`/dealer/${uid}`, { method: 'PUT', body: data });
export const deleteDealer = (uid) => request(`/dealer/${uid}`, { method: 'DELETE' });
