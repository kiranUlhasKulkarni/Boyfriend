/**
 * Shared building blocks for level mini-games so they all look consistent.
 *   <Stage>     — the rounded, shadowed play-area card (fills the level area)
 *   <GameHud>   — floating pills for score / timer / progress inside a Stage
 *   <TimerBar>  — pastel progress bar that turns pink→red as time runs out
 */
import './kit.css';

export function Stage({ children, className = '', style, ...rest }) {
  return (
    <div className={`stage ${className}`} style={style} {...rest}>
      {children}
    </div>
  );
}

export function GameHud({ children, className = '' }) {
  return <div className={`game-hud ${className}`}>{children}</div>;
}

export function HudPill({ icon, label, value, accent }) {
  return (
    <div className="hud-chip" style={accent ? { '--chip': accent } : undefined}>
      {icon && <span className="hud-chip-icon">{icon}</span>}
      {label && <span className="hud-chip-label">{label}</span>}
      <b>{value}</b>
    </div>
  );
}

export function TimerBar({ left, total }) {
  const pct = Math.max(0, Math.min(1, left / total));
  const danger = pct < 0.25;
  return (
    <div className={`timer-bar ${danger ? 'danger' : ''}`} role="progressbar" aria-valuenow={Math.ceil(left)} aria-valuemax={total}>
      <div className="timer-fill" style={{ transform: `scaleX(${pct})` }} />
      <span className="timer-text">{Math.ceil(left)}s</span>
    </div>
  );
}
