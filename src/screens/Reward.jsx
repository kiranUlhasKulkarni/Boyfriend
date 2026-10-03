import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGame } from '../state/GameContext';
import { TopBar, FloatingHearts } from '../components/UI';
import Photo from '../components/Photo';
import { Heart, IconArrowRight, IconStar } from '../components/Icons';
import { REWARDS, REWARD_MUSIC, NAMES } from '../config';
import { photoFor } from '../photos';
import { LevelIcon } from '../components/Icons';
import { getLevel, TOTAL_LEVELS } from '../levels';
import { sound } from '../audio/soundManager';
import { rain, burst } from '../components/confetti';
import './Reward.css';

export default function Reward() {
  const { currentLevel, goTo, startLevel } = useGame();
  const id = currentLevel ?? 1;
  const reward = REWARDS[id] ?? REWARDS[1];
  const level = getLevel(id);
  const next = getLevel(id + 1);
  const [opened, setOpened] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => open(), 1400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!opened) return;
    const stop = rain(5000, 0.6);
    return stop;
  }, [opened]);

  function open() {
    setOpened((o) => {
      if (!o) {
        sound.sfx.sparkle();
        burst({ x: 0.5, y: 0.45 }, 0.7);
      }
      return true;
    });
  }

  return (
    <div className="reward-screen">
      <FloatingHearts count={14} sparkles={30} />
      <TopBar title={`Level ${id} complete!`} onHome={(e) => goTo('map', { x: e.clientX, y: e.clientY })} />
      <RewardMusic youtubeId={reward.youtubeId} level={id} />

      <div className="reward-scroll screen-scroll">
        <AnimatePresence mode="wait">
          {!opened ? (
            <motion.button
              key="env"
              className="envelope-wrap"
              onClick={open}
              initial={{ y: -300, rotate: -20, opacity: 0 }}
              animate={{ y: 0, rotate: [-6, 4, -2, 0], opacity: 1 }}
              exit={{ scale: 1.3, opacity: 0, y: -40 }}
              transition={{ type: 'spring', stiffness: 120, damping: 12 }}
              aria-label="Open the letter"
            >
              <Envelope />
              <span className="envelope-hint hand">for you, {NAMES.him} 💌</span>
            </motion.button>
          ) : (
            <motion.div key="letter" className="reward-layout" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.18 } } }}>
              <motion.div
                className="reward-photo-wrap"
                variants={{ hidden: { opacity: 0, x: -60, rotate: -15 }, show: { opacity: 1, x: 0, rotate: -4, transition: { type: 'spring', stiffness: 140, damping: 14 } } }}
              >
                <figure className="reward-polaroid">
                  <span className="washi" />
                  <Photo src={photoFor(`reward-${id}`)} label={`level ${id} photo`} className="reward-img" fit="smart" />
                  <figcaption className="hand">level {id} ✓</figcaption>
                </figure>
                <div className="reward-badge">
                  {[0, 1, 2].map((i) => (
                    <IconStar key={i} size={i === 1 ? 34 : 26} />
                  ))}
                </div>
              </motion.div>

              <motion.article
                className="letter-paper"
                variants={{ hidden: { opacity: 0, y: 80, scale: 0.9 }, show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 120, damping: 16 } } }}
              >
                <LetterStickers icon={level?.icon} />
                <div className="letter-seal">
                  <Heart size={40} fill="#e8336f" />
                </div>
                <div className="letter-kicker">
                  {level?.theme} · level {id} of {TOTAL_LEVELS}
                </div>
                <h2 className="letter-title hand">{reward.title}</h2>
                <p className="letter-body hand">
                  <span className="letter-greet">Dear {NAMES.him},</span>
                  <TypeOut text={reward.letter} />
                </p>
                <p className="letter-sign hand">
                  love you always,
                  <br />— {NAMES.her} 💗
                </p>
              </motion.article>

              <motion.div className="reward-actions" variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}>
                <button className="btn btn-ghost" onClick={(e) => goTo('map', { x: e.clientX, y: e.clientY })}>
                  Back to map
                </button>
                {next && (
                  <button className="btn btn-lg" onClick={(e) => startLevel(next.id, { x: e.clientX, y: e.clientY })}>
                    Level {next.id}: {next.name} <IconArrowRight />
                  </button>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/** Typewriter effect for the letter. */
export function TypeOut({ text, speed = 22 }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    const id = setInterval(() => {
      setN((v) => {
        if (v >= text.length) {
          clearInterval(id);
          return v;
        }
        return v + 1;
      });
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);
  return (
    <span className="typeout" onClick={() => setN(text.length)}>
      {text.slice(0, n)}
      {n < text.length && <span className="caret">|</span>}
    </span>
  );
}

function Envelope() {
  return (
    <svg viewBox="0 0 320 220" className="envelope" aria-hidden>
      <defs>
        <linearGradient id="envBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe3ee" />
          <stop offset="1" stopColor="#ffc8dd" />
        </linearGradient>
        <linearGradient id="envFlap" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffb3cf" />
          <stop offset="1" stopColor="#ff9cc2" />
        </linearGradient>
      </defs>
      <ellipse cx="160" cy="210" rx="130" ry="8" fill="#000" opacity=".12" />
      <rect x="10" y="30" width="300" height="170" rx="16" fill="url(#envBody)" stroke="#f08bb3" strokeWidth="3" />
      {/* letter peeking */}
      <rect x="40" y="18" width="240" height="120" rx="8" fill="#fffaf3" stroke="#f3d6c2" strokeWidth="2" />
      <path d="M70 50h180M70 70h150M70 90h170" stroke="#f3c4d6" strokeWidth="3" strokeLinecap="round" />
      {/* pocket */}
      <path d="M10 70 L160 150 L310 70 V184 a16 16 0 0 1 -16 16 H26 a16 16 0 0 1 -16 -16Z" fill="url(#envBody)" stroke="#f08bb3" strokeWidth="3" strokeLinejoin="round" />
      <path d="M10 196 L130 120 M310 196 L190 120" stroke="#f08bb3" strokeWidth="2.5" opacity=".6" />
      {/* flap */}
      <g className="env-flap">
        <path d="M10 46 a16 16 0 0 1 16 -16 H294 a16 16 0 0 1 16 16 L160 140Z" fill="url(#envFlap)" stroke="#f08bb3" strokeWidth="3" strokeLinejoin="round" />
      </g>
      {/* wax seal */}
      <g transform="translate(160 132)">
        <circle r="26" fill="#e8336f" />
        <circle r="20" fill="none" stroke="#ff7fa8" strokeWidth="2" strokeDasharray="3 3" />
        <path d="M0 11c-8-6-12-9.5-12-14a6 6 0 0 1 12-2 6 6 0 0 1 12 2c0 4.5-4 8-12 14z" fill="#ff9cc2" />
      </g>
    </svg>
  );
}

/** Plays a reward track: YouTube embed or a local file (see config.REWARD_MUSIC). */
export function RewardMusic({ youtubeId, level }) {
  const { muted } = useGame();
  const audioRef = useRef(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (REWARD_MUSIC.type !== 'file') return;
    const a = new Audio(REWARD_MUSIC.file(level));
    a.loop = true;
    a.volume = 0.6;
    audioRef.current = a;
    a.play().catch(() => {});
    return () => a.pause();
  }, [level]);
  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = muted;
  }, [muted]);

  if (REWARD_MUSIC.type !== 'youtube' || muted || !youtubeId) return null;
  const src = `https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&loop=1&playlist=${youtubeId}&rel=0&modestbranding=1&playsinline=1`;
  return (
    <motion.div
      className={`music-card glass ${collapsed ? 'collapsed' : ''}`}
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.6, type: 'spring' }}
    >
      <button className="music-head" onClick={() => setCollapsed((c) => !c)} aria-label="Toggle music player">
        <span className="eq" aria-hidden>
          <i />
          <i />
          <i />
        </span>
        <span>a song for you</span>
        <span className="music-chev">{collapsed ? '▴' : '▾'}</span>
      </button>
      <iframe
        key={youtubeId}
        className="music-frame"
        src={src}
        title="A song for you"
        allow="autoplay; encrypted-media"
        referrerPolicy="strict-origin-when-cross-origin"
      />
      <a className="music-link" href={`https://music.youtube.com/watch?v=${youtubeId}`} target="_blank" rel="noreferrer">
        open in YouTube Music ↗
      </a>
    </motion.div>
  );
}

/** Cute themed doodle stickers scattered around the letter. */
function LetterStickers({ icon }) {
  const pop = (delay) => ({
    initial: { scale: 0, rotate: -40 },
    animate: { scale: 1, rotate: 0 },
    transition: { delay, type: 'spring', stiffness: 300, damping: 12 },
  });
  return (
    <div className="letter-stickers" aria-hidden>
      <motion.span className="stk stk-icon" {...pop(0.6)}>
        <LevelIcon name={icon} size={58} />
      </motion.span>
      <motion.span className="stk stk-heart1" {...pop(0.75)}>
        <Heart size={30} fill="#ff85b1" />
      </motion.span>
      <motion.span className="stk stk-heart2" {...pop(0.85)}>
        <Heart size={20} fill="#96c6fb" />
      </motion.span>
      <motion.span className="stk stk-flower" {...pop(0.95)}>
        <svg viewBox="-24 -24 48 48" width="46" height="46">
          {[0, 72, 144, 216, 288].map((a) => (
            <ellipse key={a} cx="0" cy="-11" rx="7.5" ry="11" fill="#ffc8dd" stroke="#ff85b1" strokeWidth="1.5" transform={`rotate(${a})`} />
          ))}
          <circle r="6" fill="#ffd36e" stroke="#f2a93b" strokeWidth="1.5" />
        </svg>
      </motion.span>
      <motion.span className="stk stk-sparkle" {...pop(1.05)}>
        <svg viewBox="0 0 24 24" width="28" height="28">
          <path d="M12 0C13 8 16 11 24 12 16 13 13 16 12 24 11 16 8 13 0 12 8 11 11 8 12 0z" fill="#ffd36e" />
        </svg>
      </motion.span>
      <motion.span className="stk stk-sparkle2" {...pop(1.15)}>
        <svg viewBox="0 0 24 24" width="18" height="18">
          <path d="M12 0C13 8 16 11 24 12 16 13 13 16 12 24 11 16 8 13 0 12 8 11 11 8 12 0z" fill="#96c6fb" />
        </svg>
      </motion.span>
      <motion.span className="stk stk-doodle" {...pop(1.25)}>
        <svg viewBox="0 0 120 30" width="110" height="28">
          <path d="M4 20 C14 4 24 4 30 16 C36 28 46 28 52 16 C58 4 68 4 74 16 C80 28 90 28 96 16 C100 8 108 6 116 12" fill="none" stroke="#ff9cc2" strokeWidth="3" strokeLinecap="round" strokeDasharray="1 7" />
        </svg>
      </motion.span>
    </div>
  );
}
