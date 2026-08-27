import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getImageUrl } from '../utils/apiConfig.js';
import { verifyCartStock } from '../api/orders.js';

export default function CartDrawer({
  isOpen,
  onClose,
  cart = [],
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
  const [stockStatus, setStockStatus] = useState({ can_proceed: true, items: [] });
  const [verifyingStock, setVerifyingStock] = useState(false);

  useEffect(() => {
    if (!isOpen || !cart.length) {
      setStockStatus({ can_proceed: true, items: [] });
      return;
    }

    let isMounted = true;
    setVerifyingStock(true);

    const payload = cart.map((i) => ({
      stock_uid: i.stock_uid || i.uid,
      quantity: Number(i.quantity) || 1,
      design_number: i.design_number
    }));

    verifyCartStock(payload)
      .then((res) => {
        if (isMounted && res && res.data) {
          setStockStatus(res.data);
        }
      })
      .catch((err) => {
        console.warn('Pre-flight stock check error:', err.message);
      })
      .finally(() => {
        if (isMounted) setVerifyingStock(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, cart]);

  if (!isOpen) return null;

  const totalItems = cart.reduce((sum, i) => sum + (Number(i.quantity) || 1), 0);
  const subtotal = cart.reduce(
    (sum, i) => sum + Number(i.selling_price_per_piece || 0) * (Number(i.quantity) || 1),
    0
  );

  const freeDeliveryThreshold = 5000;
  const isFreeDelivery = subtotal >= freeDeliveryThreshold;
  const remainingForFree = Math.max(0, freeDeliveryThreshold - subtotal);
  const progressPercent = Math.min(100, (subtotal / freeDeliveryThreshold) * 100);

  const handleCheckoutClick = () => {
    onClose();
    navigate('/checkout');
  };

  const handleConfirmDelete = () => {
    if (deleteConfirmModal.isClearAll) {
      if (onClearCart) {
        onClearCart();
      } else {
        cart.forEach((i) => onRemoveFromCart(i.uid));
      }
    } else if (deleteConfirmModal.item) {
      onRemoveFromCart(deleteConfirmModal.item.uid);
    }
    setDeleteConfirmModal({ isOpen: false, item: null, isClearAll: false });
  };

  return (
    <div className="cust-drawer-overlay" onClick={onClose}>
      <div className="cust-drawer-content" onClick={(e) => e.stopPropagation()}>
        {/* Drawer Header */}
        <div
          style={{
            padding: '1.15rem 1.35rem',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#f8fafc'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span style={{ fontSize: '1.4rem' }}>🛒</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a', fontWeight: 800 }}>
                Shopping Cart
              </h3>
              <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                {totalItems} {totalItems === 1 ? 'item' : 'items'} selected
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {cart.length > 0 && (
              <button
                type="button"
                onClick={() => setDeleteConfirmModal({ isOpen: true, item: null, isClearAll: true })}
                style={{
                  background: '#fee2e2',
                  color: '#dc2626',
                  border: '1px solid #fca5a5',
                  padding: '0.35rem 0.65rem',
                  borderRadius: 8,
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  transition: 'all 0.15s ease'
                }}
                title="Clear all items from your cart"
              >
                <span>🗑️</span>
                <span>Clear All</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              style={{
                background: '#e2e8f0',
                border: 'none',
                width: 32,
                height: 32,
                borderRadius: '50%',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                color: '#475569',
                fontSize: '1rem',
                transition: 'background 0.15s'
              }}
              title="Close Drawer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Free Shipping Progress Indicator */}
        <div
          style={{
            background: isFreeDelivery ? '#ecfdf5' : '#eff6ff',
            padding: '0.75rem 1.25rem',
            borderBottom: '1px solid #e2e8f0'
          }}
        >
          <div
            style={{
              fontSize: '0.8rem',
              fontWeight: 700,
              color: isFreeDelivery ? '#047857' : '#1d4ed8',
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '0.35rem'
            }}
          >
            <span>{isFreeDelivery ? '🎉 Congratulations! You have Free Shipping' : '🚚 Fast Safe Delivery'}</span>
            <span>{!isFreeDelivery && `Add ₹${remainingForFree.toFixed(0)} for Free Delivery`}</span>
          </div>
          <div
            style={{
              height: 6,
              background: 'rgba(0,0,0,0.08)',
              borderRadius: 3,
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${progressPercent}%`,
                background: isFreeDelivery ? '#10b981' : '#2563eb',
                borderRadius: 3,
                transition: 'width 0.3s ease'
              }}
            />
          </div>
        </div>

        {/* Cart Item List Container */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem' }}>
          {cart.length === 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                textAlign: 'center',
                color: '#64748b',
                padding: '2rem 1rem'
              }}
            >
              <span style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>🛍️</span>
              <h4 style={{ margin: '0 0 0.35rem', color: '#0f172a', fontSize: '1.1rem' }}>
                Your cart is empty
              </h4>
              <p style={{ margin: '0 0 1.5rem', fontSize: '0.85rem' }}>
                Browse our luxury wall decor panels and find the perfect match for your space.
              </p>
              <button
                type="button"
                onClick={onClose}
                style={{
                  background: '#0f172a',
                  color: '#fff',
                  border: 'none',
                  padding: '0.65rem 1.35rem',
                  borderRadius: 10,
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  cursor: 'pointer'
                }}
              >
                Start Exploring
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {cart.map((item) => {
                const itemImg = item.image_filename || (item.images && item.images[0]);
                const itemPrice = Number(item.selling_price_per_piece || 0);
                const currentQty = Number(item.quantity) || 1;
                const itemTotal = itemPrice * currentQty;

                const itemStockInfo = stockStatus.items?.find(
                  (s) => s.stock_uid === item.uid || s.stock_uid === item.stock_uid
                );
                const liveAvailable = itemStockInfo ? itemStockInfo.available_pcs : Number(item.available_pcs ?? 99);
                const isItemSoldOut = itemStockInfo ? itemStockInfo.is_sold_out : liveAvailable <= 0;
                const isInsufficient = itemStockInfo ? !itemStockInfo.is_available : currentQty > liveAvailable;
                const isLow = itemStockInfo ? itemStockInfo.is_low_stock : (liveAvailable > 0 && liveAvailable <= 5);

                return (
                  <div
                    key={item.uid}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      background: isItemSoldOut ? '#fef2f2' : isInsufficient ? '#fffbeb' : '#fff',
                      border: isItemSoldOut ? '1.5px solid #fecaca' : isInsufficient ? '1.5px solid #fde68a' : '1px solid #e2e8f0',
                      borderRadius: 12,
                      padding: '0.75rem',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ display: 'flex', gap: '0.85rem' }}>
                      {/* Thumbnail */}
                      <div
                        style={{
                          width: 72,
                          height: 72,
                          borderRadius: 8,
                          background: '#f1f5f9',
                          overflow: 'hidden',
                          flexShrink: 0,
                          position: 'relative'
                        }}
                      >
                        {itemImg ? (
                          <img
                            src={getImageUrl(itemImg, 'icon')}
                            alt={`Design #${item.design_number}`}
                            loading="lazy"
                            decoding="async"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="%2394a3b8"><rect width="24" height="24" fill="%23f1f5f9"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="6">Photo</text></svg>';
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              height: '100%',
                              fontSize: '1.5rem'
                            }}
                          >
                            🖼️
                          </div>
                        )}
                      </div>

                      {/* Details & Stepper */}
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start'
                          }}
                        >
                          <div>
                            <span
                              style={{
                                fontSize: '0.75rem',
                                fontWeight: 800,
                                color: '#2563eb',
                                background: '#eff6ff',
                                padding: '0.1rem 0.4rem',
                                borderRadius: 4
                              }}
                            >
                              #{item.design_number}
                            </span>
                            <div
                              style={{
                                fontWeight: 700,
                                fontSize: '0.92rem',
                                color: '#0f172a',
                                marginTop: '0.15rem'
                              }}
                            >
                              {item.width_ft || 8}×{item.height_ft || 4} ft • {item.thickness_mm || 6} mm
                            </div>
                          </div>

                          {/* Delete Button that triggers Confirmation Pop-up */}
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmModal({ isOpen: true, item, isClearAll: false })}
                            style={{
                              background: '#fef2f2',
                              border: '1px solid #fecaca',
                              borderRadius: 6,
                              color: '#dc2626',
                              cursor: 'pointer',
                              fontSize: '0.9rem',
                              padding: '0.25rem 0.45rem',
                              transition: 'all 0.15s ease',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                            title="Remove item from cart"
                          >
                            🗑️
                          </button>
                        </div>

                        <div
                          style={{
                            marginTop: 'auto',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            paddingTop: '0.4rem'
                          }}
                        >
                          {/* Quantity Stepper */}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              background: '#f1f5f9',
                              borderRadius: 6,
                              border: '1px solid #cbd5e1',
                              padding: '0.15rem'
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => onUpdateQuantity(item.uid, Math.max(1, currentQty - 1))}
                              disabled={currentQty <= 1}
                              style={{
                                width: 24,
                                height: 24,
                                background: '#fff',
                                border: '1px solid #cbd5e1',
                                borderRadius: 4,
                                cursor: currentQty <= 1 ? 'not-allowed' : 'pointer',
                                fontWeight: 700,
                                fontSize: '0.85rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              −
                            </button>
                            <span
                              style={{
                                minWidth: 28,
                                textAlign: 'center',
                                fontWeight: 800,
                                fontSize: '0.88rem',
                                color: '#0f172a'
                              }}
                            >
                              {currentQty}
                            </span>
                            <button
                              type="button"
                              onClick={() => onUpdateQuantity(item.uid, currentQty + 1)}
                              disabled={isItemSoldOut || currentQty >= liveAvailable}
                              style={{
                                width: 24,
                                height: 24,
                                background: '#fff',
                                border: '1px solid #cbd5e1',
                                borderRadius: 4,
                                cursor: (isItemSoldOut || currentQty >= liveAvailable) ? 'not-allowed' : 'pointer',
                                fontWeight: 700,
                                fontSize: '0.85rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                opacity: (isItemSoldOut || currentQty >= liveAvailable) ? 0.5 : 1
                              }}
                            >
                              +
                            </button>
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a' }}>
                              ₹{itemTotal.toFixed(2)}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                              ₹{itemPrice.toFixed(2)}/pc
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Pre-Flight Stock Warning Alert / Badge */}
                    {isItemSoldOut && (
                      <div
                        style={{
                          marginTop: '0.5rem',
                          padding: '0.35rem 0.6rem',
                          background: '#fee2e2',
                          color: '#b91c1c',
                          borderRadius: 6,
                          fontSize: '0.76rem',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}
                      >
                        <span>🚫 Sold Out in warehouse</span>
                        <button
                          type="button"
                          onClick={() => onRemoveFromCart(item.uid)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#991b1b',
                            textDecoration: 'underline',
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            padding: 0
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    )}

                    {!isItemSoldOut && isInsufficient && (
                      <div
                        style={{
                          marginTop: '0.5rem',
                          padding: '0.35rem 0.6rem',
                          background: '#fef3c7',
                          color: '#92400e',
                          borderRadius: 6,
                          fontSize: '0.76rem',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}
                      >
                        <span>⚠️ Only {liveAvailable} sheets available in stock</span>
                        <button
                          type="button"
                          onClick={() => onUpdateQuantity(item.uid, liveAvailable)}
                          style={{
                            background: '#d97706',
                            border: 'none',
                            color: '#fff',
                            borderRadius: 4,
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            padding: '0.15rem 0.4rem'
                          }}
                        >
                          Set to {liveAvailable}
                        </button>
                      </div>
                    )}

                    {!isItemSoldOut && !isInsufficient && isLow && (
                      <div
                        style={{
                          marginTop: '0.4rem',
                          fontSize: '0.72rem',
                          color: '#d97706',
                          fontWeight: 600
                        }}
                      >
                        ⚡ Low stock: Only {liveAvailable} sheets remaining
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Footer / Checkout Section ── */}
        {cart.length > 0 && (
          <div
            style={{
              padding: '1.25rem',
              borderTop: '1px solid #e2e8f0',
              background: '#f8fafc',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.85rem'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', color: '#64748b' }}>
              <span>Subtotal ({totalItems} items)</span>
              <span style={{ fontWeight: 700, color: '#0f172a' }}>₹{subtotal.toFixed(2)}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', color: '#64748b' }}>
              <span>Delivery</span>
              <span style={{ fontWeight: 700, color: isFreeDelivery ? '#16a34a' : '#0f172a' }}>
                {isFreeDelivery ? 'FREE' : 'Calculated at checkout'}
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '1.15rem',
                fontWeight: 900,
                color: '#0f172a',
                borderTop: '1px dashed #cbd5e1',
                paddingTop: '0.65rem'
              }}
            >
              <span>Total Amount</span>
              <span style={{ color: '#2563eb' }}>₹{subtotal.toFixed(2)}</span>
            </div>

            <button
              type="button"
              disabled={stockStatus.can_proceed === false || verifyingStock}
              onClick={handleCheckoutClick}
              style={{
                background: stockStatus.can_proceed === false
                  ? '#94a3b8'
                  : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                color: '#fff',
                border: 'none',
                padding: '0.85rem 1.25rem',
                borderRadius: 12,
                fontWeight: 800,
                fontSize: '1rem',
                cursor: stockStatus.can_proceed === false ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                boxShadow: stockStatus.can_proceed === false ? 'none' : '0 4px 14px rgba(37, 99, 235, 0.35)',
                transition: 'all 0.15s ease'
              }}
            >
              {stockStatus.can_proceed === false ? (
                <span>🚫 Resolve Out-of-Stock Items to Proceed</span>
              ) : (
                <>
                  <span>Proceed to Checkout</span>
                  <span>→</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* ── Delete / Clear Cart Confirmation Modal Pop-up ── */}
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
                {deleteConfirmModal.isClearAll ? 'Clear Entire Shopping Cart?' : 'Remove Item from Cart?'}
              </h4>

              <p style={{ margin: '0 0 1.5rem', color: '#64748b', fontSize: '0.88rem', lineHeight: 1.45 }}>
                {deleteConfirmModal.isClearAll
                  ? `Are you sure you want to remove all ${totalItems} sheets from your shopping cart? This cannot be undone.`
                  : `Are you sure you want to remove Design #${deleteConfirmModal.item?.design_number} (${deleteConfirmModal.item?.quantity || 1} sheet${(deleteConfirmModal.item?.quantity || 1) > 1 ? 's' : ''}) from your cart?`}
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
                  onClick={handleConfirmDelete}
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
                  {deleteConfirmModal.isClearAll ? '🗑️ Yes, Clear Cart' : '🗑️ Yes, Remove'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
