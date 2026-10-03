/**
 * Level 8 — "Boba Tower"
 * A 2D side-view stacking game. A boba-cup layer slides back and forth above
 * the tower; tap / click / Space drops it. Whatever hangs over the layer
 * below is sliced off and tumbles away. Stack 12 layers to win.
 */
import { useEffect, useRef, useState } from 'react';
import { Stage, GameHud, HudPill } from './kit.jsx';
import { useGameLoop } from '../hooks/useGameLoop';
import { sound } from '../audio/soundManager';
import { HEART_D } from '../components/Icons';
import './Level08BobaStack.css';

// ───────────── Tunables ─────────────
const GOAL = 12; // layers to stack
const LAYER_H = 34; // height of one cup segment (logical px)
const BASE_W = 190; // width of the big cup bottom
const START_W = 172; // width of the first sliding layer
const PERFECT_TOL = 5; // |centre offset| <= this counts as a perfect drop (snaps)
const COMBO_GROW = 10; // from the 2nd perfect in a row, the layer grows back by this much
const BASE_SPEED = 125; // slide speed of the first layer (px/s)
const SPEED_STEP = 10; // added per stacked layer
const DROP_LOCK = 0.22; // seconds between drops (prevents accidental double taps)
const GRAVITY = 1500; // for sliced-off pieces
const MIN_W = 380; // minimum logical viewport width
const MIN_H = 640; // minimum logical viewport height

const FLAVORS = [
  { name: 'taro', top: '#d6b8f0', bot: '#a983d6', rim: '#7b58ad' },
  { name: 'strawberry', top: '#ffd0e0', bot: '#ff98bb', rim: '#d9628d' },
  { name: 'matcha', top: '#cfeab5', bot: '#90c877', rim: '#5a9348' },
  { name: 'brown sugar', top: '#f1d1ad', bot: '#c98b5a', rim: '#87542f' },
  { name: 'mango', top: '#ffe7a3', bot: '#ffbf47', rim: '#cf8b22' },
  { name: 'blueberry', top: '#cbd9ff', bot: '#8ba8f0', rim: '#5571c4' },
];

const HEART_PATH = typeof Path2D !== 'undefined' ? new Path2D(HEART_D) : null;
const isDark = () => document.documentElement.dataset.theme === 'dark';
const rand = (a, b) => a + Math.random() * (b - a);

/** Canvas that fills its box; logical size grows on the long axis (min MIN_W×MIN_H). */
function useFitCanvas(minW, minH) {
  const canvasRef = useRef(null);
  const view = useRef({ w: minW, h: minH, scale: 1 });
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const resize = () => {
      const r = c.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      c.width = Math.round(r.width * dpr);
      c.height = Math.round(r.height * dpr);
      const s = Math.min(r.width / minW, r.height / minH);
      view.current = { w: r.width / s, h: r.height / s, scale: s * dpr };
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(c);
    return () => ro.disconnect();
  }, [minW, minH]);
  return { canvasRef, view };
}

function rr(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawHeart(ctx, x, y, size, fill) {
  if (!HEART_PATH) return;
  ctx.save();
  ctx.translate(x - size / 2, y - size / 2);
  ctx.scale(size / 100, size / 100);
  ctx.fillStyle = fill;
  ctx.fill(HEART_PATH);
  ctx.restore();
}

function drawPearl(ctx, x, y, r) {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
  g.addColorStop(0, '#7a5240');
  g.addColorStop(0.6, '#3b2219');
  g.addColorStop(1, '#24130d');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.arc(x - r * 0.35, y - r * 0.38, r * 0.28, 0, Math.PI * 2);
  ctx.fill();
}

function drawFace(ctx, cx, cy, t, seed) {
  const blink = Math.sin(t * 1.3 + seed * 7) > 0.97;
  ctx.fillStyle = '#3a2230';
  if (blink) {
    ctx.strokeStyle = '#3a2230';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 11, cy);
    ctx.lineTo(cx - 5, cy);
    ctx.moveTo(cx + 5, cy);
    ctx.lineTo(cx + 11, cy);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.ellipse(cx - 8, cy, 2.6, 3.3, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + 8, cy, 2.6, 3.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(cx - 7.2, cy - 1.2, 1, 0, Math.PI * 2);
    ctx.arc(cx + 8.8, cy - 1.2, 1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,120,160,0.55)';
  ctx.beginPath();
  ctx.ellipse(cx - 14, cy + 5, 4, 2.3, 0, 0, Math.PI * 2);
  ctx.ellipse(cx + 14, cy + 5, 4, 2.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#3a2230';
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx - 2, cy + 3, 2.2, 0.1, Math.PI - 0.1);
  ctx.arc(cx + 2, cy + 3, 2.2, 0.1, Math.PI - 0.1);
  ctx.stroke();
}

/** One cup segment, drawn with its bottom-left origin at (0,0) of `p.ox` (y up = negative). */
function drawSegment(ctx, p, t) {
  const f = FLAVORS[p.flavor];
  const { l, r } = p;
  const w = r - l;
  if (w <= 0.5) return;
  ctx.save();
  rr(ctx, l, -LAYER_H, w, LAYER_H, 5);
  const g = ctx.createLinearGradient(0, -LAYER_H, 0, 0);
  g.addColorStop(0, f.top);
  g.addColorStop(1, f.bot);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.clip();
  // milky swirl
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let x = l - 10; x <= r + 10; x += 6) {
    const y = -LAYER_H * 0.62 + Math.sin(x * 0.09 + p.seed * 5) * 3;
    if (x === l - 10) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  // pearls
  for (const pr of p.pearls) drawPearl(ctx, pr.dx, -pr.dy, pr.r);
  // right-side shade + glossy highlight
  const sh = ctx.createLinearGradient(l, 0, r, 0);
  sh.addColorStop(0, 'rgba(255,255,255,0.18)');
  sh.addColorStop(0.7, 'rgba(255,255,255,0)');
  sh.addColorStop(1, 'rgba(60,20,50,0.18)');
  ctx.fillStyle = sh;
  ctx.fillRect(l, -LAYER_H, w, LAYER_H);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  rr(ctx, l + 7, -LAYER_H + 7, 5, LAYER_H - 13, 3);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  rr(ctx, l + 15, -LAYER_H + 8, 2.5, LAYER_H - 16, 2);
  ctx.fill();
  ctx.restore();
  // rim + outline
  ctx.strokeStyle = f.rim;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 2;
  rr(ctx, l, -LAYER_H, w, LAYER_H, 5);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(l + 3, -LAYER_H + 2);
  ctx.lineTo(r - 3, -LAYER_H + 2);
  ctx.stroke();
  if (p.face && w > 58) drawFace(ctx, (l + r) / 2, -LAYER_H / 2 - 2, t, p.seed);
  ctx.restore();
}

function makeLayer(n, w, ox) {
  const pearls = [];
  const count = Math.round(w / 15);
  for (let i = 0; i < count; i++) {
    pearls.push({ dx: rand(-w / 2 + 5, w / 2 - 5), dy: rand(5, 15), r: rand(3.6, 4.8) });
  }
  // a few floating higher up
  for (let i = 0; i < 2; i++) pearls.push({ dx: rand(-w / 2 + 8, w / 2 - 8), dy: rand(17, 24), r: rand(3, 4) });
  return {
    ox,
    l: -w / 2,
    r: w / 2,
    flavor: n % FLAVORS.length,
    pearls,
    face: n % 3 === 1 || Math.random() < 0.18,
    seed: Math.random(),
    squash: 0,
  };
}

function makeGame() {
  return {
    phase: 'play', // play | won | lost | done
    t: 0,
    stack: [],
    cur: null,
    dir: 1,
    lastDrop: -1,
    falling: [],
    fx: [],
    rings: [],
    texts: [],
    cam: 0,
    shake: 0,
    combo: 0,
    endT: 0,
    lid: null,
    basePearls: Array.from({ length: 34 }, () => ({ x: rand(-0.42, 0.42), y: rand(0, 1), r: rand(4.5, 6) })),
    lights: Array.from({ length: 14 }, (_, i) => i),
  };
}

function topSpan(g) {
  const top = g.stack[g.stack.length - 1];
  if (!top) return { L: -BASE_W / 2, R: BASE_W / 2 };
  return { L: top.ox + top.l, R: top.ox + top.r };
}

function amplitude(viewW, w) {
  return Math.max(80, Math.min(210, viewW / 2 - w / 2 - 8));
}

function spawnLayer(g, viewW) {
  const n = g.stack.length;
  const { L, R } = topSpan(g);
  const w = n === 0 ? START_W : R - L;
  const c = (L + R) / 2;
  g.dir = n % 2 === 0 ? 1 : -1;
  g.cur = makeLayer(n, w, c - g.dir * amplitude(viewW, w));
  g.cur.center = c;
}

// ───────────── Background ─────────────
function drawBackground(ctx, W, H, cam, t, dark) {
  const par = cam * 0.35;
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  if (dark) {
    sky.addColorStop(0, '#231a3a');
    sky.addColorStop(1, '#2e2048');
  } else {
    sky.addColorStop(0, '#fff1ea');
    sky.addColorStop(1, '#fde0ea');
  }
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // wallpaper: soft vertical stripes + tiny hearts
  ctx.fillStyle = dark ? 'rgba(255,255,255,0.025)' : 'rgba(255,170,200,0.12)';
  for (let x = 0; x < W; x += 44) ctx.fillRect(x, 0, 18, H);
  const tile = 88;
  const off = par % tile;
  for (let y = -tile + off; y < H; y += tile) {
    for (let x = 22; x < W; x += tile) {
      drawHeart(ctx, x + ((Math.floor((y - off) / tile) & 1) * tile) / 2, y + 30, 9, dark ? 'rgba(255,156,194,0.12)' : 'rgba(255,133,177,0.18)');
    }
  }

  const sc = Math.min(1, W / 620);
  // menu board (top-left)
  ctx.save();
  ctx.translate(14 + 10 * sc, 66 + par);
  ctx.scale(sc, sc);
  ctx.rotate(-0.03);
  ctx.fillStyle = dark ? '#5a3e2c' : '#c99a70';
  rr(ctx, -8, -8, 166, 136, 14);
  ctx.fill();
  ctx.fillStyle = dark ? '#1c2b28' : '#3f5b52';
  rr(ctx, 0, 0, 150, 120, 9);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = '600 17px Fredoka, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('~ MENU ~', 75, 24);
  ctx.font = '500 13px Quicksand, sans-serif';
  ctx.textAlign = 'left';
  const items = [
    ['taro', '#d6b8f0'],
    ['strawberry', '#ffb3cf'],
    ['matcha', '#bfe3a6'],
    ['brown sugar', '#f1c99b'],
    ['mango', '#ffd97a'],
  ];
  items.forEach(([name, col], i) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(18, 42 + i * 16, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(name, 28, 46 + i * 16);
    ctx.fillText('♡', 128, 46 + i * 16);
  });
  ctx.restore();

  // hanging plants (top-right)
  const plants = [
    { x: W - 50 * sc - 10, len: 70, s: 1 },
    { x: W - 130 * sc - 10, len: 40, s: 0.8 },
  ];
  plants.forEach((p, i) => {
    const sway = Math.sin(t * 1.1 + i * 2) * 0.05;
    ctx.save();
    ctx.translate(p.x, par * 0.6);
    ctx.rotate(sway);
    ctx.scale(sc * p.s + 0.2, sc * p.s + 0.2);
    ctx.strokeStyle = dark ? '#8a7aa0' : '#c9a98a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-14, p.len);
    ctx.moveTo(0, 0);
    ctx.lineTo(14, p.len);
    ctx.stroke();
    // trailing leaves
    for (let k = 0; k < 3; k++) {
      const lx = -12 + k * 12;
      for (let j = 0; j < 5; j++) {
        const ly = p.len + 16 + j * 11;
        const wob = Math.sin(t * 1.6 + j + k) * 2;
        ctx.fillStyle = dark ? (j % 2 ? '#3f7a64' : '#4d8f75') : j % 2 ? '#7cc79a' : '#9ed9b0';
        ctx.beginPath();
        ctx.ellipse(lx + wob + (j % 2 ? 4 : -4), ly, 6, 3.6, j % 2 ? 0.6 : -0.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // pot
    ctx.fillStyle = dark ? '#b06f8f' : '#ffb3cf';
    ctx.beginPath();
    ctx.moveTo(-20, p.len);
    ctx.lineTo(20, p.len);
    ctx.lineTo(14, p.len + 26);
    ctx.lineTo(-14, p.len + 26);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = dark ? '#c98aa8' : '#ffd0e0';
    rr(ctx, -22, p.len - 5, 44, 8, 4);
    ctx.fill();
    drawHeart(ctx, 0, p.len + 13, 10, dark ? '#ffd0e0' : '#ff7fb0');
    ctx.restore();
  });

  // dark: neon "boba ♡" sign
  if (dark) {
    const flick = Math.sin(t * 23) > 0.96 ? 0.4 : 1;
    ctx.save();
    ctx.translate(W - 120 * sc - 24, 170 + par);
    ctx.scale(sc + 0.15, sc + 0.15);
    ctx.globalAlpha = flick;
    ctx.font = '700 34px Caveat, Fredoka, cursive';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#ff6fb0';
    ctx.shadowBlur = 24;
    ctx.fillStyle = '#ffd6ea';
    ctx.fillText('boba ♡', 0, 0);
    ctx.shadowBlur = 10;
    ctx.fillText('boba ♡', 0, 0);
    ctx.strokeStyle = 'rgba(142,201,255,0.9)';
    ctx.shadowColor = '#8ec9ff';
    ctx.shadowBlur = 16;
    ctx.lineWidth = 2;
    rr(ctx, -66, -34, 132, 48, 14);
    ctx.stroke();
    ctx.restore();
  }

  // string of fairy lights
  ctx.save();
  ctx.translate(0, par * 0.4);
  ctx.strokeStyle = dark ? 'rgba(255,255,255,0.25)' : 'rgba(150,110,120,0.35)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let x = 0; x <= W; x += 8) {
    const y = 26 + Math.sin((x / W) * Math.PI * 3) * 10;
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  const cols = ['#ffb3cf', '#bddcff', '#ffe08a', '#d9c7ff'];
  for (let i = 0, x = 20; x < W; x += 42, i++) {
    const y = 30 + Math.sin((x / W) * Math.PI * 3) * 10;
    const on = 0.65 + 0.35 * Math.sin(t * 2 + i);
    ctx.fillStyle = cols[i % 4];
    if (dark) {
      ctx.shadowColor = cols[i % 4];
      ctx.shadowBlur = 12 * on;
    }
    ctx.globalAlpha = dark ? on : 0.9;
    ctx.beginPath();
    ctx.ellipse(x, y + 4, 3.5, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawCounter(ctx, W, H, y, dark) {
  // wooden counter
  const g = ctx.createLinearGradient(0, y, 0, H);
  g.addColorStop(0, dark ? '#5b4366' : '#f3d9c2');
  g.addColorStop(1, dark ? '#3a2b48' : '#e6bf9c');
  ctx.fillStyle = g;
  ctx.fillRect(0, y, W, Math.max(0, H - y) + 10);
  ctx.fillStyle = dark ? '#7a5c88' : '#fbe9da';
  ctx.fillRect(0, y, W, 8);
  ctx.strokeStyle = dark ? 'rgba(255,255,255,0.06)' : 'rgba(160,100,60,0.12)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(0, y + 22 + i * 18);
    ctx.lineTo(W, y + 22 + i * 18);
    ctx.stroke();
  }
}

function drawBaseCup(ctx, cx, top, g, t, dark) {
  const h = 84;
  const wt = BASE_W;
  const wb = BASE_W - 34;
  // coaster shadow
  ctx.fillStyle = dark ? 'rgba(0,0,0,0.35)' : 'rgba(150,80,90,0.18)';
  ctx.beginPath();
  ctx.ellipse(cx, top + h + 4, wb * 0.62, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx - wt / 2, top);
  ctx.lineTo(cx + wt / 2, top);
  ctx.lineTo(cx + wb / 2, top + h - 12);
  ctx.quadraticCurveTo(cx + wb / 2 - 2, top + h, cx + wb / 2 - 14, top + h);
  ctx.lineTo(cx - wb / 2 + 14, top + h);
  ctx.quadraticCurveTo(cx - wb / 2 + 2, top + h, cx - wb / 2, top + h - 12);
  ctx.closePath();
  const tea = ctx.createLinearGradient(0, top, 0, top + h);
  tea.addColorStop(0, '#f6dcc0');
  tea.addColorStop(0.5, '#d9a271');
  tea.addColorStop(1, '#9a6038');
  ctx.fillStyle = tea;
  ctx.fill();
  ctx.save();
  ctx.clip();
  // tiger-sugar streaks
  ctx.strokeStyle = 'rgba(120,64,30,0.45)';
  ctx.lineWidth = 6;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    const x = cx - wt / 2 + 20 + i * 38;
    ctx.moveTo(x, top - 4);
    ctx.bezierCurveTo(x + 14, top + 20, x - 10, top + 34, x + 6, top + 52);
    ctx.stroke();
  }
  // pearl pile
  for (const p of g.basePearls) {
    const py = top + h - 8 - p.y * 30;
    drawPearl(ctx, cx + p.x * (wb + p.y * (wt - wb) * 0.5), py, p.r);
  }
  // gloss
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  rr(ctx, cx - wt / 2 + 12, top + 8, 7, h - 26, 4);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = dark ? 'rgba(255,255,255,0.55)' : 'rgba(150,90,60,0.55)';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  // cute label heart
  drawHeart(ctx, cx + wt * 0.26, top + 40, 22, 'rgba(255,255,255,0.85)');
  drawHeart(ctx, cx + wt * 0.26, top + 40, 14, '#ff85b1');
  ctx.restore();
  // face on the base
  drawFace(ctx, cx - 6, top + 34, t, 0.5);
}

function drawLid(ctx, cx, y, w, t, dark) {
  const lw = w + 12;
  const dh = Math.min(64, lw * 0.42);
  ctx.save();
  // straw (behind the dome)
  ctx.save();
  ctx.translate(cx + lw * 0.08, y - dh * 0.7);
  ctx.rotate(0.28);
  const sw = 16;
  const sl = 170;
  ctx.fillStyle = '#ff7fb0';
  rr(ctx, -sw / 2, -sl, sw, sl, 6);
  ctx.fill();
  ctx.save();
  rr(ctx, -sw / 2, -sl, sw, sl, 6);
  ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (let k = -sl; k < 20; k += 22) {
    ctx.beginPath();
    ctx.moveTo(-sw, k);
    ctx.lineTo(sw, k - 14);
    ctx.lineTo(sw, k - 6);
    ctx.lineTo(-sw, k + 8);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillRect(-sw / 2 + 3, -sl + 6, 3, sl - 12);
  ctx.restore();
  // dome
  ctx.beginPath();
  ctx.moveTo(cx - lw / 2, y);
  ctx.bezierCurveTo(cx - lw / 2, y - dh * 1.3, cx + lw / 2, y - dh * 1.3, cx + lw / 2, y);
  ctx.closePath();
  const dg = ctx.createLinearGradient(cx - lw / 2, y - dh, cx + lw / 2, y);
  dg.addColorStop(0, dark ? 'rgba(220,230,255,0.45)' : 'rgba(255,255,255,0.75)');
  dg.addColorStop(1, dark ? 'rgba(160,170,230,0.25)' : 'rgba(220,235,255,0.45)');
  ctx.fillStyle = dg;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx - lw * 0.12, y - dh * 0.35, lw * 0.28, Math.PI * 1.15, Math.PI * 1.45);
  ctx.stroke();
  // rim band
  ctx.fillStyle = '#fff';
  rr(ctx, cx - lw / 2 - 4, y - 5, lw + 8, 10, 5);
  ctx.fill();
  ctx.strokeStyle = '#ffb3cf';
  ctx.lineWidth = 2;
  ctx.stroke();
  drawHeart(ctx, cx, y - dh * 0.45, 20 + Math.sin(t * 6) * 2, '#ff6f9f');
  ctx.restore();
}

function drawStar(ctx, x, y, r, rot) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const rad = i % 2 ? r * 0.4 : r;
    const a = (i / 8) * Math.PI * 2;
    ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export default function Level08BobaStack({ onWin, onFail }) {
  const { canvasRef, view } = useFitCanvas(MIN_W, MIN_H);
  const game = useRef(null);
  if (!game.current) game.current = makeGame();
  const ended = useRef(false);
  const [height, setHeight] = useState(0);
  const [combo, setCombo] = useState(0);
  const [running, setRunning] = useState(true);
  const [hint, setHint] = useState(true);

  const finish = (won) => {
    if (ended.current) return;
    ended.current = true;
    setRunning(false);
    if (won) onWin();
    else onFail('toppled');
  };

  const drop = () => {
    const g = game.current;
    if (g.phase !== 'play' || !g.cur || g.t - g.lastDrop < DROP_LOCK) return;
    g.lastDrop = g.t;
    setHint(false);
    const cur = g.cur;
    const n = g.stack.length;
    const { L, R } = topSpan(g);
    const tc = (L + R) / 2;
    const cl = cur.ox + cur.l;
    const cr = cur.ox + cur.r;
    const cc = (cl + cr) / 2;
    const worldY = (n + 1) * LAYER_H; // top of the new layer

    if (Math.abs(cc - tc) <= PERFECT_TOL) {
      // ─ perfect: snap ─
      cur.ox += tc - cc;
      g.combo += 1;
      if (g.combo >= 2) {
        const w = cur.r - cur.l;
        const grow = Math.min(COMBO_GROW, START_W - w);
        if (grow > 0) {
          cur.l -= grow / 2;
          cur.r += grow / 2;
        }
      }
      cur.squash = 1;
      g.stack.push(cur);
      sound.sfx.pop(1 + Math.min(g.combo, 6) * 0.08);
      sound.sfx.sparkle();
      g.rings.push({ x: tc, y: worldY - LAYER_H / 2, w: cur.r - cur.l, t0: g.t });
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        g.fx.push({ x: tc + Math.cos(a) * 30, y: worldY - LAYER_H / 2, vx: Math.cos(a) * rand(120, 220), vy: Math.sin(a) * rand(120, 220), life: 0.8, max: 0.8, kind: i % 3 ? 'star' : 'heart', color: ['#ffd36e', '#ff85b1', '#bddcff', '#fff'][i % 4], rot: rand(0, 6) });
      }
      g.texts.push({ text: g.combo > 1 ? `Perfect! x${g.combo}` : 'Perfect!', x: tc, y: worldY + 16, t0: g.t, big: true });
      g.shake = Math.max(g.shake, 2);
    } else {
      const nl = Math.max(cl, L);
      const nr = Math.min(cr, R);
      if (nr - nl <= 0) {
        // ─ total miss ─
        g.phase = 'lost';
        g.cur = null;
        g.falling.push({ ...cur, y: worldY - LAYER_H, vx: Math.sign(cc - tc) * 90, vy: 120, rot: 0, vr: Math.sign(cc - tc) * 3 });
        g.shake = 10;
        g.endT = g.t + 1.25;
        sound.sfx.bad();
        g.texts.push({ text: 'oh no!', x: tc, y: worldY + 18, t0: g.t, big: true, sad: true });
        return;
      }
      g.combo = 0;
      // slice off overhangs
      if (cl < nl) {
        g.falling.push({ ...cur, l: cl - cur.ox, r: nl - cur.ox, face: false, y: worldY - LAYER_H, vx: -rand(60, 110), vy: rand(60, 140), rot: 0, vr: -rand(2.5, 5) });
      }
      if (cr > nr) {
        g.falling.push({ ...cur, l: nr - cur.ox, r: cr - cur.ox, face: false, y: worldY - LAYER_H, vx: rand(60, 110), vy: rand(60, 140), rot: 0, vr: rand(2.5, 5) });
      }
      cur.l = nl - cur.ox;
      cur.r = nr - cur.ox;
      cur.squash = 0.7;
      g.stack.push(cur);
      sound.sfx.click();
      for (let i = 0; i < 6; i++) {
        g.fx.push({ x: (cl < nl ? nl : nr), y: worldY - rand(4, LAYER_H - 4), vx: rand(-80, 80), vy: rand(40, 160), life: 0.6, max: 0.6, kind: 'drop', color: FLAVORS[cur.flavor].bot, rot: 0 });
      }
      g.shake = Math.max(g.shake, 3);
    }
    g.cur = null;
    setHeight(g.stack.length);
    setCombo(g.combo);
    if (g.stack.length >= GOAL) {
      g.phase = 'won';
      const top = g.stack[g.stack.length - 1];
      g.lid = { off: 320, v: 0, landed: false, x: top.ox + (top.l + top.r) / 2, w: top.r - top.l };
      sound.sfx.whoosh();
    } else {
      spawnLayer(g, view.current.w);
    }
  };
  const dropRef = useRef(drop);
  dropRef.current = drop;

  useEffect(() => {
    spawnLayer(game.current, view.current.w);
    const onKey = (e) => {
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowDown') {
        e.preventDefault();
        if (!e.repeat) dropRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useGameLoop((dt) => {
    const g = game.current;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { w: W, h: H, scale } = view.current;
    const dark = isDark();
    g.t += dt;
    const t = g.t;

    // ── update ──
    if (g.phase === 'play' && g.cur) {
      const c = g.cur;
      const w = c.r - c.l;
      const A = amplitude(W, w);
      const speed = BASE_SPEED + g.stack.length * SPEED_STEP;
      c.ox += g.dir * speed * dt;
      if (c.ox > c.center + A) {
        c.ox = c.center + A;
        g.dir = -1;
      } else if (c.ox < c.center - A) {
        c.ox = c.center - A;
        g.dir = 1;
      }
    }
    for (const f of g.falling) {
      f.vy -= GRAVITY * dt;
      f.y += f.vy * dt;
      f.ox += f.vx * dt;
      f.rot += f.vr * dt;
    }
    g.falling = g.falling.filter((f) => f.y > g.cam - 400);
    for (const p of g.fx) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94;
      p.vy = p.vy * 0.94 - (p.kind === 'drop' ? 500 : 60) * dt;
      p.rot += dt * 4;
    }
    g.fx = g.fx.filter((p) => p.life > 0);
    g.texts = g.texts.filter((tx) => t - tx.t0 < 1.1);
    g.rings = g.rings.filter((r) => t - r.t0 < 0.7);
    for (const s of g.stack) s.squash = Math.max(0, s.squash - dt * 5);
    g.shake = Math.max(0, g.shake - dt * 30);

    const baseTop = H - 128;
    const n = g.stack.length;
    const camTarget = Math.max(0, (n + (g.phase === 'won' ? 2.2 : 1)) * LAYER_H - baseTop + H * 0.4);
    g.cam += (camTarget - g.cam) * Math.min(1, dt * 4);

    if (g.phase === 'won' && g.lid) {
      const lid = g.lid;
      if (!lid.landed) {
        lid.v += 2200 * dt;
        lid.off -= lid.v * dt;
        if (lid.off <= 0) {
          lid.off = 0;
          lid.landed = true;
          g.endT = t + 1.6;
          g.shake = 6;
          sound.sfx.pop(1.4);
          sound.sfx.sparkle();
          const y = n * LAYER_H + 10;
          g.rings.push({ x: lid.x, y, w: lid.w + 40, t0: t });
          for (let i = 0; i < 28; i++) {
            const a = rand(0, Math.PI * 2);
            g.fx.push({ x: lid.x, y: y + 20, vx: Math.cos(a) * rand(150, 320), vy: Math.sin(a) * rand(150, 320) + 80, life: 1.2, max: 1.2, kind: i % 2 ? 'heart' : 'star', color: ['#ffd36e', '#ff85b1', '#bddcff', '#d9c7ff'][i % 4], rot: rand(0, 6) });
          }
          g.texts.push({ text: 'Boba tower complete! ♡', x: lid.x, y: y + 120, t0: t, big: true });
        }
      } else if (t >= g.endT) {
        g.phase = 'done';
        finish(true);
      }
    }
    if (g.phase === 'lost' && t >= g.endT) {
      g.phase = 'done';
      finish(false);
    }

    // ── draw ──
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    const shx = g.shake ? rand(-g.shake, g.shake) : 0;
    const shy = g.shake ? rand(-g.shake, g.shake) : 0;
    ctx.translate(shx, shy);

    drawBackground(ctx, W, H, g.cam, t, dark);
    const cx = W / 2;
    const sy = (y) => baseTop - y + g.cam; // world y → screen y
    drawCounter(ctx, W, H, sy(-84) - 2, dark);
    drawBaseCup(ctx, cx, sy(0), g, t, dark);

    // stacked layers
    g.stack.forEach((p, i) => {
      ctx.save();
      const sq = Math.sin(p.squash * Math.PI) * 0.08;
      ctx.translate(cx + p.ox + (p.l + p.r) / 2, sy(i * LAYER_H));
      ctx.scale(1 + sq, 1 - sq);
      ctx.translate(-(p.l + p.r) / 2, 0);
      drawSegment(ctx, p, t);
      ctx.restore();
    });

    // moving layer + guide
    if (g.cur) {
      const c = g.cur;
      const { L, R } = topSpan(g);
      ctx.save();
      ctx.setLineDash([4, 6]);
      ctx.strokeStyle = dark ? 'rgba(255,200,230,0.25)' : 'rgba(200,100,140,0.25)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx + L, sy(n * LAYER_H));
      ctx.lineTo(cx + L, sy((n + 1) * LAYER_H) - 8);
      ctx.moveTo(cx + R, sy(n * LAYER_H));
      ctx.lineTo(cx + R, sy((n + 1) * LAYER_H) - 8);
      ctx.stroke();
      ctx.restore();
      ctx.save();
      ctx.translate(cx + c.ox, sy(n * LAYER_H) - 2 + Math.sin(t * 6) * 1.2);
      ctx.shadowColor = dark ? 'rgba(255,111,176,0.5)' : 'rgba(180,90,120,0.25)';
      ctx.shadowBlur = 10;
      drawSegment(ctx, c, t);
      ctx.restore();
    }

    // lid + straw
    if (g.lid) {
      const lid = g.lid;
      drawLid(ctx, cx + lid.x, sy(n * LAYER_H + lid.off), lid.w, t, dark);
    }

    // falling pieces
    for (const f of g.falling) {
      const mid = (f.l + f.r) / 2;
      ctx.save();
      ctx.translate(cx + f.ox + mid, sy(f.y + LAYER_H / 2));
      ctx.rotate(f.rot);
      ctx.translate(-mid, LAYER_H / 2);
      drawSegment(ctx, f, t);
      ctx.restore();
    }

    // sparkle rings
    for (const r of g.rings) {
      const k = (t - r.t0) / 0.7;
      ctx.save();
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = dark ? '#ffd6ea' : '#ff85b1';
      ctx.lineWidth = 4 * (1 - k) + 1;
      const ww = r.w + 20 + k * 90;
      const hh = LAYER_H + 10 + k * 60;
      rr(ctx, cx + r.x - ww / 2, sy(r.y) - hh / 2, ww, hh, hh / 2);
      ctx.stroke();
      ctx.restore();
    }
    // particles
    for (const p of g.fx) {
      const a = Math.max(0, p.life / p.max);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      const px = cx + p.x;
      const py = sy(p.y);
      if (p.kind === 'star') drawStar(ctx, px, py, 6 * (0.5 + a * 0.6), p.rot);
      else if (p.kind === 'heart') drawHeart(ctx, px, py, 12 * (0.6 + a * 0.5), p.color);
      else {
        ctx.beginPath();
        ctx.arc(px, py, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    // floating text
    for (const tx of g.texts) {
      const k = (t - tx.t0) / 1.1;
      const pop = k < 0.15 ? 0.6 + (k / 0.15) * 0.5 : 1.1 - Math.min(0.1, (k - 0.15) * 0.4);
      ctx.save();
      ctx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      ctx.translate(Math.max(90, Math.min(W - 90, cx + tx.x)), sy(tx.y + k * 40));
      ctx.scale(pop, pop);
      ctx.font = `700 ${tx.big ? 26 : 18}px Fredoka, sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 6;
      ctx.strokeStyle = dark ? '#2a2245' : '#fff';
      ctx.strokeText(tx.text, 0, 0);
      ctx.fillStyle = tx.sad ? '#9a7ab8' : '#f2629a';
      ctx.fillText(tx.text, 0, 0);
      ctx.restore();
    }
  }, running);

  return (
    <Stage className="l08-stage" onPointerDown={(e) => { e.preventDefault(); drop(); }}>
      <canvas ref={canvasRef} className="l08-canvas" aria-label="Boba tower stacking game" />
      <GameHud>
        <HudPill icon="🧋" label="Height" value={`${height}/${GOAL}`} />
        {combo > 1 && <HudPill icon="✨" label="Combo" value={`x${combo}`} accent="var(--accent-2)" />}
      </GameHud>
      {hint && <div className="l08-hint">Tap / Space to drop the cup!</div>}
    </Stage>
  );
}
