import { useEffect, useState } from 'react';
import NumericInput from '../../components/NumericInput.jsx';
import Pagination from '../../components/Pagination.jsx';
import ImageMatchPicker from '../../components/ImageMatchPicker.jsx';
import { listSizes } from '../../api/size.js';
import { listDealers } from '../../api/dealer.js';
import { listStockInward, createStockInward, deleteStockInward } from '../../api/stockInward.js';

function sizeLabel(s) {
  return `${s.height_ft} x ${s.width_ft} x ${s.thickness_mm}mm`;
}

export default function StockInward() {
  const [sizes, setSizes] = useState([]);
  const [dealers, setDealers] = useState([]);
  const [isOpening, setIsOpening] = useState(false);
  const [dealerUid, setDealerUid] = useState('');
  const [sizeUid, setSizeUid] = useState('');
  const [pieces, setPieces] = useState('');
  const [avgTotalRate, setAvgTotalRate] = useState('');
  const [resolvedImage, setResolvedImage] = useState(null); // { isNewDesign, image_filename }
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);

  const load = async (p = page) => {
    const res = await listStockInward(p, pageSize);
    setRows(res.data);
    setTotal(res.total);
    setPage(res.page);
  };

  useEffect(() => {
    (async () => {
      const [sizeRes, dealerRes] = await Promise.all([listSizes(1, 100), listDealers(1, 100)]);
      setSizes(sizeRes.data);
      setDealers(dealerRes.data);
      await load(1);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const avgRatePerPiece = pieces && avgTotalRate ? (Number(avgTotalRate) / Number(pieces)).toFixed(2) : null;

  const addItem = () => {
    setError(null);
    if (!sizeUid) { setError('Select a size first.'); return; }
    if (!pieces || !avgTotalRate) { setError('Enter pieces and avg total rate.'); return; }
    if (!resolvedImage) { setError('Capture/search a photo first (or confirm new design).'); return; }
    setItems((it) => [...it, {
      key: crypto.randomUUID(),
      size_uid: sizeUid,
      size_label: sizeLabel(sizes.find((s) => s.uid === sizeUid)),
      pieces: Number(pieces),
      avg_total_rate: Number(avgTotalRate),
      avg_rate_per_piece: Number(avgRatePerPiece),
      image_filename: resolvedImage.image_filename,
      design_note: resolvedImage.isNewDesign ? 'New design' : resolvedImage.image_filename,
    }]);
    setSizeUid(''); setPieces(''); setAvgTotalRate(''); setResolvedImage(null);
  };

  const removeItem = (key) => setItems((it) => it.filter((i) => i.key !== key));

  const saveAll = async () => {
    setError(null);
    if (!isOpening && !dealerUid) { setError('Select a dealer, or tick Opening.'); return; }
    if (items.length === 0) { setError('Add at least one item.'); return; }
    setSaving(true);
    try {
      await createStockInward({
        is_opening: isOpening,
        dealer_uid: isOpening ? null : dealerUid,
        items: items.map(({ size_uid, pieces, avg_total_rate, image_filename }) => ({ size_uid, pieces, avg_total_rate, image_filename })),
      });
      setItems([]);
      setDealerUid(''); setIsOpening(false);
      await load(1);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const removeRow = async (uid) => {
    if (!confirm('Delete this stock inward line?')) return;
    await deleteStockInward(uid);
    await load(page);
  };

  return (
    <div className="page">
      <h1>Stock Inward</h1>

      <div className="form-row">
        <label className="checkbox-label">
          <input type="checkbox" checked={isOpening} onChange={(e) => { setIsOpening(e.target.checked); setDealerUid(''); }} />
          Opening
        </label>
        {!isOpening && (
          <label>
            Dealer
            <select value={dealerUid} onChange={(e) => setDealerUid(e.target.value)}>
              <option value="">Select dealer…</option>
              {dealers.map((d) => <option key={d.uid} value={d.uid}>{d.dealer_name} ({d.dealer_code})</option>)}
            </select>
          </label>
        )}
      </div>

      <div className="card">
        <h3>Add item</h3>
        <div className="form-row">
          <label>
            Size
            <select value={sizeUid} onChange={(e) => setSizeUid(e.target.value)}>
              <option value="">Select size…</option>
              {sizes.map((s) => <option key={s.uid} value={s.uid}>{sizeLabel(s)}</option>)}
            </select>
          </label>
          <label>
            Pieces
            <NumericInput value={pieces} onChange={setPieces} />
          </label>
          <label>
            Avg total rate
            <NumericInput value={avgTotalRate} onChange={setAvgTotalRate} />
          </label>
          <div>Avg rate / piece: <strong>{avgRatePerPiece ?? '-'}</strong></div>
        </div>

        <ImageMatchPicker autoStartCamera={false} onResolved={setResolvedImage} />
        {resolvedImage && (
          <div className="resolved-image">
            Tagged as: {resolvedImage.isNewDesign ? 'New design' : resolvedImage.image_filename}
          </div>
        )}

        <button type="button" onClick={addItem}>Add item</button>
      </div>

      {items.length > 0 && (
        <table className="data-table">
          <thead><tr><th>Size</th><th>Pieces</th><th>Avg total rate</th><th>Rate/piece</th><th>Design</th><th></th></tr></thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.key}>
                <td>{i.size_label}</td><td>{i.pieces}</td><td>{i.avg_total_rate}</td>
                <td>{i.avg_rate_per_piece}</td><td>{i.design_note}</td>
                <td><button onClick={() => removeItem(i.key)}>Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {error && <div className="field-error">{error}</div>}
      <button type="button" onClick={saveAll} disabled={saving || items.length === 0}>Save all items</button>

      <h2>Stock Inward History</h2>
      <table className="data-table">
        <thead><tr><th>Design #</th><th>Size</th><th>Dealer/Opening</th><th>Pieces</th><th>Avg rate</th><th>Rate/piece</th><th>Entry Date</th><th></th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.uid}>
              <td>{r.design_number}</td>
              <td>{r.height_ft} x {r.width_ft} x {r.thickness_mm}mm</td>
              <td>{r.is_opening ? 'Opening' : r.dealer_uid}</td>
              <td>{r.pieces}</td><td>{r.avg_total_rate}</td><td>{r.avg_rate_per_piece}</td>
              <td>{new Date(r.entry_datetime).toLocaleString()}</td>
              <td><button onClick={() => removeRow(r.uid)}>Delete</button></td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={8}>No stock inward entries yet.</td></tr>}
        </tbody>
      </table>
      <Pagination page={page} pageSize={pageSize} total={total} onPageChange={load} />
    </div>
  );
}
