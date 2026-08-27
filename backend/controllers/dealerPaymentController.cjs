const dealerPaymentModel = require('../models/dealerPaymentModel.cjs');

async function getDealerCreditPurchases(req, res, next) {
  try {
    const { page, pageSize, search, status, dealer_uid } = req.query;
    const result = await dealerPaymentModel.listDealerCreditPurchases({
      page: Number(page) || 1,
      pageSize: Number(pageSize) || 20,
      search: search || '',
      status: status || 'all',
      dealer_uid: dealer_uid || null
    });
    res.json({ success: true, data: result.rows, total: result.total, page: result.page, pageSize: result.pageSize });
  } catch (err) {
    next(err);
  }
}

async function recordDealerPayment(req, res, next) {
  try {
    const result = await dealerPaymentModel.recordPayment(req.body);
    res.status(201).json({ success: true, message: 'Dealer payment recorded successfully', data: result });
  } catch (err) {
    next(err);
  }
}

async function getDealerPaymentsList(req, res, next) {
  try {
    const { page, pageSize, search, dealer_uid } = req.query;
    const result = await dealerPaymentModel.listDealerPayments({
      page: Number(page) || 1,
      pageSize: Number(pageSize) || 20,
      search: search || '',
      dealer_uid: dealer_uid || null
    });
    res.json({ success: true, data: result.rows, total: result.total, page: result.page, pageSize: result.pageSize });
  } catch (err) {
    next(err);
  }
}

async function deleteDealerPayment(req, res, next) {
  try {
    const { uid } = req.params;
    await dealerPaymentModel.deletePayment(uid);
    res.json({ success: true, message: 'Dealer payment deleted and balance restored' });
  } catch (err) {
    next(err);
  }
}

async function getDealerSummary(req, res, next) {
  try {
    const summary = await dealerPaymentModel.getDealerCreditSummary();
    res.json({ success: true, data: summary });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getDealerCreditPurchases,
  recordDealerPayment,
  getDealerPaymentsList,
  deleteDealerPayment,
  getDealerSummary
};
