const transactionModel = require('./transactionModel.cjs');

const SORT_COLUMNS = {
  date: 't.transaction_date',
  transaction_date: 't.transaction_date',
  entry_datetime: 't.entry_datetime',
  type: 't.transaction_type',
  transaction_type: 't.transaction_type',
  ref: 't.reference_number',
  reference_number: 't.reference_number',
  party_name: 't.party_name',
  amount: 't.amount',
  payment_mode: 't.payment_mode'
};

async function amountTransaction(params) {
  return transactionModel.listTransactions(params);
}

module.exports = {
  SORT_COLUMNS,
  amountTransaction
};
