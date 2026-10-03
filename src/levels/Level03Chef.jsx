/**
 * Level 3 — "Desi Kitchen"
 * Drag the right ingredients into the biryani handi and the lassi blender.
 * Wrong ingredient (or wrong vessel) → vessel shakes, -5s.
 * Both dishes done before the timer → onWin(). Timer out → onFail('time').
 *
 * Input: pointer drag (mouse + touch) OR tap an ingredient then tap a vessel
 * (also works with keyboard: Tab to an ingredient, Enter, Tab to a vessel, Enter).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useMotionValue, animate, useAnimationControls } from 'framer-motion';
import { Stage, GameHud, HudPill, TimerBar } from './kit.jsx';
import { useTimer } from '../hooks/useGameLoop';
import { sound } from '../audio/soundManager';
import './Level03Chef.css';

// ───────── tunables ─────────
const TIME_LIMIT = 120; // seconds
const PENALTY = 5; // seconds lost per wrong drop
const DRAG_THRESHOLD = 7; // px before a press becomes a drag (otherwise it's a tap-select)
const COOK_MS = 1700; // lid/steam or blender whirr before the dish is revealed
const WIN_DELAY_MS = 1100; // admire both dishes before onWin()
const DROP_SLOP = 24; // px of forgiveness around vessel hitboxes

// ───────── cute face for ingredients ─────────
function Kawaii({ x = 32, y = 36, s = 1, blush = true }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <circle cx="-5" cy="0" r="1.6" fill="#3a2230" />
      <circle cx="5" cy="0" r="1.6" fill="#3a2230" />
      <circle cx="-4.5" cy="-0.6" r=".5" fill="#fff" />
      <circle cx="5.5" cy="-0.6" r=".5" fill="#fff" />
      <path d="M-2 2.4q2 2 4 0" stroke="#3a2230" strokeWidth="1.1" fill="none" strokeLinecap="round" />
      {blush && (
        <>
          <ellipse cx="-8.5" cy="3" rx="2.4" ry="1.3" fill="#ff7fa8" opacity=".5" />
          <ellipse cx="8.5" cy="3" rx="2.4" ry="1.3" fill="#ff7fa8" opacity=".5" />
        </>
      )}
    </g>
  );
}

// ───────── ingredient art (64×64) ─────────
const Rice = () => (
  <g>
    <path d="M8 34h48q-2 22-24 22T8 34z" fill="#8ec5ff" stroke="#4f8fd6" strokeWidth="1.6" />
    <path d="M12 42q20 6 40 0" stroke="#fff" strokeWidth="1.6" strokeDasharray="2 3" fill="none" />
    <path d="M10 35q4-20 22-21t22 21z" fill="#fffaf0" stroke="#e5d8b8" strokeWidth="1.4" />
    {[[20, 26, 30], [27, 21, -20], [35, 20, 15], [42, 25, -35], [24, 31, 60], [38, 29, 10], [31, 27, -60], [46, 31, 40]].map(([x, y, r], i) => (
      <ellipse key={i} cx={x} cy={y} rx="2.6" ry="1" fill="#efe3c4" transform={`rotate(${r} ${x} ${y})`} />
    ))}
    <Kawaii y={45} s={0.9} />
  </g>
);
const Chicken = () => (
  <g transform="rotate(-25 32 32)">
    <rect x="29" y="38" width="6" height="16" rx="3" fill="#fff6e8" stroke="#d9c6a8" strokeWidth="1.2" />
    <circle cx="28.5" cy="55" r="3.6" fill="#fff6e8" stroke="#d9c6a8" strokeWidth="1.2" />
    <circle cx="35.5" cy="55" r="3.6" fill="#fff6e8" stroke="#d9c6a8" strokeWidth="1.2" />
    <path d="M32 6c13 0 18 12 16 22-2 9-8 13-16 13s-14-4-16-13C14 18 19 6 32 6z" fill="#d9772e" stroke="#9c4a17" strokeWidth="1.6" />
    <path d="M22 16q4-6 10-6" stroke="#ffc07a" strokeWidth="2.4" fill="none" strokeLinecap="round" />
    <circle cx="40" cy="14" r="1.6" fill="#8a3a12" opacity=".6" />
    <circle cx="24" cy="30" r="1.3" fill="#8a3a12" opacity=".6" />
    <Kawaii y={24} s={0.9} />
  </g>
);
const Onion = () => (
  <g>
    <path d="M32 10c10 6 18 14 18 26 0 12-8 18-18 18S14 48 14 36c0-12 8-20 18-26z" fill="#b65c9c" stroke="#7d3368" strokeWidth="1.6" />
    <path d="M32 10c-4 10-5 30 0 44M32 10c4 10 5 30 0 44" stroke="#e8a7d4" strokeWidth="1.2" fill="none" />
    <path d="M32 10q-2-5 1-7" stroke="#7aa35a" strokeWidth="2" fill="none" strokeLinecap="round" />
    <ellipse cx="22" cy="54" rx="13" ry="4" fill="#fff" stroke="#e5d8b8" strokeWidth="1.2" />
    {[[16, 51], [22, 49], [28, 51], [20, 53]].map(([x, y], i) => (
      <path key={i} d={`M${x} ${y}q3-4 6 0t6 0`} stroke="#b7671f" strokeWidth="2" fill="none" strokeLinecap="round" />
    ))}
    <Kawaii y={35} s={0.85} />
  </g>
);
const Yogurt = () => (
  <g>
    <path d="M12 30q0 26 20 26t20-26z" fill="#d97a4a" stroke="#9e4b25" strokeWidth="1.6" />
    <path d="M14 38q18 5 36 0" stroke="#f2b07f" strokeWidth="2" fill="none" />
    <ellipse cx="32" cy="30" rx="21" ry="6" fill="#b5592c" />
    <path d="M13 30q2-10 10-8 4-6 10-2 7-4 11 2 8 0 8 8z" fill="#fffdf6" stroke="#e6ddcc" strokeWidth="1.2" />
    <path d="M44 16l8-12" stroke="#c7cfd8" strokeWidth="3" strokeLinecap="round" />
    <Kawaii y={44} s={0.9} />
  </g>
);
const Saffron = () => (
  <g>
    <rect x="18" y="10" width="28" height="8" rx="3" fill="#f2c46b" stroke="#b9862c" strokeWidth="1.4" />
    <path d="M17 18h30v30q0 8-8 8H25q-8 0-8-8z" fill="#fff" fillOpacity=".55" stroke="#9fb8d0" strokeWidth="1.6" />
    {[[24, 44, -20], [30, 46, 15], [36, 43, -40], [40, 48, 30], [27, 49, 60], [34, 50, -10], [22, 50, 20]].map(([x, y, r], i) => (
      <path key={i} d={`M${x} ${y}l0 -7`} stroke="#d9381e" strokeWidth="1.8" strokeLinecap="round" transform={`rotate(${r} ${x} ${y})`} />
    ))}
    <rect x="21" y="24" width="22" height="9" rx="2" fill="#ffd36e" />
    <text x="32" y="31" fontSize="6" textAnchor="middle" fill="#9c4a17" fontWeight="700">KESAR</text>
    <path d="M21 22v14" stroke="#fff" strokeWidth="2" opacity=".7" strokeLinecap="round" />
  </g>
);
const Masala = () => (
  <g>
    <ellipse cx="32" cy="38" rx="26" ry="18" fill="#c9d3dd" stroke="#8a9aab" strokeWidth="1.6" />
    <ellipse cx="32" cy="35" rx="24" ry="15" fill="#e8eef3" />
    {[
      [32, 35, '#c0392b'],
      [19, 33, '#f2b705'],
      [45, 33, '#8a4b20'],
      [25, 43, '#e67e22'],
      [39, 43, '#6b8e23'],
      [25, 26, '#a0522d'],
      [39, 26, '#d35400'],
    ].map(([x, y, c], i) => (
      <g key={i}>
        <ellipse cx={x} cy={y} rx="5.2" ry="3.6" fill="#b8c4cf" />
        <ellipse cx={x} cy={y - 0.5} rx="4.4" ry="2.8" fill={c} />
      </g>
    ))}
    <path d="M12 30q4-8 14-10" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" opacity=".8" />
  </g>
);
const Mint = () => (
  <g>
    <path d="M32 58V20" stroke="#4f8a3a" strokeWidth="2.4" strokeLinecap="round" />
    {[
      [32, 18, 0, 1],
      [24, 30, -50, 0.9],
      [40, 30, 50, 0.9],
      [23, 44, -60, 1],
      [41, 44, 60, 1],
    ].map(([x, y, r, s], i) => (
      <g key={i} transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
        <path d="M0 -12C8 -8 9 4 0 10C-9 4 -8 -8 0 -12z" fill="#6cc46a" stroke="#3f8f3c" strokeWidth="1.3" />
        <path d="M0 -10V8M0 -3l-4 -3M0 2l4 -3" stroke="#3f8f3c" strokeWidth=".9" fill="none" />
      </g>
    ))}
    <Kawaii y={22} s={0.6} blush={false} />
  </g>
);
const Ghee = () => (
  <g>
    <path d="M16 18h32v32q0 8-8 8H24q-8 0-8-8z" fill="#ffd36e" stroke="#c9952e" strokeWidth="1.6" />
    <path d="M16 26h32" stroke="#ffe7a6" strokeWidth="2" />
    <path d="M13 12h38l-4 8H17z" fill="#ff9cc2" stroke="#e0679a" strokeWidth="1.4" />
    <path d="M14 18q18 4 36 0" stroke="#c46b2f" strokeWidth="1.6" fill="none" />
    <rect x="21" y="30" width="22" height="10" rx="3" fill="#fff" />
    <text x="32" y="38" fontSize="7" textAnchor="middle" fill="#c9952e" fontWeight="700">GHEE</text>
    <path d="M20 44v8" stroke="#fff" strokeWidth="2" opacity=".6" strokeLinecap="round" />
    <Kawaii y={48} s={0.75} />
  </g>
);
const Mango = () => (
  <g>
    <defs>
      <radialGradient id="l03-mango" cx="35%" cy="35%" r="75%">
        <stop offset="0" stopColor="#ffe36e" />
        <stop offset=".6" stopColor="#ffb02e" />
        <stop offset="1" stopColor="#f07b2a" />
      </radialGradient>
    </defs>
    <path d="M30 12c14-2 26 10 24 26-2 14-14 20-26 18C14 54 8 42 12 30c3-10 10-17 18-18z" fill="url(#l03-mango)" stroke="#d0661c" strokeWidth="1.5" />
    <path d="M32 12q2-6 6-7" stroke="#7a5230" strokeWidth="2" fill="none" strokeLinecap="round" />
    <path d="M37 6c8-4 14 0 16 4-6 3-12 2-16-4z" fill="#6cc46a" stroke="#3f8f3c" strokeWidth="1.2" />
    <ellipse cx="22" cy="24" rx="4" ry="2.4" fill="#fff" opacity=".6" transform="rotate(-35 22 24)" />
    <Kawaii y={36} s={0.95} />
  </g>
);
const Sugar = () => (
  <g>
    <path d="M10 32h44q-2 22-22 22T10 32z" fill="#ffc8dd" stroke="#f07aa6" strokeWidth="1.6" />
    <path d="M14 40l4 3 4-3 4 3 4-3 4 3 4-3 4 3 4-3 4 3" stroke="#fff" strokeWidth="1.3" fill="none" />
    {[[18, 22], [28, 18], [38, 21], [23, 27], [34, 27], [43, 27]].map(([x, y], i) => (
      <g key={i}>
        <rect x={x - 4} y={y - 4} width="8" height="8" rx="1.6" fill="#fff" stroke="#d9dde6" strokeWidth="1" transform={`rotate(${i * 13} ${x} ${y})`} />
      </g>
    ))}
    <Kawaii y={44} s={0.85} />
  </g>
);
const Cardamom = () => (
  <g>
    {[
      [22, 34, -30],
      [40, 30, 25],
      [32, 46, 80],
    ].map(([x, y, r], i) => (
      <g key={i} transform={`translate(${x} ${y}) rotate(${r})`}>
        <ellipse rx="8" ry="13" fill="#9cc96b" stroke="#5f8f3a" strokeWidth="1.4" />
        <path d="M0 -12V12M-4 -10Q-6 0 -4 10M4 -10Q6 0 4 10" stroke="#6f9f45" strokeWidth=".9" fill="none" />
        <path d="M0 -13l0 -3" stroke="#5f8f3a" strokeWidth="1.6" strokeLinecap="round" />
      </g>
    ))}
    <Kawaii x={40} y={31} s={0.55} blush={false} />
  </g>
);
const Ice = () => (
  <g>
    {[
      [24, 38, -12],
      [40, 30, 14],
    ].map(([x, y, r], i) => (
      <g key={i} transform={`translate(${x} ${y}) rotate(${r})`}>
        <rect x="-12" y="-12" width="24" height="24" rx="5" fill="#d6f0ff" fillOpacity=".9" stroke="#7fbbe6" strokeWidth="1.5" />
        <path d="M-8 -7q2-3 6-3" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        <path d="M4 8l5-5" stroke="#a9d6f5" strokeWidth="1.5" strokeLinecap="round" />
      </g>
    ))}
    <Kawaii x={24} y={40} s={0.7} />
  </g>
);
const Pineapple = () => (
  <g>
    <path d="M32 22l-8-14 6 6 2-10 2 10 6-6z" fill="#6cc46a" stroke="#3f8f3c" strokeWidth="1.2" strokeLinejoin="round" />
    <ellipse cx="32" cy="40" rx="15" ry="18" fill="#ffc94a" stroke="#d09019" strokeWidth="1.6" />
    <path d="M20 30l24 24M18 40l18 18M24 24l22 22M44 30L20 54M46 40L28 58M40 24L18 46" stroke="#d09019" strokeWidth="1" opacity=".8" />
    <Kawaii y={40} s={0.85} />
  </g>
);
const Ketchup = () => (
  <g>
    <path d="M28 4h8l2 8h-12z" fill="#fff" stroke="#c9cdd3" strokeWidth="1.2" />
    <path d="M22 12h20q4 4 4 12v26q0 8-8 8H26q-8 0-8-8V24q0-8 4-12z" fill="#e8413b" stroke="#a8221d" strokeWidth="1.6" />
    <rect x="20" y="28" width="24" height="14" rx="3" fill="#fff" />
    <circle cx="27" cy="35" r="3.5" fill="#e8413b" />
    <path d="M27 31.5q1-2 2-2" stroke="#4f8a3a" strokeWidth="1.2" />
    <path d="M33 33h8M33 37h6" stroke="#e8413b" strokeWidth="1.4" strokeLinecap="round" />
    <path d="M23 16v8" stroke="#fff" strokeWidth="2" opacity=".6" strokeLinecap="round" />
    <Kawaii y={50} s={0.7} />
  </g>
);
const Chocolate = () => (
  <g transform="rotate(-10 32 32)">
    <rect x="14" y="8" width="36" height="48" rx="4" fill="#7a4428" stroke="#4e2614" strokeWidth="1.6" />
    {[0, 1, 2].map((r) => [0, 1].map((c) => <rect key={`${r}${c}`} x={18 + c * 15} y={12 + r * 9} width="13" height="7.5" rx="1.5" fill="#8f5534" stroke="#5e301a" strokeWidth=".8" />))}
    <path d="M12 38h40v18q0 4-4 4H16q-4 0-4-4z" fill="#ff9cc2" stroke="#e0679a" strokeWidth="1.4" />
    <path d="M12 38l6 4 6-4 6 4 6-4 6 4 6-4 6 4" fill="#d9dde6" stroke="#b8bfca" strokeWidth=".8" />
    <Kawaii y={50} s={0.8} />
  </g>
);
const Broccoli = () => (
  <g>
    <path d="M27 36h10l3 22h-16z" fill="#a8d672" stroke="#5f8f3a" strokeWidth="1.4" />
    {[[20, 28, 10], [32, 20, 12], [44, 28, 10], [26, 36, 9], [38, 36, 9]].map(([x, y, r], i) => (
      <circle key={i} cx={x} cy={y} r={r} fill="#4caf50" stroke="#2e7d32" strokeWidth="1.4" />
    ))}
    {[[18, 24], [30, 16], [42, 24], [35, 22], [24, 30]].map(([x, y], i) => (
      <circle key={i} cx={x} cy={y} r="2" fill="#7fd07f" />
    ))}
    <Kawaii y={30} s={0.8} />
  </g>
);
const Pasta = () => (
  <g>
    {[
      [22, 24, -20],
      [42, 30, 25],
      [28, 46, 10],
    ].map(([x, y, r], i) => (
      <g key={i} transform={`translate(${x} ${y}) rotate(${r})`}>
        <path d="M-13 -8q6 3 13 6 7-3 13-6l-2 8 2 8q-6-3-13-6-7 3-13 6l2-8z" fill="#ffd77a" stroke="#d09a2e" strokeWidth="1.3" strokeLinejoin="round" />
        <path d="M-9 -4l1 8M9 -4l-1 8" stroke="#e0b04a" strokeWidth="1" />
        <ellipse rx="3" ry="4" fill="#f3c25a" stroke="#d09a2e" strokeWidth="1" />
      </g>
    ))}
    <Kawaii x={28} y={50} s={0.55} blush={false} />
  </g>
);
const Cheese = () => (
  <g>
    <path d="M8 40L50 18l8 12v20q0 4-4 4H12q-4 0-4-4z" fill="#ffd84d" stroke="#d6a619" strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M8 40h50" stroke="#d6a619" strokeWidth="1.4" />
    <path d="M8 40L50 18l8 12z" fill="#ffe680" stroke="#d6a619" strokeWidth="1.4" strokeLinejoin="round" />
    <circle cx="44" cy="47" r="3" fill="#e8b92a" />
    <circle cx="16" cy="48" r="2.4" fill="#e8b92a" />
    <circle cx="40" cy="28" r="2" fill="#f2c94a" />
    <Kawaii x={30} y={47} s={0.8} />
  </g>
);

const INGREDIENTS = {
  rice: { name: 'Basmati rice', ticket: 'basmati rice', Art: Rice, bit: '#fff6dc' },
  chicken: { name: 'Chicken', ticket: 'chicken', Art: Chicken, bit: '#c8692a' },
  onion: { name: 'Fried onions', ticket: 'fried onions', Art: Onion, bit: '#a8601f' },
  yogurt: { name: 'Dahi', ticket: 'dahi (yogurt)', Art: Yogurt, bit: '#ffffff' },
  saffron: { name: 'Saffron', ticket: 'kesar (saffron)', Art: Saffron, bit: '#ff8a1f' },
  masala: { name: 'Biryani masala', ticket: 'biryani masala', Art: Masala, bit: '#b5432a' },
  mint: { name: 'Mint', ticket: 'mint leaves', Art: Mint, bit: '#5cb85c' },
  ghee: { name: 'Ghee', ticket: 'ghee', Art: Ghee, bit: '#ffd36e' },
  mango: { name: 'Mango', ticket: 'mango', Art: Mango, bit: '#ffa726' },
  sugar: { name: 'Sugar', ticket: 'sugar', Art: Sugar, bit: '#ffffff' },
  cardamom: { name: 'Elaichi', ticket: 'elaichi (cardamom)', Art: Cardamom, bit: '#8bc34a' },
  ice: { name: 'Ice', ticket: 'ice', Art: Ice, bit: '#d6f0ff' },
  pineapple: { name: 'Pineapple', Art: Pineapple },
  ketchup: { name: 'Ketchup', Art: Ketchup },
  chocolate: { name: 'Chocolate', Art: Chocolate },
  broccoli: { name: 'Broccoli', Art: Broccoli },
  pasta: { name: 'Pasta', Art: Pasta },
  cheese: { name: 'Cheese', Art: Cheese },
};

const RECIPES = {
  biryani: { title: 'Chicken Biryani', vessel: 'Biryani handi', items: ['rice', 'chicken', 'onion', 'yogurt', 'saffron', 'masala', 'mint', 'ghee'] },
  lassi: { title: 'Mango Lassi', vessel: 'Lassi blender', items: ['mango', 'yogurt', 'sugar', 'cardamom', 'ice'] },
};
const VESSELS = ['biryani', 'lassi'];

function IngredientIcon({ id }) {
  const { Art } = INGREDIENTS[id];
  return (
    <svg viewBox="0 0 64 64" className="l03-ing-svg" aria-hidden>
      <Art />
    </svg>
  );
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ───────── vessels ─────────
// little ingredient "bits" visible inside the vessel as you add things
const POT_BITS = [
  [96, 59],
  [124, 61],
  [110, 56],
  [84, 62],
  [136, 58],
  [104, 63],
  [120, 55],
  [92, 56],
];

function Handi({ added, cooking }) {
  const n = added.length;
  return (
    <svg viewBox="0 0 220 200" className="l03-vessel-svg" aria-hidden>
      <defs>
        <linearGradient id="l03-copper" x1="0" x2="1">
          <stop offset="0" stopColor="#8c3f1d" />
          <stop offset=".25" stopColor="#e7975f" />
          <stop offset=".45" stopColor="#f5b98a" />
          <stop offset=".75" stopColor="#c0672f" />
          <stop offset="1" stopColor="#7a3417" />
        </linearGradient>
        <linearGradient id="l03-brass" x1="0" x2="1">
          <stop offset="0" stopColor="#b9862c" />
          <stop offset=".4" stopColor="#ffe08a" />
          <stop offset="1" stopColor="#a8741f" />
        </linearGradient>
      </defs>
      {/* stove + flames */}
      <ellipse cx="110" cy="188" rx="70" ry="8" fill="#000" opacity=".12" />
      <g className={`l03-flames ${cooking ? 'l03-flames-hot' : ''}`}>
        {[70, 90, 110, 130, 150].map((x, i) => (
          <path key={x} d={`M${x} 178q-7-8 0-20q7 12 0 20z`} fill={i % 2 ? '#ffb347' : '#6eaaf0'} opacity=".9" style={{ animationDelay: `${i * 0.12}s` }} />
        ))}
      </g>
      <rect x="44" y="176" width="132" height="10" rx="5" fill="#4a4a5a" />
      <rect x="54" y="172" width="8" height="8" rx="2" fill="#5d5d70" />
      <rect x="158" y="172" width="8" height="8" rx="2" fill="#5d5d70" />
      {/* handles */}
      <circle cx="44" cy="92" r="11" fill="none" stroke="url(#l03-brass)" strokeWidth="5" />
      <circle cx="176" cy="92" r="11" fill="none" stroke="url(#l03-brass)" strokeWidth="5" />
      {/* body */}
      <path d="M60 66C30 82 26 132 60 156c28 18 72 18 100 0 34-24 30-74 0-90z" fill="url(#l03-copper)" stroke="#6b2c12" strokeWidth="2" />
      <path d="M36 112q74 26 148 0" stroke="#ffd9a8" strokeWidth="3" fill="none" opacity=".7" />
      <path d="M38 120q72 26 144 0" stroke="#ffd9a8" strokeWidth="1.5" fill="none" strokeDasharray="1 6" strokeLinecap="round" opacity=".9" />
      {[60, 80, 100, 120, 140, 160].map((x, i) => (
        <path key={x} d={`M${x} ${126 + (i === 0 || i === 5 ? -4 : 2)}l5 7 5-7`} stroke="#ffd9a8" strokeWidth="1.4" fill="none" opacity=".8" />
      ))}
      <ellipse cx="62" cy="104" rx="7" ry="20" fill="#fff" opacity=".28" transform="rotate(18 62 104)" />
      {/* rim + opening */}
      <ellipse cx="110" cy="62" rx="58" ry="13" fill="url(#l03-brass)" stroke="#8a5a14" strokeWidth="1.6" />
      <ellipse cx="110" cy="61" rx="49" ry="9" fill="#4a200c" />
      {n > 0 && <ellipse cx="110" cy="61.5" rx={30 + Math.min(n, 8) * 2.4} ry={5 + Math.min(n, 8) * 0.45} fill="#fbecc5" />}
      {added.map((id, i) => (
        <motion.circle
          key={id}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          cx={POT_BITS[i % POT_BITS.length][0]}
          cy={POT_BITS[i % POT_BITS.length][1]}
          r="3.4"
          fill={INGREDIENTS[id].bit}
          stroke="#00000022"
        />
      ))}
      {/* lid + dum seal */}
      <AnimatePresence>
        {cooking && (
          <motion.g initial={{ y: -90, opacity: 0, rotate: -8 }} animate={{ y: 0, opacity: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 14 }} style={{ originX: '110px', originY: '60px' }}>
            <path d="M52 62q58-50 116 0z" fill="url(#l03-brass)" stroke="#8a5a14" strokeWidth="1.6" />
            <path d="M52 62q58 10 116 0" stroke="#f3dcb0" strokeWidth="5" fill="none" strokeLinecap="round" />
            <circle cx="110" cy="30" r="7" fill="url(#l03-brass)" stroke="#8a5a14" strokeWidth="1.4" />
            <path d="M72 50q16-18 36-20" stroke="#fff" strokeWidth="3" fill="none" opacity=".5" strokeLinecap="round" />
          </motion.g>
        )}
      </AnimatePresence>
      {cooking && (
        <g className="l03-steam">
          {[88, 110, 132].map((x, i) => (
            <path key={x} d={`M${x} 26q-10-10 0-20t0-22`} stroke="#fff" strokeWidth="4" fill="none" strokeLinecap="round" style={{ animationDelay: `${i * 0.25}s` }} />
          ))}
        </g>
      )}
    </svg>
  );
}

// deterministic rice grains for the plated biryani
const GRAINS = Array.from({ length: 46 }, (_, i) => {
  const a = (i * 137.5 * Math.PI) / 180;
  const r = Math.sqrt(i / 46);
  return [110 + Math.cos(a) * r * 68, 108 + Math.sin(a) * r * 26 - (1 - r) * 22, (i * 47) % 180, i % 5 === 0 ? '#ffb347' : i % 7 === 0 ? '#ffd36e' : '#fffaf0'];
});

function PlatedBiryani() {
  return (
    <svg viewBox="0 0 220 200" className="l03-vessel-svg" aria-hidden>
      <ellipse cx="110" cy="176" rx="96" ry="12" fill="#000" opacity=".12" />
      <ellipse cx="110" cy="140" rx="104" ry="42" fill="#e6f0fa" stroke="#7fa7d4" strokeWidth="2" />
      <ellipse cx="110" cy="138" rx="90" ry="34" fill="#fff" />
      {Array.from({ length: 18 }, (_, i) => {
        const a = (i / 18) * Math.PI * 2;
        return <circle key={i} cx={110 + Math.cos(a) * 97} cy={139 + Math.sin(a) * 38} r="2.4" fill="#7fa7d4" />;
      })}
      {/* rice mound */}
      <path d="M34 132q16-66 76-70 60 4 76 70-76 22-152 0z" fill="#fbf1d6" stroke="#e8d6a8" strokeWidth="1.5" />
      <path d="M60 104q20-26 40-14 10 18-14 26-18 4-26-12z" fill="#ffc764" opacity=".75" />
      <path d="M128 92q22-6 30 16-10 14-26 4z" fill="#ffa53a" opacity=".55" />
      {GRAINS.map(([x, y, r, c], i) => (
        <ellipse key={i} cx={x} cy={y} rx="3.4" ry="1.3" fill={c} transform={`rotate(${r} ${x} ${y})`} />
      ))}
      {/* fried onions */}
      {[[74, 92], [96, 76], [140, 84], [150, 112], [70, 120]].map(([x, y], i) => (
        <path key={i} d={`M${x} ${y}q4-5 8 0t8 0`} stroke="#a8601f" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      ))}
      {/* chicken leg */}
      <g transform="translate(118 74) rotate(30)">
        <rect x="-3" y="12" width="6" height="18" rx="3" fill="#fff6e8" stroke="#d9c6a8" />
        <circle cx="-3" cy="31" r="3.6" fill="#fff6e8" stroke="#d9c6a8" />
        <circle cx="3" cy="31" r="3.6" fill="#fff6e8" stroke="#d9c6a8" />
        <path d="M0 -18c12 0 16 12 14 20-2 8-7 12-14 12s-12-4-14-12c-2-8 2-20 14-20z" fill="#c9611f" stroke="#86370f" strokeWidth="1.5" />
        <path d="M-8 -8q4-6 9-6" stroke="#ffb066" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        <circle cx="5" cy="0" r="1.6" fill="#6b2a0a" opacity=".6" />
      </g>
      {/* boiled egg */}
      <g transform="translate(78 100)">
        <ellipse rx="13" ry="9" fill="#fff" stroke="#e6ddcc" />
        <circle r="5.4" fill="#ffc533" />
      </g>
      {/* mint */}
      {[[98, 66, -30], [104, 64, 20], [150, 98, 40]].map(([x, y, r], i) => (
        <path key={i} d="M0 -7C5 -4 5 3 0 6C-5 3 -5 -4 0 -7z" fill="#5cb85c" stroke="#2e7d32" strokeWidth=".8" transform={`translate(${x} ${y}) rotate(${r})`} />
      ))}
      {/* lemon wedge */}
      <g transform="translate(176 136) rotate(-20)">
        <path d="M-14 0a14 14 0 0 0 28 0z" fill="#fff59d" stroke="#e0c341" strokeWidth="1.5" />
        <path d="M0 0l-9 9M0 0v12M0 0l9 9" stroke="#f4e27a" strokeWidth="1.2" />
      </g>
      {/* raita katori */}
      <g transform="translate(36 150)">
        <ellipse rx="20" ry="8" fill="#c9d3dd" stroke="#8a9aab" />
        <ellipse cy="-2" rx="16" ry="5" fill="#fffdf6" />
        <circle cx="-5" cy="-2" r="1.2" fill="#5cb85c" />
        <circle cx="4" cy="-3" r="1.2" fill="#5cb85c" />
        <circle cx="0" cy="-1" r="1" fill="#e57373" />
      </g>
      {/* sparkles */}
      {[[40, 60], [182, 64], [160, 36]].map(([x, y], i) => (
        <path key={i} className="l03-sparkle" style={{ animationDelay: `${i * 0.3}s` }} d={`M${x} ${y - 8}l2 6 6 2-6 2-2 6-2-6-6-2 6-2z`} fill="#ffd36e" />
      ))}
    </svg>
  );
}

const BLENDER_BITS = [
  [70, 150],
  [92, 146],
  [80, 132],
  [62, 136],
  [98, 160],
];

function Blender({ added, blending }) {
  const level = added.length / RECIPES.lassi.items.length;
  const top = 166 - level * 112;
  return (
    <svg viewBox="0 0 160 220" className={`l03-vessel-svg ${blending ? 'l03-blending' : ''}`} aria-hidden>
      <defs>
        <clipPath id="l03-jar">
          <path d="M40 34h80l-10 134H50z" />
        </clipPath>
        <linearGradient id="l03-lassi" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe9a8" />
          <stop offset="1" stopColor="#ffb347" />
        </linearGradient>
      </defs>
      <ellipse cx="80" cy="212" rx="52" ry="6" fill="#000" opacity=".12" />
      {/* base */}
      <path d="M40 172h80l8 36H32z" fill="#ff9cc2" stroke="#e0679a" strokeWidth="2" strokeLinejoin="round" />
      <rect x="46" y="166" width="68" height="10" rx="4" fill="#ffb3cf" stroke="#e0679a" strokeWidth="1.5" />
      <circle cx="80" cy="192" r="8" fill="#fff" stroke="#e0679a" strokeWidth="1.5" />
      <path d="M80 192l4-5" stroke="#e0679a" strokeWidth="2" strokeLinecap="round" />
      <circle cx="56" cy="194" r="3" fill={blending ? '#7fd07f' : '#fff'} />
      <circle cx="104" cy="194" r="3" fill="#fff" />
      {/* liquid */}
      <g clipPath="url(#l03-jar)">
        <motion.rect x="30" width="100" fill="url(#l03-lassi)" initial={false} animate={{ y: added.length ? top : 170, height: 200 }} transition={{ type: 'spring', stiffness: 120, damping: 16 }} />
        {added.length > 0 && <motion.path initial={false} animate={{ d: `M30 ${top}q12 -5 25 0t25 0t25 0t25 0v6H30z` }} fill="#fff3cf" opacity=".8" />}
        {added.map((id, i) => (
          <motion.rect
            key={id}
            initial={{ y: -120, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 140, damping: 12 }}
            x={BLENDER_BITS[i][0]}
            y={BLENDER_BITS[i][1]}
            width="9"
            height="9"
            rx="2.5"
            fill={INGREDIENTS[id].bit}
            stroke="#00000022"
            className={blending ? 'l03-swirl' : ''}
          />
        ))}
        {/* blades */}
        <g className={blending ? 'l03-blades-spin' : ''} style={{ transformOrigin: '80px 160px' }}>
          <path d="M66 158l14 2 14-2M74 164l6-4 6 4" stroke="#8a9aab" strokeWidth="2.4" strokeLinecap="round" fill="none" />
        </g>
      </g>
      {/* jar glass */}
      <path d="M40 34h80l-10 134H50z" fill="#eaf6ff" fillOpacity=".35" stroke="#8fb3d4" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M48 44l6 112" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity=".7" />
      {[60, 84, 108, 132].map((y) => (
        <path key={y} d={`M${112 - (y - 34) * 0.07} ${y}h-8`} stroke="#8fb3d4" strokeWidth="1.5" strokeLinecap="round" />
      ))}
      {/* handle */}
      <path d="M118 52q22 4 18 40t-26 46" stroke="#8fb3d4" strokeWidth="7" fill="none" strokeLinecap="round" />
      {/* lid */}
      <rect x="36" y="22" width="88" height="14" rx="6" fill="#ff85b1" stroke="#e0679a" strokeWidth="1.8" />
      <rect x="70" y="12" width="20" height="12" rx="4" fill="#ffb3cf" stroke="#e0679a" strokeWidth="1.5" />
      {blending &&
        [0, 1, 2].map((i) => (
          <path key={i} className="l03-whirr" style={{ animationDelay: `${i * 0.15}s`, stroke: 'var(--ink-soft)' }} d={`M${i % 2 ? 140 : 14} ${70 + i * 30}q${i % 2 ? 8 : -8} 6 0 12`} strokeWidth="2.4" fill="none" strokeLinecap="round" />
        ))}
    </svg>
  );
}

function LassiGlass() {
  return (
    <svg viewBox="0 0 160 220" className="l03-vessel-svg" aria-hidden>
      <defs>
        <clipPath id="l03-glass">
          <path d="M46 50h68l-9 150H55z" />
        </clipPath>
        <linearGradient id="l03-lassi2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff1c2" />
          <stop offset="1" stopColor="#ffb347" />
        </linearGradient>
      </defs>
      <ellipse cx="80" cy="206" rx="44" ry="7" fill="#c9a2ff" opacity=".5" />
      {/* straw */}
      <g transform="rotate(14 96 40)">
        <rect x="92" y="6" width="8" height="120" rx="4" fill="#fff" stroke="#f07aa6" strokeWidth="1.2" />
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <path key={i} d={`M92 ${12 + i * 14}l8 -6`} stroke="#ff7fb0" strokeWidth="4" />
        ))}
      </g>
      <g clipPath="url(#l03-glass)">
        <motion.g initial={{ y: 160 }} animate={{ y: 0 }} transition={{ duration: 0.9, ease: 'easeOut' }}>
          <rect x="40" y="62" width="80" height="150" fill="url(#l03-lassi2)" />
          <path d="M40 64q7-8 14 0t14 0 14 0 14 0 14 0 14 0v6H40z" fill="#fffaf0" />
          {[[64, 70], [80, 68], [94, 72], [72, 74]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="1.6" fill={i % 2 ? '#8bc34a' : '#ff8a1f'} />
          ))}
        </motion.g>
      </g>
      {/* glass */}
      <path d="M46 50h68l-9 150H55z" fill="#eaf6ff" fillOpacity=".25" stroke="#8fb3d4" strokeWidth="2.2" strokeLinejoin="round" />
      <ellipse cx="80" cy="50" rx="34" ry="5" fill="none" stroke="#8fb3d4" strokeWidth="2" />
      <path d="M53 60l6 130" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity=".7" />
      {[[100, 110], [104, 140], [96, 168]].map(([x, y], i) => (
        <ellipse key={i} cx={x} cy={y} rx="1.6" ry="2.4" fill="#fff" opacity=".8" />
      ))}
      {/* mango slice on rim */}
      <g transform="translate(46 50) rotate(-25)">
        <path d="M-18 0a18 14 0 0 0 36 0z" fill="#ffb02e" stroke="#d0661c" strokeWidth="1.5" />
        <path d="M-12 2h24" stroke="#ffe36e" strokeWidth="3" />
      </g>
      {/* little heart sticker */}
      <path d="M80 150c-6-4-9-7-9-10.5a4 4 0 0 1 9-1.5 4 4 0 0 1 9 1.5c0 3.5-3 6.5-9 10.5z" fill="#ff7fb0" opacity=".9" />
      {[[30, 60], [132, 84], [124, 40]].map(([x, y], i) => (
        <path key={i} className="l03-sparkle" style={{ animationDelay: `${i * 0.3}s` }} d={`M${x} ${y - 7}l1.8 5 5 2-5 2-1.8 5-1.8-5-5-2 5-2z`} fill="#ffd36e" />
      ))}
    </svg>
  );
}

// ───────── decorative kitchen bits ─────────
function Toran() {
  return (
    <svg className="l03-toran" aria-hidden>
      <defs>
        <pattern id="l03-toran-p" width="56" height="64" patternUnits="userSpaceOnUse">
          <path d="M0 6q28 14 56 0" stroke="#c0392b" strokeWidth="2" fill="none" />
          <path d="M28 12v26" stroke="#9c6a2a" strokeWidth="1.2" />
          {/* mango leaf */}
          <path d="M8 10q-4 14 4 26 6-12-4-26z" fill="#5fae4f" stroke="#3f8f3c" strokeWidth="1" />
          <path d="M48 10q-4 14 4 26 6-12-4-26z" fill="#5fae4f" stroke="#3f8f3c" strokeWidth="1" />
          {/* marigolds */}
          {[
            [28, 18, '#ffb020'],
            [28, 31, '#ff8a1f'],
            [28, 44, '#ffc93c'],
          ].map(([x, y, c], i) => (
            <g key={i}>
              <circle cx={x} cy={y} r="6.5" fill={c} />
              {[0, 60, 120, 180, 240, 300].map((a) => (
                <circle key={a} cx={x + Math.cos((a * Math.PI) / 180) * 4} cy={y + Math.sin((a * Math.PI) / 180) * 4} r="2.8" fill={c} stroke="#e07a10" strokeWidth=".6" />
              ))}
              <circle cx={x} cy={y} r="2" fill="#e05a10" />
            </g>
          ))}
          <path d="M26 50l2 8 2-8" fill="#ff7fb0" />
        </pattern>
      </defs>
      <rect width="100%" height="64" fill="url(#l03-toran-p)" />
    </svg>
  );
}

function CopperUtensils({ side }) {
  return (
    <svg viewBox="0 0 120 120" className={`l03-utensils l03-utensils-${side}`} aria-hidden>
      <rect x="4" y="8" width="112" height="5" rx="2.5" fill="#b9862c" />
      {/* ladle */}
      <path d="M22 12v58" stroke="#c0672f" strokeWidth="4" strokeLinecap="round" />
      <path d="M12 70a10 9 0 0 0 20 0z" fill="#d9773a" stroke="#8c3f1d" strokeWidth="1.5" />
      {/* small pan */}
      <path d="M58 12v26" stroke="#8c3f1d" strokeWidth="2" />
      <circle cx="58" cy="62" r="24" fill="#d9773a" stroke="#8c3f1d" strokeWidth="2" />
      <circle cx="58" cy="62" r="17" fill="#e7975f" />
      <path d="M46 52q6-8 16-8" stroke="#fff" strokeWidth="2.4" fill="none" opacity=".5" strokeLinecap="round" />
      <rect x="54" y="30" width="8" height="12" rx="3" fill="#8c3f1d" />
      {/* jharni / slotted spoon */}
      <path d="M98 12v46" stroke="#c0672f" strokeWidth="4" strokeLinecap="round" />
      <circle cx="98" cy="68" r="11" fill="#e7975f" stroke="#8c3f1d" strokeWidth="1.5" />
      {[[94, 64], [102, 64], [98, 70], [94, 74], [102, 74]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="1.4" fill="#8c3f1d" />
      ))}
    </svg>
  );
}

function Lamp() {
  return (
    <svg viewBox="0 0 80 90" className="l03-lamp" aria-hidden>
      <path d="M40 0v30" stroke="#6b4a2a" strokeWidth="2" />
      <path d="M18 54q22-30 44 0z" fill="#e7975f" stroke="#8c3f1d" strokeWidth="2" />
      {[24, 32, 40, 48, 56].map((x) => (
        <circle key={x} cx={x} cy="48" r="1.6" fill="#ffe08a" />
      ))}
      <ellipse cx="40" cy="56" rx="8" ry="5" fill="#fff3c4" />
    </svg>
  );
}

// tiled backsplash with a pastel rangoli-ish motif
const TILE_SVG = `<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64'>
<rect width='64' height='64' fill='#fff4e6'/>
<rect x='.5' y='.5' width='63' height='63' fill='none' stroke='#f3d9c2' stroke-width='1'/>
<g transform='translate(32 32)'>
${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<ellipse rx='3.6' ry='9' transform='rotate(${a}) translate(0 -10)' fill='${a % 90 ? '#bddcff' : '#ffc8dd'}'/>`).join('')}
<circle r='5' fill='#ffd36e'/><circle r='2' fill='#ff85b1'/>
</g>
${[[0, 0], [64, 0], [0, 64], [64, 64]].map(([x, y]) => `<circle cx='${x}' cy='${y}' r='7' fill='#c9f0dc'/><circle cx='${x}' cy='${y}' r='3' fill='#96c6fb'/>`).join('')}
</svg>`;
const TILE_URL = `url("data:image/svg+xml,${encodeURIComponent(TILE_SVG)}")`;

// ───────── the level ─────────
export default function Level03Chef({ onWin, onFail }) {
  const endedRef = useRef(false);
  const [over, setOver] = useState(false);
  const [shelf] = useState(() => shuffle(Object.keys(INGREDIENTS)));
  const [added, setAdded] = useState({ biryani: [], lassi: [] });
  const addedRef = useRef(added);
  addedRef.current = added;
  const [status, setStatus] = useState({ biryani: null, lassi: null }); // null | 'cooking' | 'done'
  const statusRef = useRef(status);
  statusRef.current = status;
  const [selected, setSelected] = useState(null);
  const [hover, setHover] = useState(null);
  const [drag, setDrag] = useState(null); // { id, size, token }
  const [fx, setFx] = useState([]);
  const [showGo, setShowGo] = useState(true);

  const stageRef = useRef(null);
  const vesselRefs = useRef({});
  const dragRef = useRef(null);
  const dragToken = useRef(0);
  const timeouts = useRef([]);
  const gx = useMotionValue(0);
  const gy = useMotionValue(0);
  const potCtl = useAnimationControls();
  const blendCtl = useAnimationControls();
  const controls = { biryani: potCtl, lassi: blendCtl };

  const later = (fn, ms) => {
    const id = setTimeout(fn, ms);
    timeouts.current.push(id);
    return id;
  };
  useEffect(() => () => timeouts.current.forEach(clearTimeout), []);
  useEffect(() => {
    later(() => setShowGo(false), 1100);
  }, []);

  const finish = (won) => {
    if (endedRef.current) return;
    endedRef.current = true;
    setOver(true);
    setSelected(null);
    if (won) onWin();
    else onFail('time');
  };

  const bothStarted = status.biryani && status.lassi;
  const [left, adjust] = useTimer(TIME_LIMIT, !over && !bothStarted, () => finish(false));

  // win once both dishes are revealed
  useEffect(() => {
    if (status.biryani === 'done' && status.lassi === 'done') later(() => finish(true), WIN_DELAY_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.biryani, status.lassi]);

  const addFx = (vessel, kind, text) => {
    const key = Math.random().toString(36).slice(2);
    setFx((f) => [...f, { key, vessel, kind, text }]);
    later(() => setFx((f) => f.filter((x) => x.key !== key)), 1000);
  };

  const completeVessel = (v) => {
    setStatus((s) => ({ ...s, [v]: 'cooking' }));
    if (v === 'biryani') {
      sound.sfx.whoosh();
      later(() => sound.sfx.whoosh(), 700);
    } else {
      [0, 400, 800, 1200].forEach((ms) => later(() => sound.sfx.whoosh(), ms));
    }
    later(() => {
      setStatus((s) => ({ ...s, [v]: 'done' }));
      sound.sfx.sparkle();
    }, COOK_MS);
  };

  /** returns 'ok' | 'wrong' | 'dup' | 'none' */
  const tryDrop = (id, v) => {
    if (endedRef.current || statusRef.current[v]) return 'none';
    const recipe = RECIPES[v].items;
    const have = addedRef.current[v];
    if (have.includes(id)) {
      addFx(v, 'note', 'Already in!');
      sound.sfx.click();
      return 'dup';
    }
    if (!recipe.includes(id)) {
      adjust(-PENALTY);
      sound.sfx.bad();
      addFx(v, 'minus', `-${PENALTY}s`);
      controls[v].start({ x: [0, -12, 12, -9, 9, -4, 0], rotate: [0, -3, 3, -2, 2, 0, 0], transition: { duration: 0.45 } });
      return 'wrong';
    }
    const next = [...have, id];
    const nextAdded = { ...addedRef.current, [v]: next };
    addedRef.current = nextAdded;
    setAdded(nextAdded);
    sound.sfx.pop(1 + next.length * 0.05);
    addFx(v, 'splash');
    controls[v].start({ scaleX: [1, 1.07, 0.97, 1], scaleY: [1, 0.92, 1.04, 1], transition: { duration: 0.4 } });
    if (next.length === recipe.length) {
      statusRef.current = { ...statusRef.current, [v]: 'cooking' };
      completeVessel(v);
    }
    return 'ok';
  };

  const vesselAt = (cx, cy) => {
    for (const v of VESSELS) {
      const el = vesselRefs.current[v];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (cx >= r.left - DROP_SLOP && cx <= r.right + DROP_SLOP && cy >= r.top - DROP_SLOP && cy <= r.bottom + DROP_SLOP) return v;
    }
    return null;
  };

  const stagePoint = (cx, cy) => {
    const el = stageRef.current;
    const r = el.getBoundingClientRect();
    return { x: cx - r.left + el.scrollLeft, y: cy - r.top + el.scrollTop };
  };

  // latest handlers for the window listeners
  const handlers = useRef({});
  handlers.current = {
    move(e) {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      if (!d.moved) {
        if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < DRAG_THRESHOLD) return;
        d.moved = true;
        d.token = ++dragToken.current;
        setSelected(null);
        setDrag({ id: d.id, size: d.size, token: d.token });
        sound.sfx.click();
      }
      const p = stagePoint(e.clientX, e.clientY);
      gx.set(p.x - d.size / 2);
      gy.set(p.y - d.size / 2);
      const v = vesselAt(e.clientX, e.clientY);
      if (v !== d.hover) {
        d.hover = v;
        setHover(v);
      }
    },
    up(e, cancelled) {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      dragRef.current = null;
      setHover(null);
      if (!d.moved) {
        if (!cancelled && !endedRef.current) {
          sound.sfx.click();
          setSelected((s) => (s === d.id ? null : d.id));
        }
        return;
      }
      const v = cancelled ? null : vesselAt(e.clientX, e.clientY);
      const res = v ? tryDrop(d.id, v) : 'none';
      if (res === 'ok') {
        setDrag(null);
        return;
      }
      // bounce back to the shelf
      const tok = d.token;
      const opts = { type: 'spring', stiffness: 380, damping: 18 };
      animate(gx, d.ox - d.size / 2, opts);
      animate(gy, d.oy - d.size / 2, {
        ...opts,
        onComplete: () => {
          if (dragToken.current === tok) setDrag(null);
        },
      });
    },
  };

  useEffect(() => {
    const move = (e) => handlers.current.move(e);
    const up = (e) => handlers.current.up(e, false);
    const cancel = (e) => handlers.current.up(e, true);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
    };
  }, []);

  const onItemDown = (id) => (e) => {
    if (endedRef.current || dragRef.current) return;
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    const r = e.currentTarget.getBoundingClientRect();
    const o = stagePoint(r.left + r.width / 2, r.top + r.height / 2);
    const size = Math.min(r.width, 96);
    dragRef.current = { id, pointerId: e.pointerId, sx: e.clientX, sy: e.clientY, ox: o.x, oy: o.y, size, moved: false, hover: null };
    const p = stagePoint(e.clientX, e.clientY);
    gx.set(p.x - size / 2);
    gy.set(p.y - size / 2);
  };

  // keyboard "click" (detail === 0) selects; pointer taps are handled in pointerup
  const onItemClick = (id) => (e) => {
    if (e.detail !== 0 || endedRef.current) return;
    sound.sfx.click();
    setSelected((s) => (s === id ? null : id));
  };

  const onVesselClick = (v) => {
    if (!selected || endedRef.current) return;
    const res = tryDrop(selected, v);
    if (res === 'ok') setSelected(null);
  };

  const isUsedUp = (id) => {
    const needed = VESSELS.filter((v) => RECIPES[v].items.includes(id));
    return needed.length > 0 && needed.every((v) => added[v].includes(id));
  };

  const totalItems = RECIPES.biryani.items.length + RECIPES.lassi.items.length;
  const doneItems = added.biryani.length + added.lassi.length;
  const stageStyle = useMemo(() => ({ '--l03-tile': TILE_URL }), []);

  return (
    <Stage className="l03-stage" style={stageStyle}>
      <div className="l03-bg" aria-hidden>
        <div className="l03-tiles" />
        <div className="l03-glow" />
        <Toran />
        <Lamp />
        <CopperUtensils side="left" />
        <CopperUtensils side="right" />
      </div>

      <div className="l03-root" ref={stageRef}>
        <GameHud className="l03-hud">
          <HudPill label="Order" value={`${doneItems}/${totalItems}`} accent="#f2a541" />
          <TimerBar left={left} total={TIME_LIMIT} />
        </GameHud>

        <div className="l03-main">
          {/* order ticket */}
          <div className="l03-ticket">
            <span className="l03-pin" />
            <div className="l03-ticket-head">Order #14 · table for 2 ♡</div>
            <div className="l03-ticket-cols">
              {VESSELS.map((v) => (
                <div key={v} className={`l03-ticket-col ${status[v] ? 'l03-col-done' : ''}`}>
                  <h4>{RECIPES[v].title}</h4>
                  <ul>
                    {RECIPES[v].items.map((id) => {
                      const ok = added[v].includes(id);
                      return (
                        <li key={id} className={ok ? 'l03-ticked' : ''}>
                          <span className="l03-box">{ok && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}>✓</motion.span>}</span>
                          <span className="l03-item-text">{INGREDIENTS[id].ticket}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
            <div className="l03-ticket-note">extra love, no ketchup!!</div>
          </div>

          {/* vessels */}
          {VESSELS.map((v) => {
            const st = status[v];
            const n = added[v].length;
            return (
              <motion.button
                key={v}
                type="button"
                ref={(el) => (vesselRefs.current[v] = el)}
                className={`l03-vessel ${hover === v ? 'l03-hover' : ''} ${selected && !st ? 'l03-target' : ''}`}
                animate={controls[v]}
                onClick={() => onVesselClick(v)}
                aria-label={`${RECIPES[v].vessel}: ${n} of ${RECIPES[v].items.length} added${selected ? `. Add ${INGREDIENTS[selected].name}` : ''}`}
              >
                <div className="l03-vessel-art">
                  <AnimatePresence mode="wait">
                    {st === 'done' ? (
                      <motion.div key="done" className="l03-art-wrap" initial={{ scale: 0.4, opacity: 0, rotate: -6 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 220, damping: 14 }}>
                        {v === 'biryani' ? <PlatedBiryani /> : <LassiGlass />}
                      </motion.div>
                    ) : (
                      <motion.div key="cook" className="l03-art-wrap" exit={{ scale: 0.6, opacity: 0, transition: { duration: 0.2 } }}>
                        {v === 'biryani' ? <Handi added={added.biryani} cooking={st === 'cooking'} /> : <Blender added={added.lassi} blending={st === 'cooking'} />}
                      </motion.div>
                    )}
                  </AnimatePresence>
                  {/* feedback fx */}
                  <AnimatePresence>
                    {fx
                      .filter((f) => f.vessel === v)
                      .map((f) =>
                        f.kind === 'splash' ? (
                          <div key={f.key} className="l03-splash">
                            {Array.from({ length: 9 }, (_, i) => {
                              const a = (i / 9) * Math.PI * 2;
                              return (
                                <motion.span
                                  key={i}
                                  className="l03-drop"
                                  style={{ background: i % 3 === 0 ? '#ffd36e' : i % 3 === 1 ? '#ffb3cf' : '#fff' }}
                                  initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
                                  animate={{ x: Math.cos(a) * 46, y: Math.sin(a) * 30 - 26, scale: 0.2, opacity: 0 }}
                                  transition={{ duration: 0.6, ease: 'easeOut' }}
                                />
                              );
                            })}
                            <motion.span className="l03-puff" initial={{ scale: 0.2, opacity: 0.9 }} animate={{ scale: 1.6, opacity: 0 }} transition={{ duration: 0.6 }} />
                          </div>
                        ) : (
                          <motion.span
                            key={f.key}
                            className={`l03-float ${f.kind === 'minus' ? 'l03-float-bad' : ''}`}
                            initial={{ y: 0, opacity: 0, scale: 0.6 }}
                            animate={{ y: -50, opacity: [0, 1, 1, 0], scale: 1.1 }}
                            transition={{ duration: 0.95 }}
                          >
                            {f.text}
                          </motion.span>
                        ),
                      )}
                  </AnimatePresence>
                </div>
                <div className="l03-vessel-label">
                  {st === 'done' ? `${RECIPES[v].title} ready!` : st === 'cooking' ? (v === 'biryani' ? 'Dum cooking…' : 'Whirrrr…') : RECIPES[v].vessel}
                  {!st && (
                    <b>
                      {n}/{RECIPES[v].items.length}
                    </b>
                  )}
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* ingredient shelf */}
        <div className="l03-shelf" role="list" aria-label="Ingredients">
          {shelf.map((id) => {
            const used = isUsedUp(id);
            const dragging = drag?.id === id;
            return (
              <button
                key={id}
                type="button"
                role="listitem"
                className={`l03-item ${selected === id ? 'l03-selected' : ''} ${used ? 'l03-used' : ''} ${dragging ? 'l03-dragging' : ''}`}
                onPointerDown={onItemDown(id)}
                onClick={onItemClick(id)}
                aria-pressed={selected === id}
                aria-label={INGREDIENTS[id].name}
              >
                <IngredientIcon id={id} />
                <span className="l03-item-name">{INGREDIENTS[id].name}</span>
              </button>
            );
          })}
        </div>

        {/* floating dragged ingredient */}
        {drag && (
          <motion.div className="l03-ghost" style={{ x: gx, y: gy, width: drag.size, height: drag.size }} initial={{ scale: 1 }} animate={{ scale: 1.15, rotate: [0, -6, 6, 0] }} transition={{ rotate: { repeat: Infinity, duration: 0.8 } }}>
            <IngredientIcon id={drag.id} />
          </motion.div>
        )}

        <AnimatePresence>
          {showGo && (
            <motion.div className="l03-go" initial={{ scale: 0.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 1.4, opacity: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 15 }}>
              Order up, Chef Pillu!
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Stage>
  );
}
