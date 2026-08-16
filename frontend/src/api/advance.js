import request from './client.js';

export const listAdvances = (page = 1, pageSize = 10, { search = '', fromDate = '', toDate = '' } = {}) => {
  const query = new URLSearchParams({
    page,
    pageSize,
    ...(search ? { search } : {}),
    ...(fromDate ? { fromDate } : {}),
    ...(toDate ? { toDate } : {})
  });
  return request(`/advance?${query.toString()}`);
};

export const getAdvance       = (uid) => request(`/advance/${uid}`);
export const getAdvanceByCode = (code) => request(`/advance/by-code/${encodeURIComponent(code)}`);
export const createAdvance    = (data) => request('/advance', { method: 'POST', body: data });
export const updateAdvance    = (uid, data) => request(`/advance/${uid}`, { method: 'PUT', body: data });
export const deleteAdvance    = (uid) => request(`/advance/${uid}`, { method: 'DELETE' });
