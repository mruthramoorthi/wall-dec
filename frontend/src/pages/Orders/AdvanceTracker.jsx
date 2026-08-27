import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import CustomerNavbar from '../../components/CustomerNavbar.jsx';
import { listAdvances, getAdvance } from '../../api/advance.js';
import { getImageUrl } from '../../utils/apiConfig.js';
import { openReceiptPdf } from '../../utils/printPdf.js';

export default function AdvanceTracker({ currentUser }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSearch = searchParams.get('q') || currentUser?.mobile_number || currentUser?.username || '';
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [activeFilter, setActiveFilter] = useState('all'); // 'all', 'active', 'billed'
  const [advances, setAdvances] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAdvances = useCallback(async (query = searchQuery) => {
    setLoading(true);
    setError(null);
    try {
      // If query is provided, search by term; otherwise fetch latest
      const res = await listAdvances(1, 50, { search: query.trim() });
      const rawList = res?.data || [];
      
      // For each advance that has items or is a pre-book, fetch full details if not present
      const detailedList = await Promise.all(
        rawList.map(async (adv) => {
          if (adv.is_prebook || adv.total_items > 0) {
            try {
              const d = await getAdvance(adv.uid);
              return d?.data || adv;
            } catch {
              return adv;
            }
          }
          return adv;
        })
      );

      setAdvances(detailedList);
    } catch (err) {
      console.error('Failed to fetch customer advances:', err);
      setError(err?.message || 'Unable to load advance records. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    fetchAdvances(initialSearch);
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setSearchParams({ q: searchQuery.trim() });
    } else {
      setSearchParams({});
    }
    fetchAdvances(searchQuery);
  };

  const handleOpenReceipt = (uid) => {
    openReceiptPdf(uid, 'advance');
  };

  // Filter advances
  const filteredAdvances = advances.filter((adv) => {
    if (activeFilter === 'active') return !adv.is_converted_to_bill;
    if (activeFilter === 'billed') return adv.is_converted_to_bill;
    return true;
  });

  const totalDeposited = advances.reduce((sum, a) => sum + Number(a.amount || 0), 0);
  const activeBalance = advances
    .filter((a) => !a.is_converted_to_bill)
    .reduce((sum, a) => sum + Number(a.amount || 0), 0);
  const totalReservedPieces = advances.reduce((sum, a) => sum + Number(a.total_pieces || 0), 0);

  return (
    <div className="customer-store-wrapper" style={{ minHeight: '100vh', background: '#0b1120', color: '#e2e8f0' }}>
      <CustomerNavbar cartCount={0} currentUser={currentUser} />

      <div style={{ maxWidth: 1120, margin: '2rem auto', padding: '0 1.25rem', width: '100%' }}>
        {/* ── Top Header & Tab Switcher ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.75rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <span style={{ fontSize: '1.8rem' }}>💰</span>
              <h1 style={{ margin: 0, fontSize: '1.85rem', color: '#f8fafc', fontWeight: 900, letterSpacing: '-0.02em' }}>
                Advance &amp; Pre-booking Tracker
              </h1>
            </div>
            <p style={{ margin: '0.35rem 0 0', color: '#94a3b8', fontSize: '0.92rem' }}>
              Check your active advance balances, pre-booked reserved panels, and deposit payment receipts
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <Link
              to="/track-orders"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                background: 'rgba(37,99,235,0.15)',
                border: '1px solid rgba(59,130,246,0.3)',
                color: '#60a5fa',
                padding: '0.6rem 1.1rem',
                borderRadius: 10,
                textDecoration: 'none',
                fontWeight: 700,
                fontSize: '0.86rem',
                transition: 'all 0.15s ease'
              }}
            >
              <span>📦</span>
              <span>Track Orders</span>
            </Link>

            <Link
              to="/catalog"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: '#e2e8f0',
                padding: '0.6rem 1.1rem',
                borderRadius: 10,
                textDecoration: 'none',
                fontWeight: 700,
                fontSize: '0.86rem',
                transition: 'all 0.15s ease'
              }}
            >
              <span>🎨</span>
              <span>Catalog</span>
            </Link>
          </div>
        </div>

        {/* ── Search Bar Card ── */}
        <div
          style={{
            background: 'rgba(30, 41, 59, 0.7)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 16,
            padding: '1.25rem',
            marginBottom: '1.75rem',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25)'
          }}
        >
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 260, position: 'relative' }}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Enter Pre-booking Code (e.g. PB-1001), Mobile #, or Name…"
                style={{
                  width: '100%',
                  padding: '0.8rem 1rem 0.8rem 2.75rem',
                  borderRadius: 10,
                  border: '1.5px solid rgba(255, 255, 255, 0.15)',
                  background: 'rgba(15, 23, 42, 0.8)',
                  color: '#fff',
                  fontSize: '0.95rem',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
              <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b', fontSize: '1.1rem' }}>
                🔍
              </span>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                background: 'linear-gradient(135deg, #2563eb, #0284c7)',
                color: '#fff',
                border: 'none',
                padding: '0.8rem 1.6rem',
                borderRadius: 10,
                fontWeight: 800,
                fontSize: '0.92rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)'
              }}
            >
              {loading ? 'Searching…' : 'Track Advances'}
            </button>

            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSearchParams({});
                  fetchAdvances('');
                }}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#cbd5e1',
                  padding: '0.8rem 1.1rem',
                  borderRadius: 10,
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '0.88rem'
                }}
              >
                Clear
              </button>
            )}
          </form>
        </div>

        {/* ── Key Metrics Summary ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.75rem' }}>
          <div style={{ background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 12, padding: '1rem 1.25rem' }}>
            <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Total Deposits Made
            </div>
            <div style={{ fontSize: '1.55rem', fontWeight: 900, color: '#38bdf8', marginTop: '0.25rem', textAlign: 'right' }}>
              ₹{totalDeposited.toFixed(2)}
            </div>
          </div>

          <div style={{ background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(34, 197, 94, 0.25)', borderRadius: 12, padding: '1rem 1.25rem' }}>
            <div style={{ fontSize: '0.78rem', color: '#86efac', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Active Available Balance
            </div>
            <div style={{ fontSize: '1.55rem', fontWeight: 900, color: '#4ade80', marginTop: '0.25rem', textAlign: 'right' }}>
              ₹{activeBalance.toFixed(2)}
            </div>
          </div>

          <div style={{ background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(168, 85, 247, 0.25)', borderRadius: 12, padding: '1rem 1.25rem' }}>
            <div style={{ fontSize: '0.78rem', color: '#d8b4fe', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Reserved Panels
            </div>
            <div style={{ fontSize: '1.55rem', fontWeight: 900, color: '#c084fc', marginTop: '0.25rem', textAlign: 'right' }}>
              {totalReservedPieces} sheet(s)
            </div>
          </div>
        </div>

        {/* ── Filter Pills Bar ── */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
          <button
            type="button"
            onClick={() => setActiveFilter('all')}
            style={{
              padding: '0.45rem 1rem',
              borderRadius: 20,
              fontSize: '0.84rem',
              fontWeight: 700,
              border: activeFilter === 'all' ? '1.5px solid #38bdf8' : '1px solid rgba(255,255,255,0.12)',
              background: activeFilter === 'all' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255,255,255,0.04)',
              color: activeFilter === 'all' ? '#38bdf8' : '#cbd5e1',
              cursor: 'pointer'
            }}
          >
            All Deposits ({advances.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('active')}
            style={{
              padding: '0.45rem 1rem',
              borderRadius: 20,
              fontSize: '0.84rem',
              fontWeight: 700,
              border: activeFilter === 'active' ? '1.5px solid #4ade80' : '1px solid rgba(255,255,255,0.12)',
              background: activeFilter === 'active' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255,255,255,0.04)',
              color: activeFilter === 'active' ? '#4ade80' : '#cbd5e1',
              cursor: 'pointer'
            }}
          >
            🟢 Active Balances ({advances.filter((a) => !a.is_converted_to_bill).length})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('billed')}
            style={{
              padding: '0.45rem 1rem',
              borderRadius: 20,
              fontSize: '0.84rem',
              fontWeight: 700,
              border: activeFilter === 'billed' ? '1.5px solid #a855f7' : '1px solid rgba(255,255,255,0.12)',
              background: activeFilter === 'billed' ? 'rgba(168, 85, 247, 0.15)' : 'rgba(255,255,255,0.04)',
              color: activeFilter === 'billed' ? '#c084fc' : '#cbd5e1',
              cursor: 'pointer'
            }}
          >
            ✓ Adjusted in Sales Bill ({advances.filter((a) => a.is_converted_to_bill).length})
          </button>
        </div>

        {/* ── Advances List ── */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem 1rem', color: '#94a3b8' }}>
            <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.75rem' }}>⏳</span>
            <strong style={{ fontSize: '1.1rem', color: '#f8fafc' }}>Loading Advance &amp; Pre-booking Records…</strong>
            <p style={{ fontSize: '0.85rem', margin: '0.35rem 0 0' }}>Fetching verified payment receipts from ledger</p>
          </div>
        ) : error ? (
          <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 12, padding: '1.5rem', textAlign: 'center', color: '#fca5a5' }}>
            <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}>⚠️</span>
            <strong>{error}</strong>
          </div>
        ) : filteredAdvances.length === 0 ? (
          <div
            style={{
              background: 'rgba(30, 41, 59, 0.4)',
              border: '1px dashed rgba(255, 255, 255, 0.15)',
              borderRadius: 16,
              padding: '3.5rem 1.5rem',
              textAlign: 'center',
              color: '#94a3b8'
            }}
          >
            <span style={{ fontSize: '3rem', display: 'block', marginBottom: '0.75rem' }}>🏷️</span>
            <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1.2rem', fontWeight: 800 }}>
              No Advance Records Found
            </h3>
            <p style={{ margin: '0.45rem 0 1.25rem', fontSize: '0.9rem', maxWidth: 440, marginLeft: 'auto', marginRight: 'auto' }}>
              Search using your registered mobile number or Pre-booking ID (e.g. <code>PB-1001</code>) to track your store deposit.
            </p>
            <Link
              to="/catalog"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                background: 'linear-gradient(135deg, #2563eb, #0284c7)',
                color: '#fff',
                padding: '0.75rem 1.5rem',
                borderRadius: 10,
                textDecoration: 'none',
                fontWeight: 800,
                fontSize: '0.92rem'
              }}
            >
              🎨 Explore Designs &amp; Reserve Panels
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {filteredAdvances.map((adv) => {
              const isBilled = adv.is_converted_to_bill;
              const hasItems = Array.isArray(adv.items) && adv.items.length > 0;

              return (
                <div
                  key={adv.uid}
                  style={{
                    background: 'rgba(30, 41, 59, 0.75)',
                    backdropFilter: 'blur(10px)',
                    border: isBilled ? '1px solid rgba(255, 255, 255, 0.08)' : '1.5px solid rgba(56, 189, 248, 0.3)',
                    borderRadius: 16,
                    padding: '1.35rem',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                    transition: 'transform 0.15s ease, border-color 0.15s ease'
                  }}
                >
                  {/* Advance Card Top Bar */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '1rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
                        {adv.is_prebook ? (
                          <span
                            style={{
                              background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                              color: '#fff',
                              padding: '0.25rem 0.65rem',
                              borderRadius: 6,
                              fontWeight: 900,
                              fontSize: '0.82rem',
                              letterSpacing: '0.5px'
                            }}
                          >
                            🔖 {adv.prebook_code || 'Pre-booking'}
                          </span>
                        ) : (
                          <span
                            style={{
                              background: 'rgba(56, 189, 248, 0.15)',
                              color: '#38bdf8',
                              border: '1px solid rgba(56, 189, 248, 0.3)',
                              padding: '0.2rem 0.6rem',
                              borderRadius: 6,
                              fontWeight: 800,
                              fontSize: '0.8rem'
                            }}
                          >
                            💵 Standard Advance Deposit
                          </span>
                        )}

                        {isBilled ? (
                          <span
                            style={{
                              background: 'rgba(168, 85, 247, 0.15)',
                              color: '#c084fc',
                              border: '1px solid rgba(168, 85, 247, 0.3)',
                              padding: '0.2rem 0.55rem',
                              borderRadius: 6,
                              fontSize: '0.76rem',
                              fontWeight: 800
                            }}
                          >
                            ✓ Adjusted in Sales Bill
                          </span>
                        ) : (
                          <span
                            style={{
                              background: 'rgba(34, 197, 94, 0.15)',
                              color: '#4ade80',
                              border: '1px solid rgba(34, 197, 94, 0.3)',
                              padding: '0.2rem 0.55rem',
                              borderRadius: 6,
                              fontSize: '0.76rem',
                              fontWeight: 800
                            }}
                          >
                            ● Active Available Balance
                          </span>
                        )}
                      </div>

                      <div style={{ color: '#94a3b8', fontSize: '0.82rem', marginTop: '0.4rem' }}>
                        Customer: <strong style={{ color: '#f8fafc' }}>{adv.customer_name}</strong> • Mobile: <strong>{adv.mobile_number}</strong>
                        <span style={{ marginLeft: '0.5rem', color: '#64748b' }}>
                          • Deposited on {new Date(adv.entry_datetime).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>

                    {/* Deposit Amount */}
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '0.74rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Advance Paid
                      </span>
                      <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#38bdf8', letterSpacing: '-0.02em' }}>
                        ₹{Number(adv.amount).toFixed(2)}
                      </div>
                    </div>
                  </div>

                  {/* Payment Details Row */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: '0.75rem',
                      background: 'rgba(15, 23, 42, 0.45)',
                      padding: '0.85rem 1rem',
                      borderRadius: 10,
                      margin: '1rem 0',
                      fontSize: '0.84rem'
                    }}
                  >
                    <div>
                      <span style={{ color: '#64748b' }}>Payment Mode: </span>
                      <strong style={{ color: '#f8fafc', textTransform: 'uppercase' }}>{adv.payment_mode || 'Cash'}</strong>
                    </div>

                    {adv.ref_number && (
                      <div>
                        <span style={{ color: '#64748b' }}>Ref / Txn #: </span>
                        <code style={{ color: '#38bdf8', background: 'rgba(0,0,0,0.3)', padding: '0.15rem 0.35rem', borderRadius: 4 }}>
                          {adv.ref_number}
                        </code>
                      </div>
                    )}

                    {adv.bank_name && (
                      <div>
                        <span style={{ color: '#64748b' }}>Bank: </span>
                        <strong style={{ color: '#f8fafc' }}>{adv.bank_name} {adv.bank_code ? `(${adv.bank_code})` : ''}</strong>
                      </div>
                    )}

                    {adv.change_returned > 0 && (
                      <div>
                        <span style={{ color: '#64748b' }}>Change Returned: </span>
                        <strong style={{ color: '#4ade80' }}>₹{Number(adv.change_returned).toFixed(2)}</strong>
                      </div>
                    )}
                  </div>

                  {adv.notes && (
                    <div style={{ fontSize: '0.82rem', color: '#94a3b8', marginBottom: '1rem', fontStyle: 'italic' }}>
                      💬 Note: "{adv.notes}"
                    </div>
                  )}

                  {/* Pre-booked Reserved Panels Breakdown */}
                  {hasItems && (
                    <div style={{ marginTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.85rem' }}>
                      <h4 style={{ margin: '0 0 0.65rem', fontSize: '0.88rem', color: '#cbd5e1', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span>🖼️</span>
                        <span>Reserved Panels for Pre-booking ({adv.items.length} item{adv.items.length !== 1 ? 's' : ''}):</span>
                      </h4>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
                        {adv.items.map((it, idx) => (
                          <div
                            key={idx}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.75rem',
                              background: 'rgba(15, 23, 42, 0.6)',
                              border: '1px solid rgba(255, 255, 255, 0.08)',
                              borderRadius: 10,
                              padding: '0.65rem 0.85rem'
                            }}
                          >
                            <div
                              style={{
                                width: 44,
                                height: 44,
                                borderRadius: 8,
                                background: '#1e293b',
                                overflow: 'hidden',
                                flexShrink: 0,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              {it.image_filename ? (
                                <img
                                  src={getImageUrl(it.image_filename, 'thumb')}
                                  alt={`Design ${it.design_number}`}
                                  loading="lazy"
                                  decoding="async"
                                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                              ) : (
                                <span style={{ fontSize: '1.2rem' }}>🖼️</span>
                              )}
                            </div>

                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 800, color: '#f8fafc', fontSize: '0.9rem' }}>
                                Design #{it.design_number}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                {it.width_ft ? `${it.width_ft}×${it.height_ft} ft • ${it.thickness_mm}mm` : 'Acrylic Sheet'}
                              </div>
                            </div>

                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontWeight: 800, color: '#c084fc', fontSize: '0.88rem' }}>
                                {it.pieces} sheet(s)
                              </div>
                              <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                                ₹{Number(it.line_amount || (it.rate_per_piece * it.pieces)).toFixed(2)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Card Bottom Actions */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', paddingTop: '0.85rem', borderTop: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      {isBilled
                        ? '✓ This advance has been converted and discounted in final store invoice.'
                        : '💡 Present this pre-booking code or mobile number at billing counter to apply deposit credit.'}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenReceipt(adv.uid)}
                      style={{
                        background: 'rgba(56, 189, 248, 0.12)',
                        border: '1px solid rgba(56, 189, 248, 0.3)',
                        color: '#38bdf8',
                        padding: '0.5rem 1rem',
                        borderRadius: 8,
                        fontWeight: 700,
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        transition: 'all 0.15s ease'
                      }}
                      title="Download Official 58mm Thermal Receipt PDF"
                    >
                      <span>🖨️</span>
                      <span>Official Receipt (PDF)</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
