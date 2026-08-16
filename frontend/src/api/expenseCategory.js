import request from './client.js';

export const listExpenseCategories = (page = 1, pageSize = 20, filters = {}) => {
  const params = new URLSearchParams();
  params.set('page', page);
  params.set('pageSize', pageSize);
  if (filters.search) params.set('search', filters.search);
  if (filters.all) params.set('all', 'true');
  return request(`/expense-category?${params.toString()}`);
};

export const getExpenseCategory = (uid) => request(`/expense-category/${uid}`);

export const createExpenseCategory = (data) =>
  request('/expense-category', { method: 'POST', body: data });

export const updateExpenseCategory = (uid, data) =>
  request(`/expense-category/${uid}`, { method: 'PUT', body: data });

export const deleteExpenseCategory = (uid) =>
  request(`/expense-category/${uid}`, { method: 'DELETE' });
