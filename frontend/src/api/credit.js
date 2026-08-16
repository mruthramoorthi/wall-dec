import request from './client.js';

export const listCreditBills = (page = 1, pageSize = 20, { search = '', status = 'all' } = {}) => {
  const q = new URLSearchParams({ page, pageSize, ...(search ? { search } : {}), ...(status ? { status } : {}) });
  return request(`/credit/bills?${q}`);
};

export const getCustomerAdvances = (customerUid) =>
  request(`/credit/customer-advances/${customerUid}`);

export const receiveCreditPayment = (data) =>
  request('/credit/receive', { method: 'POST', body: data });

export const updateCreditReceipt = (uid, data) =>
  request(`/credit/receipts/${uid}`, { method: 'PUT', body: data });

export const deleteCreditReceipt = (uid) =>
  request(`/credit/receipts/${uid}`, { method: 'DELETE' });

export const listCreditReceipts = (page = 1, pageSize = 20, { search = '' } = {}) => {
  const q = new URLSearchParams({ page, pageSize, ...(search ? { search } : {}) });
  return request(`/credit/receipts?${q}`);
};

export const getCreditSummary = () =>
  request('/credit/summary');
