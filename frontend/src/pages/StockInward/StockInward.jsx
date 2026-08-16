import { useEffect, useState } from 'react';
import NumericInput from '../../components/NumericInput.jsx';
import SearchableSelect from '../../components/SearchableSelect.jsx';
import SortableHeader from '../../components/SortableHeader.jsx';
import ImageMatchPicker from '../../components/ImageMatchPicker.jsx';
import { listSizes } from '../../api/size.js';
import { listDealers } from '../../api/dealer.js';
import { listStockInward, createStockInward, updateStockInward, deleteStockInward } from '../../api/stockInward.js';
import ColumnVisibility, { useColumnVisibility } from '../../components/ColumnVisibility.jsx';
import { TableContainer } from '../../components/TableLoadingOverlay.jsx';

const STOCK_INWARD_COLS = [
  { key: 'sno', label: 'S.No', defaultVisible: true },
  { key: 'picture', label: 'Picture', defaultVisible: true },
  { key: 'design_no', label: 'Design #', defaultVisible: true },
  { key: 'size', label: 'Size', defaultVisible: true },
  { key: 'dealer', label: 'Dealer/Opening', defaultVisible: true },
  { key: 'pieces', label: 'Pieces', defaultVisible: true },
  { key: 'avg_purchase', label: 'Avg Purchase', defaultVisible: true },
  { key: 'purchase_per_pc', label: 'Purchase/pc', defaultVisible: true },
  { key: 'sales_per_pc', label: 'Sales/pc', defaultVisible: true },
  { key: 'entry_date', label: 'Entry Date', defaultVisible: true },
  { key: 'actions', label: 'Actions', defaultVisible: true }
];

function sizeLabel(s) {
  return `${s.height_ft} x ${s.width_ft} x ${s.thickness_mm}mm`;
}

/* ── Indian number formatter ────────────────────────────── */
const inr = (n) =>
  Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ── SVG icon helpers ─────────────────────────────────────── */
const IconEdit = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);
const IconTrash = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6"/><path d="M14 11v6"/>
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
);

/* ── Image Lightbox Popup Modal ──────────────────────────── */
function LightboxModal({ image, onClose }) {
  if (!image) return null;
  return (
    <div className="modal-overlay" onClick={onClose} style={{ backdropFilter: 'blur(6px)', zIndex: 1000 }}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px', width: '90%', padding: '1.25rem', textAlign: 'center', position: 'relative' }}>
        <button
          type="button"
          onClick={onClose}
          style={{ position: 'absolute', top: 12, right: 12, background: '#f1f5f9', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', fontSize: '1.1rem', fontWeight: 'bold', color: '#64748b' }}
        >
          ✕
        </button>
        <h3 style={{ marginBottom: '0.75rem', fontSize: '1.05rem', color: '#1e293b' }}>{image.title || 'Product Image Preview'}</h3>
        <img
          src={image.url}
          alt={image.title || 'Product Preview'}
          style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: 8, border: '1px solid #cbd5e1', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
        />
      </div>
    </div>
  );
}

/* ── Delete Confirmation Modal ────────────────────────────── */
function DeleteModal({ onConfirm, onCancel }) {
  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <div className="modal-icon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
            stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="40" height="40">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6"/><path d="M14 11v6"/>
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
          </svg>
        </div>
        <h3 className="modal-title">Delete Entry?</h3>
        <p className="modal-msg">This action cannot be undone. Are you sure you want to delete this stock inward record?</p>
        <div className="modal-actions">
          <button className="btn-cancel" onClick={onCancel}>Cancel</button>
          <button className="btn-confirm-delete" onClick={onConfirm}>Yes, Delete</button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Component ───────────────────────────────────────── */
export default function StockInward() {
  const [sizes, setSizes]                 = useState([]);
  const [dealers, setDealers]             = useState([]);
  const [isOpening, setIsOpening]         = useState(false);
  const [dealerUid, setDealerUid]         = useState('');
  const [sizeUid, setSizeUid]             = useState('');
  const [pieces, setPieces]               = useState('');
  const [avgTotalRate, setAvgTotalRate]   = useState('');
  const [sellingPricePerPiece, setSellingPricePerPiece] = useState('');
  const [resolvedImage, setResolvedImage] = useState(null);
  const [pickerKey, setPickerKey]           = useState(0);
  const [items, setItems]                 = useState([]);
  const [editingStagedKey, setEditingStagedKey] = useState(null);
  const [error, setError]                 = useState(null);
  const [saving, setSaving]               = useState(false);

  const [rows, setRows]                   = useState([]);
  const [page, setPage]                   = useState(1);
  const [pageSize, setPageSize]           = useState(10);
  const [total, setTotal]                 = useState(0);
  const [search, setSearch]               = useState('');
  const [sortBy, setSortBy]               = useState('entry_datetime');
  const [sortDir, setSortDir]             = useState('desc');
  const [loading, setLoading]             = useState(false);

  const { visibleColumns, toggleColumn, resetColumns, isVisible } = useColumnVisibility(
    'stock_inward_columns',
    STOCK_INWARD_COLS
  );

  /* ── In-place Editing & Lightbox State ── */
  const [editingUid, setEditingUid]       = useState(null); // uid of row being edited
  const [deleteUid, setDeleteUid]         = useState(null); // uid awaiting delete
  const [lightbox, setLightbox]           = useState(null); // { url, title }

  const load = async (p = page, opts = {}) => {
    setLoading(true);
    try {
      const q  = opts.q        ?? search;
      const sb = opts.sortBy   ?? sortBy;
      const sd = opts.sortDir  ?? sortDir;
      const ps = opts.pageSize ?? pageSize;
      const res = await listStockInward(p, ps, { q, sortBy: sb, sortDir: sd });
      setRows(res.data || []);
      setTotal(res.total || 0);
      setPage(res.page || 1);
    } catch (err) {
      console.error('Failed to load stock inward:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      const [sizeRes, dealerRes] = await Promise.all([listSizes(1, 100), listDealers(1, 100)]);
      setSizes(sizeRes.data || []);
      setDealers(dealerRes.data || []);
      await load(1);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const t = setTimeout(() => load(1, { q: search }), 300);
    return () => clearTimeout(t);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSort = (key, dir) => {
    if (loading) return;
    setSortBy(key); setSortDir(dir);
    load(1, { sortBy: key, sortDir: dir });
  };

  const handlePageSizeChange = (e) => {
    const ps = Number(e.target.value);
    setPageSize(ps);
    load(1, { pageSize: ps });
  };

  const avgRatePerPiece = pieces && avgTotalRate
    ? (Number(avgTotalRate) / Number(pieces)).toFixed(2) : null;

  /* Add or update a staged item */
  const addOrUpdateItem = () => {
    setError(null);
    if (!sizeUid) { setError('Select a size first.'); return; }
    if (!pieces || !avgTotalRate) { setError('Enter pieces and avg total rate.'); return; }
    if (!sellingPricePerPiece) { setError('Enter sales rate / piece.'); return; }
    if (!resolvedImage) { setError('Capture/upload a photo first (or confirm new design).'); return; }

    const targetSize = sizes.find((s) => s.uid === sizeUid);
    const itemData = {
      size_uid: sizeUid,
      size_label: sizeLabel(targetSize),
      pieces: Number(pieces),
      avg_total_rate: Number(avgTotalRate),
      avg_rate_per_piece: Number(avgRatePerPiece),
      selling_price_per_piece: sellingPricePerPiece ? Number(sellingPricePerPiece) : null,
      image_filename: resolvedImage.image_filename,
      preview_url: resolvedImage.previewUrl || (resolvedImage.image_filename ? `/images/${resolvedImage.image_filename}` : null),
      design_note: resolvedImage.isNewDesign
        ? 'New design'
        : (resolvedImage.design_number ? `Design #${resolvedImage.design_number}` : 'Existing design'),
    };

    if (editingStagedKey) {
      /* Update existing staged item */
      setItems((it) => it.map((i) => i.key === editingStagedKey ? { ...i, ...itemData } : i));
      setEditingStagedKey(null);
    } else {
      /* Add new staged item */
      setItems((it) => [...it, { key: crypto.randomUUID(), ...itemData }]);
    }

    // Reset item input fields AND image — the image is already saved in the staged item
    setSizeUid(''); setPieces(''); setAvgTotalRate(''); setSellingPricePerPiece('');
    setResolvedImage(null);
    setPickerKey((k) => k + 1);
  };

  /* Edit a staged item */
  const editStagedItem = (key) => {
    const item = items.find((i) => i.key === key);
    if (!item) return;
    setSizeUid(item.size_uid);
    setPieces(String(item.pieces));
    setAvgTotalRate(String(item.avg_total_rate));
    setSellingPricePerPiece(item.selling_price_per_piece ? String(item.selling_price_per_piece) : '');
    setEditingStagedKey(key);
  };

  const cancelStagedEdit = () => {
    setEditingStagedKey(null);
    setSizeUid(''); setPieces(''); setAvgTotalRate(''); setSellingPricePerPiece('');
  };

  const removeItem = (key) => {
    setItems((it) => it.filter((i) => i.key !== key));
    if (editingStagedKey === key) cancelStagedEdit();
  };

  const saveAll = async () => {
    setError(null);
    if (!isOpening && !dealerUid) { setError('Select a dealer, or tick Opening.'); return; }
    if (items.length === 0) { setError('Add at least one item.'); return; }
    setSaving(true);
    try {
      if (editingUid) {
        /* In editing mode: update existing record if present in items, and create any newly added items */
        const existingItem = items.find((i) => i.isExisting && i.uid === editingUid);
        if (existingItem) {
          await updateStockInward(editingUid, {
            size_uid: existingItem.size_uid,
            pieces: existingItem.pieces,
            avg_total_rate: existingItem.avg_total_rate,
            selling_price_per_piece: existingItem.selling_price_per_piece || null,
          });
        }
        const newItems = items.filter((i) => !i.isExisting);
        if (newItems.length > 0) {
          await createStockInward({
            is_opening: isOpening,
            dealer_uid: isOpening ? null : dealerUid,
            items: newItems.map(({ size_uid, pieces, avg_total_rate, selling_price_per_piece, image_filename }) =>
              ({ size_uid, pieces, avg_total_rate, selling_price_per_piece, image_filename })),
          });
        }
        cancelEdit();
        await load(page);
      } else {
        /* Standard Batch creation */
        await createStockInward({
          is_opening: isOpening,
          dealer_uid: isOpening ? null : dealerUid,
          items: items.map(({ size_uid, pieces, avg_total_rate, selling_price_per_piece, image_filename }) =>
            ({ size_uid, pieces, avg_total_rate, selling_price_per_piece, image_filename })),
        });
        setItems([]);
        setSizeUid(''); setPieces(''); setAvgTotalRate(''); setSellingPricePerPiece('');
        setResolvedImage(null);
        setPickerKey((k) => k + 1);
        await load(1);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  /* ── Start In-Place History Editing ── */
  const startEdit = (r) => {
    setError(null);
    setIsOpening(Boolean(r.is_opening));
    setDealerUid(r.is_opening ? '' : (r.dealer_uid || ''));
    setEditingUid(r.uid);
    setEditingStagedKey(null);

    const targetSize = sizes.find((s) => s.uid === r.size_uid);
    const existingStagedItem = {
      key: crypto.randomUUID(),
      uid: r.uid,
      isExisting: true,
      size_uid: r.size_uid,
      size_label: targetSize ? sizeLabel(targetSize) : `${r.width_ft} x ${r.height_ft} x ${r.thickness_mm}mm`,
      pieces: Number(r.pieces),
      avg_total_rate: Number(r.avg_total_rate),
      avg_rate_per_piece: Number(r.avg_rate_per_piece),
      selling_price_per_piece: r.selling_price_per_piece ? Number(r.selling_price_per_piece) : null,
      image_filename: r.image_filename,
      preview_url: r.image_filename ? `/images/${r.image_filename}` : null,
      design_note: r.design_number ? `Design #${r.design_number}` : 'Existing design',
    };

    setItems([existingStagedItem]);

    const initialTag = {
      isNewDesign: false,
      image_filename: r.image_filename,
      design_number: r.design_number ? `Design #${r.design_number}` : null,
      previewUrl: r.image_filename ? `/images/${r.image_filename}` : null,
    };
    setResolvedImage(initialTag);
    setPickerKey((k) => k + 1);

    // Clear item inputs so user can add additional items immediately or edit the staged item
    setSizeUid(''); setPieces(''); setAvgTotalRate(''); setSellingPricePerPiece('');

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingUid(null);
    setEditingStagedKey(null);
    setItems([]);
    setSizeUid(''); setPieces(''); setAvgTotalRate(''); setSellingPricePerPiece('');
    setDealerUid(''); setIsOpening(false); setError(null);
    setResolvedImage(null);
    setPickerKey((k) => k + 1);
  };

  const confirmDelete = async () => {
    if (!deleteUid) return;
    await deleteStockInward(deleteUid);
    setDeleteUid(null);
    if (editingUid === deleteUid) cancelEdit();
    await load(page);
  };

  /* Pagination helpers */
  const totalPages  = Math.max(Math.ceil(total / pageSize), 1);
  const startRecord = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRecord   = Math.min(page * pageSize, total);

  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
    .reduce((acc, p, idx, arr) => {
      if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...');
      acc.push(p);
      return acc;
    }, []);

  const editingRow = rows.find(r => r.uid === editingUid);

  return (
    <div className="page">
      <h1>Stock Inward</h1>

      {/* ── Editing Header Alert ── */}
      {editingUid && (
        <div style={{ background: '#e0f2fe', border: '1px solid #7dd3fc', color: '#0369a1', padding: '0.75rem 1rem', borderRadius: 8, marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 600 }}>
          <span>✏️ Editing Stock Inward Entry {editingRow?.design_number ? `— Design #${editingRow.design_number}` : ''}</span>
          <button type="button" onClick={cancelEdit} style={{ background: '#0284c7', color: '#fff', border: 'none', padding: '0.35rem 0.85rem', borderRadius: 6, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
            Cancel editing
          </button>
        </div>
      )}

      {/* ── Entry form ── */}
      <div className="form-row">
        <label className="checkbox-label">
          <input type="checkbox" checked={isOpening} onChange={(e) => setIsOpening(e.target.checked)} />
          Opening
        </label>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', marginBottom: '0.25rem' }}>
            Dealer {isOpening ? <span style={{ color: '#64748b', fontWeight: 400 }}>(Optional)</span> : <span style={{ color: '#ef4444' }}>*</span>}
          </label>
          <SearchableSelect
            options={dealers.map((d) => ({
              value: d.uid,
              label: d.dealer_name,
              sublabel: d.dealer_code ? `Code: ${d.dealer_code}` : ''
            }))}
            value={dealerUid}
            onChange={(val) => setDealerUid(val)}
            placeholder={isOpening ? 'Select dealer (optional)…' : 'Select dealer…'}
            disabled={isOpening}
          />
        </div>
      </div>

      <div className="card">
        <h3>{editingStagedKey ? 'Edit staged item' : 'Add item'}</h3>
        <div className="form-row" style={{ alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: '0.25rem' }}>
              Size <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <SearchableSelect
              options={sizes.map((s) => ({
                value: s.uid,
                label: sizeLabel(s)
              }))}
              value={sizeUid}
              onChange={(val) => setSizeUid(val)}
              placeholder="Select size…"
            />
          </div>
          <label>
            Pieces <span style={{ color: '#ef4444' }}>*</span>
            <NumericInput value={pieces} onChange={setPieces} />
          </label>
          <label>
            Avg total rate (Purchase) <span style={{ color: '#ef4444' }}>*</span>
            <NumericInput value={avgTotalRate} onChange={setAvgTotalRate} />
          </label>
          <label>
            Sales rate / piece <span style={{ color: '#ef4444' }}>*</span>
            <NumericInput value={sellingPricePerPiece} onChange={setSellingPricePerPiece} placeholder="Enter sales rate..." />
          </label>
        </div>
        <div style={{ fontSize: '0.83rem', color: '#475569', marginTop: '0.5rem', marginBottom: '0.75rem' }}>
          Purchase rate / piece: <strong style={{ color: '#0f172a' }}>{avgRatePerPiece ? `₹${inr(avgRatePerPiece)}` : '-'}</strong>
          &nbsp;&nbsp;|&nbsp;&nbsp;
          Sales rate / piece: <strong style={{ color: '#16a34a' }}>{sellingPricePerPiece ? `₹${inr(sellingPricePerPiece)}` : '-'}</strong>
        </div>

        <ImageMatchPicker
          key={pickerKey}
          autoStartCamera={true}
          initialTag={resolvedImage}
          onResolved={setResolvedImage}
          onImageClick={(img) => setLightbox(img)}
        />
        {editingStagedKey ? (
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
            <button type="button" onClick={addOrUpdateItem} style={{ background: '#0284c7', color: '#fff' }}>Update item</button>
            <button type="button" onClick={cancelStagedEdit} style={{ background: '#94a3b8', color: '#fff' }}>Cancel edit</button>
          </div>
        ) : (
          <button type="button" onClick={addOrUpdateItem} style={{ marginTop: '0.75rem' }}>Add item</button>
        )}
      </div>

      {/* ── Staged Items Queue Table ── */}
      {items.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <h4 style={{ marginBottom: '0.5rem', color: '#334155' }}>
            {editingUid ? `Inward Items for this Entry (${items.length})` : `Staged Inward Items (${items.length})`}
          </h4>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 45 }}>S.No</th>
                <th style={{ width: 56 }}>Picture</th>
                <th>Size</th>
                <th className="num-cell">Pieces</th>
                <th className="num-cell">Purchase Total</th>
                <th className="num-cell">Purchase / pc</th>
                <th className="num-cell">Sales / pc</th>
                <th>Design</th>
                <th className="actions-th">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i, idx) => (
                <tr key={i.key} style={editingStagedKey === i.key ? { background: '#f0f9ff' } : {}}>
                  <td>{idx + 1}</td>
                  <td>
                    {i.preview_url ? (
                      <img
                        src={i.preview_url}
                        alt="Staged thumbnail"
                        title="Click to view large preview"
                        onClick={() => setLightbox({ url: i.preview_url, title: i.design_note })}
                        style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6, border: '1px solid #e2e8f0', cursor: 'pointer', display: 'block' }}
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    ) : (
                      <span style={{ color: '#cbd5e1', fontSize: '0.75rem' }}>No image</span>
                    )}
                  </td>
                  <td>{i.size_label}</td>
                  <td className="num-cell">{Number(i.pieces).toLocaleString('en-IN')}</td>
                  <td className="num-cell">₹{inr(i.avg_total_rate)}</td>
                  <td className="num-cell">₹{inr(i.avg_rate_per_piece)}</td>
                  <td className="num-cell" style={{ color: '#16a34a', fontWeight: 600 }}>
                    {i.selling_price_per_piece ? `₹${inr(i.selling_price_per_piece)}` : '-'}
                  </td>
                  <td>{i.design_note}</td>
                  <td className="action-cell">
                    <button className="icon-btn edit-btn" title="Edit item" onClick={() => editStagedItem(i.key)}>
                      <IconEdit />
                    </button>
                    <button className="icon-btn delete-btn" title="Remove item" onClick={() => removeItem(i.key)}>
                      <IconTrash />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {error && <div className="field-error">{error}</div>}
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', marginBottom: '1.5rem' }}>
        <button type="button" onClick={saveAll} disabled={saving || items.length === 0}>
          {saving ? 'Saving…' : editingUid ? 'Save / Update Stock Inward' : 'Save all items'}
        </button>
        {editingUid && (
          <button type="button" onClick={cancelEdit} style={{ background: '#94a3b8' }}>
            Cancel editing
          </button>
        )}
      </div>

      {/* ── History section ── */}
      <h2>Stock Inward History</h2>

      <div className={`table-toolbar ${loading ? 'is-loading' : ''}`}>
        <div className="search-box-wrap">
          <svg className="search-icon-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
            fill="none" stroke="#94a3b8" strokeWidth="2" width="16" height="16">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            className="search-input"
            placeholder="Search design # / dealer name…"
            value={search}
            disabled={loading}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <label className="records-per-page">
          Show&nbsp;
          <select value={pageSize} disabled={loading} onChange={handlePageSizeChange}>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
          &nbsp;records
        </label>
        <ColumnVisibility
          columns={STOCK_INWARD_COLS}
          visibleColumns={visibleColumns}
          onToggle={toggleColumn}
          onReset={resetColumns}
        />
      </div>

      <TableContainer loading={loading} text="Loading stock inward records…" subtext="Fetching inventory inward history">
        <table className="data-table">
          <thead>
            <tr>
              {isVisible('sno') && <th style={{ width: 50 }}>S.No</th>}
              {isVisible('picture') && <th style={{ width: 56 }}>Picture</th>}
              {isVisible('design_no') && <SortableHeader label="Design #"      sortKey="design_number"          currentSort={sortBy} currentDir={sortDir} onSort={handleSort} disabled={loading} />}
              {isVisible('size') && <th>Size</th>}
              {isVisible('dealer') && <SortableHeader label="Dealer/Opening" sortKey="dealer_name"           currentSort={sortBy} currentDir={sortDir} onSort={handleSort} disabled={loading} />}
              {isVisible('pieces') && <SortableHeader label="Pieces"         sortKey="pieces"                currentSort={sortBy} currentDir={sortDir} onSort={handleSort} className="num-cell" disabled={loading} />}
              {isVisible('avg_purchase') && <SortableHeader label="Avg Purchase"   sortKey="avg_total_rate"        currentSort={sortBy} currentDir={sortDir} onSort={handleSort} className="num-cell" disabled={loading} />}
              {isVisible('purchase_per_pc') && <SortableHeader label="Purchase/pc"    sortKey="avg_rate_per_piece"    currentSort={sortBy} currentDir={sortDir} onSort={handleSort} className="num-cell" disabled={loading} />}
              {isVisible('sales_per_pc') && <SortableHeader label="Sales/pc"       sortKey="selling_price_per_piece" currentSort={sortBy} currentDir={sortDir} onSort={handleSort} className="num-cell" disabled={loading} />}
              {isVisible('entry_date') && <SortableHeader label="Entry Date"     sortKey="entry_datetime"        currentSort={sortBy} currentDir={sortDir} onSort={handleSort} disabled={loading} />}
              {isVisible('actions') && <th className="actions-th">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={r.uid} style={editingUid === r.uid ? { background: '#f0f9ff' } : {}}>
                {isVisible('sno') && <td>{(page - 1) * pageSize + idx + 1}</td>}
                {isVisible('picture') && (
                  <td>
                    {r.image_filename ? (
                      <img
                        src={`/images/${r.image_filename}`}
                        alt={`Design ${r.design_number}`}
                        title="Click to view large preview"
                        onClick={() => setLightbox({ url: `/images/${r.image_filename}`, title: `${r.design_number}` })}
                        style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6, border: '1px solid #e2e8f0', cursor: 'pointer', display: 'block' }}
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    ) : (
                      <span style={{ color: '#cbd5e1', fontSize: '0.75rem' }}>No image</span>
                    )}
                  </td>
                )}
                {isVisible('design_no') && <td><strong>#{r.design_number}</strong></td>}
                {isVisible('size') && <td>{r.height_ft} x {r.width_ft} x {r.thickness_mm}mm</td>}
                {isVisible('dealer') && <td>{r.is_opening ? 'Opening' : (r.dealer_name || r.dealer_uid)}</td>}
                {isVisible('pieces') && <td className="num-cell">{Number(r.pieces).toLocaleString('en-IN')}</td>}
                {isVisible('avg_purchase') && <td className="num-cell">₹{inr(r.avg_total_rate)}</td>}
                {isVisible('purchase_per_pc') && <td className="num-cell">₹{inr(r.avg_rate_per_piece)}</td>}
                {isVisible('sales_per_pc') && (
                  <td className="num-cell" style={{ color: '#16a34a', fontWeight: 600 }}>
                    {r.selling_price_per_piece ? `₹${inr(r.selling_price_per_piece)}` : '-'}
                  </td>
                )}
                {isVisible('entry_date') && <td>{new Date(r.entry_datetime).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</td>}
                {isVisible('actions') && (
                  <td className="action-cell">
                    <button className="icon-btn edit-btn" title="Edit" disabled={loading} onClick={() => startEdit(r)}>
                      <IconEdit />
                    </button>
                    <button className="icon-btn delete-btn" title="Delete" disabled={loading} onClick={() => setDeleteUid(r.uid)}>
                      <IconTrash />
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={11} style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>{loading ? 'Loading stock inward entries…' : 'No stock inward entries found.'}</td></tr>
            )}
          </tbody>
        </table>
      </TableContainer>

      {/* ── Pagination Bar ── */}
      {total > 0 && (
        <div className={`pagination-bar ${loading ? 'is-loading' : ''}`}>
          <span className="pagination-info">Showing {startRecord}–{endRecord} of {total} records</span>
          <div className="pagination-controls">
            <button className="page-btn" disabled={loading || page <= 1} onClick={() => !loading && load(1)} title="First">«</button>
            <button className="page-btn" disabled={loading || page <= 1} onClick={() => !loading && load(page - 1)} title="Prev">‹</button>
            {pageNumbers.map((item, idx) =>
              item === '...'
                ? <span key={`ellipsis-${idx}`} className="page-ellipsis">…</span>
                : <button key={item} className={`page-btn${item === page ? ' active' : ''}`} disabled={loading} onClick={() => !loading && load(item)}>{item}</button>
            )}
            <button className="page-btn" disabled={loading || page >= totalPages} onClick={() => !loading && load(page + 1)} title="Next">›</button>
            <button className="page-btn" disabled={loading || page >= totalPages} onClick={() => !loading && load(totalPages)} title="Last">»</button>
          </div>
        </div>
      )}

      {/* ── Delete Modal ── */}
      {deleteUid && (
        <DeleteModal
          onConfirm={confirmDelete}
          onCancel={() => setDeleteUid(null)}
        />
      )}

      {/* ── Image Lightbox Preview Popup Modal ── */}
      {lightbox && (
        <LightboxModal
          image={lightbox}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}
