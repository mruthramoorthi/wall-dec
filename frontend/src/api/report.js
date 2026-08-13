import request from './client.js';

export const amountTransactionReport = (page = 1, pageSize = 20) =>
  request(`/reports/amount-transaction?page=${page}&pageSize=${pageSize}`);
