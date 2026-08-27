import { useState, useEffect } from 'react';
import {
  listAdminOrders,
  shipOrder,
  updateOrderStatus,
  confirmOrderAndPayment,
  revertOrderStatus,
  updateOrderIssueStatus,
  getDemandTrends
} from '../../api/orders.js';
import { getImageUrl } from '../../utils/apiConfig.js';

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [activeTab, setActiveTab] = useState('ALL'); // 'ALL' | 'Pending' | 'Confirmed' | 'Shipped' | 'Closed'
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  // Status Change In-Progress state
  const [updatingUid, setUpdatingUid] = useState(null);

  // Demand Trends Modal State
  const [showDemandModal, setShowDemandModal] = useState(false);
  const [demandData, setDemandData] = useState(null);
  const [loadingDemand, setLoadingDemand] = useState(false);

  // 1. Full Order Details Modal / Drawer State
  const [detailModalOrder, setDetailModalOrder] = useState(null);

  // 2. Stage 1: Order Qty & Payment Confirmation Modal State
  const [confirmPayOrder, setConfirmPayOrder] = useState(null);
  const [payMethod, setPayMethod] = useState('UPI / GPay / PhonePe');
  const [payStatus, setPayStatus] = useState('Paid');
  const [payReference, setPayReference] = useState('');
  const [payRemarks, setPayRemarks] = useState('');
  const [confirmNotes, setConfirmNotes] = useState('');
  const [confirmingPay, setConfirmingPay] = useState(false);

  // 3. Stage 2: Move to Parcel (Shipment) Modal State
  const [shipModalOrder, setShipModalOrder] = useState(null);
  const [shipmentNumber, setShipmentNumber] = useState('');
  const [courierDetails, setCourierDetails] = useState('BlueDart Express');
  const [shippingNotes, setShippingNotes] = useState('');
  const [processingShip, setProcessingShip] = useState(false);
  const [shipError, setShipError] = useState(null);

  // 4. Revert Order Modal State
  const [revertModalOrder, setRevertModalOrder] = useState(null);
  const [revertTargetStatus, setRevertTargetStatus] = useState('Confirmed');
  const [revertReason, setRevertReason] = useState('');
  const [reverting, setReverting] = useState(false);

  // 5. Issue Resolution State inside details
  const [updatingIssue, setUpdatingIssue] = useState(false);

  useEffect(() => {
    loadOrders();
  }, [activeTab, search]);

  async function loadOrders() {
    setLoading(true);
    try {
      const res = await listAdminOrders({ status: activeTab, search });
      const list = res.data?.orders || [];
      setOrders(list);

      // If details modal is open, refresh its data
      if (detailModalOrder) {
        const found = list.find((o) => o.uid === detailModalOrder.uid);
        if (found) setDetailModalOrder(found);
      }
    } catch (e) {
      console.error('Failed to load admin orders:', e);
    } finally {
      setLoading(false);
    }
  }

  // ── Stage 1: Open Payment & Quantity Confirmation Modal ──
  const handleOpenConfirmPay = (order) => {
    setConfirmPayOrder(order);
    setPayMethod(order.payment_method || 'UPI / GPay / PhonePe');
    setPayStatus(order.payment_status === 'Paid' ? 'Paid' : 'Paid');
    setPayReference(order.payment_reference || '');
    setPayRemarks(order.payment_remarks || '');
    setConfirmNotes(order.notes || '');
  };

  const handleSubmitConfirmPay = async (e) => {
    e.preventDefault();
    setConfirmingPay(true);
    try {
      await confirmOrderAndPayment(confirmPayOrder.uid, {
        paymentMethod: payMethod,
        paymentStatus: payStatus,
        paymentReference: payReference.trim(),
        paymentRemarks: payRemarks.trim(),
        notes: confirmNotes.trim()
      });
      alert(`Order #${confirmPayOrder.order_number} confirmed with payment verification! Stock allocated & moved to parcel queue.`);
      setConfirmPayOrder(null);
      loadOrders();
    } catch (err) {
      alert(err.message || 'Failed to confirm order payment');
    } finally {
      setConfirmingPay(false);
    }
  };

  // ── Stage 2: Open Move to Parcel Modal ──
  const handleOpenShipModal = (order) => {
    setShipModalOrder(order);
    setShipmentNumber('');
    setCourierDetails('BlueDart Express');
    setShippingNotes(order.notes || '');
    setShipError(null);
  };

  const handleProcessShipment = async (e) => {
    e.preventDefault();
    if (!shipmentNumber || !shipmentNumber.trim()) {
      setShipError('Shipment Tracking / Parcel Number is mandatory to dispatch.');
      return;
    }

    setProcessingShip(true);
    setShipError(null);
    try {
      await shipOrder(shipModalOrder.uid, {
        shipmentNumber: shipmentNumber.trim(),
        courierDetails: courierDetails.trim(),
        notes: shippingNotes.trim()
      });
      alert(`Order #${shipModalOrder.order_number} moved to Parcel! Tracking ID assigned and marked as In-Transit.`);
      setShipModalOrder(null);
      loadOrders();
    } catch (err) {
      setShipError(err.message || 'Failed to dispatch shipment.');
    } finally {
      setProcessingShip(false);
    }
  };

  // ── Stage 3: Mark as Delivered & Closed ──
  const handleMarkDelivered = async (order) => {
    if (!window.confirm(`Mark Order #${order.order_number} as Product Delivered? This will mark the order as Delivered for the customer and move it to Closed state.`)) {
      return;
    }
    setUpdatingUid(order.uid);
    try {
      await updateOrderStatus(order.uid, 'Delivered');
      loadOrders();
    } catch (e) {
      alert(e.message || 'Could not mark order as delivered');
    } finally {
      setUpdatingUid(null);
    }
  };

  // ── Revert Order ──
  const handleOpenRevertModal = (order) => {
    setRevertModalOrder(order);
    setRevertTargetStatus(order.status === 'Delivered' || order.status === 'Closed' ? 'Shipped' : 'Confirmed');
    setRevertReason('');
  };

  const handleSubmitRevert = async (e) => {
    e.preventDefault();
    setReverting(true);
    try {
      await revertOrderStatus(revertModalOrder.uid, {
        targetStatus: revertTargetStatus,
        reason: revertReason.trim()
      });
      alert(`Order #${revertModalOrder.order_number} successfully reverted to ${revertTargetStatus}.`);
      setRevertModalOrder(null);
      loadOrders();
    } catch (err) {
      alert(err.message || 'Failed to revert order');
    } finally {
      setReverting(false);
    }
  };

  // ── Update Customer Issue Resolution ──
  const handleUpdateIssue = async (orderUid, newIssueStatus) => {
    const adminNotes = prompt(`Update issue status to '${newIssueStatus}'. Enter internal notes or actions taken:`);
    if (adminNotes === null) return;
    setUpdatingIssue(true);
    try {
      await updateOrderIssueStatus(orderUid, {
        issueStatus: newIssueStatus,
        adminResolutionNotes: adminNotes.trim()
      });
      alert(`Issue status updated to ${newIssueStatus}.`);
      loadOrders();
    } catch (err) {
      alert(err.message || 'Failed to update issue status');
    } finally {
      setUpdatingIssue(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Pending':
      case 'Placed':
        return { bg: '#fef3c7', color: '#92400e', label: '⏳ 1. New Order' };
      case 'Confirmed':
        return { bg: '#e0e7ff', color: '#3730a3', label: '📋 2. Confirmed & Paid' };
      case 'Shipped':
        return { bg: '#e0f2fe', color: '#0369a1', label: '🚚 3. In Transit (Parcel Moved)' };
      case 'Delivered':
      case 'Closed':
        return { bg: '#dcfce7', color: '#166534', label: '✓ 4. Delivered (Closed)' };
      case 'Cancelled':
        return { bg: '#fee2e2', color: '#991b1b', label: '✕ Cancelled' };
      default:
        return { bg: '#f1f5f9', color: '#475569', label: status };
    }
  };

  return (
    <div style={{ padding: '1.5rem', maxWidth: 1360, margin: '0 auto' }}>
      {/* Header Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.75rem', color: '#0f172a', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span>📦</span> Order Lifecycle & Reports
          </h1>
          <p style={{ margin: '0.35rem 0 0', color: '#64748b', fontSize: '0.95rem' }}>
            1. Confirm Qty & Payment ➔ 2. Move to Parcel (Tracking #) ➔ 3. Mark Delivered & Closed ➔ Revert capability
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '0.65rem' }}>
          <button
            type="button"
            onClick={handleOpenDemandModal}
            style={{
              padding: '0.6rem 1.15rem',
              background: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontWeight: 800,
              fontSize: '0.86rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              boxShadow: '0 2px 6px rgba(14, 165, 233, 0.3)'
            }}
          >
            📊 Search Demand & Zero-Result Trends
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div style={{
        background: '#fff',
        padding: '1rem 1.25rem',
        borderRadius: 12,
        border: '1px solid #e2e8f0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem',
        marginBottom: '1.5rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
      }}>
        {/* Workflow Stage Tabs */}
        <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
          {[
            { id: 'ALL', label: 'All Orders' },
            { id: 'Pending', label: '⏳ 1. New Orders' },
            { id: 'Confirmed', label: '📋 2. Confirmed / Packing' },
            { id: 'Shipped', label: '🚚 3. In Transit (Parcel)' },
            { id: 'Closed', label: '✓ 4. Delivered / Closed' }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '0.55rem 1.1rem',
                border: 'none',
                borderRadius: 8,
                background: activeTab === tab.id ? '#0f172a' : '#f1f5f9',
                color: activeTab === tab.id ? '#fff' : '#475569',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '0.86rem',
                transition: 'all 0.15s ease'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Live Search Input */}
        <div style={{ minWidth: 280 }}>
          <input
            type="text"
            placeholder="Search Order #, customer name, phone, tracking..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '0.55rem 0.85rem',
              borderRadius: 8,
              border: '1.5px solid #cbd5e1',
              fontSize: '0.88rem'
            }}
          />
        </div>
      </div>

      {/* Orders Table */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
        {loading ? (
          <div style={{ padding: '3.5rem', textAlign: 'center', color: '#64748b' }}>
            <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}>⏳</span>
            Loading orders...
          </div>
        ) : orders.length === 0 ? (
          <div style={{ padding: '3.5rem', textAlign: 'center', color: '#64748b' }}>
            <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.5rem' }}>📦</span>
            No orders found for this stage.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', textAlign: 'left', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                  <th style={{ padding: '0.9rem 1rem' }}>Order Number</th>
                  <th style={{ padding: '0.9rem 1rem' }}>Customer & Contact</th>
                  <th style={{ padding: '0.9rem 1rem' }}>Designs & Items</th>
                  <th style={{ padding: '0.9rem 1rem', textAlign: 'right' }}>Payment & Amount</th>
                  <th style={{ padding: '0.9rem 1rem' }}>Current Stage</th>
                  <th style={{ padding: '0.9rem 1rem' }}>Parcel / Tracking</th>
                  <th style={{ padding: '0.9rem 1rem', textAlign: 'center' }}>Workflow Action</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const badge = getStatusBadge(o.status);
                  const isPending = o.status === 'Pending' || o.status === 'Placed';
                  const isConfirmed = o.status === 'Confirmed';
                  const isShipped = o.status === 'Shipped';
                  const isDelivered = o.status === 'Delivered' || o.status === 'Closed';
                  const isBusy = updatingUid === o.uid;

                  return (
                    <tr
                      key={o.uid}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        background: isBusy ? '#f8fafc' : 'transparent',
                        cursor: 'pointer',
                        transition: 'background 0.15s ease'
                      }}
                      onClick={() => setDetailModalOrder(o)}
                      title="Click anywhere to open full customer & order details"
                    >
                      {/* Order Number & Date */}
                      <td style={{ padding: '0.9rem 1rem', fontWeight: 800, color: '#0f172a' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{ color: '#2563eb' }}>{o.order_number}</span>
                          <span style={{ fontSize: '0.72rem', background: '#eff6ff', color: '#2563eb', padding: '0.1rem 0.35rem', borderRadius: 4, fontWeight: 700 }}>
                            🔍 Details
                          </span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 400, marginTop: '0.2rem' }}>
                          {new Date(o.entry_datetime).toLocaleString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                        {o.issue_type && (
                          <div style={{ marginTop: '0.35rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', background: '#fff1f2', color: '#be123c', padding: '0.15rem 0.45rem', borderRadius: 4, fontSize: '0.74rem', fontWeight: 700 }}>
                            <span>⚠️ {o.issue_type}</span>
                          </div>
                        )}
                      </td>

                      {/* Customer Info */}
                      <td style={{ padding: '0.9rem 1rem' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{o.shipping_name}</div>
                        <div style={{ fontSize: '0.8rem', color: '#475569' }}>📞 {o.shipping_phone}</div>
                        <div style={{ fontSize: '0.78rem', color: '#64748b' }}>📍 {o.shipping_city}, {o.shipping_state}</div>
                      </td>

                      {/* Items */}
                      <td style={{ padding: '0.9rem 1rem' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{o.items?.length || 0} product(s)</div>
                        <div style={{ fontSize: '0.78rem', color: '#64748b', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {o.items?.map(it => `Design #${it.design_number} (×${it.quantity})`).join(', ')}
                        </div>
                      </td>

                      {/* Amount & Payment Info */}
                      <td style={{ padding: '0.9rem 1rem', fontWeight: 800, textAlign: 'right' }}>
                        <div style={{ color: '#0f172a', fontSize: '0.95rem' }}>₹{Number(o.net_amount).toFixed(2)}</div>
                        <div style={{ fontSize: '0.75rem', color: o.payment_status === 'Paid' ? '#166534' : '#854d0e', fontWeight: 700 }}>
                          {o.payment_method} • {o.payment_status || 'Pending'}
                        </div>
                      </td>

                      {/* Stage Badge */}
                      <td style={{ padding: '0.9rem 1rem' }}>
                        <span style={{
                          padding: '0.3rem 0.75rem',
                          borderRadius: 20,
                          fontSize: '0.78rem',
                          fontWeight: 800,
                          background: badge.bg,
                          color: badge.color,
                          display: 'inline-block'
                        }}>
                          {badge.label}
                        </span>
                      </td>

                      {/* Parcel Tracking */}
                      <td style={{ padding: '0.9rem 1rem' }}>
                        {o.shipment_number ? (
                          <div>
                            <div style={{ fontWeight: 800, color: '#0284c7', fontSize: '0.88rem' }}>
                              🏷️ {o.shipment_number}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                              🚚 {o.courier_details || 'Courier Partner'}
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.8rem' }}>
                            {isConfirmed ? '⏳ Ready for Parcel #' : 'Pending Confirmation'}
                          </span>
                        )}
                      </td>

                      {/* Action Buttons */}
                      <td style={{ padding: '0.9rem 1rem', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                        {isPending && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', alignItems: 'center' }}>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleOpenConfirmPay(o)}
                              style={{
                                background: '#2563eb',
                                color: '#fff',
                                border: 'none',
                                padding: '0.5rem 1rem',
                                borderRadius: 8,
                                fontSize: '0.82rem',
                                fontWeight: 800,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                boxShadow: '0 2px 6px rgba(37,99,235,0.25)'
                              }}
                              title="Verify quantities and enter payment details"
                            >
                              <span>✓</span> Confirm Qty & Pay
                            </button>
                            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Stock & Payment verify</span>
                          </div>
                        )}

                        {isConfirmed && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', alignItems: 'center' }}>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleOpenShipModal(o)}
                              style={{
                                background: '#0284c7',
                                color: '#fff',
                                border: 'none',
                                padding: '0.5rem 1rem',
                                borderRadius: 8,
                                fontSize: '0.82rem',
                                fontWeight: 800,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                boxShadow: '0 2px 6px rgba(2,132,199,0.25)'
                              }}
                              title="Enter parcel & tracking details to move to in-transit"
                            >
                              <span>📦</span> Move to Parcel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenRevertModal(o)}
                              style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline' }}
                            >
                              ↩️ Revert
                            </button>
                          </div>
                        )}

                        {isShipped && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', alignItems: 'center' }}>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleMarkDelivered(o)}
                              style={{
                                background: '#16a34a',
                                color: '#fff',
                                border: 'none',
                                padding: '0.5rem 1rem',
                                borderRadius: 8,
                                fontSize: '0.82rem',
                                fontWeight: 800,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                boxShadow: '0 2px 6px rgba(22,163,74,0.25)'
                              }}
                              title="Mark order as delivered to customer & close order"
                            >
                              <span>🏠</span> Product Delivered
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenRevertModal(o)}
                              style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline' }}
                            >
                              ↩️ Revert to Packing
                            </button>
                          </div>
                        )}

                        {isDelivered && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', alignItems: 'center' }}>
                            <div style={{ color: '#166534', fontWeight: 800, fontSize: '0.84rem' }}>
                              ✓ Closed / Delivered
                            </div>
                            <button
                              type="button"
                              onClick={() => handleOpenRevertModal(o)}
                              style={{
                                background: '#f8fafc',
                                border: '1px solid #cbd5e1',
                                color: '#475569',
                                padding: '0.25rem 0.65rem',
                                borderRadius: 6,
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                cursor: 'pointer'
                              }}
                              title="Revert this closed order back to In-Transit or Confirmed"
                            >
                              ↩️ Revert Order
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────────
          1. FULL ORDER & CUSTOMER DETAILS MODAL / DRAWER
      ─────────────────────────────────────────────────────────────────────────────── */}
      {detailModalOrder && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.75)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: '1rem'
          }}
          onClick={() => setDetailModalOrder(null)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 18,
              maxWidth: 860,
              width: '100%',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)',
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Top Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid #e2e8f0',
                background: '#f8fafc'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <span style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0f172a' }}>
                    Order #{detailModalOrder.order_number}
                  </span>
                  <span style={{
                    padding: '0.25rem 0.75rem',
                    borderRadius: 20,
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    ...getStatusBadge(detailModalOrder.status)
                  }}>
                    {getStatusBadge(detailModalOrder.status).label}
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>
                  Placed on {new Date(detailModalOrder.entry_datetime).toLocaleString('en-IN')}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setDetailModalOrder(null)}
                style={{
                  background: '#e2e8f0',
                  border: '1.5px solid #cbd5e1',
                  color: '#0f172a',
                  borderRadius: '50%',
                  width: 36,
                  height: 36,
                  cursor: 'pointer',
                  fontSize: '1.1rem',
                  fontWeight: 900,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease'
                }}
                title="Cancel & Close (Esc)"
              >
                ✕
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div style={{ overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Customer & Shipping Details Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
                <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                  <h4 style={{ margin: '0 0 0.5rem', color: '#0f172a', fontSize: '0.92rem', fontWeight: 800 }}>
                    👤 Customer Information
                  </h4>
                  <div style={{ fontSize: '0.86rem', color: '#334155', lineHeight: 1.6 }}>
                    <div><strong>Name:</strong> {detailModalOrder.shipping_name}</div>
                    <div><strong>Phone:</strong> {detailModalOrder.shipping_phone}</div>
                    {detailModalOrder.shipping_email && <div><strong>Email:</strong> {detailModalOrder.shipping_email}</div>}
                    {detailModalOrder.username && <div><strong>Account:</strong> @{detailModalOrder.username}</div>}
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                  <h4 style={{ margin: '0 0 0.5rem', color: '#0f172a', fontSize: '0.92rem', fontWeight: 800 }}>
                    📍 Destination & Shipping Address
                  </h4>
                  <div style={{ fontSize: '0.86rem', color: '#334155', lineHeight: 1.5 }}>
                    <div>{detailModalOrder.shipping_address}</div>
                    <div>{detailModalOrder.shipping_city}, {detailModalOrder.shipping_state} - <strong>{detailModalOrder.shipping_pincode}</strong></div>
                  </div>
                </div>
              </div>

              {/* Payment & Parcel Tracking Summary */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
                <div style={{ background: '#f0fdf4', padding: '1rem', borderRadius: 12, border: '1px solid #bbf7d0' }}>
                  <h4 style={{ margin: '0 0 0.5rem', color: '#166534', fontSize: '0.92rem', fontWeight: 800 }}>
                    💳 Payment Details
                  </h4>
                  <div style={{ fontSize: '0.86rem', color: '#14532d', lineHeight: 1.6 }}>
                    <div><strong>Method:</strong> {detailModalOrder.payment_method}</div>
                    <div><strong>Status:</strong> <span style={{ fontWeight: 800 }}>{detailModalOrder.payment_status || 'Pending'}</span></div>
                    {detailModalOrder.payment_reference && <div><strong>Ref / UTR:</strong> {detailModalOrder.payment_reference}</div>}
                    {detailModalOrder.payment_remarks && <div><strong>Remarks:</strong> {detailModalOrder.payment_remarks}</div>}
                    <div><strong>Total Amount:</strong> ₹{Number(detailModalOrder.net_amount).toFixed(2)}</div>
                  </div>
                </div>

                <div style={{ background: '#f0f9ff', padding: '1rem', borderRadius: 12, border: '1px solid #bae6fd' }}>
                  <h4 style={{ margin: '0 0 0.5rem', color: '#0369a1', fontSize: '0.92rem', fontWeight: 800 }}>
                    🚚 Parcel & Logistics Tracking
                  </h4>
                  <div style={{ fontSize: '0.86rem', color: '#0c4a6e', lineHeight: 1.6 }}>
                    <div><strong>Courier:</strong> {detailModalOrder.courier_details || 'Not assigned'}</div>
                    <div><strong>Parcel Tracking #:</strong> <strong>{detailModalOrder.shipment_number || 'Pending dispatch'}</strong></div>
                    {detailModalOrder.shipped_at && <div><strong>Dispatched At:</strong> {new Date(detailModalOrder.shipped_at).toLocaleString('en-IN')}</div>}
                    {detailModalOrder.delivered_at && <div><strong>Delivered At:</strong> {new Date(detailModalOrder.delivered_at).toLocaleString('en-IN')}</div>}
                  </div>
                </div>
              </div>

              {/* Customer Reported Issue / Defect Card if applicable */}
              {detailModalOrder.issue_type && (
                <div style={{ background: '#fff1f2', border: '1.5px solid #fecdd3', borderRadius: 12, padding: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <h4 style={{ margin: 0, color: '#be123c', fontSize: '0.95rem', fontWeight: 800 }}>
                      ⚠️ Customer Reported Issue: {detailModalOrder.issue_type}
                    </h4>
                    <select
                      value={detailModalOrder.issue_status || 'Reported'}
                      disabled={updatingIssue}
                      onChange={(e) => handleUpdateIssue(detailModalOrder.uid, e.target.value)}
                      style={{ padding: '0.35rem 0.65rem', borderRadius: 6, border: '1.5px solid #fda4af', fontWeight: 700, fontSize: '0.82rem', background: '#fff', color: '#be123c' }}
                    >
                      <option value="Reported">Reported</option>
                      <option value="Under Investigation">Under Investigation</option>
                      <option value="Replacement Dispatched">Replacement Dispatched</option>
                      <option value="Refund Processed">Refund Processed</option>
                      <option value="Resolved & Closed">Resolved & Closed</option>
                    </select>
                  </div>
                  <div style={{ fontSize: '0.88rem', color: '#881337' }}>
                    <strong>Customer Description:</strong> "{detailModalOrder.issue_description || 'No description provided.'}"
                  </div>
                  {detailModalOrder.issue_reported_at && (
                    <div style={{ fontSize: '0.76rem', color: '#9f1239', marginTop: '0.35rem' }}>
                      Reported on: {new Date(detailModalOrder.issue_reported_at).toLocaleString('en-IN')}
                    </div>
                  )}
                </div>
              )}

              {/* Ordered Items Table */}
              <div>
                <h4 style={{ margin: '0 0 0.75rem', color: '#0f172a', fontSize: '1rem', fontWeight: 800 }}>
                  🖼️ Ordered Wall Decor Designs ({detailModalOrder.items?.length || 0})
                </h4>
                <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                        <th style={{ padding: '0.75rem 1rem' }}>Design Preview</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Design #</th>
                        <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Quantity</th>
                        <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Price / Sheet</th>
                        <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailModalOrder.items?.map((it) => (
                        <tr key={it.uid} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <div style={{ width: 48, height: 48, borderRadius: 6, background: '#f1f5f9', overflow: 'hidden' }}>
                              {it.image_filename ? (
                                <img src={getImageUrl(it.image_filename)} alt={`Design ${it.design_number}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>🖼️</div>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 800, color: '#0f172a' }}>
                            Design #{it.design_number}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 700, textAlign: 'right' }}>
                            {it.quantity} sheet(s)
                          </td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                            ₹{Number(it.unit_price).toFixed(2)}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                            ₹{Number(it.total_price).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {detailModalOrder.notes && (
                <div style={{ background: '#f8fafc', padding: '0.85rem 1rem', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.85rem', color: '#475569' }}>
                  <strong>Internal Notes & Audit Log:</strong>
                  <pre style={{ margin: '0.35rem 0 0', whiteSpace: 'pre-wrap', fontFamily: 'inherit', color: '#334155' }}>
                    {detailModalOrder.notes}
                  </pre>
                </div>
              )}
            </div>

            {/* Modal Bottom Actions */}
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <button
                  type="button"
                  onClick={() => {
                    const o = detailModalOrder;
                    setDetailModalOrder(null);
                    handleOpenRevertModal(o);
                  }}
                  style={{
                    background: '#fff',
                    border: '1.5px solid #cbd5e1',
                    color: '#334155',
                    padding: '0.65rem 1.1rem',
                    borderRadius: 8,
                    fontWeight: 700,
                    fontSize: '0.86rem',
                    cursor: 'pointer'
                  }}
                >
                  ↩️ Revert Order Stage
                </button>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => setDetailModalOrder(null)}
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
                  ✕ Cancel & Close
                </button>

                {(detailModalOrder.status === 'Pending' || detailModalOrder.status === 'Placed') && (
                  <button
                    type="button"
                    onClick={() => {
                      const o = detailModalOrder;
                      setDetailModalOrder(null);
                      handleOpenConfirmPay(o);
                    }}
                    style={{
                      background: '#2563eb',
                      color: '#fff',
                      border: 'none',
                      padding: '0.65rem 1.35rem',
                      borderRadius: 8,
                      fontWeight: 800,
                      cursor: 'pointer',
                      fontSize: '0.88rem'
                    }}
                  >
                    ✓ Confirm Qty & Payment
                  </button>
                )}

                {detailModalOrder.status === 'Confirmed' && (
                  <button
                    type="button"
                    onClick={() => {
                      const o = detailModalOrder;
                      setDetailModalOrder(null);
                      handleOpenShipModal(o);
                    }}
                    style={{
                      background: '#0284c7',
                      color: '#fff',
                      border: 'none',
                      padding: '0.65rem 1.35rem',
                      borderRadius: 8,
                      fontWeight: 800,
                      cursor: 'pointer',
                      fontSize: '0.88rem'
                    }}
                  >
                    📦 Move to Parcel (Enter Tracking)
                  </button>
                )}

                {detailModalOrder.status === 'Shipped' && (
                  <button
                    type="button"
                    onClick={() => {
                      const o = detailModalOrder;
                      setDetailModalOrder(null);
                      handleMarkDelivered(o);
                    }}
                    style={{
                      background: '#16a34a',
                      color: '#fff',
                      border: 'none',
                      padding: '0.65rem 1.35rem',
                      borderRadius: 8,
                      fontWeight: 800,
                      cursor: 'pointer',
                      fontSize: '0.88rem'
                    }}
                  >
                    🏠 Mark as Product Delivered
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          2. STAGE 1: ORDER QTY & PAYMENT CONFIRMATION MODAL
      ─────────────────────────────────────────────────────────────────────────────── */}
      {confirmPayOrder && (
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
          onClick={() => setConfirmPayOrder(null)}
        >
          <div
            style={{
              background: '#fff',
              padding: '1.75rem',
              borderRadius: 16,
              maxWidth: 540,
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 40px rgba(0,0,0,0.25)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a', fontWeight: 800 }}>
                  📋 Confirm Order & Payment
                </h2>
                <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '0.2rem' }}>
                  Order: <strong style={{ color: '#2563eb' }}>{confirmPayOrder.order_number}</strong> • Amount: <strong>₹{Number(confirmPayOrder.net_amount).toFixed(2)}</strong>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConfirmPayOrder(null)}
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

            {/* Order Items Qty Review Summary */}
            <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                Ordered Items & Stock Verification:
              </div>
              <div style={{ fontSize: '0.85rem', color: '#0f172a' }}>
                {confirmPayOrder.items?.map((it, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                    <span>Design #{it.design_number}</span>
                    <strong>{it.quantity} sheet(s) • ₹{Number(it.total_price).toFixed(2)}</strong>
                  </div>
                ))}
              </div>
            </div>

            <form onSubmit={handleSubmitConfirmPay}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.35rem' }}>
                    Payment Mode *
                  </label>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.75rem',
                      borderRadius: 8,
                      border: '1.5px solid #cbd5e1',
                      fontSize: '0.9rem',
                      background: '#fff'
                    }}
                  >
                    <option value="UPI / GPay / PhonePe">UPI / GPay / PhonePe / QR</option>
                    <option value="Bank Transfer">Bank Transfer (NEFT/RTGS/IMPS)</option>
                    <option value="Cash">Cash at Counter</option>
                    <option value="Credit / Debit Card">Credit / Debit Card</option>
                    <option value="Cheque">Cheque</option>
                    <option value="COD">Cash On Delivery (COD)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.35rem' }}>
                    Payment Status *
                  </label>
                  <select
                    value={payStatus}
                    onChange={(e) => setPayStatus(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.75rem',
                      borderRadius: 8,
                      border: '1.5px solid #cbd5e1',
                      fontSize: '0.9rem',
                      background: '#fff'
                    }}
                  >
                    <option value="Paid">Paid / Verified</option>
                    <option value="Partially Paid">Partially Paid</option>
                    <option value="Pending">Pending Payment</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.35rem' }}>
                  Transaction Reference ID / UTR / Cheque #
                </label>
                <input
                  type="text"
                  placeholder="e.g. UPI-984712038102 / UTR-HDFC98213 / CHQ-109"
                  value={payReference}
                  onChange={(e) => setPayReference(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: 8,
                    border: '1.5px solid #cbd5e1',
                    fontSize: '0.9rem'
                  }}
                />
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.35rem' }}>
                  Payment Remarks & Warehouse Packing Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Full amount received via GPay. Verified stock in bay 4, ready for packing..."
                  value={payRemarks}
                  onChange={(e) => setPayRemarks(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: 8,
                    border: '1.5px solid #cbd5e1',
                    fontSize: '0.88rem'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid #f1f5f9' }}>
                <button
                  type="button"
                  onClick={() => setConfirmPayOrder(null)}
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
                  disabled={confirmingPay}
                  style={{
                    padding: '0.65rem 1.4rem',
                    borderRadius: 8,
                    border: 'none',
                    background: '#2563eb',
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(37,99,235,0.3)'
                  }}
                >
                  {confirmingPay ? 'Confirming...' : '✓ Confirm Stock & Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          3. STAGE 2: MOVE TO PARCEL / SHIPMENT MODAL
      ─────────────────────────────────────────────────────────────────────────────── */}
      {shipModalOrder && (
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
          onClick={() => setShipModalOrder(null)}
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a', fontWeight: 800 }}>
                  📦 Move Order to Parcel (In-Transit)
                </h2>
                <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '0.2rem' }}>
                  Order: <strong style={{ color: '#2563eb' }}>{shipModalOrder.order_number}</strong>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShipModalOrder(null)}
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

            <p style={{ margin: '0 0 1.25rem', color: '#475569', fontSize: '0.88rem', background: '#f8fafc', padding: '0.75rem', borderRadius: 8, border: '1px solid #e2e8f0' }}>
              Ship to: <strong>{shipModalOrder.shipping_name}</strong><br />
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                {shipModalOrder.shipping_address}, {shipModalOrder.shipping_city}, {shipModalOrder.shipping_state} - {shipModalOrder.shipping_pincode}
              </span>
            </p>

            {shipError && (
              <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '0.65rem 0.85rem', borderRadius: 8, marginBottom: '1rem', fontSize: '0.85rem', fontWeight: 600 }}>
                ⚠️ {shipError}
              </div>
            )}

            <form onSubmit={handleProcessShipment}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.35rem' }}>
                  Parcel / Tracking Number (Mandatory) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. BD-89240182 / DLHVY-773910 / PARCEL-991"
                  value={shipmentNumber}
                  onChange={(e) => setShipmentNumber(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: 8,
                    border: '1.5px solid #cbd5e1',
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    color: '#0f172a'
                  }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.35rem' }}>
                  Courier / Logistics Partner
                </label>
                <input
                  type="text"
                  placeholder="e.g. BlueDart Express, Delhivery, DTDC, Local Delivery Van"
                  value={courierDetails}
                  onChange={(e) => setCourierDetails(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: 8,
                    border: '1.5px solid #cbd5e1',
                    fontSize: '0.9rem'
                  }}
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.35rem' }}>
                  Dispatch Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Fragile wall panels, packed in wooden crate bay #2..."
                  value={shippingNotes}
                  onChange={(e) => setShippingNotes(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: 8,
                    border: '1.5px solid #cbd5e1',
                    fontSize: '0.88rem'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid #f1f5f9' }}>
                <button
                  type="button"
                  onClick={() => setShipModalOrder(null)}
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
                  disabled={processingShip}
                  style={{
                    padding: '0.65rem 1.4rem',
                    borderRadius: 8,
                    border: 'none',
                    background: '#0284c7',
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(2,132,199,0.3)'
                  }}
                >
                  {processingShip ? 'Moving to Parcel...' : '✓ Confirm & Move to In-Transit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          4. REVERT ORDER STAGE MODAL
      ─────────────────────────────────────────────────────────────────────────────── */}
      {revertModalOrder && (
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
          onClick={() => setRevertModalOrder(null)}
        >
          <div
            style={{
              background: '#fff',
              padding: '1.75rem',
              borderRadius: 16,
              maxWidth: 480,
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 40px rgba(0,0,0,0.25)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a', fontWeight: 800 }}>
                  ↩️ Revert Order #{revertModalOrder.order_number}
                </h2>
                <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '0.2rem' }}>
                  Current Status: <strong style={{ color: '#0f172a' }}>{revertModalOrder.status}</strong>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRevertModalOrder(null)}
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

            <form onSubmit={handleSubmitRevert}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.35rem' }}>
                  Revert Back To Stage *
                </label>
                <select
                  value={revertTargetStatus}
                  onChange={(e) => setRevertTargetStatus(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: 8,
                    border: '1.5px solid #cbd5e1',
                    fontSize: '0.9rem',
                    background: '#fff'
                  }}
                >
                  <option value="Confirmed">📋 2. Confirmed / Packing</option>
                  <option value="Shipped">🚚 3. In Transit (Parcel Moved)</option>
                  <option value="Pending">⏳ 1. New Order (Pending)</option>
                </select>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.35rem' }}>
                  Reason for Revert (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Courier returned parcel, customer requested address correction, defect investigation..."
                  value={revertReason}
                  onChange={(e) => setRevertReason(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: 8,
                    border: '1.5px solid #cbd5e1',
                    fontSize: '0.88rem'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid #f1f5f9' }}>
                <button
                  type="button"
                  onClick={() => setRevertModalOrder(null)}
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
                  disabled={reverting}
                  style={{
                    padding: '0.65rem 1.4rem',
                    borderRadius: 8,
                    border: 'none',
                    background: '#475569',
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: '0.88rem',
                    cursor: 'pointer'
                  }}
                >
                  {reverting ? 'Reverting...' : '↩️ Confirm Revert'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── 5. Demand Insights & Unmet Search Trends Modal ── */}
      {showDemandModal && (
        <div
          onClick={() => setShowDemandModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: 16,
              maxWidth: 780,
              width: '100%',
              maxHeight: '90vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
            }}
          >
            {/* Modal Header */}
            <div style={{ padding: '1.25rem 1.5rem', background: '#0f172a', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>📊</span> Customer Search Demand & Unmet Searches
                </h3>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.82rem', color: '#94a3b8' }}>
                  Real-time analytics on what design numbers and keywords customers are searching for.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDemandModal(false)}
                style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', width: 32, height: 32, borderRadius: 8, cursor: 'pointer', fontWeight: 700 }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
              {loadingDemand ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                  ⏳ Loading search trends...
                </div>
              ) : !demandData ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                  No search logs recorded yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {/* KPI Summary Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '1rem' }}>
                      <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700 }}>TOTAL SEARCHES LOGGED</div>
                      <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#0f172a', marginTop: '0.25rem' }}>
                        {demandData.total_searches || 0}
                      </div>
                    </div>

                    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '1rem' }}>
                      <div style={{ fontSize: '0.78rem', color: '#dc2626', fontWeight: 700 }}>ZERO-RESULT SEARCHES (UNMET)</div>
                      <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#dc2626', marginTop: '0.25rem' }}>
                        {demandData.zero_result_searches || 0}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#991b1b', marginTop: '0.2rem' }}>
                        Potential lost sales due to missing stock
                      </div>
                    </div>
                  </div>

                  {/* Trends Table */}
                  <div>
                    <h4 style={{ margin: '0 0 0.65rem', fontSize: '0.95rem', color: '#0f172a', fontWeight: 800 }}>
                      🔥 Top Customer Search Queries
                    </h4>

                    {(!demandData.demand_trends || demandData.demand_trends.length === 0) ? (
                      <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No specific query trends recorded yet.</p>
                    ) : (
                      <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                          <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                              <th style={{ padding: '0.65rem 0.85rem' }}>Query / Keyword</th>
                              <th style={{ padding: '0.65rem 0.85rem' }}>Type</th>
                              <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>Total Searches</th>
                              <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>0-Result Occurrences</th>
                              <th style={{ padding: '0.65rem 0.85rem' }}>Last Searched</th>
                            </tr>
                          </thead>
                          <tbody>
                            {demandData.demand_trends.map((item, idx) => {
                              const isUnmet = Number(item.zero_results_count) > 0;
                              return (
                                <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', background: isUnmet ? '#fffdfa' : '#fff' }}>
                                  <td style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: '#0f172a' }}>
                                    "{item.query_text}"
                                  </td>
                                  <td style={{ padding: '0.65rem 0.85rem', color: '#64748b' }}>
                                    <span style={{ background: '#e2e8f0', padding: '0.15rem 0.45rem', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600 }}>
                                      {item.search_type}
                                    </span>
                                  </td>
                                  <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center', fontWeight: 800, color: '#0f172a' }}>
                                    {item.search_count}
                                  </td>
                                  <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>
                                    {isUnmet ? (
                                      <span style={{ background: '#fee2e2', color: '#dc2626', padding: '0.15rem 0.5rem', borderRadius: 12, fontWeight: 800, fontSize: '0.78rem' }}>
                                        ⚠️ {item.zero_results_count} times
                                      </span>
                                    ) : (
                                      <span style={{ color: '#16a34a', fontWeight: 700 }}>✓ Found</span>
                                    )}
                                  </td>
                                  <td style={{ padding: '0.65rem 0.85rem', color: '#64748b', fontSize: '0.8rem' }}>
                                    {new Date(item.last_searched_at).toLocaleString()}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '1rem 1.5rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowDemandModal(false)}
                style={{
                  padding: '0.55rem 1.25rem',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  background: '#fff',
                  fontWeight: 700,
                  fontSize: '0.86rem',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
