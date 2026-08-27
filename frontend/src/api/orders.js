import request from './client.js';

export async function placeOrder(orderData) {
  return request('/orders/checkout', { method: 'POST', body: orderData });
}

export async function getCustomerOrders(userUid) {
  return request(`/orders/my-orders/${userUid}`);
}

export async function getOrderDetails(orderUid) {
  return request(`/orders/details/${orderUid}`);
}

export async function listAdminOrders({ status = 'ALL', search = '', page = 1, limit = 20 } = {}) {
  const query = new URLSearchParams({ status, search, page: String(page), limit: String(limit) }).toString();
  return request(`/orders/admin/list?${query}`);
}

export async function shipOrder(orderUid, { shipmentNumber, courierDetails, notes }) {
  return request(`/orders/admin/${orderUid}/ship`, {
    method: 'POST',
    body: { shipmentNumber, courierDetails, notes }
  });
}

export async function updateOrderStatus(orderUid, status) {
  return request(`/orders/admin/${orderUid}/status`, {
    method: 'PATCH',
    body: { status }
  });
}

export async function submitProductFeedback(data) {
  return request('/orders/feedback', { method: 'POST', body: data });
}

export async function getProductReviews(stockUid) {
  return request(`/orders/feedback/${stockUid}`);
}

export async function confirmOrderAndPayment(orderUid, data) {
  return request(`/orders/admin/${orderUid}/confirm-and-pay`, {
    method: 'PATCH',
    body: data
  });
}

export async function revertOrderStatus(orderUid, { targetStatus, reason }) {
  return request(`/orders/admin/${orderUid}/revert`, {
    method: 'PATCH',
    body: { targetStatus, reason }
  });
}

export async function reportOrderIssue(data) {
  return request('/orders/report-issue', {
    method: 'POST',
    body: data
  });
}

export async function updateOrderIssueStatus(orderUid, { issueStatus, adminResolutionNotes }) {
  return request(`/orders/admin/${orderUid}/issue-status`, {
    method: 'PATCH',
    body: { issueStatus, adminResolutionNotes }
  });
}

export async function verifyCartStock(items) {
  return request('/orders/verify-cart-stock', {
    method: 'POST',
    body: items
  });
}

export async function logSearchDemand({ queryText, searchType = 'text', resultsCount = 0, userUid = null }) {
  return request('/orders/log-search', {
    method: 'POST',
    body: { queryText, searchType, resultsCount, userUid }
  });
}

export async function getDemandTrends({ limit = 20, zeroResultsOnly = false } = {}) {
  const query = new URLSearchParams({ limit: String(limit), zeroResultsOnly: String(zeroResultsOnly) }).toString();
  return request(`/orders/admin/demand-trends?${query}`);
}
