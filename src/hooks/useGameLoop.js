import { useEffect, useRef, useState } from 'react';

/**
 * Runs `callback(dt, time)` every animation frame while `running` is true.
 * dt is in seconds and clamped to avoid giant jumps after tab switches.
 * The latest callback is always used (no stale closures).
 */
export function useGameLoop(callback, running = true) {
  const cb = useRef(callback);
  cb.current = callback;
  useEffect(() => {
    if (!running) return;
    let raf;
    let last = performance.now();
    const tick = (t) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      cb.current(dt, t);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running]);
}

/**
 * Sets up a crisp, DPR-aware canvas that maps a fixed logical
 * coordinate space (width x height) onto whatever size the element is.
 * Returns { canvasRef, ctxRef, scaleRef, toLogical(clientX, clientY) }.
 * Draw in logical units — the transform is pre-applied each frame via
 * `prepare()` which also clears the canvas.
 */
export function useLogicalCanvas(width, height) {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const scaleRef = useRef(1);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctxRef.current = ctx;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      scaleRef.current = (rect.width / width) * dpr;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [width, height]);

  const prepare = () => {
    const ctx = ctxRef.current;
    if (!ctx) return null;
    const s = scaleRef.current;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.setTransform(s, 0, 0, s, 0, 0);
    return ctx;
  };

  const toLogical = (clientX, clientY) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: ((clientX - rect.left) / rect.width) * width, y: ((clientY - rect.top) / rect.height) * height };
  };

  return { canvasRef, ctxRef, prepare, toLogical };
}

/**
 * Countdown timer. Returns seconds left (updates ~10x/sec) and calls
 * onEnd() once when it reaches 0. Pause by passing running=false.
 *   const timeLeft = useTimer(45, playing, () => onFail('time'));
 */
export function useTimer(seconds, running, onEnd) {
  const [left, setLeft] = useState(seconds);
  const leftRef = useRef(seconds);
  const endRef = useRef(onEnd);
  endRef.current = onEnd;
  useEffect(() => {
    if (!running) return;
    let last = performance.now();
    const id = setInterval(() => {
      const now = performance.now();
      leftRef.current = Math.max(0, leftRef.current - (now - last) / 1000);
      last = now;
      setLeft(leftRef.current);
      if (leftRef.current <= 0) {
        clearInterval(id);
        endRef.current?.();
      }
    }, 100);
    return () => clearInterval(id);
  }, [running]);
  /** add (or subtract) seconds — e.g. penalties */
  const adjust = (delta) => {
    leftRef.current = Math.max(0, leftRef.current + delta);
    setLeft(leftRef.current);
  };
  return [left, adjust];
}
