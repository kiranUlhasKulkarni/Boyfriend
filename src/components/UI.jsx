import { useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGame, MAX_LIVES } from '../state/GameContext';
import { Heart, IconSound, IconSun, IconMoon, IconHome, IconLips } from './Icons';
import { sound } from '../audio/soundManager';
import { TOTAL_LEVELS } from '../levels';
import './UI.css';

/* ───────── Floating hearts / sparkles background ───────── */
export function FloatingHearts({ count = 18, sparkles = 24 }) {
  const items = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: Math.random() * 100,
        size: 10 + Math.random() * 26,
        dur: 12 + Math.random() * 16,
        delay: -Math.random() * 24,
        sway: (Math.random() - 0.5) * 80,
        o: 0.35 + Math.random() * 0.45,
        fill: ['#ffb3cf', '#ff9cc2', '#bddcff', '#e4c9ff', '#ffc8dd'][i % 5],
      })),
    [count]
  );
  const stars = useMemo(
    () =>
      Array.from({ length: sparkles }, () => ({
        left: Math.random() * 100,
        top: Math.random() * 100,
        size: 3 + Math.random() * 6,
        dur: 2 + Math.random() * 3,
        delay: -Math.random() * 4,
      })),
    [sparkles]
  );
  return (
    <div className="float-layer" aria-hidden>
      {stars.map((s, i) => (
        <span
          key={`s${i}`}
          className="sparkle"
          style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size, animationDuration: `${s.dur}s`, animationDelay: `${s.delay}s` }}
        />
      ))}
      {items.map((h, i) => (
        <span
          key={i}
          className="float-heart"
          style={{
            left: `${h.left}%`,
            animationDuration: `${h.dur}s`,
            animationDelay: `${h.delay}s`,
            '--sway': `${h.sway}px`,
            '--o': h.o,
          }}
        >
          <Heart size={h.size} fill={h.fill} />
        </span>
      ))}
    </div>
  );
}

/* ───────── Lives display ───────── */
export function Lives({ compact = false }) {
  const { lives } = useGame();
  return (
    <div className={`lives ${compact ? 'compact' : ''}`} aria-label={`${lives} of ${MAX_LIVES} lives`}>
      {Array.from({ length: MAX_LIVES }, (_, i) => {
        const alive = i < lives;
        return (
          <motion.span
            key={i}
            className={`life ${alive ? 'alive' : 'lost'}`}
            animate={alive ? { scale: [1, 1.12, 1] } : { scale: 0.85, rotate: -12 }}
            transition={alive ? { repeat: Infinity, duration: 1.4, delay: i * 0.18, ease: 'easeInOut' } : { type: 'spring' }}
          >
            {alive ? <Heart size={compact ? 24 : 30} fill="#ff6f9f" /> : <BrokenHeart size={compact ? 24 : 30} />}
          </motion.span>
        );
      })}
    </div>
  );
}

export function BrokenHeart({ size = 30 }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden>
      <g fill="#d9cbd6" stroke="#bfaebb" strokeWidth="3" strokeLinejoin="round">
        <path d="M48 86 C20 66 4 48 4 30 C4 15 16 5 29 5 C38 5 45 10 50 18 L44 34 L54 46 L44 60 Z" transform="translate(-4 2) rotate(-6 50 50)" />
        <path d="M52 86 C80 66 96 48 96 30 C96 15 84 5 71 5 C62 5 55 10 50 18 L44 34 L54 46 L44 60 Z" transform="translate(4 2) rotate(6 50 50)" />
      </g>
    </svg>
  );
}

/* ───────── Top HUD bar ───────── */
export function TopBar({ showHome = true, showLives = true, showProgress = true, onHome, title }) {
  const { muted, toggleMute, resolvedTheme, toggleTheme, completed, goTo } = useGame();
  return (
    <header className="topbar">
      <div className="topbar-left">
        {showHome && (
          <button
            className="icon-btn"
            aria-label="Home"
            onClick={(e) => {
              sound.sfx.click();
              onHome ? onHome(e) : goTo('landing', { x: e.clientX, y: e.clientY });
            }}
          >
            <IconHome />
          </button>
        )}
        {showLives && (
          <div className="hud-pill glass">
            <Lives compact />
          </div>
        )}
      </div>
      {title && <div className="topbar-title">{title}</div>}
      <div className="topbar-right">
        {showProgress && (
          <div className="hud-pill glass progress-pill" title="Levels completed">
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path d="M12 2.8l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.1l6.1-.7z" fill="#ffd36e" stroke="#e59a2f" strokeWidth="1.2" />
            </svg>
            <b>{completed.length}</b>
            <span>/ {TOTAL_LEVELS}</span>
          </div>
        )}
        <button className="icon-btn" aria-label={muted ? 'Unmute' : 'Mute'} onClick={toggleMute}>
          <IconSound on={!muted} />
        </button>
        <button className="icon-btn theme-btn" aria-label="Toggle dark mode" onClick={toggleTheme}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={resolvedTheme}
              initial={{ rotate: -90, scale: 0, opacity: 0 }}
              animate={{ rotate: 0, scale: 1, opacity: 1 }}
              exit={{ rotate: 90, scale: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 18 }}
              style={{ display: 'grid' }}
            >
              {resolvedTheme === 'dark' ? <IconMoon /> : <IconSun />}
            </motion.span>
          </AnimatePresence>
        </button>
      </div>
    </header>
  );
}

/* ───────── Fluid portal transition ───────── */
export function Portal() {
  const { portal, onPortalCovered, onPortalDone } = useGame();
  if (!portal) return null;
  const { x, y, phase, key } = portal;
  const R = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) + 40;
  return (
    <div className="portal-wrap" aria-hidden>
      <motion.div
        key={key}
        className="portal-blob"
        style={{ left: x, top: y }}
        initial={{ width: 0, height: 0, opacity: 1 }}
        animate={phase === 'in' ? { width: R * 2, height: R * 2, opacity: 1 } : { width: R * 2, height: R * 2, opacity: 0, scale: 1.15 }}
        transition={phase === 'in' ? { duration: 0.65, ease: [0.7, 0, 0.3, 1] } : { duration: 0.55, ease: 'easeOut' }}
        onAnimationComplete={() => (phase === 'in' ? onPortalCovered() : onPortalDone())}
      >
        <div className="portal-inner" />
        {phase === 'in' && (
          <motion.div className="portal-heart" initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ delay: 0.25, type: 'spring', stiffness: 260, damping: 12 }}>
            <Heart size={90} fill="#fff" shine={false} />
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

/* ───────── Generic modal ───────── */
export function Modal({ open, onClose, children, className = '' }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div
            className={`modal glass ${className}`}
            initial={{ scale: 0.6, y: 40, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.8, y: 30, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 22 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ───────── "Get more life!" modal ───────── */
export function OutOfLivesModal() {
  const { outOfLivesOpen, dispatch, goTo } = useGame();
  return (
    <Modal open={outOfLivesOpen} onClose={() => dispatch({ type: 'CLOSE_OUT_OF_LIVES' })} className="ool-modal">
      <div className="ool-hearts">
        {[0, 1, 2].map((i) => (
          <motion.span key={i} animate={{ y: [0, -6, 0], rotate: [-8, 8, -8] }} transition={{ repeat: Infinity, duration: 1.6, delay: i * 0.2 }}>
            <BrokenHeart size={46} />
          </motion.span>
        ))}
      </div>
      <h2 className="grad-text ool-title">Get more life!</h2>
      <p className="ool-text">
        Oh no pillu, you’re all out of hearts 🥺
        <br />
        Luckily, hearts can be refilled with… <b>25 kisses</b>.
      </p>
      <button
        className="btn btn-lg"
        onClick={(e) => {
          sound.sfx.kiss();
          goTo('kiss', { x: e.clientX, y: e.clientY });
        }}
      >
        <IconLips size={26} /> Kiss for lives
      </button>
      <button className="ool-later" onClick={() => dispatch({ type: 'CLOSE_OUT_OF_LIVES' })}>
        maybe later
      </button>
    </Modal>
  );
}
