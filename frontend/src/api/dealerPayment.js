import request from './client.js';

export const listDealerCreditPurchases = ({ page = 1, pageSize = 20, search = '', status = 'all', dealer_uid = '' } = {}) => {
  const q = new URLSearchParams({
    page,
    pageSize,
    ...(search ? { search } : {}),
    ...(status ? { status } : {}),
    ...(dealer_uid ? { dealer_uid } : {})
  });
  return request(`/dealer-payments/credit-purchases?${q}`);
};

export const recordDealerPayment = (data) =>
  request('/dealer-payments/receive', { method: 'POST', body: data });

export const listDealerPayments = ({ page = 1, pageSize = 20, search = '', dealer_uid = '' } = {}) => {
  const q = new URLSearchParams({
    page,
    pageSize,
    ...(search ? { search } : {}),
    ...(dealer_uid ? { dealer_uid } : {})
  });
  return request(`/dealer-payments/history?${q}`);
};

export const deleteDealerPayment = (uid) =>
  request(`/dealer-payments/${uid}`, { method: 'DELETE' });

export const getDealerCreditSummary = () =>
  request('/dealer-payments/summary');
