/**
 * Level 1 — "Water Breathing" (Demon Slayer)
 *
 * Tanjiro, Nezuko, Kasugai crows and glowing demon wisps / lanterns fly across a
 * wisteria-framed moonlit sky. Drag / swipe to draw a flowing Water Breathing slash.
 *  - wisps, lanterns and crows  → +1 (water-droplet burst)
 *  - Nezuko                     → strike + time penalty (3 strikes = fail)
 *  - Tanjiro                    → harmless, he's on our side (he carries orbiting wisps)
 * Keyboard: arrows move the aim reticle, Space / Enter does a "Water Wheel" ring slash.
 */
import { useEffect, useRef, useState } from 'react';
import { Stage, GameHud, HudPill, TimerBar } from './kit.jsx';
import { Heart } from '../components/Icons';
import { sound } from '../audio/soundManager';
import './Level01DemonSlayer.css';

/* ───────────── Tunables ───────────── */
const GOAL = 15; // targets to slash
const TIME_LIMIT = 40; // seconds
const MAX_STRIKES = 3; // Nezuko hits allowed before failing
const NEZUKO_TIME_PENALTY = 3; // seconds lost per Nezuko hit
const TRAIL_LIFE = 0.3; // seconds a slash trail lingers
const TRAIL_WIDTH = 24; // max ribbon width (logical px)
const SPAWN_START = 0.8; // seconds between spawns at the start…
const SPAWN_END = 0.5; // …and at the end
const SPEED_RAMP = 0.6; // flight speed multiplier gained across the timer (1 → 1.6)
const ENTITY_SCALE = 1.15; // draw + hitbox scale of all flyers
const HIT_PAD = 9; // forgiveness added to target hit radius (not Nezuko)
const WHEEL_RADIUS = 85; // keyboard Water Wheel slash radius
const WHEEL_COOLDOWN = 0.9;
const AIM_SPEED = 420; // keyboard reticle speed
const MIN_W = 620; // minimum visible logical area — the canvas adapts to any aspect
const MIN_H = 520;

/* ───────────── Helpers ───────────── */
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const TAU = Math.PI * 2;

function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function lerpColor(a, b, t) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const r = Math.round(lerp((pa >> 16) & 255, (pb >> 16) & 255, t));
  const g = Math.round(lerp((pa >> 8) & 255, (pb >> 8) & 255, t));
  const bl = Math.round(lerp(pa & 255, pb & 255, t));
  return `rgb(${r},${g},${bl})`;
}

/** Does segment AB pass within r of point C? */
function segHit(ax, ay, bx, by, cx, cy, r) {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  const t = l2 ? clamp(((cx - ax) * dx + (cy - ay) * dy) / l2, 0, 1) : 0;
  const px = ax + t * dx - cx;
  const py = ay + t * dy - cy;
  return px * px + py * py <= r * r;
}

const isDark = () => document.documentElement.dataset.theme === 'dark';

function makeCheckerTile() {
  const c = document.createElement('canvas');
  c.width = c.height = 10;
  const g = c.getContext('2d');
  g.fillStyle = '#17191f';
  g.fillRect(0, 0, 10, 10);
  g.fillStyle = '#2fa36b';
  g.fillRect(0, 0, 5, 5);
  g.fillRect(5, 5, 5, 5);
  return c;
}

/* ───────────── Background (cached per size + theme) ───────────── */
function buildBackground(W, H, k, dark) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(W * k));
  c.height = Math.max(1, Math.round(H * k));
  const g = c.getContext('2d');
  g.setTransform(k, 0, 0, k, 0, 0);
  const rnd = mulberry32(1015);

  // sky
  const sky = g.createLinearGradient(0, 0, 0, H);
  if (dark) {
    sky.addColorStop(0, '#060a22');
    sky.addColorStop(0.5, '#121a46');
    sky.addColorStop(1, '#2a2357');
  } else {
    sky.addColorStop(0, '#7e8fda');
    sky.addColorStop(0.42, '#c3b2e8');
    sky.addColorStop(0.78, '#f8c8d8');
    sky.addColorStop(1, '#ffe2c9');
  }
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);

  // stars
  const starCount = dark ? 150 : 45;
  for (let i = 0; i < starCount; i++) {
    const x = rnd() * W;
    const y = rnd() * H * 0.75;
    const r = rnd() * 1.3 + 0.3;
    g.globalAlpha = dark ? 0.35 + rnd() * 0.65 : 0.2 + rnd() * 0.35;
    g.fillStyle = '#fff';
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.fill();
  }
  g.globalAlpha = 1;

  // full moon
  const mr = 48;
  const mx = W * 0.76;
  const my = Math.max(H * 0.22, 200);
  const glow = g.createRadialGradient(mx, my, mr * 0.6, mx, my, mr * 3.4);
  glow.addColorStop(0, dark ? 'rgba(255,240,205,0.42)' : 'rgba(255,252,238,0.65)');
  glow.addColorStop(1, 'rgba(255,240,205,0)');
  g.fillStyle = glow;
  g.fillRect(mx - mr * 4, my - mr * 4, mr * 8, mr * 8);
  const disc = g.createRadialGradient(mx - mr * 0.35, my - mr * 0.35, mr * 0.1, mx, my, mr);
  disc.addColorStop(0, '#fffef6');
  disc.addColorStop(1, dark ? '#f6dfa6' : '#ffe8cc');
  g.fillStyle = disc;
  g.beginPath();
  g.arc(mx, my, mr, 0, TAU);
  g.fill();
  g.fillStyle = dark ? 'rgba(210,175,120,0.28)' : 'rgba(230,190,160,0.3)';
  [
    [-14, -10, 9],
    [16, 8, 11],
    [-6, 20, 6],
    [20, -18, 5],
  ].forEach(([dx, dy, r]) => {
    g.beginPath();
    g.arc(mx + dx, my + dy, r, 0, TAU);
    g.fill();
  });

  // soft cloud streaks across the moon
  g.fillStyle = dark ? 'rgba(170,150,230,0.22)' : 'rgba(255,255,255,0.45)';
  [
    [mx - 70, my + 24, 90, 9],
    [mx + 30, my + 40, 70, 7],
    [W * 0.2, H * 0.4, 110, 10],
    [W * 0.32, H * 0.43, 70, 7],
  ].forEach(([x, y, rx, ry]) => {
    g.beginPath();
    g.ellipse(x, y, rx, ry, 0, 0, TAU);
    g.fill();
  });

  // distant mountains
  const layers = dark
    ? [
        ['#262b63', 0.78, 40],
        ['#171a44', 0.86, 28],
      ]
    : [
        ['#b9a0dc', 0.78, 40],
        ['#a287cc', 0.87, 28],
      ];
  layers.forEach(([col, base, amp], li) => {
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(0, H);
    for (let x = 0; x <= W + 20; x += 20) {
      const y = H * base - Math.abs(Math.sin(x * 0.006 + li * 2)) * amp - Math.sin(x * 0.021 + li) * amp * 0.3;
      g.lineTo(x, y);
    }
    g.lineTo(W, H);
    g.closePath();
    g.fill();
  });

  drawWisteria(g, W, H, dark, rnd);
  return c;
}

function drawWisteria(g, W, H, dark, rnd) {
  // branch
  g.strokeStyle = dark ? '#3b2b45' : '#8a6a6a';
  g.lineWidth = 6;
  g.lineCap = 'round';
  g.beginPath();
  for (let x = -10; x <= W + 10; x += 10) {
    const y = 8 + Math.sin(x * 0.03) * 5;
    if (x === -10) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.stroke();

  const topCol = dark ? '#7a5bcf' : '#9b7fe0';
  const tipCol = dark ? '#dccbff' : '#f4ecff';
  const maxLen = Math.min(175, H * 0.26);
  let x = rnd() * 20;
  if (dark) {
    g.shadowColor = 'rgba(200,170,255,0.55)';
    g.shadowBlur = 6;
  }
  while (x < W + 20) {
    const top = 8 + Math.sin(x * 0.03) * 5;
    const len = 45 + rnd() * (maxLen - 45);
    // leaves
    g.fillStyle = dark ? '#3e6b5a' : '#86bf8f';
    for (let i = 0; i < 4; i++) {
      g.save();
      g.translate(x + (rnd() - 0.5) * 22, top + 4 + rnd() * 8);
      g.rotate((rnd() - 0.5) * 1.6 + Math.PI / 2);
      g.beginPath();
      g.ellipse(0, 0, 9, 3.4, 0, 0, TAU);
      g.fill();
      g.restore();
    }
    // florets (top → bottom so lower ones overlap)
    const rows = Math.floor(len / 5.5);
    for (let k = 0; k <= rows; k++) {
      const t = k / rows;
      const y = top + 6 + t * len;
      const spread = 13 * Math.pow(1 - t, 0.85) + 2;
      for (let j = 0; j < 2; j++) {
        const fx = x + (rnd() * 2 - 1) * spread + Math.sin(t * 3) * 3;
        const r = 4.3 - t * 1.8;
        g.fillStyle = lerpColor(topCol, tipCol, t);
        g.beginPath();
        g.ellipse(fx, y, r, r * 0.85, 0, 0, TAU);
        g.fill();
        g.fillStyle = 'rgba(255,255,255,0.45)';
        g.beginPath();
        g.arc(fx - r * 0.3, y - r * 0.3, r * 0.35, 0, TAU);
        g.fill();
      }
    }
    x += 34 + rnd() * 30;
  }
  g.shadowBlur = 0;
}

/* ───────────── Character art (origin = centre, facing right) ───────────── */
function drawTanjiro(ctx, e, checker) {
  const t = e.t;
  // water swirl behind the blade
  ctx.strokeStyle = 'rgba(130,210,255,0.5)';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(34, -6, 40, -1.6 + Math.sin(t * 4) * 0.2, 0.4 + Math.sin(t * 4) * 0.2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(34, -6, 46, -1.3, 0.1);
  ctx.stroke();

  // legs (trailing back while flying)
  ctx.strokeStyle = '#232838';
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(-5, 30);
  ctx.lineTo(-18, 44 + Math.sin(t * 9) * 2);
  ctx.moveTo(6, 31);
  ctx.lineTo(-4, 48 - Math.sin(t * 9) * 2);
  ctx.stroke();
  ctx.fillStyle = '#f1ece2';
  ctx.beginPath();
  ctx.arc(-19, 46 + Math.sin(t * 9) * 2, 4, 0, TAU);
  ctx.arc(-5, 50 - Math.sin(t * 9) * 2, 4, 0, TAU);
  ctx.fill();

  // back arm (checkered sleeve)
  ctx.strokeStyle = checker;
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(-10, 8);
  ctx.lineTo(-21, 19);
  ctx.stroke();

  // haori body
  ctx.fillStyle = checker;
  ctx.beginPath();
  ctx.moveTo(-13, 2);
  ctx.lineTo(13, 2);
  ctx.lineTo(21, 35);
  ctx.quadraticCurveTo(0, 40, -21, 35);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  // uniform underneath + white belt
  ctx.fillStyle = '#1c2233';
  ctx.beginPath();
  ctx.moveTo(-6, 2);
  ctx.lineTo(6, 2);
  ctx.lineTo(7, 37);
  ctx.lineTo(-7, 37);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#f4f1ea';
  ctx.fillRect(-7, 22, 14, 4);

  // hair back (spiky, dark red)
  const hairGrad = ctx.createLinearGradient(0, -46, 0, 6);
  hairGrad.addColorStop(0, '#4a1010');
  hairGrad.addColorStop(1, '#a8322b');
  ctx.fillStyle = hairGrad;
  ctx.beginPath();
  const spikes = 11;
  for (let i = 0; i <= spikes * 2; i++) {
    const a = Math.PI * 0.82 + (i / (spikes * 2)) * Math.PI * 1.36;
    const r = i % 2 === 0 ? 31 : 22;
    const px = Math.cos(a) * r;
    const py = -16 + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();

  // head
  ctx.fillStyle = '#f7d5ba';
  ctx.beginPath();
  ctx.arc(0, -15, 20, 0, TAU);
  ctx.fill();
  // ears
  ctx.beginPath();
  ctx.ellipse(-20, -12, 3.5, 5, 0, 0, TAU);
  ctx.ellipse(20, -12, 3.5, 5, 0, 0, TAU);
  ctx.fill();
  // hanafuda earrings
  [-20, 20].forEach((ex) => {
    ctx.strokeStyle = '#8a6a4a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ex, -8);
    ctx.lineTo(ex, -5);
    ctx.stroke();
    ctx.save();
    ctx.translate(ex, -5);
    ctx.rotate(Math.sin(t * 6 + ex) * 0.25);
    ctx.fillStyle = '#fffaf0';
    ctx.strokeStyle = '#c23a2c';
    ctx.lineWidth = 0.9;
    ctx.fillRect(-3, 0, 6, 10);
    ctx.strokeRect(-3, 0, 6, 10);
    ctx.fillStyle = '#e0412f';
    ctx.beginPath();
    ctx.arc(0, 3.3, 2, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#e0412f';
    ctx.beginPath();
    ctx.moveTo(-2, 6.5);
    ctx.lineTo(2, 6.5);
    ctx.moveTo(-2, 8.3);
    ctx.lineTo(2, 8.3);
    ctx.stroke();
    ctx.restore();
  });

  // face
  drawEyes(ctx, -8, 8, -11, '#5a1414', '#b8423a', 4.6, 5.6);
  ctx.fillStyle = 'rgba(255,140,160,0.5)';
  ctx.beginPath();
  ctx.ellipse(-13, -4, 4, 2.4, 0, 0, TAU);
  ctx.ellipse(13, -4, 4, 2.4, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#7a2e3c';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(0, -4, 3.4, 0.2, Math.PI - 0.2);
  ctx.stroke();

  // fringe
  ctx.fillStyle = hairGrad;
  ctx.beginPath();
  ctx.moveTo(-21, -13);
  ctx.lineTo(-17, -29);
  ctx.lineTo(-12, -21);
  ctx.lineTo(-6, -31);
  ctx.lineTo(-1, -22);
  ctx.lineTo(5, -32);
  ctx.lineTo(10, -21);
  ctx.lineTo(16, -29);
  ctx.lineTo(21, -13);
  ctx.quadraticCurveTo(23, -40, 0, -42);
  ctx.quadraticCurveTo(-23, -40, -21, -13);
  ctx.fill();
  // forehead scar
  ctx.fillStyle = 'rgba(176,58,46,0.75)';
  ctx.beginPath();
  ctx.ellipse(-11, -22, 3.6, 2.6, -0.4, 0, TAU);
  ctx.fill();

  // front arm + nichirin sword
  ctx.strokeStyle = checker;
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(10, 8);
  ctx.lineTo(23, 15);
  ctx.stroke();
  ctx.strokeStyle = '#2a2a33';
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.moveTo(19, 21);
  ctx.lineTo(31, 11);
  ctx.stroke();
  ctx.fillStyle = '#f7d5ba';
  ctx.beginPath();
  ctx.arc(25, 16, 4.2, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#3a3a44';
  ctx.beginPath();
  ctx.arc(31, 11, 4.2, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#15161b';
  ctx.lineWidth = 3.6;
  ctx.beginPath();
  ctx.moveTo(32, 10);
  ctx.lineTo(70, -22);
  ctx.stroke();
  ctx.strokeStyle = '#9adfff';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(34, 7.5);
  ctx.lineTo(69, -23.5);
  ctx.stroke();
}

function drawEyes(ctx, lx, rx, y, dark, light, rxs, rys) {
  [lx, rx].forEach((x) => {
    const gr = ctx.createLinearGradient(0, y - rys, 0, y + rys);
    gr.addColorStop(0, dark);
    gr.addColorStop(1, light);
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.ellipse(x, y, rxs, rys, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x - 1.4, y - 2, 1.7, 0, TAU);
    ctx.arc(x + 1.5, y + 1.8, 0.8, 0, TAU);
    ctx.fill();
  });
}

function drawNezuko(ctx, e) {
  const t = e.t;
  const hurt = e.hurt > 0;
  const sway = Math.sin(t * 5) * 4;

  // long hair (dark → orange tips), streaming back
  const hair = ctx.createLinearGradient(0, -44, -10, 56);
  hair.addColorStop(0, '#24141c');
  hair.addColorStop(0.58, '#3b1c24');
  hair.addColorStop(0.83, '#e8743a');
  hair.addColorStop(1, '#ffad5e');
  ctx.fillStyle = hair;
  ctx.beginPath();
  ctx.moveTo(18, -32);
  ctx.bezierCurveTo(30, -8, 22, 22, 10 + sway * 0.4, 50);
  ctx.quadraticCurveTo(-4, 44 + sway, -12, 56 + sway);
  ctx.quadraticCurveTo(-22, 46, -36, 54 - sway);
  ctx.bezierCurveTo(-46, 22, -32, -8, -21, -30);
  ctx.quadraticCurveTo(0, -50, 18, -32);
  ctx.fill();

  // little legs
  ctx.strokeStyle = '#f9dcca';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-4, 34);
  ctx.lineTo(-14, 46);
  ctx.moveTo(5, 35);
  ctx.lineTo(-2, 49);
  ctx.stroke();

  // sleeves
  ctx.fillStyle = '#f39bbb';
  ctx.beginPath();
  ctx.ellipse(-16, 15, 7, 12, 0.35, 0, TAU);
  ctx.ellipse(16, 15, 7, 12, -0.35, 0, TAU);
  ctx.fill();

  // kimono body
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-12, 2);
  ctx.lineTo(12, 2);
  ctx.lineTo(19, 38);
  ctx.quadraticCurveTo(0, 42, -19, 38);
  ctx.closePath();
  ctx.fillStyle = '#f7b4cb';
  ctx.fill();
  ctx.clip();
  // asanoha-ish star pattern
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 0.8;
  for (let gy = 6; gy < 42; gy += 9) {
    for (let gx = -20 + ((gy / 9) % 2) * 5; gx < 22; gx += 10) {
      ctx.beginPath();
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI;
        ctx.moveTo(gx - Math.cos(a) * 2.6, gy - Math.sin(a) * 2.6);
        ctx.lineTo(gx + Math.cos(a) * 2.6, gy + Math.sin(a) * 2.6);
      }
      ctx.stroke();
    }
  }
  ctx.restore();
  // collar + obi
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-7, 2);
  ctx.lineTo(0, 12);
  ctx.lineTo(7, 2);
  ctx.stroke();
  ctx.fillStyle = '#8e2f3b';
  ctx.fillRect(-15, 17, 30, 8);
  ctx.strokeStyle = '#fff4e0';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-15, 21);
  ctx.lineTo(15, 21);
  ctx.stroke();

  // head
  ctx.fillStyle = '#fbe0cf';
  ctx.beginPath();
  ctx.arc(0, -15, 20, 0, TAU);
  ctx.fill();

  // eyes
  if (hurt) {
    ctx.strokeStyle = '#3a1a2a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-11, -14);
    ctx.lineTo(-6, -11);
    ctx.lineTo(-11, -8);
    ctx.moveTo(11, -14);
    ctx.lineTo(6, -11);
    ctx.lineTo(11, -8);
    ctx.stroke();
    // sweat drop
    ctx.fillStyle = '#9bd6ff';
    ctx.beginPath();
    ctx.moveTo(19, -30);
    ctx.quadraticCurveTo(24, -22, 19, -20);
    ctx.quadraticCurveTo(14, -22, 19, -30);
    ctx.fill();
  } else {
    drawEyes(ctx, -8, 8, -11, '#b0275e', '#ff8bb8', 4.8, 5.8);
  }
  // blush
  ctx.fillStyle = 'rgba(255,120,160,0.55)';
  ctx.beginPath();
  ctx.ellipse(-13, -5, 3.8, 2.2, 0, 0, TAU);
  ctx.ellipse(13, -5, 3.8, 2.2, 0, 0, TAU);
  ctx.fill();

  // bamboo muzzle + cord
  ctx.strokeStyle = '#a33a4a';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-13, -2);
  ctx.lineTo(-19, -9);
  ctx.moveTo(13, -2);
  ctx.lineTo(19, -9);
  ctx.stroke();
  const bam = ctx.createLinearGradient(0, -5, 0, 1);
  bam.addColorStop(0, '#9fd57d');
  bam.addColorStop(1, '#4a8f3c');
  ctx.fillStyle = bam;
  ctx.beginPath();
  ctx.roundRect(-14, -5, 28, 6.5, 3.2);
  ctx.fill();
  ctx.strokeStyle = '#356b2c';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-5, -5);
  ctx.lineTo(-5, 1.5);
  ctx.moveTo(6, -5);
  ctx.lineTo(6, 1.5);
  ctx.stroke();

  // bangs
  ctx.fillStyle = '#2a161e';
  ctx.beginPath();
  ctx.moveTo(-20, -10);
  ctx.quadraticCurveTo(-22, -38, 0, -37);
  ctx.quadraticCurveTo(22, -38, 20, -10);
  ctx.lineTo(16, -22);
  ctx.lineTo(11, -18);
  ctx.lineTo(7, -26);
  ctx.lineTo(1, -20);
  ctx.lineTo(-4, -27);
  ctx.lineTo(-9, -19);
  ctx.lineTo(-14, -24);
  ctx.closePath();
  ctx.fill();
  // pink ribbon
  ctx.save();
  ctx.translate(13, -33);
  ctx.rotate(0.35);
  ctx.fillStyle = '#ff7fa8';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-8, -6);
  ctx.lineTo(-8, 6);
  ctx.closePath();
  ctx.moveTo(0, 0);
  ctx.lineTo(8, -6);
  ctx.lineTo(8, 6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#e04f86';
  ctx.beginPath();
  ctx.arc(0, 0, 2.4, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawCrow(ctx, e, dark) {
  const f = Math.sin(e.t * 17);
  if (dark) {
    ctx.shadowColor = 'rgba(170,200,255,0.7)';
    ctx.shadowBlur = 12;
  }
  // tail
  ctx.fillStyle = '#1f1d2a';
  ctx.beginPath();
  ctx.moveTo(-14, -2);
  ctx.lineTo(-34, -8);
  ctx.lineTo(-36, 1);
  ctx.lineTo(-32, 8);
  ctx.lineTo(-14, 5);
  ctx.closePath();
  ctx.fill();
  // body
  const body = ctx.createRadialGradient(4, -6, 2, 0, 0, 24);
  body.addColorStop(0, '#4a4866');
  body.addColorStop(1, '#16141f');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, 0, 21, 13, -0.1, 0, TAU);
  ctx.fill();
  // head
  ctx.beginPath();
  ctx.arc(15, -8, 11, 0, TAU);
  ctx.fill();
  ctx.shadowBlur = 0;
  // beak
  ctx.fillStyle = '#f2a63b';
  ctx.beginPath();
  ctx.moveTo(24, -11);
  ctx.lineTo(35, -7);
  ctx.lineTo(24, -4);
  ctx.closePath();
  ctx.fill();
  // eye
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(18, -10, 3.8, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#16141f';
  ctx.beginPath();
  ctx.arc(19, -10, 2.2, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(19.6, -11, 0.8, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,130,170,0.6)';
  ctx.beginPath();
  ctx.ellipse(14, -3, 3, 1.6, 0, 0, TAU);
  ctx.fill();
  // feet
  ctx.strokeStyle = '#f2a63b';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-2, 12);
  ctx.lineTo(-5, 18);
  ctx.moveTo(4, 12);
  ctx.lineTo(2, 18);
  ctx.stroke();
  // wing
  const tipX = -20;
  const tipY = -4 - 24 * f;
  ctx.fillStyle = '#2b2939';
  ctx.beginPath();
  ctx.moveTo(6, -4);
  ctx.quadraticCurveTo(-4, tipY - 4, tipX, tipY);
  ctx.lineTo(tipX + 6, tipY + 6 * Math.sign(f || 1));
  ctx.lineTo(tipX + 4, tipY + 10 * Math.sign(f || 1));
  ctx.quadraticCurveTo(-8, 4, 6, 2);
  ctx.closePath();
  ctx.fill();
}

function drawWisp(ctx, e, dark) {
  const t = e.t;
  // halo
  const prev = ctx.globalCompositeOperation;
  if (dark) ctx.globalCompositeOperation = 'lighter';
  const halo = ctx.createRadialGradient(0, 4, 4, 0, 4, 50);
  halo.addColorStop(0, 'rgba(230,120,255,0.55)');
  halo.addColorStop(1, 'rgba(230,120,255,0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(0, 4, 50, 0, TAU);
  ctx.fill();
  ctx.globalCompositeOperation = prev;
  // flame body
  const tip = Math.sin(t * 8) * 6;
  const fl = ctx.createRadialGradient(0, 8, 2, 0, 4, 28);
  fl.addColorStop(0, '#fff6fc');
  fl.addColorStop(0.35, '#ffb3e3');
  fl.addColorStop(0.75, '#c95ce6');
  fl.addColorStop(1, '#7a2bb8');
  ctx.fillStyle = fl;
  ctx.beginPath();
  ctx.moveTo(tip, -30);
  ctx.bezierCurveTo(12 + tip * 0.3, -16, 22, -2, 19, 10);
  ctx.bezierCurveTo(15, 25, -15, 25, -19, 10);
  ctx.bezierCurveTo(-22, -2, -12 + tip * 0.3, -16, tip, -30);
  ctx.fill();
  // side flicks
  ctx.beginPath();
  ctx.moveTo(-14, -2);
  ctx.quadraticCurveTo(-24, -10, -20 - tip * 0.3, -20);
  ctx.quadraticCurveTo(-16, -8, -10, -6);
  ctx.moveTo(14, -2);
  ctx.quadraticCurveTo(24, -8, 21 + tip * 0.3, -17);
  ctx.quadraticCurveTo(16, -6, 10, -6);
  ctx.fill();
  // cute grumpy demon face
  ctx.fillStyle = '#3b0f3f';
  ctx.beginPath();
  ctx.ellipse(-6, 7, 2.6, 3.2, 0, 0, TAU);
  ctx.ellipse(6, 7, 2.6, 3.2, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#3b0f3f';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-10, 1);
  ctx.lineTo(-3, 3.5);
  ctx.moveTo(10, 1);
  ctx.lineTo(3, 3.5);
  ctx.moveTo(-4, 14);
  ctx.quadraticCurveTo(0, 12, 4, 14);
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(1.2, 13);
  ctx.lineTo(3, 16);
  ctx.lineTo(3.6, 13.3);
  ctx.fill();
}

function drawLantern(ctx, e, dark) {
  const t = e.t;
  ctx.rotate(Math.sin(t * 3) * 0.14);
  const prev = ctx.globalCompositeOperation;
  if (dark) ctx.globalCompositeOperation = 'lighter';
  const halo = ctx.createRadialGradient(0, 0, 6, 0, 0, 52);
  halo.addColorStop(0, 'rgba(255,170,80,0.55)');
  halo.addColorStop(1, 'rgba(255,140,60,0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(0, 0, 52, 0, TAU);
  ctx.fill();
  ctx.globalCompositeOperation = prev;
  // string
  ctx.strokeStyle = '#3b2a2a';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(0, -25);
  ctx.lineTo(0, -36);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, -39, 3, 0, TAU);
  ctx.stroke();
  // paper body
  const body = ctx.createRadialGradient(-4, -4, 2, 0, 0, 24);
  body.addColorStop(0, '#fff6c4');
  body.addColorStop(0.45, '#ffad4d');
  body.addColorStop(1, '#de3f2c');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, 0, 18, 22, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(120,30,20,0.35)';
  ctx.lineWidth = 1;
  for (let y = -15; y <= 15; y += 6) {
    const w = 18 * Math.sqrt(1 - (y * y) / (22 * 22));
    ctx.beginPath();
    ctx.moveTo(-w, y);
    ctx.quadraticCurveTo(0, y + 3, w, y);
    ctx.stroke();
  }
  ctx.fillStyle = '#2b1d1d';
  ctx.beginPath();
  ctx.roundRect(-9, -26, 18, 6, 2);
  ctx.roundRect(-9, 20, 18, 6, 2);
  ctx.fill();
  ctx.fillStyle = '#7a1d1d';
  ctx.font = 'bold 15px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('鬼', 0, 1);
  // tassel
  ctx.strokeStyle = '#d23a3a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 26);
  ctx.lineTo(Math.sin(t * 3) * 2, 36);
  ctx.stroke();
}

/* ───────────── Slash ribbon ───────────── */
function ribbon(ctx, pts, widths, offs, frac) {
  const n = pts.length;
  const L = [];
  const R = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    let dx = b.x - a.x;
    let dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const w = widths[i] * frac;
    const o = offs ? offs[i] : 0;
    L.push([pts[i].x + nx * (w + o), pts[i].y + ny * (w + o)]);
    R.push([pts[i].x - nx * (w - o), pts[i].y - ny * (w - o)]);
  }
  ctx.beginPath();
  ctx.moveTo(L[0][0], L[0][1]);
  for (let i = 1; i < n; i++) ctx.lineTo(L[i][0], L[i][1]);
  for (let i = n - 1; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]);
  ctx.closePath();
  ctx.fill();
  return L;
}

function drawStroke(ctx, stroke, now, dark) {
  const pts = stroke.pts;
  const n = pts.length;
  if (n < 2) return;
  const widths = [];
  const offs = [];
  for (let i = 0; i < n; i++) {
    const life = clamp(1 - (now - pts[i].t) / TRAIL_LIFE, 0, 1);
    const u = i / (n - 1); // 0 = tail, 1 = head
    const taper = Math.sin(Math.min(1, u * 1.15) * Math.PI * 0.5) * (u > 0.94 ? 0.55 + ((1 - u) / 0.06) * 0.45 : 1);
    const w = TRAIL_WIDTH * life * taper;
    widths.push(w);
    offs.push(Math.sin(i * 0.5 - now * 16) * w * 0.32);
  }
  const head = pts[n - 1];
  const tail = pts[0];
  const grad = (c0, c1) => {
    const g = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y);
    g.addColorStop(0, c0);
    g.addColorStop(1, c1);
    return g;
  };
  ctx.save();
  ctx.shadowColor = dark ? 'rgba(90,170,255,0.9)' : 'rgba(60,130,230,0.6)';
  ctx.shadowBlur = 16;
  ctx.fillStyle = grad('rgba(40,100,220,0.05)', 'rgba(40,110,225,0.42)');
  const outer = ribbon(ctx, pts, widths, null, 1);
  ctx.shadowBlur = 0;
  ctx.fillStyle = grad('rgba(110,190,255,0.1)', 'rgba(120,205,255,0.75)');
  ribbon(ctx, pts, widths, offs, 0.62);
  ctx.fillStyle = grad('rgba(255,255,255,0.15)', 'rgba(255,255,255,0.97)');
  ribbon(ctx, pts, widths, null, 0.2);

  // Hokusai-style curls along the outer crest
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  for (let i = 3; i < n - 2; i += 5) {
    const w = widths[i];
    if (w < 7) continue;
    const a = pts[i - 1];
    const b = pts[i + 1];
    const dir = Math.atan2(b.y - a.y, b.x - a.x);
    const [cx, cy] = outer[i];
    const R = w * 0.42;
    ctx.beginPath();
    for (let s = 0; s <= 14; s++) {
      const ang = dir + Math.PI + (s / 14) * Math.PI * 1.7;
      const r = R * (1 - (s / 14) * 0.65);
      const px = cx + Math.cos(ang) * r;
      const py = cy + Math.sin(ang) * r;
      if (s === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/* ───────────── Component ───────────── */
function DropIcon() {
  return (
    <svg width="16" height="18" viewBox="0 0 16 18" aria-hidden>
      <path d="M8 1C8 1 2 8.5 2 12a6 6 0 0 0 12 0C14 8.5 8 1 8 1z" fill="#6fb8ff" stroke="#3a7fd0" strokeWidth="1.2" />
      <circle cx="6" cy="11.5" r="1.6" fill="#fff" opacity=".8" />
    </svg>
  );
}

export default function Level01DemonSlayer({ onWin, onFail }) {
  const canvasRef = useRef(null);
  const ended = useRef(false);
  const cbs = useRef({ onWin, onFail });
  cbs.current = { onWin, onFail };
  const [hud, setHud] = useState({ score: 0, left: TIME_LIMIT, strikes: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const checker = ctx.createPattern(makeCheckerTile(), 'repeat');

    let W = MIN_W;
    let H = MIN_H;
    let scale = 1;
    let dpr = 1;
    let bg = null;
    let bgKey = '';
    const fit = () => {
      const r = canvas.getBoundingClientRect();
      if (!r.width || !r.height) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      scale = Math.min(r.width / MIN_W, r.height / MIN_H);
      W = r.width / scale;
      H = r.height / scale;
      bgKey = '';
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(canvas);

    const S = {
      time: 0,
      left: TIME_LIMIT,
      score: 0,
      strikes: 0,
      spawnT: 0.55,
      entities: [],
      particles: [],
      texts: [],
      strokes: [],
      petals: [],
      shake: 0,
      redFlash: 0,
      aim: { x: W / 2, y: H / 2 },
      keys: {},
      reticle: false,
      wheelCd: 0,
      done: false,
    };
    let strokeId = 0;
    let activeStroke = null;
    for (let i = 0; i < 26; i++) S.petals.push(newPetal(true));

    function newPetal(anywhere) {
      return {
        x: rand(-20, W + 20),
        y: anywhere ? rand(0, H) : -15,
        vx: rand(-25, 15),
        vy: rand(22, 48),
        rot: rand(0, TAU),
        vr: rand(-2, 2),
        size: rand(3.5, 6.5),
        pink: Math.random() < 0.6,
      };
    }

    let hudKey = '';
    const pushHud = () => {
      const k = `${S.score}|${Math.ceil(S.left * 10)}|${S.strikes}`;
      if (k !== hudKey) {
        hudKey = k;
        setHud({ score: S.score, left: S.left, strikes: S.strikes });
      }
    };

    const end = (won, reason) => {
      if (ended.current || S.done) return;
      ended.current = true;
      S.done = true;
      if (activeStroke) activeStroke.active = false;
      pushHud();
      if (won) cbs.current.onWin();
      else cbs.current.onFail(reason);
    };

    /* ── spawning ── */
    const countType = (type) => S.entities.reduce((n, e) => n + (e.type === type && !e.dead ? 1 : 0), 0);
    const crossing = (type, speed, r, extra = {}) => {
      const dir = Math.random() < 0.5 ? 1 : -1;
      const e = {
        type,
        mode: 'cross',
        x: dir === 1 ? -70 : W + 70,
        baseY: rand(Math.max(150, H * 0.2), H * 0.84),
        y: 0,
        vx: dir * speed,
        amp: rand(14, 40),
        freq: rand(1.6, 3),
        phase: rand(0, TAU),
        r,
        t: rand(0, 5),
        hurt: 0,
        ...extra,
      };
      e.y = e.baseY;
      S.entities.push(e);
      return e;
    };
    const spawn = () => {
      const r = Math.random();
      if (r < 0.12 && countType('tanjiro') < 1) {
        const tj = crossing('tanjiro', rand(140, 175), 30, { amp: 22 });
        for (let i = 0; i < 2; i++) {
          S.entities.push({
            type: Math.random() < 0.5 ? 'wisp' : 'lantern',
            mode: 'orbit',
            parent: tj,
            phase: i * Math.PI,
            x: tj.x,
            y: tj.y,
            r: 22,
            t: rand(0, 5),
            hurt: 0,
          });
        }
      } else if (r < 0.25 && countType('nezuko') < 2) {
        crossing('nezuko', rand(115, 160), 22, { amp: 30 });
      } else if (r < 0.48) {
        crossing('crow', rand(165, 225), 22, { amp: 18, freq: 3.4 });
      } else {
        const type = Math.random() < 0.6 ? 'wisp' : 'lantern';
        if (Math.random() < 0.6) {
          crossing(type, rand(120, 190), 22);
        } else {
          // tossed up from below, arcing back down
          const g = 520;
          const h = H * rand(0.45, 0.72);
          S.entities.push({
            type,
            mode: 'toss',
            x: rand(W * 0.15, W * 0.85),
            y: H + 40,
            vx: rand(-70, 70),
            vy: -Math.sqrt(2 * g * h),
            g,
            r: 22,
            t: rand(0, 5),
            hurt: 0,
          });
        }
      }
    };

    /* ── effects ── */
    const floatText = (x, y, text, color, size = 26) => S.texts.push({ x, y, text, color, size, life: 0.9, max: 0.9 });
    const splash = (e) => {
      for (let i = 0; i < 18; i++) {
        const a = rand(0, TAU);
        const sp = rand(120, 360);
        S.particles.push({
          kind: 'drop',
          x: e.x,
          y: e.y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp - 80,
          size: rand(2.4, 5),
          life: rand(0.5, 0.85),
          max: 0.85,
          color: Math.random() < 0.3 ? '#ffffff' : Math.random() < 0.5 ? '#8fd3ff' : '#4fa3f0',
        });
      }
      S.particles.push({ kind: 'ring', x: e.x, y: e.y, size: 10, life: 0.45, max: 0.45 });
      if (e.type === 'crow') {
        for (let i = 0; i < 6; i++) {
          S.particles.push({
            kind: 'feather',
            x: e.x,
            y: e.y,
            vx: rand(-120, 120),
            vy: rand(-160, -20),
            rot: rand(0, TAU),
            vr: rand(-6, 6),
            size: rand(5, 8),
            life: 1,
            max: 1,
          });
        }
      }
    };
    const foam = (x, y) => {
      S.particles.push({
        kind: 'foam',
        x: x + rand(-6, 6),
        y: y + rand(-6, 6),
        vx: rand(-50, 50),
        vy: rand(-50, 30),
        size: rand(1.4, 3.6),
        life: rand(0.3, 0.55),
        max: 0.55,
      });
    };

    /* ── slashing ── */
    const hitTest = (a, b, stroke) => {
      if (S.done) return;
      for (const e of S.entities) {
        if (e.dead || e.type === 'tanjiro') continue;
        const isNez = e.type === 'nezuko';
        const r = e.r * ENTITY_SCALE + (isNez ? 0 : HIT_PAD);
        if (!segHit(a.x, a.y, b.x, b.y, e.x, e.y, r)) continue;
        if (isNez) {
          if (e.hurt > 0 || e.hitBy === stroke.id) continue;
          e.hurt = 0.9;
          e.hitBy = stroke.id;
          S.strikes += 1;
          S.left = Math.max(0, S.left - NEZUKO_TIME_PENALTY);
          sound.sfx.bad();
          S.shake = 12;
          S.redFlash = 1;
          floatText(e.x, e.y - 40, 'Not Nezuko!', '#ff5d8f', 22);
          floatText(e.x, e.y - 14, `-${NEZUKO_TIME_PENALTY}s`, '#ff5d7a', 20);
          if (S.strikes >= MAX_STRIKES) end(false, 'You slashed Nezuko three times! She’s on our side, pillu!');
        } else {
          e.dead = true;
          S.score += 1;
          stroke.hits += 1;
          splash(e);
          sound.sfx.hit();
          S.shake = Math.max(S.shake, 4);
          floatText(e.x, e.y - 20, '+1', '#ffffff');
          if (S.score >= GOAL) end(true);
        }
        if (S.done) return;
      }
    };

    const toLogical = (ev) => {
      const r = canvas.getBoundingClientRect();
      return { x: (ev.clientX - r.left) / scale, y: (ev.clientY - r.top) / scale };
    };

    const addPoint = (stroke, p) => {
      const pts = stroke.pts;
      const last = pts[pts.length - 1];
      const d = Math.hypot(p.x - last.x, p.y - last.y);
      if (d < 2) return;
      if (S.time - stroke.lastMove > 0.25 && d > 14) sound.sfx.slash();
      stroke.lastMove = S.time;
      const steps = Math.ceil(d / 9);
      for (let k = 1; k <= steps; k++) {
        const q = { x: lerp(last.x, p.x, k / steps), y: lerp(last.y, p.y, k / steps), t: S.time };
        pts.push(q);
        if (k % 2 === 0) foam(q.x, q.y);
      }
      hitTest(last, p, stroke);
    };

    const onDown = (ev) => {
      if (S.done) return;
      ev.preventDefault();
      try {
        canvas.setPointerCapture(ev.pointerId);
      } catch {
        /* ignore */
      }
      const p = toLogical(ev);
      S.aim = p;
      S.reticle = false;
      activeStroke = { pts: [{ ...p, t: S.time }], active: true, id: ++strokeId, hits: 0, lastMove: S.time };
      S.strokes.push(activeStroke);
      sound.sfx.slash();
    };
    const onMove = (ev) => {
      const p = toLogical(ev);
      S.aim = p;
      if (!activeStroke || S.done) return;
      const evs = ev.getCoalescedEvents ? ev.getCoalescedEvents() : [];
      if (evs.length > 1) evs.forEach((ce) => activeStroke && addPoint(activeStroke, toLogical(ce)));
      else addPoint(activeStroke, p);
    };
    const onUp = () => {
      if (!activeStroke) return;
      activeStroke.active = false;
      if (activeStroke.hits >= 2 && !S.done) {
        const h = activeStroke.pts[activeStroke.pts.length - 1];
        floatText(h.x, h.y - 30, `Combo ×${activeStroke.hits}!`, '#ffd36e', 22);
        sound.sfx.sparkle();
      }
      activeStroke = null;
    };

    const waterWheel = () => {
      if (S.done || S.wheelCd > 0) return;
      S.wheelCd = WHEEL_COOLDOWN;
      const { x, y } = S.aim;
      const stroke = { pts: [], active: false, id: ++strokeId, hits: 0, lastMove: S.time };
      const N = 34;
      for (let i = 0; i <= N; i++) {
        const a = -Math.PI / 2 + (i / N) * TAU * 1.05;
        stroke.pts.push({ x: x + Math.cos(a) * WHEEL_RADIUS, y: y + Math.sin(a) * WHEEL_RADIUS, t: S.time - (1 - i / N) * 0.12 });
      }
      S.strokes.push(stroke);
      sound.sfx.slash();
      for (let i = 1; i < stroke.pts.length && !S.done; i++) hitTest(stroke.pts[i - 1], stroke.pts[i], stroke);
      for (let i = 0; i < stroke.pts.length; i += 2) foam(stroke.pts[i].x, stroke.pts[i].y);
      if (stroke.hits >= 2 && !S.done) floatText(x, y - WHEEL_RADIUS - 10, `Combo ×${stroke.hits}!`, '#ffd36e', 22);
    };

    const AIM_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
    const onKeyDown = (ev) => {
      if (S.done) return;
      if (ev.code === 'Space' || ev.code === 'Enter') {
        ev.preventDefault();
        if (!ev.repeat) {
          S.reticle = true;
          waterWheel();
        }
      } else if (AIM_KEYS.includes(ev.key)) {
        ev.preventDefault();
        S.keys[ev.key] = true;
        S.reticle = true;
      }
    };
    const onKeyUp = (ev) => {
      S.keys[ev.key] = false;
    };

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    /* ── update ── */
    const update = (dt) => {
      S.time += dt;
      S.left -= dt;
      const progress = clamp(S.time / TIME_LIMIT, 0, 1);
      const sm = 1 + SPEED_RAMP * progress;

      S.spawnT -= dt;
      if (S.spawnT <= 0) {
        spawn();
        S.spawnT = lerp(SPAWN_START, SPAWN_END, progress) * rand(0.75, 1.25);
      }

      const edt = dt * sm;
      for (const e of S.entities) {
        e.t += dt;
        if (e.hurt > 0) e.hurt -= dt;
        if (e.mode === 'cross') {
          e.x += e.vx * edt;
          e.y = e.baseY + Math.sin(e.t * e.freq + e.phase) * e.amp;
          if ((e.vx > 0 && e.x > W + 90) || (e.vx < 0 && e.x < -90)) e.gone = true;
        } else if (e.mode === 'toss') {
          e.vy += e.g * edt;
          e.x += e.vx * edt;
          e.y += e.vy * edt;
          if (e.vy > 0 && e.y > H + 60) e.gone = true;
        } else if (e.mode === 'orbit') {
          const p = e.parent;
          e.x = p.x + Math.cos(e.t * 2.6 + e.phase) * 62 * ENTITY_SCALE;
          e.y = p.y + Math.sin(e.t * 2.6 + e.phase) * 44 * ENTITY_SCALE;
          if (p.gone) e.gone = true;
        }
      }
      S.entities = S.entities.filter((e) => !e.dead && !e.gone);

      // keyboard aim
      const k = S.keys;
      const ax = (k.ArrowRight ? 1 : 0) - (k.ArrowLeft ? 1 : 0);
      const ay = (k.ArrowDown ? 1 : 0) - (k.ArrowUp ? 1 : 0);
      if (ax || ay) {
        S.aim = { x: clamp(S.aim.x + ax * AIM_SPEED * dt, 0, W), y: clamp(S.aim.y + ay * AIM_SPEED * dt, 0, H) };
      }
      S.wheelCd = Math.max(0, S.wheelCd - dt);

      for (const p of S.particles) {
        p.life -= dt;
        if (p.kind === 'drop') {
          p.vy += 900 * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
        } else if (p.kind === 'foam') {
          p.vx *= 0.94;
          p.vy *= 0.94;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
        } else if (p.kind === 'feather') {
          p.vy += 160 * dt;
          p.vx *= 0.97;
          p.x += p.vx * dt + Math.sin(p.life * 10) * 0.6;
          p.y += p.vy * dt;
          p.rot += p.vr * dt;
        } else if (p.kind === 'ring') {
          p.size += 160 * dt;
        }
      }
      S.particles = S.particles.filter((p) => p.life > 0);
      for (const t of S.texts) {
        t.life -= dt;
        t.y -= 50 * dt;
      }
      S.texts = S.texts.filter((t) => t.life > 0);

      const cutoff = S.time - TRAIL_LIFE;
      for (const s of S.strokes) {
        if (s.pts.length && s.pts[0].t < cutoff) {
          // keep the newest point of an active stroke so it can continue
          const keepLast = s.active ? 1 : 0;
          let i = 0;
          while (i < s.pts.length - keepLast && s.pts[i].t < cutoff) i++;
          s.pts.splice(0, i);
        }
      }
      S.strokes = S.strokes.filter((s) => s.active || s.pts.length > 0);

      for (const p of S.petals) {
        p.x += (p.vx + Math.sin(S.time * 1.3 + p.rot) * 18) * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        if (p.y > H + 20 || p.x < -40 || p.x > W + 40) Object.assign(p, newPetal(false));
      }

      S.shake = Math.max(0, S.shake - 60 * dt);
      S.redFlash = Math.max(0, S.redFlash - dt * 2.2);

      if (S.left <= 0) {
        S.left = 0;
        end(false, 'Time ran out — the demons got away!');
      }
    };

    /* ── draw ── */
    const draw = () => {
      const dark = isDark();
      const k = scale * dpr;
      const key = `${canvas.width}x${canvas.height}|${dark}`;
      if (key !== bgKey) {
        bg = buildBackground(W, H, k, dark);
        bgKey = key;
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bg, 0, 0);
      const sx = S.shake ? rand(-S.shake, S.shake) * 0.5 : 0;
      const sy = S.shake ? rand(-S.shake, S.shake) * 0.5 : 0;
      ctx.setTransform(k, 0, 0, k, sx * k, sy * k);

      // petals
      for (const p of S.petals) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.scale(1, 0.55 + 0.45 * Math.sin(p.rot * 2));
        ctx.fillStyle = p.pink ? (dark ? 'rgba(255,170,210,0.8)' : 'rgba(255,190,215,0.95)') : dark ? 'rgba(210,180,255,0.8)' : 'rgba(225,205,255,0.95)';
        ctx.beginPath();
        ctx.moveTo(0, -p.size);
        ctx.quadraticCurveTo(p.size, 0, 0, p.size);
        ctx.quadraticCurveTo(-p.size, 0, 0, -p.size);
        ctx.fill();
        ctx.restore();
      }

      // characters & targets
      for (const e of S.entities) {
        ctx.save();
        ctx.translate(e.x, e.y);
        ctx.scale(ENTITY_SCALE, ENTITY_SCALE);
        const facing = e.mode === 'cross' ? Math.sign(e.vx) : e.mode === 'orbit' ? Math.sign(e.parent.vx) || 1 : Math.sign(e.vx) || 1;
        if (e.type === 'tanjiro' || e.type === 'nezuko' || e.type === 'crow') {
          ctx.scale(facing, 1);
          ctx.rotate(Math.sin(e.t * 2.4) * 0.06 + 0.08);
        }
        if (e.type === 'nezuko' && e.hurt > 0) ctx.rotate(Math.sin(e.hurt * 30) * 0.15);
        if (e.type === 'tanjiro') drawTanjiro(ctx, e, checker);
        else if (e.type === 'nezuko') drawNezuko(ctx, e);
        else if (e.type === 'crow') drawCrow(ctx, e, dark);
        else if (e.type === 'wisp') drawWisp(ctx, e, dark);
        else drawLantern(ctx, e, dark);
        ctx.restore();
      }

      // particles
      for (const p of S.particles) {
        const a = clamp(p.life / p.max, 0, 1);
        ctx.globalAlpha = a;
        if (p.kind === 'drop') {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(Math.atan2(p.vy, p.vx));
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.moveTo(p.size * 1.2, 0);
          ctx.quadraticCurveTo(0, -p.size, -p.size * 2.2, 0);
          ctx.quadraticCurveTo(0, p.size, p.size * 1.2, 0);
          ctx.fill();
          ctx.restore();
        } else if (p.kind === 'foam') {
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, TAU);
          ctx.fill();
        } else if (p.kind === 'feather') {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = dark ? '#3a3850' : '#26242f';
          ctx.beginPath();
          ctx.ellipse(0, 0, p.size, p.size * 0.35, 0, 0, TAU);
          ctx.fill();
          ctx.restore();
        } else if (p.kind === 'ring') {
          ctx.strokeStyle = '#bfe6ff';
          ctx.lineWidth = 3 * a;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, TAU);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;

      // slash ribbons
      for (const s of S.strokes) drawStroke(ctx, s, S.time, dark);

      // keyboard reticle
      if (S.reticle && !S.done) {
        const { x, y } = S.aim;
        ctx.strokeStyle = dark ? 'rgba(170,220,255,0.85)' : 'rgba(40,110,200,0.75)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.arc(x, y, WHEEL_RADIUS, S.time, S.time + TAU);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, TAU);
        ctx.stroke();
      }

      // floating text
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const t of S.texts) {
        const a = clamp(t.life / t.max, 0, 1);
        const pop = 1 + Math.max(0, (t.life - t.max + 0.15) / 0.15) * 0.4;
        ctx.globalAlpha = a;
        ctx.font = `700 ${t.size * pop}px Fredoka, Quicksand, sans-serif`;
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(30,50,110,0.65)';
        ctx.strokeText(t.text, t.x, t.y);
        ctx.fillStyle = t.color;
        ctx.fillText(t.text, t.x, t.y);
      }
      ctx.globalAlpha = 1;

      // intro flourish
      if (S.time < 1.8) {
        const a = S.time < 0.25 ? S.time / 0.25 : clamp((1.8 - S.time) / 0.6, 0, 1);
        ctx.globalAlpha = a;
        ctx.font = `700 ${Math.min(40, W / 14)}px Fredoka, Quicksand, sans-serif`;
        ctx.lineWidth = 6;
        ctx.strokeStyle = 'rgba(20,40,100,0.6)';
        ctx.strokeText('Water Breathing!', W / 2, H / 2 - 16);
        ctx.fillStyle = '#e8f6ff';
        ctx.fillText('Water Breathing!', W / 2, H / 2 - 16);
        ctx.font = `600 ${Math.min(20, W / 26)}px Fredoka, Quicksand, sans-serif`;
        ctx.lineWidth = 4;
        ctx.strokeText('First Form · Water Surface Slash', W / 2, H / 2 + 22);
        ctx.fillStyle = '#bfe6ff';
        ctx.fillText('First Form · Water Surface Slash', W / 2, H / 2 + 22);
        ctx.globalAlpha = 1;
      }

      // Nezuko-hit red vignette
      if (S.redFlash > 0) {
        ctx.setTransform(k, 0, 0, k, 0, 0);
        const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
        g.addColorStop(0, 'rgba(255,80,120,0)');
        g.addColorStop(1, `rgba(255,60,110,${0.45 * S.redFlash})`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }
    };

    let raf = 0;
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!S.done) update(dt);
      draw();
      pushHud();
      if (!S.done) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  const livesLeft = MAX_STRIKES - hud.strikes;
  return (
    <Stage className="l01-stage">
      <canvas ref={canvasRef} className="l01-canvas" aria-label="Water Breathing slashing game" />
      <GameHud>
        <HudPill icon={<DropIcon />} label="Slashed" value={`${hud.score}/${GOAL}`} accent="#4f9ee8" />
        <TimerBar left={hud.left} total={TIME_LIMIT} />
        <HudPill
          label="Nezuko"
          accent="#ff7fb0"
          value={
            <span className="l01-lives">
              {Array.from({ length: MAX_STRIKES }, (_, i) => (
                <Heart key={i} size={15} fill={i < livesLeft ? '#ff7fb0' : '#cfc3d3'} shine={i < livesLeft} />
              ))}
            </span>
          }
        />
      </GameHud>
    </Stage>
  );
}
