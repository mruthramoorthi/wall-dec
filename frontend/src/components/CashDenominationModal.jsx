import { useState, useEffect } from 'react';

const DENOMINATIONS = [500, 200, 100, 50, 20, 10, 5, 2, 1];

const inr = (n) =>
  Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function CashDenominationModal({
  isOpen,
  requiredAmount = 0,
  initialDenominations = null,
  initialTendered = null,
  onApply,
  onClose
}) {
  const [counts, setCounts] = useState({});
  const [directTendered, setDirectTendered] = useState('');
  const [isDirectMode, setIsDirectMode] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (initialDenominations && typeof initialDenominations === 'object') {
        setCounts({ ...initialDenominations });
        setIsDirectMode(false);
      } else if (initialTendered) {
        setDirectTendered(String(initialTendered));
        setIsDirectMode(true);
      } else {
        setCounts({});
        setDirectTendered('');
        setIsDirectMode(false);
      }
    }
  }, [isOpen, initialDenominations, initialTendered]);

  if (!isOpen) return null;

  const handleCountChange = (denom, val) => {
    const num = Math.max(0, parseInt(val, 10) || 0);
    setCounts((prev) => {
      const next = { ...prev };
      if (num === 0) delete next[denom];
      else next[denom] = num;
      return next;
    });
    setIsDirectMode(false);
  };

  const computedFromDenominations = DENOMINATIONS.reduce(
    (sum, d) => sum + d * (Number(counts[d]) || 0),
    0
  );

  const totalTendered = isDirectMode && directTendered !== ''
    ? Number(directTendered) || 0
    : computedFromDenominations;

  const billAmt = Number(requiredAmount) || 0;
  const changeToReturn = Math.max(0, Math.round((totalTendered - billAmt) * 100) / 100);

  const handleApply = () => {
    onApply({
      denominations: Object.keys(counts).length > 0 ? counts : null,
      tendered_amount: totalTendered > 0 ? totalTendered : billAmt,
      change_returned: changeToReturn,
      amount: billAmt
    });
    onClose();
  };

  const handleReset = () => {
    setCounts({});
    setDirectTendered('');
    setIsDirectMode(false);
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 99999 }}>
      <div
        className="modal-box"
        style={{
          maxWidth: '560px',
          width: '95vw',
          padding: '1.25rem',
          borderRadius: '12px',
          background: '#fff',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
          maxHeight: '90vh',
          overflowY: 'auto'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.65rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span>💵</span> Cash Denomination & Change Calculator
            </h3>
            <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
              Optional breakdown of currency notes received and balance return
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: '#f1f5f9',
              border: 'none',
              borderRadius: '50%',
              width: '30px',
              height: '30px',
              cursor: 'pointer',
              fontWeight: 'bold',
              color: '#64748b'
            }}
          >
            ✕
          </button>
        </div>

        {/* Amount requirement card */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '0.65rem',
            background: '#f8fafc',
            padding: '0.75rem',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            marginBottom: '1rem',
            textAlign: 'center'
          }}
        >
          <div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Amount Due</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', marginTop: '0.2rem' }}>
              ₹{inr(billAmt)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#0284c7', textTransform: 'uppercase', fontWeight: 600 }}>Cash Tendered</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0284c7', marginTop: '0.2rem' }}>
              ₹{inr(totalTendered)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: changeToReturn > 0 ? '#16a34a' : '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Change to Return</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: changeToReturn > 0 ? '#16a34a' : '#94a3b8', marginTop: '0.2rem' }}>
              ₹{inr(changeToReturn)}
            </div>
          </div>
        </div>

        {/* Denomination Input Table */}
        <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', marginBottom: '1rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f1f5f9', color: '#475569', textAlign: 'left' }}>
                <th style={{ padding: '0.45rem 0.75rem' }}>Note / Coin</th>
                <th style={{ padding: '0.45rem 0.75rem', textAlign: 'center', width: '100px' }}>Count (Pcs)</th>
                <th style={{ padding: '0.45rem 0.75rem', textAlign: 'right' }}>Total (₹)</th>
              </tr>
            </thead>
            <tbody>
              {DENOMINATIONS.map((d) => {
                const count = counts[d] || '';
                const lineTotal = d * (Number(count) || 0);
                return (
                  <tr key={d} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.4rem 0.75rem', fontWeight: 600, color: '#334155' }}>
                      ₹{d}
                    </td>
                    <td style={{ padding: '0.4rem 0.75rem', textAlign: 'center' }}>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={count}
                        onChange={(e) => handleCountChange(d, e.target.value)}
                        style={{
                          width: '70px',
                          padding: '0.3rem 0.4rem',
                          textAlign: 'center',
                          border: '1px solid #cbd5e1',
                          borderRadius: '4px',
                          fontSize: '0.85rem',
                          fontWeight: 600
                        }}
                      />
                    </td>
                    <td style={{ padding: '0.4rem 0.75rem', textAlign: 'right', fontWeight: 600, color: lineTotal > 0 ? '#0f172a' : '#94a3b8' }}>
                      ₹{inr(lineTotal)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Quick direct tender input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', background: '#f8fafc', padding: '0.65rem 0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
          <label style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 600, flex: '0 0 auto' }}>
            Or Direct Cash Tendered (₹):
          </label>
          <input
            type="number"
            min="0"
            step="any"
            placeholder={billAmt ? String(billAmt) : '0'}
            value={directTendered}
            onChange={(e) => {
              setDirectTendered(e.target.value);
              setIsDirectMode(true);
            }}
            style={{
              flex: 1,
              padding: '0.35rem 0.5rem',
              border: '1px solid #cbd5e1',
              borderRadius: '4px',
              fontSize: '0.88rem',
              fontWeight: 700
            }}
          />
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            type="button"
            onClick={handleReset}
            style={{
              background: '#f1f5f9',
              color: '#64748b',
              border: '1px solid #cbd5e1',
              padding: '0.5rem 0.85rem',
              borderRadius: '6px',
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            Clear / Reset
          </button>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: '#fff',
                color: '#475569',
                border: '1px solid #cbd5e1',
                padding: '0.5rem 0.85rem',
                borderRadius: '6px',
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              style={{
                background: '#16a34a',
                color: '#fff',
                border: 'none',
                padding: '0.5rem 1.15rem',
                borderRadius: '6px',
                fontSize: '0.85rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              ✓ Apply to Payment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
