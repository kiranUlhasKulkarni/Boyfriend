import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Stage, GameHud, HudPill } from './kit.jsx';
import Photo from '../components/Photo';
import { Heart, HEART_D } from '../components/Icons';
import { IMAGES } from '../config';
import { sound } from '../audio/soundManager';
import './Level05Memory.css';

/* ───────── Tunables ───────── */
const MAX_MOVES = 20; // a "move" = flipping a pair; fail when all are used up
const FLIP_MS = 420; // flip animation duration
const MISMATCH_SHOW_MS = 800; // how long a wrong pair stays visible before flipping back
const WIN_PAUSE_MS = 900; // little breather after the last match before onWin()
const GAP = 10; // px between cards
const CARD_RATIO = 0.8; // polaroid width / height

const CAPTIONS = ['us ♡', 'that day', 'my fav', 'so cute', 'remember?', 'forever'];
const TAPES = ['#ffc8dd', '#bddcff', '#d9c7ff', '#ffe29a', '#c5f0d6', '#ffd1b8'];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeDeck() {
  const faces = IMAGES.memoryFaces.slice(0, 6);
  const deck = faces.flatMap((src, face) => [
    { uid: `${face}a`, face, src },
    { uid: `${face}b`, face, src },
  ]);
  return shuffle(deck).map((c) => ({ ...c, tilt: (Math.random() - 0.5) * 5 }));
}

/* Wax seal with an embossed heart (card back centre) */
function WaxSeal() {
  return (
    <svg viewBox="0 0 100 100" className="l05-seal" aria-hidden>
      <defs>
        <radialGradient id="l05-wax" cx="38%" cy="32%" r="75%">
          <stop offset="0" stopColor="#ff9dbf" />
          <stop offset="0.55" stopColor="#e2557f" />
          <stop offset="1" stopColor="#b8355f" />
        </radialGradient>
      </defs>
      <path
        d="M50 6c7 0 9 5 15 7s11-1 14 5 0 10 3 15 9 7 8 14-6 8-7 14 4 11-1 16-11 3-16 6-6 9-13 9-9-5-15-7-11 1-14-5 0-10-3-15-9-7-8-14 6-8 7-14-4-11 1-16 11-3 16-6 6-9 13-9z"
        fill="url(#l05-wax)"
      />
      <circle cx="50" cy="50" r="30" fill="none" stroke="#ffffff" strokeOpacity=".35" strokeWidth="2.5" />
      <g transform="translate(29 30) scale(.42)">
        <path d={HEART_D} fill="#c7406a" stroke="#ffb3cf" strokeOpacity=".7" strokeWidth="5" />
      </g>
      <ellipse cx="36" cy="30" rx="9" ry="5" fill="#fff" opacity=".35" transform="rotate(-30 36 30)" />
    </svg>
  );
}

function CheckSticker() {
  return (
    <motion.div
      className="l05-check"
      initial={{ scale: 0, rotate: -40 }}
      animate={{ scale: 1, rotate: -8 }}
      transition={{ type: 'spring', stiffness: 420, damping: 14, delay: 0.25 }}
      aria-hidden
    >
      <svg viewBox="0 0 24 24">
        <path d="M6 12.5l4 4 8-9" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </motion.div>
  );
}

function HeartBurst() {
  const bits = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const a = (i / 7) * Math.PI * 2 + Math.random() * 0.5;
        const d = 45 + Math.random() * 30;
        return { x: Math.cos(a) * d, y: Math.sin(a) * d - 15, s: 12 + Math.random() * 10, c: ['#ff85b1', '#ffb3cf', '#96c6fb', '#ffd36e'][i % 4] };
      }),
    []
  );
  return (
    <div className="l05-burst" aria-hidden>
      {bits.map((b, i) => (
        <motion.div
          key={i}
          className="l05-burst-heart"
          initial={{ x: 0, y: 0, scale: 0.2, opacity: 1 }}
          animate={{ x: b.x, y: b.y, scale: 1, opacity: 0 }}
          transition={{ duration: 0.9, ease: 'easeOut', delay: 0.15 }}
        >
          <Heart size={b.s} fill={b.c} />
        </motion.div>
      ))}
    </div>
  );
}

function Card({ card, index, faceUp, matched, wrong, disabled, onFlip }) {
  const hop = matched ? { y: [0, -18, 0, -6, 0], scale: [1, 1.06, 1, 1.02, 1] } : wrong ? { rotate: [card.tilt, -7, 7, -5, 5, card.tilt] } : { y: 0, scale: 1, rotate: card.tilt };
  return (
    <motion.button
      type="button"
      className={`l05-card ${matched ? 'is-matched' : ''} ${wrong ? 'is-wrong' : ''}`}
      onClick={() => onFlip(index)}
      disabled={disabled}
      aria-label={faceUp ? `memory ${card.face + 1}${matched ? ', matched' : ''}` : `face-down card ${index + 1}`}
      initial={{ opacity: 0, y: 30, scale: 0.8, rotate: card.tilt }}
      animate={{ opacity: 1, ...hop }}
      transition={matched || wrong ? { duration: 0.6, ease: 'easeOut' } : { type: 'spring', stiffness: 260, damping: 20, delay: index * 0.035 }}
      whileHover={!faceUp ? { y: -4, rotate: 0 } : undefined}
      whileTap={!faceUp ? { scale: 0.95 } : undefined}
    >
      <motion.div
        className="l05-flipper"
        animate={{ rotateY: faceUp ? 180 : 0 }}
        transition={{ duration: FLIP_MS / 1000, ease: [0.4, 0.2, 0.2, 1] }}
      >
        {/* back */}
        <div className="l05-face l05-back">
          <div className="l05-back-pattern" />
          <WaxSeal />
        </div>
        {/* front (polaroid) */}
        <div className="l05-face l05-front">
          <span className="l05-tape" style={{ background: TAPES[card.face % TAPES.length] }} />
          <div className="l05-photo-wrap">
            <Photo src={card.src} label={`memory ${card.face + 1}`} className="l05-photo" />
          </div>
          <div className="l05-caption">{CAPTIONS[card.face % CAPTIONS.length]}</div>
          {matched && <CheckSticker />}
        </div>
      </motion.div>
      {matched && <HeartBurst />}
    </motion.button>
  );
}

/* Fairy-light string across the top: scallops with bulbs */
const SCALLOPS = 5;
const BULBS = (() => {
  const out = [];
  const w = 100 / SCALLOPS;
  for (let s = 0; s < SCALLOPS; s++) {
    for (const t of [0.2, 0.5, 0.8]) {
      const x = s * w + t * w;
      const y = (1 - t) * (1 - t) * 6 + 2 * (1 - t) * t * 34 + t * t * 6; // quadratic droop
      out.push({ x, y, c: ['#ffd36e', '#ff9cc2', '#a9d6ff', '#c9b5ff', '#b6f5cb'][out.length % 5], d: (out.length * 0.37) % 2.2 });
    }
  }
  return out;
})();

function FairyLights() {
  const w = 100 / SCALLOPS;
  const d = Array.from({ length: SCALLOPS }, (_, s) => `${s === 0 ? 'M0 6' : ''} Q${s * w + w / 2} 34 ${(s + 1) * w} 6`).join(' ');
  return (
    <div className="l05-lights" aria-hidden>
      <svg viewBox="0 0 100 40" preserveAspectRatio="none">
        <path d={d} fill="none" stroke="var(--l05-wire)" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
      </svg>
      {BULBS.map((b, i) => (
        <span key={i} className="l05-bulb" style={{ left: `${b.x}%`, top: `${(b.y / 40) * 100}%`, '--c': b.c, animationDelay: `${b.d}s` }} />
      ))}
    </div>
  );
}

export default function Level05Memory({ onWin, onFail }) {
  const [deck] = useState(makeDeck);
  const [open, setOpen] = useState([]); // indices currently face-up and unresolved
  const [matched, setMatched] = useState(() => new Set());
  const [wrong, setWrong] = useState([]);
  const [moves, setMoves] = useState(0);
  const [layout, setLayout] = useState({ cols: 4, rows: 3, cw: 100 });
  const ended = useRef(false);
  const busy = useRef(false);
  const timers = useRef([]);
  const boardRef = useRef(null);

  const later = useCallback((fn, ms) => {
    const id = setTimeout(fn, ms);
    timers.current.push(id);
  }, []);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // Fit the grid to the board without scrolling
  useLayoutEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const fit = () => {
      const { width, height } = el.getBoundingClientRect();
      const portrait = height > width * 1.05;
      const cols = portrait ? 3 : 4;
      const rows = portrait ? 4 : 3;
      const byW = (width - GAP * (cols - 1)) / cols;
      const byH = ((height - GAP * (rows - 1)) / rows) * CARD_RATIO;
      setLayout({ cols, rows, cw: Math.max(40, Math.floor(Math.min(byW, byH, 210))) });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const finish = (won) => {
    if (ended.current) return;
    ended.current = true;
    if (won) onWin();
    else onFail('moves');
  };

  const openRef = useRef([]);
  const setOpenBoth = (v) => {
    openRef.current = v;
    setOpen(v);
  };

  const flip = (i) => {
    if (ended.current || busy.current || matched.has(i) || openRef.current.includes(i)) return;
    sound.sfx.click();
    const next = [...openRef.current, i];
    setOpenBoth(next);
    if (next.length < 2) return;

    busy.current = true;
    const used = moves + 1;
    setMoves(used);
    const [a, b] = next;
    if (deck[a].face === deck[b].face) {
      later(() => {
        const m = new Set(matched);
        m.add(a);
        m.add(b);
        setMatched(m);
        setOpenBoth([]);
        busy.current = false;
        sound.sfx.sparkle();
        if (m.size === deck.length) {
          busy.current = true;
          later(() => finish(true), WIN_PAUSE_MS);
        } else if (used >= MAX_MOVES) {
          busy.current = true;
          later(() => finish(false), 700);
        }
      }, FLIP_MS);
    } else {
      later(() => {
        setWrong([a, b]);
        sound.sfx.bad();
      }, FLIP_MS);
      later(() => {
        setWrong([]);
        setOpenBoth([]);
        sound.sfx.whoosh();
        if (used >= MAX_MOVES) {
          later(() => finish(false), 500);
        } else {
          busy.current = false;
        }
      }, FLIP_MS + MISMATCH_SHOW_MS);
    }
  };

  const movesLeft = MAX_MOVES - moves;
  const pairs = matched.size / 2;

  return (
    <Stage className="l05-stage">
      <FairyLights />
      <GameHud>
        <HudPill icon={<Heart size={18} fill="#ff7fb0" />} label="pairs" value={`${pairs}/6`} />
        <HudPill label="moves left" value={movesLeft} accent={movesLeft <= 5 ? '#ff5d7a' : 'var(--accent-2)'} />
      </GameHud>

      <div className="l05-board" ref={boardRef}>
        <div
          className="l05-grid"
          style={{
            gridTemplateColumns: `repeat(${layout.cols}, ${layout.cw}px)`,
            gridTemplateRows: `repeat(${layout.rows}, ${Math.round(layout.cw / CARD_RATIO)}px)`,
            gap: GAP,
            '--cw': `${layout.cw}px`,
          }}
        >
          {deck.map((card, i) => (
            <Card
              key={card.uid}
              card={card}
              index={i}
              faceUp={open.includes(i) || matched.has(i)}
              matched={matched.has(i)}
              wrong={wrong.includes(i)}
              disabled={matched.has(i)}
              onFlip={flip}
            />
          ))}
        </div>
      </div>

      <AnimatePresence>
        {movesLeft <= 3 && movesLeft > 0 && !ended.current && (
          <motion.div className="l05-warn" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            careful pillu, only {movesLeft} {movesLeft === 1 ? 'move' : 'moves'} left!
          </motion.div>
        )}
      </AnimatePresence>
    </Stage>
  );
}
