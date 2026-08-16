const PDFDocument = require('pdfkit');
const companyModel = require('../models/companyModel.cjs');
const billModel = require('../models/billModel.cjs');
const advanceModel = require('../models/advanceModel.cjs');
const creditModel = require('../models/creditModel.cjs');
const expenseModel = require('../models/expenseModel.cjs');
const pool = require('../config/db.cjs');

// Format Currency
function fmtCurr(val) {
  const num = Number(val || 0);
  return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Format Date & Time
function fmtDateTime(dtStr) {
  if (!dtStr) return '—';
  const d = new Date(dtStr);
  if (isNaN(d.getTime())) return String(dtStr);
  const day = String(d.getDate()).padStart(2, '0');
  const mon = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  let hours = d.getHours();
  const mins = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${day}/${mon}/${year} ${String(hours).padStart(2, '0')}:${mins} ${ampm}`;
}

// Draw Dashed Line across 58mm roll (width ~164pt)
function drawDashedDivider(doc, y) {
  doc.save()
    .dash(2, { space: 2 })
    .moveTo(5, y)
    .lineTo(159, y)
    .strokeColor('#000000')
    .lineWidth(0.6)
    .stroke()
    .undash()
    .restore();
}

/**
 * Controller to generate and stream 58mm Thermal Receipt PDF
 */
async function generateReceiptPdf(req, res) {
  try {
    const { type = 'bill', uid } = req.query;

    if (!uid) {
      return res.status(400).send('UID is required to generate receipt PDF.');
    }

    // 1. Fetch Company Info
    const company = await companyModel.get();

    // 2. Fetch Document Info based on type
    let docTitle = 'TAX INVOICE';
    let docNumberLabel = 'Bill No';
    let docNumberValue = '—';
    let docDateTime = null;
    let customerName = null;
    let mobileNumber = null;
    let items = [];
    let payments = [];
    let totalQty = 0;
    let subTotal = 0;
    let discount = 0;
    let taxAmount = 0;
    let grandTotal = 0;
    let dueAmount = null;
    let dueDate = null;
    let creditStatus = null;
    let category = null;
    let narration = null;
    let againstBillNumber = null;

    if (type === 'bill') {
      const bill = await billModel.findByUid(uid);
      if (!bill) return res.status(404).send('Bill not found.');

      docTitle = bill.is_home_bill ? 'ESTIMATION INVOICE' : 'TAX INVOICE';
      docNumberLabel = 'Bill No';
      docNumberValue = bill.bill_number || `BILL-${String(bill.id || 1).padStart(4, '0')}`;
      docDateTime = bill.entry_datetime;
      customerName = bill.customer_name;
      mobileNumber = bill.mobile_number;
      items = bill.items || [];
      payments = bill.payments || [];
      subTotal = Number(bill.total_amount || 0);
      discount = Number(bill.discount || 0);
      taxAmount = Number(bill.tax_amount || 0);
      grandTotal = Number(bill.grand_total || 0);
      totalQty = items.reduce((s, it) => s + Number(it.pieces || 0), 0);

      if (bill.is_credit) {
        dueAmount = Number(bill.due_amount || 0);
        dueDate = bill.due_date;
        creditStatus = bill.credit_status;
      }
      narration = bill.due_narration || null;
    } else if (type === 'advance') {
      const adv = await advanceModel.findByUid(uid);
      if (!adv) return res.status(404).send('Advance voucher not found.');

      docTitle = adv.is_prebook ? 'PRE-BOOKING VOUCHER' : 'ADVANCE RECEIPT';
      docNumberLabel = adv.is_prebook ? 'Pre-Book Code' : 'Advance Ref';
      docNumberValue = adv.prebook_code || `ADV-${String(adv.id || 1).padStart(4, '0')}`;
      docDateTime = adv.entry_datetime || adv.transaction_date;
      customerName = adv.customer_name;
      mobileNumber = adv.mobile_number;
      grandTotal = Number(adv.amount || 0);
      items = (adv.items || []).map((it) => ({
        design_number: it.design_number,
        pieces: it.pieces,
        rate_per_piece: it.rate_per_piece,
        line_amount: it.line_amount
      }));
      totalQty = items.reduce((s, it) => s + Number(it.pieces || 0), 0);

      payments = [{
        payment_mode: adv.payment_mode,
        amount: adv.amount,
        ref_number: adv.ref_number,
        bank_name: adv.bank_name,
        bank_code: adv.bank_code,
        tendered_amount: adv.tendered_amount,
        change_returned: adv.change_returned
      }];
      narration = adv.notes || null;
    } else if (type === 'credit' || type === 'credit_receipt') {
      const [[receipt]] = await pool.query(
        `SELECT cr.*, c.customer_name, c.mobile_number, b.id AS bill_id, bm.bank_name, bm.bank_code
         FROM credit_receipts cr
         JOIN customer_master c ON c.uid = cr.customer_uid
         JOIN bill_master b ON b.uid = cr.bill_uid
         LEFT JOIN bank_master bm ON bm.uid = cr.bank_uid
         WHERE cr.uid = ? AND cr.delete_datetime IS NULL`,
        [uid]
      );
      if (!receipt) return res.status(404).send('Credit receipt not found.');

      docTitle = 'CREDIT PAYMENT RECEIPT';
      docNumberLabel = 'Receipt No';
      docNumberValue = `CR-${String(receipt.id || 1).padStart(4, '0')}`;
      docDateTime = receipt.receipt_date || receipt.entry_datetime;
      customerName = receipt.customer_name;
      mobileNumber = receipt.mobile_number;
      againstBillNumber = `BILL-${String(receipt.bill_id || 1).padStart(4, '0')}`;
      grandTotal = Number(receipt.amount || 0);

      payments = [{
        payment_mode: receipt.payment_mode,
        amount: receipt.amount,
        ref_number: receipt.ref_number,
        bank_name: receipt.bank_name,
        bank_code: receipt.bank_code,
        tendered_amount: receipt.tendered_amount,
        change_returned: receipt.change_returned
      }];
      narration = receipt.narration || null;
    } else if (type === 'expense') {
      const exp = await expenseModel.findByUid(uid);
      if (!exp) return res.status(404).send('Expense record not found.');

      docTitle = 'EXPENSE PAYMENT VOUCHER';
      docNumberLabel = 'Voucher No';
      docNumberValue = exp.expense_number || `EXP-${String(exp.id || 1).padStart(4, '0')}`;
      docDateTime = exp.expense_date || exp.entry_datetime;
      category = exp.category;
      grandTotal = Number(exp.amount || 0);

      payments = [{
        payment_mode: exp.payment_mode,
        amount: exp.amount,
        ref_number: exp.ref_number,
        bank_name: exp.bank_name,
        bank_code: exp.bank_code,
        tendered_amount: exp.tendered_amount,
        change_returned: exp.change_returned
      }];
      narration = exp.narration || null;
    }

    // Calculate required height for 58mm continuous roll (points)
    // 58mm width = 164.41 points
    const PAGE_WIDTH = 164.41;
    let estHeight = 120; // Company header + Title
    estHeight += 45; // Meta info (Date, customer, mobile)
    if (againstBillNumber || category) estHeight += 12;
    if (items.length > 0) {
      estHeight += 20 + items.length * 13; // Table headers + rows
      estHeight += 40; // Totals
    }
    estHeight += 15 + Math.max(1, payments.length) * 14; // Payments
    if (dueAmount !== null) estHeight += 24;
    if (narration) estHeight += 18;
    estHeight += 45; // Footer

    const finalHeight = Math.max(220, Math.ceil(estHeight));

    // Create 58mm PDF Document
    const doc = new PDFDocument({
      size: [PAGE_WIDTH, finalHeight],
      margins: { top: 6, bottom: 6, left: 5, right: 5 },
      autoFirstPage: true
    });

    // Stream PDF Response
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${docTitle.toLowerCase().replace(/\s+/g, '_')}_${docNumberValue}.pdf"`
    );
    doc.pipe(res);

    const PRINTABLE_W = PAGE_WIDTH - 10; // 154.41 pt
    let currY = 6;

    // ── 1. Company Header ──
    const compName = (company?.company_name || 'A3 WALL DECOR').toUpperCase();
    doc.font('Helvetica-Bold').fontSize(9).text(compName, 5, currY, { width: PRINTABLE_W, align: 'center' });
    currY = doc.y + 1;

    if (company?.address) {
      const addrStr = `${company.address}${company.city ? ', ' + company.city : ''}${company.pincode ? ' - ' + company.pincode : ''}`;
      doc.font('Helvetica').fontSize(6.5).text(addrStr, 5, currY, { width: PRINTABLE_W, align: 'center' });
      currY = doc.y + 1;
    }

    if (company?.mobile_number) {
      doc.font('Helvetica').fontSize(6.5).text(`Ph: ${company.mobile_number}`, 5, currY, { width: PRINTABLE_W, align: 'center' });
      currY = doc.y + 1;
    }

    if (company?.is_gst_registered && company?.gstin) {
      doc.font('Helvetica-Bold').fontSize(6.5).text(`GSTIN: ${company.gstin}`, 5, currY, { width: PRINTABLE_W, align: 'center' });
      currY = doc.y + 1;
    }

    currY += 2;
    drawDashedDivider(doc, currY);
    currY += 4;

    // ── 2. Voucher Title ──
    doc.font('Helvetica-Bold').fontSize(8).text(`*** ${docTitle} ***`, 5, currY, { width: PRINTABLE_W, align: 'center' });
    currY = doc.y + 2;
    drawDashedDivider(doc, currY);
    currY += 4;

    // ── 3. Meta Information ──
    doc.font('Helvetica-Bold').fontSize(7);
    doc.text(`${docNumberLabel}:`, 5, currY);
    doc.text(docNumberValue, 5, currY, { width: PRINTABLE_W, align: 'right' });
    currY = doc.y + 2;

    doc.font('Helvetica').fontSize(6.8);
    doc.text('Date:', 5, currY);
    doc.text(fmtDateTime(docDateTime), 5, currY, { width: PRINTABLE_W, align: 'right' });
    currY = doc.y + 2;

    if (customerName) {
      doc.text('Customer:', 5, currY);
      doc.font('Helvetica-Bold').text(customerName, 5, currY, { width: PRINTABLE_W, align: 'right' });
      doc.font('Helvetica');
      currY = doc.y + 2;
    }

    if (mobileNumber) {
      doc.text('Mobile:', 5, currY);
      doc.text(mobileNumber, 5, currY, { width: PRINTABLE_W, align: 'right' });
      currY = doc.y + 2;
    }

    if (againstBillNumber) {
      doc.text('Against Bill:', 5, currY);
      doc.font('Helvetica-Bold').text(againstBillNumber, 5, currY, { width: PRINTABLE_W, align: 'right' });
      doc.font('Helvetica');
      currY = doc.y + 2;
    }

    if (category) {
      doc.text('Category:', 5, currY);
      doc.font('Helvetica-Bold').text(category, 5, currY, { width: PRINTABLE_W, align: 'right' });
      doc.font('Helvetica');
      currY = doc.y + 2;
    }

    // ── 4. Item Table (For Bill & Pre-book) ──
    if (items.length > 0) {
      currY += 2;
      drawDashedDivider(doc, currY);
      currY += 3;

      // Table Header: Item/Code (58pt) | Qty (22pt) | Rate (35pt) | Amt (39pt)
      doc.font('Helvetica-Bold').fontSize(6.5);
      doc.text('Item/Code', 5, currY, { width: 58 });
      doc.text('Qty', 63, currY, { width: 22, align: 'center' });
      doc.text('Rate', 85, currY, { width: 33, align: 'right' });
      doc.text('Amt', 118, currY, { width: 41, align: 'right' });
      currY = doc.y + 2;
      drawDashedDivider(doc, currY);
      currY += 3;

      doc.font('Helvetica').fontSize(6.5);
      items.forEach((it, idx) => {
        const code = it.design_number || `Item #${idx + 1}`;
        const qty = String(it.pieces || 0);
        const rate = fmtCurr(it.rate_per_piece || 0);
        const amt = fmtCurr(it.line_amount || (Number(qty) * Number(it.rate_per_piece || 0)));

        const rowY = currY;
        doc.text(code, 5, rowY, { width: 58, lineBreak: false });
        doc.text(qty, 63, rowY, { width: 22, align: 'center' });
        doc.text(rate, 85, rowY, { width: 33, align: 'right' });
        doc.text(amt, 118, rowY, { width: 41, align: 'right' });
        currY = doc.y + 2;
      });

      currY += 1;
      drawDashedDivider(doc, currY);
      currY += 3;

      // Totals
      doc.font('Helvetica').fontSize(6.8);
      doc.text('Total Qty:', 5, currY);
      doc.text(`${totalQty} pcs`, 5, currY, { width: PRINTABLE_W, align: 'right' });
      currY = doc.y + 2;

      if (discount > 0) {
        doc.text('Sub Total:', 5, currY);
        doc.text(`Rs. ${fmtCurr(subTotal)}`, 5, currY, { width: PRINTABLE_W, align: 'right' });
        currY = doc.y + 2;

        doc.text('Discount:', 5, currY);
        doc.text(`-Rs. ${fmtCurr(discount)}`, 5, currY, { width: PRINTABLE_W, align: 'right' });
        currY = doc.y + 2;
      }

      if (taxAmount > 0) {
        doc.text('Tax (GST):', 5, currY);
        doc.text(`Rs. ${fmtCurr(taxAmount)}`, 5, currY, { width: PRINTABLE_W, align: 'right' });
        currY = doc.y + 2;
      }
    }

    // ── 5. Net Total ──
    currY += 2;
    drawDashedDivider(doc, currY);
    currY += 3;

    doc.font('Helvetica-Bold').fontSize(8.5);
    doc.text('TOTAL:', 5, currY);
    doc.text(`Rs. ${fmtCurr(grandTotal)}`, 5, currY, { width: PRINTABLE_W, align: 'right' });
    currY = doc.y + 2;

    // ── 6. Payment Information ──
    currY += 2;
    drawDashedDivider(doc, currY);
    currY += 3;

    doc.font('Helvetica-Bold').fontSize(7).text('PAYMENT DETAILS:', 5, currY);
    currY = doc.y + 2;

    doc.font('Helvetica').fontSize(6.8);
    if (payments.length > 0) {
      payments.forEach((p) => {
        const modeName = (p.payment_mode || 'Cash').toUpperCase();
        const pAmt = `Rs. ${fmtCurr(p.amount || grandTotal)}`;
        doc.text(`• ${modeName}:`, 5, currY);
        doc.font('Helvetica-Bold').text(pAmt, 5, currY, { width: PRINTABLE_W, align: 'right' });
        doc.font('Helvetica');
        currY = doc.y + 2;

        if (p.bank_name) {
          doc.fontSize(6).text(`  Bank: ${p.bank_name}`, 5, currY);
          currY = doc.y + 1;
        }
        if (p.ref_number) {
          doc.fontSize(6).text(`  Ref/Txn: ${p.ref_number}`, 5, currY);
          currY = doc.y + 1;
        }
        if (p.tendered_amount > 0 && p.change_returned > 0) {
          doc.fontSize(6).text(`  Tendered: Rs. ${fmtCurr(p.tendered_amount)} | Change: Rs. ${fmtCurr(p.change_returned)}`, 5, currY);
          currY = doc.y + 1;
        }
      });
    } else {
      doc.text('• CASH:', 5, currY);
      doc.text(`Rs. ${fmtCurr(grandTotal)}`, 5, currY, { width: PRINTABLE_W, align: 'right' });
      currY = doc.y + 2;
    }

    // Due / Balance Info if Credit Bill
    if (dueAmount !== null && dueAmount > 0) {
      currY += 2;
      drawDashedDivider(doc, currY);
      currY += 3;
      doc.font('Helvetica-Bold').fontSize(7.2);
      doc.text('BALANCE DUE:', 5, currY);
      doc.text(`Rs. ${fmtCurr(dueAmount)}`, 5, currY, { width: PRINTABLE_W, align: 'right' });
      currY = doc.y + 2;
      if (dueDate) {
        doc.font('Helvetica').fontSize(6.5);
        doc.text(`Due Date: ${dueDate}`, 5, currY);
        currY = doc.y + 2;
      }
    }

    if (narration) {
      doc.font('Helvetica').fontSize(6).text(`Note: ${narration}`, 5, currY, { width: PRINTABLE_W });
      currY = doc.y + 2;
    }

    // ── 7. Footer ──
    currY += 3;
    drawDashedDivider(doc, currY);
    currY += 4;

    if (type !== 'expense') {
      doc.font('Helvetica-Bold').fontSize(7.5).text('THANK YOU! VISIT AGAIN', 5, currY, { width: PRINTABLE_W, align: 'center' });
      currY = doc.y + 1;
    }

    doc.font('Helvetica').fontSize(6).text('Software by Inventory ERP', 5, currY, { width: PRINTABLE_W, align: 'center' });

    // End Document
    doc.end();
  } catch (err) {
    console.error('PDF Generation Error:', err);
    res.status(500).send(`Failed to generate PDF: ${err.message}`);
  }
}

module.exports = {
  generateReceiptPdf
};
