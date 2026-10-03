import confetti from 'canvas-confetti';

const PALETTE = ['#ffb3cf', '#ff85b1', '#f2629a', '#bddcff', '#96c6fb', '#6eaaf0', '#ffd36e', '#e4c9ff', '#ffffff'];
let heartShape;
const heart = () => {
  if (!heartShape && confetti.shapeFromPath) {
    heartShape = confetti.shapeFromPath({
      path: 'M50 88 C20 66 4 48 4 30 C4 15 16 5 29 5 C38 5 45 10 50 18 C55 10 62 5 71 5 C84 5 96 15 96 30 C96 48 80 66 50 88 Z',
    });
  }
  return heartShape;
};
const shapes = () => (heart() ? ['square', 'circle', heart(), heart()] : ['square', 'circle']);
const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Quick celebratory burst. origin in 0..1 viewport coordinates. */
export function burst(origin = { x: 0.5, y: 0.6 }, power = 1) {
  if (reduced()) return;
  confetti({
    particleCount: Math.round(90 * power),
    spread: 80 + 30 * power,
    startVelocity: 38 * Math.sqrt(power),
    origin,
    colors: PALETTE,
    shapes: shapes(),
    scalar: 1.1,
    ticks: 220,
    zIndex: 9999,
  });
}

/** Burst from a DOM element / click event position (px). */
export function burstAt(x, y, power = 0.6) {
  burst({ x: x / window.innerWidth, y: y / window.innerHeight }, power);
}

/** Two side cannons. */
export function cannons(power = 1) {
  if (reduced()) return;
  const common = { particleCount: Math.round(70 * power), spread: 65, startVelocity: 55, colors: PALETTE, shapes: shapes(), ticks: 260, zIndex: 9999 };
  confetti({ ...common, angle: 60, origin: { x: 0, y: 0.75 } });
  confetti({ ...common, angle: 120, origin: { x: 1, y: 0.75 } });
}

/** Gentle rain from the top for `ms` milliseconds. Returns a stop function. */
export function rain(ms = 4000, density = 1) {
  if (reduced()) return () => {};
  const end = Date.now() + ms;
  let raf;
  let stopped = false;
  const frame = () => {
    if (stopped) return;
    confetti({
      particleCount: Math.max(1, Math.round(2 * density)),
      startVelocity: 0,
      ticks: 400,
      gravity: 0.5,
      drift: Math.random() - 0.5,
      origin: { x: Math.random(), y: -0.05 },
      colors: PALETTE,
      shapes: shapes(),
      scalar: 0.9 + Math.random() * 0.6,
      zIndex: 9999,
    });
    if (ms === Infinity || Date.now() < end) raf = requestAnimationFrame(frame);
  };
  frame();
  return () => {
    stopped = true;
    cancelAnimationFrame(raf);
  };
}

/** Huge explosion from the centre (finale). */
export function megaBoom() {
  if (reduced()) return;
  const o = { x: 0.5, y: 0.5 };
  [0, 150, 300].forEach((d, i) =>
    setTimeout(
      () =>
        confetti({
          particleCount: 220,
          spread: 360,
          startVelocity: 55 + i * 10,
          origin: o,
          colors: PALETTE,
          shapes: shapes(),
          scalar: 1.4,
          ticks: 320,
          gravity: 0.7,
          zIndex: 9999,
        }),
      d
    )
  );
}

export const resetConfetti = () => confetti.reset();
