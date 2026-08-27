import { useState, useEffect, useRef, useCallback } from 'react';
import { listRates, updateRates } from '../../api/rateMaster.js';
import ColumnVisibility, { useColumnVisibility } from '../../components/ColumnVisibility.jsx';
import { TableContainer } from '../../components/TableLoadingOverlay.jsx';

const RATE_COLS = [
  { key: 'sno', label: 'S.No', defaultVisible: true },
  { key: 'image', label: 'Image', defaultVisible: true },
  { key: 'design_no', label: 'Design No.', defaultVisible: true },
  { key: 'size', label: 'Size', defaultVisible: true },
  { key: 'pieces', label: 'Pieces', defaultVisible: true },
  { key: 'dealer', label: 'Dealer', defaultVisible: true },
  { key: 'date', label: 'Date', defaultVisible: true },
  { key: 'purchase_rate', label: 'Purchase Rate', defaultVisible: true },
  { key: 'sell_price', label: 'Sell Price', defaultVisible: true },
  { key: 'status', label: 'Status', defaultVisible: true }
];

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

function formatDate(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  });
}

const inr = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ── Editable Sell Price Input (Table Cell) ── */
function SellInput({ value, onSave }) {
  const init = value === null || value === undefined || Number(value) === 0 ? '' : String(Number(value).toFixed(2));
  const [local, setLocal] = useState(init);
  const [changed, setChanged] = useState(false);

  useEffect(() => {
    const v = value === null || value === undefined || Number(value) === 0 ? '' : String(Number(value).toFixed(2));
    setLocal(v);
    setChanged(false);
  }, [value]);

  const commit = () => {
    if (!changed) return;
    onSave(local === '' ? null : Number(local));
    setChanged(false);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
      <span style={{ color: '#64748b', fontSize: '0.9rem' }}>₹</span>
      <input
        type="text"
        inputMode="decimal"
        value={local}
        onChange={(e) => {
          const v = e.target.value;
          if (/^\d*\.?\d{0,2}$/.test(v) || v === '') {
            setLocal(v);
            setChanged(true);
          }
        }}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }}
        placeholder="Enter sell price"
        style={{
          width: 110,
          textAlign: 'right',
          padding: '0.35rem 0.5rem',
          borderRadius: 5,
          border: changed ? '2px solid #16a34a' : '1px solid #cbd5e1',
          fontWeight: 700,
          fontSize: '0.92rem',
          color: local ? '#0f172a' : '#94a3b8',
          outline: 'none',
          background: changed ? '#f0fdf4' : '#fafafa',
        }}
      />
    </div>
  );
}

/* ── Photo Preview & Swipe Modal ── */
function RatePhotoSwipeModal({ items, activeIndex, onIndexChange, onClose, onSave, flash }) {
  const current = items[activeIndex];
  const [localSell, setLocalSell] = useState('');
  const [sellChanged, setSellChanged] = useState(false);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const inputRef = useRef(null);

  // Sync sell price when activeIndex / item changes
  useEffect(() => {
    if (current) {
      const v = current.selling_price_per_piece === null || current.selling_price_per_piece === undefined || Number(current.selling_price_per_piece) === 0
        ? ''
        : String(Number(current.selling_price_per_piece).toFixed(2));
      setLocalSell(v);
      setSellChanged(false);
    }
  }, [activeIndex, current]);

  const commitSell = useCallback(() => {
    if (!sellChanged || !current) return;
    const val = localSell === '' ? null : Number(localSell);
    onSave(current.uid, val);
    setSellChanged(false);
  }, [sellChanged, current, localSell, onSave]);

  const goToPrev = useCallback(() => {
    commitSell();
    if (activeIndex > 0) {
      onIndexChange(activeIndex - 1);
    } else {
      onIndexChange(items.length - 1); // wrap around
    }
  }, [activeIndex, items.length, onIndexChange, commitSell]);

  const goToNext = useCallback(() => {
    commitSell();
    if (activeIndex < items.length - 1) {
      onIndexChange(activeIndex + 1);
    } else {
      onIndexChange(0); // wrap around
    }
  }, [activeIndex, items.length, onIndexChange, commitSell]);

  // Keyboard navigation: ArrowLeft, ArrowRight, Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        // If cursor inside input, don't hijack left/right arrows unless user wants to navigate
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToPrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goToNext();
      } else if (e.key === 'Escape') {
        commitSell();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToPrev, goToNext, onClose, commitSell]);

  // Touch Swipe handlers
  const handleTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;
    if (isLeftSwipe) {
      goToNext();
    } else if (isRightSwipe) {
      goToPrev();
    }
  };

  if (!current) return null;

  const purchaseRate = Number(current.purchase_rate_per_piece || current.avg_rate_per_piece || 0);
  const totalPaid    = Number(current.avg_total_rate || 0);
  const isSavedFlash = flash[current.uid] === 'saved';
  const hasSellPrice = current.selling_price_per_piece !== null && current.selling_price_per_piece !== undefined && Number(current.selling_price_per_piece) > 0;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '1rem',
      }}
      onClick={() => { commitSell(); onClose(); }}
    >
      <div
        className="rate-photo-modal-box"
        style={{
          position: 'relative',
          backgroundColor: '#fff',
          borderRadius: '16px',
          maxWidth: '960px',
          width: '95vw',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header */}
        <div style={{
          padding: '0.85rem 1.25rem',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#f8fafc',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
              Design #{current.design_number}
            </span>
            <span style={{
              fontSize: '0.82rem',
              background: '#e0f2fe',
              color: '#0369a1',
              fontWeight: 700,
              padding: '0.2rem 0.6rem',
              borderRadius: 6
            }}>
              {activeIndex + 1} of {items.length}
            </span>
            {hasSellPrice ? (
              <span style={{ fontSize: '0.78rem', background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0', padding: '0.2rem 0.55rem', borderRadius: 6, fontWeight: 700 }}>
                ✓ Sell Price: ₹{inr(current.selling_price_per_piece)}
              </span>
            ) : (
              <span style={{ fontSize: '0.78rem', background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', padding: '0.2rem 0.55rem', borderRadius: 6, fontWeight: 700 }}>
                ⚠ No Sell Price Set
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', color: '#64748b', marginRight: '0.5rem' }}>
              Use <kbd style={{ background: '#e2e8f0', padding: '0.1rem 0.4rem', borderRadius: 4, fontWeight: 700 }}>←</kbd> <kbd style={{ background: '#e2e8f0', padding: '0.1rem 0.4rem', borderRadius: 4, fontWeight: 700 }}>→</kbd> to swipe
            </span>
            <button
              type="button"
              onClick={() => { commitSell(); onClose(); }}
              style={{
                background: '#f1f5f9',
                border: 'none',
                borderRadius: '50%',
                width: 34,
                height: 34,
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '1.1rem',
                color: '#64748b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Modal Body: Two Column (Left: Image with Swipe Nav, Right: Details + Sell Price Box) */}
        <div className="rate-photo-modal-body" style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.25fr) minmax(300px, 1fr)',
          gap: '1.25rem',
          padding: '1.25rem',
          overflowY: 'auto',
          alignItems: 'center',
        }}>
          {/* Left Column: Image Viewer with Swipe Controls */}
          <div
            className="rate-photo-modal-img-wrap"
            style={{
              position: 'relative',
              backgroundColor: '#0f172a',
              borderRadius: '12px',
              height: '380px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              userSelect: 'none',
              cursor: 'grab',
            }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {current.image_filename ? (
              <img
                src={`${API_BASE}/images/${current.image_filename}`}
                alt={`Design #${current.design_number}`}
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                  transition: 'transform 0.2s ease',
                }}
              />
            ) : (
              <div style={{ color: '#94a3b8', textAlign: 'center' }}>
                <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🖼</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>No Image Available</div>
              </div>
            )}

            {/* Left Chevron Button */}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); goToPrev(); }}
              title="Previous photo (←)"
              style={{
                position: 'absolute',
                left: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'rgba(255, 255, 255, 0.85)',
                color: '#0f172a',
                border: 'none',
                borderRadius: '50%',
                width: 42,
                height: 42,
                cursor: 'pointer',
                fontSize: '1.4rem',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                transition: 'all 0.15s ease',
              }}
            >
              ‹
            </button>

            {/* Right Chevron Button */}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); goToNext(); }}
              title="Next photo (→)"
              style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'rgba(255, 255, 255, 0.85)',
                color: '#0f172a',
                border: 'none',
                borderRadius: '50%',
                width: 42,
                height: 42,
                cursor: 'pointer',
                fontSize: '1.4rem',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                transition: 'all 0.15s ease',
              }}
            >
              ›
            </button>
          </div>

          {/* Right Column: Information & Rate Entry Box */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
            {/* Meta tags */}
            <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: 10, border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', fontSize: '0.86rem' }}>
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.78rem' }}>SIZE:</span>
                  <div style={{ fontWeight: 700, color: '#1e293b' }}>
                    {current.width_ft}×{current.height_ft}ft / {current.thickness_mm}mm
                  </div>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.78rem' }}>PIECES INWARD:</span>
                  <div style={{ fontWeight: 800, color: '#0369a1', fontSize: '1rem' }}>
                    {current.pieces} pcs
                  </div>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.78rem' }}>DEALER:</span>
                  <div style={{ fontWeight: 600, color: '#334155' }}>
                    {current.dealer_name || '—'}
                  </div>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.78rem' }}>INWARD DATE:</span>
                  <div style={{ color: '#64748b', fontSize: '0.8rem' }}>
                    {formatDate(current.entry_datetime)}
                  </div>
                </div>
              </div>
            </div>

            {/* Purchase Rate Card (Read-Only) */}
            <div style={{
              background: '#f0fdf4',
              border: '1.5px solid #86efac',
              borderRadius: 10,
              padding: '0.85rem',
            }}>
              <div style={{ fontSize: '0.78rem', color: '#166534', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                📦 Purchase Rate (per pc)
              </div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#15803d', marginTop: '0.2rem' }}>
                {purchaseRate > 0 ? `₹${inr(purchaseRate)} / pc` : '—'}
              </div>
              {totalPaid > 0 && (
                <div style={{ fontSize: '0.78rem', color: '#166534', marginTop: '0.15rem' }}>
                  Total Inward Paid: ₹{inr(totalPaid)} ÷ {current.pieces} pcs
                </div>
              )}
            </div>

            {/* Selling Price Entry Card (Editable) */}
            <div style={{
              background: '#fffbeb',
              border: '1.5px solid #fde68a',
              borderRadius: 10,
              padding: '0.95rem',
            }}>
              <label style={{ display: 'block', fontSize: '0.82rem', color: '#92400e', fontWeight: 700, marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                🏷 Selling Price (per pc)
              </label>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: '#fff',
                  border: sellChanged ? '2px solid #16a34a' : '1px solid #cbd5e1',
                  borderRadius: 8,
                  padding: '0.45rem 0.75rem',
                  flex: 1,
                  boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)'
                }}>
                  <span style={{ color: '#475569', fontWeight: 700, fontSize: '1.1rem', marginRight: '0.35rem' }}>₹</span>
                  <input
                    ref={inputRef}
                    type="text"
                    inputMode="decimal"
                    value={localSell}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (/^\d*\.?\d{0,2}$/.test(v) || v === '') {
                        setLocalSell(v);
                        setSellChanged(true);
                      }
                    }}
                    onBlur={commitSell}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        commitSell();
                        goToNext(); // auto advance to next photo on Enter!
                      }
                    }}
                    placeholder="e.g. 250.00"
                    style={{
                      border: 'none',
                      outline: 'none',
                      width: '100%',
                      fontSize: '1.25rem',
                      fontWeight: 800,
                      color: '#0f172a',
                      background: 'transparent',
                    }}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => { commitSell(); }}
                  style={{
                    padding: '0.65rem 1.1rem',
                    background: sellChanged ? '#16a34a' : '#0284c7',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  }}
                >
                  {sellChanged ? '💾 Save' : '✓ Saved'}
                </button>
              </div>

              <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem' }}>
                <span style={{ color: '#78350f' }}>
                  Press <kbd style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 3, padding: '0 4px', fontWeight: 700 }}>Enter</kbd> to save &amp; go to next photo
                </span>
                {isSavedFlash && (
                  <span style={{ color: '#16a34a', fontWeight: 700 }}>✓ Saved!</span>
                )}
              </div>
            </div>

            {/* Quick Next / Prev Action Bar */}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
              <button
                type="button"
                onClick={goToPrev}
                style={{
                  flex: 1,
                  padding: '0.55rem',
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  color: '#334155',
                }}
              >
                ‹ Previous Item
              </button>
              <button
                type="button"
                onClick={goToNext}
                style={{
                  flex: 1,
                  padding: '0.55rem',
                  background: '#0f172a',
                  border: 'none',
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  color: '#fff',
                }}
              >
                Next Item ›
              </button>
            </div>
          </div>
        </div>

        {/* Thumbnail Strip at Bottom */}
        <div style={{
          padding: '0.6rem 1rem',
          borderTop: '1px solid #e2e8f0',
          background: '#f8fafc',
          display: 'flex',
          gap: '0.5rem',
          overflowX: 'auto',
          alignItems: 'center',
        }}>
          {items.map((it, idx) => {
            const isCur = idx === activeIndex;
            const hasSp = it.selling_price_per_piece && Number(it.selling_price_per_piece) > 0;
            return (
              <div
                key={it.uid}
                onClick={() => { commitSell(); onIndexChange(idx); }}
                title={`#${it.design_number} - ${hasSp ? `₹${inr(it.selling_price_per_piece)}` : 'No sell price'}`}
                style={{
                  flexShrink: 0,
                  width: 50,
                  height: 50,
                  borderRadius: 6,
                  border: isCur ? '2.5px solid #0284c7' : hasSp ? '1.5px solid #86efac' : '1.5px solid #fde68a',
                  position: 'relative',
                  cursor: 'pointer',
                  overflow: 'hidden',
                  background: '#e2e8f0',
                  opacity: isCur ? 1 : 0.7,
                  transition: 'all 0.15s ease',
                }}
              >
                {it.image_filename ? (
                  <img
                    src={`${API_BASE}/images/${it.image_filename}`}
                    alt={`#${it.design_number}`}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', color: '#64748b' }}>
                    #{it.design_number}
                  </div>
                )}
                {!hasSp && (
                  <div style={{
                    position: 'absolute',
                    top: 1, right: 1,
                    width: 7, height: 7,
                    borderRadius: '50%',
                    backgroundColor: '#d97706',
                  }} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function RateMaster() {
  const [rows, setRows]           = useState([]);
  const [page, setPage]           = useState(1);
  const [pageSize, setPageSize]   = useState(50);
  const [total, setTotal]         = useState(0);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [search, setSearch]       = useState('');
  const [flash, setFlash]         = useState({});

  const { visibleColumns, toggleColumn, resetColumns, isVisible } = useColumnVisibility(
    'rate_master_columns',
    RATE_COLS
  );

  /* ── Photo Swipe Modal State ── */
  const [swipeModalOpen, setSwipeModalOpen] = useState(false);
  const [swipeIndex, setSwipeIndex]         = useState(0);

  const loadRates = async (p = page, opts = {}) => {
    setLoading(true);
    setError(null);
    try {
      const ps = opts.pageSize ?? pageSize;
      const s  = opts.search !== undefined ? opts.search : search;
      const res = await listRates(p, ps, { search: s });
      setRows(res.data || []);
      setTotal(res.total || 0);
      setPage(res.page || p);
    } catch (err) {
      setError(`Failed to load: ${err.message}`);
    } finally { setLoading(false); }
  };

  useEffect(() => { loadRates(1); }, []); // eslint-disable-line

  useEffect(() => {
    const t = setTimeout(() => loadRates(1, { search }), 300);
    return () => clearTimeout(t);
  }, [search]); // eslint-disable-line

  const handleSave = async (uid, selling_price_per_piece) => {
    try {
      const res = await updateRates(uid, { selling_price_per_piece });
      const sp = res.data?.selling_price_per_piece;
      setRows(prev => prev.map(r => r.uid === uid
        ? { ...r, selling_price_per_piece: sp, is_unpriced: (!sp || Number(sp) === 0) ? 1 : 0 }
        : r
      ));
      setFlash(f => ({ ...f, [uid]: 'saved' }));
      setTimeout(() => setFlash(f => { const c = { ...f }; delete c[uid]; return c; }), 2000);
    } catch (err) {
      setFlash(f => ({ ...f, [uid]: 'error' }));
      setError(`Failed to save: ${err.message}`);
      setTimeout(() => setFlash(f => { const c = { ...f }; delete c[uid]; return c; }), 3000);
    }
  };

  const openSwipeAt = (index) => {
    setSwipeIndex(index);
    setSwipeModalOpen(true);
  };

  const totalPages   = Math.max(Math.ceil(total / pageSize), 1);
  const startRecord  = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRecord    = Math.min(page * pageSize, total);
  const pageNumbers  = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
    .reduce((acc, p, idx, arr) => {
      if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...');
      acc.push(p);
      return acc;
    }, []);

  const unpricedCount = rows.filter(r => r.is_unpriced === 1 || r.is_unpriced === true).length;

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <h1 style={{ margin: 0 }}>Rate Master</h1>
          {unpricedCount > 0 && (
            <span style={{ fontSize: '0.82rem', background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', padding: '0.2rem 0.65rem', borderRadius: 5, fontWeight: 700 }}>
              ⚠ {unpricedCount} row{unpricedCount > 1 ? 's' : ''} without sell price (shown first)
            </span>
          )}
          {unpricedCount === 0 && rows.length > 0 && (
            <span style={{ fontSize: '0.82rem', background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0', padding: '0.2rem 0.65rem', borderRadius: 5, fontWeight: 700 }}>
              ✓ All rows have sell prices
            </span>
          )}
        </div>

        {rows.length > 0 && (
          <button
            type="button"
            onClick={() => openSwipeAt(0)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              background: '#0284c7',
              color: '#fff',
              border: 'none',
              padding: '0.55rem 1rem',
              borderRadius: 7,
              fontWeight: 700,
              fontSize: '0.88rem',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            }}
          >
            📸 Photo Preview &amp; Swipe Mode
          </button>
        )}
      </div>

      <div style={{ background: '#e0f2fe', border: '1px solid #7dd3fc', color: '#0369a1', padding: '0.55rem 1rem', borderRadius: 7, marginBottom: '1rem', fontSize: '0.85rem', fontWeight: 500 }}>
        <strong>Purchase Rate</strong> = Total paid ÷ Pieces (auto-calculated from stock inward, read-only). &nbsp;|&nbsp;
        <strong>Sell Price</strong> = editable per-piece rate. Click any <strong>image thumbnail</strong> or the <strong>📸 Photo Preview &amp; Swipe Mode</strong> button to view large photos, swipe between designs, and enter prices!
      </div>

      {error && <div className="field-error">{error}</div>}

      <div className={`table-toolbar ${loading ? 'is-loading' : ''}`}>
        <input
          type="text"
          placeholder="Search design no., dealer…"
          value={search}
          disabled={loading}
          onChange={(e) => setSearch(e.target.value)}
          style={{ minWidth: 240, padding: '0.45rem 0.75rem', fontSize: '0.88rem' }}
        />
        <span style={{ color: '#64748b', fontSize: '0.88rem', marginLeft: '0.5rem' }}>
          {total} row{total !== 1 ? 's' : ''}
        </span>
        <label className="records-per-page">
          Show&nbsp;
          <select value={pageSize} disabled={loading} onChange={(e) => {
            const ps = Number(e.target.value);
            setPageSize(ps);
            loadRates(1, { pageSize: ps });
          }}>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          &nbsp;records
        </label>
        <ColumnVisibility
          columns={RATE_COLS}
          visibleColumns={visibleColumns}
          onToggle={toggleColumn}
          onReset={resetColumns}
        />
      </div>

      <TableContainer loading={loading} text="Loading rates…" subtext="Fetching rate configuration and sell prices">
        <table className="data-table">
          <thead>
            <tr>
              {isVisible('sno') && <th style={{ width: 50 }}>S.No</th>}
              {isVisible('image') && <th style={{ width: 75 }}>Image</th>}
              {isVisible('design_no') && <th>Design No.</th>}
              {isVisible('size') && <th style={{ textAlign: 'right' }}>Size</th>}
              {isVisible('pieces') && <th style={{ textAlign: 'right' }}>Pieces</th>}
              {isVisible('dealer') && <th>Dealer</th>}
              {isVisible('date') && <th>Date</th>}
              {isVisible('purchase_rate') && (
                <th style={{ minWidth: 160, textAlign: 'right' }}>
                  Purchase Rate <span style={{ fontWeight: 400, color: '#94a3b8', fontSize: '0.78rem' }}>(Total ÷ Pcs, read-only)</span>
                </th>
              )}
              {isVisible('sell_price') && (
                <th style={{ minWidth: 150, textAlign: 'right' }}>
                  Sell Price <span style={{ fontWeight: 400, color: '#94a3b8', fontSize: '0.78rem' }}>(per pc, editable)</span>
                </th>
              )}
              {isVisible('status') && <th>Status</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const rowFlash = flash[row.uid];
              const unpriced = row.is_unpriced === 1 || row.is_unpriced === true;
              const rowBg = rowFlash === 'saved'
                ? '#f0fdf4'
                : rowFlash === 'error'
                ? '#fef2f2'
                : unpriced
                ? '#fffbeb'
                : '#fff';

              const purchaseRate = Number(row.purchase_rate_per_piece || row.avg_rate_per_piece || 0);
              const totalPaid    = Number(row.avg_total_rate || 0);

              return (
                <tr key={row.uid} style={{ background: rowBg, transition: 'background 0.4s' }}>
                  {isVisible('sno') && <td className="num-cell" style={{ textAlign: 'right', color: '#94a3b8' }}>{(page - 1) * pageSize + idx + 1}</td>}
                  {isVisible('image') && (
                    <td>
                      <div
                        onClick={() => !loading && openSwipeAt(idx)}
                        title="Click for full Photo Preview & Swipe Mode"
                        style={{
                          position: 'relative',
                          cursor: loading ? 'wait' : 'pointer',
                          display: 'inline-block',
                          borderRadius: 6,
                          overflow: 'hidden',
                          border: '1.5px solid #cbd5e1',
                          transition: 'transform 0.15s ease, border-color 0.15s ease',
                        }}
                        onMouseEnter={(e) => { if (!loading) { e.currentTarget.style.borderColor = '#0284c7'; e.currentTarget.style.transform = 'scale(1.08)'; } }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.transform = 'scale(1)'; }}
                      >
                        {row.image_filename ? (
                          <img
                            src={`${API_BASE}/images/${row.image_filename}`}
                            alt={row.design_number}
                            style={{ width: 48, height: 48, objectFit: 'cover', display: 'block' }}
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                        ) : (
                          <div style={{ width: 48, height: 48, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1', fontSize: '1.2rem' }}>
                            🖼
                          </div>
                        )}
                        <div style={{
                          position: 'absolute',
                          bottom: 0, right: 0,
                          background: 'rgba(0,0,0,0.6)',
                          color: '#fff',
                          fontSize: '0.65rem',
                          padding: '1px 3px',
                          borderTopLeftRadius: 3,
                        }}>
                          🔍
                        </div>
                      </div>
                    </td>
                  )}
                  {isVisible('design_no') && <td><span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a' }}>#{row.design_number}</span></td>}
                  {isVisible('size') && <td className="num-cell" style={{ fontSize: '0.82rem', color: '#475569', textAlign: 'right' }}>{row.width_ft}×{row.height_ft}ft / {row.thickness_mm}mm</td>}
                  {isVisible('pieces') && <td className="num-cell" style={{ textAlign: 'right', fontWeight: 700, color: '#0369a1' }}>{row.pieces}</td>}
                  {isVisible('dealer') && <td style={{ color: '#475569', fontSize: '0.88rem' }}>{row.dealer_name || '—'}</td>}
                  {isVisible('date') && <td style={{ fontSize: '0.8rem', color: '#64748b', whiteSpace: 'nowrap' }}>{formatDate(row.entry_datetime)}</td>}

                  {/* ── Purchase Rate (read-only) ── */}
                  {isVisible('purchase_rate') && (
                    <td className="num-cell" style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.2rem' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.92rem', color: purchaseRate > 0 ? '#0f172a' : '#94a3b8' }}>
                          {purchaseRate > 0 ? `₹${inr(purchaseRate)}/pc` : '—'}
                        </div>
                        {totalPaid > 0 && (
                          <div style={{ fontSize: '0.73rem', color: '#64748b' }}>
                            ₹{inr(totalPaid)} ÷ {row.pieces} pcs
                          </div>
                        )}
                      </div>
                    </td>
                  )}

                  {/* ── Sell Price (editable) ── */}
                  {isVisible('sell_price') && (
                    <td className="num-cell" style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <SellInput
                          value={row.selling_price_per_piece}
                          onSave={(v) => handleSave(row.uid, v)}
                        />
                      </div>
                    </td>
                  )}

                  {/* ── Status ── */}
                  {isVisible('status') && (
                    <td>
                      {rowFlash === 'saved'
                        ? <span style={{ color: '#16a34a', fontWeight: 700, fontSize: '0.85rem' }}>✓ Saved</span>
                        : rowFlash === 'error'
                        ? <span style={{ color: '#ef4444', fontWeight: 700, fontSize: '0.85rem' }}>✗ Error</span>
                        : unpriced
                        ? <span style={{ color: '#d97706', fontWeight: 700, fontSize: '0.82rem', background: '#fef3c7', padding: '0.15rem 0.45rem', borderRadius: 4 }}>⚠ No Sell Price</span>
                        : <span style={{ color: '#16a34a', fontSize: '0.82rem' }}>✓ Set</span>
                      }
                    </td>
                  )}
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', color: '#94a3b8', padding: '3rem' }}>
                  {loading ? 'Loading rates…' : 'No stock inward records found. Add stock inward entries first.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </TableContainer>

      {total > 0 && (
        <div className={`pagination-bar ${loading ? 'is-loading' : ''}`}>
          <span className="pagination-info">Showing {startRecord}–{endRecord} of {total} records</span>
          <div className="pagination-controls">
            <button className="page-btn" disabled={loading || page <= 1} onClick={() => !loading && loadRates(1)}>«</button>
            <button className="page-btn" disabled={loading || page <= 1} onClick={() => !loading && loadRates(page - 1)}>‹</button>
            {pageNumbers.map((item, idx) =>
              item === '...'
                ? <span key={`e${idx}`} className="page-ellipsis">…</span>
                : <button key={item} className={`page-btn${item === page ? ' active' : ''}`} disabled={loading} onClick={() => !loading && loadRates(item)}>{item}</button>
            )}
            <button className="page-btn" disabled={loading || page >= totalPages} onClick={() => !loading && loadRates(page + 1)}>›</button>
            <button className="page-btn" disabled={loading || page >= totalPages} onClick={() => !loading && loadRates(totalPages)}>»</button>
          </div>
        </div>
      )}

      {/* ── Full Photo Preview & Swipe Modal ── */}
      {swipeModalOpen && (
        <RatePhotoSwipeModal
          items={rows}
          activeIndex={swipeIndex}
          onIndexChange={setSwipeIndex}
          onClose={() => setSwipeModalOpen(false)}
          onSave={handleSave}
          flash={flash}
        />
      )}
    </div>
  );
}
