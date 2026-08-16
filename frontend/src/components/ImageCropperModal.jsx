import { useState, useRef, useEffect, useCallback } from 'react';

export default function ImageCropperModal({ imageFile, onCropComplete, onClose }) {
  const [imageSrc, setImageSrc]     = useState(null);
  const [rotation, setRotation]     = useState(0); // 0, 90, 180, 270
  const [zoom, setZoom]             = useState(1);
  const [pan, setPan]               = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart]   = useState({ x: 0, y: 0 });

  const canvasRef = useRef(null);
  const imgRef    = useRef(null);

  useEffect(() => {
    if (imageFile) {
      const url = URL.createObjectURL(imageFile);
      setImageSrc(url);
      const img = new Image();
      img.onload = () => {
        imgRef.current = img;
        drawCanvas();
      };
      img.src = url;
      return () => URL.revokeObjectURL(url);
    }
  }, [imageFile]); // eslint-disable-line

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    const size = 300;
    canvas.width = size;
    canvas.height = size;

    ctx.clearRect(0, 0, size, size);

    ctx.save();
    // Center point
    ctx.translate(size / 2, size / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(zoom, zoom);
    ctx.translate(pan.x, pan.y);

    // Calculate aspect ratio preserving image fit
    const aspect = img.width / img.height;
    let drawW = size;
    let drawH = size;
    if (aspect > 1) {
      drawH = size;
      drawW = size * aspect;
    } else {
      drawW = size;
      drawH = size / aspect;
    }

    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();
  }, [rotation, zoom, pan]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({ x: e.touches[0].clientX - pan.x, y: e.touches[0].clientY - pan.y });
    }
  };

  const handleTouchMove = (e) => {
    if (!isDragging || e.touches.length !== 1) return;
    setPan({
      x: e.touches[0].clientX - dragStart.x,
      y: e.touches[0].clientY - dragStart.y,
    });
  };

  const rotateClockwise = () => setRotation((prev) => (prev + 90) % 360);
  const rotateCounterClockwise = () => setRotation((prev) => (prev + 270) % 360);
  const resetAll = () => {
    setRotation(0);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleSaveCrop = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Create circular/square cropped output canvas
    const outCanvas = document.createElement('canvas');
    const outSize = 256;
    outCanvas.width = outSize;
    outCanvas.height = outSize;
    const outCtx = outCanvas.getContext('2d');

    // Draw from preview canvas
    outCtx.drawImage(canvas, 0, 0, 300, 300, 0, 0, outSize, outSize);

    outCanvas.toBlob((blob) => {
      if (!blob) return;
      const croppedFile = new File([blob], `avatar-${Date.now()}.jpg`, { type: 'image/jpeg' });
      const previewUrl = URL.createObjectURL(blob);
      onCropComplete(croppedFile, previewUrl);
      onClose();
    }, 'image/jpeg', 0.92);
  };

  if (!imageFile) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(5px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      padding: '1rem',
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 16,
        padding: '1.5rem',
        maxWidth: '420px',
        width: '94vw',
        boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
        textAlign: 'center',
      }}>
        <h3 style={{ margin: '0 0 0.25rem 0', color: '#0f172a' }}>Crop &amp; Edit Profile Picture</h3>
        <p style={{ margin: '0 0 1rem 0', fontSize: '0.82rem', color: '#64748b' }}>
          Drag to reposition, rotate, or zoom your photo
        </p>

        {/* Canvas Crop Area with Circular Guide */}
        <div style={{
          position: 'relative',
          width: 300,
          height: 300,
          margin: '0 auto',
          borderRadius: '50%',
          overflow: 'hidden',
          boxShadow: '0 0 0 4px #2563eb, 0 8px 24px rgba(0,0,0,0.15)',
          background: '#0f172a',
          cursor: isDragging ? 'grabbing' : 'grab',
          userSelect: 'none',
          touchAction: 'none'
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleMouseUp}
        >
          <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
        </div>

        {/* Edit Controls Toolbar */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1.25rem' }}>
          <button
            type="button"
            onClick={rotateCounterClockwise}
            title="Rotate Left 90°"
            style={{ padding: '0.45rem 0.75rem', background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', borderRadius: 7, fontWeight: 700 }}
          >
            ↺ -90°
          </button>
          <button
            type="button"
            onClick={rotateClockwise}
            title="Rotate Right 90°"
            style={{ padding: '0.45rem 0.75rem', background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', borderRadius: 7, fontWeight: 700 }}
          >
            ↻ +90°
          </button>
          <button
            type="button"
            onClick={resetAll}
            title="Reset"
            style={{ padding: '0.45rem 0.75rem', background: '#f1f5f9', color: '#64748b', border: '1px solid #cbd5e1', borderRadius: 7, fontSize: '0.82rem' }}
          >
            Reset
          </button>
        </div>

        {/* Zoom Slider */}
        <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0 1rem' }}>
          <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Zoom:</span>
          <input
            type="range"
            min="0.5"
            max="3"
            step="0.05"
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            style={{ flex: 1, accentColor: '#2563eb' }}
          />
          <span style={{ fontSize: '0.8rem', color: '#64748b', minWidth: 35 }}>{Math.round(zoom * 100)}%</span>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1.25rem' }}>
          <button
            type="button"
            onClick={onClose}
            style={{ flex: 1, padding: '0.6rem', background: '#f8fafc', color: '#475569', border: '1px solid #cbd5e1', borderRadius: 8, fontWeight: 600 }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveCrop}
            style={{ flex: 1, padding: '0.6rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700 }}
          >
            ✓ Apply &amp; Save
          </button>
        </div>
      </div>
    </div>
  );
}
