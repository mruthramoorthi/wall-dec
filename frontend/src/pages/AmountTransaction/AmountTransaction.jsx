import { useEffect, useState } from 'react';
import Pagination from '../../components/Pagination.jsx';
import { amountTransactionReport } from '../../api/report.js';

export default function AmountTransaction() {
  const [rows, setRows] = useState([]);
  const [totals, setTotals] = useState({ total_pieces: 0, total_amount: 0 });
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);

  const load = async (p = page) => {
    const res = await amountTransactionReport(p, pageSize);
    setRows(res.data);
    setTotals(res.totals);
    setTotal(res.total);
    setPage(res.page);
  };

  useEffect(() => { load(1); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="page">
      <h1>Amount Transaction</h1>
      <table className="data-table">
        <thead>
          <tr><th>S.No</th><th>Customer</th><th>Stock codes</th><th>Pieces</th><th>Amount</th></tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr key={r.bill_uid}>
              <td>{(page - 1) * pageSize + idx + 1}</td>
              <td>{r.customer_name} ({r.mobile_number})</td>
              <td>{r.stock_codes}</td>
              <td>{r.total_pieces}</td>
              <td>{Number(r.net_amount).toFixed(2)}</td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={5}>No transactions yet.</td></tr>}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3}><strong>Totals</strong></td>
            <td><strong>{totals.total_pieces}</strong></td>
            <td><strong>{Number(totals.total_amount).toFixed(2)}</strong></td>
          </tr>
        </tfoot>
      </table>
      <Pagination page={page} pageSize={pageSize} total={total} onPageChange={load} />
    </div>
  );
}
