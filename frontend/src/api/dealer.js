import request from './client.js';

export const listDealers = (page = 1, pageSize = 20) => request(`/dealer?page=${page}&pageSize=${pageSize}`);
export const createDealer = (data) => request('/dealer', { method: 'POST', body: data });
export const updateDealer = (uid, data) => request(`/dealer/${uid}`, { method: 'PUT', body: data });
export const deleteDealer = (uid) => request(`/dealer/${uid}`, { method: 'DELETE' });
