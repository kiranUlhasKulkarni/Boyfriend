import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGame } from '../state/GameContext';
import { TopBar, Lives, BrokenHeart } from '../components/UI';
import { LevelIcon, IconPlay, IconReplay, IconBack, Heart, IconLips } from '../components/Icons';
import { HerChibi } from '../art/Characters';
import { getLevel, TOTAL_LEVELS } from '../levels';
import Photo from '../components/Photo';
import { photoFor } from '../photos';
import { sound } from '../audio/soundManager';
import { burst, cannons } from '../components/confetti';
import './LevelScreen.css';

/**
 * Wraps every mini-game:
 *   intro card → game (onWin/onFail) → win overlay → reward / finale
 *                                    → fail overlay → retry / map / get more life
 */
export default function LevelScreen() {
  const { currentLevel, lives, winLevel, loseLife, goTo } = useGame();
  const level = getLevel(currentLevel) ?? getLevel(1);
  const [phase, setPhase] = useState('intro'); // intro | playing | won | failed
  const [attempt, setAttempt] = useState(0);
  const [failReason, setFailReason] = useState(null);
  const endedRef = useRef(false);
  const Game = level.component;
  const isFinal = level.id === TOTAL_LEVELS;

  const begin = () => {
    sound.sfx.sparkle();
    endedRef.current = false;
    setAttempt((a) => a + 1);
    setPhase('playing');
  };

  const onWin = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;
    winLevel(level.id);
    setPhase('won');
    cannons(1);
    setTimeout(() => burst({ x: 0.5, y: 0.4 }, 1), 300);
    sound.play('success');
  }, [level.id, winLevel]);

  const onFail = useCallback(
    (reason) => {
      if (endedRef.current) return;
      endedRef.current = true;
      loseLife();
      setFailReason(reason ?? null);
      setPhase('failed');
      sound.play('fail');
    },
    [loseLife]
  );

  // Leave a level mid-game without penalty
  const toMap = (e) => goTo('map', e ? { x: e.clientX, y: e.clientY } : undefined);

  const continueToReward = (e) => {
    sound.sfx.whoosh();
    goTo(isFinal ? 'finale' : 'reward', { x: e.clientX, y: e.clientY });
  };

  return (
    <div className="level-screen">
      <div className="level-bg" style={{ '--c1': level.color[0], '--c2': level.color[1] }} aria-hidden />
      <TopBar title={`Level ${level.id} · ${level.name}`} onHome={toMap} showProgress={false} />

      <div className="level-area">
        {phase === 'intro' && <IntroCard level={level} onStart={begin} onBack={toMap} />}
        {phase !== 'intro' && (
          <motion.div
            className="level-game"
            key={attempt}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
          >
            <Suspense fallback={<LoadingHeart />}>
              <Game onWin={onWin} onFail={onFail} />
            </Suspense>
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {phase === 'won' && <WinOverlay key="win" level={level} isFinal={isFinal} onContinue={continueToReward} />}
        {phase === 'failed' && (
          <FailOverlay
            key="fail"
            lives={lives}
            reason={failReason}
            onRetry={begin}
            onMap={toMap}
            onKiss={(e) => goTo('kiss', { x: e.clientX, y: e.clientY })}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function IntroCard({ level, onStart, onBack }) {
  return (
    <motion.div
      className="intro-card glass"
      initial={{ y: 40, opacity: 0, scale: 0.9 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 220, damping: 18 }}
    >
      <motion.figure
        className="intro-polaroid"
        initial={{ scale: 0, rotate: 30 }}
        animate={{ scale: 1, rotate: 8 }}
        transition={{ delay: 0.35, type: 'spring', stiffness: 260, damping: 11 }}
      >
        <Photo src={photoFor(`intro-${level.id}`)} label="us" className="intro-polaroid-img" />
      </motion.figure>
      <motion.div
        className="intro-icon"
        style={{ background: `linear-gradient(135deg, ${level.color[0]}, ${level.color[1]})` }}
        initial={{ rotate: -30, scale: 0 }}
        animate={{ rotate: 0, scale: 1 }}
        transition={{ delay: 0.15, type: 'spring', stiffness: 300, damping: 10 }}
      >
        <LevelIcon name={level.icon} size={70} />
      </motion.div>
      <div className="intro-kicker">
        Level {level.id} · {level.theme}
      </div>
      <h1 className="intro-title grad-text">{level.name}</h1>
      <p className="intro-blurb">{level.blurb}</p>
      <div className="intro-how">
        <span className="intro-how-tag">How to play</span>
        {level.howTo}
      </div>
      <div className="intro-lives">
        <Lives />
      </div>
      <div className="intro-actions">
        <button className="btn btn-ghost" onClick={onBack}>
          <IconBack /> Map
        </button>
        <button className="btn btn-lg" onClick={onStart} autoFocus>
          <IconPlay /> Let’s go!
        </button>
      </div>
    </motion.div>
  );
}

function WinOverlay({ level, isFinal, onContinue }) {
  useEffect(() => {
    const t = [0, 1, 2].map((i) => setTimeout(() => sound.sfx.boop(i), (0.55 + i * 0.18) * 1000));
    return () => t.forEach(clearTimeout);
  }, []);
  return (
    <motion.div className="result-overlay win" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="result-rays" aria-hidden />
      <motion.div
        className="result-card glass"
        initial={{ scale: 0.3, rotate: -8, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 12, delay: 0.1 }}
      >
        <motion.div className="result-chibi" initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4, type: 'spring' }}>
          <HerChibi size={96} wave mouth="open" />
        </motion.div>
        <div className="result-stars">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.5 + i * 0.18, type: 'spring', stiffness: 400, damping: 10 }}
            >
              <svg viewBox="0 0 24 24" width={i === 1 ? 64 : 48} height={i === 1 ? 64 : 48}>
                <path d="M12 2.8l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.1l6.1-.7z" fill="#ffd36e" stroke="#e59a2f" strokeWidth="1" strokeLinejoin="round" />
              </svg>
            </motion.span>
          ))}
        </div>
        <h2 className="result-title grad-text">Awww baby, yayyy!</h2>
        <p className="result-text">
          You beat <b>{level.name}</b>! {isFinal ? 'That was the LAST level…' : 'I wrote you something…'}
        </p>
        <motion.button
          className="btn btn-lg"
          onClick={onContinue}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1 }}
        >
          {isFinal ? (
            <>
              <Heart size={22} fill="#fff" shine={false} /> Open your surprise
            </>
          ) : (
            <>💌 Read my letter</>
          )}
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

const FAIL_LINES = {
  time: 'The timer beat you this time!',
  crash: 'Oopsie, you crashed!',
  burnout: 'Corporate got you this time!',
  toppled: 'The tower toppled!',
  score: 'Hmm… we need to talk 😤',
};

function FailOverlay({ lives, reason, onRetry, onMap, onKiss }) {
  const out = lives <= 0;
  return (
    <motion.div className="result-overlay fail" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div
        className="result-card glass"
        initial={{ y: 80, opacity: 0, rotate: 4 }}
        animate={{ y: 0, opacity: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 220, damping: 14 }}
      >
        <motion.div className="fail-heart" initial={{ scale: 1.6 }} animate={{ scale: 1, rotate: [0, -10, 10, -6, 0] }} transition={{ duration: 0.8 }}>
          <BrokenHeart size={84} />
        </motion.div>
        <h2 className="result-title">Aiyoo baby!</h2>
        <p className="result-text">
          {reason && FAIL_LINES[reason] ? `${FAIL_LINES[reason]} ` : ''}
          You’ll do great, try again 💪
        </p>
        <div className="fail-lives">
          <Lives />
          <span>{out ? 'no hearts left!' : `${lives} ${lives === 1 ? 'heart' : 'hearts'} left`}</span>
        </div>
        <div className="intro-actions">
          <button className="btn btn-ghost" onClick={onMap}>
            <IconBack /> Map
          </button>
          {out ? (
            <button className="btn btn-lg" onClick={onKiss}>
              <IconLips size={24} /> Get more life!
            </button>
          ) : (
            <button className="btn btn-lg" onClick={onRetry} autoFocus>
              <IconReplay /> Try again
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function LoadingHeart() {
  return (
    <div className="loading-heart">
      <motion.div animate={{ scale: [1, 1.25, 1] }} transition={{ repeat: Infinity, duration: 0.8 }}>
        <Heart size={56} fill="#ff85b1" />
      </motion.div>
    </div>
  );
}
