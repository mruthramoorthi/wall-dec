import request from './client.js';

export const listRates   = (page = 1, pageSize = 50, { search = '' } = {}) => {
  const q = new URLSearchParams({ page, pageSize, ...(search ? { search } : {}) });
  return request(`/rate-master?${q}`);
};
export const updateRates = (uid, { selling_price_per_piece }) =>
  request(`/rate-master/${uid}/rates`, { method: 'PUT', body: { selling_price_per_piece } });
