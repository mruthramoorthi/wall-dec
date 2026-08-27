import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getCustomerOrders, submitProductFeedback, updateOrderStatus, reportOrderIssue } from '../../api/orders.js';
import CustomerNavbar from '../../components/CustomerNavbar.jsx';
import { getImageUrl } from '../../utils/apiConfig.js';

/* ── Interactive Star Rating Picker ── */
function StarRatingPicker({ value, onChange }) {
  const [hoverVal, setHoverVal] = useState(0);
  return (
    <div style={{ display: 'flex', gap: '0.4rem', cursor: 'pointer' }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onMouseEnter={() => setHoverVal(star)}
          onMouseLeave={() => setHoverVal(0)}
          onClick={() => onChange(star)}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            fontSize: '2rem',
            color: (hoverVal || value) >= star ? '#f59e0b' : '#cbd5e1',
            cursor: 'pointer',
            transition: 'transform 0.15s ease, color 0.15s ease',
            transform: (hoverVal || value) >= star ? 'scale(1.15)' : 'scale(1)'
          }}
          title={`${star} Star${star > 1 ? 's' : ''}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export default function OrderTracker({ currentUser }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'IN_TRANSIT' | 'DELIVERED' | 'PROCESSING'
  const [feedbackModal, setFeedbackModal] = useState(null); // { orderUid, stockUid, designNumber, existingRating, existingFeedback }
  const [rating, setRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState('');
  const [comment, setComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [copiedTrackingId, setCopiedTrackingId] = useState(null);

  // Issue / Defect Report Modal State
  const [issueModalOrder, setIssueModalOrder] = useState(null);
  const [issueType, setIssueType] = useState('Defect / Damaged Panels');
  const [issueDescription, setIssueDescription] = useState('');
  const [submittingIssue, setSubmittingIssue] = useState(false);

  useEffect(() => {
    if (currentUser?.uid) {
      loadOrders();
    } else {
      setLoading(false);
    }
  }, [currentUser]);

  async function loadOrders() {
    setLoading(true);
    try {
      const res = await getCustomerOrders(currentUser.uid);
      setOrders(res.data || []);
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleConfirmDelivery = async (orderUid) => {
    if (!window.confirm('Confirm that you have received this wall decor shipment in good condition?')) return;
    try {
      await updateOrderStatus(orderUid, 'Delivered');
      loadOrders();
    } catch (e) {
      alert(e.message || 'Failed to update order status.');
    }
  };

  const handleCopyTracking = (trackingId) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(trackingId);
      setCopiedTrackingId(trackingId);
      setTimeout(() => setCopiedTrackingId(null), 2500);
    }
  };

  const handleFeedbackSubmit = async (e) => {
    e.preventDefault();
    setSubmittingReview(true);
    try {
      await submitProductFeedback({
        userUid: currentUser.uid,
        orderUid: feedbackModal.orderUid,
        stockUid: feedbackModal.stockUid,
        rating,
        reviewTitle: reviewTitle.trim() || null,
        comment: comment.trim() || null,
        reviewerName: `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim() || currentUser.username
      });
      alert('Thank you! Your verified purchase review has been submitted.');
      setFeedbackModal(null);
      setComment('');
      setReviewTitle('');
      setRating(5);
      loadOrders();
    } catch (e) {
      alert(e.message || 'Failed to submit review.');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleOpenIssueModal = (order) => {
    setIssueModalOrder(order);
    setIssueType('Defect / Damaged Panels');
    setIssueDescription(order.issue_description || '');
  };

  const handleIssueSubmit = async (e) => {
    e.preventDefault();
    if (!issueDescription || !issueDescription.trim()) {
      alert('Please describe the issue or defect in detail.');
      return;
    }
    setSubmittingIssue(true);
    try {
      await reportOrderIssue({
        orderUid: issueModalOrder.uid,
        userUid: currentUser.uid,
        issueType,
        issueDescription: issueDescription.trim()
      });
      alert('Your issue / defect report has been submitted. Our support team will investigate and follow up.');
      setIssueModalOrder(null);
      loadOrders();
    } catch (err) {
      alert(err.message || 'Failed to report issue.');
    } finally {
      setSubmittingIssue(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="customer-store-wrapper">
        <CustomerNavbar cartCount={0} currentUser={null} />
        <div style={{ maxWidth: 540, margin: '5rem auto', textAlign: 'center', padding: '2.5rem 1.5rem', background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>
          <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>🔒</span>
          <h2 style={{ margin: '0 0 0.5rem', color: '#0f172a', fontSize: '1.5rem', fontWeight: 800 }}>
            Sign In to Track Your Orders
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.95rem', marginBottom: '1.75rem', lineHeight: 1.5 }}>
            Access your live courier shipments, delivery milestones, and product reviews.
          </p>
          <Link
            to="/login"
            style={{
              padding: '0.75rem 1.75rem',
              background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
              color: '#fff',
              borderRadius: 10,
              textDecoration: 'none',
              fontWeight: 800,
              display: 'inline-block',
              boxShadow: '0 4px 14px rgba(37,99,235,0.35)'
            }}
          >
            🔑 Go to Customer Login
          </Link>
        </div>
      </div>
    );
  }

  // Filter orders by status
  const filteredOrders = orders.filter((o) => {
    if (statusFilter === 'IN_TRANSIT') return o.status === 'Shipped';
    if (statusFilter === 'DELIVERED') return o.status === 'Delivered';
    if (statusFilter === 'PROCESSING') return o.status === 'Pending' || o.status === 'Placed';
    return true;
  });

  return (
    <div className="customer-store-wrapper">
      <CustomerNavbar cartCount={0} currentUser={currentUser} />

      <div style={{ maxWidth: 1080, width: '100%', margin: '1.5rem auto', padding: '0 1.25rem', flex: 1 }}>
        {/* Page Top Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.85rem', color: '#0f172a', fontWeight: 900 }}>
              📦 My Orders & Tracking
            </h1>
            <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.9rem' }}>
              Track live courier progress, shipment transit numbers, and verified product reviews
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            <Link
              to="/track-advances"
              style={{
                padding: '0.6rem 1.15rem',
                borderRadius: 10,
                background: '#f0f9ff',
                color: '#0284c7',
                border: '1.5px solid #bae6fd',
                textDecoration: 'none',
                fontWeight: 700,
                fontSize: '0.88rem'
              }}
            >
              💰 My Advances &amp; Pre-bookings
            </Link>
            <Link
              to="/catalog"
              style={{
                padding: '0.6rem 1.25rem',
                borderRadius: 10,
                background: '#0f172a',
                color: '#fff',
                textDecoration: 'none',
                fontWeight: 700,
                fontSize: '0.88rem',
                boxShadow: '0 2px 8px rgba(15,23,42,0.2)'
              }}
            >
              + Browse More Designs
            </Link>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="cust-category-pills" style={{ marginBottom: '1.5rem' }}>
          <button
            type="button"
            className={`cust-pill ${statusFilter === 'ALL' ? 'active' : ''}`}
            onClick={() => setStatusFilter('ALL')}
          >
            All Orders ({orders.length})
          </button>
          <button
            type="button"
            className={`cust-pill ${statusFilter === 'IN_TRANSIT' ? 'active' : ''}`}
            onClick={() => setStatusFilter('IN_TRANSIT')}
          >
            🚚 In Transit ({orders.filter((o) => o.status === 'Shipped').length})
          </button>
          <button
            type="button"
            className={`cust-pill ${statusFilter === 'DELIVERED' ? 'active' : ''}`}
            onClick={() => setStatusFilter('DELIVERED')}
          >
            ✓ Delivered ({orders.filter((o) => o.status === 'Delivered').length})
          </button>
          <button
            type="button"
            className={`cust-pill ${statusFilter === 'PROCESSING' ? 'active' : ''}`}
            onClick={() => setStatusFilter('PROCESSING')}
          >
            ⏳ Processing ({orders.filter((o) => o.status === 'Pending' || o.status === 'Placed').length})
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#64748b' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>⏳</div>
            <h3>Loading your order history...</h3>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '4rem 2rem',
              background: '#fff',
              borderRadius: 16,
              border: '1px solid #e2e8f0',
              boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
            }}
          >
            <span style={{ fontSize: '3.5rem', display: 'block', marginBottom: '1rem' }}>🛍️</span>
            <h3 style={{ margin: '0 0 0.5rem', color: '#0f172a' }}>No orders found</h3>
            <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              {statusFilter !== 'ALL'
                ? 'No orders match this status filter.'
                : 'You have not placed any orders yet. Discover our luxury wall decor panels today!'}
            </p>
            <Link
              to="/catalog"
              style={{
                padding: '0.65rem 1.5rem',
                background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                color: '#fff',
                borderRadius: 8,
                textDecoration: 'none',
                fontWeight: 700,
                display: 'inline-block'
              }}
            >
              Explore Catalog
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
            {filteredOrders.map((o) => {
              const isDelivered = o.status === 'Delivered' || o.status === 'Closed';
              const isShipped = o.status === 'Shipped' || isDelivered;
              const isConfirmed = o.status === 'Confirmed' || isShipped;
              const isPending = o.status === 'Pending' || o.status === 'Placed';

              return (
                <div
                  key={o.uid}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: 16,
                    padding: '1.75rem',
                    background: '#fff',
                    boxShadow: '0 4px 14px rgba(15,23,42,0.04)'
                  }}
                >
                  {/* Order Top Bar */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      borderBottom: '1px solid #f1f5f9',
                      paddingBottom: '1rem',
                      flexWrap: 'wrap',
                      gap: '0.75rem'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a' }}>
                          Order #{o.order_number}
                        </span>
                        <span
                          style={{
                            padding: '0.25rem 0.75rem',
                            borderRadius: 20,
                            fontSize: '0.78rem',
                            fontWeight: 800,
                            background: isDelivered ? '#dcfce7' : o.status === 'Shipped' ? '#e0f2fe' : o.status === 'Confirmed' ? '#e0e7ff' : '#fef9c3',
                            color: isDelivered ? '#166534' : o.status === 'Shipped' ? '#0369a1' : o.status === 'Confirmed' ? '#3730a3' : '#854d0e'
                          }}
                        >
                          ● {o.status === 'Confirmed' ? 'Confirmed (Stock Ready)' : o.status === 'Shipped' ? 'In Transit' : o.status}
                        </span>
                      </div>
                      <div style={{ color: '#64748b', fontSize: '0.82rem', marginTop: '0.25rem' }}>
                        Placed on{' '}
                        {new Date(o.entry_datetime).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Total Paid</span>
                      <strong style={{ fontSize: '1.35rem', color: '#0f172a', fontWeight: 900 }}>
                        ₹{Number(o.net_amount).toFixed(2)}
                      </strong>
                    </div>
                  </div>

                  {/* ── Visual 4-Step Delivery Timeline Stepper ── */}
                  <div style={{ margin: '1.5rem 0 1.25rem' }}>
                    <div className="cust-stepper" style={{ margin: '0.75rem 0 1rem' }}>
                      {/* Step 1: Placed */}
                      <div className="cust-step-node completed">
                        <div className="cust-step-icon">✓</div>
                        <span className="cust-step-label">Order Placed</span>
                      </div>

                      {/* Step 2: Confirmed (Stock Verified & Packing) */}
                      <div className={`cust-step-node ${isConfirmed ? 'completed' : isPending ? 'active' : ''}`}>
                        <div className="cust-step-icon">{isConfirmed ? '✓' : '⏳'}</div>
                        <span className="cust-step-label">Stock Confirmed</span>
                      </div>

                      {/* Step 3: In Transit (Parcel Moved) */}
                      <div className={`cust-step-node ${isDelivered ? 'completed' : o.status === 'Shipped' ? 'active' : ''}`}>
                        <div className="cust-step-icon">{isDelivered ? '✓' : '🚚'}</div>
                        <span className="cust-step-label">In Transit</span>
                      </div>

                      {/* Step 4: Delivered */}
                      <div className={`cust-step-node ${isDelivered ? 'completed' : ''}`}>
                        <div className="cust-step-icon">{isDelivered ? '✓' : '🏠'}</div>
                        <span className="cust-step-label">Delivered</span>
                      </div>
                    </div>

                    {/* Context Status Banner */}
                    <div style={{
                      marginTop: '0.85rem',
                      padding: '0.65rem 1rem',
                      borderRadius: 10,
                      fontSize: '0.86rem',
                      fontWeight: 600,
                      background: isDelivered ? '#f0fdf4' : o.status === 'Shipped' ? '#f0f9ff' : o.status === 'Confirmed' ? '#eef2ff' : '#fefce8',
                      color: isDelivered ? '#166534' : o.status === 'Shipped' ? '#0369a1' : o.status === 'Confirmed' ? '#3730a3' : '#854d0e',
                      border: `1px solid ${isDelivered ? '#bbf7d0' : o.status === 'Shipped' ? '#bae6fd' : o.status === 'Confirmed' ? '#c7d2fe' : '#fef08a'}`,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      <span>{isDelivered ? '🎉' : o.status === 'Shipped' ? '🚚' : o.status === 'Confirmed' ? '📋' : '⏳'}</span>
                      <span>
                        {isDelivered
                          ? 'Product Delivered! Thank you for shopping with us. Please rate your wall decor panels below.'
                          : o.status === 'Shipped'
                          ? `Order is In Transit via ${o.courier_details || 'Courier Partner'}. Use tracking number below to follow delivery.`
                          : o.status === 'Confirmed'
                          ? 'Order Confirmed: Stock is available in warehouse and package is moving to parcel dispatch.'
                          : 'Order Placed: Awaiting stock verification and admin confirmation.'}
                      </span>
                    </div>
                  </div>

                  {/* Courier Tracking Banner */}
                  {o.shipment_number ? (
                    <div
                      style={{
                        background: '#f0f9ff',
                        border: '1.5px solid #bae6fd',
                        padding: '1rem 1.25rem',
                        borderRadius: 12,
                        margin: '1.25rem 0',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '0.75rem'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#0369a1', fontWeight: 800, fontSize: '0.95rem' }}>
                          <span>🚚 Courier Partner:</span>
                          <span>{o.courier_details || 'Express Surface Logistics'}</span>
                        </div>
                        <div style={{ marginTop: '0.25rem', color: '#0c4a6e', fontSize: '0.88rem' }}>
                          Tracking AWB Number: <strong style={{ color: '#0284c7', letterSpacing: '0.5px' }}>{o.shipment_number}</strong>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleCopyTracking(o.shipment_number)}
                        style={{
                          background: '#fff',
                          border: '1.5px solid #0284c7',
                          color: '#0284c7',
                          padding: '0.45rem 0.85rem',
                          borderRadius: 8,
                          fontWeight: 700,
                          fontSize: '0.82rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem'
                        }}
                      >
                        <span>📋</span>
                        <span>{copiedTrackingId === o.shipment_number ? '✓ Copied!' : 'Copy Tracking Number'}</span>
                      </button>
                    </div>
                  ) : (
                    <div
                      style={{
                        background: '#f8fafc',
                        padding: '0.85rem 1.25rem',
                        borderRadius: 10,
                        margin: '1rem 0',
                        color: '#64748b',
                        fontSize: '0.85rem',
                        border: '1px solid #e2e8f0',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}
                    >
                      <span>ℹ️</span>
                      <span>Order received in warehouse queue. Courier tracking number will be assigned upon dispatch.</span>
                    </div>
                  )}

                  {/* Items List */}
                  <div style={{ margin: '1.25rem 0' }}>
                    <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', color: '#475569', fontWeight: 700 }}>
                      Ordered Panels:
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {o.items?.map((it) => (
                        <div
                          key={it.uid}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            background: '#f8fafc',
                            padding: '0.85rem 1rem',
                            borderRadius: 10,
                            border: '1px solid #e2e8f0',
                            flexWrap: 'wrap',
                            gap: '0.75rem'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                            <div
                              style={{
                                width: 48,
                                height: 48,
                                borderRadius: 8,
                                background: '#e2e8f0',
                                overflow: 'hidden',
                                flexShrink: 0
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
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                                  🖼️
                                </div>
                              )}
                            </div>
                            <div>
                              <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a' }}>
                                Design #{it.design_number}
                              </div>
                              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                Qty: {it.quantity} × ₹{Number(it.unit_price).toFixed(2)}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <span style={{ fontWeight: 800, fontSize: '1rem', color: '#0f172a' }}>
                              ₹{Number(it.total_price).toFixed(2)}
                            </span>

                            {/* Rating Button only if delivered */}
                            {isDelivered && (
                              <button
                                type="button"
                                onClick={() =>
                                  setFeedbackModal({
                                    orderUid: o.uid,
                                    stockUid: it.stock_uid,
                                    designNumber: it.design_number,
                                    existingRating: it.user_rating,
                                    existingFeedback: it.user_feedback
                                  })
                                }
                                style={{
                                  padding: '0.45rem 0.85rem',
                                  fontSize: '0.82rem',
                                  fontWeight: 700,
                                  borderRadius: 8,
                                  background: it.user_rating ? '#fef3c7' : '#fff',
                                  color: it.user_rating ? '#92400e' : '#2563eb',
                                  border: '1.5px solid #cbd5e1',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.35rem'
                                }}
                              >
                                <span>⭐</span>
                                <span>{it.user_rating ? `Rated ${it.user_rating}/5` : 'Rate Panel'}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Issue / Defect Alert Banner if already reported */}
                  {o.issue_type && (
                    <div
                      style={{
                        background: '#fff1f2',
                        border: '1.5px solid #fecdd3',
                        borderRadius: 10,
                        padding: '0.75rem 1rem',
                        marginTop: '1rem',
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: '0.75rem',
                        flexWrap: 'wrap'
                      }}
                    >
                      <div>
                        <div style={{ color: '#be123c', fontWeight: 800, fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span>⚠️</span>
                          <span>Issue Reported: {o.issue_type}</span>
                          <span style={{ background: '#ffe4e6', color: '#9f1239', padding: '0.15rem 0.5rem', borderRadius: 12, fontSize: '0.75rem', fontWeight: 800 }}>
                            {o.issue_status || 'Under Review'}
                          </span>
                        </div>
                        {o.issue_description && (
                          <div style={{ fontSize: '0.82rem', color: '#881337', marginTop: '0.25rem' }}>
                            "{o.issue_description}"
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleOpenIssueModal(o)}
                        style={{
                          background: '#fff',
                          border: '1px solid #fda4af',
                          color: '#be123c',
                          padding: '0.35rem 0.75rem',
                          borderRadius: 6,
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        Update Issue Details
                      </button>
                    </div>
                  )}

                  {/* Bottom Actions & Shipping Address */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderTop: '1px solid #f1f5f9',
                      paddingTop: '1rem',
                      marginTop: '1rem',
                      flexWrap: 'wrap',
                      gap: '0.75rem'
                    }}
                  >
                    <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                      Delivering to: <strong style={{ color: '#0f172a' }}>{o.shipping_name}</strong> ({o.shipping_city}, {o.shipping_state} - {o.shipping_pincode})
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                      {/* Confirm Shipment Received button ONLY when In Transit */}
                      {o.status === 'Shipped' && (
                        <button
                          type="button"
                          onClick={() => handleConfirmDelivery(o.uid)}
                          style={{
                            background: '#16a34a',
                            color: '#fff',
                            border: 'none',
                            padding: '0.6rem 1.25rem',
                            borderRadius: 8,
                            fontWeight: 800,
                            fontSize: '0.88rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            boxShadow: '0 2px 8px rgba(22,163,74,0.3)'
                          }}
                        >
                          ✓ Confirm Shipment Received
                        </button>
                      )}

                      {/* Report Defect / Issue Button */}
                      {(o.status === 'Shipped' || isDelivered) && !o.issue_type && (
                        <button
                          type="button"
                          onClick={() => handleOpenIssueModal(o)}
                          style={{
                            background: '#fff',
                            color: '#e11d48',
                            border: '1.5px solid #fecdd3',
                            padding: '0.55rem 0.95rem',
                            borderRadius: 8,
                            fontWeight: 700,
                            fontSize: '0.82rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem'
                          }}
                          title="Report defective panel, missing delivery, or damaged items"
                        >
                          <span>⚠️</span>
                          <span>Report Defect / Issue</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Defect / Issue Reporting Modal ── */}
        {issueModalOrder && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15,23,42,0.75)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1150,
              padding: '1rem'
            }}
            onClick={() => setIssueModalOrder(null)}
          >
            <div
              style={{
                background: '#fff',
                padding: '1.75rem',
                borderRadius: 16,
                maxWidth: 500,
                width: '100%',
                maxHeight: '90vh',
                overflowY: 'auto',
                boxShadow: '0 20px 40px rgba(0,0,0,0.25)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a', fontWeight: 800 }}>
                  ⚠️ Report Issue: Order #{issueModalOrder.order_number}
                </h3>
                <button
                  type="button"
                  onClick={() => setIssueModalOrder(null)}
                  style={{
                    background: '#f1f5f9',
                    border: '1.5px solid #cbd5e1',
                    color: '#0f172a',
                    borderRadius: '50%',
                    width: 34,
                    height: 34,
                    cursor: 'pointer',
                    fontSize: '1rem',
                    fontWeight: 900,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title="Cancel & Close"
                >
                  ✕
                </button>
              </div>
              <p style={{ margin: '0 0 1.25rem', color: '#64748b', fontSize: '0.85rem' }}>
                If you received defective sheets, damaged packaging, or have not received your package, please let us know.
              </p>

              <form onSubmit={handleIssueSubmit}>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                    Issue Category *
                  </label>
                  <select
                    value={issueType}
                    onChange={(e) => setIssueType(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      borderRadius: 8,
                      border: '1.5px solid #cbd5e1',
                      fontSize: '0.9rem',
                      background: '#fff'
                    }}
                  >
                    <option value="Defect / Damaged Panels">Defect / Damaged Panels</option>
                    <option value="Order Not Received / Missing Delivery">Order Not Received / Missing Delivery</option>
                    <option value="Wrong Design / Item Sent">Wrong Design / Item Sent</option>
                    <option value="Missing Sheet Quantity">Missing Sheet Quantity</option>
                    <option value="Courier / Packaging Damage">Courier / Packaging Damage</option>
                    <option value="Other">Other Query / Problem</option>
                  </select>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                    Describe the Issue / Damage *
                  </label>
                  <textarea
                    rows={4}
                    required
                    placeholder="Provide details about the crack, bend, misprint, or shipment issue..."
                    value={issueDescription}
                    onChange={(e) => setIssueDescription(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      borderRadius: 8,
                      border: '1.5px solid #cbd5e1',
                      fontSize: '0.9rem'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid #f1f5f9' }}>
                  <button
                    type="button"
                    onClick={() => setIssueModalOrder(null)}
                    style={{
                      padding: '0.65rem 1.35rem',
                      borderRadius: 8,
                      border: '1.5px solid #94a3b8',
                      background: '#f1f5f9',
                      color: '#1e293b',
                      fontWeight: 800,
                      fontSize: '0.88rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem'
                    }}
                  >
                    ✕ Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingIssue}
                    style={{
                      padding: '0.65rem 1.4rem',
                      borderRadius: 8,
                      border: 'none',
                      background: '#e11d48',
                      color: '#fff',
                      fontWeight: 800,
                      fontSize: '0.88rem',
                      cursor: 'pointer'
                    }}
                  >
                    {submittingIssue ? 'Submitting...' : 'Submit Issue Report'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── Verified Customer Review & Rating Modal ── */}
        {feedbackModal && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15,23,42,0.75)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1150,
              padding: '1rem'
            }}
            onClick={() => setFeedbackModal(null)}
          >
            <div
              style={{
                background: '#fff',
                padding: '2rem',
                borderRadius: 16,
                maxWidth: 480,
                width: '100%',
                maxHeight: '90vh',
                overflowY: 'auto',
                boxShadow: '0 20px 40px rgba(0,0,0,0.25)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a', fontWeight: 800 }}>
                  Review Design #{feedbackModal.designNumber}
                </h3>
                <button
                  type="button"
                  onClick={() => setFeedbackModal(null)}
                  style={{
                    background: '#f1f5f9',
                    border: '1.5px solid #cbd5e1',
                    color: '#0f172a',
                    borderRadius: '50%',
                    width: 34,
                    height: 34,
                    cursor: 'pointer',
                    fontSize: '1rem',
                    fontWeight: 900,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title="Cancel & Close"
                >
                  ✕
                </button>
              </div>
              <p style={{ margin: '0 0 1.25rem', color: '#64748b', fontSize: '0.88rem' }}>
                Verified purchase review. Share your thoughts on acrylic finish, panel thickness, and packaging.
              </p>

              <form onSubmit={handleFeedbackSubmit}>
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                    Rating (1 to 5 Stars) *
                  </label>
                  <StarRatingPicker value={rating} onChange={setRating} />
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                    Review Headline
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Gorgeous finish and quick shipping"
                    value={reviewTitle}
                    onChange={(e) => setReviewTitle(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.75rem',
                      borderRadius: 8,
                      border: '1.5px solid #cbd5e1',
                      fontSize: '0.9rem'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                    Your Experience & Comments
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Describe how the panel looks on your wall..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.75rem',
                      borderRadius: 8,
                      border: '1.5px solid #cbd5e1',
                      fontSize: '0.9rem',
                      fontFamily: 'inherit',
                      resize: 'vertical'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid #f1f5f9' }}>
                  <button
                    type="button"
                    onClick={() => setFeedbackModal(null)}
                    style={{
                      padding: '0.65rem 1.35rem',
                      borderRadius: 8,
                      border: '1.5px solid #94a3b8',
                      background: '#f1f5f9',
                      color: '#1e293b',
                      fontWeight: 800,
                      fontSize: '0.88rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem'
                    }}
                  >
                    ✕ Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingReview}
                    style={{
                      padding: '0.65rem 1.4rem',
                      borderRadius: 8,
                      background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                      color: '#fff',
                      border: 'none',
                      fontWeight: 800,
                      fontSize: '0.88rem',
                      cursor: submittingReview ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {submittingReview ? 'Submitting...' : 'Post Review'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
