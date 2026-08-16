import { useEffect, useRef, useState } from 'react';
import CameraCapture from './CameraCapture.jsx';
import { imageSearch, uploadNewDesignImage } from '../api/stock.js';

/* ── Lightbox Gallery Modal with Next/Prev and Touch Swipe ──── */
function MatchGalleryModal({ matches, currentIndex, onClose, onSelect, onNavigate }) {
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);

  const minSwipeDistance = 45;

  const currentMatch = matches[currentIndex];
  if (!currentMatch) return null;

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < matches.length - 1;

  const handlePrev = (e) => {
    e?.stopPropagation();
    if (hasPrev) onNavigate(currentIndex - 1);
    else onNavigate(matches.length - 1); // wrap around
  };

  const handleNext = (e) => {
    e?.stopPropagation();
    if (hasNext) onNavigate(currentIndex + 1);
    else onNavigate(0); // wrap around
  };

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
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    if (isLeftSwipe) {
      handleNext();
    } else if (isRightSwipe) {
      handlePrev();
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft') handlePrev();
      else if (e.key === 'ArrowRight') handleNext();
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, matches]);

  const displayTitle = currentMatch.design_number
    ? `Design #${currentMatch.design_number}`
    : currentMatch.filename;
  const matchScore = Math.round((currentMatch.score || 0) * 100);

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(6px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        className="modal-box"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          background: '#fff',
          borderRadius: 14,
          maxWidth: 620,
          width: '100%',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2), 0 8px 10px -6px rgba(0,0,0,0.1)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          userSelect: 'none',
        }}
      >
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem 1.25rem', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#0f172a' }}>
              {displayTitle}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.15rem' }}>
              <span style={{ color: '#16a34a', fontWeight: 600 }}>{matchScore}% Match</span>
              {' • '}
              <span>Image {currentIndex + 1} of {matches.length}</span>
              {' (Swipe or use ‹ › to browse)'}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: '#e2e8f0',
              border: 'none',
              borderRadius: '50%',
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1rem',
              fontWeight: 'bold',
              color: '#475569',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        {/* Modal Image Area with Navigation Buttons */}
        <div
          style={{
            position: 'relative',
            background: '#0f172a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 320,
            maxHeight: '62vh',
            padding: '0.5rem',
          }}
        >
          {matches.length > 1 && (
            <button
              type="button"
              onClick={handlePrev}
              title="Previous image (Left Arrow)"
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'rgba(255, 255, 255, 0.85)',
                color: '#0f172a',
                border: 'none',
                borderRadius: '50%',
                width: 42,
                height: 42,
                fontSize: '1.5rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10,
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.3)',
              }}
            >
              ‹
            </button>
          )}

          <img
            src={`/images/${currentMatch.filename}`}
            alt={displayTitle}
            style={{
              maxWidth: '100%',
              maxHeight: '58vh',
              objectFit: 'contain',
              borderRadius: 6,
            }}
          />

          {matches.length > 1 && (
            <button
              type="button"
              onClick={handleNext}
              title="Next image (Right Arrow)"
              style={{
                position: 'absolute',
                right: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'rgba(255, 255, 255, 0.85)',
                color: '#0f172a',
                border: 'none',
                borderRadius: '50%',
                width: 42,
                height: 42,
                fontSize: '1.5rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10,
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.3)',
              }}
            >
              ›
            </button>
          )}
        </div>

        {/* Modal Footer with Direct Select Button */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0.85rem 1.25rem',
            borderTop: '1px solid #e2e8f0',
            background: '#f8fafc',
          }}
        >
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            {matches.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={handlePrev}
                  style={{ background: '#e2e8f0', color: '#334155', border: 'none', padding: '0.4rem 0.75rem', borderRadius: 6, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
                >
                  ‹ Prev
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  style={{ background: '#e2e8f0', color: '#334155', border: 'none', padding: '0.4rem 0.75rem', borderRadius: 6, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
                >
                  Next ›
                </button>
              </>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={onClose}
              style={{ background: '#cbd5e1', color: '#334155', border: 'none', padding: '0.5rem 1rem', borderRadius: 6, cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600 }}
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => onSelect(currentMatch)}
              style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '0.5rem 1.25rem', borderRadius: 6, cursor: 'pointer', fontSize: '0.88rem', fontWeight: 700 }}
            >
              ✓ Select {displayTitle}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Full capture -> vector search -> pick-one-or-"new design" flow, shared by
// Stock Inward and Billing.
export default function ImageMatchPicker({ autoStartCamera = false, onResolved, onImageClick, initialTag = null }) {
  const [matches, setMatches] = useState(null); // null = not searched yet
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [previewUrl, setPreviewUrl]   = useState(initialTag?.previewUrl || (initialTag?.image_filename ? `/images/${initialTag.image_filename}` : null));
  const [selectedTag, setSelectedTag] = useState(initialTag || null);
  const [galleryIndex, setGalleryIndex] = useState(null); // index of match currently opened in lightbox
  const lastBlobRef = useRef(null);

  const clearImage = () => {
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setMatches(null);
    setError(null);
    setSelectedTag(null);
    setGalleryIndex(null);
    lastBlobRef.current = null;
    if (onResolved) onResolved(null);
  };

  const persistNewDesign = async (blob) => {
    if (!blob) {
      const tag = { isNewDesign: true, image_filename: null };
      setSelectedTag(tag);
      if (onResolved) onResolved(tag);
      return;
    }

    try {
      const res = await uploadNewDesignImage(blob);
      const filename = res.data?.filename;
      const tag = { isNewDesign: true, image_filename: filename, previewUrl: filename ? `/images/${filename}` : previewUrl };
      setSelectedTag(tag);
      if (onResolved) onResolved(tag);
    } catch (saveErr) {
      console.warn('New design upload failed:', saveErr.message);
      const tag = { isNewDesign: true, image_filename: null, previewUrl };
      setSelectedTag(tag);
      if (onResolved) onResolved(tag);
    }
  };

  const handleCapture = async (blob) => {
    lastBlobRef.current = blob;
    const localUrl = URL.createObjectURL(blob);
    setPreviewUrl(localUrl);
    setLoading(true);
    setError(null);
    setSelectedTag(null);
    setGalleryIndex(null);

    try {
      const { matches } = await imageSearch(blob);
      setMatches(matches);
      if (!matches || matches.length === 0) {
        await persistNewDesign(blob);
      }
    } catch (e) {
      setError(e.message);
      await persistNewDesign(blob);
    } finally {
      setLoading(false);
    }
  };

  const pickMatch = (matchObj) => {
    const filename = typeof matchObj === 'string' ? matchObj : matchObj.filename;
    const designNumber = typeof matchObj === 'object' ? matchObj.design_number : null;
    const tag = {
      isNewDesign: false,
      image_filename: filename,
      design_number: designNumber,
      previewUrl: `/images/${filename}`
    };
    setSelectedTag(tag);
    setGalleryIndex(null);
    if (onResolved) onResolved(tag);
  };

  return (
    <div className="image-match-picker" style={{ marginTop: '0.75rem' }}>
      <CameraCapture autoStart={autoStartCamera} onCapture={handleCapture} />

      {/* ── Uploaded / Captured Image Preview Card & Remove Button ── */}
      {previewUrl && (
        <div style={{ marginTop: '0.75rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '0.65rem 0.85rem', background: '#f8fafc', borderRadius: 8, border: '1px solid #cbd5e1' }}>
          <img
            src={previewUrl}
            alt="Uploaded preview"
            title="Click to view large preview"
            onClick={() => onImageClick && onImageClick({ url: previewUrl, title: selectedTag?.design_number ? `${selectedTag.design_number}` : (selectedTag?.image_filename || 'Uploaded Image') })}
            style={{ width: 68, height: 68, objectFit: 'cover', borderRadius: 6, border: '1px solid #94a3b8', background: '#fff', cursor: 'pointer' }}
          />
          <div style={{ flex: 1, fontSize: '0.85rem' }}>
            <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: '0.15rem' }}>
              {selectedTag
                ? (selectedTag.isNewDesign
                    ? '✨ Tagged as New Design'
                    : (selectedTag.design_number ? `✓ Matched ${selectedTag.design_number}` : '✓ Matched Existing Design'))
                : 'Photo Uploaded'}
            </div>
            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
              {selectedTag?.design_number
                ? `${selectedTag.design_number}`
                : (selectedTag?.image_filename ? `File: ${selectedTag.image_filename}` : 'Ready for stock entry')}
            </div>
          </div>
          <button
            type="button"
            onClick={clearImage}
            style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', padding: '0.4rem 0.85rem', borderRadius: 6, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}
          >
            Remove picture
          </button>
        </div>
      )}

      {loading && <p style={{ fontSize: '0.85rem', color: '#0284c7', marginTop: '0.5rem' }}>Searching for matching designs…</p>}
      {error && <div className="field-error" style={{ marginTop: '0.5rem' }}>Image search unavailable — treating as new design.</div>}

      {/* ── Top Matches Cards with Image Thumbnails, Preview Trigger & Select Buttons ── */}
      {matches && matches.length > 0 && !selectedTag && (
        <div className="match-grid" style={{ marginTop: '0.75rem' }}>
          <p style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', marginBottom: '0.5rem' }}>
            Top matches — touch/click image to preview & swipe, or click <strong>Select</strong>:
          </p>
          <div className="match-thumbs" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
            {matches.map((m, idx) => {
              const displayLabel = m.design_number ? `${m.design_number}` : (m.filename.length > 18 ? m.filename.slice(0, 18) + '…' : m.filename);
              return (
                <div
                  key={`${m.filename}-${m.design_number || idx}`}
                  className="match-card"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: '0.5rem',
                    background: '#fff',
                    border: '1px solid #cbd5e1',
                    borderRadius: 8,
                    width: 118,
                    boxShadow: '0 1px 3px 0 rgba(0,0,0,0.05)',
                  }}
                >
                  {/* Image Thumbnail — opens Lightbox Preview on click/touch */}
                  <div
                    onClick={() => setGalleryIndex(idx)}
                    title="Click image to open full preview"
                    style={{
                      position: 'relative',
                      cursor: 'pointer',
                      width: 76,
                      height: 76,
                      borderRadius: 6,
                      overflow: 'hidden',
                      marginBottom: '0.35rem',
                      border: '1px solid #e2e8f0',
                      background: '#f8fafc',
                    }}
                  >
                    <img
                      src={`/images/${m.filename}`}
                      alt={displayLabel}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                    <span
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        right: 0,
                        background: 'rgba(15, 23, 42, 0.7)',
                        color: '#fff',
                        fontSize: '0.62rem',
                        padding: '1px 3px',
                        borderRadius: '3px 0 0 0',
                      }}
                    >
                      🔍 Preview
                    </span>
                  </div>

                  {/* Design Label */}
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0f172a', textAlign: 'center', lineHeight: 1.2 }}>
                    {displayLabel}
                  </span>

                  {/* Match Score */}
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#16a34a', marginTop: '0.15rem', marginBottom: '0.4rem' }}>
                    {Math.round(m.score * 100)}% match
                  </span>

                  {/* Dedicated Select Button */}
                  <button
                    type="button"
                    onClick={() => pickMatch(m)}
                    style={{
                      width: '100%',
                      background: '#0284c7',
                      color: '#fff',
                      border: 'none',
                      padding: '0.35rem 0.4rem',
                      borderRadius: 5,
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Select
                  </button>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => persistNewDesign(lastBlobRef.current)}
            style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '0.45rem 0.85rem', borderRadius: 6, cursor: 'pointer', fontSize: '0.83rem', fontWeight: 600 }}
          >
            None of these — new design
          </button>
        </div>
      )}

      {/* ── Gallery Preview Modal with Swipe / Next / Prev & In-Modal Select ── */}
      {galleryIndex !== null && matches && matches.length > 0 && (
        <MatchGalleryModal
          matches={matches}
          currentIndex={galleryIndex}
          onClose={() => setGalleryIndex(null)}
          onNavigate={(newIdx) => setGalleryIndex(newIdx)}
          onSelect={pickMatch}
        />
      )}
    </div>
  );
}


