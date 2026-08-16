import request from './client.js';

export const listCustomers = (page = 1, pageSize = 10, { search = '' } = {}) => {
  const query = new URLSearchParams({
    page,
    pageSize,
    ...(search ? { search } : {})
  });
  return request(`/customer?${query.toString()}`);
};

export const getCustomer      = (uid) => request(`/customer/${uid}`);
export const searchCustomers  = (q) => request(`/customer/search?q=${encodeURIComponent(q)}`);
export const createCustomer   = (data) => request('/customer', { method: 'POST', body: data });
export const updateCustomer   = (uid, data) => request(`/customer/${uid}`, { method: 'PUT', body: data });
export const deleteCustomer   = (uid) => request(`/customer/${uid}`, { method: 'DELETE' });
