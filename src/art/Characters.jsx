/**
 * Chibi characters used across the map + levels.
 *  <HimChibi size={80} />   — pillu (light blue hoodie)
 *  <HerChibi size={80} />   — you (pink dress, long hair)
 * Both are 100x140 viewBox, feet at the bottom centre.
 * Tweak SKIN / HAIR colours below to match you two.
 */
const SKIN_HIM = '#e0a77f';
const SKIN_HER = '#eab48e';
const HAIR_HIM = '#2b1d1a';
const HAIR_HER = '#2e1c1a';

function Face({ skin, blush = '#ff8fb0', wink = false, mouth = 'smile' }) {
  return (
    <g>
      {/* eyes */}
      <g fill="#2a1a22">
        <ellipse cx="38" cy="58" rx="4.2" ry="5.2" />
        {wink ? <path d="M58 58q4-4 8 0" stroke="#2a1a22" strokeWidth="2.6" fill="none" strokeLinecap="round" /> : <ellipse cx="62" cy="58" rx="4.2" ry="5.2" />}
      </g>
      <circle cx="39.5" cy="56" r="1.6" fill="#fff" />
      {!wink && <circle cx="63.5" cy="56" r="1.6" fill="#fff" />}
      {/* blush */}
      <ellipse cx="30" cy="67" rx="6" ry="3.4" fill={blush} opacity=".55" />
      <ellipse cx="70" cy="67" rx="6" ry="3.4" fill={blush} opacity=".55" />
      {/* mouth */}
      {mouth === 'smile' && <path d="M44 68q6 6 12 0" stroke="#7a2e3c" strokeWidth="2.4" fill="none" strokeLinecap="round" />}
      {mouth === 'open' && <path d="M44 67q6 9 12 0z" fill="#a8344e" stroke="#7a2e3c" strokeWidth="1.5" strokeLinejoin="round" />}
      {mouth === 'kiss' && <path d="M48 66q4-3 4 1t-4 3q4 0 4 2.5t-4 1" stroke="#c23b62" strokeWidth="2.2" fill="none" strokeLinecap="round" />}
      {mouth === 'sad' && <path d="M45 71q5-5 10 0" stroke="#7a2e3c" strokeWidth="2.4" fill="none" strokeLinecap="round" />}
    </g>
  );
}

export function HimChibi({ size = 80, mouth = 'smile', wave = false, className, style }) {
  return (
    <svg viewBox="0 0 100 140" width={size} height={size * 1.4} className={className} style={style} aria-hidden>
      {/* shadow */}
      <ellipse cx="50" cy="136" rx="24" ry="4" fill="#000" opacity=".12" />
      {/* legs */}
      <rect x="37" y="112" width="10" height="20" rx="5" fill="#3d4a6b" />
      <rect x="53" y="112" width="10" height="20" rx="5" fill="#3d4a6b" />
      <ellipse cx="41" cy="132" rx="8" ry="4.5" fill="#fff" stroke="#c9d3e6" strokeWidth="1.5" />
      <ellipse cx="59" cy="132" rx="8" ry="4.5" fill="#fff" stroke="#c9d3e6" strokeWidth="1.5" />
      {/* body / hoodie */}
      <path d="M28 96q0-16 22-16t22 16v20H28z" fill="#9ccfff" stroke="#5f9fe0" strokeWidth="2" strokeLinejoin="round" />
      <path d="M43 82l7 9 7-9" fill="none" stroke="#5f9fe0" strokeWidth="2" strokeLinecap="round" />
      <path d="M46 92v8M54 92v8" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      <rect x="39" y="102" width="22" height="9" rx="4" fill="#86c1fb" stroke="#5f9fe0" strokeWidth="1.5" />
      {/* tiny heart on hoodie */}
      <path d="M64 92c-2.4-1.8-3.6-3-3.6-4.4a1.6 1.6 0 0 1 3.6-.6 1.6 1.6 0 0 1 3.6.6c0 1.4-1.2 2.6-3.6 4.4z" fill="#ff7fb0" />
      {/* arms */}
      <path d="M30 92q-8 8-6 18" stroke="#9ccfff" strokeWidth="9" strokeLinecap="round" fill="none" />
      {wave ? (
        <g className="chibi-wave">
          <path d="M70 92q10-6 12-20" stroke="#9ccfff" strokeWidth="9" strokeLinecap="round" fill="none" />
          <circle cx="82" cy="70" r="5.5" fill={SKIN_HIM} />
        </g>
      ) : (
        <path d="M70 92q8 8 6 18" stroke="#9ccfff" strokeWidth="9" strokeLinecap="round" fill="none" />
      )}
      <circle cx="24" cy="111" r="5.5" fill={SKIN_HIM} />
      {!wave && <circle cx="76" cy="111" r="5.5" fill={SKIN_HIM} />}
      {/* head */}
      <ellipse cx="50" cy="55" rx="31" ry="29" fill={SKIN_HIM} />
      <ellipse cx="19.5" cy="58" rx="4.5" ry="6" fill={SKIN_HIM} />
      <ellipse cx="80.5" cy="58" rx="4.5" ry="6" fill={SKIN_HIM} />
      {/* hair */}
      <path
        d="M19 52q-2-26 22-30 6-6 16-3 10-2 17 6 10 8 8 27-4-10-12-14-6 6-16 6 4-4 3-8-8 8-22 8 2-3 2-6-10 6-18 14z"
        fill={HAIR_HIM}
      />
      {/* curly top, like pillu */}
      <g fill={HAIR_HIM}>
        {[[24, 36, 7], [32, 26, 8], [43, 20, 8.5], [55, 19, 8.5], [66, 23, 8], [75, 31, 7.5], [80, 42, 6.5], [20, 46, 6]].map(([cx, cy, r], i) => (
          <circle key={i} cx={cx} cy={cy} r={r} />
        ))}
      </g>
      <g fill="none" stroke="#4a3530" strokeWidth="1.6" strokeLinecap="round" opacity=".8">
        <path d="M38 22q4-4 7 0M52 18q4-4 7 0M64 24q4-3 6 1M28 30q3-4 6-1" />
      </g>
      {/* little stubble */}
      <path d="M40 74q10 7 20 0" stroke="#3a2a28" strokeWidth="3" fill="none" strokeLinecap="round" opacity=".18" />
      <Face skin={SKIN_HIM} mouth={mouth} />
    </svg>
  );
}

export function HerChibi({ size = 80, mouth = 'smile', wave = false, wink = false, className, style }) {
  return (
    <svg viewBox="0 0 100 140" width={size} height={size * 1.4} className={className} style={style} aria-hidden>
      <ellipse cx="50" cy="136" rx="24" ry="4" fill="#000" opacity=".12" />
      {/* back hair */}
      <path d="M18 56q-4 40 6 56 10 4 18-2V60zM82 56q4 40-6 56-10 4-18-2V60z" fill={HAIR_HER} />
      {/* legs */}
      <rect x="40" y="114" width="8" height="18" rx="4" fill={SKIN_HER} />
      <rect x="52" y="114" width="8" height="18" rx="4" fill={SKIN_HER} />
      <ellipse cx="43" cy="132" rx="7" ry="4" fill="#ff7fb0" />
      <ellipse cx="57" cy="132" rx="7" ry="4" fill="#ff7fb0" />
      {/* dress */}
      <path d="M36 84h28l14 36q-28 8-56 0z" fill="#ffb3cf" stroke="#f07aa6" strokeWidth="2" strokeLinejoin="round" />
      <path d="M24 116q26 7 52 0" stroke="#fff" strokeWidth="2.5" fill="none" strokeDasharray="1 5" strokeLinecap="round" />
      <path d="M40 84q10 8 20 0" fill="#fff" opacity=".6" />
      {/* bow */}
      <path d="M50 92l-7-4v8zM50 92l7-4v8z" fill="#ff6f9f" />
      <circle cx="50" cy="92" r="2.2" fill="#e04f86" />
      {/* arms */}
      <path d="M36 88q-8 8-8 20" stroke={SKIN_HER} strokeWidth="7" strokeLinecap="round" fill="none" />
      {wave ? (
        <g className="chibi-wave">
          <path d="M64 88q10-6 14-20" stroke={SKIN_HER} strokeWidth="7" strokeLinecap="round" fill="none" />
        </g>
      ) : (
        <path d="M64 88q8 8 8 20" stroke={SKIN_HER} strokeWidth="7" strokeLinecap="round" fill="none" />
      )}
      {/* head */}
      <ellipse cx="50" cy="56" rx="30" ry="28" fill={SKIN_HER} />
      {/* fringe */}
      <path d="M19 58q-2-34 31-34t31 34q-6-14-16-18-4 8-15 9 5-4 5-9-10 10-26 12 3-3 4-7-8 4-14 13z" fill={HAIR_HER} />
      {/* hair clip */}
      <g transform="translate(70 34) rotate(20)">
        <path d="M0 6c-4-3-6-5-6-7.5a3 3 0 0 1 6-1 3 3 0 0 1 6 1C6 1 4 3 0 6z" fill="#ff7fb0" stroke="#e04f86" strokeWidth="1" />
      </g>
      <Face skin={SKIN_HER} mouth={mouth} wink={wink} />
      {/* lashes */}
      <path d="M33 53l-3-2M67 53l3-2" stroke="#2a1a22" strokeWidth="1.8" strokeLinecap="round" />
      {/* round glasses, like cutu */}
      <g fill="rgba(255,255,255,.18)" stroke="#6b4a3a" strokeWidth="2">
        <circle cx="38" cy="58" r="9.5" />
        <circle cx="62" cy="58" r="9.5" />
      </g>
      <path d="M47.5 57q2.5-2 5 0M28.5 56l-7-3M71.5 56l7-3" stroke="#6b4a3a" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/** Both of them holding hands, for celebratory screens. */
export function CoupleChibi({ size = 160, className, style }) {
  return (
    <div className={className} style={{ display: 'flex', alignItems: 'flex-end', ...style }}>
      <HimChibi size={size / 2} />
      <div style={{ marginLeft: -size * 0.08 }}>
        <HerChibi size={size / 2} wink mouth="smile" />
      </div>
    </div>
  );
}
