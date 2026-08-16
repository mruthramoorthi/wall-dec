import request from './client.js';

export const getCompany  = ()     => request('/company');
export const saveCompany = (data) => request('/company', { method: 'POST', body: data });
