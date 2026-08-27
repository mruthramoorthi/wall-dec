import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import request from '../../api/client.js';
import CustomerNavbar from '../../components/CustomerNavbar.jsx';
import CartDrawer from '../../components/CartDrawer.jsx';
import { getImageUrl } from '../../utils/apiConfig.js';
import { logSearchDemand } from '../../api/orders.js';

/* ── Helper: Render Star Rating ── */
function StarRating({ rating = 0, size = '0.9rem', showNumber = true, totalCount = null }) {
  const num = Number(rating || 0);
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: size }}>
      <div style={{ display: 'flex', color: '#f59e0b', letterSpacing: '1px' }}>
        {[1, 2, 3, 4, 5].map((star) => {
          const isFull = num >= star;
          const isHalf = !isFull && num >= star - 0.5;
          return (
            <span key={star} style={{ lineHeight: 1 }}>
              {isFull ? '★' : isHalf ? '★' : '☆'}
            </span>
          );
        })}
      </div>
      {showNumber && (
        <span style={{ fontSize: '0.85em', fontWeight: 700, color: '#475569' }}>
          {num > 0 ? num.toFixed(1) : 'New'}
          {totalCount !== null && (
            <span style={{ fontWeight: 400, color: '#94a3b8', marginLeft: '0.2rem' }}>
              ({totalCount})
            </span>
          )}
        </span>
      )}
    </div>
  );
}

/* ── Interactive Star Rating Input for Reviews ── */
function StarRatingPicker({ value, onChange }) {
  const [hoverVal, setHoverVal] = useState(0);

  return (
    <div style={{ display: 'flex', gap: '0.35rem', cursor: 'pointer' }}>
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
            fontSize: '1.75rem',
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

/* ── Product Card with Inline Quantity Stepper and Multi-Photo Carousel ── */
function ProductCard({ product, onSelect, onAddToCart, isAdded, isFirstCard }) {
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [sheetQty, setSheetQty] = useState(1);
  const timerRef = useRef(null);

  const rawImages =
    product.images && product.images.length > 0
      ? product.images
      : product.image_filename
      ? [product.image_filename]
      : [];
  const images = rawImages.filter(Boolean);

  const availablePcs = Number(product.available_pcs ?? 0);
  const isSoldOut = availablePcs <= 0;
  const maxQty = isSoldOut ? 0 : Math.max(1, availablePcs);
  const price = Number(product.selling_price_per_piece || 0);

  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchEndX = useRef(0);
  const touchEndY = useRef(0);
  const isSwiping = useRef(false);

  // Auto swipe on hover on desktop
  useEffect(() => {
    if (isHovered && images.length > 1) {
      timerRef.current = setInterval(() => {
        setActiveImageIndex((prev) => (prev + 1) % images.length);
      }, 1400);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      if (!isHovered) setActiveImageIndex(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isHovered, images.length]);

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchEndX.current = e.touches[0].clientX;
    touchEndY.current = e.touches[0].clientY;
    isSwiping.current = false;
  };

  const handleTouchMove = (e) => {
    touchEndX.current = e.touches[0].clientX;
    touchEndY.current = e.touches[0].clientY;
    const diffX = Math.abs(touchStartX.current - touchEndX.current);
    const diffY = Math.abs(touchStartY.current - touchEndY.current);
    if (diffX > 10 && diffX > diffY) {
      isSwiping.current = true;
    }
  };

  const handleTouchEnd = (e) => {
    const diffX = touchStartX.current - touchEndX.current;
    const diffY = touchStartY.current - touchEndY.current;
    // Check if horizontal swipe was intentional (at least 30px and predominantly horizontal)
    if (Math.abs(diffX) > 30 && Math.abs(diffX) > Math.abs(diffY)) {
      if (diffX > 0) {
        // Swiped Left -> show next photo
        if (images.length > 1) {
          setActiveImageIndex((prev) => (prev + 1) % images.length);
        }
      } else {
        // Swiped Right -> show prev photo
        if (images.length > 1) {
          setActiveImageIndex((prev) => (prev - 1 + images.length) % images.length);
        }
      }
    }
  };

  const handleCardImageClick = (e) => {
    if (isSwiping.current) {
      e.stopPropagation();
      return;
    }
    onSelect(product);
  };

  const handleQtyChange = (val) => {
    const parsed = parseInt(val, 10);
    if (isNaN(parsed) || parsed < 1) {
      setSheetQty(1);
    } else if (parsed > maxQty) {
      setSheetQty(maxQty);
    } else {
      setSheetQty(parsed);
    }
  };

  const handleAddClick = (e) => {
    e.stopPropagation();
    if (isSoldOut) return;
    onAddToCart(product, sheetQty);
  };

  const handleNext = (e) => {
    e.stopPropagation();
    if (images.length > 1) {
      setActiveImageIndex((prev) => (prev + 1) % images.length);
    }
  };

  const handlePrev = (e) => {
    e.stopPropagation();
    if (images.length > 1) {
      setActiveImageIndex((prev) => (prev - 1 + images.length) % images.length);
    }
  };

  return (
    <div
      className="cust-product-card"
      id={isFirstCard ? 'tour-first-product-card' : undefined}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Top Image Frame with touch swipe and auto/manual slide */}
      <div
        className="cust-card-image-box"
        onClick={handleCardImageClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {images.length > 0 ? (
          <div
            style={{
              display: 'flex',
              height: '100%',
              width: '100%',
              transform: `translateX(-${activeImageIndex * 100}%)`,
              transition: 'transform 0.45s cubic-bezier(0.25, 1, 0.5, 1)'
            }}
          >
            {images.map((imgName, idx) => (
              <div
                key={idx}
                style={{
                  minWidth: '100%',
                  height: '100%',
                  flexShrink: 0,
                  position: 'relative'
                }}
              >
                <img
                  src={getImageUrl(imgName, 'thumb')}
                  alt={`Design ${product.design_number} preview ${idx + 1}`}
                  loading="lazy"
                  decoding="async"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover'
                  }}
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src =
                      'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="%23cbd5e1"><rect width="24" height="24" fill="%23f1f5f9"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="8" fill="%2394a3b8">No Image</text></svg>';
                  }}
                />
              </div>
            ))}
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: '#94a3b8'
            }}
          >
            <span style={{ fontSize: '2.8rem' }}>🖼️</span>
            <span style={{ fontSize: '0.8rem', marginTop: '0.35rem', fontWeight: 600 }}>
              No Image Available
            </span>
          </div>
        )}

        {/* Top-Left Design Number Tag */}
        <span
          style={{
            position: 'absolute',
            top: 10,
            left: 10,
            background: 'rgba(15, 23, 42, 0.9)',
            backdropFilter: 'blur(6px)',
            color: '#38bdf8',
            padding: '0.25rem 0.65rem',
            borderRadius: 6,
            fontSize: '0.78rem',
            fontWeight: 800,
            letterSpacing: '0.5px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
          }}
        >
          #{product.design_number}
        </span>

        {/* Top-Right Stock Status Badge */}
        <span
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            background: isSoldOut ? 'rgba(220, 38, 38, 0.95)' : 'rgba(16, 185, 129, 0.95)',
            backdropFilter: 'blur(6px)',
            color: '#fff',
            padding: '0.25rem 0.65rem',
            borderRadius: 6,
            fontSize: '0.75rem',
            fontWeight: 800,
            letterSpacing: '0.3px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem'
          }}
        >
          {isSoldOut ? '🔥 SOLD OUT' : `✓ ${availablePcs} in stock`}
        </span>

        {/* Multi-Image Horizontal Slide Arrows */}
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={handlePrev}
              style={{
                position: 'absolute',
                left: 6,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'rgba(15, 23, 42, 0.8)',
                color: '#fff',
                border: 'none',
                width: 30,
                height: 30,
                borderRadius: '50%',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1rem',
                boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
              }}
              title="Previous photo"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={handleNext}
              style={{
                position: 'absolute',
                right: 6,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'rgba(15, 23, 42, 0.8)',
                color: '#fff',
                border: 'none',
                width: 30,
                height: 30,
                borderRadius: '50%',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1rem',
                boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
              }}
              title="Next photo"
            >
              ›
            </button>

            {/* Multi-photo indicator dots positioned above bottom badges */}
            <div
              style={{
                position: 'absolute',
                bottom: 34,
                left: 0,
                right: 0,
                display: 'flex',
                justifyContent: 'center',
                gap: 5,
                zIndex: 2
              }}
            >
              {images.map((_, idx) => (
                <span
                  key={idx}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveImageIndex(idx);
                  }}
                  style={{
                    width: activeImageIndex === idx ? 16 : 6,
                    height: 6,
                    borderRadius: 3,
                    background: activeImageIndex === idx ? '#38bdf8' : 'rgba(255,255,255,0.65)',
                    transition: 'all 0.3s ease',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
                    cursor: 'pointer'
                  }}
                />
              ))}
            </div>
          </>
        )}

        {/* Bottom-Left Size & Thickness Badge inside photo */}
        <span
          style={{
            position: 'absolute',
            bottom: 8,
            left: 10,
            background: 'rgba(15, 23, 42, 0.88)',
            backdropFilter: 'blur(6px)',
            color: '#fff',
            padding: '0.22rem 0.55rem',
            borderRadius: 6,
            fontSize: '0.75rem',
            fontWeight: 800,
            letterSpacing: '0.3px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem',
            zIndex: 2
          }}
        >
          <span>📐</span>
          <span>{product.width_ft || 8}×{product.height_ft || 4} ft</span>
          <span style={{ color: '#38bdf8' }}>•</span>
          <span style={{ color: '#38bdf8' }}>{product.thickness_mm || 6} mm</span>
        </span>

        {/* Bottom-Right Rating Stars inside the photo frame */}
        <div
          style={{
            position: 'absolute',
            bottom: 8,
            right: 10,
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(6px)',
            padding: '0.22rem 0.55rem',
            borderRadius: 6,
            boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            zIndex: 2
          }}
        >
          <StarRating rating={product.avg_rating} totalCount={product.review_count} size="0.75rem" />
        </div>
      </div>

      {/* Card Content: Super Compact 2-Row Layout */}
      <div style={{ padding: '0.65rem 0.85rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
        {/* Row 1: Qty Stepper on Left, Per Qty Price on Right */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
          {/* Left: Qty: label + Stepper */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#475569' }}>
              Qty :
            </span>
            <div className="cust-qty-stepper-box" id={isFirstCard ? 'tour-first-qty-stepper' : undefined} style={{ margin: 0 }}>
              <button
                type="button"
                className="cust-qty-btn"
                disabled={isSoldOut || sheetQty <= 1}
                onClick={() => handleQtyChange(sheetQty - 1)}
                title="Decrease sheet quantity"
              >
                −
              </button>
              <input
                type="number"
                min="1"
                max={maxQty}
                disabled={isSoldOut}
                className="cust-qty-input"
                value={isSoldOut ? 0 : sheetQty}
                onChange={(e) => handleQtyChange(e.target.value)}
              />
              <button
                type="button"
                className="cust-qty-btn"
                disabled={isSoldOut || sheetQty >= maxQty}
                onClick={() => handleQtyChange(sheetQty + 1)}
                title="Increase sheet quantity"
              >
                +
              </button>
            </div>
          </div>

          {/* Right: Per Qty Amount */}
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, display: 'block', lineHeight: 1.1 }}>
              Per Qty :
            </span>
            <div style={{ fontSize: '1.18rem', fontWeight: 900, color: '#0f172a', lineHeight: 1.2 }}>
              ₹{price.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Row 2: Add to Cart Button */}
        <button
          type="button"
          id={isFirstCard ? 'tour-first-add-btn' : undefined}
          disabled={isSoldOut}
          onClick={handleAddClick}
          style={{
            width: '100%',
            padding: '0.55rem',
            borderRadius: 8,
            background: isSoldOut
              ? '#94a3b8'
              : isAdded
              ? '#16a34a'
              : 'linear-gradient(135deg, #2563eb, #1d4ed8)',
            color: '#fff',
            border: 'none',
            fontWeight: 800,
            fontSize: '0.84rem',
            cursor: isSoldOut ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.35rem',
            boxShadow: isSoldOut ? 'none' : '0 2px 6px rgba(37,99,235,0.25)',
            transition: 'all 0.2s ease',
            marginTop: 'auto'
          }}
        >
          {isSoldOut
            ? '🚫 Sold Out'
            : isAdded
            ? '✓ Added to Cart!'
            : `🛒 Add ${sheetQty} Sheet${sheetQty > 1 ? 's' : ''} • ₹${(price * sheetQty).toFixed(2)}`}
        </button>
      </div>
    </div>
  );
}

/* ── Product Details Modal Component (Gallery, Qty, Add to Cart & Reviews) ── */
function ProductDetailModal({
  product,
  onClose,
  onAddToCart,
  currentUser,
  onReviewUpdated,
  onBuyNow
}) {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState('details');
  const [reviewsData, setReviewsData] = useState({ reviews: [], averageRating: '0.0', totalReviews: 0 });
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [isAddedToast, setIsAddedToast] = useState(false);

  // Review Form state
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [ratingInput, setRatingInput] = useState(5);
  const [reviewTitleInput, setReviewTitleInput] = useState('');
  const [reviewCommentInput, setReviewCommentInput] = useState('');
  const [reviewerNameInput, setReviewerNameInput] = useState(
    currentUser?.first_name ? `${currentUser.first_name} ${currentUser.last_name || ''}`.trim() : ''
  );
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState(null);
  const [reviewSuccess, setReviewSuccess] = useState(false);

  const rawImages =
    product.images && product.images.length > 0
      ? product.images
      : product.image_filename
      ? [product.image_filename]
      : [];
  const images = rawImages.filter(Boolean);

  const availablePcs = Number(product.available_pcs ?? 0);
  const isSoldOut = availablePcs <= 0;
  const maxAllowedQty = isSoldOut ? 0 : Math.max(1, availablePcs);

  const reviewsSectionRef = useRef(null);

  const scrollToReviews = (e) => {
    if (e) e.preventDefault();
    if (reviewsSectionRef.current) {
      reviewsSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const [zoomLevel, setZoomLevel] = useState(1);
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });
  const [isHoveringImage, setIsHoveringImage] = useState(false);
  const [isFullscreenZoom, setIsFullscreenZoom] = useState(false);

  const handleImageMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    setZoomPos({ x, y });
  };

  const handleToggleZoom = () => {
    setZoomLevel((prev) => (prev > 1 ? 1 : 2.2));
  };

  const handleZoomIn = (e) => {
    e.stopPropagation();
    setZoomLevel((prev) => Math.min(3.5, prev + 0.5));
  };

  const handleZoomOut = (e) => {
    e.stopPropagation();
    setZoomLevel((prev) => Math.max(1, prev - 0.5));
  };

  const handleResetZoom = (e) => {
    if (e) e.stopPropagation();
    setZoomLevel(1);
    setZoomPos({ x: 50, y: 50 });
  };

  const modalTouchStartX = useRef(0);
  const modalTouchEndX = useRef(0);
  const isPinching = useRef(false);
  const initialPinchDist = useRef(0);
  const initialPinchScale = useRef(1);
  const lastTouchPos = useRef({ x: 0, y: 0 });
  const lastTapTime = useRef(0);

  const getTouchDist = (e) => {
    if (e.touches.length < 2) return 0;
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    return Math.hypot(dx, dy);
  };

  const getTouchMidpoint = (e, containerRect) => {
    if (e.touches.length < 2) return { x: 50, y: 50 };
    const clientX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
    const clientY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
    const x = Math.max(0, Math.min(100, ((clientX - containerRect.left) / containerRect.width) * 100));
    const y = Math.max(0, Math.min(100, ((clientY - containerRect.top) / containerRect.height) * 100));
    return { x, y };
  };

  const handleModalTouchStart = (e) => {
    const now = Date.now();
    // Double-tap to zoom toggle
    if (e.touches.length === 1 && now - lastTapTime.current < 300) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = Math.max(0, Math.min(100, ((e.touches[0].clientX - rect.left) / rect.width) * 100));
      const y = Math.max(0, Math.min(100, ((e.touches[0].clientY - rect.top) / rect.height) * 100));
      setZoomPos({ x, y });
      setZoomLevel((prev) => (prev > 1 ? 1 : 2.4));
      lastTapTime.current = 0;
      return;
    }

    if (e.touches.length === 1) {
      lastTapTime.current = now;
      modalTouchStartX.current = e.touches[0].clientX;
      modalTouchEndX.current = e.touches[0].clientX;
      lastTouchPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2) {
      isPinching.current = true;
      initialPinchDist.current = getTouchDist(e);
      initialPinchScale.current = zoomLevel;
      const rect = e.currentTarget.getBoundingClientRect();
      const mid = getTouchMidpoint(e, rect);
      setZoomPos(mid);
    }
  };

  const handleModalTouchMove = (e) => {
    if (e.touches.length === 2 && isPinching.current) {
      if (e.cancelable) e.preventDefault();
      const dist = getTouchDist(e);
      if (initialPinchDist.current > 0) {
        const factor = dist / initialPinchDist.current;
        const newZoom = Math.min(4.0, Math.max(1.0, initialPinchScale.current * factor));
        setZoomLevel(newZoom);
      }
    } else if (e.touches.length === 1) {
      modalTouchEndX.current = e.touches[0].clientX;
      // If zoomed in, allow 1-finger pan
      if (zoomLevel > 1.05) {
        if (e.cancelable) e.preventDefault();
        const deltaX = e.touches[0].clientX - lastTouchPos.current.x;
        const deltaY = e.touches[0].clientY - lastTouchPos.current.y;
        lastTouchPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        setZoomPos((prev) => ({
          x: Math.max(0, Math.min(100, prev.x - (deltaX / 3))),
          y: Math.max(0, Math.min(100, prev.y - (deltaY / 3)))
        }));
      }
    }
  };

  const handleModalTouchEnd = (e) => {
    if (e.touches.length < 2) {
      isPinching.current = false;
      if (zoomLevel < 1.05) {
        setZoomLevel(1);
        setZoomPos({ x: 50, y: 50 });
      }
    }
    // If not zoomed in and finished a single finger touch, check for swipe
    if (e.touches.length === 0 && zoomLevel <= 1.05) {
      const diff = modalTouchStartX.current - modalTouchEndX.current;
      if (Math.abs(diff) > 45 && images.length > 1) {
        if (diff > 0) {
          setSelectedImageIndex((prev) => (prev + 1) % images.length);
        } else {
          setSelectedImageIndex((prev) => (prev - 1 + images.length) % images.length);
        }
      }
    }
  };

  useEffect(() => {
    fetchReviews();
  }, [product.uid]);

  async function fetchReviews() {
    setLoadingReviews(true);
    try {
      const res = await request(`/orders/feedback/${product.uid}`);
      if (res && res.data) {
        setReviewsData(res.data);
      }
    } catch (e) {
      console.warn('Failed to load reviews:', e.message);
    } finally {
      setLoadingReviews(false);
    }
  }

  const handleQtyChange = (val) => {
    const parsed = parseInt(val, 10);
    if (isNaN(parsed) || parsed < 1) {
      setQuantity(1);
    } else if (parsed > maxAllowedQty) {
      setQuantity(maxAllowedQty);
    } else {
      setQuantity(parsed);
    }
  };

  const handleAddWithQty = () => {
    if (isSoldOut) return;
    onAddToCart(product, quantity);
    setIsAddedToast(true);
    setTimeout(() => setIsAddedToast(false), 2000);
  };

  const handleDirectBuy = () => {
    if (isSoldOut) return;
    onAddToCart(product, quantity);
    onClose();
    if (onBuyNow) onBuyNow();
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!ratingInput) {
      setReviewError('Please select a star rating.');
      return;
    }
    setSubmittingReview(true);
    setReviewError(null);

    try {
      await request('/orders/feedback', {
        method: 'POST',
        body: {
          stockUid: product.uid,
          userUid: currentUser?.uid || null,
          reviewerName: reviewerNameInput.trim() || 'Verified Customer',
          rating: ratingInput,
          reviewTitle: reviewTitleInput.trim() || null,
          comment: reviewCommentInput.trim() || null,
          orderUid: 'DIRECT_CATALOG_REVIEW'
        }
      });

      setReviewSuccess(true);
      setShowReviewForm(false);
      setReviewTitleInput('');
      setReviewCommentInput('');
      await fetchReviews();
      if (onReviewUpdated) onReviewUpdated();
      setTimeout(() => setReviewSuccess(false), 4000);
    } catch (err) {
      setReviewError(err.message || 'Failed to submit review. Please try again.');
    } finally {
      setSubmittingReview(false);
    }
  };

  const price = Number(product.selling_price_per_piece || 0);
  const subtotal = price * quantity;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.8)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0.75rem',
        animation: 'fadeIn 0.2s ease-out'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 18,
          maxWidth: 960,
          width: '100%',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          overflow: 'hidden',
          position: 'relative'
        }}
      >
        {/* Modal Top Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1rem 1.25rem',
            borderBottom: '1px solid #e2e8f0',
            background: '#f8fafc'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span
              style={{
                background: '#0f172a',
                color: '#38bdf8',
                padding: '0.25rem 0.65rem',
                borderRadius: 6,
                fontSize: '0.82rem',
                fontWeight: 800
              }}
            >
              Design #{product.design_number}
            </span>
            <h2 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a', fontWeight: 800 }}>
              Panel Overview
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: '#f1f5f9',
              border: '1.5px solid #cbd5e1',
              width: 36,
              height: 36,
              borderRadius: '50%',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 900,
              color: '#0f172a',
              fontSize: '1.1rem',
              transition: 'all 0.15s ease'
            }}
            title="Cancel & Close (Esc)"
          >
            ✕
          </button>
        </div>

        {/* Modal Body Container with Scroll */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '1.25rem' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '1.5rem',
              alignItems: 'start'
            }}
          >
            {/* Left: Gallery with Zoom Options */}
            <div>
              <div
                style={{
                  position: 'relative',
                  height: 330,
                  background: '#0f172a',
                  borderRadius: 14,
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  touchAction: zoomLevel > 1 ? 'none' : 'pan-y',
                  cursor: zoomLevel > 1 ? 'zoom-out' : 'zoom-in'
                }}
                onMouseMove={handleImageMouseMove}
                onMouseEnter={() => setIsHoveringImage(true)}
                onMouseLeave={() => {
                  setIsHoveringImage(false);
                  if (zoomLevel === 1) setZoomPos({ x: 50, y: 50 });
                }}
                onDoubleClick={handleToggleZoom}
                onTouchStart={handleModalTouchStart}
                onTouchMove={handleModalTouchMove}
                onTouchEnd={handleModalTouchEnd}
                title="Hover & move to magnify, double-click to toggle 2.2x zoom"
              >
                {images.length > 0 ? (
                  <img
                    src={getImageUrl(images[selectedImageIndex], 'medium')}
                    alt={`Design ${product.design_number} high resolution view`}
                    decoding="async"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      transform: isHoveringImage && zoomLevel === 1 ? 'scale(1.7)' : `scale(${zoomLevel})`,
                      transformOrigin: `${zoomPos.x}% ${zoomPos.y}%`,
                      transition: isHoveringImage && zoomLevel === 1 ? 'transform 0.1s ease-out' : 'transform 0.2s ease-out',
                      pointerEvents: 'none'
                    }}
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src =
                        'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="%2364748b"><rect width="24" height="24" fill="%230f172a"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="6" fill="%2394a3b8">Image Unavailable</text></svg>';
                    }}
                  />
                ) : (
                  <div style={{ color: '#94a3b8', textAlign: 'center' }}>
                    <span style={{ fontSize: '3rem' }}>🖼️</span>
                    <div>No Image Available</div>
                  </div>
                )}

                {/* Top-Left Interactive Zoom Toolbar */}
                <div
                  style={{
                    position: 'absolute',
                    top: 10,
                    left: 10,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    background: 'rgba(15, 23, 42, 0.85)',
                    backdropFilter: 'blur(6px)',
                    padding: '0.25rem 0.4rem',
                    borderRadius: 8,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                    zIndex: 4
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={handleZoomIn}
                    disabled={zoomLevel >= 3.5}
                    style={{
                      background: 'rgba(255, 255, 255, 0.15)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 4,
                      width: 26,
                      height: 26,
                      cursor: zoomLevel >= 3.5 ? 'not-allowed' : 'pointer',
                      fontSize: '0.85rem',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    title="Zoom In"
                  >
                    +
                  </button>

                  <button
                    type="button"
                    onClick={handleZoomOut}
                    disabled={zoomLevel <= 1}
                    style={{
                      background: 'rgba(255, 255, 255, 0.15)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 4,
                      width: 26,
                      height: 26,
                      cursor: zoomLevel <= 1 ? 'not-allowed' : 'pointer',
                      fontSize: '0.85rem',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    title="Zoom Out"
                  >
                    −
                  </button>

                  {zoomLevel > 1 && (
                    <button
                      type="button"
                      onClick={handleResetZoom}
                      style={{
                        background: '#38bdf8',
                        color: '#0f172a',
                        border: 'none',
                        borderRadius: 4,
                        padding: '0.15rem 0.45rem',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.2rem'
                      }}
                      title="Reset Zoom to 1x"
                    >
                      <span>🔄</span>
                      <span>{zoomLevel.toFixed(1)}x</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setIsFullscreenZoom(true)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.15)',
                      color: '#38bdf8',
                      border: 'none',
                      borderRadius: 4,
                      width: 26,
                      height: 26,
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    title="Open Fullscreen Lightbox Zoom"
                  >
                    ⛶
                  </button>
                </div>

                {/* Top-Right Stock Badge */}
                <span
                  style={{
                    position: 'absolute',
                    top: 10,
                    right: 10,
                    background: isSoldOut ? '#dc2626' : '#16a34a',
                    color: '#fff',
                    padding: '0.25rem 0.75rem',
                    borderRadius: 20,
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    zIndex: 3
                  }}
                >
                  {isSoldOut ? '🔥 SOLD OUT' : `✓ ${availablePcs} IN STOCK`}
                </span>
              </div>

              {/* Thumbnails */}
              {images.length > 1 && (
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
                  {images.map((img, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedImageIndex(idx)}
                      style={{
                        width: 58,
                        height: 58,
                        flexShrink: 0,
                        borderRadius: 8,
                        overflow: 'hidden',
                        border: selectedImageIndex === idx ? '2.5px solid #2563eb' : '1.5px solid #cbd5e1',
                        padding: 0,
                        background: '#f8fafc',
                        cursor: 'pointer',
                        opacity: selectedImageIndex === idx ? 1 : 0.65
                      }}
                    >
                      <img
                        src={getImageUrl(img, 'icon')}
                        alt={`Thumbnail ${idx + 1}`}
                        loading="lazy"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Specs & Qty */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <div
                  onClick={scrollToReviews}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', cursor: 'pointer' }}
                  title="Click to see customer reviews"
                >
                  <StarRating
                    rating={reviewsData.averageRating}
                    totalCount={reviewsData.totalReviews}
                    size="1rem"
                  />
                  <button
                    type="button"
                    onClick={scrollToReviews}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#2563eb',
                      fontSize: '0.84rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      textDecoration: 'underline'
                    }}
                  >
                    Reviews ({reviewsData.totalReviews}) ▾
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.85rem', fontWeight: 900, color: '#0f172a' }}>
                    ₹{price.toFixed(2)}
                  </span>
                  <span style={{ fontSize: '0.85rem', color: '#64748b' }}>per sheet (incl. taxes)</span>
                </div>
              </div>

              {/* Specifications Card */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '0.85rem 1rem' }}>
                <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.88rem', color: '#0f172a', fontWeight: 700 }}>
                  📐 Panel Specs
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', fontSize: '0.82rem' }}>
                  <div>
                    <span style={{ color: '#64748b' }}>Dimensions:</span>{' '}
                    <strong style={{ color: '#0f172a' }}>{product.width_ft || 8} x {product.height_ft || 4} ft</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Thickness:</span>{' '}
                    <strong style={{ color: '#0f172a' }}>{product.thickness_mm || 6} mm</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Grade:</span>{' '}
                    <strong style={{ color: '#0f172a' }}>High-Gloss Acrylic</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Warehouse Stock:</span>{' '}
                    <strong style={{ color: isSoldOut ? '#dc2626' : '#16a34a' }}>{availablePcs} pcs</strong>
                  </div>
                </div>
              </div>

              {/* Quantity Stepper & Buttons */}
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569' }}>
                    Sheets Quantity:
                  </label>

                  <div className="cust-qty-stepper-box">
                    <button
                      type="button"
                      className="cust-qty-btn"
                      disabled={isSoldOut || quantity <= 1}
                      onClick={() => handleQtyChange(quantity - 1)}
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min="1"
                      max={maxAllowedQty}
                      disabled={isSoldOut}
                      className="cust-qty-input"
                      value={isSoldOut ? 0 : quantity}
                      onChange={(e) => handleQtyChange(e.target.value)}
                    />
                    <button
                      type="button"
                      className="cust-qty-btn"
                      disabled={isSoldOut || quantity >= maxAllowedQty}
                      onClick={() => handleQtyChange(quantity + 1)}
                    >
                      +
                    </button>
                  </div>
                </div>

                {!isSoldOut && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', fontSize: '0.88rem' }}>
                    <span style={{ color: '#64748b' }}>Order Subtotal:</span>
                    <strong style={{ color: '#0f172a' }}>₹{subtotal.toFixed(2)}</strong>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                  <button
                    type="button"
                    disabled={isSoldOut}
                    onClick={handleAddWithQty}
                    style={{
                      padding: '0.75rem',
                      borderRadius: 8,
                      background: isSoldOut ? '#94a3b8' : isAddedToast ? '#16a34a' : '#0f172a',
                      color: '#fff',
                      border: 'none',
                      fontWeight: 800,
                      fontSize: '0.88rem',
                      cursor: isSoldOut ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {isSoldOut ? 'Sold Out' : isAddedToast ? '✓ Added' : `🛒 Add ${quantity} to Cart`}
                  </button>

                  <button
                    type="button"
                    disabled={isSoldOut}
                    onClick={handleDirectBuy}
                    style={{
                      padding: '0.75rem',
                      borderRadius: 8,
                      background: isSoldOut ? '#cbd5e1' : 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                      color: '#fff',
                      border: 'none',
                      fontWeight: 800,
                      fontSize: '0.88rem',
                      cursor: isSoldOut ? 'not-allowed' : 'pointer'
                    }}
                  >
                    ⚡ Buy Now
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Reviews section */}
          <div
            ref={reviewsSectionRef}
            id="product-reviews-section"
            style={{ marginTop: '1.75rem', borderTop: '1px solid #e2e8f0', paddingTop: '1.25rem' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h4 style={{ margin: 0, color: '#0f172a', fontSize: '1rem' }}>
                ⭐ Verified Reviews ({reviewsData.totalReviews})
              </h4>
              <button
                type="button"
                onClick={() => setShowReviewForm((prev) => !prev)}
                style={{
                  padding: '0.45rem 0.85rem',
                  borderRadius: 6,
                  background: '#0f172a',
                  color: '#fff',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  cursor: 'pointer'
                }}
              >
                {showReviewForm ? 'Cancel' : '✍️ Write Review'}
              </button>
            </div>

            {reviewSuccess && (
              <div style={{ background: '#ecfdf5', color: '#047857', padding: '0.65rem', borderRadius: 6, marginBottom: '1rem', fontSize: '0.85rem', fontWeight: 600 }}>
                ✓ Thank you! Your review has been posted.
              </div>
            )}

            {showReviewForm && (
              <form onSubmit={handleSubmitReview} style={{ background: '#f8fafc', padding: '1rem', borderRadius: 10, marginBottom: '1rem', border: '1px solid #e2e8f0' }}>
                <div style={{ marginBottom: '0.75rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.25rem' }}>Rating</label>
                  <StarRatingPicker value={ratingInput} onChange={setRatingInput} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <input
                    type="text"
                    required
                    placeholder="Your Name"
                    value={reviewerNameInput}
                    onChange={(e) => setReviewerNameInput(e.target.value)}
                    style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                  />
                  <input
                    type="text"
                    placeholder="Review Title"
                    value={reviewTitleInput}
                    onChange={(e) => setReviewTitleInput(e.target.value)}
                    style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                  />
                </div>
                <textarea
                  rows="2"
                  required
                  placeholder="Share feedback on finish and quality..."
                  value={reviewCommentInput}
                  onChange={(e) => setReviewCommentInput(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.85rem', marginBottom: '0.75rem' }}
                />
                <button
                  type="submit"
                  disabled={submittingReview}
                  style={{ padding: '0.5rem 1rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}
                >
                  {submittingReview ? 'Submitting...' : 'Post Review'}
                </button>
              </form>
            )}

            {/* Review List */}
            {reviewsData.reviews.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: '0.85rem', margin: 0 }}>No customer reviews yet. Be the first to review!</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {reviewsData.reviews.map((rev) => (
                  <div key={rev.id || rev.uid} style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '0.88rem', color: '#0f172a' }}>{rev.author_name || rev.first_name || 'Verified Buyer'}</strong>
                      <StarRating rating={rev.rating} size="0.8rem" showNumber={false} />
                    </div>
                    {rev.comment && <p style={{ margin: '0.35rem 0 0', fontSize: '0.82rem', color: '#475569' }}>{rev.comment}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal Bottom Footer with Cancel Button */}
        <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.6rem 1.35rem',
              borderRadius: 8,
              border: '1.5px solid #94a3b8',
              background: '#fff',
              color: '#1e293b',
              fontWeight: 800,
              fontSize: '0.88rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
          >
            ✕ Close Window
          </button>
        </div>
      </div>

      {/* ── High-Resolution Fullscreen Lightbox Zoom Modal ── */}
      {isFullscreenZoom && (
        <div
          onClick={() => setIsFullscreenZoom(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(10, 15, 29, 0.96)',
            backdropFilter: 'blur(10px)',
            zIndex: 100030,
            display: 'flex',
            flexDirection: 'column',
            animation: 'fadeIn 0.2s ease-out'
          }}
        >
          {/* Lightbox Top Controls Bar */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              padding: '0.85rem 1.25rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(15, 23, 42, 0.85)',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#fff'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <span style={{ fontWeight: 800, color: '#38bdf8', fontSize: '0.95rem' }}>
                #{product.design_number}
              </span>
              <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                High-Resolution Preview ({selectedImageIndex + 1} of {images.length || 1})
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={handleZoomIn}
                style={{
                  background: 'rgba(255, 255, 255, 0.12)',
                  color: '#fff',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: 6,
                  padding: '0.35rem 0.65rem',
                  fontWeight: 800,
                  fontSize: '0.9rem',
                  cursor: 'pointer'
                }}
                title="Zoom In"
              >
                🔍 +
              </button>

              <button
                type="button"
                onClick={handleZoomOut}
                style={{
                  background: 'rgba(255, 255, 255, 0.12)',
                  color: '#fff',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: 6,
                  padding: '0.35rem 0.65rem',
                  fontWeight: 800,
                  fontSize: '0.9rem',
                  cursor: 'pointer'
                }}
                title="Zoom Out"
              >
                🔍 −
              </button>

              <button
                type="button"
                onClick={handleResetZoom}
                style={{
                  background: '#38bdf8',
                  color: '#0f172a',
                  border: 'none',
                  borderRadius: 6,
                  padding: '0.35rem 0.65rem',
                  fontWeight: 800,
                  fontSize: '0.82rem',
                  cursor: 'pointer'
                }}
                title="Reset Zoom (1x)"
              >
                🔄 {zoomLevel.toFixed(1)}x
              </button>

              <button
                type="button"
                onClick={() => setIsFullscreenZoom(false)}
                style={{
                  background: '#ef4444',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  padding: '0.35rem 0.75rem',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  marginLeft: '0.5rem'
                }}
                title="Close Fullscreen View"
              >
                ✕ Close
              </button>
            </div>
          </div>

          {/* Lightbox Center Image Canvas */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              padding: '1rem',
              cursor: zoomLevel > 1 ? 'grab' : 'zoom-in',
              touchAction: 'none'
            }}
            onDoubleClick={handleToggleZoom}
            onMouseMove={handleImageMouseMove}
            onTouchStart={handleModalTouchStart}
            onTouchMove={handleModalTouchMove}
            onTouchEnd={handleModalTouchEnd}
          >
            {images.length > 0 && (
              <img
                src={getImageUrl(images[selectedImageIndex], 'original')}
                alt={`Design ${product.design_number} fullscreen view`}
                style={{
                  maxWidth: '90vw',
                  maxHeight: '80vh',
                  objectFit: 'contain',
                  transform: `scale(${zoomLevel})`,
                  transformOrigin: `${zoomPos.x}% ${zoomPos.y}%`,
                  transition: 'transform 0.15s ease-out',
                  boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
                  borderRadius: 8
                }}
              />
            )}
          </div>

          {/* Lightbox Bottom Thumbnails */}
          {images.length > 1 && (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                padding: '0.75rem',
                display: 'flex',
                justifyContent: 'center',
                gap: '0.65rem',
                background: 'rgba(15, 23, 42, 0.9)',
                borderTop: '1px solid rgba(255, 255, 255, 0.1)'
              }}
            >
              {images.map((img, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedImageIndex(idx)}
                  style={{
                    width: 54,
                    height: 54,
                    borderRadius: 6,
                    overflow: 'hidden',
                    border: selectedImageIndex === idx ? '2.5px solid #38bdf8' : '1px solid rgba(255,255,255,0.3)',
                    padding: 0,
                    background: '#0f172a',
                    cursor: 'pointer',
                    opacity: selectedImageIndex === idx ? 1 : 0.6
                  }}
                >
                  <img
                    src={getImageUrl(img, 'icon')}
                    alt={`Thumbnail ${idx + 1}`}
                    loading="lazy"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Main Catalog Page Component ── */
export default function ProductCatalog({
  currentUser,
  onAddToCart,
  cart = [],
  onUpdateQuantity,
  onRemoveFromCart,
  onClearCart,
  cartCount = 0
}) {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedThickness, setSelectedThickness] = useState('');
  const [sortBy, setSortBy] = useState('featured');
  const [sliderMax, setSliderMax] = useState(10000);
  const [maxPrice, setMaxPrice] = useState(10000);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [addedItemUid, setAddedItemUid] = useState(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    setLoading(true);
    try {
      const res = await request('/stock/catalog');
      const items = res.data || [];
      setProducts(items);
      if (items.length > 0) {
        const highestPrice = Math.max(...items.map((i) => Number(i.selling_price_per_piece || 0)), 1000);
        const topBound = Math.ceil(highestPrice / 500) * 500;
        setSliderMax(topBound);
        setMaxPrice(topBound);
      }
    } catch (e) {
      console.error('Failed to load catalog products:', e);
    } finally {
      setLoading(false);
    }
  }

  const handleAdd = (item, qty = 1) => {
    if (onAddToCart) {
      onAddToCart(item, qty);
      setAddedItemUid(item.uid);
      setToastMessage(`Added Design #${item.design_number} (${qty} sheet${qty > 1 ? 's' : ''}) to cart`);
      setTimeout(() => setAddedItemUid(null), 1500);
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  // Filter & Sort Products
  let filtered = products.filter((p) => {
    const sellingPrice = Number(p.selling_price_per_piece || 0);
    if (sellingPrice <= 0) return false;

    const matchSearch = !search || String(p.design_number).toLowerCase().includes(search.toLowerCase());
    const matchThick = !selectedThickness || String(p.thickness_mm) === selectedThickness;
    const matchPrice = sellingPrice <= maxPrice;

    const availablePcs = Number(p.available_pcs || 0);
    const avgRating = Number(p.avg_rating || 0);

    let matchCategory = true;
    if (selectedCategory === 'in_stock') matchCategory = availablePcs > 0;
    if (selectedCategory === 'thick_6') matchCategory = String(p.thickness_mm) === '6';
    if (selectedCategory === 'rated_4') matchCategory = avgRating >= 4.0;
    if (selectedCategory === 'sold_out') matchCategory = availablePcs <= 0;

    return matchSearch && matchThick && matchPrice && matchCategory;
  });

  // Sorting
  filtered.sort((a, b) => {
    if (sortBy === 'price_low') return Number(a.selling_price_per_piece || 0) - Number(b.selling_price_per_piece || 0);
    if (sortBy === 'price_high') return Number(b.selling_price_per_piece || 0) - Number(a.selling_price_per_piece || 0);
    if (sortBy === 'rating') return Number(b.avg_rating || 0) - Number(a.avg_rating || 0);
    if (sortBy === 'design') return String(a.design_number).localeCompare(String(b.design_number));
    return 0;
  });

  // Business Analytics: Log Search Queries & Unmet Customer Demand
  useEffect(() => {
    const trimmed = search.trim();
    if (!trimmed || trimmed.length < 2) return;

    const timer = setTimeout(() => {
      logSearchDemand({
        queryText: trimmed,
        searchType: 'text',
        resultsCount: filtered.length,
        userUid: currentUser?.uid || null
      }).catch(() => {});
    }, 1500);

    return () => clearTimeout(timer);
  }, [search, filtered.length, currentUser]);

  return (
    <div className="customer-store-wrapper">
      {/* Top Navbar */}
      <CustomerNavbar
        cartCount={cartCount}
        onOpenCart={() => setIsCartOpen(true)}
        currentUser={currentUser}
      />

      <main style={{ maxWidth: 1320, width: '100%', margin: '0 auto', padding: '1rem', flex: 1 }}>
        {/* Hero Card */}
        <div className="cust-hero-card">
          <div style={{ position: 'relative', zIndex: 2, maxWidth: 640 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(56, 189, 248, 0.15)', border: '1px solid rgba(56, 189, 248, 0.3)', color: '#38bdf8', padding: '0.25rem 0.65rem', borderRadius: 20, fontSize: '0.75rem', fontWeight: 800, marginBottom: '0.5rem' }}>
              <span>✨</span> ARCHITECTURAL WALL ART PANELS
            </div>
            <h1 style={{ margin: '0 0 0.4rem', fontSize: '1.85rem', fontWeight: 900, lineHeight: 1.2, color: '#fff' }}>
              Luxury Decorative Wall Panels
            </h1>
            <p style={{ margin: '0 0 1rem', color: '#94a3b8', fontSize: '0.92rem', lineHeight: 1.4 }}>
              Choose your exact sheet quantities. High-gloss finish, immediate courier dispatch.
            </p>

            <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
              <div style={{ background: 'rgba(255, 255, 255, 0.08)', padding: '0.35rem 0.75rem', borderRadius: 6, fontSize: '0.78rem', color: '#cbd5e1' }}>
                📦 <strong>{products.length}</strong> Designs
              </div>
              <div style={{ background: 'rgba(255, 255, 255, 0.08)', padding: '0.35rem 0.75rem', borderRadius: 6, fontSize: '0.78rem', color: '#cbd5e1' }}>
                ⚡ <strong>{products.filter(p => Number(p.available_pcs || 0) > 0).length}</strong> Ready in Warehouse
              </div>
              <div style={{ background: 'rgba(255, 255, 255, 0.08)', padding: '0.35rem 0.75rem', borderRadius: 6, fontSize: '0.78rem', color: '#cbd5e1' }}>
                🚚 Free Delivery on ₹5,000+
              </div>
            </div>
          </div>
        </div>

        {/* Category Pills */}
        <div className="cust-category-pills">
          <button
            type="button"
            className={`cust-pill ${selectedCategory === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedCategory('all')}
          >
            🎨 All Designs ({products.length})
          </button>
          <button
            type="button"
            className={`cust-pill ${selectedCategory === 'in_stock' ? 'active' : ''}`}
            onClick={() => setSelectedCategory('in_stock')}
          >
            ✓ In Stock ({products.filter((p) => Number(p.available_pcs || 0) > 0).length})
          </button>
          <button
            type="button"
            className={`cust-pill ${selectedCategory === 'thick_6' ? 'active' : ''}`}
            onClick={() => setSelectedCategory('thick_6')}
          >
            💎 6mm Heavy-Duty
          </button>
          <button
            type="button"
            className={`cust-pill ${selectedCategory === 'rated_4' ? 'active' : ''}`}
            onClick={() => setSelectedCategory('rated_4')}
          >
            ⭐ Top Rated (4.0+ ★)
          </button>
          <button
            type="button"
            className={`cust-pill ${selectedCategory === 'sold_out' ? 'active' : ''}`}
            onClick={() => setSelectedCategory('sold_out')}
          >
            ⚠️ Sold Out
          </button>
        </div>

        {/* Filter Toolbar */}
        <div className="cust-filter-bar">
          <div style={{ flex: '2 1 200px', position: 'relative' }}>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '0.25rem' }}>
              🔍 Search Design Number
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                id="tour-search-bar"
                placeholder="e.g. 11246"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.6rem 2.2rem 0.6rem 0.75rem',
                  borderRadius: 8,
                  border: '1.5px solid #cbd5e1',
                  fontSize: '0.9rem'
                }}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  style={{
                    position: 'absolute',
                    right: 8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: 700
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          <div style={{ flex: '1 1 130px' }}>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '0.25rem' }}>
              Thickness
            </label>
            <select
              value={selectedThickness}
              onChange={(e) => setSelectedThickness(e.target.value)}
              style={{
                width: '100%',
                padding: '0.6rem 0.75rem',
                borderRadius: 8,
                border: '1.5px solid #cbd5e1',
                fontSize: '0.9rem',
                background: '#fff'
              }}
            >
              <option value="">All Thicknesses</option>
              <option value="2">2 mm</option>
              <option value="3">3 mm</option>
              <option value="5">5 mm</option>
              <option value="6">6 mm</option>
              <option value="9">9 mm</option>
              <option value="12">12 mm</option>
              <option value="18">18 mm</option>
            </select>
          </div>

          <div style={{ flex: '1 1 140px' }}>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '0.25rem' }}>
              Sort Results
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{
                width: '100%',
                padding: '0.6rem 0.75rem',
                borderRadius: 8,
                border: '1.5px solid #cbd5e1',
                fontSize: '0.9rem',
                background: '#fff'
              }}
            >
              <option value="featured">✨ Featured</option>
              <option value="price_low">💰 Price: Low to High</option>
              <option value="price_high">💎 Price: High to Low</option>
              <option value="rating">⭐ Highest Rated</option>
              <option value="design">🔢 Design Number</option>
            </select>
          </div>

          <div style={{ flex: '2 1 180px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>Max Price</label>
              <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#2563eb' }}>Up to ₹{maxPrice}</span>
            </div>
            <input
              type="range"
              min="0"
              max={sliderMax}
              step="50"
              value={maxPrice}
              onChange={(e) => setMaxPrice(Number(e.target.value))}
              style={{ width: '100%', cursor: 'pointer' }}
            />
          </div>
        </div>

        {/* Results Banner */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <span style={{ fontSize: '0.88rem', color: '#64748b', fontWeight: 600 }}>
            Showing <strong>{filtered.length}</strong> designs
          </span>

          {(search || selectedThickness || selectedCategory !== 'all' || maxPrice < sliderMax) && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setSelectedThickness('');
                setSelectedCategory('all');
                setMaxPrice(sliderMax);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#2563eb',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              Reset filters
            </button>
          )}
        </div>

        {/* Products Grid */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem 1rem', color: '#64748b' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>⏳</div>
            <h3>Loading designs...</h3>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3.5rem 1.5rem', background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🔍</div>
            <h3 style={{ margin: '0 0 0.35rem', color: '#0f172a' }}>No designs matched your filters</h3>
            <p style={{ color: '#64748b', fontSize: '0.88rem', marginBottom: '1.25rem' }}>Try clearing your search or price filter.</p>
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setSelectedThickness('');
                setSelectedCategory('all');
                setMaxPrice(sliderMax);
              }}
              style={{ padding: '0.55rem 1.25rem', background: '#0f172a', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700 }}
            >
              Clear All Filters
            </button>
          </div>
        ) : (
          <div className="cust-products-grid">
            {filtered.map((item, idx) => (
              <ProductCard
                key={item.uid}
                product={item}
                onSelect={(p) => setSelectedProduct(p)}
                onAddToCart={handleAdd}
                isAdded={addedItemUid === item.uid}
                isFirstCard={idx === 0}
              />
            ))}
          </div>
        )}

        {/* Modal */}
        {selectedProduct && (
          <ProductDetailModal
            product={selectedProduct}
            currentUser={currentUser}
            onClose={() => setSelectedProduct(null)}
            onAddToCart={handleAdd}
            onBuyNow={() => navigate('/checkout')}
            onReviewUpdated={fetchProducts}
          />
        )}

        {/* Cart Drawer */}
        <CartDrawer
          isOpen={isCartOpen}
          onClose={() => setIsCartOpen(false)}
          cart={cart}
          onUpdateQuantity={onUpdateQuantity}
          onRemoveFromCart={onRemoveFromCart}
          onClearCart={onClearCart}
        />

        {/* Toast */}
        {toastMessage && (
          <div className="cust-toast">
            <span>🛒 {toastMessage}</span>
            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              style={{
                background: '#2563eb',
                color: '#fff',
                border: 'none',
                padding: '0.35rem 0.75rem',
                borderRadius: 6,
                fontWeight: 700,
                fontSize: '0.78rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              View Cart
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
