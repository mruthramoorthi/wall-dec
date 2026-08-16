/**
 * Utility to directly open 58mm Thermal Receipt PDF in a new browser tab
 * 
 * @param {string} uid - Unique identifier of the document (bill, advance, credit receipt, expense)
 * @param {string} type - 'bill' | 'advance' | 'credit' | 'expense'
 */
export function openReceiptPdf(uid, type = 'bill') {
  if (!uid) return;
  const url = `/api/print/receipt-pdf?type=${encodeURIComponent(type)}&uid=${encodeURIComponent(uid)}`;
  window.open(url, '_blank');
}
