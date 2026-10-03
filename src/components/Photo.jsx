import { useState } from 'react';
import { HEART_D } from './Icons';

/**
 * <Photo src="/placeholders/couple1.jpg" label="couple photo" />
 * Shows the image if it exists, otherwise a dreamy pastel placeholder
 * that tells you which file to drop in.
 */
export default function Photo({ src, label, alt = '', className = '', style, fit = 'cover', draggable = false }) {
  const [failed, setFailed] = useState(!src);
  if (failed) {
    const file = src?.split('/').pop();
    return (
      <div className={`photo-ph ${className}`} style={style} role="img" aria-label={alt || label || 'placeholder photo'}>
        <svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" className="photo-ph-art" aria-hidden>
          <defs>
            <linearGradient id="phg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#ffd3e4" />
              <stop offset="1" stopColor="#cfe5ff" />
            </linearGradient>
          </defs>
          <rect width="200" height="200" fill="url(#phg)" />
          <circle cx="40" cy="45" r="30" fill="#fff" opacity=".35" />
          <circle cx="170" cy="160" r="45" fill="#fff" opacity=".25" />
          <path d="M0 160 Q50 120 100 150 T200 140 V200 H0Z" fill="#fff" opacity=".35" />
          <g transform="translate(70 62) scale(.6)">
            <path d={HEART_D} fill="#ff8fb8" opacity=".9" />
          </g>
        </svg>
        <div className="photo-ph-label">
          <span>{label || 'your photo here'}</span>
          {file && <code>{file}</code>}
        </div>
      </div>
    );
  }
  // "smart": show the whole photo (contain) over a blurred, zoomed copy of itself —
  // looks great for any aspect ratio, incl. screenshots with black bars.
  if (fit === 'smart') {
    return (
      <div className={`photo-smart ${className}`} style={style} role="img" aria-label={alt || label || ''}>
        <img src={src} alt="" aria-hidden className="photo-smart-bg" draggable={false} />
        <img src={src} alt={alt} className="photo-smart-fg" draggable={draggable} onError={() => setFailed(true)} />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={{ objectFit: fit, ...style }}
      draggable={draggable}
      onError={() => setFailed(true)}
    />
  );
}
