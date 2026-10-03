/**
 * Level 10 — "Fly to My Heart" (the grand finale)
 * Flappy-style but cute and forgiving: a paper-plane love letter flaps through
 * gaps in fluffy cloud columns. After 12 cloud gates the clouds part, her
 * glowing heart-window appears and the plane flies itself home.
 */
import { useEffect, useRef, useState } from 'react';
import { Stage, GameHud, HudPill } from './kit.jsx';
import { useGameLoop } from '../hooks/useGameLoop';
import { sound } from '../audio/soundManager';
import { Heart, HEART_D } from '../components/Icons';
import './Level10PaperPlane.css';

// ───────────── Tunables ─────────────
const GATES = 12; // cloud gates to pass
const SPEED = 165; // world scroll speed (logical px/s)
const SPACING = 300; // horizontal distance between gates
const GAP_START = 0.38; // gap height as a fraction of view height (first gate)
const GAP_END = 0.31; // … shrinking linearly to this by the last gate
const MAX_SHIFT = 0.24; // max change of gap centre between gates (fraction of height)
const GRAVITY = 1250; // px/s²
const FLAP_V = -375; // upward velocity on tap
const MAX_FALL = 560;
const HIT_R = 10; // plane hit radius (forgiving)
const COL_HALF = 36; // half-width of a cloud column's hitbox (visual is ~50)
const HEART_PICK_R = 28; // pickup radius for collectible hearts
const MIN_W = 360;
const MIN_H = 600;

const HEART_PATH = typeof Path2D !== 'undefined' ? new Path2D(HEART_D) : null;
const isDark = () => document.documentElement.dataset.theme === 'dark';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);

function mulberry(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

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

function heartAt(ctx, x, y, size, fill) {
  if (!HEART_PATH) return;
  ctx.save();
  ctx.translate(x - size / 2, y - size / 2);
  ctx.scale(size / 100, size / 100);
  ctx.fillStyle = fill;
  ctx.fill(HEART_PATH);
  ctx.restore();
}

function sparkle(ctx, x, y, r, rot) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const rad = i % 2 ? r * 0.28 : r;
    const a = (i / 8) * Math.PI * 2;
    ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ───────────── Static scenery (generated once) ─────────────
const SCENE = (() => {
  const r = mulberry(14);
  const TILE = 1100;
  const buildings = [];
  for (let x = 0; x < TILE; ) {
    const w = 38 + r() * 46;
    const h = 40 + r() * 85;
    const windows = [];
    for (let wy = 14; wy < h - 10; wy += 16) for (let wx = 8; wx < w - 10; wx += 13) windows.push({ x: wx, y: wy, on: r() < 0.45 });
    buildings.push({ x, w, h, roof: Math.floor(r() * 4), windows, tone: r() });
    x += w + 4 + r() * 18;
  }
  const stars = Array.from({ length: 110 }, () => ({ x: r(), y: r() * 0.75, s: 0.5 + r() * 1.5, p: r() * 6 }));
  const lanterns = Array.from({ length: 10 }, () => ({ x: r() * 1400, y: r(), s: 0.6 + r() * 0.7, v: 0.012 + r() * 0.02, p: r() * 6 }));
  const puffs = Array.from({ length: 8 }, () => ({ x: r() * 1500, y: 0.08 + r() * 0.4, s: 0.6 + r() * 0.9 }));
  return { TILE, buildings, stars, lanterns, puffs };
})();

/** Puffs for a cloud column. d = distance outward from the gap edge. */
function makeColumnPuffs(halfW = 26, depth = 1600) {
  const p = [];
  const capN = Math.max(3, Math.round((halfW * 2) / 26));
  for (let i = 0; i < capN; i++) {
    const dx = -halfW + (i / (capN - 1)) * halfW * 2;
    p.push({ dx: dx + rand(-3, 3), d: rand(24, 34), r: rand(26, 32), cap: true });
  }
  for (let d = 72; d < depth; d += 40) {
    const n = Math.max(2, Math.round((halfW * 2) / 34));
    for (let i = 0; i < n; i++) {
      const dx = -halfW * 0.8 + (i / (n - 1)) * halfW * 1.6;
      p.push({ dx: dx + rand(-5, 5), d: d + rand(-6, 6), r: rand(25, 31) });
    }
    if (Math.random() < 0.5) p.push({ dx: (Math.random() < 0.5 ? -1 : 1) * (halfW + 10), d: d + rand(-10, 10), r: rand(14, 20) });
  }
  return p;
}

function makeGates() {
  const gates = [];
  let cf = 0.5;
  for (let i = 0; i < GATES; i++) {
    const gf = GAP_START + (GAP_END - GAP_START) * (i / (GATES - 1));
    const lo = 0.1 + gf / 2;
    const hi = 0.9 - gf / 2;
    cf = clamp(cf + rand(-MAX_SHIFT, MAX_SHIFT), lo, hi);
    if (i === 0) cf = 0.5;
    gates.push({ i, x: 0, cf, gf, top: makeColumnPuffs(), bot: makeColumnPuffs(), passed: false });
  }
  return gates;
}

// ───────────── Drawing ─────────────
function drawSky(ctx, W, H, d, t, dark) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  if (dark) {
    g.addColorStop(0, '#0b0a22');
    g.addColorStop(0.55, '#1b1642');
    g.addColorStop(1, '#3a2257');
  } else {
    g.addColorStop(0, '#bfb2f2');
    g.addColorStop(0.42, '#f7b9d6');
    g.addColorStop(0.78, '#ffc9b5');
    g.addColorStop(1, '#ffe2bf');
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  if (dark) {
    // stars
    for (const s of SCENE.stars) {
      const x = (((s.x * W * 1.4 - d * 0.02) % (W * 1.4)) + W * 1.4) % (W * 1.4);
      const a = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.5 + s.p));
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.beginPath();
      ctx.arc(x, s.y * H, s.s, 0, Math.PI * 2);
      ctx.fill();
      if (s.s > 1.7) {
        ctx.fillStyle = `rgba(255,220,240,${a * 0.6})`;
        sparkle(ctx, x, s.y * H, s.s * 3, 0);
      }
    }
    // aurora ribbons
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const ribbons = [
      { c: '255,110,190', y: 0.14, a: 0.42, band: 46 },
      { c: '110,190,255', y: 0.24, a: 0.38, band: 40 },
      { c: '190,130,255', y: 0.33, a: 0.22, band: 34 },
    ];
    ribbons.forEach((rb, k) => {
      const base = H * rb.y;
      const pts = [];
      for (let x = -20; x <= W + 20; x += 16) {
        const wx = x + d * 0.04;
        pts.push([x, base + Math.sin(wx * 0.006 + t * 0.35 + k * 2) * 30 + Math.sin(wx * 0.017 - t * 0.5 + k) * 10]);
      }
      // soft curtain: bright bottom edge fading upward
      const gr = ctx.createLinearGradient(0, base - rb.band - 40, 0, base + 40);
      gr.addColorStop(0, `rgba(${rb.c},0)`);
      gr.addColorStop(0.75, `rgba(${rb.c},${rb.a * 0.6})`);
      gr.addColorStop(0.9, `rgba(${rb.c},${rb.a})`);
      gr.addColorStop(1, `rgba(${rb.c},0)`);
      ctx.fillStyle = gr;
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y - rb.band - Math.sin(i * 0.5 + t * 0.8 + k) * 14) : ctx.moveTo(x, y - rb.band)));
      for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(pts[i][0], pts[i][1] + 6);
      ctx.closePath();
      ctx.fill();
      // glowing lower edge
      ctx.strokeStyle = `rgba(${rb.c},${rb.a * 0.8})`;
      ctx.lineWidth = 2;
      ctx.shadowColor = `rgba(${rb.c},1)`;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
      ctx.shadowBlur = 0;
    });
    ctx.restore();
    // moon
    const mx = W * 0.78;
    const my = H * 0.17;
    const mg = ctx.createRadialGradient(mx, my, 10, mx, my, 90);
    mg.addColorStop(0, 'rgba(255,240,250,0.45)');
    mg.addColorStop(1, 'rgba(255,240,250,0)');
    ctx.fillStyle = mg;
    ctx.fillRect(mx - 90, my - 90, 180, 180);
    ctx.fillStyle = '#fff4e8';
    ctx.beginPath();
    ctx.arc(mx, my, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1b1642';
    ctx.beginPath();
    ctx.arc(mx + 10, my - 7, 21, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // low sunset sun
    const sx = W * 0.72;
    const sy = H * 0.68;
    const sg = ctx.createRadialGradient(sx, sy, 10, sx, sy, H * 0.45);
    sg.addColorStop(0, 'rgba(255,250,225,0.95)');
    sg.addColorStop(0.15, 'rgba(255,220,180,0.7)');
    sg.addColorStop(1, 'rgba(255,190,200,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff3d6';
    ctx.beginPath();
    ctx.arc(sx, sy, 38, 0, Math.PI * 2);
    ctx.fill();
  }

  // far wispy clouds
  for (const p of SCENE.puffs) {
    const span = W + 400;
    const x = ((((p.x - d * 0.08) % span) + span) % span) - 200;
    const y = p.y * H;
    ctx.fillStyle = dark ? 'rgba(170,160,220,0.14)' : 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.ellipse(x, y, 70 * p.s, 14 * p.s, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 30 * p.s, y - 8 * p.s, 40 * p.s, 14 * p.s, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function hillPath(ctx, W, H, base, amp, f1, f2, off) {
  ctx.beginPath();
  ctx.moveTo(0, H);
  for (let x = 0; x <= W + 10; x += 10) {
    const wx = x + off;
    ctx.lineTo(x, base - Math.sin(wx * f1) * amp - Math.sin(wx * f2 + 1.3) * amp * 0.45);
  }
  ctx.lineTo(W, H);
  ctx.closePath();
}

function drawLandscape(ctx, W, H, d, t, dark) {
  // far hills
  hillPath(ctx, W, H, H * 0.8, 26, 0.004, 0.011, d * 0.12);
  ctx.fillStyle = dark ? '#2c2355' : '#d9b6e6';
  ctx.fill();

  // city rooftops
  const off = d * 0.28;
  const T = SCENE.TILE;
  const groundY = H * 0.93;
  for (let rep = Math.floor(off / T) - 1; rep * T - off < W + 100; rep++) {
    for (const b of SCENE.buildings) {
      const x = rep * T + b.x - off;
      if (x > W + 10 || x + b.w < -10) continue;
      const y = groundY - b.h;
      ctx.fillStyle = dark ? (b.tone > 0.5 ? '#2a2150' : '#251d47') : b.tone > 0.5 ? '#c9a3d9' : '#bf9ad4';
      ctx.fillRect(x, y, b.w, b.h + 40);
      // roofs
      ctx.beginPath();
      if (b.roof === 0) {
        ctx.moveTo(x - 3, y);
        ctx.lineTo(x + b.w / 2, y - 18);
        ctx.lineTo(x + b.w + 3, y);
      } else if (b.roof === 1) {
        ctx.arc(x + b.w / 2, y, b.w / 2, Math.PI, 0);
      } else if (b.roof === 2) {
        ctx.rect(x + b.w * 0.6, y - 14, 7, 14);
      } else {
        ctx.moveTo(x, y);
        ctx.lineTo(x + b.w * 0.2, y - 8);
        ctx.lineTo(x + b.w * 0.8, y - 8);
        ctx.lineTo(x + b.w, y);
      }
      ctx.fill();
      // windows
      for (const w of b.windows) {
        if (!w.on) continue;
        ctx.fillStyle = dark ? 'rgba(255,214,140,0.85)' : 'rgba(255,240,215,0.75)';
        ctx.fillRect(x + w.x, y + w.y, 6, 8);
      }
    }
  }

  // lanterns
  for (const l of SCENE.lanterns) {
    const span = W + 200;
    const x = ((((l.x - d * 0.4) % span) + span) % span) - 100;
    const yy = ((((l.y - t * l.v) % 1) + 1) % 1) * (H * 1.1) - H * 0.05;
    const s = l.s * 1.15;
    const sway = Math.sin(t * 1.4 + l.p) * 4;
    const glow = ctx.createRadialGradient(x + sway, yy, 2, x + sway, yy, 34 * s);
    glow.addColorStop(0, dark ? 'rgba(255,190,120,0.55)' : 'rgba(255,220,170,0.5)');
    glow.addColorStop(1, 'rgba(255,190,120,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x + sway - 34 * s, yy - 34 * s, 68 * s, 68 * s);
    ctx.save();
    ctx.translate(x + sway, yy);
    ctx.scale(s, s);
    const lg = ctx.createLinearGradient(0, -12, 0, 12);
    lg.addColorStop(0, '#ffb07a');
    lg.addColorStop(1, '#ff7f9f');
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.moveTo(-8, -11);
    ctx.quadraticCurveTo(-12, 0, -7, 11);
    ctx.lineTo(7, 11);
    ctx.quadraticCurveTo(12, 0, 8, -11);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,240,200,0.8)';
    ctx.beginPath();
    ctx.ellipse(0, 8, 3, 4 + Math.sin(t * 9 + l.p), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c85a7a';
    ctx.fillRect(-6, -13, 12, 3);
    ctx.fillRect(-5, 11, 10, 2.5);
    ctx.restore();
  }

  // near hills
  hillPath(ctx, W, H, H * 0.97, 14, 0.007, 0.019, d * 0.6);
  ctx.fillStyle = dark ? '#3b2a63' : '#f5a9c6';
  ctx.fill();
}

/** A fluffy cloud column. dir = -1 grows upward from edgeY, +1 grows downward. */
function drawColumn(ctx, sx, edgeY, dir, puffs, halfW, H, dark) {
  const vis = (p) => {
    const y = edgeY + dir * p.d;
    return y > -50 && y < H + 50;
  };
  const far = dir < 0 ? Math.min(edgeY, 0) - 60 : Math.max(edgeY, H) + 60;
  const g = ctx.createLinearGradient(sx - halfW - 30, 0, sx + halfW + 30, 0);
  if (dark) {
    g.addColorStop(0, '#ddd6fb');
    g.addColorStop(1, '#9b90cf');
  } else {
    g.addColorStop(0, '#ffffff');
    g.addColorStop(1, '#f1e1f6');
  }
  // shadow pass
  ctx.fillStyle = dark ? '#6c6199' : '#e7c4df';
  const body = (ox, oy, grow) => {
    ctx.beginPath();
    const y0 = edgeY + dir * 32 + oy;
    ctx.rect(sx - halfW + ox - grow, Math.min(y0, far), halfW * 2 + grow * 2, Math.abs(far - y0));
    for (const p of puffs) {
      if (!vis(p)) continue;
      const y = edgeY + dir * p.d + oy;
      ctx.moveTo(sx + p.dx + ox + p.r + grow, y);
      ctx.arc(sx + p.dx + ox, y, p.r + grow, 0, Math.PI * 2);
    }
  };
  body(4, dir < 0 ? 5 : 3, 0);
  ctx.fill();
  ctx.fillStyle = g;
  body(-2, dir < 0 ? -1 : -3, -1);
  ctx.fill();
  // highlights on cap
  ctx.fillStyle = dark ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.9)';
  for (const p of puffs) {
    if (!p.cap) continue;
    const y = edgeY + dir * p.d;
    ctx.beginPath();
    ctx.ellipse(sx + p.dx - p.r * 0.3, y - p.r * 0.35, p.r * 0.38, p.r * 0.22, -0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  // warm rim light along the gap-facing edge of the cap
  ctx.save();
  ctx.globalAlpha = dark ? 0.35 : 0.45;
  ctx.strokeStyle = dark ? '#ff9cc2' : '#ffb59a';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  const mid = dir < 0 ? Math.PI / 2 : -Math.PI / 2;
  for (const p of puffs) {
    if (!p.cap) continue;
    const y = edgeY + dir * p.d;
    ctx.moveTo(sx + p.dx + Math.cos(mid - 0.55) * p.r, y + Math.sin(mid - 0.55) * p.r);
    ctx.arc(sx + p.dx, y, p.r, mid - 0.55, mid + 0.55);
  }
  ctx.stroke();
  ctx.restore();
}

function drawPlane(ctx, x, y, rot, flap, scale, dark) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(1.3 * scale, 1.3 * scale);
  ctx.lineJoin = 'round';
  // soft shadow glow
  ctx.shadowColor = dark ? 'rgba(255,156,194,0.7)' : 'rgba(160,80,120,0.3)';
  ctx.shadowBlur = dark ? 16 : 8;
  // far wing
  ctx.fillStyle = dark ? '#d7cfee' : '#efe6f6';
  ctx.beginPath();
  ctx.moveTo(24, 0);
  ctx.lineTo(-14, -19 - flap * 5);
  ctx.lineTo(-8, -6);
  ctx.closePath();
  ctx.fill();
  // keel
  ctx.fillStyle = dark ? '#e8d4e6' : '#f6dde9';
  ctx.beginPath();
  ctx.moveTo(24, 0);
  ctx.lineTo(-8, 1);
  ctx.lineTo(-17, 12);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  // main wing
  const wg = ctx.createLinearGradient(-20, -14, 20, 4);
  wg.addColorStop(0, '#ffffff');
  wg.addColorStop(1, dark ? '#efe7fb' : '#fff4f8');
  ctx.fillStyle = wg;
  ctx.beginPath();
  ctx.moveTo(25, 0);
  ctx.lineTo(-22, -13 - flap * 4);
  ctx.lineTo(-7, 1);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(205,120,160,0.65)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  // letter lines on the wing
  ctx.strokeStyle = 'rgba(200,150,190,0.4)';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(-14, -8);
  ctx.lineTo(8, -2.5);
  ctx.moveTo(-10, -4.5);
  ctx.lineTo(4, -1);
  ctx.stroke();
  // crease
  ctx.strokeStyle = 'rgba(205,120,160,0.8)';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(25, 0);
  ctx.lineTo(-7, 1);
  ctx.lineTo(-17, 12);
  ctx.stroke();
  // heart wax seal
  heartAt(ctx, -9, -6.5, 11, '#ff4f8b');
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  ctx.arc(-11.2, -8.6, 1.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawHerChibi(ctx, t) {
  // drawn inside the 100×100 heart box
  const wave = Math.sin(t * 6) * 0.35;
  ctx.save();
  // hair back
  ctx.fillStyle = '#2e1c1a';
  ctx.beginPath();
  ctx.ellipse(50, 55, 10.5, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  // dress
  ctx.fillStyle = '#ffb3cf';
  ctx.beginPath();
  ctx.moveTo(44.5, 61);
  ctx.lineTo(55.5, 61);
  ctx.lineTo(60, 78);
  ctx.lineTo(40, 78);
  ctx.closePath();
  ctx.fill();
  // waving arm
  ctx.strokeStyle = '#eab48e';
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  ctx.save();
  ctx.translate(55, 63);
  ctx.rotate(-0.9 + wave);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -10);
  ctx.stroke();
  ctx.restore();
  ctx.beginPath();
  ctx.moveTo(45, 63);
  ctx.lineTo(42, 70);
  ctx.stroke();
  // head
  ctx.fillStyle = '#eab48e';
  ctx.beginPath();
  ctx.arc(50, 52, 8, 0, Math.PI * 2);
  ctx.fill();
  // fringe
  ctx.fillStyle = '#2e1c1a';
  ctx.beginPath();
  ctx.arc(50, 51, 8.4, Math.PI * 1.05, Math.PI * 1.95);
  ctx.quadraticCurveTo(52, 48, 46, 47);
  ctx.closePath();
  ctx.fill();
  // face
  ctx.fillStyle = '#2a1a22';
  ctx.beginPath();
  ctx.arc(47, 53, 1, 0, Math.PI * 2);
  ctx.arc(53, 53, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,120,160,0.6)';
  ctx.beginPath();
  ctx.arc(45.3, 55.5, 1.4, 0, Math.PI * 2);
  ctx.arc(54.7, 55.5, 1.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#7a2e3c';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.arc(50, 55.3, 1.6, 0.2, Math.PI - 0.2);
  ctx.stroke();
  // clip
  heartAt(ctx, 56, 45, 4.5, '#ff7fb0');
  ctx.restore();
}

function drawHeartWindow(ctx, hx, hy, S, t, dark, pulse) {
  // halo + rotating rays
  const k = 1 + Math.sin(t * 3) * 0.04 + pulse * 0.25;
  const halo = ctx.createRadialGradient(hx, hy, S * 0.2, hx, hy, S * 1.4 * k);
  halo.addColorStop(0, dark ? 'rgba(255,170,215,0.75)' : 'rgba(255,245,235,0.95)');
  halo.addColorStop(0.5, dark ? 'rgba(255,120,190,0.25)' : 'rgba(255,190,215,0.4)');
  halo.addColorStop(1, 'rgba(255,150,200,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(hx - S * 1.5, hy - S * 1.5, S * 3, S * 3);
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(t * 0.15);
  ctx.fillStyle = dark ? 'rgba(255,200,230,0.08)' : 'rgba(255,255,255,0.22)';
  for (let i = 0; i < 12; i++) {
    ctx.rotate((Math.PI * 2) / 12);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(S * 1.3 * k, -S * 0.09);
    ctx.lineTo(S * 1.3 * k, S * 0.09);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  if (!HEART_PATH) return;
  ctx.save();
  const s = (S * k) / 100;
  ctx.translate(hx - (S * k) / 2, hy - (S * k) / 2);
  ctx.scale(s, s);
  // glowing frame
  ctx.shadowColor = dark ? '#ff6fb0' : '#ff9cc2';
  ctx.shadowBlur = 40 * s;
  ctx.fillStyle = '#fff';
  ctx.fill(HEART_PATH);
  ctx.shadowBlur = 0;
  // interior
  ctx.save();
  ctx.clip(HEART_PATH);
  const ig = ctx.createLinearGradient(0, 0, 0, 100);
  ig.addColorStop(0, '#fff6dc');
  ig.addColorStop(1, '#ffc6dc');
  ctx.fillStyle = ig;
  ctx.fillRect(0, 0, 100, 100);
  // fairy lights across the top
  for (let i = 0; i < 9; i++) {
    const x = 12 + i * 9.5;
    const y = 20 + Math.sin(i * 0.9) * 3;
    ctx.fillStyle = ['#ffd36e', '#ff85b1', '#96c6fb'][i % 3];
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 3 + i);
    ctx.beginPath();
    ctx.arc(x, y, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  drawHerChibi(ctx, t);
  // curtains
  ctx.fillStyle = '#ff9cc2';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(30, 0);
  ctx.quadraticCurveTo(22, 40, 34, 66);
  ctx.quadraticCurveTo(16, 60, 0, 70);
  ctx.closePath();
  ctx.moveTo(100, 0);
  ctx.lineTo(70, 0);
  ctx.quadraticCurveTo(78, 40, 66, 66);
  ctx.quadraticCurveTo(84, 60, 100, 70);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(16, 4);
  ctx.quadraticCurveTo(14, 40, 22, 62);
  ctx.moveTo(84, 4);
  ctx.quadraticCurveTo(86, 40, 78, 62);
  ctx.stroke();
  // window mullions
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(50, 14);
  ctx.lineTo(50, 44);
  ctx.moveTo(8, 38);
  ctx.lineTo(38, 38);
  ctx.moveTo(62, 38);
  ctx.lineTo(92, 38);
  ctx.stroke();
  // glass shine
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.moveTo(18, 12);
  ctx.lineTo(30, 12);
  ctx.lineTo(14, 40);
  ctx.lineTo(8, 40);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // frame
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#fff';
  ctx.stroke(HEART_PATH);
  ctx.lineWidth = 2.6;
  ctx.strokeStyle = '#ff6f9f';
  ctx.stroke(HEART_PATH);
  ctx.restore();
}

function makeGame() {
  return {
    phase: 'ready', // ready | fly | final | won | crash | done
    t: 0,
    d: 0, // distance scrolled
    py: 0,
    px: 0,
    vy: 0,
    rot: 0,
    flap: 0,
    planeScale: 1,
    gates: null,
    hearts: [],
    heartX: 0,
    passed: 0,
    score: 0,
    fx: [],
    texts: [],
    trailT: 0,
    shake: 0,
    flash: 0,
    part: 0,
    pulse: 0,
    endT: 0,
    bankTop: makeColumnPuffs(150, 1400),
    bankBot: makeColumnPuffs(150, 1400),
  };
}

export default function Level10PaperPlane({ onWin, onFail }) {
  const { canvasRef, view } = useFitCanvas(MIN_W, MIN_H);
  const game = useRef(null);
  if (!game.current) game.current = makeGame();
  const ended = useRef(false);
  const [running, setRunning] = useState(true);
  const [passed, setPassed] = useState(0);
  const [score, setScore] = useState(0);
  const [ready, setReady] = useState(true);
  const [arrived, setArrived] = useState(false);

  const finish = (won) => {
    if (ended.current) return;
    ended.current = true;
    setRunning(false);
    if (won) onWin();
    else onFail('crash');
  };

  const flap = () => {
    const g = game.current;
    if (g.phase === 'ready') {
      g.phase = 'fly';
      setReady(false);
    }
    if (g.phase !== 'fly') return;
    g.vy = FLAP_V;
    g.flap = 1;
    sound.sfx.jump();
    for (let i = 0; i < 4; i++) {
      g.fx.push({ x: g.d + g.px - 18, y: g.py + 8, vx: rand(-60, -20), vy: rand(30, 90), life: 0.5, max: 0.5, kind: 'puff', size: rand(4, 7), color: '#fff', rot: 0 });
    }
  };
  const flapRef = useRef(flap);
  flapRef.current = flap;

  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Enter') {
        e.preventDefault();
        if (!e.repeat) flapRef.current();
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

    // lazy init (needs the view size)
    if (!g.gates) {
      g.gates = makeGates();
      g.gates.forEach((gt, i) => (gt.x = W + 60 + i * SPACING));
      g.hearts = g.gates.slice(0, -1).map((gt, i) => ({ x: gt.x + SPACING / 2, yf: (gt.cf + g.gates[i + 1].cf) / 2, taken: false, p: rand(0, 6) }));
      g.heartX = g.gates[GATES - 1].x + SPACING * 1.55;
      g.px = W * 0.28;
      g.py = H * 0.45;
    }
    const S = Math.min(H * 0.42, W * 0.6, 280); // heart-window size
    const hy = H * 0.48;

    // ── update ──
    g.flap = Math.max(0, g.flap - dt * 5);
    g.shake = Math.max(0, g.shake - dt * 30);
    g.flash = Math.max(0, g.flash - dt * 2.5);
    g.pulse = Math.max(0, g.pulse - dt * 1.5);

    if (g.phase === 'ready') {
      g.px = W * 0.28;
      g.py = H * 0.45 + Math.sin(t * 3) * 8;
      g.rot = Math.sin(t * 3 + 1) * 0.08;
    } else if (g.phase === 'fly') {
      g.d += SPEED * dt;
      g.vy = Math.min(MAX_FALL, g.vy + GRAVITY * dt);
      g.py += g.vy * dt;
      const target = clamp(g.vy / 700, -0.45, 0.85);
      g.rot += (target - g.rot) * Math.min(1, dt * 10);

      const wx = g.d + g.px;
      let crashed = g.py - HIT_R < -4 || g.py + HIT_R > H;
      const hitRect = (x0, y0, x1, y1) => {
        const nx = clamp(g.px, x0, x1);
        const ny = clamp(g.py, y0, y1);
        return (g.px - nx) ** 2 + (g.py - ny) ** 2 < HIT_R * HIT_R;
      };
      for (const gt of g.gates) {
        const sx = gt.x - g.d;
        if (!gt.passed && sx + COL_HALF < g.px - HIT_R) {
          gt.passed = true;
          g.passed += 1;
          setPassed(g.passed);
          sound.sfx.pop(1 + g.passed * 0.04);
          g.texts.push({ text: g.passed === GATES ? 'almost there!' : `${g.passed}/${GATES}`, x: wx, y: g.py - 34, t0: t, small: true });
        }
        if (Math.abs(sx - g.px) > COL_HALF + HIT_R) continue;
        const top = (gt.cf - gt.gf / 2) * H;
        const bot = (gt.cf + gt.gf / 2) * H;
        if (hitRect(sx - COL_HALF, -9999, sx + COL_HALF, top) || hitRect(sx - COL_HALF, bot, sx + COL_HALF, 9999)) crashed = true;
      }
      if (!crashed && g.passed >= GATES) {
        g.phase = 'final';
        g.vy = 0;
        sound.sfx.whoosh();
      }
      for (const h of g.hearts) {
        if (h.taken) continue;
        const hx = h.x - g.d;
        const hyy = h.yf * H + Math.sin(t * 2.5 + h.p) * 6;
        if ((hx - g.px) ** 2 + (hyy - g.py) ** 2 < HEART_PICK_R * HEART_PICK_R) {
          h.taken = true;
          g.score += 1;
          setScore(g.score);
          sound.sfx.coin();
          g.texts.push({ text: '+1 ♡', x: h.x, y: hyy - 20, t0: t });
          for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2;
            g.fx.push({ x: h.x, y: hyy, vx: Math.cos(a) * rand(90, 170), vy: Math.sin(a) * rand(90, 170), life: 0.7, max: 0.7, kind: i % 2 ? 'heart' : 'spark', size: rand(6, 10), color: ['#ff85b1', '#ffd36e', '#fff', '#bddcff'][i % 4], rot: rand(0, 6) });
          }
        }
      }
      if (crashed && g.phase === 'fly') {
        g.phase = 'crash';
        g.crashed = true;
        g.vy = -220;
        g.shake = 12;
        g.flash = 0.8;
        g.endT = t + 1.0;
        sound.sfx.hit();
        for (let i = 0; i < 14; i++) {
          g.fx.push({ x: wx, y: g.py, vx: rand(-160, 160), vy: rand(-200, 120), life: 0.9, max: 0.9, kind: i % 3 ? 'paper' : 'heart', size: rand(5, 9), color: i % 3 ? '#fff' : '#ff85b1', rot: rand(0, 6) });
        }
      }
    } else if (g.phase === 'final') {
      const hxScreen = g.heartX - g.d;
      if (hxScreen > W * 0.7) g.d += SPEED * 1.15 * dt;
      g.part = Math.min(1, g.part + dt / 1.3);
      // autopilot toward the heart (starts after the clouds begin to part)
      const tx = g.heartX - g.d;
      const pull = g.part > 0.35 ? 1 : 0.15;
      const ax = (tx - g.px) * 1.6 * pull + 30;
      g.px += ax * dt;
      g.py += (hy - g.py) * Math.min(1, dt * 2.4);
      const target = Math.atan2(hy - g.py, Math.max(20, tx - g.px)) * 0.8;
      g.rot += (target - g.rot) * Math.min(1, dt * 6);
      const dist = Math.hypot(tx - g.px, hy - g.py);
      if (dist < S * 0.4) g.planeScale = Math.max(0.15, dist / (S * 0.4));
      if (dist < 16 || g.px > tx) {
        g.phase = 'won';
        g.endT = t + 1.4;
        g.flash = 0.9;
        g.pulse = 1;
        g.shake = 4;
        setArrived(true);
        sound.sfx.sparkle();
        sound.sfx.kiss();
        for (let i = 0; i < 40; i++) {
          const a = rand(0, Math.PI * 2);
          const sp = rand(120, 380);
          g.fx.push({ x: g.heartX, y: hy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1.4, max: 1.4, kind: i % 3 ? 'heart' : 'spark', size: rand(8, 16), color: ['#ff85b1', '#ffd36e', '#ffc8dd', '#bddcff', '#e4c9ff'][i % 5], rot: rand(0, 6) });
        }
      }
    } else if (g.phase === 'crash') {
      g.vy = Math.min(MAX_FALL * 1.4, g.vy + GRAVITY * dt);
      g.py += g.vy * dt;
      g.rot += dt * 9;
      if (t >= g.endT) {
        g.phase = 'done';
        finish(false);
      }
    } else if (g.phase === 'won') {
      g.planeScale = Math.max(0, g.planeScale - dt * 2);
      if (t >= g.endT) {
        g.phase = 'done';
        finish(true);
      }
    }

    // trail
    if (g.phase === 'fly' || g.phase === 'final' || g.phase === 'ready') {
      g.trailT -= dt;
      if (g.trailT <= 0) {
        g.trailT = 0.055;
        const k = Math.random();
        const tailX = g.px - Math.cos(g.rot) * 22;
        const tailY = g.py - Math.sin(g.rot) * 22;
        g.fx.push({ x: g.d + tailX, y: tailY + rand(-3, 3), vx: rand(-30, -5), vy: rand(-20, 20), life: 0.9, max: 0.9, kind: k < 0.45 ? 'heart' : 'spark', size: k < 0.45 ? rand(6, 9) : rand(3, 5), color: k < 0.45 ? (dark ? '#ff9cc2' : '#ff85b1') : dark ? '#bfe0ff' : '#fff', rot: rand(0, 6) });
      }
    }
    for (const p of g.fx) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy = p.vy * 0.96 + (p.kind === 'paper' ? 300 : 0) * dt;
      p.rot += dt * 3;
    }
    g.fx = g.fx.filter((p) => p.life > 0);
    g.texts = g.texts.filter((x) => t - x.t0 < 1);

    // ── draw ──
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    if (g.shake) ctx.translate(rand(-g.shake, g.shake), rand(-g.shake, g.shake));
    drawSky(ctx, W, H, g.d, t, dark);
    drawLandscape(ctx, W, H, g.d, t, dark);

    // heart-window + parting cloud banks
    const hxs = g.heartX - g.d;
    if (hxs < W + S * 1.6) {
      drawHeartWindow(ctx, hxs, hy, S, t, dark, g.pulse);
      const ease = g.part * g.part * (3 - 2 * g.part);
      const open = ease * H * 0.75;
      drawColumn(ctx, hxs, hy + 6 - open, -1, g.bankTop, 150, H, dark);
      drawColumn(ctx, hxs, hy - 6 + open, 1, g.bankBot, 150, H, dark);
    }

    // cloud gates
    for (const gt of g.gates) {
      const sx = gt.x - g.d;
      if (sx < -120 || sx > W + 120) continue;
      drawColumn(ctx, sx, (gt.cf - gt.gf / 2) * H, -1, gt.top, 26, H, dark);
      drawColumn(ctx, sx, (gt.cf + gt.gf / 2) * H, 1, gt.bot, 26, H, dark);
    }

    // collectible hearts
    for (const h of g.hearts) {
      if (h.taken) continue;
      const x = h.x - g.d;
      if (x < -40 || x > W + 40) continue;
      const y = h.yf * H + Math.sin(t * 2.5 + h.p) * 6;
      const gl = ctx.createRadialGradient(x, y, 2, x, y, 30);
      gl.addColorStop(0, dark ? 'rgba(255,130,190,0.55)' : 'rgba(255,255,255,0.8)');
      gl.addColorStop(1, 'rgba(255,150,200,0)');
      ctx.fillStyle = gl;
      ctx.fillRect(x - 30, y - 30, 60, 60);
      const sz = 26 + Math.sin(t * 6 + h.p) * 2;
      heartAt(ctx, x, y, sz, '#ff6f9f');
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.beginPath();
      ctx.ellipse(x - sz * 0.2, y - sz * 0.2, sz * 0.12, sz * 0.08, -0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      sparkle(ctx, x + 14 * Math.cos(t * 2 + h.p), y - 14 * Math.sin(t * 2 + h.p), 3.5, t);
    }

    // particles (behind the plane)
    for (const p of g.fx) {
      const a = Math.max(0, p.life / p.max);
      const x = p.x - g.d;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      if (p.kind === 'heart') heartAt(ctx, x, p.y, p.size * (0.5 + a * 0.6), p.color);
      else if (p.kind === 'spark') sparkle(ctx, x, p.y, p.size * (0.6 + a * 0.6), p.rot);
      else if (p.kind === 'paper') {
        ctx.translate(x, p.y);
        ctx.rotate(p.rot);
        ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.66);
      } else {
        ctx.globalAlpha = a * 0.7;
        ctx.beginPath();
        ctx.arc(x, p.y, p.size * (1.4 - a * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    if (g.planeScale > 0.01) drawPlane(ctx, g.px, g.py, g.rot, g.flap, g.planeScale, dark);

    // floating text
    for (const tx of g.texts) {
      const k = (t - tx.t0) / 1;
      ctx.save();
      ctx.globalAlpha = 1 - k * k;
      ctx.font = `700 ${tx.small ? 15 : 20}px Fredoka, sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 5;
      ctx.strokeStyle = dark ? '#2a2245' : '#fff';
      const x = tx.x - g.d;
      const y = tx.y - k * 30;
      ctx.strokeText(tx.text, x, y);
      ctx.fillStyle = tx.small ? (dark ? '#bfe0ff' : '#6c63d9') : '#f2629a';
      ctx.fillText(tx.text, x, y);
      ctx.restore();
    }

    // flash
    if (g.flash > 0) {
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.fillStyle = g.crashed ? `rgba(255,120,150,${g.flash * 0.35})` : `rgba(255,240,250,${g.flash * 0.6})`;
      ctx.fillRect(0, 0, W, H);
    }
  }, running);

  return (
    <Stage className="l10-stage" onPointerDown={(e) => { e.preventDefault(); flap(); }}>
      <canvas ref={canvasRef} className="l10-canvas" aria-label="Paper plane flying game" />
      <GameHud className="l10-hud">
        <div className="l10-progress" role="progressbar" aria-valuenow={passed} aria-valuemax={GATES}>
          <div className="l10-progress-fill" style={{ transform: `scaleX(${passed / GATES})` }} />
          <span className="l10-progress-text">
            To her heart 💗 {passed}/{GATES}
          </span>
          <span className="l10-progress-plane" style={{ '--k': passed / GATES }}>
            ✉️
          </span>
        </div>
        <HudPill icon={<Heart size={18} />} value={score} />
      </GameHud>
      {ready && (
        <div className="l10-hint">
          <span className="l10-tap" />
          Tap to fly!
        </div>
      )}
      {arrived && <div className="l10-arrived">you made it to my heart 💗</div>}
    </Stage>
  );
}
