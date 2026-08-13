import request from './client.js';

export const listSizes = (page = 1, pageSize = 20) => request(`/size?page=${page}&pageSize=${pageSize}`);
export const createSize = (data) => request('/size', { method: 'POST', body: data });
export const updateSize = (uid, data) => request(`/size/${uid}`, { method: 'PUT', body: data });
export const deleteSize = (uid) => request(`/size/${uid}`, { method: 'DELETE' });
