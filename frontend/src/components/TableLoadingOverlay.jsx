import React from 'react';

/**
 * Reusable Table Loading Overlay & Interaction Guard
 * Place inside any table container with `className="table-loading-container"`
 * or wrap around tables to block user interaction and show a loading spinner.
 */
export default function TableLoadingOverlay({
  loading = false,
  text = 'Loading data, please wait…',
  subtext = 'Fetching latest records',
  minHeight = null,
  style = {}
}) {
  if (!loading) return null;

  return (
    <div
      className="table-loading-overlay"
      role="status"
      aria-busy="true"
      aria-live="polite"
      style={{ minHeight: minHeight ? `${minHeight}px` : undefined, ...style }}
    >
      <div className="table-spinner-wrap">
        <div className="table-spinner" />
        <div className="table-loading-text">{text}</div>
        {subtext && <div className="table-loading-subtext">{subtext}</div>}
      </div>
    </div>
  );
}

/**
 * Convenience wrapper component that automatically applies container styles and overlay
 */
export function TableContainer({
  loading = false,
  text = 'Loading data, please wait…',
  subtext = 'Fetching latest records',
  children,
  className = '',
  style = {}
}) {
  return (
    <div
      className={`table-loading-container ${loading ? 'is-loading' : ''} ${className}`}
      style={style}
    >
      {children}
      <TableLoadingOverlay loading={loading} text={text} subtext={subtext} />
    </div>
  );
}
