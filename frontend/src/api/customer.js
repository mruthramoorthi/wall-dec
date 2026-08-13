import request from './client.js';

export const searchCustomers = (q) => request(`/customer/search?q=${encodeURIComponent(q)}`);
export const createCustomer = (data) => request('/customer', { method: 'POST', body: data });
