import request from './client';

export function getDashboardMetrics() {
  return request('/accounting/dashboard');
}

export function listAccountTypes() {
  return request('/accounting/types');
}

export function listAccountGroups() {
  return request('/accounting/groups');
}

export function listChartOfAccounts(params = {}) {
  const q = new URLSearchParams();
  if (params.type && params.type !== 'ALL') q.set('type', params.type);
  if (params.groupUid && params.groupUid !== 'ALL') q.set('groupUid', params.groupUid);
  if (params.search) q.set('search', params.search);
  if (params.is_active !== undefined) q.set('is_active', params.is_active);
  const qs = q.toString();
  return request(`/accounting/chart-of-accounts${qs ? `?${qs}` : ''}`);
}

export function getAccountDetail(uid) {
  return request(`/accounting/chart-of-accounts/${uid}`);
}

export function createAccount(data) {
  return request('/accounting/chart-of-accounts', { method: 'POST', body: data });
}

export function updateAccount(uid, data) {
  return request(`/accounting/chart-of-accounts/${uid}`, { method: 'PUT', body: data });
}

export function listJournalEntries(params = {}) {
  const q = new URLSearchParams();
  if (params.page) q.set('page', params.page);
  if (params.pageSize) q.set('pageSize', params.pageSize);
  if (params.search) q.set('search', params.search);
  if (params.voucherType && params.voucherType !== 'ALL') q.set('voucherType', params.voucherType);
  if (params.fromDate) q.set('fromDate', params.fromDate);
  if (params.toDate) q.set('toDate', params.toDate);
  if (params.status && params.status !== 'ALL') q.set('status', params.status);
  const qs = q.toString();
  return request(`/accounting/journal-entries${qs ? `?${qs}` : ''}`);
}

export function getJournalEntryDetail(uid) {
  return request(`/accounting/journal-entries/${uid}`);
}

export function createManualJournalVoucher(data) {
  return request('/accounting/journal-entries', { method: 'POST', body: data });
}

export function getAccountLedger(accountUid, params = {}) {
  const q = new URLSearchParams();
  if (params.fromDate) q.set('fromDate', params.fromDate);
  if (params.toDate) q.set('toDate', params.toDate);
  if (params.page) q.set('page', params.page);
  if (params.pageSize) q.set('pageSize', params.pageSize);
  const qs = q.toString();
  return request(`/accounting/ledger/${accountUid}${qs ? `?${qs}` : ''}`);
}

export function getARAgingReport(params = {}) {
  const q = new URLSearchParams();
  if (params.asOfDate) q.set('asOfDate', params.asOfDate);
  const qs = q.toString();
  return request(`/accounting/ar/aging${qs ? `?${qs}` : ''}`);
}

export function getCustomerStatement(customerUid, params = {}) {
  const q = new URLSearchParams();
  if (params.fromDate) q.set('fromDate', params.fromDate);
  if (params.toDate) q.set('toDate', params.toDate);
  const qs = q.toString();
  return request(`/accounting/ar/statement/${customerUid}${qs ? `?${qs}` : ''}`);
}

export function getTrialBalance(params = {}) {
  const q = new URLSearchParams();
  if (params.asOfDate) q.set('asOfDate', params.asOfDate);
  const qs = q.toString();
  return request(`/accounting/reports/trial-balance${qs ? `?${qs}` : ''}`);
}

export function getProfitAndLoss(params = {}) {
  const q = new URLSearchParams();
  if (params.fromDate) q.set('fromDate', params.fromDate);
  if (params.toDate) q.set('toDate', params.toDate);
  const qs = q.toString();
  return request(`/accounting/reports/profit-loss${qs ? `?${qs}` : ''}`);
}

export function getBalanceSheet(params = {}) {
  const q = new URLSearchParams();
  if (params.asOfDate) q.set('asOfDate', params.asOfDate);
  const qs = q.toString();
  return request(`/accounting/reports/balance-sheet${qs ? `?${qs}` : ''}`);
}

export function getDayBook(params = {}) {
  const q = new URLSearchParams();
  if (params.fromDate) q.set('fromDate', params.fromDate);
  if (params.toDate) q.set('toDate', params.toDate);
  if (params.search) q.set('search', params.search);
  if (params.voucherType && params.voucherType !== 'ALL') q.set('voucherType', params.voucherType);
  if (params.page) q.set('page', params.page);
  if (params.pageSize) q.set('pageSize', params.pageSize);
  const qs = q.toString();
  return request(`/accounting/reports/day-book${qs ? `?${qs}` : ''}`);
}

export function getCashBook(params = {}) {
  const q = new URLSearchParams();
  if (params.fromDate) q.set('fromDate', params.fromDate);
  if (params.toDate) q.set('toDate', params.toDate);
  if (params.page) q.set('page', params.page);
  if (params.pageSize) q.set('pageSize', params.pageSize);
  const qs = q.toString();
  return request(`/accounting/reports/cash-book${qs ? `?${qs}` : ''}`);
}

export function getBankBook(params = {}) {
  const q = new URLSearchParams();
  if (params.bankAccountUid && params.bankAccountUid !== 'ALL') q.set('bankAccountUid', params.bankAccountUid);
  if (params.fromDate) q.set('fromDate', params.fromDate);
  if (params.toDate) q.set('toDate', params.toDate);
  if (params.page) q.set('page', params.page);
  if (params.pageSize) q.set('pageSize', params.pageSize);
  const qs = q.toString();
  return request(`/accounting/reports/bank-book${qs ? `?${qs}` : ''}`);
}

export function getReceiptRegister(params = {}) {
  const q = new URLSearchParams();
  if (params.fromDate) q.set('fromDate', params.fromDate);
  if (params.toDate) q.set('toDate', params.toDate);
  if (params.search) q.set('search', params.search);
  if (params.page) q.set('page', params.page);
  if (params.pageSize) q.set('pageSize', params.pageSize);
  const qs = q.toString();
  return request(`/accounting/reports/receipt-register${qs ? `?${qs}` : ''}`);
}

export function getPaymentRegister(params = {}) {
  const q = new URLSearchParams();
  if (params.fromDate) q.set('fromDate', params.fromDate);
  if (params.toDate) q.set('toDate', params.toDate);
  if (params.search) q.set('search', params.search);
  if (params.page) q.set('page', params.page);
  if (params.pageSize) q.set('pageSize', params.pageSize);
  const qs = q.toString();
  return request(`/accounting/reports/payment-register${qs ? `?${qs}` : ''}`);
}

export function getJournalRegister(params = {}) {
  const q = new URLSearchParams();
  if (params.fromDate) q.set('fromDate', params.fromDate);
  if (params.toDate) q.set('toDate', params.toDate);
  if (params.search) q.set('search', params.search);
  if (params.voucherType && params.voucherType !== 'ALL') q.set('voucherType', params.voucherType);
  if (params.page) q.set('page', params.page);
  if (params.pageSize) q.set('pageSize', params.pageSize);
  const qs = q.toString();
  return request(`/accounting/reports/journal-register${qs ? `?${qs}` : ''}`);
}
