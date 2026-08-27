const accountingModel = require('../models/accountingModel.cjs');

async function getDashboard(req, res, next) {
  try {
    const data = await accountingModel.getAccountingDashboardMetrics();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function getAccountTypes(req, res, next) {
  try {
    const data = await accountingModel.listAccountTypes();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function getAccountGroups(req, res, next) {
  try {
    const data = await accountingModel.listAccountGroups();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function getChartOfAccounts(req, res, next) {
  try {
    const { type, groupUid, search, is_active } = req.query;
    const data = await accountingModel.listChartOfAccounts({ type, groupUid, search, is_active });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function getAccountDetail(req, res, next) {
  try {
    const { uid } = req.params;
    const data = await accountingModel.getAccountByUid(uid);
    if (!data) return res.status(404).json({ success: false, message: 'Account not found' });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function createAccount(req, res, next) {
  try {
    const data = await accountingModel.createAccount(req.body);
    res.status(201).json({ success: true, data, message: 'Account created successfully' });
  } catch (err) {
    next(err);
  }
}

async function updateAccount(req, res, next) {
  try {
    const { uid } = req.params;
    const data = await accountingModel.updateAccount(uid, req.body);
    res.json({ success: true, data, message: 'Account updated successfully' });
  } catch (err) {
    next(err);
  }
}

async function getJournalEntries(req, res, next) {
  try {
    const { page, pageSize, search, voucherType, fromDate, toDate, status } = req.query;
    const data = await accountingModel.listJournalEntries({ page, pageSize, search, voucherType, fromDate, toDate, status });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function getJournalEntryDetail(req, res, next) {
  try {
    const { uid } = req.params;
    const data = await accountingModel.getJournalEntryByUid(uid);
    if (!data) return res.status(404).json({ success: false, message: 'Journal entry not found' });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function createManualJournal(req, res, next) {
  try {
    const userUid = req.user?.uid || null;
    const data = await accountingModel.createManualJournalVoucher({ ...req.body, created_by: userUid });
    res.status(201).json({ success: true, data, message: 'Journal voucher posted successfully' });
  } catch (err) {
    next(err);
  }
}

async function getAccountLedger(req, res, next) {
  try {
    const { accountUid } = req.params;
    const { fromDate, toDate, page, pageSize } = req.query;
    const data = await accountingModel.getAccountLedger({ accountUid, fromDate, toDate, page, pageSize });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function getARAging(req, res, next) {
  try {
    const { asOfDate } = req.query;
    const data = await accountingModel.getARAgingReport({ asOfDate });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function getCustomerStatement(req, res, next) {
  try {
    const { customerUid } = req.params;
    const { fromDate, toDate } = req.query;
    const data = await accountingModel.getCustomerStatement({ customerUid, fromDate, toDate });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function getTrialBalance(req, res, next) {
  try {
    const { asOfDate } = req.query;
    const data = await accountingModel.getTrialBalance({ asOfDate });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function getProfitAndLoss(req, res, next) {
  try {
    const { fromDate, toDate } = req.query;
    const data = await accountingModel.getProfitAndLoss({ fromDate, toDate });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function getBalanceSheet(req, res, next) {
  try {
    const { asOfDate } = req.query;
    const data = await accountingModel.getBalanceSheet({ asOfDate });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function getDayBook(req, res, next) {
  try {
    const { fromDate, toDate, search, voucherType, page, pageSize } = req.query;
    const data = await accountingModel.getDayBook({ fromDate, toDate, search, voucherType, page, pageSize });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function getCashBook(req, res, next) {
  try {
    const { fromDate, toDate, page, pageSize } = req.query;
    const data = await accountingModel.getCashBook({ fromDate, toDate, page, pageSize });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function getBankBook(req, res, next) {
  try {
    const { bankAccountUid, fromDate, toDate, page, pageSize } = req.query;
    const data = await accountingModel.getBankBook({ bankAccountUid, fromDate, toDate, page, pageSize });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function getReceiptRegister(req, res, next) {
  try {
    const { fromDate, toDate, search, page, pageSize } = req.query;
    const data = await accountingModel.getReceiptRegister({ fromDate, toDate, search, page, pageSize });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function getPaymentRegister(req, res, next) {
  try {
    const { fromDate, toDate, search, page, pageSize } = req.query;
    const data = await accountingModel.getPaymentRegister({ fromDate, toDate, search, page, pageSize });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function getJournalRegister(req, res, next) {
  try {
    const { fromDate, toDate, search, voucherType, page, pageSize } = req.query;
    const data = await accountingModel.getJournalRegister({ fromDate, toDate, search, voucherType, page, pageSize });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getDashboard,
  getAccountTypes,
  getAccountGroups,
  getChartOfAccounts,
  getAccountDetail,
  createAccount,
  updateAccount,
  getJournalEntries,
  getJournalEntryDetail,
  createManualJournal,
  getAccountLedger,
  getARAging,
  getCustomerStatement,
  getTrialBalance,
  getProfitAndLoss,
  getBalanceSheet,
  getDayBook,
  getCashBook,
  getBankBook,
  getReceiptRegister,
  getPaymentRegister,
  getJournalRegister
};
