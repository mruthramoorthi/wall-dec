import request from './client.js';

export const imageSearch = (blob) => {
  const form = new FormData();
  form.append('file', blob, 'capture.jpg');
  return request('/stock/image-search', { method: 'POST', body: form, isForm: true });
};

export const uploadNewDesignImage = (blob) => {
  const form = new FormData();
  form.append('file', blob, blob.name || 'new-design.jpg');
  return request('/stock/upload-image', { method: 'POST', body: form, isForm: true });
};

export const byDesignNumber = (designNumber) => request(`/stock/by-design/${designNumber}`);

export const ensureHomeBillStock = ({ image_filename, design_number, size_uid } = {}) =>
  request('/stock/ensure-home-bill-stock', {
    method: 'POST',
    body: { image_filename, design_number, size_uid },
  });
