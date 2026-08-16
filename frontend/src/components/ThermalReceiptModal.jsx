import { useRef, useEffect, useState } from 'react';
import { getCompany } from '../api/company.js';

const inr = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatDateTime = (dt) => {
  if (!dt) return new Date().toLocaleString('en-IN');
  const d = new Date(dt);
  return isNaN(d.getTime()) ? String(dt) : d.toLocaleString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};

const formatDateOnly = (dt) => {
  if (!dt) return '';
  const d = new Date(dt);
  return isNaN(d.getTime()) ? String(dt).slice(0, 10) : d.toLocaleDateString('en-IN');
};

/**
 * ThermalReceiptModal (58mm Thermal Print)
 * 
 * Props:
 * - isOpen: boolean
 * - onClose: () => void
 * - type: 'bill' | 'advance' | 'prebook' | 'credit_receipt' | 'expense'
 * - data: object (The record to print)
 * - company: object (Optional company details, auto-fetched if missing)
 */
export default function ThermalReceiptModal({ isOpen, onClose, type = 'bill', data, company: initialCompany }) {
  const [company, setCompany] = useState(initialCompany || null);
  const [loadingCompany, setLoadingCompany] = useState(!initialCompany);
  const receiptRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      if (!company) {
        setLoadingCompany(true);
        getCompany()
          .then((res) => setCompany(res?.data || null))
          .catch((e) => console.warn('Failed to load company for thermal print:', e))
          .finally(() => setLoadingCompany(false));
      }
    }
  }, [isOpen]);

  if (!isOpen || !data) return null;

  const handlePrint = () => {
    const printContent = receiptRef.current;
    if (!printContent) return;

    // Open dedicated new tab for 58mm POS thermal printing
    const printWin = window.open('', '_blank');
    if (!printWin) {
      alert('Popup blocker prevented opening print tab. Please allow popups for this site.');
      return;
    }

    const receiptHtml = printContent.innerHTML;

    printWin.document.open();
    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>${docTitle} - 58mm Thermal Receipt</title>
          <style>
            @page {
              size: 58mm auto;
              margin: 0mm !important;
            }
            @page :first {
              size: 58mm auto;
              margin: 0mm !important;
            }
            *, *::before, *::after {
              box-sizing: border-box;
            }
            @media print {
              .no-print {
                display: none !important;
              }
              html, body {
                width: 58mm !important;
                max-width: 58mm !important;
                min-width: 58mm !important;
                margin: 0 !important;
                padding: 0 !important;
                background: #ffffff !important;
                color: #000000 !important;
                font-family: 'Courier New', Courier, monospace !important;
                font-size: 11px !important;
                line-height: 1.25 !important;
                font-weight: 700 !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              .receipt-wrapper {
                box-shadow: none !important;
                border: none !important;
                padding: 2mm 1mm !important;
                margin: 0 !important;
                width: 58mm !important;
                max-width: 58mm !important;
              }
            }
            body {
              margin: 0;
              padding: 20px 10px;
              background: #f1f5f9;
              display: flex;
              flex-direction: column;
              align-items: center;
              font-family: 'Courier New', Courier, monospace;
              color: #000000;
            }
            .no-print-bar {
              width: 58mm;
              max-width: 58mm;
              background: #0f172a;
              color: #ffffff;
              padding: 8px 10px;
              border-radius: 6px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 12px;
              box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
              font-family: system-ui, -apple-system, sans-serif;
            }
            .no-print-btn {
              padding: 5px 10px;
              border-radius: 4px;
              font-size: 11px;
              font-weight: 700;
              cursor: pointer;
              border: none;
            }
            .btn-print {
              background: #2563eb;
              color: #ffffff;
            }
            .btn-close {
              background: #475569;
              color: #ffffff;
            }
            .receipt-wrapper {
              width: 58mm;
              max-width: 58mm;
              background: #ffffff;
              color: #000000;
              padding: 6px 4px;
              font-family: 'Courier New', Courier, monospace;
              font-size: 11px;
              line-height: 1.25;
              font-weight: 700;
              box-shadow: 0 4px 15px rgba(0,0,0,0.12);
              border: 1px solid #cbd5e1;
              border-radius: 2px;
            }
          </style>
        </head>
        <body>
          <div class="no-print no-print-bar">
            <span style="font-size: 11px; font-weight: 700;">58mm POS</span>
            <div style="display: flex; gap: 5px;">
              <button class="no-print-btn btn-print" onclick="window.print()">🖨️ Print</button>
              <button class="no-print-btn btn-close" onclick="window.close()">✕ Close</button>
            </div>
          </div>

          <div class="receipt-wrapper">
            ${receiptHtml}
          </div>

          <script>
            window.onload = function() {
              window.focus();
              setTimeout(function() {
                window.print();
              }, 250);
            };
            window.onafterprint = function() {
              window.close();
            };
          </script>
        </body>
      </html>
    `);
    printWin.document.close();
  };

  // Determine Title & Document Numbers
  let docTitle = 'TAX INVOICE';
  let docNumberLabel = 'Bill No';
  let docNumberValue = data.bill_number || (data.id ? `BILL-${String(data.id).padStart(4, '0')}` : '—');

  if (type === 'advance') {
    docTitle = data.is_prebook ? 'PRE-BOOKING VOUCHER' : 'ADVANCE RECEIPT';
    docNumberLabel = data.is_prebook ? 'Pre-Book Code' : 'Advance No';
    docNumberValue = data.prebook_code || (data.id ? `ADV-${String(data.id).padStart(4, '0')}` : '—');
  } else if (type === 'prebook') {
    docTitle = 'PRE-BOOKING RESERVATION';
    docNumberLabel = 'Pre-Book Code';
    docNumberValue = data.prebook_code || '—';
  } else if (type === 'credit_receipt') {
    docTitle = 'CREDIT PAYMENT RECEIPT';
    docNumberLabel = 'Receipt No';
    docNumberValue = data.receipt_id ? `RCPT-${String(data.receipt_id).padStart(4, '0')}` : (data.bill_number ? `REC-${data.bill_number}` : '—');
  } else if (type === 'expense') {
    docTitle = 'EXPENSE PAYMENT VOUCHER';
    docNumberLabel = 'Expense No';
    docNumberValue = data.expense_id ? `EXP-${String(data.expense_id).padStart(4, '0')}` : '—';
  }

  // Parse items & payments if present
  const items = Array.isArray(data.items) ? data.items : [];
  const payments = Array.isArray(data.payments) ? data.payments : (
    data.payment_mode ? [{
      payment_mode: data.payment_mode,
      amount: data.amount,
      bank_name: data.bank_name,
      bank_code: data.bank_code,
      ref_number: data.ref_number,
      transaction_date: data.transaction_date,
      denominations: data.denominations,
      tendered_amount: data.tendered_amount,
      change_returned: data.change_returned
    }] : []
  );

  return (
    <div className="modal-backdrop" style={{ zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="modal-card" style={{ maxWidth: 440, width: '100%', maxHeight: '94vh', display: 'flex', flexDirection: 'column', background: '#0f172a', border: '1px solid #334155', padding: '1rem', borderRadius: 12, boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)' }}>
        {/* Header Toolbar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', borderBottom: '1px solid #334155', paddingBottom: '0.6rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.25rem' }}>🖨️</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#f8fafc', fontWeight: 800 }}>58mm Thermal Print Preview</h3>
              <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>Thermal Roll 58mm (2-inch POS Paper)</span>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            style={{ padding: '0.25rem 0.6rem', fontSize: '0.82rem', background: '#1e293b', color: '#cbd5e1', border: '1px solid #475569', borderRadius: 6 }}
          >
            ✕
          </button>
        </div>

        {/* Scrollable Receipt Preview Container */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', justifyContent: 'center', padding: '0.5rem 0', background: '#020617', borderRadius: 8 }}>
          {/* Simulated 58mm Thermal Paper */}
          <div
            ref={receiptRef}
            style={{
              width: '58mm',
              minHeight: '120mm',
              background: '#ffffff',
              color: '#000000',
              padding: '6px 4px',
              fontFamily: "'Courier New', Courier, monospace",
              fontSize: '11px',
              lineHeight: 1.25,
              fontWeight: 600,
              boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
              borderRadius: 2
            }}
          >
            {/* ── 1. Company Header ── */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '13px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {company?.company_name || 'WALL DEC / INVENTORY ERP'}
              </div>
              {company?.address && (
                <div style={{ fontSize: '9.5px', marginTop: '1px' }}>
                  {company.address}{company.city ? `, ${company.city}` : ''}{company.pincode ? ` - ${company.pincode}` : ''}
                </div>
              )}
              {company?.mobile_number && (
                <div style={{ fontSize: '9.5px' }}>
                  Ph: {company.mobile_number}
                </div>
              )}
              {company?.is_gst_registered && company?.gstin && (
                <div style={{ fontSize: '9.5px', fontWeight: 700 }}>
                  GSTIN: {company.gstin}
                </div>
              )}
            </div>

            <div style={{ borderTop: '1px dashed #000', margin: '4px 0' }} />

            {/* ── 2. Receipt Title & Meta ── */}
            <div style={{ textAlign: 'center', fontWeight: 900, fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              *** {docTitle} ***
            </div>

            <div style={{ borderTop: '1px dashed #000', margin: '4px 0' }} />

            <div style={{ fontSize: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{docNumberLabel}:</span>
                <span style={{ fontWeight: 900 }}>{docNumberValue}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Date:</span>
                <span>{formatDateTime(data.entry_datetime || data.receipt_date || data.expense_date)}</span>
              </div>
              {data.customer_name && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1px' }}>
                  <span>Customer:</span>
                  <span style={{ fontWeight: 800 }}>{data.customer_name}</span>
                </div>
              )}
              {data.mobile_number && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Mobile:</span>
                  <span>{data.mobile_number}</span>
                </div>
              )}
              {type === 'credit_receipt' && data.bill_number && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#000' }}>
                  <span>Against Bill:</span>
                  <span style={{ fontWeight: 800 }}>{data.bill_number}</span>
                </div>
              )}
              {type === 'expense' && data.category && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Category:</span>
                  <span style={{ fontWeight: 800 }}>{data.category}</span>
                </div>
              )}
            </div>

            {/* ── 3. Product / Line Items (For Billing & Pre-booking) ── */}
            {items.length > 0 && (
              <>
                <div style={{ borderTop: '1px dashed #000', margin: '4px 0' }} />
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', borderBottom: '1px dashed #000', padding: '2px 0' }}>Item/Code</th>
                      <th style={{ textAlign: 'center', borderBottom: '1px dashed #000', padding: '2px 0' }}>Qty</th>
                      <th style={{ textAlign: 'right', borderBottom: '1px dashed #000', padding: '2px 0' }}>Rate</th>
                      <th style={{ textAlign: 'right', borderBottom: '1px dashed #000', padding: '2px 0' }}>Amt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, idx) => {
                      const qty = Number(it.pieces || 0);
                      const rate = Number(it.rate_per_piece || 0);
                      const amt = Number(it.line_amount || (qty * rate));
                      const code = it.design_number || (it.stock_uid ? `DSG-${it.stock_uid.slice(0, 4)}` : `Item #${idx + 1}`);

                      return (
                        <tr key={it.uid || idx}>
                          <td style={{ padding: '2px 0', wordBreak: 'break-all' }}>
                            {code} {it.is_home_bill ? '(Home)' : ''}
                          </td>
                          <td style={{ textAlign: 'center', padding: '2px 0' }}>{qty}</td>
                          <td style={{ textAlign: 'right', padding: '2px 0' }}>{inr(rate)}</td>
                          <td style={{ textAlign: 'right', padding: '2px 0', fontWeight: 800 }}>{inr(amt)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </>
            )}

            {/* ── 4. Financial Totals / Amounts Breakdown ── */}
            <div style={{ borderTop: '1px dashed #000', margin: '4px 0' }} />

            <div style={{ fontSize: '10.5px' }}>
              {/* If Billing Bill Totals */}
              {type === 'bill' && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Total Qty:</span>
                    <span>{items.reduce((s, i) => s + Number(i.pieces || 0), 0)} pcs</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Sub Total:</span>
                    <span>₹{inr(data.total_amount || data.grand_total)}</span>
                  </div>
                  {Number(data.discount || 0) > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Discount (-):</span>
                      <span>₹{inr(data.discount)}</span>
                    </div>
                  )}
                  {Number(data.tax_amount || 0) > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>GST / Tax:</span>
                      <span>₹{inr(data.tax_amount)}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: '12px', marginTop: '2px', borderTop: '1px dashed #000', paddingTop: '2px' }}>
                    <span>NET TOTAL:</span>
                    <span>₹{inr(data.grand_total || data.net_amount)}</span>
                  </div>
                  {data.is_home_bill ? (
                    <div style={{ fontSize: '9px', textAlign: 'center', margin: '2px 0', fontStyle: 'italic' }}>
                      * Home Bill (Custom Direct Design) *
                    </div>
                  ) : null}
                </>
              )}

              {/* If Advance / Pre-booking Totals */}
              {(type === 'advance' || type === 'prebook') && (
                <>
                  {items.length > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Reserved Pcs:</span>
                      <span>{items.reduce((s, i) => s + Number(i.pieces || 0), 0)} pcs</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: '12px' }}>
                    <span>ADVANCE PAID:</span>
                    <span>₹{inr(data.amount)}</span>
                  </div>
                  {data.is_converted_to_bill ? (
                    <div style={{ textAlign: 'center', fontSize: '9.5px', fontWeight: 800, margin: '2px 0' }}>
                      [ STATUS: CONVERTED TO SALES BILL ]
                    </div>
                  ) : null}
                </>
              )}

              {/* If Credit Payment Receipt */}
              {type === 'credit_receipt' && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: '12px' }}>
                    <span>AMOUNT RECEIVED:</span>
                    <span>₹{inr(data.amount)}</span>
                  </div>
                  {data.current_due_amount !== undefined && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
                      <span>Remaining Balance Due:</span>
                      <span style={{ fontWeight: 800 }}>₹{inr(data.current_due_amount)}</span>
                    </div>
                  )}
                </>
              )}

              {/* If Expense Voucher */}
              {type === 'expense' && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: '12px' }}>
                  <span>EXPENSE AMOUNT:</span>
                  <span>₹{inr(data.amount)}</span>
                </div>
              )}
            </div>

            {/* ── 5. Payment Details & Denominations ── */}
            <div style={{ borderTop: '1px dashed #000', margin: '4px 0' }} />
            
            <div style={{ fontSize: '10px' }}>
              <div style={{ fontWeight: 900, textTransform: 'uppercase', marginBottom: '2px' }}>
                Payment Details:
              </div>

              {payments.map((p, idx) => {
                const mode = (p.payment_mode || 'cash').toUpperCase();
                const pAmt = Number(p.amount || 0);

                return (
                  <div key={idx} style={{ marginBottom: '3px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>• {mode}:</span>
                      <span style={{ fontWeight: 800 }}>₹{inr(pAmt)}</span>
                    </div>
                    {p.bank_name && (
                      <div style={{ fontSize: '9px', paddingLeft: '8px' }}>
                        Bank: {p.bank_name} {p.bank_code ? `(${p.bank_code})` : ''}
                      </div>
                    )}
                    {p.ref_number && (
                      <div style={{ fontSize: '9px', paddingLeft: '8px' }}>
                        Ref/UTR: {p.ref_number}
                      </div>
                    )}
                    {p.tendered_amount > 0 && (
                      <div style={{ fontSize: '9px', paddingLeft: '8px', display: 'flex', justifyContent: 'space-between' }}>
                        <span>Tendered: ₹{inr(p.tendered_amount)}</span>
                        {p.change_returned > 0 && <span>Change: ₹{inr(p.change_returned)}</span>}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Credit Sale Outstanding Details on Bill */}
              {type === 'bill' && data.is_credit && Number(data.due_amount || 0) > 0 && (
                <div style={{ borderTop: '1px dashed #000', paddingTop: '2px', marginTop: '2px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900 }}>
                    <span>BALANCE DUE:</span>
                    <span>₹{inr(data.due_amount)}</span>
                  </div>
                  {data.due_date && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9.5px' }}>
                      <span>Promised Due Date:</span>
                      <span>{formatDateOnly(data.due_date)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Notes / Narration */}
              {(data.notes || data.narration || data.due_narration) && (
                <div style={{ marginTop: '3px', fontSize: '9.5px', fontStyle: 'italic' }}>
                  Note: {data.notes || data.narration || data.due_narration}
                </div>
              )}
            </div>

            {/* ── 6. Thermal Footer & Thank You ── */}
            <div style={{ borderTop: '1px dashed #000', margin: '4px 0' }} />

            <div style={{ textAlign: 'center', fontSize: '10.5px', marginTop: '4px' }}>
              <div style={{ fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                THANK YOU! VISIT AGAIN
              </div>
              <div style={{ fontSize: '8.5px', marginTop: '2px', color: '#333' }}>
                Software by Inventory ERP
              </div>
            </div>
          </div>
        </div>

        {/* Modal Action Buttons */}
        <div style={{ display: 'flex', gap: '0.65rem', marginTop: '0.85rem', paddingTop: '0.6rem', borderTop: '1px solid #334155' }}>
          <button
            type="button"
            onClick={handlePrint}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.45rem',
              padding: '0.65rem 1rem',
              background: '#2563eb',
              color: '#ffffff',
              border: 'none',
              borderRadius: 8,
              fontWeight: 800,
              fontSize: '0.95rem',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.4)'
            }}
          >
            <span>🖨️</span> Print (58mm Thermal / PDF)
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.65rem 1.2rem',
              background: '#1e293b',
              color: '#cbd5e1',
              border: '1px solid #475569',
              borderRadius: 8,
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: 'pointer'
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
