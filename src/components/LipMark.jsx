/**
 * A realistic lipstick "kiss" print. Render <LipFilters /> once on the page
 * so the stamp texture filter is available, then place <LipMark /> anywhere.
 */
export const LIP_COLORS = ['#e8336f', '#d81b60', '#ff4f8b', '#c2185b', '#f06292'];

export function LipFilters() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
      <defs>
        <filter id="lipTexture" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="noise" />
          <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -0.9 1.35" result="speckle" />
          <feComposite in="SourceGraphic" in2="speckle" operator="in" result="stamped" />
          <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="3" result="warp" />
          <feDisplacementMap in="stamped" in2="warp" scale="4" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    </svg>
  );
}

const UPPER =
  'M6 40 C18 28 32 13 47 16 C54 17.5 57 22 60 22 C63 22 66 17.5 73 16 C88 13 102 28 114 40 C96 37.5 78 35.5 60 39.5 C42 35.5 24 37.5 6 40 Z';
const LOWER = 'M6 40 C24 42.5 42 43 60 44.5 C78 43 96 42.5 114 40 C104 60 85 73 60 73 C35 73 16 60 6 40 Z';

export default function LipMark({ color = LIP_COLORS[0], size = 90, style, className }) {
  return (
    <svg viewBox="0 0 120 80" width={size} height={size * (80 / 120)} style={style} className={className} aria-hidden>
      <g filter="url(#lipTexture)" opacity="0.97">
        <path d={UPPER} fill={color} />
        <path d={LOWER} fill={color} />
        {/* lip creases (gaps in the print) */}
        <g stroke="#fff" strokeOpacity="0.4" strokeWidth="1.3" strokeLinecap="round" fill="none">
          <path d="M30 26 q2 6 1 11" />
          <path d="M40 20 q2 8 1 16" />
          <path d="M50 19 q1 8 0 17" />
          <path d="M70 19 q-1 8 0 17" />
          <path d="M80 20 q-2 8 -1 16" />
          <path d="M90 26 q-2 6 -1 11" />
          <path d="M26 50 q3 8 6 14" />
          <path d="M38 47 q2 10 4 20" />
          <path d="M50 47 q1 12 1 24" />
          <path d="M60 47 v25" />
          <path d="M70 47 q-1 12 -1 24" />
          <path d="M82 47 q-2 10 -4 20" />
          <path d="M94 50 q-3 8 -6 14" />
        </g>
        {/* parting line */}
        <path d="M8 40.5 C26 41.5 44 41.5 60 42 C76 41.5 94 41.5 112 40.5" stroke="#fff" strokeOpacity=".55" strokeWidth="1.6" fill="none" />
      </g>
      {/* gloss */}
      <ellipse cx="46" cy="56" rx="10" ry="3.5" fill="#fff" opacity=".35" transform="rotate(-6 46 56)" />
    </svg>
  );
}
