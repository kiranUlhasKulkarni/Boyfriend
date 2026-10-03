import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGame } from '../state/GameContext';
import { TopBar } from '../components/UI';
import { LevelIcon, IconLock, IconStar, IconPlay, Heart, HEART_D } from '../components/Icons';
import { HimChibi, HerChibi } from '../art/Characters';
import { LEVELS } from '../levels';
import { sound } from '../audio/soundManager';
import { photoFor } from '../photos';
import './GameMap.css';

/* ── Map geometry (SVG user units) ── */
const W = 600;
const H = 2400;
const TOP_PAD = 330; // room for the castle at the top
const BOTTOM_PAD = 190;

function seeded(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

function buildNodes() {
  const n = LEVELS.length;
  const span = H - TOP_PAD - BOTTOM_PAD;
  return LEVELS.map((lvl, i) => ({
    ...lvl,
    x: W / 2 + Math.sin(i * 1.15 + 0.3) * 150,
    y: H - BOTTOM_PAD - (span * i) / (n - 1),
  }));
}

/** smooth cubic segment between two points (vertical S-curves) */
function seg(a, b) {
  const dy = (b.y - a.y) * 0.5;
  return `M${a.x} ${a.y} C${a.x} ${a.y + dy} ${b.x} ${b.y - dy} ${b.x} ${b.y}`;
}

export default function GameMap() {
  const { isUnlocked, isCompleted, startLevel, lives, dispatch } = useGame();
  const nodes = useMemo(buildNodes, []);
  const scrollRef = useRef(null);
  const svgRef = useRef(null);
  const [selected, setSelected] = useState(null);
  const [toast, setToast] = useState(null);

  const currentIdx = Math.max(0, nodes.findIndex((n) => isUnlocked(n.id) && !isCompleted(n.id)));
  const current = nodes[currentIdx === -1 ? nodes.length - 1 : currentIdx];
  const allDone = nodes.every((n) => isCompleted(n.id));

  // Scroll so the current node is centred
  useEffect(() => {
    const el = scrollRef.current;
    const svg = svgRef.current;
    if (!el || !svg) return;
    const place = (smooth) => {
      const scale = svg.getBoundingClientRect().height / H;
      const target = current.y * scale - el.clientHeight * 0.55;
      el.scrollTo({ top: target, behavior: smooth ? 'smooth' : 'auto' });
    };
    // start slightly lower, then glide up to the node
    const sc = svg.getBoundingClientRect().height / H;
    el.scrollTop = Math.min(el.scrollHeight, current.y * sc - el.clientHeight * 0.55 + 260);
    const t = setTimeout(() => place(true), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scenery = useMemo(() => buildScenery(nodes), [nodes]);

  const onNode = (node) => {
    if (!isUnlocked(node.id)) {
      sound.sfx.bad();
      setToast(`Finish level ${node.id - 1} first, pillu 💗`);
      setTimeout(() => setToast(null), 1800);
      return;
    }
    sound.sfx.pop();
    setSelected(node);
  };

  const play = (e) => {
    const node = selected;
    setSelected(null);
    if (lives <= 0) {
      dispatch({ type: 'OPEN_OUT_OF_LIVES' });
      return;
    }
    sound.sfx.whoosh();
    startLevel(node.id, { x: e.clientX, y: e.clientY });
  };

  return (
    <div className="map-screen">
      <TopBar title="Our Journey" />
      <div className="map-scroll screen-scroll" ref={scrollRef}>
        <div className="map-sides" aria-hidden />
        <svg ref={svgRef} className="map-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Level map">
          <defs>
            <linearGradient id="mapSky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--map-sky-top)" />
              <stop offset="0.12" stopColor="var(--map-ground-2)" />
              <stop offset="0.55" stopColor="var(--map-ground-1)" />
              <stop offset="1" stopColor="var(--map-ground-2)" />
            </linearGradient>
            <radialGradient id="nodeShine" cx="35%" cy="30%" r="70%">
              <stop offset="0" stopColor="#fff" stopOpacity=".9" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </radialGradient>
            <filter id="softShadow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#a0406f" floodOpacity=".28" />
            </filter>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="8" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            {nodes.map((n) => (
              <linearGradient key={n.id} id={`ng${n.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={n.color[0]} />
                <stop offset="1" stopColor={n.color[1]} />
              </linearGradient>
            ))}
            <linearGradient id="ngLocked" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--lock-1)" />
              <stop offset="1" stopColor="var(--lock-2)" />
            </linearGradient>
            <linearGradient id="ngGold" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fff1b8" />
              <stop offset="1" stopColor="#f2b44b" />
            </linearGradient>
          </defs>

          {/* ground */}
          <rect width={W} height={H} fill="url(#mapSky)" />
          <Scenery items={scenery} />
          <River />
          <Castle allDone={allDone} />
          <MapPolaroids nodes={nodes} />

          {/* path */}
          <g className="map-path">
            <path d={seg({ x: nodes[0].x, y: H + 40 }, nodes[0])} className="path-edge" />
            <path d={seg({ x: nodes[0].x, y: H + 40 }, nodes[0])} className="path-fill" />
            {nodes.slice(1).map((n, i) => (
              <g key={n.id}>
                <path d={seg(nodes[i], n)} className="path-edge" />
                <path d={seg(nodes[i], n)} className="path-fill" />
              </g>
            ))}
            <path d={seg(nodes[nodes.length - 1], { x: W / 2, y: 190 })} className="path-edge" />
            <path d={seg(nodes[nodes.length - 1], { x: W / 2, y: 190 })} className="path-fill" />
            {/* walked portion: glowing pink hearts trail */}
            {nodes.slice(1).map((n, i) =>
              isCompleted(nodes[i].id) ? (
                <motion.path
                  key={`w${n.id}`}
                  d={seg(nodes[i], n)}
                  className="path-walked"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.9, delay: 0.3 + i * 0.08, ease: 'easeInOut' }}
                />
              ) : (
                <path key={`d${n.id}`} d={seg(nodes[i], n)} className="path-dots" />
              )
            )}
          </g>

          {/* nodes */}
          {nodes.map((n) => (
            <MapNode
              key={n.id}
              node={n}
              locked={!isUnlocked(n.id)}
              done={isCompleted(n.id)}
              current={n.id === current.id && !allDone}
              onClick={() => onNode(n)}
            />
          ))}

          {/* pillu standing at the current node */}
          <motion.g
            initial={false}
            animate={{ x: (allDone ? W / 2 - 40 : current.x) - 30, y: (allDone ? 150 : current.y) - 132 }}
            transition={{ type: 'spring', stiffness: 80, damping: 14 }}
            style={{ pointerEvents: 'none' }}
          >
            <g className="bebu-bob">
              <HimChibi size={60} wave />
            </g>
          </motion.g>
        </svg>
      </div>

      <LevelSheet node={selected} onClose={() => setSelected(null)} onPlay={play} done={selected && isCompleted(selected.id)} />

      <AnimatePresence>
        {toast && (
          <motion.div className="map-toast glass" initial={{ y: 40, opacity: 0, x: '-50%' }} animate={{ y: 0, opacity: 1, x: '-50%' }} exit={{ y: 40, opacity: 0, x: '-50%' }}>
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ───────── Memory polaroids pinned beside the path ───────── */
function MapPolaroids({ nodes }) {
  const spots = nodes.slice(0, -1).map((a, i) => {
    const b = nodes[i + 1];
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const left = mid.x > W / 2;
    return { x: left ? 78 : W - 78, y: mid.y, rot: (left ? -1 : 1) * (6 + (i % 3) * 3), i };
  });
  return (
    <g className="map-polaroids">
      {spots.map((sp) => (
        <g key={sp.i} transform={`translate(${sp.x} ${sp.y}) rotate(${sp.rot})`} className="map-polaroid">
          <clipPath id={`mpc${sp.i}`}>
            <rect x="-40" y="-46" width="80" height="80" rx="2" />
          </clipPath>
          <rect x="-48" y="-54" width="96" height="112" rx="4" fill="#fffdfb" filter="url(#softShadow)" />
          <image
            href={photoFor(`map-${sp.i}`)}
            x="-40"
            y="-46"
            width="80"
            height="80"
            preserveAspectRatio="xMidYMid slice"
            clipPath={`url(#mpc${sp.i})`}
          />
          <rect x="-18" y="-62" width="36" height="14" fill={sp.i % 2 ? 'rgba(150,198,251,.85)' : 'rgba(255,179,207,.85)'} transform="rotate(-5)" />
          <g transform="translate(-9 38) scale(.18)">
            <path d={HEART_D} fill="#ff85b1" />
          </g>
        </g>
      ))}
    </g>
  );
}

/* ───────── Node ───────── */
function MapNode({ node, locked, done, current, onClick }) {
  const { x, y, id } = node;
  const R = current ? 44 : 38;
  const labelLeft = x > W / 2;
  return (
    <g
      className={`map-node ${locked ? 'locked' : ''} ${done ? 'done' : ''} ${current ? 'current' : ''}`}
      transform={`translate(${x} ${y})`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label={`Level ${id}: ${node.name}${locked ? ' (locked)' : done ? ' (completed)' : ''}`}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClick()}
    >
      <motion.g
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 12, delay: 0.15 + id * 0.05 }}
        whileHover={{ scale: locked ? 1.03 : 1.12 }}
        whileTap={{ scale: 0.92 }}
        style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
      >
        {/* pulse rings for current level */}
        {current && (
          <>
            <circle r={R + 6} className="pulse-ring" />
            <circle r={R + 6} className="pulse-ring r2" />
          </>
        )}
        {/* base shadow */}
        <ellipse cx="0" cy={R - 4} rx={R * 0.95} ry={R * 0.35} fill="#000" opacity=".15" />
        {/* 3D stone/button: bottom lip then face */}
        <circle cy="6" r={R} fill={locked ? 'var(--lock-3)' : done ? '#d48a2a' : node.color[1]} filter="url(#softShadow)" />
        <circle r={R} fill={locked ? 'url(#ngLocked)' : done ? 'url(#ngGold)' : `url(#ng${id})`} />
        <circle r={R - 7} fill="var(--node-face)" opacity={locked ? 0.55 : 0.95} />
        <circle r={R - 7} fill="none" stroke={locked ? 'var(--lock-2)' : '#fff'} strokeWidth="2" strokeDasharray={done ? '0' : '3 5'} opacity=".8" />
        <ellipse cx={-R * 0.35} cy={-R * 0.45} rx={R * 0.35} ry={R * 0.2} fill="url(#nodeShine)" transform="rotate(-25)" />
        {/* icon */}
        <g transform="translate(-19 -21)" opacity={locked ? 0.35 : 1} style={{ filter: locked ? 'grayscale(1)' : 'none' }}>
          <LevelIcon name={node.icon} size={38} />
        </g>
        {locked && (
          <g transform="translate(6 4)">
            <circle r="13" fill="var(--surface-solid)" stroke="var(--lock-2)" strokeWidth="2" />
            <g transform="translate(-9 -10)" color="var(--ink-soft)">
              <IconLock size={18} />
            </g>
          </g>
        )}
        {/* number badge */}
        <g transform={`translate(${R * 0.72} ${R * 0.62})`}>
          <circle r="14" fill={locked ? 'var(--lock-2)' : done ? '#f2a93b' : '#ff6f9f'} stroke="#fff" strokeWidth="3" />
          <text textAnchor="middle" dy="5" className="node-num">
            {id}
          </text>
        </g>
        {/* stars for completed */}
        {done && (
          <g transform={`translate(0 ${-R - 8})`}>
            {[-1, 0, 1].map((k) => (
              <motion.g
                key={k}
                initial={{ scale: 0, rotate: -90 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.4 + (k + 1) * 0.12, type: 'spring', stiffness: 400, damping: 10 }}
                style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
              >
                <g transform={`translate(${k * 24 - 12} ${k === 0 ? -16 : -6})`}>
                  <IconStar size={24} />
                </g>
              </motion.g>
            ))}
          </g>
        )}
      </motion.g>
      {/* label */}
      <NodeLabel text={node.name} left={labelLeft} locked={locked} offset={R + 12} />
    </g>
  );
}

function NodeLabel({ text, left, locked, offset }) {
  const w = text.length * 8.6 + 26;
  const x = left ? -offset - w : offset;
  return (
    <g className={`node-label ${locked ? 'locked' : ''}`} transform={`translate(${x} 12)`}>
      <rect width={w} height="30" rx="15" className="node-label-bg" />
      <text x={w / 2} y="20" textAnchor="middle" className="node-label-text">
        {text}
      </text>
    </g>
  );
}

/* ───────── Level detail bottom sheet ───────── */
function LevelSheet({ node, onClose, onPlay, done }) {
  return (
    <AnimatePresence>
      {node && (
        <motion.div className="sheet-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div
            className="level-sheet glass"
            initial={{ y: '110%' }}
            animate={{ y: 0 }}
            exit={{ y: '110%' }}
            transition={{ type: 'spring', stiffness: 260, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label={`Level ${node.id}`}
          >
            <div className="sheet-grip" />
            <div className="sheet-head">
              <motion.div
                className="sheet-icon"
                style={{ background: `linear-gradient(135deg, ${node.color[0]}, ${node.color[1]})` }}
                initial={{ rotate: -20, scale: 0.5 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 12 }}
              >
                <LevelIcon name={node.icon} size={52} />
              </motion.div>
              <div>
                <div className="sheet-kicker">
                  Level {node.id} · {node.theme}
                  {done && <span className="sheet-done">✓ completed</span>}
                </div>
                <h2 className="sheet-title">{node.name}</h2>
              </div>
            </div>
            <p className="sheet-blurb">{node.blurb}</p>
            <div className="sheet-how">
              <b>How to play</b>
              <span>{node.howTo}</span>
            </div>
            <div className="sheet-actions">
              <button className="btn btn-ghost" onClick={onClose}>
                Not yet
              </button>
              <button className="btn" onClick={onPlay}>
                <IconPlay /> {done ? 'Play again' : "Let's play!"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ───────── Scenery ───────── */
function buildScenery(nodes) {
  const rnd = seeded(1402);
  const items = [];
  const nearPath = (x, y) => nodes.some((n) => Math.hypot(n.x - x, n.y - y) < 110) || Math.abs(x - pathXAt(nodes, y)) < 75;
  const kinds = ['pine', 'pine', 'round', 'round', 'bush', 'mushroom', 'flower', 'flower', 'rock', 'lantern'];
  let tries = 0;
  while (items.length < 120 && tries < 3000) {
    tries++;
    const x = 20 + rnd() * (W - 40);
    const y = 300 + rnd() * (H - 320);
    if (nearPath(x, y)) continue;
    if (items.some((it) => Math.hypot(it.x - x, it.y - y) < 46)) continue;
    const kind = kinds[Math.floor(rnd() * kinds.length)];
    items.push({ x, y, kind, s: 0.75 + rnd() * 0.6, flip: rnd() > 0.5, hue: Math.floor(rnd() * 4) });
  }
  // fireflies / sparkles
  const flies = Array.from({ length: 40 }, () => ({ x: rnd() * W, y: 250 + rnd() * (H - 300), d: rnd() * 4, r: 1.5 + rnd() * 2.5 }));
  return { items: items.sort((a, b) => a.y - b.y), flies };
}

function pathXAt(nodes, y) {
  // approximate x of path at height y by linear interpolation between nodes
  for (let i = 0; i < nodes.length - 1; i++) {
    const a = nodes[i];
    const b = nodes[i + 1];
    if (y <= a.y && y >= b.y) {
      const t = (a.y - y) / (a.y - b.y);
      const e = t * t * (3 - 2 * t);
      return a.x + (b.x - a.x) * e;
    }
  }
  return y > nodes[0].y ? nodes[0].x : W / 2;
}

const FLOWER_COLORS = ['#ffb3cf', '#bddcff', '#ffd36e', '#e4c9ff'];

function Scenery({ items }) {
  return (
    <g className="scenery">
      {items.items.map((it, i) => (
        <g key={i} transform={`translate(${it.x} ${it.y}) scale(${it.flip ? -it.s : it.s} ${it.s})`}>
          {it.kind === 'pine' && (
            <g className="sway" style={{ animationDelay: `${-i * 0.37}s` }}>
              <ellipse cy="2" rx="22" ry="6" fill="#000" opacity=".1" />
              <rect x="-4" y="-14" width="8" height="16" rx="3" fill="var(--tree-trunk)" />
              <path d="M0 -78 L24 -36 H14 L30 -12 H-30 L-14 -36 H-24Z" fill="var(--tree-2)" />
              <path d="M0 -78 L24 -36 H14 L30 -12 H0Z" fill="var(--tree-1)" opacity=".55" />
              <circle cx="-8" cy="-40" r="2.5" fill="#fff" opacity=".5" />
            </g>
          )}
          {it.kind === 'round' && (
            <g className="sway" style={{ animationDelay: `${-i * 0.29}s` }}>
              <ellipse cy="2" rx="24" ry="6" fill="#000" opacity=".1" />
              <rect x="-4" y="-24" width="8" height="26" rx="3" fill="var(--tree-trunk)" />
              <circle cy="-42" r="26" fill="var(--tree-2)" />
              <circle cx="-14" cy="-32" r="16" fill="var(--tree-2)" />
              <circle cx="14" cy="-34" r="17" fill="var(--tree-2)" />
              <circle cx="-6" cy="-50" r="14" fill="var(--tree-1)" />
              {it.hue % 2 === 0 && (
                <g fill="#ff8fb8">
                  <circle cx="8" cy="-46" r="3" />
                  <circle cx="-12" cy="-34" r="3" />
                  <circle cx="12" cy="-28" r="3" />
                </g>
              )}
            </g>
          )}
          {it.kind === 'bush' && (
            <g>
              <ellipse cy="2" rx="22" ry="5" fill="#000" opacity=".08" />
              <circle cx="-10" cy="-8" r="11" fill="var(--tree-2)" />
              <circle cx="8" cy="-9" r="13" fill="var(--tree-1)" />
              <circle cx="-2" cy="-16" r="9" fill="var(--tree-1)" />
              <circle cx="4" cy="-14" r="2.5" fill={FLOWER_COLORS[it.hue]} />
              <circle cx="-9" cy="-10" r="2.5" fill={FLOWER_COLORS[(it.hue + 1) % 4]} />
            </g>
          )}
          {it.kind === 'mushroom' && (
            <g>
              <ellipse cy="1" rx="12" ry="3" fill="#000" opacity=".1" />
              <path d="M-5 0 Q-6 -12 -4 -14 H4 Q6 -12 5 0Z" fill="#fff4ea" />
              <path d="M-15 -12 Q-14 -28 0 -28 Q14 -28 15 -12Z" fill={it.hue % 2 ? '#ff8fb8' : '#8ec5ff'} />
              <circle cx="-6" cy="-20" r="2.6" fill="#fff" />
              <circle cx="5" cy="-23" r="2" fill="#fff" />
              <circle cx="8" cy="-16" r="1.7" fill="#fff" />
            </g>
          )}
          {it.kind === 'flower' && (
            <g>
              <path d="M0 0 V-14" stroke="var(--tree-2)" strokeWidth="2" />
              <path d="M0 -6 q6 -4 8 0" fill="var(--tree-1)" />
              {[0, 72, 144, 216, 288].map((a) => (
                <ellipse key={a} cx="0" cy="-20" rx="3.4" ry="5" fill={FLOWER_COLORS[it.hue]} transform={`rotate(${a} 0 -14)`} />
              ))}
              <circle cy="-14" r="2.6" fill="#ffe08a" />
            </g>
          )}
          {it.kind === 'rock' && (
            <g>
              <path d="M-16 0 Q-18 -12 -6 -16 Q8 -20 14 -8 Q18 0 10 2Z" fill="var(--rock-1)" />
              <path d="M-6 -16 Q8 -20 14 -8 Q4 -10 -6 -16Z" fill="var(--rock-2)" />
            </g>
          )}
          {it.kind === 'lantern' && (
            <g>
              <path d="M0 0 V-30" stroke="var(--tree-trunk)" strokeWidth="3" />
              <circle cy="-36" r="14" fill="#ffd36e" className="lantern-glow" />
              <rect x="-6" y="-44" width="12" height="14" rx="4" fill="#ffe7a3" stroke="#d9a13d" strokeWidth="1.5" />
              <path d="M-7 -44 h14" stroke="#d9a13d" strokeWidth="2" />
            </g>
          )}
        </g>
      ))}
      <g className="fireflies">
        {items.flies.map((f, i) => (
          <circle key={i} cx={f.x} cy={f.y} r={f.r} className="firefly" style={{ animationDelay: `${-f.d}s` }} />
        ))}
      </g>
    </g>
  );
}

function River() {
  return (
    <g className="river" opacity=".9">
      <path
        d={`M-20 1540 C120 1500 160 1620 300 1590 S520 1500 640 1560 L640 1610 C520 1560 440 1650 300 1650 S100 1560 -20 1600Z`}
        fill="var(--water-1)"
      />
      <path d="M40 1572 q30 -10 60 0 M380 1600 q30 -10 60 0 M220 1615 q20 -8 40 0" stroke="#fff" strokeWidth="3" strokeLinecap="round" fill="none" opacity=".7" className="ripple" />
    </g>
  );
}

function Castle({ allDone }) {
  return (
    <g transform={`translate(${W / 2} 200)`} className={`castle ${allDone ? 'lit' : ''}`}>
      {/* glow */}
      <circle r="150" fill="url(#nodeShine)" opacity={allDone ? 0.9 : 0.4} />
      {/* clouds under */}
      <g fill="var(--cloud-fill)">
        <circle cx="-110" cy="40" r="34" />
        <circle cx="-70" cy="52" r="30" />
        <circle cx="110" cy="40" r="34" />
        <circle cx="70" cy="52" r="30" />
        <ellipse cx="0" cy="58" rx="120" ry="24" />
      </g>
      {/* towers */}
      <rect x="-80" y="-60" width="34" height="100" rx="6" fill="var(--castle-1)" />
      <rect x="46" y="-60" width="34" height="100" rx="6" fill="var(--castle-1)" />
      <path d="M-86 -60 L-63 -100 L-40 -60Z" fill="#ff8fb8" />
      <path d="M40 -60 L63 -100 L86 -60Z" fill="#8ec5ff" />
      <rect x="-50" y="-30" width="100" height="72" rx="6" fill="var(--castle-2)" />
      <path d="M-56 -30 L0 -92 L56 -30Z" fill="#ffb3cf" />
      <path d="M0 -92 V-120" stroke="var(--castle-1)" strokeWidth="3" />
      <path d="M0 -120 l22 7 -22 7z" fill="#ff6f9f" />
      {/* heart window + door */}
      <g transform="translate(-14 -22) scale(.28)">
        <path d={HEART_D} fill={allDone ? '#ff6f9f' : '#ffd36e'} className="castle-heart" />
      </g>
      <path d="M-16 42 V18 a16 16 0 0 1 32 0 V42Z" fill="var(--castle-door)" />
      <rect x="-70" y="-40" width="14" height="18" rx="7" fill="#ffd36e" opacity=".85" />
      <rect x="56" y="-40" width="14" height="18" rx="7" fill="#ffd36e" opacity=".85" />
      {/* her waiting at the castle */}
      <g transform="translate(70 -6)">
        <HerChibi size={44} wave />
      </g>
      <text y="96" textAnchor="middle" className="castle-label">
        {allDone ? 'You made it to my heart 💗' : 'Happily Ever After'}
      </text>
      <g transform="translate(-16 -170)" className="castle-float">
        <Heart size={32} fill="#ff6f9f" />
      </g>
    </g>
  );
}
