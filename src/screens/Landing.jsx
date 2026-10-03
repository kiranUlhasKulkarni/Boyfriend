import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useGame } from '../state/GameContext';
import { FloatingHearts, TopBar } from '../components/UI';
import { Heart } from '../components/Icons';
import Photo from '../components/Photo';
import { HimChibi, HerChibi } from '../art/Characters';
import { IMAGES, NAMES } from '../config';
import { sound } from '../audio/soundManager';
import { burst, burstAt } from '../components/confetti';
import './Landing.css';

const TITLE_TOP = "Pillu's";
const TITLE_MAIN = 'Love Quest';
const PHOTO_START = 1.5; // seconds — photos pop in after the title
const PHOTO_GAP = 0.38;

export default function Landing() {
  const { goTo, completed, resetProgress } = useGame();
  const [photosLanded, setPhotosLanded] = useState(0);
  const boomed = useRef(false);
  const hasProgress = completed.length > 0;

  // Start music on first interaction (browsers block autoplay until then)
  useEffect(() => {
    const unlock = () => sound.playBgm();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    sound.playBgm(); // may succeed if the browser allows
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  // Boop sounds + confetti as each photo lands
  useEffect(() => {
    const timers = IMAGES.landing.map((_, i) =>
      setTimeout(() => {
        sound.sfx.boop(i);
        setPhotosLanded((n) => n + 1);
      }, (PHOTO_START + i * PHOTO_GAP) * 1000 + 120)
    );
    return () => timers.forEach(clearTimeout);
  }, []);
  useEffect(() => {
    if (photosLanded === IMAGES.landing.length && !boomed.current) {
      boomed.current = true;
      burst({ x: 0.5, y: 0.55 }, 1.1);
      setTimeout(() => burst({ x: 0.2, y: 0.7 }, 0.5), 250);
      setTimeout(() => burst({ x: 0.8, y: 0.7 }, 0.5), 400);
    }
  }, [photosLanded]);

  const start = (e) => {
    sound.sfx.sparkle();
    sound.playBgm();
    goTo('map', { x: e.clientX, y: e.clientY });
  };

  const buttonDelay = PHOTO_START + IMAGES.landing.length * PHOTO_GAP + 0.4;

  return (
    <div className="landing">
      <div className="landing-bg" aria-hidden>
        <div className="landing-glow g1" />
        <div className="landing-glow g2" />
        <Clouds />
      </div>
      <FloatingHearts count={22} />
      <TopBar showHome={false} showLives={false} showProgress={false} />

      <main className="landing-main">
        {/* Badge */}
        <motion.div
          className="landing-badge"
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 200, damping: 14 }}
        >
          <Heart size={16} fill="#ff6f9f" shine={false} /> National Boyfriend Day <Heart size={16} fill="#6eaaf0" shine={false} />
        </motion.div>

        {/* Title */}
        <h1 className="landing-title" aria-label={`${TITLE_TOP} ${TITLE_MAIN}`}>
          <span className="title-top hand">
            {TITLE_TOP.split('').map((c, i) => (
              <motion.span
                key={i}
                initial={{ y: 40, opacity: 0, rotate: -15 }}
                animate={{ y: 0, opacity: 1, rotate: 0 }}
                transition={{ delay: 0.25 + i * 0.06, type: 'spring', stiffness: 300, damping: 14 }}
              >
                {c}
              </motion.span>
            ))}
          </span>
          <span className="title-main">
            {TITLE_MAIN.split('').map((c, i) => (
              <motion.span
                key={i}
                className="grad-text"
                initial={{ y: 60, opacity: 0, scale: 0.4 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                transition={{ delay: 0.6 + i * 0.05, type: 'spring', stiffness: 380, damping: 12 }}
              >
                {c === ' ' ? ' ' : c}
              </motion.span>
            ))}
            <TitleSparkles />
          </span>
        </h1>
        <motion.p className="landing-sub" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.15 }}>
          {NAMES.appSubtitle}
        </motion.p>

        {/* Polaroids */}
        <div className="polaroids">
          {IMAGES.landing.map((img, i) => (
            <motion.figure
              key={img.src}
              className={`polaroid p${i}`}
              initial={{ scale: 0, opacity: 0, y: 60, rotate: 0 }}
              animate={{ scale: 1, opacity: 1, y: 0, rotate: [-8, 3, 7][i] }}
              transition={{ delay: PHOTO_START + i * PHOTO_GAP, type: 'spring', stiffness: 420, damping: 9, mass: 0.8 }}
              whileHover={{ scale: 1.07, rotate: 0, y: -10, zIndex: 5, transition: { type: 'spring', stiffness: 300, damping: 15 } }}
              whileTap={{ scale: 0.95 }}
              onPointerDown={(e) => {
                sound.sfx.boop(i);
                burstAt(e.clientX, e.clientY, 0.25);
              }}
            >
              <span className="tape" />
              <Photo src={img.src} label={`couple photo ${i + 1}`} className="polaroid-img" />
              <figcaption className="hand">{img.caption}</figcaption>
            </motion.figure>
          ))}
        </div>

        {/* CTA */}
        <motion.div
          className="landing-cta"
          initial={{ opacity: 0, y: 30, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: buttonDelay, type: 'spring', stiffness: 260, damping: 14 }}
        >
          <motion.div className="cta-chibi left" initial={{ x: 30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: buttonDelay + 0.3 }}>
            <HimChibi size={58} wave />
          </motion.div>
          <motion.button
            className="btn btn-lg start-btn"
            onClick={start}
            animate={{ scale: [1, 1.04, 1] }}
            transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut', delay: buttonDelay + 0.5 }}
          >
            <Heart size={24} fill="#fff" shine={false} />
            {hasProgress ? 'Continue Our Journey' : 'Start Our Journey'}
          </motion.button>
          <motion.div className="cta-chibi right" initial={{ x: -30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: buttonDelay + 0.45 }}>
            <HerChibi size={58} wave wink />
          </motion.div>
        </motion.div>
        {hasProgress && (
          <motion.button
            className="reset-link"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: buttonDelay + 0.6 }}
            onClick={() => {
              if (confirm('Start the journey over from level 1?')) resetProgress();
            }}
          >
            start over from the beginning
          </motion.button>
        )}
      </main>
    </div>
  );
}

function TitleSparkles() {
  const pts = [
    [-4, 10, 18, 1.0],
    [102, 0, 22, 1.4],
    [96, 85, 14, 1.8],
    [6, 90, 12, 2.1],
    [50, -12, 12, 1.6],
  ];
  return (
    <span className="title-sparkles" aria-hidden>
      {pts.map(([x, y, s, d], i) => (
        <motion.svg
          key={i}
          viewBox="0 0 24 24"
          width={s}
          height={s}
          style={{ left: `${x}%`, top: `${y}%` }}
          initial={{ scale: 0, rotate: 0 }}
          animate={{ scale: [0, 1, 0.7, 1], rotate: 180 }}
          transition={{ delay: d, duration: 2.4, repeat: Infinity, repeatType: 'reverse' }}
        >
          <path d="M12 0C13 8 16 11 24 12 16 13 13 16 12 24 11 16 8 13 0 12 8 11 11 8 12 0z" fill={i % 2 ? '#96c6fb' : '#ffb3cf'} />
        </motion.svg>
      ))}
    </span>
  );
}

function Clouds() {
  const cloud = 'M20 60 Q0 60 4 44 Q8 30 26 34 Q30 12 54 16 Q70 0 90 16 Q114 10 116 34 Q136 34 134 50 Q132 62 114 60 Z';
  return (
    <svg className="landing-clouds" viewBox="0 0 1200 220" preserveAspectRatio="xMidYMax slice">
      <defs>
        <linearGradient id="cloudG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--cloud-top, #fff)" />
          <stop offset="1" stopColor="var(--cloud-bottom, #ffe3ee)" />
        </linearGradient>
      </defs>
      <g className="cloud-drift slow" fill="url(#cloudG)" opacity=".7">
        <path d={cloud} transform="translate(60 90) scale(1.6)" />
        <path d={cloud} transform="translate(520 70) scale(2)" />
        <path d={cloud} transform="translate(960 100) scale(1.5)" />
      </g>
      <g className="cloud-drift" fill="url(#cloudG)">
        <path d={cloud} transform="translate(-60 130) scale(2.2)" />
        <path d={cloud} transform="translate(300 140) scale(1.8)" />
        <path d={cloud} transform="translate(700 120) scale(2.4)" />
        <path d={cloud} transform="translate(1040 140) scale(2)" />
      </g>
    </svg>
  );
}
