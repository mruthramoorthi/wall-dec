import request from './client.js';

export const listExpenses = (page = 1, pageSize = 20, filters = {}) => {
  const params = new URLSearchParams();
  params.set('page', page);
  params.set('pageSize', pageSize);
  if (filters.search) params.set('search', filters.search);
  if (filters.fromDate) params.set('fromDate', filters.fromDate);
  if (filters.toDate) params.set('toDate', filters.toDate);
  if (filters.category && filters.category !== 'all') params.set('category', filters.category);
  if (filters.paymentMode && filters.paymentMode !== 'all') params.set('paymentMode', filters.paymentMode);
  if (filters.bankUid) params.set('bankUid', filters.bankUid);
  return request(`/expense?${params.toString()}`);
};

export const getExpense = (uid) => request(`/expense/${uid}`);

export const createExpense = (data) =>
  request('/expense', { method: 'POST', body: data });

export const updateExpense = (uid, data) =>
  request(`/expense/${uid}`, { method: 'PUT', body: data });

export const deleteExpense = (uid) =>
  request(`/expense/${uid}`, { method: 'DELETE' });
