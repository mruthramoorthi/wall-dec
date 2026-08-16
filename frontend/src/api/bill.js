import request from './client.js';

export const listBills = (page = 1, pageSize = 20, { todayOnly = false } = {}) =>
  request(`/bill?page=${page}&pageSize=${pageSize}&todayOnly=${todayOnly}`);
export const getBill   = (uid) => request(`/bill/${uid}`);
export const createBill = (data) => request('/bill', { method: 'POST', body: data });
export const updateBill = (uid, data) => request(`/bill/${uid}`, { method: 'PUT', body: data });
export const deleteBill = (uid) => request(`/bill/${uid}`, { method: 'DELETE' });
