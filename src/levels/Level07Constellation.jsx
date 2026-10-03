import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Stage, GameHud, HudPill, TimerBar } from './kit.jsx';
import { useTimer } from '../hooks/useGameLoop';
import { sound } from '../audio/soundManager';
import { IconStar } from '../components/Icons';
import './Level07Constellation.css';

/* ───────── Tunables ───────── */
const TIME_LIMIT = 45; // seconds "before the night ends" (paused during celebrations)
const WRONG_PENALTY = 3; // seconds lost per wrong tap
const CELEBRATE_MS = 1900; // how long each finished constellation shows its name
const DECOYS = 12; // faint unnumbered stars per constellation
const HIT_R = 6.5; // numbered-star tap radius (viewBox units, 100x100)
const DECOY_HIT_R = 2.6;

/*
 * Constellations in a 100x100 viewBox. `pts` are tapped in order 1..N.
 * `closed` draws last→first on completion; `extra` = additional [i, j] index lines;
 * `fill` = optional star indices for the glow polygon (defaults to all).
 */
const CONSTELLATIONS = [
  {
    name: 'Our Heart',
    closed: true,
    pts: [
      [50, 86],
      [25, 63],
      [13, 38],
      [26, 17],
      [50, 31],
      [74, 17],
      [87, 38],
      [75, 63],
    ],
  },
  {
    name: 'P for Pillu',
    closed: false,
    extra: [[7, 2]],
    fill: [2, 3, 4, 5, 6, 7],
    pts: [
      [34, 88],
      [34, 66],
      [34, 44],
      [34, 14],
      [60, 14],
      [74, 30],
      [62, 46],
      [46, 46],
    ],
  },
  {
    // a ring: diamond on top, band below
    name: 'Forever',
    closed: false,
    extra: [
      [10, 3],
      [0, 3],
    ],
    fill: [3, 4, 5, 6, 7, 8, 9, 10],
    pts: [
      [39, 22],
      [50, 10],
      [61, 22],
      [50, 34],
      [70, 42],
      [78, 62],
      [70, 82],
      [50, 90],
      [30, 82],
      [22, 62],
      [30, 42],
    ],
  },
];

const rand = (a, b) => a + Math.random() * (b - a);

function makeDecoys(pts) {
  const out = [];
  let guard = 0;
  while (out.length < DECOYS && guard++ < 500) {
    const x = rand(6, 94);
    const y = rand(6, 94);
    const near = pts.some(([px, py]) => Math.hypot(px - x, py - y) < 11) || out.some((d) => Math.hypot(d.x - x, d.y - y) < 8);
    if (!near) out.push({ x, y, r: rand(0.6, 1.2), d: rand(0, 3) });
  }
  return out;
}

function makeField(n, seed) {
  return Array.from({ length: n }, (_, i) => ({ x: rand(0, 100), y: rand(0, 100), r: rand(0.15, 0.45) * seed, d: rand(0, 4), k: i }));
}

const sparklePath = (r) => `M0 ${-r}Q0 0 ${r} 0Q0 0 0 ${r}Q0 0 ${-r} 0Q0 0 0 ${-r}Z`;

/* Background: parallax starfield, shooting stars, crescent moon that sinks as time runs out */
function Sky({ progress }) {
  const far = useMemo(() => makeField(90, 0.8), []);
  const near = useMemo(() => makeField(40, 1.4), []);
  const moonTop = 8 + progress * 62; // % from top
  return (
    <div className="l07-sky" aria-hidden>
      <svg className="l07-layer l07-far" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
        {far.map((s) => (
          <circle key={s.k} cx={s.x} cy={s.y} r={s.r} className="l07-bgstar" style={{ animationDelay: `${s.d}s` }} />
        ))}
      </svg>
      <svg className="l07-layer l07-near" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
        {near.map((s) => (
          <path key={s.k} d={sparklePath(s.r * 1.6)} transform={`translate(${s.x} ${s.y})`} className="l07-bgstar" style={{ animationDelay: `${s.d}s` }} />
        ))}
      </svg>
      <span className="l07-shoot" style={{ '--sx': '70%', '--sy': '8%', animationDelay: '1.5s' }} />
      <span className="l07-shoot" style={{ '--sx': '35%', '--sy': '4%', animationDelay: '5.2s' }} />
      <span className="l07-shoot" style={{ '--sx': '90%', '--sy': '22%', animationDelay: '8.7s' }} />
      <div className="l07-moon" style={{ top: `${moonTop}%` }}>
        <svg viewBox="0 0 60 60">
          <defs>
            <mask id="l07-crescent">
              <rect width="60" height="60" fill="#fff" />
              <circle cx="40" cy="22" r="20" fill="#000" />
            </mask>
          </defs>
          <circle cx="30" cy="30" r="22" fill="#fff4cc" mask="url(#l07-crescent)" />
          <circle cx="20" cy="38" r="3" fill="#f0dfa4" mask="url(#l07-crescent)" />
          <circle cx="14" cy="26" r="2" fill="#f0dfa4" mask="url(#l07-crescent)" />
        </svg>
      </div>
      <div className="l07-dawn" style={{ opacity: progress * 0.9 }} />
    </div>
  );
}

function Burst({ x, y }) {
  const bits = useMemo(() => Array.from({ length: 8 }, (_, i) => ({ a: (i / 8) * Math.PI * 2 + rand(-0.2, 0.2), d: rand(6, 11) })), []);
  return (
    <g transform={`translate(${x} ${y})`} pointerEvents="none">
      {bits.map((b, i) => (
        <motion.path
          key={i}
          d={sparklePath(1.4)}
          fill="#fff3b0"
          initial={{ x: 0, y: 0, opacity: 1, scale: 0.4 }}
          animate={{ x: Math.cos(b.a) * b.d, y: Math.sin(b.a) * b.d, opacity: 0, scale: 1.2 }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
        />
      ))}
    </g>
  );
}

export default function Level07Constellation({ onWin, onFail }) {
  const [level, setLevel] = useState(0);
  const [next, setNext] = useState(0); // index of the star to tap next
  const [celebrating, setCelebrating] = useState(false);
  const [wrongAt, setWrongAt] = useState(null); // {x,y,key}
  const [flash, setFlash] = useState(0);
  const [running, setRunning] = useState(true);
  const ended = useRef(false);
  const timers = useRef([]);
  const stageRef = useRef(null);

  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms));
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const end = (won) => {
    if (ended.current) return;
    ended.current = true;
    setRunning(false);
    if (won) onWin();
    else onFail('time');
  };

  const [timeLeft, adjust] = useTimer(TIME_LIMIT, running && !celebrating, () => end(false));

  const c = CONSTELLATIONS[level];
  const levelRef = useRef(0);
  levelRef.current = level;
  const decoys = useMemo(() => makeDecoys(c.pts).map((d) => ({ ...d, lvl: level })), [c, level]);

  const tapStar = (i, lvl) => {
    if (ended.current || celebrating || lvl !== levelRef.current) return; // ignore taps on a fading-out sky
    if (i === next) {
      sound.sfx.boop(i);
      const n = i + 1;
      setNext(n);
      if (n === c.pts.length) {
        setCelebrating(true);
        later(() => sound.sfx.sparkle(), 350);
        later(() => {
          if (level + 1 >= CONSTELLATIONS.length) {
            end(true);
          } else {
            sound.sfx.whoosh();
            setLevel(level + 1);
            setNext(0);
            setCelebrating(false);
          }
        }, CELEBRATE_MS);
      }
    } else if (i >= next) {
      // wrong numbered star (already-lit stars are harmless)
      wrong(c.pts[i][0], c.pts[i][1]);
    }
  };

  const wrong = (x, y) => {
    sound.sfx.bad();
    adjust(-WRONG_PENALTY);
    setWrongAt({ x, y, key: Math.random() });
    setFlash((f) => f + 1);
  };

  // parallax on pointer move (no re-render; CSS vars)
  const onMove = (e) => {
    const el = stageRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--px', ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
    el.style.setProperty('--py', ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
  };

  const progress = 1 - timeLeft / TIME_LIMIT;
  const done = next >= c.pts.length;
  const segments = [];
  for (let i = 1; i < next; i++) segments.push([i - 1, i]);
  if (done) {
    if (c.closed) segments.push([c.pts.length - 1, 0]);
    (c.extra || []).forEach((s) => segments.push(s));
  }

  return (
    <Stage className="l07-stage">
      <div className="l07-root" ref={stageRef} onPointerMove={onMove}>
        <Sky progress={progress} />

        <GameHud>
          <HudPill icon={<IconStar size={18} />} label="sky" value={`${level + 1}/${CONSTELLATIONS.length}`} />
          <TimerBar left={timeLeft} total={TIME_LIMIT} />
        </GameHud>

        <div className="l07-board">
          <AnimatePresence mode="wait">
            <motion.svg
              key={level}
              className="l07-svg"
              viewBox="-4 -4 108 108"
              preserveAspectRatio="xMidYMid meet"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={{ duration: 0.5 }}
            >
              <defs>
                <filter id="l07-glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="1.1" result="b" />
                  <feMerge>
                    <feMergeNode in="b" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <radialGradient id="l07-fill" cx="50%" cy="50%" r="60%">
                  <stop offset="0" stopColor="#fff3b0" stopOpacity="0.55" />
                  <stop offset="1" stopColor="#ffd36e" stopOpacity="0.08" />
                </radialGradient>
              </defs>

              {/* completion glow fill */}
              {done && (
                <motion.polygon
                  points={(c.fill ? c.fill.map((i) => c.pts[i]) : c.pts).map((p) => p.join(',')).join(' ')}
                  fill="url(#l07-fill)"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.8 }}
                  pointerEvents="none"
                />
              )}

              {/* decoys */}
              {decoys.map((d, i) => (
                <circle
                  key={`d${i}`}
                  cx={d.x}
                  cy={d.y}
                  r={DECOY_HIT_R}
                  fill="transparent"
                  className="l07-decoy-hit"
                  onPointerDown={() => !celebrating && !ended.current && d.lvl === levelRef.current && wrong(d.x, d.y)}
                />
              ))}
              {decoys.map((d, i) => (
                <circle key={`dv${i}`} cx={d.x} cy={d.y} r={d.r} className="l07-decoy" style={{ animationDelay: `${d.d}s` }} pointerEvents="none" />
              ))}

              {/* golden lines */}
              <g filter="url(#l07-glow)" pointerEvents="none">
                {segments.map(([a, b]) => (
                  <motion.path
                    key={`${a}-${b}`}
                    d={`M${c.pts[a][0]} ${c.pts[a][1]}L${c.pts[b][0]} ${c.pts[b][1]}`}
                    className="l07-line"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.35, ease: 'easeOut' }}
                  />
                ))}
              </g>

              {/* numbered stars */}
              {c.pts.map(([x, y], i) => {
                const lit = i < next;
                return (
                  <g
                    key={i}
                    transform={`translate(${x} ${y})`}
                    className={`l07-star ${lit ? 'is-lit' : ''} ${i === next ? 'is-next' : ''}`}
                    role="button"
                    tabIndex={0}
                    aria-label={`star ${i + 1}${lit ? ', connected' : ''}`}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      tapStar(i, level);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        tapStar(i, level);
                      }
                    }}
                  >
                    <circle r={HIT_R} fill="transparent" />
                    <motion.g
                      animate={lit ? { scale: [1, 1.6, 1] } : { scale: 1 }}
                      transition={{ duration: 0.45 }}
                    >
                      <circle r="5" className="l07-halo" />
                      <path d={sparklePath(5.4)} className="l07-sparkle" />
                      <circle r="3.6" className="l07-core" />
                    </motion.g>
                    <text className="l07-num" y="0.2" textAnchor="middle" dominantBaseline="middle">
                      {i + 1}
                    </text>
                  </g>
                );
              })}

              {/* wrong-tap ring */}
              {wrongAt && (
                <motion.circle
                  key={wrongAt.key}
                  cx={wrongAt.x}
                  cy={wrongAt.y}
                  className="l07-wrong"
                  initial={{ r: 2, opacity: 1 }}
                  animate={{ r: 9, opacity: 0 }}
                  transition={{ duration: 0.5 }}
                  pointerEvents="none"
                />
              )}

              {done && c.pts.map(([x, y], i) => <Burst key={`b${i}`} x={x} y={y} />)}
            </motion.svg>
          </AnimatePresence>

          <AnimatePresence>
            {celebrating && (
              <motion.div
                key={`name${level}`}
                className="l07-name"
                initial={{ opacity: 0, y: 16, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ type: 'spring', stiffness: 200, damping: 16, delay: 0.25 }}
              >
                {c.name}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {flash > 0 && <div key={flash} className="l07-flash" aria-hidden />}
        {wrongAt && (
          <div key={`p${wrongAt.key}`} className="l07-penalty" aria-live="polite">
            −{WRONG_PENALTY}s
          </div>
        )}
      </div>
    </Stage>
  );
}
