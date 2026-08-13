import { useState } from 'react';
import CameraCapture from './CameraCapture.jsx';
import { imageSearch } from '../api/stock.js';

// Full capture -> vector search -> pick-one-or-"new design" flow, shared by
// Stock Inward and Billing (per SRS 5.3 / 5.4).
export default function ImageMatchPicker({ autoStartCamera = false, onResolved }) {
  const [matches, setMatches] = useState(null); // null = not searched yet
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleCapture = async (blob) => {
    setLoading(true);
    setError(null);
    try {
      const { matches } = await imageSearch(blob);
      setMatches(matches);
      if (!matches || matches.length === 0) {
        // No matches -> treat as new design immediately (SRS 5.3)
        onResolved({ isNewDesign: true, image_filename: null });
      }
    } catch (e) {
      setError(e.message);
      // Image service being unusable should never block the workflow.
      onResolved({ isNewDesign: true, image_filename: null });
    } finally {
      setLoading(false);
    }
  };

  const pick = (filename) => {
    onResolved({ isNewDesign: false, image_filename: filename });
  };

  return (
    <div className="image-match-picker">
      <CameraCapture autoStart={autoStartCamera} onCapture={handleCapture} />
      {loading && <p>Searching for matching designs…</p>}
      {error && <div className="field-error">Image search unavailable — treating as new design.</div>}
      {matches && matches.length > 0 && (
        <div className="match-grid">
          <p>Top matches — pick one, or treat as a new design:</p>
          <div className="match-thumbs">
            {matches.map((m) => (
              <button type="button" key={m.filename} className="match-thumb" onClick={() => pick(m.filename)}>
                <span className="match-filename">{m.filename}</span>
                <span className="match-score">{Math.round(m.score * 100)}%</span>
              </button>
            ))}
          </div>
          <button type="button" onClick={() => onResolved({ isNewDesign: true, image_filename: null })}>
            None of these — new design
          </button>
        </div>
      )}
    </div>
  );
}
