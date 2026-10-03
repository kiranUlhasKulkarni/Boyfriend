/* Hand-tuned SVG icon set — rounded, soft, pastel. */

const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };

export const HeartPath = 'M12 21s-7.5-4.6-9.6-9.3C.9 8.2 3 4.5 6.6 4.2c2-.2 3.6.9 4.4 2.4h2c.8-1.5 2.4-2.6 4.4-2.4 3.6.3 5.7 4 4.2 7.5C19.5 16.4 12 21 12 21z';
// a nicer symmetric heart in a 100x100 box
export const HEART_D = 'M50 88 C20 66 4 48 4 30 C4 15 16 5 29 5 C38 5 45 10 50 18 C55 10 62 5 71 5 C84 5 96 15 96 30 C96 48 80 66 50 88 Z';

export function Heart({ size = 24, fill = '#ff7fb0', stroke, shine = true, className, style }) {
  const id = `hg-${fill.replace(/[^a-z0-9]/gi, '')}`;
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} style={style} aria-hidden>
      <defs>
        <radialGradient id={id} cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="35%" stopColor={fill} stopOpacity="1" />
          <stop offset="100%" stopColor={fill} />
        </radialGradient>
      </defs>
      <path d={HEART_D} fill={`url(#${id})`} stroke={stroke} strokeWidth={stroke ? 5 : 0} />
      {shine && <ellipse cx="28" cy="26" rx="9" ry="6" fill="#fff" opacity="0.65" transform="rotate(-30 28 26)" />}
    </svg>
  );
}

export const IconSound = ({ on }) => (
  <svg viewBox="0 0 24 24" {...base}>
    <path d="M4 9.5v5h3.5L12 19V5L7.5 9.5H4z" fill="currentColor" fillOpacity="0.15" />
    {on ? (
      <>
        <path d="M15.5 9a4 4 0 0 1 0 6" />
        <path d="M18 6.5a7.5 7.5 0 0 1 0 11" />
      </>
    ) : (
      <>
        <path d="M16 9.5l5 5" />
        <path d="M21 9.5l-5 5" />
      </>
    )}
  </svg>
);

export const IconSun = () => (
  <svg viewBox="0 0 24 24" {...base}>
    <circle cx="12" cy="12" r="4.2" fill="currentColor" fillOpacity="0.2" />
    {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
      <path key={a} d="M12 2.8v2.2" transform={`rotate(${a} 12 12)`} />
    ))}
  </svg>
);

export const IconMoon = () => (
  <svg viewBox="0 0 24 24" {...base}>
    <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" fill="currentColor" fillOpacity="0.2" />
    <path d="M16 4.5l.5 1.2 1.2.5-1.2.5-.5 1.2-.5-1.2-1.2-.5 1.2-.5z" strokeWidth="1.2" />
  </svg>
);

export const IconHome = () => (
  <svg viewBox="0 0 24 24" {...base}>
    <path d="M4 11l8-6.5 8 6.5" />
    <path d="M6 9.5V19a1 1 0 0 0 1 1h3.5v-5h3v5H17a1 1 0 0 0 1-1V9.5" fill="currentColor" fillOpacity="0.12" />
  </svg>
);

export const IconBack = () => (
  <svg viewBox="0 0 24 24" {...base}>
    <path d="M15 5l-7 7 7 7" />
  </svg>
);

export const IconLock = ({ size = 20 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} {...base}>
    <rect x="5" y="10.5" width="14" height="10" rx="3" fill="currentColor" fillOpacity="0.15" />
    <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    <circle cx="12" cy="15.5" r="1.3" fill="currentColor" />
  </svg>
);

export const IconStar = ({ size = 20, fill = '#ffd36e' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size}>
    <path
      d="M12 2.8l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.1l6.1-.7z"
      fill={fill}
      stroke="#e59a2f"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
    <path d="M9.3 9.2l1.2-2.4" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" opacity="0.8" />
  </svg>
);

export const IconPlay = () => (
  <svg viewBox="0 0 24 24" {...base}>
    <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" />
  </svg>
);

export const IconReplay = () => (
  <svg viewBox="0 0 24 24" {...base}>
    <path d="M4 12a8 8 0 1 0 2.5-5.8" />
    <path d="M4 4v4.5h4.5" />
  </svg>
);

export const IconArrowRight = () => (
  <svg viewBox="0 0 24 24" {...base}>
    <path d="M5 12h14" />
    <path d="M13 6l6 6-6 6" />
  </svg>
);

export const IconLips = ({ size = 22 }) => (
  <svg viewBox="0 0 64 40" width={size} height={size * 0.625}>
    <path d="M2 20C10 8 20 3 26 6c3 1.5 4.5 3 6 3s3-1.5 6-3c6-3 16 2 24 14-8 2-14 0-30 0S10 22 2 20z" fill="#ff5b8f" />
    <path d="M2 20c8 2 14 0 30 0s22 2 30 0c-6 12-18 18-30 18S8 32 2 20z" fill="#e8336f" />
  </svg>
);

/* ── Level node icons (drawn for 56x56 box) ── */
export function LevelIcon({ name, size = 34 }) {
  const s = { width: size, height: size };
  switch (name) {
    case 'sword':
      return (
        <svg viewBox="0 0 48 48" {...s}>
          <path d="M38 6l4 4-22 22-4-4z" fill="#e8f6ff" stroke="#3a6ea8" strokeWidth="2" strokeLinejoin="round" />
          <path d="M38 6l4 4-8 8" fill="none" stroke="#7fc3ff" strokeWidth="2" />
          <path d="M12 26l10 10" stroke="#2b2b3a" strokeWidth="4" strokeLinecap="round" />
          <path d="M9 37l5-5" stroke="#8a4b2a" strokeWidth="5" strokeLinecap="round" />
          <circle cx="7.5" cy="39.5" r="2.5" fill="#d8a640" />
          <path d="M6 18c6 2 8-4 14-2" stroke="#7fc3ff" strokeWidth="2" fill="none" strokeLinecap="round" opacity=".8" />
        </svg>
      );
    case 'cube':
      return (
        <svg viewBox="0 0 48 48" {...s}>
          <path d="M24 5l17 9v20l-17 9-17-9V14z" fill="#7be0a0" stroke="#2f8a57" strokeWidth="2" strokeLinejoin="round" />
          <path d="M7 14l17 9 17-9" fill="none" stroke="#2f8a57" strokeWidth="2" />
          <path d="M24 23v20" stroke="#2f8a57" strokeWidth="2" />
          <path d="M7 14l17-9 17 9-17 9z" fill="#b6f5cb" />
          <circle cx="17" cy="28" r="2" fill="#1f3b2b" />
          <circle cx="31" cy="28" r="2" fill="#1f3b2b" />
          <path d="M20 33q4 3 8 0" stroke="#1f3b2b" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        </svg>
      );
    case 'pot':
      return (
        <svg viewBox="0 0 48 48" {...s}>
          <path d="M14 10q2-4 0-7M24 10q2-4 0-7M34 10q2-4 0-7" stroke="#c9b3a3" strokeWidth="2" fill="none" strokeLinecap="round" />
          <ellipse cx="24" cy="18" rx="17" ry="5" fill="#ffd86b" stroke="#a86a1f" strokeWidth="2" />
          <path d="M7 18v12c0 7 8 11 17 11s17-4 17-11V18" fill="#d97b36" stroke="#a86a1f" strokeWidth="2" />
          <circle cx="18" cy="17" r="1.5" fill="#fff6d0" />
          <circle cx="27" cy="16" r="1.2" fill="#fff6d0" />
          <circle cx="31" cy="19" r="1.3" fill="#e2552d" />
          <path d="M4 22h3M41 22h3" stroke="#a86a1f" strokeWidth="3" strokeLinecap="round" />
          <path d="M12 28q12 5 24 0" stroke="#f3a866" strokeWidth="2" fill="none" />
        </svg>
      );
    case 'briefcase':
      return (
        <svg viewBox="0 0 48 48" {...s}>
          <path d="M18 13v-3a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v3" fill="none" stroke="#2c3e75" strokeWidth="2.5" />
          <rect x="5" y="13" width="38" height="27" rx="5" fill="#5b7fe0" stroke="#2c3e75" strokeWidth="2" />
          <path d="M5 23h38" stroke="#2c3e75" strokeWidth="2" />
          <rect x="21" y="20" width="6" height="6" rx="1.5" fill="#ffd36e" stroke="#2c3e75" strokeWidth="1.5" />
          <path d="M36 32l2 2m0-2l-2 2" stroke="#fff" strokeWidth="1.5" opacity=".8" />
        </svg>
      );
    case 'cards':
      return (
        <svg viewBox="0 0 48 48" {...s}>
          <rect x="6" y="10" width="20" height="28" rx="3" fill="#fff" stroke="#8a5cc9" strokeWidth="2" transform="rotate(-12 16 24)" />
          <rect x="20" y="8" width="20" height="28" rx="3" fill="#e4c9ff" stroke="#8a5cc9" strokeWidth="2" transform="rotate(10 30 22)" />
          <path d={'M30 27c-4-3-6-5-6-7.5a2.7 2.7 0 0 1 6-1 2.7 2.7 0 0 1 6 1c0 2.5-2 4.5-6 7.5z'} fill="#ff6f9f" transform="rotate(10 30 22)" />
        </svg>
      );
    case 'heart':
      return <Heart size={size} fill="#ff6f9f" />;
    case 'star':
      return (
        <svg viewBox="0 0 48 48" {...s}>
          <path d="M8 36L18 14l14 8 8-14" fill="none" stroke="#c2c8ff" strokeWidth="1.5" strokeDasharray="2 3" />
          {[
            [8, 36, 3],
            [18, 14, 4],
            [32, 22, 3],
            [40, 8, 3.5],
          ].map(([x, y, r], i) => (
            <path
              key={i}
              d={`M${x} ${y - r * 1.6}L${x + r * 0.5} ${y - r * 0.5}L${x + r * 1.6} ${y}L${x + r * 0.5} ${y + r * 0.5}L${x} ${y + r * 1.6}L${x - r * 0.5} ${y + r * 0.5}L${x - r * 1.6} ${y}L${x - r * 0.5} ${y - r * 0.5}Z`}
              fill="#fff6c2"
              stroke="#6c63d9"
              strokeWidth="1"
            />
          ))}
        </svg>
      );
    case 'boba':
      return (
        <svg viewBox="0 0 48 48" {...s}>
          <path d="M27 2l-3 14" stroke="#ff7fb0" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M11 14h26l-3 28a3 3 0 0 1-3 2.6H17a3 3 0 0 1-3-2.6z" fill="#f3d9c2" stroke="#8a5a36" strokeWidth="2" strokeLinejoin="round" />
          <path d="M9 13h30" stroke="#8a5a36" strokeWidth="3" strokeLinecap="round" />
          {[
            [18, 38],
            [24, 39],
            [30, 37],
            [21, 34],
            [27, 34],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="2.4" fill="#4a2a1a" />
          ))}
          <circle cx="20" cy="24" r="1.6" fill="#4a2a1a" />
          <circle cx="28" cy="24" r="1.6" fill="#4a2a1a" />
          <path d="M22 27q2 2 4 0" stroke="#4a2a1a" strokeWidth="1.4" fill="none" strokeLinecap="round" />
          <ellipse cx="17" cy="27" rx="2" ry="1.2" fill="#ff9cc2" />
          <ellipse cx="31" cy="27" rx="2" ry="1.2" fill="#ff9cc2" />
        </svg>
      );
    case 'quiz':
      return (
        <svg viewBox="0 0 48 48" {...s}>
          <path d="M8 8h32a4 4 0 0 1 4 4v18a4 4 0 0 1-4 4H22l-9 8v-8H8a4 4 0 0 1-4-4V12a4 4 0 0 1 4-4z" fill="#bdf0ee" stroke="#23847e" strokeWidth="2" strokeLinejoin="round" />
          <path d="M19 17a5 5 0 1 1 7 4.6c-1.4.6-2 1.5-2 3" fill="none" stroke="#23847e" strokeWidth="3" strokeLinecap="round" />
          <circle cx="24" cy="29" r="1.8" fill="#23847e" />
        </svg>
      );
    case 'plane':
      return (
        <svg viewBox="0 0 48 48" {...s}>
          <path d="M4 22L44 6 34 42 24 30z" fill="#fff" stroke="#d9619a" strokeWidth="2" strokeLinejoin="round" />
          <path d="M44 6L24 30l-2 10 6-7" fill="#ffd1e6" stroke="#d9619a" strokeWidth="2" strokeLinejoin="round" />
          <path d={'M14 34c-2-1.5-3-2.5-3-3.7a1.4 1.4 0 0 1 3-.5 1.4 1.4 0 0 1 3 .5c0 1.2-1 2.2-3 3.7z'} fill="#ff6f9f" />
        </svg>
      );
    default:
      return <Heart size={size} />;
  }
}
