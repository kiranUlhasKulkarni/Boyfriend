import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGame, MAX_LIVES } from '../state/GameContext';
import { TopBar } from '../components/UI';
import Photo from '../components/Photo';
import LipMark, { LipFilters, LIP_COLORS } from '../components/LipMark';
import { Heart, HEART_D } from '../components/Icons';
import { IMAGES } from '../config';
import { sound } from '../audio/soundManager';
import { cannons, burst } from '../components/confetti';
import './KissScreen.css';

export const KISSES_NEEDED = 25;

const CHEERS = {
  1: 'mwah! 💋',
  5: 'more more more',
  10: 'hehe keep going',
  15: 'pillu stop I’m blushing',
  20: 'almost there!!',
  24: 'ONE MORE',
};

export default function KissScreen() {
  const { restoreLives, goTo, currentLevel, startLevel } = useGame();
  const [kisses, setKisses] = useState([]);
  const [floaters, setFloaters] = useState([]);
  const [done, setDone] = useState(false);
  const areaRef = useRef(null);
  const count = kisses.length;

  const kiss = (e) => {
    if (done || count >= KISSES_NEEDED) return;
    const rect = areaRef.current.getBoundingClientRect();
    // store as % so marks stay put if the window resizes
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const id = performance.now() + Math.random();
    const mark = {
      id,
      x,
      y,
      rot: (Math.random() - 0.5) * 50,
      size: 70 + Math.random() * 40,
      color: LIP_COLORS[Math.floor(Math.random() * LIP_COLORS.length)],
    };
    setKisses((k) => [...k, mark]);
    setFloaters((f) => [...f.slice(-14), { id, x, y }]);
    sound.play('kiss');
    if (navigator.vibrate) navigator.vibrate(15);
  };

  useEffect(() => {
    if (count === KISSES_NEEDED && !done) {
      setDone(true);
      setTimeout(() => {
        restoreLives();
        sound.sfx.sparkle();
        cannons(1.2);
        setTimeout(() => burst({ x: 0.5, y: 0.4 }, 1.2), 400);
        sound.play('success');
      }, 450);
    }
  }, [count, done, restoreLives]);

  const cheer = Object.keys(CHEERS)
    .map(Number)
    .filter((n) => n <= count)
    .pop();

  return (
    <div className="kiss-screen">
      <LipFilters />
      <TopBar title="Get more life!" onHome={(e) => goTo('map', { x: e.clientX, y: e.clientY })} />

      <div className={`kiss-area ${done ? 'done' : ''}`} ref={areaRef} onPointerDown={kiss}>
        <Photo src={IMAGES.herKissPhoto} label="your photo (full screen)" className="kiss-photo" />
        <div className="kiss-vignette" />

        {kisses.map((k) => (
          <motion.div
            key={k.id}
            className="kiss-mark"
            style={{ left: `${k.x}%`, top: `${k.y}%` }}
            initial={{ scale: 2.2, opacity: 0, rotate: k.rot - 20 }}
            animate={{ scale: 1, opacity: 1, rotate: k.rot }}
            transition={{ type: 'spring', stiffness: 500, damping: 18 }}
          >
            <LipMark color={k.color} size={k.size} />
          </motion.div>
        ))}

        <AnimatePresence>
          {floaters.map((f) => (
            <FloatHearts key={f.id} x={f.x} y={f.y} onDone={() => setFloaters((arr) => arr.filter((a) => a.id !== f.id))} />
          ))}
        </AnimatePresence>

        {!done && count === 0 && (
          <motion.div className="kiss-hint" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
            <motion.span animate={{ scale: [1, 1.15, 1] }} transition={{ repeat: Infinity, duration: 1.1 }}>
              💋
            </motion.span>
            Tap my face to kiss me!
          </motion.div>
        )}
      </div>

      {/* counter */}
      <div className="kiss-counter glass">
        <HeartMeter value={count / KISSES_NEEDED} />
        <div className="kiss-count">
          <motion.b key={count} initial={{ scale: 1.6, color: '#ff4f8b' }} animate={{ scale: 1, color: 'var(--ink)' }}>
            {count}
          </motion.b>
          <span>/ {KISSES_NEEDED} kisses</span>
          <AnimatePresence mode="wait">
            {cheer && (
              <motion.em key={cheer} className="hand" initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -8, opacity: 0 }}>
                {CHEERS[cheer]}
              </motion.em>
            )}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {done && (
          <motion.div className="kiss-done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
            <motion.div
              className="kiss-done-card glass"
              initial={{ scale: 0.4, y: 40 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ delay: 0.4, type: 'spring', stiffness: 240, damping: 13 }}
            >
              <div className="kiss-done-hearts">
                {Array.from({ length: MAX_LIVES }, (_, i) => (
                  <motion.span
                    key={i}
                    initial={{ scale: 0, y: 120, rotate: -40 }}
                    animate={{ scale: [0, 1.5, 1], y: 0, rotate: 0 }}
                    transition={{ delay: 0.8 + i * 0.25, duration: 0.6, ease: 'backOut' }}
                    onAnimationComplete={() => sound.sfx.boop(i)}
                  >
                    <Heart size={64} fill="#ff6f9f" />
                  </motion.span>
                ))}
              </div>
              <h2 className="grad-text">Lives restored!</h2>
              <p>25 kisses received. My heart is full and so are yours 💗</p>
              <div className="kiss-done-actions">
                <button className="btn btn-ghost" onClick={(e) => goTo('map', { x: e.clientX, y: e.clientY })}>
                  Back to map
                </button>
                {currentLevel && (
                  <button className="btn" onClick={(e) => startLevel(currentLevel, { x: e.clientX, y: e.clientY })}>
                    Retry level {currentLevel}
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FloatHearts({ x, y, onDone }) {
  const hearts = useRef(
    Array.from({ length: 5 }, () => ({ dx: (Math.random() - 0.5) * 120, dy: -60 - Math.random() * 90, s: 12 + Math.random() * 14, r: (Math.random() - 0.5) * 60 }))
  ).current;
  return (
    <div className="kiss-floaters" style={{ left: `${x}%`, top: `${y}%` }}>
      {hearts.map((h, i) => (
        <motion.span
          key={i}
          initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
          animate={{ x: h.dx, y: h.dy, scale: 1, opacity: 0, rotate: h.r }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
          onAnimationComplete={i === 0 ? onDone : undefined}
        >
          <Heart size={h.s} fill={i % 2 ? '#ff85b1' : '#ffb3cf'} />
        </motion.span>
      ))}
    </div>
  );
}

/** Heart that fills up from the bottom. */
function HeartMeter({ value }) {
  const h = 100 * value;
  return (
    <svg viewBox="0 0 100 100" width="58" height="58" className="heart-meter">
      <defs>
        <clipPath id="hmClip">
          <path d={HEART_D} />
        </clipPath>
        <linearGradient id="hmFill" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#f2629a" />
          <stop offset="1" stopColor="#ffb3cf" />
        </linearGradient>
      </defs>
      <path d={HEART_D} fill="var(--surface-2)" stroke="#ff85b1" strokeWidth="4" />
      <g clipPath="url(#hmClip)">
        <motion.rect x="0" width="100" height="100" fill="url(#hmFill)" initial={false} animate={{ y: 100 - h }} transition={{ type: 'spring', stiffness: 120, damping: 15 }} />
        <motion.path
          d="M0 0 q12.5 -6 25 0 t25 0 t25 0 t25 0 v8 h-100z"
          fill="#ffd0e2"
          initial={false}
          animate={{ y: 100 - h - 4 }}
          transition={{ type: 'spring', stiffness: 120, damping: 15 }}
        />
      </g>
      <path d={HEART_D} fill="none" stroke="#ff85b1" strokeWidth="4" />
    </svg>
  );
}
