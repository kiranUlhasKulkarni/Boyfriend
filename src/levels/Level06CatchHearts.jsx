import { useEffect, useRef, useState } from 'react';
import { Stage, GameHud, HudPill, TimerBar } from './kit.jsx';
import { useGameLoop, useTimer } from '../hooks/useGameLoop';
import { sound } from '../audio/soundManager';
import { Heart, HEART_D } from '../components/Icons';
import './Level06CatchHearts.css';

/* ───────── Tunables ───────── */
const GOAL = 30; // points to win
const MAX_STRIKES = 3; // bad catches before failing
const TIME_LIMIT = 60; // gentle safety timer (seconds)
const SPAWN_START = 0.8; // seconds between spawns at the start…
const SPAWN_END = 0.42; // …and at full difficulty
const FALL_START = 0.26; // fall speed as a fraction of stage height / second
const FALL_END = 0.5;
const BAD_START = 0.14; // chance an item is bad at start…
const BAD_END = 0.3; // …and at full difficulty
const GOLD_CHANCE = 0.07; // golden heart (+3)
const LETTER_CHANCE = 0.13; // love letter (+2)
const COMBO_WINDOW = 1.6; // seconds between catches to keep the combo going
const START_DELAY = 1.1; // "Catch my love!" flourish before items fall

const PASTELS = ['#ff8fb8', '#ffb3cf', '#96c6fb', '#c9b5ff', '#ffa98f', '#8fe0c0'];
const HEART = typeof Path2D !== 'undefined' ? new Path2D(HEART_D) : null;
const rand = (a, b) => a + Math.random() * (b - a);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const isDark = () => document.documentElement.dataset.theme === 'dark';

/* ───────── Drawing helpers (all in CSS-pixel world units) ───────── */
function heartAt(ctx, x, y, size) {
  ctx.save();
  ctx.translate(x - size / 2, y - size / 2);
  ctx.scale(size / 100, size / 100);
}

function drawHeart(ctx, x, y, size, color, rot = 0, glow = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  heartAt(ctx, 0, 0, size);
  if (glow) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 30;
  }
  const g = ctx.createRadialGradient(35, 30, 4, 50, 50, 70);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.3, color);
  g.addColorStop(1, color);
  ctx.fillStyle = g;
  ctx.fill(HEART);
  ctx.shadowBlur = 0;
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.stroke(HEART);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath();
  ctx.ellipse(28, 26, 10, 6, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.restore();
}

function drawSparkle(ctx, x, y, r, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.quadraticCurveTo(0, 0, 0, r);
  ctx.quadraticCurveTo(0, 0, -r, 0);
  ctx.quadraticCurveTo(0, 0, 0, -r);
  ctx.fill();
  ctx.restore();
}

function drawGold(ctx, it, t) {
  drawHeart(ctx, it.x, it.y, it.size, '#ffcf4d', it.rot, true);
  for (let i = 0; i < 3; i++) {
    const a = t * 2.5 + (i * Math.PI * 2) / 3;
    const tw = 0.5 + 0.5 * Math.sin(t * 8 + i);
    drawSparkle(ctx, it.x + Math.cos(a) * it.size * 0.7, it.y + Math.sin(a) * it.size * 0.6, it.size * 0.14 * (0.6 + tw), '#fff6c2');
  }
}

function drawLetter(ctx, it) {
  const w = it.size * 1.15;
  const h = it.size * 0.78;
  ctx.save();
  ctx.translate(it.x, it.y);
  ctx.rotate(it.rot);
  ctx.shadowColor = 'rgba(160,80,120,0.3)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = '#fffaf2';
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, w * 0.1);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = '#e9a6c2';
  ctx.lineWidth = Math.max(1.5, w * 0.04);
  ctx.stroke();
  // flap
  ctx.beginPath();
  ctx.moveTo(-w / 2 + 2, -h / 2 + 2);
  ctx.lineTo(0, h * 0.12);
  ctx.lineTo(w / 2 - 2, -h / 2 + 2);
  ctx.strokeStyle = '#e9a6c2';
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-w / 2 + 2, h / 2 - 2);
  ctx.lineTo(-w * 0.12, 0);
  ctx.moveTo(w / 2 - 2, h / 2 - 2);
  ctx.lineTo(w * 0.12, 0);
  ctx.strokeStyle = 'rgba(233,166,194,0.6)';
  ctx.stroke();
  ctx.restore();
  // heart seal
  drawHeart(ctx, it.x + Math.sin(it.rot) * -h * 0.1, it.y + h * 0.1, it.size * 0.4, '#f2629a', it.rot);
}

function drawBroken(ctx, it, dark) {
  const s = it.size;
  const col = dark ? '#8d7aa8' : '#9a8aa6';
  // zigzag crack in heart box coords
  const zig = [
    [50, 10],
    [42, 30],
    [56, 45],
    [44, 62],
    [54, 76],
    [50, 92],
  ];
  const half = (side) => {
    ctx.save();
    ctx.translate(it.x + side * s * 0.06, it.y);
    ctx.rotate(it.rot + side * 0.12);
    ctx.translate(-s / 2, -s / 2);
    ctx.scale(s / 100, s / 100);
    ctx.beginPath();
    ctx.moveTo(side < 0 ? -5 : 105, 0);
    zig.forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.lineTo(side < 0 ? -5 : 105, 100);
    ctx.closePath();
    ctx.clip();
    const g = ctx.createLinearGradient(0, 0, 100, 100);
    g.addColorStop(0, '#c6b8d4');
    g.addColorStop(1, col);
    ctx.fillStyle = g;
    ctx.fill(HEART);
    ctx.strokeStyle = '#6d5a80';
    ctx.lineWidth = 5;
    ctx.stroke(HEART);
    ctx.beginPath();
    zig.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
    ctx.restore();
  };
  half(-1);
  half(1);
  // sad face
  ctx.save();
  ctx.fillStyle = '#4a3a5a';
  ctx.beginPath();
  ctx.arc(it.x - s * 0.17, it.y - s * 0.02, s * 0.045, 0, Math.PI * 2);
  ctx.arc(it.x + s * 0.17, it.y - s * 0.02, s * 0.045, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawStorm(ctx, it, t) {
  const s = it.size;
  ctx.save();
  ctx.translate(it.x, it.y);
  // lightning
  if (Math.sin(t * 9 + it.seed) > -0.2) {
    ctx.fillStyle = '#ffe066';
    ctx.strokeStyle = '#e0a020';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-s * 0.02, s * 0.15);
    ctx.lineTo(-s * 0.16, s * 0.5);
    ctx.lineTo(-s * 0.03, s * 0.46);
    ctx.lineTo(-s * 0.1, s * 0.75);
    ctx.lineTo(s * 0.14, s * 0.36);
    ctx.lineTo(s * 0.02, s * 0.4);
    ctx.lineTo(s * 0.1, s * 0.15);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  // cloud body
  const g = ctx.createLinearGradient(0, -s * 0.4, 0, s * 0.3);
  g.addColorStop(0, '#a9a3bd');
  g.addColorStop(1, '#6f6889');
  ctx.fillStyle = g;
  ctx.beginPath();
  [
    [-s * 0.28, s * 0.05, s * 0.22],
    [0, -s * 0.12, s * 0.3],
    [s * 0.3, s * 0.03, s * 0.24],
  ].forEach(([cx, cy, r]) => {
    ctx.moveTo(cx + r, cy);
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
  });
  ctx.rect(-s * 0.28, 0, s * 0.58, s * 0.27);
  ctx.fill();
  // grumpy face
  ctx.strokeStyle = '#2f2840';
  ctx.lineWidth = Math.max(1.5, s * 0.05);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-s * 0.2, -s * 0.06);
  ctx.lineTo(-s * 0.08, -s * 0.01);
  ctx.moveTo(s * 0.2, -s * 0.06);
  ctx.lineTo(s * 0.08, -s * 0.01);
  ctx.moveTo(-s * 0.08, s * 0.16);
  ctx.quadraticCurveTo(0, s * 0.08, s * 0.08, s * 0.16);
  ctx.stroke();
  ctx.restore();
}

function drawBasket(ctx, b, unit, dark) {
  const w = 120 * unit;
  const h = 62 * unit;
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(b.tilt);
  ctx.scale(1 + b.squash * 0.18, 1 - b.squash * 0.22);
  // shadow
  ctx.fillStyle = 'rgba(80,40,60,0.18)';
  ctx.beginPath();
  ctx.ellipse(0, h + 6 * unit, w * 0.45, 7 * unit, 0, 0, Math.PI * 2);
  ctx.fill();
  // body (tapered)
  const body = new Path2D();
  body.moveTo(-w / 2, 0);
  body.lineTo(w / 2, 0);
  body.lineTo(w * 0.4, h * 0.9);
  body.quadraticCurveTo(w * 0.38, h, w * 0.3, h);
  body.lineTo(-w * 0.3, h);
  body.quadraticCurveTo(-w * 0.38, h, -w * 0.4, h * 0.9);
  body.closePath();
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, dark ? '#c99569' : '#e7b47f');
  g.addColorStop(1, dark ? '#8a5a3a' : '#b97a48');
  ctx.fillStyle = g;
  ctx.fill(body);
  ctx.save();
  ctx.clip(body);
  // wicker weave: alternating rounded "bricks"
  const rows = 5;
  const rh = h / rows;
  const cw = 18 * unit;
  for (let r = 0; r < rows; r++) {
    const y = r * rh;
    const off = r % 2 ? cw / 2 : 0;
    for (let x = -w / 2 - cw + off; x < w / 2 + cw; x += cw) {
      ctx.fillStyle = 'rgba(255,230,190,0.28)';
      ctx.beginPath();
      ctx.ellipse(x + cw / 2, y + rh / 2, cw * 0.46, rh * 0.36, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(110,60,25,0.45)';
      ctx.lineWidth = 1.2 * unit;
      ctx.stroke();
    }
  }
  // vertical stakes
  ctx.strokeStyle = 'rgba(110,60,25,0.35)';
  ctx.lineWidth = 2 * unit;
  for (let x = -w / 2; x <= w / 2; x += cw) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x * 0.8, h);
    ctx.stroke();
  }
  ctx.restore();
  // rim
  const rimG = ctx.createLinearGradient(0, -8 * unit, 0, 8 * unit);
  rimG.addColorStop(0, '#f6d0a0');
  rimG.addColorStop(1, '#a8693a');
  ctx.fillStyle = rimG;
  ctx.beginPath();
  ctx.roundRect(-w / 2 - 6 * unit, -8 * unit, w + 12 * unit, 15 * unit, 8 * unit);
  ctx.fill();
  ctx.strokeStyle = 'rgba(110,60,25,0.5)';
  ctx.lineWidth = 1.5 * unit;
  for (let x = -w / 2; x < w / 2 + 6 * unit; x += 9 * unit) {
    ctx.beginPath();
    ctx.moveTo(x, -7 * unit);
    ctx.lineTo(x + 6 * unit, 6 * unit);
    ctx.stroke();
  }
  // face
  const fy = h * 0.55;
  ctx.fillStyle = '#4a2a1a';
  ctx.beginPath();
  ctx.ellipse(-w * 0.13, fy, 3.6 * unit, 4.6 * unit, 0, 0, Math.PI * 2);
  ctx.ellipse(w * 0.13, fy, 3.6 * unit, 4.6 * unit, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(-w * 0.13 + 1.2 * unit, fy - 1.6 * unit, 1.3 * unit, 0, Math.PI * 2);
  ctx.arc(w * 0.13 + 1.2 * unit, fy - 1.6 * unit, 1.3 * unit, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#4a2a1a';
  ctx.lineWidth = 2.2 * unit;
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (b.sad > 0) ctx.arc(0, fy + 10 * unit, 5 * unit, Math.PI * 1.15, Math.PI * 1.85);
  else ctx.arc(0, fy + 2 * unit, 5 * unit, Math.PI * 0.15, Math.PI * 0.85);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,120,160,0.5)';
  ctx.beginPath();
  ctx.ellipse(-w * 0.23, fy + 5 * unit, 6 * unit, 3.4 * unit, 0, 0, Math.PI * 2);
  ctx.ellipse(w * 0.23, fy + 5 * unit, 6 * unit, 3.4 * unit, 0, 0, Math.PI * 2);
  ctx.fill();
  // pink bow on the rim (left side)
  ctx.save();
  ctx.translate(-w * 0.32, 0);
  ctx.scale(1.45, 1.45);
  ctx.fillStyle = '#ff7fb0';
  ctx.strokeStyle = '#d94f86';
  ctx.lineWidth = 1.5 * unit;
  const loop = (dir) => {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(dir * 16 * unit, -14 * unit, dir * 20 * unit, 8 * unit, 0, 0);
    ctx.fill();
    ctx.stroke();
  };
  loop(-1);
  loop(1);
  ctx.beginPath();
  ctx.moveTo(-2 * unit, 2 * unit);
  ctx.lineTo(-8 * unit, 16 * unit);
  ctx.lineTo(-3 * unit, 14 * unit);
  ctx.moveTo(2 * unit, 2 * unit);
  ctx.lineTo(8 * unit, 16 * unit);
  ctx.lineTo(3 * unit, 14 * unit);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 4 * unit, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  ctx.restore();
}

function makeScene(W, H) {
  return {
    clouds: Array.from({ length: 5 }, (_, i) => ({ x: rand(0, W), y: rand(H * 0.05, H * 0.55), s: rand(0.6, 1.3), v: rand(6, 16), i })),
    stars: Array.from({ length: 70 }, () => ({ x: rand(0, W), y: rand(0, H * 0.8), r: rand(0.6, 1.8), p: rand(0, 6) })),
  };
}

function drawBackground(ctx, W, H, scene, t, dark) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  if (dark) {
    g.addColorStop(0, '#141233');
    g.addColorStop(0.6, '#2b2152');
    g.addColorStop(1, '#4a2d5e');
  } else {
    g.addColorStop(0, '#bfe0ff');
    g.addColorStop(0.55, '#e6e8ff');
    g.addColorStop(1, '#ffe0ec');
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  if (dark) {
    scene.stars.forEach((s) => {
      ctx.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(t * 1.3 + s.p));
      ctx.fillStyle = '#fff8e0';
      ctx.beginPath();
      ctx.arc(s.x % W, s.y % H, s.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    // crescent moon
    const mx = W * 0.82;
    const my = H * 0.14;
    const mr = Math.min(W, H) * 0.07;
    ctx.save();
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#fff2c4';
    ctx.fill();
    ctx.fillStyle = g; // carve the crescent with the sky itself
    ctx.beginPath();
    ctx.arc(mx + mr * 0.45, my - mr * 0.25, mr * 0.85, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    const glow = ctx.createRadialGradient(mx, my, mr * 0.5, mx, my, mr * 3);
    glow.addColorStop(0, 'rgba(255,242,184,0.3)');
    glow.addColorStop(1, 'rgba(255,242,184,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(mx - mr * 3, my - mr * 3, mr * 6, mr * 6);
  } else {
    // rainbow
    const rx = W * 0.5;
    const ry = H * 1.02;
    const rr = Math.max(W, H) * 0.62;
    const bands = ['#ffb3c7', '#ffd6a5', '#fff3b0', '#c8f0c8', '#bde0ff', '#d6c8ff'];
    ctx.globalAlpha = 0.42;
    ctx.lineWidth = rr * 0.045;
    bands.forEach((c, i) => {
      ctx.strokeStyle = c;
      ctx.beginPath();
      ctx.arc(rx, ry, rr - i * ctx.lineWidth, Math.PI, Math.PI * 2);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
    // sun glow
    const sg = ctx.createRadialGradient(W * 0.15, H * 0.1, 0, W * 0.15, H * 0.1, Math.min(W, H) * 0.3);
    sg.addColorStop(0, 'rgba(255,250,220,0.9)');
    sg.addColorStop(1, 'rgba(255,250,220,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(0, 0, W, H);
  }
  // soft clouds drifting
  scene.clouds.forEach((c) => {
    const x = ((c.x + t * c.v) % (W + 200)) - 100;
    const s = c.s * Math.min(W, H) * 0.09;
    ctx.fillStyle = dark ? 'rgba(160,150,210,0.16)' : 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.arc(x, c.y, s, 0, Math.PI * 2);
    ctx.arc(x + s * 0.9, c.y - s * 0.35, s * 0.85, 0, Math.PI * 2);
    ctx.arc(x + s * 1.8, c.y, s * 0.75, 0, Math.PI * 2);
    ctx.arc(x + s * 0.9, c.y + s * 0.25, s * 0.8, 0, Math.PI * 2);
    ctx.fill();
  });
}

export default function Level06CatchHearts({ onWin, onFail }) {
  const shakerRef = useRef(null);
  const canvasRef = useRef(null);
  const [running, setRunning] = useState(true);
  const [score, setScore] = useState(0);
  const [strikes, setStrikes] = useState(0);
  const ended = useRef(false);

  const g = useRef(null);
  if (!g.current) {
    g.current = {
      W: 400,
      H: 600,
      dpr: 1,
      unit: 1,
      t: 0,
      basket: { x: 200, y: 520, vx: 0, target: 200, tilt: 0, squash: 0, sad: 0 },
      keys: { left: false, right: false },
      items: [],
      particles: [],
      floats: [],
      spawnIn: START_DELAY,
      score: 0,
      strikes: 0,
      combo: 0,
      lastCatch: -10,
      flash: 0,
      scene: makeScene(400, 600),
    };
  }

  const end = (won, reason) => {
    if (ended.current) return;
    ended.current = true;
    setRunning(false);
    if (won) onWin();
    else onFail(reason);
  };

  const [timeLeft] = useTimer(TIME_LIMIT, running, () => end(false, 'time'));

  // canvas sizing — draw adaptively in CSS pixels
  useEffect(() => {
    const canvas = canvasRef.current;
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const s = g.current;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const first = s.W === 400 && s.H === 600;
      const oldW = s.W;
      s.W = Math.max(1, r.width);
      s.H = Math.max(1, r.height);
      s.dpr = dpr;
      s.unit = clamp(Math.min(s.W, s.H * 0.8) / 450, 0.7, 1.25);
      canvas.width = Math.round(s.W * dpr);
      canvas.height = Math.round(s.H * dpr);
      s.basket.y = s.H - 92 * s.unit;
      const k = first ? 0.5 : s.basket.x / oldW;
      s.basket.x = s.basket.target = s.W * (first ? 0.5 : k);
      s.scene = makeScene(s.W, s.H);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  // keyboard
  useEffect(() => {
    const set = (e, v) => {
      const k = e.key.toLowerCase();
      if (k === 'arrowleft' || k === 'a') g.current.keys.left = v;
      else if (k === 'arrowright' || k === 'd') g.current.keys.right = v;
      else return;
      e.preventDefault();
    };
    const down = (e) => set(e, true);
    const up = (e) => set(e, false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  // pointer
  const dragging = useRef(false);
  const pointerTo = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    g.current.basket.target = clamp(e.clientX - r.left, 0, r.width);
  };
  const onPointerDown = (e) => {
    dragging.current = true;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    pointerTo(e);
  };
  const onPointerMove = (e) => {
    if (dragging.current || e.pointerType === 'mouse') pointerTo(e);
  };
  const onPointerUp = () => {
    dragging.current = false;
  };

  const spawn = (s) => {
    const d = clamp(s.t / 55 + s.score / 60, 0, 1);
    const r = Math.random();
    const bad = lerp(BAD_START, BAD_END, d);
    let kind;
    if (r < bad) kind = Math.random() < 0.55 ? 'broken' : 'storm';
    else if (r < bad + GOLD_CHANCE) kind = 'gold';
    else if (r < bad + GOLD_CHANCE + LETTER_CHANCE) kind = 'letter';
    else kind = 'heart';
    const size = (kind === 'storm' ? 58 : kind === 'gold' ? 44 : 40) * s.unit * rand(0.92, 1.1);
    s.items.push({
      kind,
      x: rand(size, s.W - size),
      y: -size,
      size,
      vy: s.H * lerp(FALL_START, FALL_END, d) * rand(0.85, 1.15) * (kind === 'gold' ? 1.15 : 1),
      sway: rand(0, Math.PI * 2),
      swayAmp: rand(8, 26) * s.unit * (kind === 'letter' ? 1.8 : 1),
      rot: 0,
      seed: Math.random() * 10,
      color: PASTELS[Math.floor(Math.random() * PASTELS.length)],
    });
    s.spawnIn = lerp(SPAWN_START, SPAWN_END, d) * rand(0.75, 1.25);
  };

  const pop = (s, x, y, color, n = 10) => {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const v = rand(80, 240) * s.unit;
      s.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120 * s.unit, life: 1, size: rand(6, 13) * s.unit, color, heart: Math.random() < 0.6 });
    }
  };

  useGameLoop((dt) => {
    const s = g.current;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    s.t += dt;
    const dark = isDark();
    const b = s.basket;

    // input → target
    const kdir = (s.keys.right ? 1 : 0) - (s.keys.left ? 1 : 0);
    if (kdir) b.target = clamp(b.target + kdir * s.W * 1.1 * dt, 0, s.W);
    const halfW = 63 * s.unit;
    b.target = clamp(b.target, halfW, s.W - halfW);
    const prevX = b.x;
    b.x += (b.target - b.x) * Math.min(1, dt * 14);
    b.vx = (b.x - prevX) / Math.max(dt, 0.001);
    b.tilt += (clamp(b.vx * 0.0006, -0.3, 0.3) - b.tilt) * Math.min(1, dt * 10);
    b.squash = Math.max(0, b.squash - dt * 4);
    b.sad = Math.max(0, b.sad - dt);
    s.flash = Math.max(0, s.flash - dt * 2.5);

    // spawning
    if (!ended.current) {
      s.spawnIn -= dt;
      if (s.spawnIn <= 0) spawn(s);
    }

    // items
    const rimY = b.y - 6 * s.unit;
    for (let i = s.items.length - 1; i >= 0; i--) {
      const it = s.items[i];
      const prevY = it.y;
      it.y += it.vy * dt;
      it.sway += dt * 2.2;
      it.x += Math.cos(it.sway) * it.swayAmp * dt;
      it.rot = Math.sin(it.sway) * (it.kind === 'letter' ? 0.35 : 0.18);
      const bottom = it.y + it.size * 0.35;
      const prevBottom = prevY + it.size * 0.35;
      if (!ended.current && prevBottom <= rimY + 10 * s.unit && bottom >= rimY && Math.abs(it.x - b.x) < halfW + it.size * 0.15) {
        s.items.splice(i, 1);
        if (it.kind === 'broken' || it.kind === 'storm') {
          s.strikes += 1;
          s.combo = 0;
          s.flash = 1;
          b.sad = 1.2;
          b.squash = 0.8;
          sound.sfx.bad();
          pop(s, it.x, rimY, '#9a8aa6', 8);
          s.floats.push({ x: it.x, y: rimY - 20, text: 'ouch!', color: '#8d6fb5', life: 1 });
          setStrikes(s.strikes);
          shakerRef.current?.animate?.(
            [
              { transform: 'translate(0,0)' },
              { transform: 'translate(-8px,4px)' },
              { transform: 'translate(7px,-5px)' },
              { transform: 'translate(-5px,-2px)' },
              { transform: 'translate(4px,4px)' },
              { transform: 'translate(0,0)' },
            ],
            { duration: 380, easing: 'ease-out' }
          );
          if (s.strikes >= MAX_STRIKES) end(false, 'broken');
        } else {
          const pts = it.kind === 'gold' ? 3 : it.kind === 'letter' ? 2 : 1;
          s.combo = s.t - s.lastCatch < COMBO_WINDOW ? s.combo + 1 : 0;
          s.lastCatch = s.t;
          s.score += pts;
          b.squash = 1;
          sound.sfx.pop(1 + Math.min(s.combo, 10) * 0.07);
          if (it.kind === 'gold') sound.sfx.sparkle();
          if (it.kind === 'letter') sound.sfx.kiss();
          const col = it.kind === 'gold' ? '#ffcf4d' : it.kind === 'letter' ? '#ff8fb8' : it.color;
          pop(s, it.x, rimY, col, it.kind === 'gold' ? 18 : 10);
          s.floats.push({ x: it.x, y: rimY - 20, text: `+${pts}${s.combo >= 3 ? ` x${s.combo + 1}` : ''}`, color: col, life: 1 });
          setScore(Math.min(GOAL, s.score));
          if (s.score >= GOAL) end(true);
        }
        continue;
      }
      if (it.y - it.size > s.H) {
        s.items.splice(i, 1);
        if (it.kind !== 'broken' && it.kind !== 'storm') s.combo = 0;
      }
    }

    // particles + floats
    s.particles = s.particles.filter((p) => {
      p.life -= dt * 1.4;
      p.vy += 500 * s.unit * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      return p.life > 0;
    });
    s.floats = s.floats.filter((f) => {
      f.life -= dt * 1.1;
      f.y -= 60 * s.unit * dt;
      return f.life > 0;
    });

    // ───── draw ─────
    ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
    drawBackground(ctx, s.W, s.H, s.scene, s.t, dark);

    s.items.forEach((it) => {
      if (it.kind === 'heart') drawHeart(ctx, it.x, it.y, it.size, it.color, it.rot, dark);
      else if (it.kind === 'gold') drawGold(ctx, it, s.t);
      else if (it.kind === 'letter') drawLetter(ctx, it);
      else if (it.kind === 'broken') drawBroken(ctx, it, dark);
      else drawStorm(ctx, it, s.t);
    });

    drawBasket(ctx, b, s.unit, dark);

    s.particles.forEach((p) => {
      ctx.globalAlpha = Math.max(0, p.life);
      if (p.heart) drawHeart(ctx, p.x, p.y, p.size * 1.4, p.color, 0, false);
      else drawSparkle(ctx, p.x, p.y, p.size * 0.6, p.color);
    });
    ctx.globalAlpha = 1;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    s.floats.forEach((f) => {
      ctx.globalAlpha = Math.min(1, f.life * 1.5);
      ctx.font = `700 ${Math.round(26 * s.unit)}px Fredoka, Quicksand, sans-serif`;
      ctx.lineWidth = 5 * s.unit;
      ctx.strokeStyle = dark ? '#2a2245' : '#fff';
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    });
    ctx.globalAlpha = 1;

    // intro flourish
    if (s.t < START_DELAY + 0.4) {
      const k = clamp(1 - (s.t - START_DELAY + 0.4) / 0.4, 0, 1);
      ctx.globalAlpha = Math.min(1, s.t * 4) * k;
      ctx.font = `${Math.round(54 * s.unit)}px Caveat, 'Segoe Script', cursive`;
      ctx.fillStyle = dark ? '#ffd1e6' : '#f2629a';
      ctx.fillText('Catch my love!', s.W / 2, s.H * 0.42 - Math.sin(s.t * 3) * 6);
      ctx.globalAlpha = 1;
    }

    // red vignette on bad catch
    if (s.flash > 0) {
      const v = ctx.createRadialGradient(s.W / 2, s.H / 2, Math.min(s.W, s.H) * 0.3, s.W / 2, s.H / 2, Math.max(s.W, s.H) * 0.75);
      v.addColorStop(0, 'rgba(255,80,110,0)');
      v.addColorStop(1, `rgba(255,80,110,${0.45 * s.flash})`);
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, s.W, s.H);
    }
  }, running);

  return (
    <Stage className="l06-stage">
      <div ref={shakerRef} className="l06-shaker">
        <canvas
          ref={canvasRef}
          className="l06-canvas"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      </div>
      <GameHud>
        <HudPill icon={<Heart size={18} fill="#ff7fb0" />} label="love" value={`${score}/${GOAL}`} />
        <div className="hud-chip l06-lives" aria-label={`${MAX_STRIKES - strikes} hearts left`}>
          {Array.from({ length: MAX_STRIKES }, (_, i) => (
            <Heart key={i} size={18} fill={i < MAX_STRIKES - strikes ? '#ff6f9f' : '#b9a2b7'} shine={i < MAX_STRIKES - strikes} />
          ))}
        </div>
        <TimerBar left={timeLeft} total={TIME_LIMIT} />
      </GameHud>
    </Stage>
  );
}
