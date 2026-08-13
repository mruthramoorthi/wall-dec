import request from './client.js';

export const imageSearch = (blob) => {
  const form = new FormData();
  form.append('file', blob, 'capture.jpg');
  return request('/stock/image-search', { method: 'POST', body: form, isForm: true });
};
export const byDesignNumber = (designNumber) => request(`/stock/by-design/${designNumber}`);
