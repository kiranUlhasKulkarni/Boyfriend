/**
 * Level 2 — "The Love Obby" (Roblox obby)
 *
 * A blocky avatar auto-runs to the right across floating obby blocks.
 * Tap / click / Space / ↑ / W to jump — hold for a higher jump.
 * Kill bricks (glowing red) and spinning bars = "oof", falling into the void = "oof".
 * EASY MODE: 5 tries — each oof respawns you at the last checkpoint (start or mid-course flag);
 * only running out of tries fails the level. Collect floating hearts for fun, reach her at the FINISH.
 */
import { useEffect, useRef, useState } from 'react';
import { Stage, GameHud, HudPill } from './kit.jsx';
import { Heart, HEART_D } from '../components/Icons';
import { sound } from '../audio/soundManager';
import './Level02Obby.css';

/* ───────────── Tunables ───────────── */
const RUN_SPEED = 205; // auto-run speed (units/s) — EASY MODE
const GRAVITY = 1350; // low gravity = floaty, forgiving jumps
const JUMP_V = 600; // initial jump velocity → ~133 units for a quick tap
const HOLD_GRAVITY = 0.7; // gravity multiplier while rising with jump held → ~175 units max (variable height)
const COYOTE = 0.22; // seconds you can still jump after leaving a ledge
const JUMP_BUFFER = 0.3; // seconds a press is remembered before landing
const TRIES = 5; // oofs allowed before the level fails (each respawns at the checkpoint)
const READY_TIME = 1.1; // "Ready… GO!" pause at start / after respawn
const DEATH_PAUSE = 1.05;
const FALL_Y = 520; // below this the player has fallen into the void
const MIN_W = 600; // minimum visible logical area (canvas adapts to any aspect)
const MIN_H = 460;
const PW = 26; // player hitbox
const PH = 46;

/* ───────────── Helpers ───────────── */
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const isDark = () => document.documentElement.dataset.theme === 'dark';
const HEART_PATH = typeof Path2D !== 'undefined' ? new Path2D(HEART_D) : null;

const BLOCK_COLORS = ['#7fd6a4', '#8ec5ff', '#ffb3cf', '#ffd98a', '#c9b3ff', '#86e0d8'];

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => clamp(Math.round(c + amt * (amt > 0 ? 255 - c : c)), 0, 255);
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

/* ───────────── Course ───────────── */
function buildCourse() {
  const plats = [];
  const movers = [];
  const kills = [];
  const spinners = [];
  const hearts = [];
  let cx = -260;
  let ci = 0;
  const add = (rawW, y, o = {}) => {
    const w = Math.max(rawW, 190); // EASY MODE: no tiny platforms
    const p = { x: cx, y, w, h: o.h ?? 34, color: o.color ?? BLOCK_COLORS[ci++ % BLOCK_COLORS.length] };
    plats.push(p);
    cx += w;
    return p;
  };
  const gap = (g) => (cx += g * 0.85); // EASY MODE: shorter gaps
  const heart = (x, y) => hearts.push({ x, y, taken: false, t: Math.random() * 5 });
  const kill = (p, off, w) => kills.push({ x: p.x + off, y: p.y - 14, w, h: 14 });
  const mover = (w, y, o) => {
    const m = { x0: cx, y0: y, w, h: 26, ax: 0, ay: 0, period: 2.4, phase: 0, color: '#c9b3ff', ...o };
    m.x = m.x0;
    m.y = m.y0;
    m.prevY = m.y;
    m.dx = 0;
    m.dy = 0;
    movers.push(m);
    cx += w;
    return m;
  };
  const spinner = (p, off, r, speed) => spinners.push({ x: p.x + off, y: p.y - 4, r, speed, a: Math.random() * TAU });

  // ── part 1: warm-up
  let p = add(560, 0);
  heart(p.x + 430, -70);
  gap(100);
  p = add(240, 0);
  gap(105);
  p = add(200, -45);
  gap(105);
  p = add(240, 0);
  heart(p.x - 50, -150);
  gap(90);
  // first kill brick
  p = add(520, 0);
  kill(p, 240, 60);
  heart(p.x + 270, -125);
  gap(105);
  p = add(170, -40);
  gap(105);
  p = add(170, -80);
  heart(p.x + 85, -170);
  gap(110);
  p = add(420, -30);
  kill(p, 230, 50); // EASY: room to land before reacting
  // vertical movers
  gap(100);
  mover(200, 0, { ay: 22, period: 3.2 }); // EASY: wider, slower, smaller swing
  gap(100);
  mover(200, -25, { ay: 22, period: 3.2, phase: 1.3 });
  heart(cx - 80, -150);
  gap(100);
  p = add(280, 0);
  gap(110);
  // double kill bricks
  p = add(580, 0);
  kill(p, 150, 48);
  kill(p, 390, 48);
  heart(p.x + 175, -120);
  heart(p.x + 415, -120);
  gap(110);
  p = add(150, -50);
  gap(100);
  p = add(150, -15);
  gap(100);
  p = add(150, -55);
  gap(110);

  // ── checkpoint
  p = add(480, 0, { color: '#bfe3ff' });
  const checkpoint = { x: p.x + 150, y: 0, reached: false, wave: 0 };
  heart(p.x + 360, -70);

  // ── part 2: spicier
  // horizontal mover centred in a 360-wide gap (EASY: gaps either side swing 50..110)
  const gapStart = cx;
  cx = gapStart + 80;
  mover(200, -20, { ax: 30, period: 3.6 });
  cx = gapStart + 360;
  heart(gapStart + 180, -120);
  p = add(240, 0);
  gap(100);
  p = add(520, 0);
  spinner(p, 260, 40, 2.3);
  heart(p.x + 260, -150);
  gap(115);
  p = add(130, -45);
  gap(105);
  p = add(130, -90);
  gap(105);
  p = add(130, -135);
  heart(p.x + 65, -225);
  gap(110);
  p = add(440, -90);
  kill(p, 230, 54);
  gap(100);
  mover(200, -50, { ay: 25, period: 3 });
  gap(100);
  mover(200, -20, { ay: 25, period: 3, phase: 1.1 });
  gap(100);
  p = add(260, 0);
  heart(p.x + 130, -70);
  gap(100);
  p = add(700, 0);
  kill(p, 220, 50);
  spinner(p, 500, 38, -2.6);
  heart(p.x + 245, -120);
  gap(110);
  p = add(160, -40);
  gap(110);
  p = add(160, 0);
  gap(110);
  p = add(160, -45);
  heart(p.x + 80, -140);
  gap(110);

  // ── finish
  p = add(900, 0, { color: '#ffb3cf', h: 44 });
  const finish = { platform: p, archX: p.x + 230, herX: p.x + 430 };
  return { plats, movers, kills, spinners, hearts, checkpoint, finish, startX: 0 };
}

/* ───────────── Drawing helpers ───────────── */
function drawBlock(ctx, x, y, w, h, color, dark, studs = true) {
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.beginPath();
  ctx.roundRect(x + 4, y + 6, w, h, 6);
  ctx.fill();
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, shade(color, dark ? -0.05 : 0.15));
  g.addColorStop(1, shade(color, dark ? -0.45 : -0.18));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 6);
  ctx.fill();
  ctx.fillStyle = shade(color, dark ? 0.15 : 0.45);
  ctx.beginPath();
  ctx.roundRect(x + 2, y + 2, w - 4, 6, 3);
  ctx.fill();
  if (studs) {
    ctx.fillStyle = shade(color, dark ? 0.25 : 0.55);
    for (let sx = x + 10; sx < x + w - 6; sx += 16) {
      ctx.beginPath();
      ctx.ellipse(sx, y + 1, 4.5, 2.2, 0, Math.PI, TAU);
      ctx.fill();
    }
  }
  ctx.strokeStyle = shade(color, -0.35);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 6);
  ctx.stroke();
}

function drawHeartShape(ctx, x, y, size, fill, glow) {
  if (!HEART_PATH) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 100, size / 100);
  ctx.translate(-50, -50);
  if (glow) {
    ctx.shadowColor = glow;
    ctx.shadowBlur = 18;
  }
  ctx.fillStyle = fill;
  ctx.fill(HEART_PATH);
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath();
  ctx.ellipse(30, 28, 10, 7, -0.6, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** Blocky avatar, feet at (0,0). */
function drawAvatar(ctx, pl, t) {
  const grounded = pl.grounded;
  const run = grounded ? Math.sin(pl.runPhase) : 0;
  const legA = grounded ? run * 0.6 : 0.5;
  const armA = grounded ? -run * 0.7 : -2.4;
  const yellow = '#f6cf3a';
  const yellowD = '#d9ab17';

  const limb = (px, py, w, h, ang, col, colD) => {
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(ang);
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.roundRect(-w / 2, 0, w, h, 2.5);
    ctx.fill();
    ctx.fillStyle = colD;
    ctx.fillRect(w / 2 - 2.5, 1, 2.5, h - 2);
    ctx.restore();
  };
  // back arm + back leg
  limb(-14, -31, 8, 16, -armA * 0.9, yellowD, '#b98d10');
  limb(-4, -16, 11, 16, -legA, '#3f9a52', '#2f7a40');
  // front leg
  limb(5, -16, 11, 16, legA, '#5cbf6a', '#3f9a52');
  // torso
  const tg = ctx.createLinearGradient(-13, 0, 13, 0);
  tg.addColorStop(0, '#4e98f0');
  tg.addColorStop(1, '#1f63c4');
  ctx.fillStyle = tg;
  ctx.beginPath();
  ctx.roundRect(-13, -33, 26, 19, 3);
  ctx.fill();
  if (HEART_PATH) drawHeartShape(ctx, 4, -24, 9, '#ff7fb0');
  // front arm
  limb(14, -31, 8, 16, armA, yellow, yellowD);
  // head
  ctx.fillStyle = yellow;
  ctx.beginPath();
  ctx.roundRect(-10, -49, 20, 16, 5);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.roundRect(-8, -47, 5, 12, 2.5);
  ctx.fill();
  ctx.fillStyle = yellowD;
  ctx.fillRect(-4, -34, 8, 2);
  // classic face
  const blink = Math.sin(t * 1.7) > 0.985;
  ctx.fillStyle = '#1b1b1b';
  if (blink) {
    ctx.fillRect(-3.5, -43, 3, 1.2);
    ctx.fillRect(4, -43, 3, 1.2);
  } else {
    ctx.beginPath();
    ctx.ellipse(-2, -43, 1.4, 2.2, 0, 0, TAU);
    ctx.ellipse(5.5, -43, 1.4, 2.2, 0, 0, TAU);
    ctx.fill();
  }
  ctx.strokeStyle = '#1b1b1b';
  ctx.lineWidth = 1.3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(1.8, -40, 4.2, 0.25, Math.PI - 0.25);
  ctx.stroke();
}

/** Her: canvas chibi, feet at (0,0), ~92 tall, waving. */
function drawHer(ctx, t, excited) {
  const skin = '#eab48e';
  const hair = '#2e1c1a';
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 20, 4, 0, 0, TAU);
  ctx.fill();
  // back hair
  ctx.fillStyle = hair;
  ctx.beginPath();
  ctx.moveTo(-22, -66);
  ctx.quadraticCurveTo(-28, -30, -18, -24);
  ctx.quadraticCurveTo(0, -18, 18, -24);
  ctx.quadraticCurveTo(28, -30, 22, -66);
  ctx.closePath();
  ctx.fill();
  // legs + shoes
  ctx.fillStyle = skin;
  ctx.fillRect(-7, -16, 5, 14);
  ctx.fillRect(2, -16, 5, 14);
  ctx.fillStyle = '#ff7fb0';
  ctx.beginPath();
  ctx.ellipse(-5, -2, 5, 3, 0, 0, TAU);
  ctx.ellipse(5, -2, 5, 3, 0, 0, TAU);
  ctx.fill();
  // dress
  ctx.fillStyle = '#ffb3cf';
  ctx.strokeStyle = '#f07aa6';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-9, -44);
  ctx.lineTo(9, -44);
  ctx.lineTo(19, -15);
  ctx.quadraticCurveTo(0, -10, -19, -15);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = '#fff';
  ctx.setLineDash([1, 4]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-16, -16);
  ctx.quadraticCurveTo(0, -12, 16, -16);
  ctx.stroke();
  ctx.setLineDash([]);
  // bow
  ctx.fillStyle = '#ff6f9f';
  ctx.beginPath();
  ctx.moveTo(0, -38);
  ctx.lineTo(-5, -41);
  ctx.lineTo(-5, -35);
  ctx.closePath();
  ctx.moveTo(0, -38);
  ctx.lineTo(5, -41);
  ctx.lineTo(5, -35);
  ctx.closePath();
  ctx.fill();
  // arms
  ctx.strokeStyle = skin;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-8, -41);
  ctx.lineTo(-14, -26);
  ctx.stroke();
  const wave = Math.sin(t * (excited ? 14 : 7)) * 0.5;
  ctx.save();
  ctx.translate(8, -41);
  ctx.rotate(-2.3 + wave);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(16, 0);
  ctx.stroke();
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(17, 0, 3.6, 0, TAU);
  ctx.fill();
  ctx.restore();
  // head
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.ellipse(0, -62, 20, 19, 0, 0, TAU);
  ctx.fill();
  // fringe
  ctx.fillStyle = hair;
  ctx.beginPath();
  ctx.moveTo(-21, -58);
  ctx.quadraticCurveTo(-22, -84, 0, -84);
  ctx.quadraticCurveTo(22, -84, 21, -58);
  ctx.quadraticCurveTo(16, -70, 9, -72);
  ctx.quadraticCurveTo(6, -66, -2, -66);
  ctx.quadraticCurveTo(2, -69, 2, -72);
  ctx.quadraticCurveTo(-8, -64, -18, -64);
  ctx.quadraticCurveTo(-19, -60, -21, -58);
  ctx.fill();
  // eyes / blush / mouth
  ctx.fillStyle = '#2a1a22';
  ctx.beginPath();
  ctx.ellipse(-7, -59, 2.8, 3.5, 0, 0, TAU);
  ctx.ellipse(7, -59, 2.8, 3.5, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(-6, -60.5, 1.1, 0, TAU);
  ctx.arc(8, -60.5, 1.1, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#2a1a22';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-10, -61);
  ctx.lineTo(-12, -62.5);
  ctx.moveTo(10, -61);
  ctx.lineTo(12, -62.5);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,143,176,0.6)';
  ctx.beginPath();
  ctx.ellipse(-12, -53, 4, 2.4, 0, 0, TAU);
  ctx.ellipse(12, -53, 4, 2.4, 0, 0, TAU);
  ctx.fill();
  if (excited) {
    ctx.fillStyle = '#a8344e';
    ctx.beginPath();
    ctx.moveTo(-4, -53);
    ctx.quadraticCurveTo(0, -46, 4, -53);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.strokeStyle = '#7a2e3c';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(0, -54, 3.4, 0.2, Math.PI - 0.2);
    ctx.stroke();
  }
  // heart clip
  drawHeartShape(ctx, 14, -78, 10, '#ff7fb0');
}

/* ───────────── Component ───────────── */
export default function Level02Obby({ onWin, onFail }) {
  const canvasRef = useRef(null);
  const ended = useRef(false);
  const cbs = useRef({ onWin, onFail });
  cbs.current = { onWin, onFail };
  const [hud, setHud] = useState({ progress: 0, hearts: 0, totalHearts: 0, tries: TRIES });

  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = canvas; // HUD is pointer-events:none, so the canvas receives every tap
    const ctx = canvas.getContext('2d');

    let W = MIN_W;
    let H = MIN_H;
    let scale = 1;
    let dpr = 1;
    const fit = () => {
      const r = canvas.getBoundingClientRect();
      if (!r.width || !r.height) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      scale = Math.min(r.width / MIN_W, r.height / MIN_H);
      W = r.width / scale;
      H = r.height / scale;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(canvas);

    const course = buildCourse();
    const { plats, movers, kills, spinners, hearts, checkpoint, finish } = course;
    const solids = [...plats, ...movers];
    const spawnPoint = { x: 40, y: 0 };

    const pl = {
      x: spawnPoint.x,
      y: 0,
      vy: 0,
      grounded: true,
      ground: null,
      lastGround: 0,
      jumping: false,
      runPhase: 0,
      sx: 1,
      sy: 1,
    };
    const S = {
      time: 0,
      state: 'ready', // ready | run | dead | won
      stateT: 0,
      tries: TRIES,
      heartsGot: 0,
      jumpHeld: false,
      jumpPressedAt: -1,
      camX: pl.x - W * 0.3,
      camY: -H * 0.68,
      particles: [],
      texts: [],
      pieces: [],
      shake: 0,
      done: false,
    };
    // decorative parallax clouds + stars (in screen-ish space)
    const clouds = Array.from({ length: 9 }, (_, i) => ({
      x: i * 260 + rand(0, 120),
      y: rand(0.08, 0.42),
      s: rand(0.7, 1.3),
      layer: i % 2,
    }));
    const stars = Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random() * 0.7, r: rand(0.4, 1.6), tw: rand(0, TAU) }));

    let hudKey = '';
    const pushHud = () => {
      const progress = clamp((pl.x - spawnPoint.x) / (finish.herX - 30 - PW - spawnPoint.x), 0, 1);
      const k = `${Math.round(progress * 200)}|${S.heartsGot}|${S.tries}`;
      if (k !== hudKey) {
        hudKey = k;
        setHud({ progress, hearts: S.heartsGot, totalHearts: hearts.length, tries: S.tries });
      }
    };

    const end = (won, reason) => {
      if (ended.current || S.done) return;
      ended.current = true;
      S.done = true;
      pushHud();
      if (won) cbs.current.onWin();
      else cbs.current.onFail(reason);
    };

    /* ── effects ── */
    const dust = (x, y, n, power = 1) => {
      for (let i = 0; i < n; i++) {
        S.particles.push({
          kind: 'dust',
          x: x + rand(-10, 10),
          y: y - rand(0, 4),
          vx: rand(-70, 30) * power,
          vy: rand(-60, -10) * power,
          size: rand(3, 6),
          life: rand(0.3, 0.55),
          max: 0.55,
        });
      }
    };
    const floatText = (x, y, text, color, size = 22) => S.texts.push({ x, y, text, color, size, life: 1, max: 1 });
    const heartBurst = (x, y, n) => {
      for (let i = 0; i < n; i++) {
        const a = rand(0, TAU);
        const sp = rand(80, 320);
        S.particles.push({
          kind: 'heart',
          x,
          y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp - 140,
          size: rand(10, 22),
          life: rand(0.9, 1.6),
          max: 1.6,
          color: ['#ff7fb0', '#ffb3cf', '#ff5d8f', '#8ec5ff'][i % 4],
        });
      }
    };

    /* ── input ── */
    const press = () => {
      if (S.done || S.state === 'dead' || S.state === 'won') return;
      S.jumpHeld = true;
      S.jumpPressedAt = S.time;
    };
    const release = () => {
      S.jumpHeld = false;
    };
    const JUMP_KEYS = ['Space', 'ArrowUp', 'KeyW'];
    const onKeyDown = (e) => {
      if (!JUMP_KEYS.includes(e.code)) return;
      e.preventDefault();
      if (!e.repeat) press();
    };
    const onKeyUp = (e) => {
      if (!JUMP_KEYS.includes(e.code)) return;
      e.preventDefault();
      release();
    };
    const onDown = (e) => {
      e.preventDefault();
      try {
        stage.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      press();
    };
    stage.addEventListener('pointerdown', onDown);
    stage.addEventListener('pointerup', release);
    stage.addEventListener('pointercancel', release);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    /* ── death / respawn ── */
    const die = (why) => {
      if (S.state !== 'run') return;
      S.state = 'dead';
      S.stateT = 0;
      S.tries -= 1;
      S.shake = 10;
      sound.sfx.bad();
      const fell = why === 'fall';
      // Roblox-style "oof": the avatar breaks into its blocks
      if (!fell) {
        const parts = [
          ['#f6cf3a', 20, 16, -40],
          ['#2f7fe0', 26, 19, -24],
          ['#f6cf3a', 8, 16, -24],
          ['#f6cf3a', 8, 16, -24],
          ['#5cbf6a', 11, 16, -8],
          ['#5cbf6a', 11, 16, -8],
        ];
        parts.forEach(([color, w, h, oy]) =>
          S.pieces.push({
            color,
            w,
            h,
            x: pl.x + PW / 2 + rand(-6, 6),
            y: pl.y + oy,
            vx: rand(-160, 160),
            vy: rand(-520, -220),
            rot: 0,
            vr: rand(-8, 8),
          })
        );
      }
      const tx = fell ? clamp(pl.x + PW / 2, S.camX + 60, S.camX + W - 60) : pl.x + PW / 2;
      const ty = fell ? S.camY + H - 70 : pl.y - 70;
      floatText(tx, ty, 'Oof!', '#ff5d7a', 30);
    };
    const respawn = () => {
      const cp = checkpoint.reached ? { x: checkpoint.x - 20, y: checkpoint.y } : spawnPoint;
      pl.x = cp.x;
      pl.y = cp.y;
      pl.vy = 0;
      pl.grounded = true;
      pl.ground = null;
      pl.jumping = false;
      pl.sx = 0.6;
      pl.sy = 1.4;
      S.pieces = [];
      S.state = 'ready';
      S.stateT = 0;
      S.jumpPressedAt = -1;
      sound.sfx.pop();
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * TAU;
        S.particles.push({ kind: 'spark', x: pl.x + PW / 2, y: pl.y - PH / 2, vx: Math.cos(a) * 140, vy: Math.sin(a) * 140, size: 3, life: 0.5, max: 0.5 });
      }
    };

    /* ── update ── */
    const update = (dt) => {
      S.time += dt;
      S.stateT += dt;

      // moving platforms
      for (const m of movers) {
        const nx = m.x0 + Math.sin((S.time / m.period) * TAU + m.phase) * m.ax;
        const ny = m.y0 + Math.sin((S.time / m.period) * TAU + m.phase) * m.ay;
        m.dx = nx - m.x;
        m.dy = ny - m.y;
        m.prevY = m.y;
        m.x = nx;
        m.y = ny;
      }
      for (const s of spinners) s.a += s.speed * 0.6 * dt; // slowed for easy mode
      for (const p of plats) p.prevY = p.y;

      if (S.state === 'ready' && S.stateT >= READY_TIME) S.state = 'run';

      if (S.state === 'run' || S.state === 'ready' || S.state === 'won') {
        // ride movers
        if (pl.grounded && pl.ground && pl.ground.dx !== undefined) {
          pl.x += pl.ground.dx;
          pl.y += pl.ground.dy;
        }
        const running = S.state === 'run';
        const speed = running ? RUN_SPEED : 0;

        // jump (coyote + buffer)
        if (running) {
          const canJump = pl.grounded || S.time - pl.lastGround <= COYOTE;
          if (canJump && S.jumpPressedAt >= 0 && S.time - S.jumpPressedAt <= JUMP_BUFFER && !pl.jumping) {
            pl.vy = -JUMP_V;
            pl.grounded = false;
            pl.ground = null;
            pl.jumping = true;
            pl.lastGround = -1;
            S.jumpPressedAt = -1;
            pl.sx = 0.75;
            pl.sy = 1.3;
            sound.sfx.jump();
            dust(pl.x + PW / 2, pl.y, 6);
          }
        }

        // horizontal move with wall blocking
        let nx = pl.x + speed * dt;
        for (const s of solids) {
          if (pl.y > s.y + 4 && pl.y - PH < s.y + s.h && pl.x + PW <= s.x + 1 && nx + PW > s.x) {
            nx = s.x - PW;
          }
        }
        pl.x = nx;

        // vertical
        const prevBottom = pl.y;
        const prevTop = pl.y - PH;
        const wasGrounded = pl.grounded;
        const prevGround = pl.ground;
        const holdFloat = pl.jumping && pl.vy < 0 && S.jumpHeld;
        pl.vy += GRAVITY * (holdFloat ? HOLD_GRAVITY : 1) * dt;
        pl.y += pl.vy * dt;
        pl.grounded = false;
        pl.ground = null;
        for (const s of solids) {
          if (!(pl.x + PW > s.x && pl.x < s.x + s.w)) continue; // no margin: matches the wall check, so corners can't be clipped
          const wasOn = wasGrounded && prevGround === s;
          if (pl.vy >= 0 && (wasOn || prevBottom <= s.prevY + 4) && pl.y >= s.y) {
            pl.y = s.y;
            if (!wasGrounded && pl.vy > 300) {
              pl.sx = 1.3;
              pl.sy = 0.72;
              dust(pl.x + PW / 2, pl.y, 7, 1.2);
            }
            pl.vy = 0;
            pl.grounded = true;
            pl.ground = s;
            pl.jumping = false;
          } else if (pl.vy < 0 && prevTop >= s.prevY + s.h - 4 && pl.y - PH < s.y + s.h) {
            pl.y = s.y + s.h + PH;
            pl.vy = 0;
          }
        }
        if (pl.grounded) pl.lastGround = S.time;
        if (pl.grounded && running) {
          pl.runPhase += dt * 16;
          if (Math.random() < dt * 6) dust(pl.x + 4, pl.y, 1, 0.5);
        }

        if (running) {
          // hearts
          for (const h of hearts) {
            if (h.taken) continue;
            const hy = h.y + Math.sin(S.time * 3 + h.t) * 5;
            if (Math.abs(pl.x + PW / 2 - h.x) < 24 && Math.abs(pl.y - PH / 2 - hy) < 32) {
              h.taken = true;
              S.heartsGot += 1;
              sound.sfx.coin();
              heartBurst(h.x, hy, 6);
              floatText(h.x, hy - 24, '+1 💗', '#ff5d8f', 20);
            }
          }
          // checkpoint
          if (!checkpoint.reached && pl.x + PW / 2 >= checkpoint.x) {
            checkpoint.reached = true;
            sound.sfx.sparkle();
            floatText(checkpoint.x, -150, 'Checkpoint!', '#4fc38a', 26);
            heartBurst(checkpoint.x, -110, 10);
          }
          // hazards
          // generous hitbox: only the core of the avatar counts
          const hx0 = pl.x + 8;
          const hx1 = pl.x + PW - 8;
          const hy0 = pl.y - PH + 10;
          const hy1 = pl.y - 7;
          for (const k of kills) {
            if (hx1 > k.x && hx0 < k.x + k.w && hy1 > k.y && hy0 < k.y + k.h) {
              die('kill');
              break;
            }
          }
          if (S.state === 'run') {
            outer: for (const s of spinners) {
              const cx = Math.cos(s.a) * s.r;
              const cy = Math.sin(s.a) * s.r;
              for (let i = -6; i <= 6; i++) {
                const px = s.x + (cx * i) / 6;
                const py = s.y + (cy * i) / 6;
                if (px > hx0 && px < hx1 && py > hy0 && py < hy1) {
                  die('spinner');
                  break outer;
                }
              }
            }
          }
          if (S.state === 'run' && pl.y > FALL_Y) die('fall');
          // finish
          if (S.state === 'run' && pl.x + PW >= finish.herX - 28) {
            S.state = 'won';
            S.stateT = 0;
            sound.sfx.kiss();
            sound.sfx.sparkle();
            heartBurst(finish.herX, -60, 40);
            floatText(finish.herX - 20, -130, 'You made it, pillu! 💗', '#ff5d8f', 26);
          }
        }
      }

      if (S.state === 'dead') {
        for (const p of S.pieces) {
          p.vy += GRAVITY * 0.7 * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.rot += p.vr * dt;
        }
        if (S.stateT >= DEATH_PAUSE) {
          if (S.tries <= 0) {
            end(false, 'Oof! You fell off the obby twice.');
            return;
          }
          respawn();
        }
      }
      if (S.state === 'won' && S.stateT >= 1.3) {
        end(true);
        return;
      }

      // squash/stretch spring back
      pl.sx = lerp(pl.sx, 1, 1 - Math.exp(-dt * 12));
      pl.sy = lerp(pl.sy, 1, 1 - Math.exp(-dt * 12));

      // camera
      const tx = pl.x - W * 0.3;
      const ty = Math.min(-H * 0.68, pl.y - H * 0.5);
      const follow = S.state === 'dead' ? 0 : 1 - Math.exp(-dt * 8);
      S.camX = lerp(S.camX, Math.min(tx, finish.herX + 260 - W), follow);
      if (pl.y < FALL_Y - 200) S.camY = lerp(S.camY, ty, 1 - Math.exp(-dt * 4));

      for (const p of S.particles) {
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.kind === 'heart') p.vy += 420 * dt;
        if (p.kind === 'dust') {
          p.vx *= 0.92;
          p.vy *= 0.92;
          p.size += dt * 10;
        }
      }
      S.particles = S.particles.filter((p) => p.life > 0);
      for (const t of S.texts) {
        t.life -= dt;
        t.y -= 40 * dt;
      }
      S.texts = S.texts.filter((t) => t.life > 0);
      S.shake = Math.max(0, S.shake - 40 * dt);
    };

    /* ── draw ── */
    const drawBackground = (dark) => {
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      if (dark) {
        sky.addColorStop(0, '#0b0e2e');
        sky.addColorStop(0.6, '#221d4f');
        sky.addColorStop(1, '#3a2a5e');
      } else {
        sky.addColorStop(0, '#9fd6ff');
        sky.addColorStop(0.6, '#cfe9ff');
        sky.addColorStop(1, '#ffe1ee');
      }
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);

      if (dark) {
        for (const s of stars) {
          ctx.globalAlpha = 0.45 + 0.55 * Math.abs(Math.sin(S.time * 1.5 + s.tw));
          ctx.fillStyle = '#fff';
          ctx.fillRect(s.x * W, s.y * H, s.r * 1.6, s.r * 1.6);
        }
        ctx.globalAlpha = 1;
        // blocky moon
        ctx.fillStyle = 'rgba(255,244,214,0.18)';
        ctx.beginPath();
        ctx.roundRect(W * 0.8 - 46, H * 0.16 - 46, 92, 92, 18);
        ctx.fill();
        ctx.fillStyle = '#fff2cf';
        ctx.beginPath();
        ctx.roundRect(W * 0.8 - 28, H * 0.16 - 28, 56, 56, 10);
        ctx.fill();
        ctx.fillStyle = 'rgba(220,190,140,0.5)';
        ctx.fillRect(W * 0.8 - 14, H * 0.16 - 10, 10, 10);
        ctx.fillRect(W * 0.8 + 6, H * 0.16 + 6, 8, 8);
      } else {
        // blocky sun
        ctx.fillStyle = 'rgba(255,236,160,0.35)';
        ctx.beginPath();
        ctx.roundRect(W * 0.8 - 50, H * 0.15 - 50, 100, 100, 22);
        ctx.fill();
        ctx.fillStyle = '#ffe58f';
        ctx.beginPath();
        ctx.roundRect(W * 0.8 - 30, H * 0.15 - 30, 60, 60, 12);
        ctx.fill();
      }

      // blocky clouds
      const span = 260 * clouds.length;
      for (const c of clouds) {
        const f = c.layer ? 0.35 : 0.15;
        const x = ((((c.x - S.camX * f) % span) + span) % span) - 200;
        const y = c.y * H - (S.camY + H * 0.68) * f * 0.5;
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(c.s, c.s);
        ctx.fillStyle = dark ? (c.layer ? 'rgba(120,110,190,0.55)' : 'rgba(90,85,160,0.45)') : c.layer ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.7)';
        ctx.beginPath();
        ctx.roundRect(0, 18, 130, 30, 8);
        ctx.roundRect(22, 0, 52, 30, 8);
        ctx.roundRect(60, 6, 48, 30, 8);
        ctx.fill();
        ctx.fillStyle = dark ? 'rgba(60,55,120,0.35)' : 'rgba(180,210,240,0.45)';
        ctx.fillRect(4, 40, 122, 8);
        ctx.restore();
      }

      // distant baseplate with perspective grid
      const top = clamp(H * 0.8 - (S.camY + H * 0.68) * 0.2, H * 0.62, H * 0.95);
      const bp = ctx.createLinearGradient(0, top, 0, H);
      if (dark) {
        bp.addColorStop(0, '#1a2140');
        bp.addColorStop(1, '#262f5a');
      } else {
        bp.addColorStop(0, '#cdeedd');
        bp.addColorStop(1, '#a8dcc0');
      }
      ctx.fillStyle = bp;
      ctx.fillRect(0, top, W, H - top);
      ctx.strokeStyle = dark ? 'rgba(142,201,255,0.35)' : 'rgba(80,150,110,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      const vp = W / 2;
      const off = (S.camX * 0.5) % 60;
      for (let x = -W * 2; x < W * 3; x += 60) {
        const xt = x - off;
        ctx.moveTo(vp + (xt - vp) * 0.35, top);
        ctx.lineTo(vp + (xt - vp) * 1.6, H);
      }
      for (let i = 1, y = top; i < 12 && y < H; i++) {
        y = top + (H - top) * Math.pow(i / 11, 1.8);
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
      }
      ctx.stroke();
      // distance haze so the baseplate reads as far below the course
      const haze = ctx.createLinearGradient(0, top, 0, top + (H - top) * 0.6);
      haze.addColorStop(0, dark ? 'rgba(58,42,94,0.85)' : 'rgba(255,225,238,0.85)');
      haze.addColorStop(1, dark ? 'rgba(58,42,94,0)' : 'rgba(255,225,238,0)');
      ctx.fillStyle = haze;
      ctx.fillRect(0, top, W, H - top);
    };

    const draw = () => {
      const dark = isDark();
      const k = scale * dpr;
      ctx.setTransform(k, 0, 0, k, 0, 0);
      drawBackground(dark);

      const sx = S.shake ? rand(-S.shake, S.shake) * 0.5 : 0;
      const sy = S.shake ? rand(-S.shake, S.shake) * 0.5 : 0;
      const ox = -Math.round(S.camX) + sx;
      const oy = -Math.round(S.camY) + sy;
      ctx.setTransform(k, 0, 0, k, ox * k, oy * k);
      const viewL = S.camX - 120;
      const viewR = S.camX + W + 120;
      const vis = (x, w) => x + w > viewL && x < viewR;

      // finish arch (behind)
      if (vis(finish.archX - 80, 160)) {
        const ax = finish.archX;
        const ay = finish.platform.y;
        const pillar = (x) => {
          for (let i = 0; i < 9; i++) {
            ctx.fillStyle = i % 2 ? '#fff' : '#ff85b1';
            ctx.fillRect(x - 8, ay - 20 - i * 18, 16, 18);
          }
        };
        pillar(ax - 70);
        pillar(ax + 70);
        ctx.fillStyle = '#ff6f9f';
        ctx.shadowColor = 'rgba(255,111,159,0.7)';
        ctx.shadowBlur = dark ? 20 : 8;
        ctx.beginPath();
        ctx.roundRect(ax - 96, ay - 214, 192, 46, 14);
        ctx.fill();
        ctx.shadowBlur = 0;
        for (let i = 0; i < 12; i++) {
          ctx.fillStyle = i % 2 ? '#fff' : '#2a2245';
          ctx.fillRect(ax - 90 + i * 15, ay - 172, 15, 6);
        }
        ctx.fillStyle = '#fff';
        ctx.font = '700 24px Fredoka, Quicksand, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('FINISH 💗', ax, ay - 190);
      }

      // platforms
      for (const p of plats) if (vis(p.x, p.w)) drawBlock(ctx, p.x, p.y, p.w, p.h, p.color, dark);
      for (const m of movers) {
        if (!vis(m.x, m.w)) continue;
        drawBlock(ctx, m.x, m.y, m.w, m.h, m.color, dark, false);
        // arrows hint at the motion direction
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.font = '700 14px Fredoka, Quicksand, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(m.ay ? '⇅' : '⇆', m.x + m.w / 2, m.y + m.h / 2 + 1);
      }

      // checkpoint flag + spawn pad
      if (vis(checkpoint.x - 60, 140)) {
        const fx = checkpoint.x;
        const fy = checkpoint.y;
        ctx.fillStyle = dark ? '#5d6a8a' : '#9aa6bd';
        ctx.beginPath();
        ctx.roundRect(fx - 34, fy - 6, 68, 8, 3);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(fx, fy - 2, 3, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#e8e8f0';
        ctx.fillRect(fx + 26, fy - 120, 4, 116);
        const col = checkpoint.reached ? '#ff6f9f' : '#7fd6a4';
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(fx + 30, fy - 120);
        for (let i = 0; i <= 10; i++) {
          const px = fx + 30 + i * 5;
          ctx.lineTo(px, fy - 120 + Math.sin(S.time * 6 - i * 0.6) * 3 * (i / 10));
        }
        for (let i = 10; i >= 0; i--) {
          const px = fx + 30 + i * 5;
          ctx.lineTo(px, fy - 88 + Math.sin(S.time * 6 - i * 0.6) * 3 * (i / 10));
        }
        ctx.closePath();
        ctx.fill();
        if (checkpoint.reached) drawHeartShape(ctx, fx + 55, fy - 104, 16, '#fff');
        ctx.fillStyle = '#ffd36e';
        ctx.beginPath();
        ctx.arc(fx + 28, fy - 122, 5, 0, TAU);
        ctx.fill();
      }

      // kill bricks
      const pulse = 0.75 + 0.25 * Math.sin(S.time * 6);
      for (const kb of kills) {
        if (!vis(kb.x, kb.w)) continue;
        ctx.shadowColor = '#ff2e55';
        ctx.shadowBlur = (dark ? 22 : 12) * pulse;
        ctx.fillStyle = `rgba(255,${Math.round(40 + 30 * pulse)},80,1)`;
        ctx.beginPath();
        ctx.roundRect(kb.x, kb.y, kb.w, kb.h, 3);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,200,210,0.85)';
        ctx.fillRect(kb.x + 3, kb.y + 2, kb.w - 6, 2.5);
      }
      // spinners
      for (const s of spinners) {
        if (!vis(s.x - s.r, s.r * 2)) continue;
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(s.a);
        ctx.shadowColor = '#ff2e55';
        ctx.shadowBlur = dark ? 22 : 12;
        ctx.fillStyle = '#ff4466';
        ctx.beginPath();
        ctx.roundRect(-s.r, -5, s.r * 2, 10, 5);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,210,220,0.9)';
        ctx.fillRect(-s.r + 4, -3, s.r * 2 - 8, 2);
        ctx.restore();
        ctx.fillStyle = dark ? '#6b6f8f' : '#8a90a8';
        ctx.beginPath();
        ctx.arc(s.x, s.y, 8, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#d8dbe8';
        ctx.beginPath();
        ctx.arc(s.x, s.y, 3.5, 0, TAU);
        ctx.fill();
      }

      // hearts
      for (const h of hearts) {
        if (h.taken || !vis(h.x - 20, 40)) continue;
        const hy = h.y + Math.sin(S.time * 3 + h.t) * 5;
        const sc = 1 + Math.sin(S.time * 5 + h.t) * 0.06;
        drawHeartShape(ctx, h.x, hy, 30 * sc, '#ff7fb0', dark ? 'rgba(255,127,176,0.9)' : 'rgba(255,127,176,0.5)');
      }

      // her
      if (vis(finish.herX - 40, 80)) {
        ctx.save();
        ctx.translate(finish.herX, finish.platform.y + (S.state === 'won' ? -Math.abs(Math.sin(S.stateT * 8)) * 8 : 0));
        ctx.scale(-1.15, 1.15); // face the player
        drawHer(ctx, S.time, S.state === 'won' || pl.x > finish.archX);
        ctx.restore();
        if (S.state !== 'won') {
          const by = finish.platform.y - 118 + Math.sin(S.time * 3) * 4;
          drawHeartShape(ctx, finish.herX, by, 22, '#ff5d8f', 'rgba(255,93,143,0.6)');
        }
      }

      // player
      if (S.state !== 'dead') {
        const blinkOut = S.state === 'ready' && S.time > READY_TIME + 0.01 && Math.floor(S.stateT * 12) % 2 === 0;
        if (!blinkOut) {
          ctx.save();
          ctx.translate(pl.x + PW / 2, pl.y);
          ctx.fillStyle = 'rgba(0,0,0,0.15)';
          if (pl.grounded) {
            ctx.beginPath();
            ctx.ellipse(0, 0, 14 * pl.sx, 3, 0, 0, TAU);
            ctx.fill();
          }
          ctx.scale(pl.sx, pl.sy);
          drawAvatar(ctx, pl, S.time);
          ctx.restore();
        }
      } else {
        for (const p of S.pieces) {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.roundRect(-p.w / 2, -p.h / 2, p.w, p.h, 3);
          ctx.fill();
          ctx.restore();
        }
      }

      // particles
      for (const p of S.particles) {
        const a = clamp(p.life / p.max, 0, 1);
        ctx.globalAlpha = a;
        if (p.kind === 'dust') {
          ctx.fillStyle = dark ? 'rgba(200,200,240,0.7)' : 'rgba(255,255,255,0.9)';
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, TAU);
          ctx.fill();
        } else if (p.kind === 'heart') {
          drawHeartShape(ctx, p.x, p.y, p.size, p.color);
        } else if (p.kind === 'spark') {
          ctx.fillStyle = '#ffd36e';
          ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        }
      }
      ctx.globalAlpha = 1;

      // floating text
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const t of S.texts) {
        ctx.globalAlpha = clamp(t.life / t.max, 0, 1);
        ctx.font = `700 ${t.size}px Fredoka, Quicksand, sans-serif`;
        ctx.lineWidth = 5;
        ctx.strokeStyle = dark ? 'rgba(20,16,40,0.8)' : 'rgba(255,255,255,0.95)';
        ctx.strokeText(t.text, t.x, t.y);
        ctx.fillStyle = t.color;
        ctx.fillText(t.text, t.x, t.y);
      }
      ctx.globalAlpha = 1;

      // ready / go banner (screen space)
      ctx.setTransform(k, 0, 0, k, 0, 0);
      const banner = (text, a, size) => {
        ctx.globalAlpha = a;
        ctx.font = `700 ${size}px Fredoka, Quicksand, sans-serif`;
        ctx.lineWidth = 7;
        ctx.strokeStyle = dark ? '#2a2245' : '#ffffff';
        ctx.strokeText(text, W / 2, H * 0.36);
        ctx.fillStyle = '#4fc38a';
        ctx.fillText(text, W / 2, H * 0.36);
        ctx.globalAlpha = 1;
      };
      if (S.state === 'ready') {
        banner(S.time < READY_TIME + 0.01 ? 'Ready, pillu?' : `Try again! (${S.tries} left)`, 1, 40);
      } else if (S.state === 'run' && S.stateT < 0.6) {
        banner('GO!', 1 - S.stateT / 0.6, 48 + S.stateT * 40);
      }
    };

    let raf = 0;
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.033, (now - last) / 1000);
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
      stage.removeEventListener('pointerdown', onDown);
      stage.removeEventListener('pointerup', release);
      stage.removeEventListener('pointercancel', release);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  return (
    <Stage className="l02-stage">
      <canvas ref={canvasRef} className="l02-canvas" aria-label="Love Obby platformer" />
      <GameHud>
        <div className="l02-progress" role="progressbar" aria-valuenow={Math.round(hud.progress * 100)} aria-valuemax={100}>
          <div className="l02-progress-fill" style={{ transform: `scaleX(${hud.progress})` }} />
          <span className="l02-progress-runner" style={{ left: `calc(${hud.progress * 100}% - ${hud.progress * 22}px)` }} />
          <span className="l02-progress-goal">
            <Heart size={18} fill="#ff6f9f" />
          </span>
        </div>
        <HudPill icon={<Heart size={16} fill="#ff7fb0" />} value={`${hud.hearts}/${hud.totalHearts}`} accent="#ff6f9f" />
        <HudPill
          label="Tries"
          accent="#4fc38a"
          value={
            <span className="l02-tries">
              {Array.from({ length: TRIES }, (_, i) => (
                <i key={i} className={i < hud.tries ? 'on' : ''} />
              ))}
            </span>
          }
        />
      </GameHud>
    </Stage>
  );
}
