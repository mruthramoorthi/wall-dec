import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { placeOrder } from '../../api/orders.js';
import CustomerNavbar from '../../components/CustomerNavbar.jsx';
import { getImageUrl } from '../../utils/apiConfig.js';

export default function Checkout({
  cart = [],
  currentUser,
  onOrderComplete,
  onUpdateQuantity,
  onRemoveFromCart,
  onClearCart
}) {
  const navigate = useNavigate();

  const [deleteConfirmModal, setDeleteConfirmModal] = useState({
    isOpen: false,
    item: null,
    isClearAll: false
  });

  // Load saved address from localStorage if available
  const [shipping, setShipping] = useState(() => {
    try {
      const saved = localStorage.getItem('saved_shipping_address');
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return {
      name: currentUser ? `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim() : '',
      phone: currentUser?.mobile_number || '',
      email: currentUser?.email || '',
      address: '',
      city: '',
      state: '',
      pincode: ''
    };
  });

  const [saveAddressChecked, setSaveAddressChecked] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState('COD');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [completedOrder, setCompletedOrder] = useState(null);

  // Sync user details if user logs in
  useEffect(() => {
    if (currentUser && !shipping.name) {
      setShipping((prev) => ({
        ...prev,
        name: `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim(),
        phone: prev.phone || currentUser.mobile_number || '',
        email: prev.email || currentUser.email || ''
      }));
    }
  }, [currentUser]);

  const subtotal = cart.reduce(
    (sum, item) => sum + Number(item.selling_price_per_piece || 0) * (item.quantity || 1),
    0
  );
  const isFreeDelivery = subtotal >= 5000;
  const deliveryFee = isFreeDelivery || subtotal === 0 ? 0 : 250;
  const grandTotal = subtotal + deliveryFee;

  const handleSubmitOrder = async (e) => {
    e.preventDefault();
    if (!currentUser) {
      alert('Please log in with your customer account to place and track your orders.');
      navigate('/login');
      return;
    }

    if (!cart.length) {
      setError('Your shopping cart is currently empty.');
      return;
    }

    if (
      !shipping.name ||
      !shipping.phone ||
      !shipping.address ||
      !shipping.city ||
      !shipping.state ||
      !shipping.pincode
    ) {
      setError('Please fill in all mandatory shipping address fields marked with *.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (saveAddressChecked) {
        localStorage.setItem('saved_shipping_address', JSON.stringify(shipping));
      }

      const itemsPayload = cart.map((c) => ({
        stock_uid: c.uid,
        design_number: c.design_number,
        image_filename: c.image_filename || (c.images && c.images[0]),
        quantity: c.quantity || 1,
        unit_price: Number(c.selling_price_per_piece || 0)
      }));

      const res = await placeOrder({
        userUid: currentUser.uid,
        shipping,
        items: itemsPayload,
        paymentMethod
      });

      if (onOrderComplete) onOrderComplete();
      setCompletedOrder({
        orderNumber: res.data?.orderNumber || 'ORD-' + Math.floor(100000 + Math.random() * 900000),
        items: itemsPayload,
        netAmount: grandTotal,
        shipping
      });
    } catch (err) {
      setError(err.message || 'Failed to place order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // If order was placed successfully, show luxury order confirmation view
  if (completedOrder) {
    return (
      <div className="customer-store-wrapper">
        <CustomerNavbar cartCount={0} currentUser={currentUser} />

        <div style={{ maxWidth: 700, margin: '3rem auto', padding: '1.5rem', textAlign: 'center' }}>
          <div
            style={{
              background: '#fff',
              borderRadius: 20,
              padding: '2.5rem 2rem',
              border: '1px solid #e2e8f0',
              boxShadow: '0 20px 40px -10px rgba(15, 23, 42, 0.15)'
            }}
          >
            <div
              style={{
                width: 76,
                height: 76,
                borderRadius: '50%',
                background: '#ecfdf5',
                color: '#10b981',
                fontSize: '2.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.25rem',
                border: '3px solid #a7f3d0'
              }}
            >
              ✓
            </div>

            <h1 style={{ fontSize: '1.85rem', color: '#0f172a', fontWeight: 900, margin: '0 0 0.5rem' }}>
              Order Confirmed!
            </h1>
            <p style={{ color: '#64748b', fontSize: '1rem', margin: '0 0 1.5rem' }}>
              Thank you for choosing WallDec Studio. Your order has been placed into our warehouse queue.
            </p>

            <div
              style={{
                background: '#f8fafc',
                border: '1.5px solid #cbd5e1',
                borderRadius: 12,
                padding: '1.25rem',
                marginBottom: '2rem',
                textAlign: 'left'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ color: '#64748b', fontSize: '0.88rem' }}>Order Reference ID:</span>
                <strong style={{ color: '#2563eb', fontSize: '1.05rem', letterSpacing: '0.5px' }}>
                  {completedOrder.orderNumber}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ color: '#64748b', fontSize: '0.88rem' }}>Total Amount:</span>
                <strong style={{ color: '#0f172a', fontSize: '1.05rem' }}>
                  ₹{Number(completedOrder.netAmount).toFixed(2)}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b', fontSize: '0.88rem' }}>Shipping Destination:</span>
                <span style={{ color: '#0f172a', fontSize: '0.88rem', fontWeight: 600 }}>
                  {completedOrder.shipping.city}, {completedOrder.shipping.state} ({completedOrder.shipping.pincode})
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link
                to="/track-orders"
                style={{
                  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                  color: '#fff',
                  padding: '0.75rem 1.75rem',
                  borderRadius: 10,
                  fontWeight: 800,
                  textDecoration: 'none',
                  fontSize: '0.95rem',
                  boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)'
                }}
              >
                📦 Track Order Live
              </Link>
              <Link
                to="/catalog"
                style={{
                  background: '#f1f5f9',
                  color: '#334155',
                  padding: '0.75rem 1.5rem',
                  borderRadius: 10,
                  fontWeight: 700,
                  textDecoration: 'none',
                  fontSize: '0.95rem',
                  border: '1px solid #cbd5e1'
                }}
              >
                Continue Shopping
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="customer-store-wrapper">
      <CustomerNavbar cartCount={cart.reduce((s, i) => s + (i.quantity || 1), 0)} currentUser={currentUser} />

      <div style={{ maxWidth: 1180, margin: '1.5rem auto', padding: '0 1.25rem', width: '100%' }}>
        {/* Page Top Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.85rem', color: '#0f172a', fontWeight: 900 }}>
              🛍️ Secure Checkout
            </h1>
            <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.9rem' }}>
              Complete your shipping address and confirm your luxury panel order
            </p>
          </div>
          <Link
            to="/catalog"
            style={{
              color: '#2563eb',
              textDecoration: 'none',
              fontWeight: 700,
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
          >
            ← Back to Catalog
          </Link>
        </div>

        {/* Stepper Progress Bar */}
        <div className="cust-stepper">
          <div className="cust-step-node completed">
            <div className="cust-step-icon">✓</div>
            <span className="cust-step-label">1. Cart Items</span>
          </div>
          <div className="cust-step-node active">
            <div className="cust-step-icon">2</div>
            <span className="cust-step-label">2. Shipping Details</span>
          </div>
          <div className="cust-step-node active">
            <div className="cust-step-icon">3</div>
            <span className="cust-step-label">3. Payment</span>
          </div>
          <div className="cust-step-node">
            <div className="cust-step-icon">4</div>
            <span className="cust-step-label">4. Confirmation</span>
          </div>
        </div>

        {error && (
          <div
            style={{
              background: '#fef2f2',
              color: '#b91c1c',
              border: '1.5px solid #fecaca',
              padding: '1rem',
              borderRadius: 12,
              marginBottom: '1.5rem',
              fontWeight: 600,
              fontSize: '0.92rem'
            }}
          >
            ⚠️ {error}
          </div>
        )}

        {/* Main Grid: Shipping Form (Left) & Live Order Summary (Right) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: '2rem',
            alignItems: 'start'
          }}
        >
          {/* ── Left Column: Shipping & Payment Form ── */}
          <div
            style={{
              background: '#fff',
              padding: '1.75rem',
              borderRadius: 16,
              border: '1px solid #e2e8f0',
              boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
            }}
          >
            <form onSubmit={handleSubmitOrder} id="checkout-form">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h2 style={{ fontSize: '1.25rem', margin: 0, color: '#0f172a', fontWeight: 800 }}>
                  📍 Shipping Address
                </h2>
                {currentUser && (
                  <span style={{ fontSize: '0.78rem', color: '#16a34a', fontWeight: 700 }}>
                    ✓ Logged In as {currentUser.first_name || currentUser.username}
                  </span>
                )}
              </div>

              {/* Name & Phone */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.3rem' }}>
                    Full Name *
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="Recipient's full name"
                    value={shipping.name}
                    onChange={(e) => setShipping({ ...shipping, name: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      borderRadius: 8,
                      border: '1.5px solid #cbd5e1',
                      fontSize: '0.92rem'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.3rem' }}>
                    Phone Number (10 Digits) *
                  </label>
                  <input
                    required
                    type="tel"
                    placeholder="e.g. 9876543210"
                    value={shipping.phone}
                    onChange={(e) => setShipping({ ...shipping, phone: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      borderRadius: 8,
                      border: '1.5px solid #cbd5e1',
                      fontSize: '0.92rem'
                    }}
                  />
                </div>
              </div>

              {/* Email Address */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.3rem' }}>
                  Email Address (For Tracking Updates)
                </label>
                <input
                  type="email"
                  placeholder="your.email@example.com"
                  value={shipping.email}
                  onChange={(e) => setShipping({ ...shipping, email: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: 8,
                    border: '1.5px solid #cbd5e1',
                    fontSize: '0.92rem'
                  }}
                />
              </div>

              {/* Street Address */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.3rem' }}>
                  Street Address / Flat / Building / Landmark *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Complete street address for courier delivery"
                  value={shipping.address}
                  onChange={(e) => setShipping({ ...shipping, address: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: 8,
                    border: '1.5px solid #cbd5e1',
                    fontSize: '0.92rem',
                    fontFamily: 'inherit',
                    resize: 'vertical'
                  }}
                />
              </div>

              {/* City, State, Pincode */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.3rem' }}>
                    City *
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. Mumbai"
                    value={shipping.city}
                    onChange={(e) => setShipping({ ...shipping, city: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      borderRadius: 8,
                      border: '1.5px solid #cbd5e1',
                      fontSize: '0.92rem'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.3rem' }}>
                    State *
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. Maharashtra"
                    value={shipping.state}
                    onChange={(e) => setShipping({ ...shipping, state: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      borderRadius: 8,
                      border: '1.5px solid #cbd5e1',
                      fontSize: '0.92rem'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.3rem' }}>
                    Pincode *
                  </label>
                  <input
                    required
                    type="text"
                    maxLength={6}
                    placeholder="e.g. 400001"
                    value={shipping.pincode}
                    onChange={(e) => setShipping({ ...shipping, pincode: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      borderRadius: 8,
                      border: '1.5px solid #cbd5e1',
                      fontSize: '0.92rem'
                    }}
                  />
                </div>
              </div>

              {/* Save Address Toggle */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.75rem', cursor: 'pointer', fontSize: '0.85rem', color: '#475569' }}>
                <input
                  type="checkbox"
                  checked={saveAddressChecked}
                  onChange={(e) => setSaveAddressChecked(e.target.checked)}
                />
                Save this address for fast 1-click checkout in future
              </label>

              {/* ── Payment Method Selector Cards ── */}
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1.25rem', marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.15rem', color: '#0f172a', fontWeight: 800, margin: '0 0 1rem' }}>
                  💳 Select Payment Mode
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  {/* COD Card */}
                  <label
                    style={{
                      border: paymentMethod === 'COD' ? '2px solid #2563eb' : '1.5px solid #cbd5e1',
                      background: paymentMethod === 'COD' ? '#eff6ff' : '#fff',
                      borderRadius: 12,
                      padding: '1rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.75rem',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="COD"
                      checked={paymentMethod === 'COD'}
                      onChange={() => setPaymentMethod('COD')}
                      style={{ marginTop: '0.2rem' }}
                    />
                    <div>
                      <strong style={{ display: 'block', color: '#0f172a', fontSize: '0.95rem' }}>
                        💵 Cash On Delivery
                      </strong>
                      <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                        Pay cash or UPI upon courier arrival at doorstep
                      </span>
                    </div>
                  </label>

                  {/* Online / UPI Card */}
                  <label
                    style={{
                      border: paymentMethod === 'ONLINE' ? '2px solid #2563eb' : '1.5px solid #cbd5e1',
                      background: paymentMethod === 'ONLINE' ? '#eff6ff' : '#fff',
                      borderRadius: 12,
                      padding: '1rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.75rem',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="ONLINE"
                      checked={paymentMethod === 'ONLINE'}
                      onChange={() => setPaymentMethod('ONLINE')}
                      style={{ marginTop: '0.2rem' }}
                    />
                    <div>
                      <strong style={{ display: 'block', color: '#0f172a', fontSize: '0.95rem' }}>
                        ⚡ UPI / Cards / Netbanking
                      </strong>
                      <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                        Instant automated warehouse priority processing
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || cart.length === 0}
                style={{
                  width: '100%',
                  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                  color: '#fff',
                  border: 'none',
                  padding: '1rem',
                  borderRadius: 12,
                  fontSize: '1.05rem',
                  fontWeight: 900,
                  cursor: loading || cart.length === 0 ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  transition: 'transform 0.15s ease'
                }}
              >
                {loading ? '⏳ Processing Order...' : `✓ Place Order • ₹${grandTotal.toFixed(2)}`}
              </button>
            </form>
          </div>

          {/* ── Right Column: Live Order Summary & In-place Cart Editor ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div
              style={{
                background: '#fff',
                padding: '1.5rem',
                borderRadius: 16,
                border: '1px solid #e2e8f0',
                boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a', fontWeight: 800 }}>
                  Order Summary ({cart.reduce((s, i) => s + (i.quantity || 1), 0)} items)
                </h3>
              </div>

              {cart.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#64748b' }}>
                  Your shopping cart is empty.{' '}
                  <Link to="/catalog" style={{ color: '#2563eb', fontWeight: 700 }}>
                    Browse Wall Decor Designs
                  </Link>
                </div>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                    maxHeight: 340,
                    overflowY: 'auto',
                    marginBottom: '1.25rem',
                    paddingRight: '0.25rem'
                  }}
                >
                  {cart.map((item) => {
                    const itemImg = item.image_filename || (item.images && item.images[0]);
                    const itemPrice = Number(item.selling_price_per_piece || 0);
                    const qty = item.quantity || 1;

                    return (
                      <div
                        key={item.uid}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.85rem',
                          background: '#f8fafc',
                          padding: '0.75rem',
                          borderRadius: 10,
                          border: '1px solid #e2e8f0'
                        }}
                      >
                        <div
                          style={{
                            width: 52,
                            height: 52,
                            borderRadius: 6,
                            background: '#e2e8f0',
                            overflow: 'hidden',
                            flexShrink: 0
                          }}
                        >
                          {itemImg ? (
                            <img
                              src={getImageUrl(itemImg, 'icon')}
                              alt={`Design ${item.design_number}`}
                              loading="lazy"
                              decoding="async"
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                              🖼️
                            </div>
                          )}
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <strong style={{ display: 'block', fontSize: '0.92rem', color: '#0f172a' }}>
                            Design #{item.design_number}
                          </strong>
                          <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                            ₹{itemPrice.toFixed(2)} each
                          </span>
                        </div>

                        {/* In-place Stepper */}
                        {onUpdateQuantity && (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              background: '#fff',
                              borderRadius: 6,
                              border: '1px solid #cbd5e1',
                              padding: '0.1rem'
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => onUpdateQuantity(item.uid, Math.max(1, qty - 1))}
                              style={{
                                width: 22,
                                height: 22,
                                border: 'none',
                                background: 'none',
                                cursor: 'pointer',
                                fontWeight: 700
                              }}
                            >
                              −
                            </button>
                            <span style={{ padding: '0 0.4rem', fontSize: '0.85rem', fontWeight: 800 }}>
                              {qty}
                            </span>
                            <button
                              type="button"
                              onClick={() => onUpdateQuantity(item.uid, qty + 1)}
                              style={{
                                width: 22,
                                height: 22,
                                border: 'none',
                                background: 'none',
                                cursor: 'pointer',
                                fontWeight: 700
                              }}
                            >
                              +
                            </button>
                          </div>
                        )}

                        <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>
                          ₹{(itemPrice * qty).toFixed(2)}
                        </strong>

                        {onRemoveFromCart && (
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmModal({ isOpen: true, item, isClearAll: false })}
                            style={{
                              background: '#fef2f2',
                              border: '1px solid #fecaca',
                              borderRadius: 6,
                              color: '#dc2626',
                              cursor: 'pointer',
                              padding: '0.2rem 0.45rem',
                              fontSize: '0.85rem'
                            }}
                            title="Remove from cart"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Price Calculation Table */}
              <div style={{ borderTop: '1.5px dashed #cbd5e1', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', color: '#64748b' }}>
                  <span>Items Subtotal</span>
                  <strong style={{ color: '#0f172a' }}>₹{subtotal.toFixed(2)}</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', color: '#64748b' }}>
                  <span>Estimated GST (Included)</span>
                  <span style={{ color: '#0f172a' }}>₹{((subtotal * 18) / 118).toFixed(2)} (18%)</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', color: '#64748b' }}>
                  <span>Courier Shipping Fee</span>
                  <span style={{ color: isFreeDelivery ? '#16a34a' : '#0f172a', fontWeight: 700 }}>
                    {isFreeDelivery ? 'FREE SHIPPING' : `₹${deliveryFee.toFixed(2)}`}
                  </span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '1.25rem',
                    fontWeight: 900,
                    color: '#0f172a',
                    borderTop: '1.5px solid #e2e8f0',
                    paddingTop: '0.75rem',
                    marginTop: '0.35rem'
                  }}
                >
                  <span>Grand Total</span>
                  <span style={{ color: '#2563eb' }}>₹{grandTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Trust Badges */}
            <div
              style={{
                background: '#f8fafc',
                padding: '1rem 1.25rem',
                borderRadius: 12,
                border: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                fontSize: '0.82rem',
                color: '#475569'
              }}
            >
              <span style={{ fontSize: '1.75rem' }}>🛡️</span>
              <div>
                <strong style={{ display: 'block', color: '#0f172a' }}>100% Genuine Guaranteed Panels</strong>
                <span>Direct warehouse dispatch with high-durability transit packaging</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Delete Item Confirmation Modal Pop-up ── */}
      {deleteConfirmModal.isOpen && (
        <div
          onClick={() => setDeleteConfirmModal({ isOpen: false, item: null, isClearAll: false })}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 100020,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: 16,
              padding: '1.5rem',
              maxWidth: 380,
              width: '100%',
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
              textAlign: 'center',
              animation: 'popIn 0.2s ease-out'
            }}
          >
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                background: '#fee2e2',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.6rem',
                margin: '0 auto 1rem'
              }}
            >
              🗑️
            </div>

            <h4 style={{ margin: '0 0 0.4rem', color: '#0f172a', fontSize: '1.15rem', fontWeight: 900 }}>
              Remove Item from Order?
            </h4>

            <p style={{ margin: '0 0 1.5rem', color: '#64748b', fontSize: '0.88rem', lineHeight: 1.45 }}>
              Are you sure you want to remove Design #{deleteConfirmModal.item?.design_number} ({deleteConfirmModal.item?.quantity || 1} sheet{(deleteConfirmModal.item?.quantity || 1) > 1 ? 's' : ''}) from your checkout order?
            </p>

            <div style={{ display: 'flex', gap: '0.65rem' }}>
              <button
                type="button"
                onClick={() => setDeleteConfirmModal({ isOpen: false, item: null, isClearAll: false })}
                style={{
                  flex: 1,
                  padding: '0.65rem 1rem',
                  borderRadius: 10,
                  border: '1.5px solid #cbd5e1',
                  background: '#f8fafc',
                  color: '#334155',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  cursor: 'pointer'
                }}
              >
                ✕ Cancel
              </button>

              <button
                type="button"
                onClick={() => {
                  if (deleteConfirmModal.item) {
                    onRemoveFromCart(deleteConfirmModal.item.uid);
                  }
                  setDeleteConfirmModal({ isOpen: false, item: null, isClearAll: false });
                }}
                style={{
                  flex: 1,
                  padding: '0.65rem 1rem',
                  borderRadius: 10,
                  border: 'none',
                  background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  boxShadow: '0 3px 10px rgba(220, 38, 38, 0.35)'
                }}
              >
                🗑️ Yes, Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
