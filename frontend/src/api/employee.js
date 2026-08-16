import request from './client.js';

export const listEmployees   = (page = 1, pageSize = 10, { search = '' } = {}) => {
  const q = new URLSearchParams({ page, pageSize, ...(search ? { search } : {}) });
  return request(`/employee?${q}`);
};
export const getEmployee    = (uid)       => request(`/employee/${uid}`);
export const createEmployee = (data)      => request('/employee', { method: 'POST', body: data });
export const updateEmployee = (uid, data) => request(`/employee/${uid}`, { method: 'PUT', body: data });
export const deleteEmployee = (uid)       => request(`/employee/${uid}`, { method: 'DELETE' });
