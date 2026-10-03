/**
 * Level 4 — "Corporate Escape"
 * Bebu (chibi office worker) dodges falling corporate jargon from 9:00 AM to 5:00 PM.
 * Coffee = temporary shield, hearts = clock skips ahead. 3 hits → onFail('burnout').
 * Survive till 5 PM → sunset outro, he runs to the candlelit date table → onWin().
 *
 * Input: pointer (drag / mouse move follows x), Arrow keys, A / D.
 * Canvas with an adaptive logical width (fixed logical height H).
 */
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Stage, GameHud, HudPill } from './kit.jsx';
import { useGameLoop } from '../hooks/useGameLoop';
import { sound } from '../audio/soundManager';
import { HerChibi } from '../art/Characters';
import { Heart } from '../components/Icons';
import './Level04Corporate.css';

// ───────── tunables ─────────
const DURATION = 35; // seconds of survival = 9:00 AM → 5:00 PM
const MAX_STRESS = 3; // hits until burnout
const START_DELAY = 1.2; // grace period before the first hazard
const SPAWN_GAP = [1.0, 0.36]; // seconds between hazards (start → end), at 500 logical px width
const FALL_SPEED = [150, 330]; // px/s (start → end)
const COFFEE_EVERY = [6, 9]; // seconds (random range)
const HEART_EVERY = [3.5, 5.5];
const HEART_BONUS = 1.5; // seconds of progress per heart (~20 min of office time)
const SHIELD_TIME = 4.5;
const INVULN_TIME = 1.3; // after a hit
const KEY_SPEED = 470; // px/s with keyboard
const FOLLOW = 14; // pointer follow stiffness
const H = 600; // logical height
const GROUND = H - 46; // feet line

const JARGON = ['Quick sync?', 'Circle back', 'Synergy', 'Per my last email', "Let's take this offline", 'EOD pls', 'Mandatory fun', 'Can you hop on a call?', 'Touch base', 'Low-hanging fruit'];
const PINGS = ['u there?', '@pillu', 'got a sec?', 'quick q', 'ping!', 'hey hey'];
const DECKS = ['Q3 Deck (87 slides)', 'Roadmap v14 FINAL', 'Strategy.pptx'];
const OUCH = ['Ugh!', 'Not again…', 'My calendar!', 'Sigh.', 'Help.'];
const KINDS = [
  ['invite', 34],
  ['ping', 18],
  ['deck', 13],
  ['replyall', 12],
  ['urgent', 10],
  ['linkedin', 13],
];
const FONT = (w, s) => `${w} ${s}px Fredoka, Quicksand, system-ui, sans-serif`;

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const lerp = (a, b, k) => a + (b - a) * k;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function pickKind() {
  let r = Math.random() * KINDS.reduce((s, k) => s + k[1], 0);
  for (const [k, w] of KINDS) if ((r -= w) < 0) return k;
  return 'invite';
}
function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function heartPath(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.35);
  ctx.bezierCurveTo(x - s * 0.9, y - s * 0.25, x - s * 0.45, y - s * 0.95, x, y - s * 0.45);
  ctx.bezierCurveTo(x + s * 0.45, y - s * 0.95, x + s * 0.9, y - s * 0.25, x, y + s * 0.35);
  ctx.closePath();
}
function clockLabel(min) {
  const h24 = Math.floor(min / 60);
  const m = Math.floor(min % 60);
  const h = ((h24 + 11) % 12) + 1;
  return `${h}:${String(m).padStart(2, '0')} ${h24 >= 12 ? 'PM' : 'AM'}`;
}

// ───────── hazard factory ─────────
function makeHazard(ctx, W, p) {
  const kind = pickKind();
  const hz = { kind, y: 0, vy: lerp(FALL_SPEED[0], FALL_SPEED[1], p) * rand(0.85, 1.2), rot: rand(-0.12, 0.12), vr: rand(-0.4, 0.4), sway: rand(0, 6.28), hit: false, alpha: 1 };
  ctx.font = FONT(600, 14);
  if (kind === 'invite') {
    hz.label = pick(JARGON);
    hz.w = Math.min(ctx.measureText(hz.label).width + 50, W * 0.55);
    hz.h = 50;
  } else if (kind === 'ping') {
    hz.label = pick(PINGS);
    hz.w = Math.max(84, ctx.measureText(hz.label).width + 50);
    hz.h = 38;
  } else if (kind === 'deck') {
    hz.label = pick(DECKS);
    hz.w = 92;
    hz.h = 66;
  } else if (kind === 'replyall') {
    hz.label = 'Reply All';
    hz.w = 78;
    hz.h = 56;
  } else if (kind === 'urgent') {
    hz.label = 'URGENT';
    hz.w = 92;
    hz.h = 40;
    hz.vr = rand(-1.6, 1.6);
  } else {
    hz.label = "I'm thrilled to announce…";
    hz.w = Math.min(150, W * 0.5);
    hz.h = 70;
  }
  hz.x = rand(hz.w / 2 + 6, W - hz.w / 2 - 6);
  hz.y = -hz.h;
  return hz;
}

// ───────── drawing: hazards ─────────
function drawHazard(ctx, hz, t, dark) {
  const { w, h } = hz;
  ctx.save();
  ctx.globalAlpha = hz.alpha;
  ctx.translate(hz.x, hz.y);
  ctx.rotate(hz.rot + Math.sin(t * 2 + hz.sway) * 0.05);
  ctx.shadowColor = dark ? 'rgba(0,0,0,.45)' : 'rgba(91,58,89,.22)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 4;
  const card = dark ? '#f4f1ff' : '#ffffff';
  if (hz.kind === 'invite') {
    rr(ctx, -w / 2, -h / 2, w, h, 10);
    ctx.fillStyle = card;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.save();
    ctx.clip();
    ctx.fillStyle = '#6f8fea';
    ctx.fillRect(-w / 2, -h / 2, w, 15);
    ctx.restore();
    ctx.fillStyle = '#fff';
    ctx.font = FONT(600, 9);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('MEETING · 30 min', -w / 2 + 26, -h / 2 + 8);
    // rings
    ctx.fillStyle = '#3d5bbf';
    [-w / 2 + 10, -w / 2 + 18].forEach((x) => {
      rr(ctx, x - 1.5, -h / 2 - 4, 3, 8, 1.5);
      ctx.fill();
    });
    // calendar icon
    rr(ctx, -w / 2 + 8, -h / 2 + 20, 18, 18, 4);
    ctx.fillStyle = '#ffe3ee';
    ctx.fill();
    ctx.fillStyle = '#f2629a';
    ctx.fillRect(-w / 2 + 8, -h / 2 + 20, 18, 5);
    ctx.font = FONT(700, 9);
    ctx.textAlign = 'center';
    ctx.fillText('9', -w / 2 + 17, -h / 2 + 32);
    ctx.fillStyle = '#4a3a6a';
    ctx.font = FONT(600, 14);
    ctx.textAlign = 'left';
    ctx.fillText(hz.label, -w / 2 + 32, 7, w - 40);
  } else if (hz.kind === 'ping') {
    ctx.fillStyle = '#7b83eb';
    rr(ctx, -w / 2, -h / 2, w, h, h / 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-w / 2 + 16, h / 2 - 4);
    ctx.lineTo(-w / 2 + 8, h / 2 + 9);
    ctx.lineTo(-w / 2 + 28, h / 2 - 2);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = '#c7cbff';
    ctx.beginPath();
    ctx.arc(-w / 2 + 19, 0, 11, 0, 7);
    ctx.fill();
    ctx.fillStyle = '#5b62c9';
    ctx.font = FONT(700, 11);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('PM', -w / 2 + 19, 1);
    ctx.fillStyle = '#fff';
    ctx.font = FONT(600, 14);
    ctx.textAlign = 'left';
    ctx.fillText(hz.label, -w / 2 + 36, 1);
    // red badge
    ctx.fillStyle = '#ff4d6d';
    ctx.beginPath();
    ctx.arc(w / 2 - 2, -h / 2 + 2, 9, 0, 7);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = FONT(700, 11);
    ctx.textAlign = 'center';
    ctx.fillText('3', w / 2 - 2, -h / 2 + 3);
  } else if (hz.kind === 'deck') {
    ctx.fillStyle = dark ? '#e3dcf7' : '#f1ecfa';
    rr(ctx, -w / 2 + 8, -h / 2 - 6, w, h - 8, 6);
    ctx.fill();
    ctx.fillStyle = card;
    rr(ctx, -w / 2, -h / 2, w, h - 8, 6);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = '#e8743b';
    rr(ctx, -w / 2 + 6, -h / 2 + 6, 18, 18, 4);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = FONT(700, 13);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('P', -w / 2 + 15, -h / 2 + 16);
    ctx.fillStyle = '#c9c2dc';
    rr(ctx, -w / 2 + 30, -h / 2 + 9, w - 38, 4, 2);
    ctx.fill();
    rr(ctx, -w / 2 + 30, -h / 2 + 17, w - 52, 4, 2);
    ctx.fill();
    // bar chart
    [10, 18, 14, 24].forEach((bh, i) => {
      ctx.fillStyle = ['#96c6fb', '#ffb3cf', '#ffd36e', '#9ed9b0'][i];
      ctx.fillRect(-w / 2 + 10 + i * 12, h / 2 - 14 - bh, 8, bh);
    });
    ctx.strokeStyle = '#ff4d6d';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-w / 2 + 62, h / 2 - 18);
    ctx.lineTo(-w / 2 + 70, h / 2 - 30);
    ctx.lineTo(-w / 2 + 78, h / 2 - 24);
    ctx.lineTo(-w / 2 + 86, h / 2 - 40);
    ctx.stroke();
    ctx.fillStyle = dark ? '#fbeaf4' : '#5b3a59';
    ctx.font = FONT(600, 11);
    ctx.fillText(hz.label, 0, h / 2 + 4);
  } else if (hz.kind === 'replyall') {
    rr(ctx, -w / 2, -h / 2 + 8, w, h - 16, 6);
    ctx.fillStyle = '#fff6d6';
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = '#e2c27a';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-w / 2 + 2, -h / 2 + 10);
    ctx.lineTo(0, 4);
    ctx.lineTo(w / 2 - 2, -h / 2 + 10);
    ctx.stroke();
    ctx.fillStyle = '#5b3a59';
    ctx.font = FONT(700, 12);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Reply All', 0, h / 2 - 16);
    ctx.fillStyle = '#ff4d6d';
    rr(ctx, w / 2 - 22, -h / 2, 30, 18, 9);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = FONT(700, 10);
    ctx.fillText('212', w / 2 - 7, -h / 2 + 9.5);
  } else if (hz.kind === 'urgent') {
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = '#e8364f';
    ctx.lineWidth = 4;
    rr(ctx, -w / 2, -h / 2, w, h, 8);
    ctx.fillStyle = 'rgba(255,230,234,.92)';
    ctx.fill();
    ctx.stroke();
    ctx.lineWidth = 1.5;
    rr(ctx, -w / 2 + 5, -h / 2 + 5, w - 10, h - 10, 5);
    ctx.stroke();
    ctx.fillStyle = '#e8364f';
    ctx.font = FONT(700, 18);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('URGENT', 0, 1);
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    ctx.fillRect(-w / 2 + 12, -3, 10, 3);
  } else {
    // LinkedIn-ish post
    rr(ctx, -w / 2, -h / 2, w, h, 10);
    ctx.fillStyle = card;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = '#ffd1b3';
    ctx.beginPath();
    ctx.arc(-w / 2 + 16, -h / 2 + 16, 9, 0, 7);
    ctx.fill();
    ctx.fillStyle = '#5b3a59';
    ctx.beginPath();
    ctx.arc(-w / 2 + 16, -h / 2 + 12, 8, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#c9c2dc';
    rr(ctx, -w / 2 + 30, -h / 2 + 10, 50, 5, 2.5);
    ctx.fill();
    rr(ctx, -w / 2 + 30, -h / 2 + 19, 34, 4, 2);
    ctx.fill();
    ctx.fillStyle = '#2f7bd6';
    rr(ctx, w / 2 - 22, -h / 2 + 7, 15, 15, 3);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = FONT(700, 10);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('in', w / 2 - 14.5, -h / 2 + 15);
    ctx.fillStyle = '#4a3a6a';
    ctx.font = FONT(600, 11.5);
    ctx.textAlign = 'left';
    ctx.fillText(hz.label, -w / 2 + 8, 6, w - 14);
    ctx.fillStyle = '#2f7bd6';
    ctx.font = FONT(600, 9.5);
    ctx.fillText('👍 2,341 · #grateful #blessed', -w / 2 + 8, h / 2 - 11, w - 14);
  }
  ctx.restore();
}

function drawCoffee(ctx, x, y, t, s = 1) {
  ctx.save();
  ctx.translate(x, y + Math.sin(t * 4) * 3);
  ctx.scale(s, s);
  // glow
  const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 30);
  g.addColorStop(0, 'rgba(255,211,110,.55)');
  g.addColorStop(1, 'rgba(255,211,110,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 30, 0, 7);
  ctx.fill();
  // cup
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#c98b5a';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-11, -10);
  ctx.lineTo(11, -10);
  ctx.lineTo(8, 16);
  ctx.lineTo(-8, 16);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#c98b5a';
  ctx.fillRect(-10.2, -2, 20.4, 10);
  ctx.fillStyle = '#fff';
  heartPath(ctx, 0, 3, 7);
  ctx.fill();
  ctx.fillStyle = '#ff85b1';
  rr(ctx, -13, -16, 26, 7, 3);
  ctx.fill();
  rr(ctx, -6, -20, 12, 5, 2);
  ctx.fill();
  // steam
  ctx.strokeStyle = 'rgba(255,255,255,.85)';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  for (let i = -1; i <= 1; i += 2) {
    ctx.beginPath();
    ctx.moveTo(i * 4, -22);
    ctx.quadraticCurveTo(i * 4 + 4 * Math.sin(t * 6 + i), -28, i * 4, -34);
    ctx.stroke();
  }
  ctx.restore();
}

function drawHeartPickup(ctx, x, y, t) {
  ctx.save();
  const s = 1 + Math.sin(t * 7) * 0.08;
  ctx.translate(x, y);
  ctx.scale(s, s);
  const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 28);
  g.addColorStop(0, 'rgba(255,127,176,.5)');
  g.addColorStop(1, 'rgba(255,127,176,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 28, 0, 7);
  ctx.fill();
  ctx.fillStyle = '#ff6f9f';
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2.5;
  heartPath(ctx, 0, 4, 22);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.7)';
  ctx.beginPath();
  ctx.ellipse(-6, -6, 4, 2.6, -0.6, 0, 7);
  ctx.fill();
  ctx.restore();
}

// ───────── drawing: pillu the office worker ─────────
function drawPlayer(ctx, g, t) {
  const { px: x, facing, runPhase, moving, stress, invuln, shield, mood } = g;
  if (invuln > 0 && Math.floor(t * 14) % 2 === 0 && g.phase === 'play') return drawShield(ctx, g, t);
  const y = GROUND;
  ctx.save();
  ctx.translate(x, y);
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,.14)';
  ctx.beginPath();
  ctx.ellipse(0, 2, 26, 5, 0, 0, 7);
  ctx.fill();
  ctx.scale(facing, 1);
  const bob = moving ? Math.abs(Math.sin(runPhase)) * 3 : Math.sin(t * 3) * 1;
  const leg = moving ? Math.sin(runPhase) * 7 : 0;
  ctx.translate(0, -bob);
  // legs
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#3d4a6b';
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(-7, -26);
  ctx.lineTo(-7 + leg, -5);
  ctx.moveTo(7, -26);
  ctx.lineTo(7 - leg, -5);
  ctx.stroke();
  ctx.fillStyle = '#7a4a32';
  ctx.beginPath();
  ctx.ellipse(-5 + leg, -2, 7, 4, 0, 0, 7);
  ctx.ellipse(9 - leg, -2, 7, 4, 0, 0, 7);
  ctx.fill();
  // back arm (swinging)
  ctx.strokeStyle = '#dfe9f7';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(-14, -50);
  ctx.lineTo(-20 - leg * 0.6, -30);
  ctx.stroke();
  ctx.fillStyle = '#e0a77f';
  ctx.beginPath();
  ctx.arc(-20 - leg * 0.6, -28, 4.5, 0, 7);
  ctx.fill();
  // shirt / body
  rr(ctx, -18, -58, 36, 36, 12);
  ctx.fillStyle = '#f2f7ff';
  ctx.fill();
  ctx.strokeStyle = '#9fb8d8';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  // belt
  ctx.fillStyle = '#3d4a6b';
  ctx.fillRect(-17, -27, 34, 5);
  // collar (open — tie loosened)
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(-8, -58);
  ctx.lineTo(0, -50);
  ctx.lineTo(-2, -59);
  ctx.moveTo(8, -58);
  ctx.lineTo(1, -50);
  ctx.lineTo(3, -59);
  ctx.fill();
  // tie (loosened, a bit askew)
  ctx.save();
  ctx.translate(1, -51);
  ctx.rotate(0.18 + (moving ? Math.sin(runPhase) * 0.12 : 0));
  ctx.fillStyle = '#ff6f9f';
  ctx.beginPath();
  ctx.moveTo(-3.5, 0);
  ctx.lineTo(3.5, 0);
  ctx.lineTo(2, 4);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-2, 4);
  ctx.lineTo(2, 4);
  ctx.lineTo(4.5, 20);
  ctx.lineTo(0, 25);
  ctx.lineTo(-4.5, 20);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#e04f86';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-3, 10);
  ctx.lineTo(3, 13);
  ctx.moveTo(-3.5, 16);
  ctx.lineTo(3.5, 19);
  ctx.stroke();
  ctx.restore();
  // lanyard + badge
  ctx.strokeStyle = '#4c8ddc';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(-9, -57);
  ctx.lineTo(-8, -40);
  ctx.moveTo(9, -57);
  ctx.lineTo(-6, -40);
  ctx.stroke();
  ctx.save();
  ctx.translate(-8, -36);
  ctx.rotate(moving ? Math.sin(runPhase + 1) * 0.25 : 0.05);
  rr(ctx, -6, -3, 12, 15, 2);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.strokeStyle = '#4c8ddc';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = '#96c6fb';
  ctx.fillRect(-4, -1, 8, 6);
  ctx.fillStyle = '#ff85b1';
  ctx.fillRect(-4, 7, 8, 2);
  ctx.restore();
  // front arm holding coffee
  ctx.strokeStyle = '#e6eef9';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(14, -50);
  ctx.quadraticCurveTo(24, -42, 24, -36);
  ctx.stroke();
  ctx.save();
  ctx.translate(26, -40);
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#c98b5a';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-5, -8);
  ctx.lineTo(5, -8);
  ctx.lineTo(4, 6);
  ctx.lineTo(-4, 6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#c98b5a';
  ctx.fillRect(-4.6, -3, 9.2, 5);
  ctx.fillStyle = '#ff85b1';
  rr(ctx, -6, -11, 12, 4, 2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#e0a77f';
  ctx.beginPath();
  ctx.arc(23, -36, 4.5, 0, 7);
  ctx.fill();
  // head
  const hy = -84;
  ctx.fillStyle = '#e0a77f';
  ctx.beginPath();
  ctx.ellipse(0, hy, 25, 23, 0, 0, 7);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(-24, hy + 3, 4, 5, 0, 0, 7);
  ctx.ellipse(24, hy + 3, 4, 5, 0, 0, 7);
  ctx.fill();
  // hair (messy, with an end-of-day cowlick)
  ctx.fillStyle = '#2b1d1a';
  ctx.beginPath();
  ctx.moveTo(-25, hy + 2);
  ctx.quadraticCurveTo(-28, hy - 26, -4, hy - 25);
  ctx.quadraticCurveTo(14, hy - 30, 24, hy - 14);
  ctx.quadraticCurveTo(28, hy - 4, 25, hy + 2);
  ctx.quadraticCurveTo(18, hy - 10, 8, hy - 12);
  ctx.quadraticCurveTo(6, hy - 6, 0, hy - 6);
  ctx.quadraticCurveTo(2, hy - 10, -2, hy - 13);
  ctx.quadraticCurveTo(-12, hy - 6, -25, hy + 2);
  ctx.fill();
  ctx.strokeStyle = '#2b1d1a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-2, hy - 25);
  ctx.quadraticCurveTo(2, hy - 36, 9 + Math.sin(t * 5) * 1.5, hy - 33);
  ctx.stroke();
  // face
  const ey = hy + 3;
  ctx.fillStyle = '#2a1a22';
  if (mood === 'hurt') {
    ctx.strokeStyle = '#2a1a22';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-12, ey - 3);
    ctx.lineTo(-6, ey);
    ctx.lineTo(-12, ey + 3);
    ctx.moveTo(12, ey - 3);
    ctx.lineTo(6, ey);
    ctx.lineTo(12, ey + 3);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.ellipse(-9, ey, 3.2, 4, 0, 0, 7);
    ctx.ellipse(9, ey, 3.2, 4, 0, 0, 7);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-8, ey - 1.5, 1.2, 0, 7);
    ctx.arc(10, ey - 1.5, 1.2, 0, 7);
    ctx.fill();
  }
  // eye bags with stress
  if (stress >= 1) {
    ctx.strokeStyle = 'rgba(120,80,140,.45)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(-9, ey + 5, 3.5, 0.2, Math.PI - 0.2);
    ctx.moveTo(12.5, ey + 5.5);
    ctx.arc(9, ey + 5, 3.5, 0.2, Math.PI - 0.2);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,143,176,.55)';
  ctx.beginPath();
  ctx.ellipse(-15, ey + 8, 4.5, 2.6, 0, 0, 7);
  ctx.ellipse(15, ey + 8, 4.5, 2.6, 0, 0, 7);
  ctx.fill();
  ctx.strokeStyle = '#7a2e3c';
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (mood === 'hurt' || stress >= 2) {
    ctx.moveTo(-4, ey + 12);
    ctx.quadraticCurveTo(0, ey + 8, 4, ey + 12);
    ctx.stroke();
  } else if (mood === 'happy') {
    ctx.moveTo(-5, ey + 8);
    ctx.quadraticCurveTo(0, ey + 15, 5, ey + 8);
    ctx.closePath();
    ctx.fillStyle = '#a8344e';
    ctx.fill();
  } else {
    ctx.moveTo(-4, ey + 9);
    ctx.quadraticCurveTo(0, ey + 13, 4, ey + 9);
    ctx.stroke();
  }
  // sweat drop
  if (stress >= 2 || mood === 'hurt') {
    ctx.fillStyle = '#8ec9ff';
    const sy = hy - 8 + ((t * 20) % 8);
    ctx.beginPath();
    ctx.moveTo(-22, sy - 6);
    ctx.quadraticCurveTo(-17, sy + 2, -22, sy + 3);
    ctx.quadraticCurveTo(-27, sy + 2, -22, sy - 6);
    ctx.fill();
  }
  ctx.restore();
  if (shield > 0) drawShield(ctx, g, t);
}

function drawShield(ctx, g, t) {
  if (g.shield <= 0) return;
  if (g.shield < 1 && Math.floor(t * 10) % 2) return;
  const x = g.px;
  const y = GROUND - 52;
  ctx.save();
  const r = 62 + Math.sin(t * 6) * 2;
  const grad = ctx.createRadialGradient(x - 18, y - 22, 6, x, y, r);
  grad.addColorStop(0, 'rgba(255,255,255,.45)');
  grad.addColorStop(0.6, 'rgba(255,211,110,.12)');
  grad.addColorStop(1, 'rgba(255,170,90,.38)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, 7);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,190,110,.9)';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.8)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, r - 8, -2.6 + t, -1.9 + t);
  ctx.stroke();
  ctx.restore();
}

// ───────── drawing: office background ─────────
function makeSkyline(W) {
  const b = [];
  let x = -10;
  let i = 1;
  while (x < W + 20) {
    const w = 30 + ((i * 37) % 40);
    const h = 50 + ((i * 53) % 110);
    b.push({ x, w, h, seed: i });
    x += w + 4;
    i++;
  }
  return b;
}

function drawBackground(ctx, g, t, dark) {
  const { W, sunset: k } = g;
  // wall
  const wall = ctx.createLinearGradient(0, 0, 0, H);
  if (dark) {
    wall.addColorStop(0, '#1b2142');
    wall.addColorStop(1, '#2a2245');
  } else {
    wall.addColorStop(0, '#e9f1ff');
    wall.addColorStop(1, '#ffeaf3');
  }
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, W, H);

  // windows
  const winTop = 96;
  const winH = 190;
  const n = Math.max(2, Math.round(W / 280));
  const gap = 22;
  const ww = (W - gap * (n + 1)) / n;
  const wins = Array.from({ length: n }, (_, i) => ({ x: gap + i * (ww + gap), y: winTop, w: ww, h: winH }));
  ctx.save();
  ctx.beginPath();
  wins.forEach((w) => ctx.rect(w.x, w.y, w.w, w.h));
  ctx.clip();
  const sky = ctx.createLinearGradient(0, winTop, 0, winTop + winH);
  if (dark) {
    sky.addColorStop(0, '#0d1230');
    sky.addColorStop(1, '#2c3264');
  } else {
    sky.addColorStop(0, '#b9defe');
    sky.addColorStop(1, '#eef7ff');
  }
  ctx.fillStyle = sky;
  ctx.fillRect(0, winTop, W, winH);
  if (dark) {
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 40; i++) {
      const sx = (i * 97.3) % W;
      const sy = winTop + ((i * 41.7) % (winH * 0.6));
      ctx.globalAlpha = 0.4 + 0.5 * Math.abs(Math.sin(t * 1.5 + i));
      ctx.fillRect(sx, sy, 1.6, 1.6);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff6d6';
    ctx.beginPath();
    ctx.arc(W * 0.8, winTop + 40, 16, 0, 7);
    ctx.fill();
  } else {
    // clouds
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    for (let i = 0; i < 4; i++) {
      const cx = ((i * 230 + t * 12) % (W + 160)) - 80;
      const cy = winTop + 30 + (i % 2) * 34;
      ctx.beginPath();
      ctx.arc(cx, cy, 14, 0, 7);
      ctx.arc(cx + 16, cy - 6, 18, 0, 7);
      ctx.arc(cx + 34, cy, 13, 0, 7);
      ctx.fill();
    }
  }
  if (k > 0) {
    ctx.globalAlpha = k;
    const ss = ctx.createLinearGradient(0, winTop, 0, winTop + winH);
    ss.addColorStop(0, '#7a5ccf');
    ss.addColorStop(0.45, '#ff8fb0');
    ss.addColorStop(1, '#ffc46b');
    ctx.fillStyle = ss;
    ctx.fillRect(0, winTop, W, winH);
    ctx.fillStyle = '#fff1a8';
    ctx.beginPath();
    ctx.arc(W * 0.5, winTop + winH - 50 + (1 - k) * 40, 34, 0, 7);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  // skyline
  const base = winTop + winH;
  g.skyline.forEach((b) => {
    ctx.fillStyle = k > 0.5 ? '#6a4a8a' : dark ? '#151a38' : '#a9c4ee';
    ctx.fillRect(b.x, base - b.h, b.w, b.h);
    // windows on buildings
    for (let yy = base - b.h + 8; yy < base - 6; yy += 12) {
      for (let xx = b.x + 5; xx < b.x + b.w - 6; xx += 9) {
        const on = (Math.floor(xx * 7 + yy * 3 + b.seed) % 5) < (dark || k > 0.5 ? 2 : 1);
        ctx.fillStyle = dark || k > 0.5 ? (on ? '#ffe38a' : 'rgba(255,255,255,.06)') : on ? 'rgba(255,255,255,.75)' : 'rgba(255,255,255,.25)';
        ctx.fillRect(xx, yy, 4, 6);
      }
    }
  });
  ctx.restore();
  // window frames
  wins.forEach((w) => {
    ctx.strokeStyle = dark ? '#3c4472' : '#ffffff';
    ctx.lineWidth = 7;
    rr(ctx, w.x, w.y, w.w, w.h, 8);
    ctx.stroke();
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(w.x + w.w / 2, w.y);
    ctx.lineTo(w.x + w.w / 2, w.y + w.h);
    ctx.stroke();
    ctx.fillStyle = dark ? '#2a3058' : '#f3e6ef';
    rr(ctx, w.x - 6, w.y + w.h + 2, w.w + 12, 8, 4);
    ctx.fill();
  });

  // fairy lights appear in the outro
  if (k > 0) {
    ctx.save();
    ctx.globalAlpha = k;
    ctx.strokeStyle = dark ? '#6a5a8a' : '#c9a2c0';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 10) ctx.lineTo(x, 86 + Math.sin((x / W) * Math.PI * 4) * 12);
    ctx.stroke();
    for (let x = 20; x < W; x += 36) {
      const yy = 86 + Math.sin((x / W) * Math.PI * 4) * 12;
      ctx.fillStyle = ['#ffd36e', '#ff9cc2', '#8ec9ff'][Math.floor(x / 36) % 3];
      ctx.globalAlpha = k * (0.6 + 0.4 * Math.sin(t * 4 + x));
      ctx.beginPath();
      ctx.arc(x, yy + 5, 4, 0, 7);
      ctx.fill();
    }
    ctx.restore();
  }

  // cubicles
  const cubeTop = H - 170;
  ctx.save();
  ctx.globalAlpha = 1 - k * 0.65;
  for (let x = -40, i = 0; x < W + 40; x += 190, i++) {
    // monitor glow (dark mode)
    if (dark) {
      const gl = ctx.createRadialGradient(x + 70, cubeTop - 6, 4, x + 70, cubeTop - 6, 90);
      gl.addColorStop(0, 'rgba(110,170,255,.38)');
      gl.addColorStop(1, 'rgba(110,170,255,0)');
      ctx.fillStyle = gl;
      ctx.fillRect(x - 30, cubeTop - 100, 200, 200);
    }
    // monitor
    ctx.fillStyle = dark ? '#0f1430' : '#b8c6e6';
    rr(ctx, x + 46, cubeTop - 42, 50, 32, 4);
    ctx.fill();
    ctx.fillStyle = dark ? '#5aa2ff' : '#dfeaff';
    rr(ctx, x + 50, cubeTop - 38, 42, 24, 2);
    ctx.fill();
    if (dark) {
      ctx.fillStyle = 'rgba(255,255,255,.5)';
      for (let l = 0; l < 3; l++) ctx.fillRect(x + 54, cubeTop - 34 + l * 7, 20 + ((i * 7 + l * 11) % 14), 2);
    }
    ctx.fillStyle = dark ? '#0f1430' : '#b8c6e6';
    ctx.fillRect(x + 68, cubeTop - 10, 6, 10);
    // plant on every other desk
    if (i % 2 === 0) {
      ctx.fillStyle = dark ? '#5a3f52' : '#f2b8a2';
      rr(ctx, x + 120, cubeTop - 18, 16, 18, 3);
      ctx.fill();
      ctx.fillStyle = dark ? '#3d6a6a' : '#9ed9b0';
      for (let l = 0; l < 4; l++) {
        ctx.beginPath();
        ctx.ellipse(x + 128 + (l - 1.5) * 5, cubeTop - 24, 4, 10, (l - 1.5) * 0.4, 0, 7);
        ctx.fill();
      }
    } else {
      // mug
      ctx.fillStyle = dark ? '#6b5a8a' : '#ffc8dd';
      rr(ctx, x + 122, cubeTop - 14, 12, 14, 3);
      ctx.fill();
    }
    // partition panel
    ctx.fillStyle = dark ? '#262c52' : '#d4dcf2';
    rr(ctx, x, cubeTop, 176, H - cubeTop, 10);
    ctx.fill();
    ctx.fillStyle = dark ? '#303767' : '#e3e9fa';
    rr(ctx, x + 8, cubeTop + 8, 160, 70, 6);
    ctx.fill();
    // sticky notes
    ['#ffe38a', '#ffb3cf', '#bdf0ee'].forEach((c, j) => {
      ctx.fillStyle = c;
      ctx.globalAlpha = (1 - k * 0.65) * (dark ? 0.6 : 1);
      ctx.fillRect(x + 18 + j * 18 + (i % 3) * 6, cubeTop + 16 + (j % 2) * 10, 13, 13);
    });
    ctx.globalAlpha = 1 - k * 0.65;
  }
  ctx.restore();
  // floor
  ctx.fillStyle = dark ? '#221d3d' : '#efe1ec';
  ctx.fillRect(0, GROUND - 4, W, H - GROUND + 4);
  ctx.fillStyle = dark ? '#2c2650' : '#f6ebf2';
  ctx.fillRect(0, GROUND - 4, W, 4);
  // warm wash in the outro
  if (k > 0) {
    ctx.fillStyle = `rgba(255,150,120,${0.16 * k})`;
    ctx.fillRect(0, 0, W, H);
  }
}

function drawTable(ctx, x, a, t) {
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(x, GROUND);
  // candle glow
  const gl = ctx.createRadialGradient(0, -86, 4, 0, -86, 120);
  gl.addColorStop(0, 'rgba(255,214,140,.55)');
  gl.addColorStop(1, 'rgba(255,214,140,0)');
  ctx.fillStyle = gl;
  ctx.fillRect(-130, -210, 260, 220);
  // pedestal
  ctx.fillStyle = '#8a5a44';
  ctx.fillRect(-4, -54, 8, 50);
  rr(ctx, -22, -6, 44, 6, 3);
  ctx.fill();
  // tablecloth
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.ellipse(0, -58, 52, 10, 0, 0, 7);
  ctx.fill();
  ctx.fillStyle = '#ffd1e3';
  ctx.beginPath();
  ctx.moveTo(-52, -58);
  ctx.lineTo(-48, -30);
  for (let i = 0; i <= 8; i++) ctx.quadraticCurveTo(-48 + i * 12 - 6, -24, -48 + i * 12, -30);
  ctx.lineTo(52, -58);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffeef5';
  ctx.beginPath();
  ctx.ellipse(0, -59, 50, 8, 0, 0, 7);
  ctx.fill();
  // plate of spaghetti
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#e3d6e6';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(-4, -62, 18, 5, 0, 0, 7);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = '#f5d27a';
  ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.ellipse(-4, -66 + i * 0.5, 11 - i * 2, 4 - i * 0.6, 0, 0, 7);
    ctx.stroke();
  }
  ctx.fillStyle = '#e8413b';
  ctx.beginPath();
  ctx.arc(-4, -69, 4, 0, 7);
  ctx.fill();
  ctx.fillStyle = '#5cb85c';
  ctx.beginPath();
  ctx.ellipse(-1, -71, 2.5, 1.4, 0.4, 0, 7);
  ctx.fill();
  // candles
  [-30, 26].forEach((cx, i) => {
    ctx.fillStyle = '#fff6e0';
    rr(ctx, cx - 3, -84, 6, 22, 2);
    ctx.fill();
    const f = 1 + Math.sin(t * 18 + i * 2) * 0.15;
    ctx.fillStyle = '#ffb347';
    ctx.beginPath();
    ctx.ellipse(cx, -89, 3 * f, 6 * f, 0, 0, 7);
    ctx.fill();
    ctx.fillStyle = '#fff3b0';
    ctx.beginPath();
    ctx.ellipse(cx, -88, 1.5, 3, 0, 0, 7);
    ctx.fill();
  });
  // wine glasses
  [-18, 14].forEach((wx) => {
    ctx.strokeStyle = 'rgba(200,210,240,.95)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(wx - 5, -84);
    ctx.quadraticCurveTo(wx - 5, -74, wx, -73);
    ctx.quadraticCurveTo(wx + 5, -74, wx + 5, -84);
    ctx.moveTo(wx, -73);
    ctx.lineTo(wx, -64);
    ctx.moveTo(wx - 4, -63);
    ctx.lineTo(wx + 4, -63);
    ctx.stroke();
    ctx.fillStyle = '#c23b62';
    ctx.beginPath();
    ctx.moveTo(wx - 4.6, -79);
    ctx.quadraticCurveTo(wx, -72, wx + 4.6, -79);
    ctx.fill();
  });
  // rose
  ctx.strokeStyle = '#4f8a3a';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(40, -62);
  ctx.lineTo(42, -82);
  ctx.stroke();
  ctx.fillStyle = '#ff4d6d';
  ctx.beginPath();
  ctx.arc(42, -85, 4.5, 0, 7);
  ctx.fill();
  ctx.restore();
}

function ClockIcon({ minutes }) {
  const hA = ((minutes / 60) % 12) * 30;
  const mA = (minutes % 60) * 6;
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
      <circle cx="12" cy="12" r="10" fill="#fff" stroke="#5b7fe0" strokeWidth="2" />
      {[0, 90, 180, 270].map((a) => (
        <path key={a} d="M12 3.6v1.6" stroke="#9fb3e8" strokeWidth="1.4" transform={`rotate(${a} 12 12)`} />
      ))}
      <path d="M12 12V7.2" stroke="#3d4a6b" strokeWidth="2" strokeLinecap="round" transform={`rotate(${hA} 12 12)`} />
      <path d="M12 12V4.8" stroke="#f2629a" strokeWidth="1.4" strokeLinecap="round" transform={`rotate(${mA} 12 12)`} />
      <circle cx="12" cy="12" r="1.3" fill="#3d4a6b" />
    </svg>
  );
}

// ───────── the level ─────────
export default function Level04Corporate({ onWin, onFail }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const ctxRef = useRef(null);
  const scaleRef = useRef(1);
  const endedRef = useRef(false);
  const [running, setRunning] = useState(true);
  const [hud, setHud] = useState({ minutes: 540, progress: 0, stress: 0, shield: 0 });
  const [her, setHer] = useState(null); // { leftPct }
  const [intro, setIntro] = useState(true);

  const g = useRef(null);
  if (!g.current) {
    g.current = {
      W: 500,
      t: 0,
      phase: 'play', // play | outro | burnout | done
      progress: 0,
      px: 250,
      facing: 1,
      runPhase: 0,
      moving: false,
      targetX: null,
      keys: { l: false, r: false },
      hazards: [],
      pickups: [],
      particles: [],
      texts: [],
      stress: 0,
      invuln: 0,
      shield: 0,
      shake: 0,
      hitFlash: 0,
      mood: 'neutral',
      moodT: 0,
      spawnT: START_DELAY,
      coffeeT: rand(...COFFEE_EVERY) * 0.6,
      heartT: rand(...HEART_EVERY),
      outroT: 0,
      sunset: 0,
      side: 1,
      tableX: 0,
      arrived: false,
      endT: 0,
      skyline: makeSkyline(500),
      hudT: 0,
      lastHour: 9,
    };
  }

  // canvas sizing: logical height H, logical width follows the aspect ratio
  useEffect(() => {
    const canvas = canvasRef.current;
    ctxRef.current = canvas.getContext('2d');
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      scaleRef.current = (r.height / H) * dpr;
      const W = clamp((r.width / r.height) * H, 280, 1200);
      const s = g.current;
      if (Math.abs(W - s.W) > 1) {
        s.px = clamp((s.px / s.W) * W, 30, W - 30);
        s.W = W;
        s.skyline = makeSkyline(W);
      }
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  const toLogicalX = (clientX) => {
    const r = canvasRef.current.getBoundingClientRect();
    return ((clientX - r.left) / r.width) * g.current.W;
  };

  // input
  useEffect(() => {
    const down = (e) => {
      const s = g.current;
      if (s.phase !== 'play') return;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        s.keys.l = true;
        s.targetX = null;
        e.preventDefault();
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        s.keys.r = true;
        s.targetX = null;
        e.preventDefault();
      }
    };
    const up = (e) => {
      const s = g.current;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') s.keys.l = false;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') s.keys.r = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    const t = setTimeout(() => setIntro(false), 1500);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      clearTimeout(t);
    };
  }, []);

  const pointerActive = useRef(false);
  const onPointerDown = (e) => {
    if (g.current.phase !== 'play') return;
    pointerActive.current = true;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    g.current.targetX = toLogicalX(e.clientX);
  };
  const onPointerMove = (e) => {
    if (g.current.phase !== 'play') return;
    // mouse follows on hover; touch/pen follow while pressed
    if (e.pointerType === 'mouse' || pointerActive.current) g.current.targetX = toLogicalX(e.clientX);
  };
  const onPointerUp = () => {
    pointerActive.current = false;
  };

  const end = (won) => {
    if (endedRef.current) return;
    endedRef.current = true;
    g.current.phase = 'done';
    setRunning(false);
    if (won) onWin();
    else onFail('burnout');
  };

  const addText = (s, x, y, text, color, size = 18) => s.texts.push({ x, y, text, color, size, life: 1 });
  const burstParticles = (s, x, y, colors, n = 12, speed = 200) => {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const v = rand(speed * 0.4, speed);
      s.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, life: rand(0.5, 0.9), color: pick(colors), size: rand(3, 6), rot: rand(0, 6), heart: false });
    }
  };

  useGameLoop((dt) => {
    const s = g.current;
    const ctx = ctxRef.current;
    if (!ctx) return;
    s.t += dt;
    const t = s.t;
    const W = s.W;
    const dark = document.documentElement.dataset.theme === 'dark';
    const p = clamp(s.progress / DURATION, 0, 1);

    // ── update ──
    if (s.phase === 'play') {
      s.progress += dt;
      // movement
      const prev = s.px;
      if (s.keys.l || s.keys.r) {
        s.px += ((s.keys.r ? 1 : 0) - (s.keys.l ? 1 : 0)) * KEY_SPEED * dt;
      } else if (s.targetX != null) {
        s.px += (s.targetX - s.px) * (1 - Math.exp(-FOLLOW * dt));
      }
      s.px = clamp(s.px, 26, W - 26);
      const vx = (s.px - prev) / Math.max(dt, 1e-4);
      s.moving = Math.abs(vx) > 30;
      if (Math.abs(vx) > 20) s.facing = vx > 0 ? 1 : -1;
      s.runPhase += dt * (s.moving ? 16 : 0);

      // spawning (scaled by width so wide screens stay busy)
      const widthK = clamp(W / 500, 0.75, 1.8);
      s.spawnT -= dt;
      if (s.spawnT <= 0) {
        s.hazards.push(makeHazard(ctx, W, p));
        s.spawnT = lerp(SPAWN_GAP[0], SPAWN_GAP[1], p) / widthK * rand(0.8, 1.2);
      }
      s.coffeeT -= dt;
      if (s.coffeeT <= 0) {
        s.pickups.push({ kind: 'coffee', x: rand(30, W - 30), y: -30, vy: 150 });
        s.coffeeT = rand(...COFFEE_EVERY);
      }
      s.heartT -= dt;
      if (s.heartT <= 0) {
        s.pickups.push({ kind: 'heart', x: rand(30, W - 30), y: -30, vy: 170 });
        s.heartT = rand(...HEART_EVERY);
      }
      // hour ticks
      const hour = Math.floor(9 + p * 8);
      if (hour > s.lastHour) {
        s.lastHour = hour;
        sound.sfx.tick();
      }
      if (s.progress >= DURATION) {
        s.phase = 'outro';
        s.outroT = 0;
        s.shield = 0;
        s.invuln = 0;
        s.mood = 'happy';
        s.moodT = 99;
        s.targetX = null;
        s.side = s.px < W / 2 ? 1 : -1;
        s.tableX = W / 2 + s.side * Math.min(W * 0.2, 140);
        sound.sfx.sparkle();
        addText(s, W / 2, H * 0.4, '5:00 PM — clocked out!', '#f2629a', 26);
        burstParticles(s, W / 2, H * 0.4, ['#ffd36e', '#ff9cc2', '#8ec9ff'], 30, 300);
      }
    } else if (s.phase === 'outro') {
      s.outroT += dt;
      s.sunset = clamp(s.outroT / 1.6, 0, 1);
      if (s.outroT > 0.8 && !s.herShown) {
        s.herShown = true;
        setHer({ leftPct: ((s.tableX + s.side * 64) / W) * 100 });
      }
      const target = s.tableX - s.side * 64;
      if (s.outroT > 1.3 && !s.arrived) {
        const dir = Math.sign(target - s.px);
        s.facing = dir || s.facing;
        s.moving = true;
        s.runPhase += dt * 18;
        s.px += dir * 260 * dt;
        if ((dir > 0 && s.px >= target) || (dir < 0 && s.px <= target) || dir === 0) {
          s.px = target;
          s.arrived = true;
          s.moving = false;
          s.facing = s.side;
          s.endT = 0;
          sound.sfx.kiss();
          for (let i = 0; i < 8; i++)
            s.particles.push({ x: (s.px + s.tableX + s.side * 64) / 2 + rand(-30, 30), y: GROUND - 120, vx: rand(-30, 30), vy: rand(-90, -40), life: rand(1.2, 1.8), color: '#ff6f9f', size: rand(8, 13), rot: 0, heart: true });
        }
      }
      if (s.arrived) {
        s.endT += dt;
        if (s.endT > 1.1) end(true);
      }
    } else if (s.phase === 'burnout') {
      s.endT += dt;
      if (s.endT > 0.8) end(false);
    }

    // timers
    s.invuln = Math.max(0, s.invuln - dt);
    s.shield = Math.max(0, s.shield - dt);
    s.shake = Math.max(0, s.shake - dt * 40);
    s.hitFlash = Math.max(0, s.hitFlash - dt * 2.5);
    s.moodT -= dt;
    if (s.moodT <= 0 && s.phase === 'play') s.mood = s.shield > 0 ? 'happy' : 'neutral';

    // player box
    const pb = { l: s.px - 18, r: s.px + 18, t: GROUND - 104, b: GROUND - 6 };

    // hazards
    for (const hz of s.hazards) {
      if (hz.deflect) {
        hz.x += hz.vx * dt;
        hz.vy += 900 * dt;
        hz.rot += hz.vr * dt * 6;
        hz.alpha = Math.max(0, hz.alpha - dt * 1.8);
      } else if (s.phase !== 'play') {
        hz.vy += 600 * dt;
        hz.alpha = Math.max(0, hz.alpha - dt * 2);
      }
      hz.y += hz.vy * dt;
      hz.rot += hz.vr * dt * 0.3;
      if (hz.hit || hz.deflect || s.phase !== 'play') continue;
      const inset = 6;
      if (hz.x + hz.w / 2 - inset > pb.l && hz.x - hz.w / 2 + inset < pb.r && hz.y + hz.h / 2 - inset > pb.t && hz.y - hz.h / 2 + inset < pb.b) {
        if (s.shield > 0) {
          hz.deflect = true;
          hz.vy = -260;
          hz.vx = (hz.x < s.px ? -1 : 1) * rand(120, 220);
          hz.vr = rand(-3, 3);
          sound.sfx.pop(1.3);
          addText(s, hz.x, hz.y, pick(['Declined!', 'Nope!', 'OOO']), '#f2a93b');
        } else if (s.invuln <= 0) {
          hz.hit = true;
          hz.alpha = 0;
          s.stress += 1;
          s.invuln = INVULN_TIME;
          s.shake = 14;
          s.hitFlash = 1;
          s.mood = 'hurt';
          s.moodT = 0.9;
          sound.sfx.hit();
          burstParticles(s, hz.x, hz.y, ['#ffffff', '#c9c2dc', '#ffb3cf', '#96c6fb'], 14, 240);
          addText(s, s.px, GROUND - 130, pick(OUCH), '#ff4d6d', 20);
          if (s.stress >= MAX_STRESS) {
            s.phase = 'burnout';
            s.endT = 0;
            addText(s, W / 2, H * 0.42, 'BURNOUT', '#ff4d6d', 34);
          }
        }
      }
    }
    s.hazards = s.hazards.filter((hz) => hz.y - hz.h < H + 40 && hz.alpha > 0.01);

    // pickups
    for (const pk of s.pickups) {
      pk.y += pk.vy * dt;
      if (s.phase !== 'play' || pk.taken) continue;
      if (Math.abs(pk.x - s.px) < 34 && pk.y > pb.t - 10 && pk.y < pb.b) {
        pk.taken = true;
        if (pk.kind === 'coffee') {
          s.shield = SHIELD_TIME;
          s.mood = 'happy';
          s.moodT = 0.8;
          sound.sfx.coin();
          addText(s, s.px, GROUND - 130, 'Caffeinated!', '#f2a93b', 20);
          burstParticles(s, pk.x, pk.y, ['#ffd36e', '#c98b5a', '#fff'], 10, 160);
        } else {
          s.progress = Math.min(DURATION, s.progress + HEART_BONUS);
          s.mood = 'happy';
          s.moodT = 0.8;
          sound.sfx.sparkle();
          addText(s, s.px, GROUND - 130, '+20 min closer to you', '#f2629a', 17);
          burstParticles(s, pk.x, pk.y, ['#ff6f9f', '#ffb3cf', '#fff'], 10, 160);
        }
      }
    }
    s.pickups = s.pickups.filter((pk) => !pk.taken && pk.y < H + 40);

    // particles & texts
    for (const pt of s.particles) {
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vy += (pt.heart ? -10 : 500) * dt;
      pt.rot += dt * 5;
      pt.life -= dt;
    }
    s.particles = s.particles.filter((pt) => pt.life > 0);
    for (const tx of s.texts) {
      tx.y -= 50 * dt;
      tx.life -= dt * 0.8;
    }
    s.texts = s.texts.filter((tx) => tx.life > 0);

    // HUD (throttled)
    s.hudT -= dt;
    if (s.hudT <= 0) {
      s.hudT = 0.1;
      const pp = clamp(s.progress / DURATION, 0, 1);
      setHud({ minutes: 540 + pp * 480, progress: pp, stress: s.stress, shield: s.shield });
    }

    // ── draw ──
    const sc = scaleRef.current;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.setTransform(sc, 0, 0, sc, 0, 0);
    if (s.shake > 0) ctx.translate(rand(-1, 1) * s.shake, rand(-1, 1) * s.shake * 0.6);
    drawBackground(ctx, s, t, dark);
    if (s.phase === 'outro' || (s.phase === 'done' && s.tableX)) drawTable(ctx, s.tableX, clamp((s.outroT - 0.4) / 0.8, 0, 1), t);
    for (const pk of s.pickups) pk.kind === 'coffee' ? drawCoffee(ctx, pk.x, pk.y, t) : drawHeartPickup(ctx, pk.x, pk.y, t);
    drawPlayer(ctx, s, t);
    for (const hz of s.hazards) drawHazard(ctx, hz, t, dark);
    for (const pt of s.particles) {
      ctx.save();
      ctx.globalAlpha = clamp(pt.life * 2, 0, 1);
      ctx.fillStyle = pt.color;
      if (pt.heart) {
        heartPath(ctx, pt.x, pt.y, pt.size * 1.6);
        ctx.fill();
      } else {
        ctx.translate(pt.x, pt.y);
        ctx.rotate(pt.rot);
        ctx.fillRect(-pt.size / 2, -pt.size / 2, pt.size, pt.size * 0.7);
      }
      ctx.restore();
    }
    for (const tx of s.texts) {
      ctx.save();
      ctx.globalAlpha = clamp(tx.life * 1.5, 0, 1);
      ctx.font = FONT(700, tx.size);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 5;
      ctx.strokeStyle = dark ? '#2a2245' : '#fff';
      const x = clamp(tx.x, 80, W - 80);
      ctx.strokeText(tx.text, x, tx.y);
      ctx.fillStyle = tx.color;
      ctx.fillText(tx.text, x, tx.y);
      ctx.restore();
    }
    // red stress vignette on hit
    if (s.hitFlash > 0) {
      const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.8);
      v.addColorStop(0, 'rgba(255,77,109,0)');
      v.addColorStop(1, `rgba(255,77,109,${0.45 * s.hitFlash})`);
      ctx.fillStyle = v;
      ctx.fillRect(-20, -20, W + 40, H + 40);
    }
  }, running);

  const shieldOn = hud.shield > 0;
  return (
    <Stage className="l04-stage">
      <div className="l04-wrap" ref={wrapRef}>
        <canvas ref={canvasRef} className="l04-canvas" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} aria-label="Corporate Escape game. Move left and right to dodge meetings." />
      </div>

      <GameHud className="l04-hud">
        <HudPill icon={<ClockIcon minutes={hud.minutes} />} value={clockLabel(hud.minutes)} accent="#5b7fe0" />
        <div className="hud-chip l04-stress" style={{ '--chip': '#ff4d6d' }}>
          <span className="hud-chip-label">Stress</span>
          <span className="l04-stress-bar">
            {Array.from({ length: MAX_STRESS }, (_, i) => (
              <span key={i} className={`l04-stress-seg ${i < hud.stress ? 'on' : ''}`} />
            ))}
          </span>
        </div>
        {shieldOn && (
          <div className="hud-chip l04-shield-chip" style={{ '--chip': '#f2a93b' }}>
            <b>Coffee shield</b>
            <span className="l04-shield-time">{Math.ceil(hud.shield)}s</span>
          </div>
        )}
        <div className="l04-progress" role="progressbar" aria-valuenow={Math.round(hud.progress * 100)} aria-valuemax={100}>
          <div className="l04-progress-fill" style={{ transform: `scaleX(${hud.progress})` }} />
          <span className="l04-progress-runner" style={{ left: `${hud.progress * 100}%` }}>
            <Heart size={16} />
          </span>
          <span className="l04-progress-text">Clock-out → Date night 🍝</span>
        </div>
      </GameHud>

      <AnimatePresence>
        {intro && (
          <motion.div className="l04-banner" initial={{ y: 30, opacity: 0, scale: 0.8 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: -20, opacity: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 18 }}>
            9:00 AM. Survive till 5. Dodge the jargon!
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {her && (
          <motion.div className="l04-her" style={{ left: `${her.leftPct}%` }} initial={{ y: 60, opacity: 0, scale: 0.6 }} animate={{ y: 0, opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 14 }}>
            <motion.div className="l04-her-bubble" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.5, type: 'spring' }}>
              Finally! Date night, pillu 💗
            </motion.div>
            <HerChibi size={100} wave mouth="open" />
          </motion.div>
        )}
      </AnimatePresence>
    </Stage>
  );
}
