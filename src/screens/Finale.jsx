import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGame } from '../state/GameContext';
import { TopBar } from '../components/UI';
import Photo from '../components/Photo';
import { Heart, HEART_D } from '../components/Icons';
import { HimChibi, HerChibi } from '../art/Characters';
import { FINALE, IMAGES } from '../config';
import { sound } from '../audio/soundManager';
import { megaBoom, rain, cannons } from '../components/confetti';
import { TypeOut, RewardMusic } from './Reward';
import './Finale.css';

/**
 * Timeline:
 *  charge (0s)  → a tiny heart throbs faster and faster, screen rumbles
 *  boom (1.8s)  → white flash, shockwaves, mega confetti
 *  bloom (2.2s) → vines grow from every corner, hearts ripple outward
 *  reveal (4.6s)→ framed photo of him + final letter, endless confetti rain
 */
const T = { boom: 1800, bloom: 2200, reveal: 4600 };

export default function Finale() {
  const { goTo, resetProgress } = useGame();
  const [phase, setPhase] = useState('charge');

  useEffect(() => {
    sound.sfx.whoosh();
    const timers = [
      setTimeout(() => {
        setPhase('boom');
        sound.sfx.boom();
        megaBoom();
        navigator.vibrate?.([80, 40, 160]);
      }, T.boom),
      setTimeout(() => setPhase('bloom'), T.bloom),
      setTimeout(() => {
        setPhase('reveal');
        cannons(1.3);
        sound.play('success');
      }, T.reveal),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (phase !== 'reveal') return;
    const stop = rain(Infinity, 0.5);
    return stop;
  }, [phase]);

  const bloomed = phase === 'bloom' || phase === 'reveal';

  return (
    <div className={`finale phase-${phase}`}>
      <div className="finale-bg" />
      {phase === 'reveal' && <TopBar showLives={false} onHome={(e) => goTo('map', { x: e.clientX, y: e.clientY })} />}

      {/* 1 — charge */}
      <AnimatePresence>
        {phase === 'charge' && (
          <motion.div className="charge" exit={{ scale: 6, opacity: 0 }} transition={{ duration: 0.35 }}>
            <motion.div
              animate={{ scale: [1, 1.3, 1, 1.5, 1, 1.8, 1.2, 2.4] }}
              transition={{ duration: T.boom / 1000, times: [0, 0.2, 0.35, 0.5, 0.62, 0.75, 0.85, 1], ease: 'easeIn' }}
            >
              <Heart size={90} fill="#ff4f8b" />
            </motion.div>
            <div className="charge-glow" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2 — boom */}
      {phase !== 'charge' && (
        <>
          <motion.div className="flash" initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ duration: 1.1, ease: 'easeOut' }} />
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="shockwave"
              initial={{ scale: 0, opacity: 0.9 }}
              animate={{ scale: 9, opacity: 0 }}
              transition={{ duration: 1.4, delay: i * 0.18, ease: 'easeOut' }}
            />
          ))}
        </>
      )}

      {/* 3 — bloom: vines + expanding hearts */}
      {bloomed && (
        <>
          <Vines />
          <div className="heart-ripples" aria-hidden>
            {[0, 1, 2, 3, 4].map((i) => (
              <motion.svg
                key={i}
                viewBox="0 0 100 100"
                className="ripple-heart"
                initial={{ scale: 0, opacity: 0.8 }}
                animate={{ scale: 9, opacity: 0 }}
                transition={{ duration: 3.2, delay: i * 0.5, repeat: Infinity, ease: 'easeOut' }}
              >
                <path d={HEART_D} fill="none" stroke={i % 2 ? '#96c6fb' : '#ff85b1'} strokeWidth="1.5" />
              </motion.svg>
            ))}
          </div>
        </>
      )}

      {/* 4 — reveal */}
      {phase === 'reveal' && (
        <div className="finale-scroll screen-scroll">
          <motion.div className="finale-layout" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.35 } } }}>
            <motion.h1
              className="finale-title"
              variants={{ hidden: { opacity: 0, y: -40, scale: 0.6 }, show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 160, damping: 12 } } }}
            >
              {FINALE.heading.split(' ').map((w, i) => (
                <span key={i} className="grad-text">
                  {w}
                </span>
              ))}
            </motion.h1>

            <div className="finale-row">
              <motion.div
                className="ornate-frame"
                variants={{ hidden: { opacity: 0, scale: 0.3, rotate: -12 }, show: { opacity: 1, scale: 1, rotate: -2, transition: { type: 'spring', stiffness: 110, damping: 11 } } }}
              >
                <FrameCorners />
                <div className="frame-mat">
                  <Photo src={IMAGES.himFinale} label="his photo" className="frame-photo" fit="smart" />
                </div>
                <div className="frame-plaque hand">my favourite person</div>
              </motion.div>

              <motion.div
                className="finale-letter"
                variants={{ hidden: { opacity: 0, x: 60 }, show: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 100, damping: 16 } } }}
              >
                <p className="finale-message hand">
                  <TypeOut text={FINALE.message} speed={28} />
                </p>
                <p className="finale-sign hand">{FINALE.signature}</p>
                <div className="finale-couple">
                  <HimChibi size={64} wave />
                  <motion.div animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 1.2 }}>
                    <Heart size={30} fill="#ff4f8b" />
                  </motion.div>
                  <HerChibi size={64} wave wink />
                </div>
              </motion.div>
            </div>

            <motion.div className="finale-actions" variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { delay: 2 } } }}>
              <button className="btn btn-ghost" onClick={(e) => goTo('map', { x: e.clientX, y: e.clientY })}>
                Back to our map
              </button>
              <button
                className="btn"
                onClick={() => {
                  if (confirm('Replay the whole journey from level 1?')) resetProgress();
                }}
              >
                Replay the journey
              </button>
            </motion.div>
          </motion.div>
          <RewardMusic youtubeId={FINALE.youtubeId} level="finale" />
        </div>
      )}
    </div>
  );
}

/* ── Vines growing from the 4 corners ── */
const VINE_MAIN = 'M0 0 C60 80 40 160 120 200 S260 220 300 300 S300 420 380 460';
const VINE_SIDE = 'M0 0 C120 30 200 10 260 70 S360 120 460 100 S560 60 620 120';
const VINE_DOWN = 'M0 0 C20 120 90 180 60 280 S40 420 110 520';
const LEAVES = [
  [70, 110, 40],
  [120, 200, -20],
  [210, 230, 60],
  [300, 300, -10],
  [330, 420, 40],
  [140, 30, -60],
  [260, 70, 20],
  [380, 120, -40],
  [500, 90, 30],
  [40, 150, 80],
  [70, 280, -30],
  [60, 400, 60],
];
const BLOOMS = [
  [380, 460, 'pink'],
  [620, 120, 'blue'],
  [110, 520, 'pink'],
  [210, 230, 'blue'],
  [460, 100, 'pink'],
  [60, 280, 'blue'],
];

function Vines() {
  return (
    <svg className="vines" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice" aria-hidden>
      {[
        'translate(0 0)',
        'translate(1000 0) scale(-1 1)',
        'translate(0 1000) scale(1 -1)',
        'translate(1000 1000) scale(-1 -1)',
      ].map((t, ci) => (
        <g key={ci} transform={t}>
          {[VINE_MAIN, VINE_SIDE, VINE_DOWN].map((d, vi) => (
            <motion.path
              key={vi}
              d={d}
              fill="none"
              stroke="var(--vine)"
              strokeWidth={vi === 0 ? 9 : 6}
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 2.4, delay: vi * 0.2 + ci * 0.1, ease: 'easeOut' }}
            />
          ))}
          {LEAVES.map(([x, y, r], i) => (
            <g key={`l${i}`} transform={`translate(${x} ${y}) rotate(${r})`}>
              <motion.path
                d="M0 0 C10 -14 30 -14 40 0 C30 14 10 14 0 0Z"
                fill={i % 2 ? 'var(--leaf-1)' : 'var(--leaf-2)'}
                style={{ transformBox: 'fill-box', transformOrigin: '0% 50%' }}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.5 + i * 0.12 + ci * 0.05, type: 'spring', stiffness: 260, damping: 12 }}
              />
            </g>
          ))}
          {BLOOMS.map(([x, y, c], i) => (
            <g key={`b${i}`} transform={`translate(${x} ${y})`}>
              <motion.g
                initial={{ scale: 0, rotate: -90 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 1.4 + i * 0.18 + ci * 0.08, type: 'spring', stiffness: 200, damping: 10 }}
              >
                {i % 3 === 0 ? (
                  <g transform="translate(-22 -22) scale(.44)">
                    <path d={HEART_D} fill={c === 'pink' ? '#ff6f9f' : '#6eaaf0'} />
                  </g>
                ) : (
                  <Flower color={c} />
                )}
              </motion.g>
            </g>
          ))}
        </g>
      ))}
    </svg>
  );
}

function Flower({ color }) {
  const petal = color === 'pink' ? '#ffb3cf' : '#bddcff';
  const edge = color === 'pink' ? '#ff85b1' : '#6eaaf0';
  return (
    <g>
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <ellipse key={a} cx="0" cy="-15" rx="10" ry="15" fill={petal} stroke={edge} strokeWidth="1.5" transform={`rotate(${a})`} />
      ))}
      <circle r="9" fill="#ffd36e" stroke="#f2a93b" strokeWidth="1.5" />
      <circle r="3" cx="-2" cy="-2" fill="#fff" opacity=".7" />
    </g>
  );
}

function FrameCorners() {
  const corner = (
    <svg viewBox="0 0 80 80" className="frame-corner-svg">
      <path d="M6 74 V30 Q6 6 30 6 H74" fill="none" stroke="#f2a93b" strokeWidth="4" strokeLinecap="round" />
      <path d="M16 74 V36 Q16 16 36 16 H74" fill="none" stroke="#ffd36e" strokeWidth="2" strokeLinecap="round" />
      <circle cx="24" cy="24" r="7" fill="#ff85b1" stroke="#fff" strokeWidth="2" />
      <path d="M40 6 q6 -6 12 0 M6 40 q-6 6 0 12" stroke="#f2a93b" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </svg>
  );
  return (
    <>
      {['tl', 'tr', 'bl', 'br'].map((c) => (
        <span key={c} className={`frame-corner ${c}`}>
          {corner}
        </span>
      ))}
    </>
  );
}
