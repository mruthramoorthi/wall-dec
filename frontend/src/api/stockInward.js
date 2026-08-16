import request from './client.js';

export const listStockInward = (page = 1, pageSize = 20, { q = '', sortBy = 'entry_datetime', sortDir = 'desc' } = {}) =>
  request(`/stock-inward?page=${page}&pageSize=${pageSize}&q=${encodeURIComponent(q)}&sortBy=${sortBy}&sortDir=${sortDir}`);
export const createStockInward = (data) => request('/stock-inward', { method: 'POST', body: data });
export const updateStockInward = (uid, data) => request(`/stock-inward/${uid}`, { method: 'PUT', body: data });
export const deleteStockInward = (uid) => request(`/stock-inward/${uid}`, { method: 'DELETE' });
