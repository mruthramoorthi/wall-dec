import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const TOUR_STORAGE_KEY = 'walldec_interactive_tour_seen';

export const INTERACTIVE_STEPS = [
  {
    step: 1,
    target: '#tour-search-bar',
    mobileTarget: '#tour-search-bar',
    title: '1. Search Design Number',
    text: 'Start here! Search by design number (e.g. 11246) or filter by panel thickness.',
    preferredPlacement: 'bottom',
    badgeText: 'SEARCH HERE',
    pageRoute: '/catalog'
  },
  {
    step: 2,
    target: '#tour-first-qty-stepper',
    mobileTarget: '#tour-first-qty-stepper',
    title: '2. Select Sheet Quantity First',
    text: 'Choose your exact quantity here (e.g. 2, 5, 20 sheets). Buy only what you need without forced minimum bulk orders!',
    preferredPlacement: 'top',
    badgeText: 'SELECT QTY',
    pageRoute: '/catalog'
  },
  {
    step: 3,
    target: '#tour-first-add-btn',
    mobileTarget: '#tour-first-add-btn',
    title: '3. Add to Shopping Cart',
    text: 'Click here to add your chosen quantity to your cart with instant real-time pricing.',
    preferredPlacement: 'top',
    badgeText: 'CLICK TO ADD',
    pageRoute: '/catalog'
  },
  {
    step: 4,
    target: '#tour-cart-btn',
    mobileTarget: '#tour-cart-btn-mobile',
    title: '4. Open Cart & 1-Step Checkout',
    text: 'Click your cart anytime to review sheets, see live GST totals, and place your order.',
    preferredPlacement: 'bottom',
    badgeText: 'VIEW CART',
    pageRoute: '/catalog'
  },
  {
    step: 5,
    target: '#tour-track-orders',
    mobileTarget: '#tour-track-orders-mobile',
    title: '5. Track Your Orders & Couriers',
    text: 'Click here to track your live 4-stage order progress (Placed ➔ Confirmed ➔ In Transit ➔ Delivered) with real-time AWB courier tracking!',
    preferredPlacement: 'bottom',
    badgeText: 'TRACK ORDERS',
    pageRoute: '/catalog'
  },
  {
    step: 6,
    target: '#tour-track-advances',
    mobileTarget: '#tour-track-advances-mobile',
    title: '6. Track Advances & Pre-bookings',
    text: 'Click here to view your store deposit balances, check pre-booking reserves, and print thermal receipts anytime!',
    preferredPlacement: 'bottom',
    badgeText: 'MY ADVANCES',
    pageRoute: '/catalog'
  }
];

export default function CustomerTour({ isOpen, onClose, autoLaunch = false }) {
  const [activeStep, setActiveStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [targetRect, setTargetRect] = useState(null);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0, placement: 'bottom', arrowLeft: 50 });
  const location = useLocation();
  const navigate = useNavigate();
  const popoverRef = useRef(null);

  // Auto-launch check on mount
  useEffect(() => {
    if (autoLaunch) {
      const hasSeen = localStorage.getItem(TOUR_STORAGE_KEY);
      if (!hasSeen) {
        const timer = setTimeout(() => {
          setIsVisible(true);
        }, 800);
        return () => clearTimeout(timer);
      }
    }
  }, [autoLaunch]);

  // Synchronize manual trigger from parent
  useEffect(() => {
    if (isOpen) {
      setActiveStep(0);
      setIsVisible(true);
    } else if (isOpen === false) {
      setIsVisible(false);
    }
  }, [isOpen]);

  const currentStep = INTERACTIVE_STEPS[activeStep] || INTERACTIVE_STEPS[0];

  // Helper to get active element target based on viewport width
  const getActiveTargetSelector = useCallback((step) => {
    if (!step) return null;
    const isMobile = window.innerWidth < 768;
    if (isMobile && step.mobileTarget) {
      const mobileEl = document.querySelector(step.mobileTarget);
      if (mobileEl) return step.mobileTarget;
    }
    return step.target;
  }, []);

  // Update target positioning & exact arrow direction
  const updatePosition = useCallback(() => {
    if (!isVisible) return;
    const step = INTERACTIVE_STEPS[activeStep];
    if (!step) return;

    const selector = getActiveTargetSelector(step);
    const el = selector ? document.querySelector(selector) : null;

    if (el) {
      const rect = el.getBoundingClientRect();
      setTargetRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        bottom: rect.bottom,
        right: rect.right
      });

      const popoverWidth = Math.min(340, window.innerWidth - 28);
      const popoverHeight = 210; // estimated max height
      let placement = step.preferredPlacement || 'bottom';
      let top = 0;
      let left = rect.left + rect.width / 2 - popoverWidth / 2;

      // Ensure horizontal bounds
      if (left < 14) left = 14;
      if (left + popoverWidth > window.innerWidth - 14) {
        left = window.innerWidth - popoverWidth - 14;
      }

      // Calculate arrow position along top/bottom edge of popover
      const targetCenterX = rect.left + rect.width / 2;
      const arrowLeft = Math.max(20, Math.min(popoverWidth - 20, targetCenterX - left));

      // Decide vertical placement (above vs below target)
      // If target is in the top 35% of the screen, place below. If in bottom 35%, place above.
      if (rect.top < window.innerHeight * 0.4) {
        placement = 'bottom';
        top = rect.bottom + 14;
      } else if (rect.bottom > window.innerHeight * 0.6) {
        placement = 'top';
        top = rect.top - popoverHeight - 14;
      } else {
        if (placement === 'bottom') {
          top = rect.bottom + 14;
        } else {
          top = rect.top - popoverHeight - 14;
        }
      }

      // Safety check so popover never goes off-screen
      if (top < 10) {
        top = rect.bottom + 14;
        placement = 'bottom';
      } else if (top + popoverHeight > window.innerHeight - 10) {
        top = Math.max(10, rect.top - popoverHeight - 14);
        placement = 'top';
      }

      setPopoverPos({ top, left, placement, width: popoverWidth, arrowLeft });
    } else {
      // Fallback: center in viewport if target element is missing on current page
      setTargetRect(null);
      const popoverWidth = Math.min(340, window.innerWidth - 28);
      setPopoverPos({
        top: window.innerHeight / 2 - 100,
        left: window.innerWidth / 2 - popoverWidth / 2,
        placement: 'center',
        width: popoverWidth,
        arrowLeft: popoverWidth / 2
      });
    }
  }, [activeStep, isVisible, getActiveTargetSelector]);

  // Scroll target element smoothly into view on step change
  useEffect(() => {
    if (!isVisible) return;
    const step = INTERACTIVE_STEPS[activeStep];
    if (!step) return;

    if (step.pageRoute && location.pathname !== step.pageRoute) {
      navigate(step.pageRoute);
    }

    const timer = setTimeout(() => {
      const selector = getActiveTargetSelector(step);
      const el = selector ? document.querySelector(selector) : null;
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      updatePosition();
    }, 150);

    return () => clearTimeout(timer);
  }, [activeStep, isVisible, location.pathname, navigate, updatePosition, getActiveTargetSelector]);

  // Listen to resize and scroll
  useEffect(() => {
    if (!isVisible) return;
    const handleRecalc = () => updatePosition();
    window.addEventListener('resize', handleRecalc);
    window.addEventListener('scroll', handleRecalc, true);
    return () => {
      window.removeEventListener('resize', handleRecalc);
      window.removeEventListener('scroll', handleRecalc, true);
    };
  }, [isVisible, updatePosition]);

  // Disable background scrolling while touring is active
  useEffect(() => {
    if (!isVisible) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isVisible]);

  const handleNext = () => {
    if (activeStep < INTERACTIVE_STEPS.length - 1) {
      setActiveStep((prev) => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (activeStep > 0) {
      setActiveStep((prev) => prev - 1);
    }
  };

  const handleComplete = () => {
    localStorage.setItem(TOUR_STORAGE_KEY, 'true');
    setIsVisible(false);
    if (onClose) onClose();
  };

  if (!isVisible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        pointerEvents: 'none', // Allow clicks to reach real elements
        fontFamily: 'inherit'
      }}
    >
      {/* ── Light Backdrop (Outside clicks are ignored as requested) ── */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.16)', // Very light & subtle
          pointerEvents: 'auto', // Captures clicks so background isn't accidentally clicked
          transition: 'all 0.2s ease'
        }}
      />

      {/* ── Ultra-Clear Glowing Focus Frame on Target Element ── */}
      {targetRect && (
        <div
          style={{
            position: 'fixed',
            top: targetRect.top - 4,
            left: targetRect.left - 4,
            width: targetRect.width + 8,
            height: targetRect.height + 8,
            borderRadius: 8,
            border: '2.5px solid #2563eb',
            outline: '2px solid rgba(56, 189, 248, 0.8)',
            boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.16), 0 0 16px rgba(37, 99, 235, 0.5)',
            pointerEvents: 'none',
            zIndex: 100000,
            transition: 'all 0.25s ease-out'
          }}
        />
      )}

      {/* ── Animated Bouncing Pointer Tag with Arrow Pointing Directly at Element ── */}
      {targetRect && (
        <div
          style={{
            position: 'fixed',
            zIndex: 100002,
            pointerEvents: 'none',
            transition: 'all 0.25s ease-out',
            ...(popoverPos.placement === 'bottom'
              ? {
                  top: targetRect.bottom + 4,
                  left: targetRect.left + targetRect.width / 2 - 45,
                  animation: 'bounceDown 1.2s infinite'
                }
              : {
                  top: targetRect.top - 36,
                  left: targetRect.left + targetRect.width / 2 - 45,
                  animation: 'bounceUp 1.2s infinite'
                })
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              background: '#2563eb',
              color: '#fff',
              padding: '0.22rem 0.6rem',
              borderRadius: 16,
              fontSize: '0.75rem',
              fontWeight: 800,
              boxShadow: '0 2px 8px rgba(37, 99, 235, 0.5)',
              lineHeight: 1
            }}
          >
            <span>{popoverPos.placement === 'bottom' ? '⬆️' : '👇'}</span>
            <span>{currentStep.badgeText || 'CLICK HERE'}</span>
          </div>
        </div>
      )}

      {/* ── High-Contrast Clean White Floating Tooltip Card ── */}
      <div
        ref={popoverRef}
        style={{
          position: 'fixed',
          top: popoverPos.top,
          left: popoverPos.left,
          width: popoverPos.width,
          zIndex: 100003,
          background: '#ffffff',
          border: '1.5px solid #cbd5e1',
          borderRadius: 14,
          padding: '1.15rem',
          boxShadow: '0 16px 36px -8px rgba(15, 23, 42, 0.18), 0 2px 10px rgba(0,0,0,0.06)',
          color: '#0f172a',
          pointerEvents: 'auto',
          boxSizing: 'border-box'
        }}
      >
        {/* Step Badge & Close */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <span
            style={{
              background: '#eff6ff',
              color: '#1d4ed8',
              border: '1px solid #bfdbfe',
              padding: '0.15rem 0.5rem',
              borderRadius: 6,
              fontSize: '0.72rem',
              fontWeight: 800,
              letterSpacing: '0.5px'
            }}
          >
            STEP {activeStep + 1} OF {INTERACTIVE_STEPS.length}
          </span>

          <button
            type="button"
            onClick={handleComplete}
            style={{
              background: '#f1f5f9',
              border: '1px solid #e2e8f0',
              color: '#64748b',
              cursor: 'pointer',
              fontSize: '0.8rem',
              fontWeight: 800,
              width: 24,
              height: 24,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1
            }}
            title="Skip tour"
          >
            ✕
          </button>
        </div>

        {/* Title */}
        <h3 style={{ margin: '0 0 0.35rem', fontSize: '1.05rem', color: '#0f172a', fontWeight: 900, lineHeight: 1.3 }}>
          {currentStep.title}
        </h3>

        {/* Crisp Description */}
        <p style={{ margin: '0 0 1rem', fontSize: '0.86rem', color: '#475569', lineHeight: 1.45, fontWeight: 500 }}>
          {currentStep.text}
        </p>

        {/* Step Progress Dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '5px', marginBottom: '0.85rem' }}>
          {INTERACTIVE_STEPS.map((_, idx) => (
            <div
              key={idx}
              style={{
                width: idx === activeStep ? 18 : 6,
                height: 5,
                borderRadius: 3,
                background: idx === activeStep ? '#2563eb' : '#cbd5e1',
                transition: 'all 0.2s ease'
              }}
            />
          ))}
        </div>

        {/* Bottom Buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={handleComplete}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#64748b',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              padding: '0.35rem 0.45rem'
            }}
          >
            Skip Tour
          </button>

          <div style={{ display: 'flex', gap: '0.45rem' }}>
            {activeStep > 0 && (
              <button
                type="button"
                onClick={handlePrev}
                style={{
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  color: '#334155',
                  padding: '0.4rem 0.75rem',
                  borderRadius: 8,
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                ◂ Back
              </button>
            )}

            <button
              type="button"
              onClick={handleNext}
              style={{
                background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                color: '#fff',
                border: 'none',
                padding: '0.45rem 1.1rem',
                borderRadius: 8,
                fontSize: '0.84rem',
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(37,99,235,0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem'
              }}
            >
              <span>{activeStep === INTERACTIVE_STEPS.length - 1 ? 'Got it! ✓' : 'Next Step ➔'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Keyframe Animations ── */}
      <style>{`
        @keyframes bounceDown {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(5px); }
        }
        @keyframes bounceUp {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
      `}</style>
    </div>
  );
}
