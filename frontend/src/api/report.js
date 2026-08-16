import request from './client.js';

export const amountTransactionReport = (
  page = 1,
  pageSize = 10,
  { q = '', fromDate = '', toDate = '', customerUid = '', paymentMode = '', minAmount = '', maxAmount = '', sortBy = '', sortDir = '' } = {}
) => {
  const params = new URLSearchParams();
  params.set('page', page);
  params.set('pageSize', pageSize);
  if (q) params.set('q', q);
  if (fromDate) params.set('fromDate', fromDate);
  if (toDate) params.set('toDate', toDate);
  if (customerUid) params.set('customerUid', customerUid);
  if (paymentMode) params.set('paymentMode', paymentMode);
  if (minAmount !== '' && minAmount !== null) params.set('minAmount', minAmount);
  if (maxAmount !== '' && maxAmount !== null) params.set('maxAmount', maxAmount);
  if (sortBy) params.set('sortBy', sortBy);
  if (sortDir) params.set('sortDir', sortDir);

  return request(`/reports/amount-transaction?${params.toString()}`);
};
