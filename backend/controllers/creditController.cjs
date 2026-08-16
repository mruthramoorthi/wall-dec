const creditModel = require('../models/creditModel.cjs');

exports.listCreditBills = async (req, res, next) => {
  try {
    const { page = 1, pageSize = 20, search = '', status = 'all' } = req.query;
    const result = await creditModel.listCreditBills({ page, pageSize, search, status });
    res.json(result);
  } catch (err) { next(err); }
};

exports.getCustomerAdvances = async (req, res, next) => {
  try {
    const { customer_uid } = req.params;
    const result = await creditModel.listCustomerAdvances(customer_uid);
    res.json({ data: result });
  } catch (err) { next(err); }
};

exports.receivePayment = async (req, res, next) => {
  try {
    const result = await creditModel.receivePayment(req.body);
    res.status(201).json({ message: 'Credit payment received successfully!', data: result });
  } catch (err) { next(err); }
};

exports.updateReceipt = async (req, res, next) => {
  try {
    const { uid } = req.params;
    const result = await creditModel.updateReceipt(uid, req.body);
    res.json({ message: 'Credit receipt updated successfully!', data: result });
  } catch (err) { next(err); }
};

exports.deleteReceipt = async (req, res, next) => {
  try {
    const { uid } = req.params;
    const result = await creditModel.deleteReceipt(uid);
    res.json(result);
  } catch (err) { next(err); }
};

exports.listReceipts = async (req, res, next) => {
  try {
    const { page = 1, pageSize = 20, search = '' } = req.query;
    const result = await creditModel.listReceipts({ page, pageSize, search });
    res.json(result);
  } catch (err) { next(err); }
};

exports.getCreditSummary = async (req, res, next) => {
  try {
    const summary = await creditModel.getCreditSummary();
    res.json({ data: summary });
  } catch (err) { next(err); }
};
