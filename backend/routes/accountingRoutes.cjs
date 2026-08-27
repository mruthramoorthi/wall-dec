const express = require('express');
const router = express.Router();
const accountingController = require('../controllers/accountingController.cjs');

// Dashboard metrics
router.get('/dashboard', accountingController.getDashboard);

// Account Types, Groups & Chart of Accounts
router.get('/types', accountingController.getAccountTypes);
router.get('/groups', accountingController.getAccountGroups);
router.get('/chart-of-accounts', accountingController.getChartOfAccounts);
router.get('/chart-of-accounts/:uid', accountingController.getAccountDetail);
router.post('/chart-of-accounts', accountingController.createAccount);
router.put('/chart-of-accounts/:uid', accountingController.updateAccount);

// Journal Entries & Manual Vouchers
router.get('/journal-entries', accountingController.getJournalEntries);
router.get('/journal-entries/:uid', accountingController.getJournalEntryDetail);
router.post('/journal-entries', accountingController.createManualJournal);

// General Ledger (GL)
router.get('/ledger/:accountUid', accountingController.getAccountLedger);

// Accounts Receivable (AR) Hub & Statements
router.get('/ar/aging', accountingController.getARAging);
router.get('/ar/statement/:customerUid', accountingController.getCustomerStatement);

// Financial Statements & 10 Core Accounting Reports
router.get('/reports/day-book', accountingController.getDayBook);
router.get('/reports/cash-book', accountingController.getCashBook);
router.get('/reports/bank-book', accountingController.getBankBook);
router.get('/reports/trial-balance', accountingController.getTrialBalance);
router.get('/reports/profit-loss', accountingController.getProfitAndLoss);
router.get('/reports/balance-sheet', accountingController.getBalanceSheet);
router.get('/reports/receipt-register', accountingController.getReceiptRegister);
router.get('/reports/payment-register', accountingController.getPaymentRegister);
router.get('/reports/journal-register', accountingController.getJournalRegister);

module.exports = router;
