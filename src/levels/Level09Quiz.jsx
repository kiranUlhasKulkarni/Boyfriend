/**
 * Level 9 — "Do You Know Us?"
 * A couple quiz on a vintage love-letter card. One question at a time,
 * 12 seconds each. Pass with QUIZ_PASS_SCORE correct answers.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Stage } from './kit.jsx';
import { sound } from '../audio/soundManager';
import { Heart } from '../components/Icons';
import { HerChibi } from '../art/Characters';
import { burst } from '../components/confetti';
import { QUIZ, QUIZ_PASS_SCORE } from '../config';
import './Level09Quiz.css';

// ───────────── Tunables ─────────────
const QUESTION_TIME = 12; // seconds per question
const REVEAL_MS = 1700; // how long the answer feedback stays before the next card
const TALLY_MS = 1300; // result tally before onWin / onFail
const LETTERS = ['A', 'B', 'C', 'D'];
const BUBBLES = ['pink', 'blue', 'lilac', 'peach'];
const RING_R = 26;
const RING_C = 2 * Math.PI * RING_R;

const BOKEH = Array.from({ length: 16 }, (_, i) => ({
  left: `${(i * 37 + 7) % 100}%`,
  top: `${(i * 53 + 11) % 100}%`,
  size: 30 + ((i * 29) % 70),
  hue: ['#ffc8dd', '#bddcff', '#e4c9ff', '#ffe3b3', '#c9f2e4'][i % 5],
  delay: (i % 7) * 0.8,
  dur: 7 + (i % 5) * 1.5,
}));

export default function Level09Quiz({ onWin, onFail }) {
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState('question'); // question | reveal | tally
  const [picked, setPicked] = useState(null); // index, or -1 on timeout
  const [results, setResults] = useState([]); // booleans
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME);
  const [reaction, setReaction] = useState(null); // 'yay' | 'sad'
  const ended = useRef(false);
  const timers = useRef([]);
  const btnRefs = useRef([]);
  const lastTick = useRef(QUESTION_TIME);

  const q = QUIZ[idx];
  const score = results.filter(Boolean).length;

  const later = (fn, ms) => {
    const id = setTimeout(fn, ms);
    timers.current.push(id);
  };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const answer = useCallback(
    (i) => {
      if (phase !== 'question' || ended.current) return;
      const correct = i === q.answer;
      setPicked(i);
      setPhase('reveal');
      const nextResults = [...results, correct];
      setResults(nextResults);
      if (correct) {
        sound.sfx.coin();
        setReaction('yay');
        const el = btnRefs.current[i];
        if (el) {
          const r = el.getBoundingClientRect();
          burst({ x: (r.left + r.width / 2) / window.innerWidth, y: (r.top + r.height / 2) / window.innerHeight }, 0.45);
        }
      } else {
        sound.sfx.bad();
        setReaction('sad');
      }
      later(() => {
        setReaction(null);
        if (idx + 1 < QUIZ.length) {
          setIdx(idx + 1);
          setPicked(null);
          setTimeLeft(QUESTION_TIME);
          lastTick.current = QUESTION_TIME;
          setPhase('question');
        } else {
          setPhase('tally');
          const final = nextResults.filter(Boolean).length;
          if (final >= QUIZ_PASS_SCORE) sound.sfx.sparkle();
          later(() => {
            if (ended.current) return;
            ended.current = true;
            if (final >= QUIZ_PASS_SCORE) onWin();
            else onFail('score');
          }, TALLY_MS);
        }
      }, REVEAL_MS);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [phase, q, results, idx]
  );

  // per-question countdown
  useEffect(() => {
    if (phase !== 'question') return;
    const start = performance.now();
    const id = setInterval(() => {
      const left = Math.max(0, QUESTION_TIME - (performance.now() - start) / 1000);
      setTimeLeft(left);
      const whole = Math.ceil(left);
      if (whole < lastTick.current) {
        lastTick.current = whole;
        if (whole <= 4 && whole > 0) sound.sfx.tick();
      }
      if (left <= 0) clearInterval(id);
    }, 50);
    return () => clearInterval(id);
  }, [phase, idx]);

  useEffect(() => {
    if (phase === 'question' && timeLeft <= 0) answer(-1);
  }, [timeLeft, phase, answer]);

  // keyboard: 1–4 / A–D
  useEffect(() => {
    const onKey = (e) => {
      const k = e.key.toLowerCase();
      let i = ['1', '2', '3', '4'].indexOf(k);
      if (i < 0) i = ['a', 'b', 'c', 'd'].indexOf(k);
      if (i >= 0 && i < q.options.length) {
        e.preventDefault();
        answer(i);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [answer, q]);

  const pct = timeLeft / QUESTION_TIME;
  const danger = timeLeft <= 4;

  return (
    <Stage className="l09-stage">
      <div className="l09-bg" aria-hidden>
        <div className="l09-spot l09-spot-a" />
        <div className="l09-spot l09-spot-b" />
        {BOKEH.map((b, i) => (
          <span
            key={i}
            className="l09-bokeh"
            style={{ left: b.left, top: b.top, width: b.size, height: b.size, '--hue': b.hue, animationDelay: `${-b.delay}s`, animationDuration: `${b.dur}s` }}
          />
        ))}
      </div>

      <div className="l09-wrap">
        {/* top bar: progress dots + hearts score */}
        <div className="l09-top">
          <div className="l09-dots" aria-label={`Question ${idx + 1} of ${QUIZ.length}`}>
            {QUIZ.map((_, i) => {
              const r = results[i];
              const cls = r === true ? 'ok' : r === false ? 'no' : i === idx && phase !== 'tally' ? 'now' : '';
              return <span key={i} className={`l09-dot ${cls}`} />;
            })}
          </div>
          <div className="l09-hearts" aria-label={`Score ${score}`}>
            {QUIZ.map((_, i) => (
              <motion.span key={i} animate={i < score ? { scale: [1, 1.5, 1] } : { scale: 1 }} transition={{ duration: 0.4 }}>
                <Heart size={22} fill={i < score ? '#ff6f9f' : '#e6d6e4'} shine={i < score} />
              </motion.span>
            ))}
            <span className="l09-need">need {QUIZ_PASS_SCORE}</span>
          </div>
        </div>

        <div className="l09-cardzone">
          <AnimatePresence mode="wait">
            {phase !== 'tally' ? (
              <motion.div
                key={idx}
                className="l09-card"
                initial={{ opacity: 0, x: 120, rotateY: -50, rotate: 4 }}
                animate={{ opacity: 1, x: 0, rotateY: 0, rotate: idx % 2 ? 0.8 : -0.8 }}
                exit={{ opacity: 0, x: -140, rotateY: 50, rotate: -6 }}
                transition={{ type: 'spring', stiffness: 170, damping: 20 }}
              >
                <div className="l09-stamp" aria-hidden>
                  <Heart size={26} fill="#ff85b1" />
                  <span>Q{idx + 1}</span>
                </div>
                <div className="l09-postmark" aria-hidden>
                  with love
                  <br />
                  ♡ {String(idx + 1).padStart(2, '0')} ♡
                </div>

                <div className="l09-qhead">
                  <div className={`l09-timer ${danger ? 'danger' : ''}`} aria-label={`${Math.ceil(timeLeft)} seconds left`}>
                    <svg viewBox="0 0 64 64" width="64" height="64">
                      <circle cx="32" cy="32" r={RING_R} className="l09-ring-bg" />
                      <circle
                        cx="32"
                        cy="32"
                        r={RING_R}
                        className="l09-ring"
                        strokeDasharray={RING_C}
                        strokeDashoffset={RING_C * (1 - pct)}
                        transform="rotate(-90 32 32)"
                      />
                    </svg>
                    <motion.div className="l09-timer-heart" animate={danger ? { scale: [1, 1.18, 1] } : { scale: 1 }} transition={{ duration: 0.5, repeat: danger ? Infinity : 0 }}>
                      <Heart size={34} fill={danger ? '#ff5d7a' : '#ff85b1'} />
                      <b>{Math.ceil(timeLeft)}</b>
                    </motion.div>
                  </div>
                  <div className="l09-qtext">
                    <small>
                      Question {idx + 1} of {QUIZ.length}
                    </small>
                    <h2>{q.q}</h2>
                  </div>
                </div>

                <div className="l09-answers">
                  {q.options.map((opt, i) => {
                    const isAnswer = i === q.answer;
                    let state = '';
                    if (phase === 'reveal') {
                      if (isAnswer) state = picked === i ? 'correct' : 'reveal';
                      else if (picked === i) state = 'wrong';
                      else state = 'dim';
                    }
                    return (
                      <motion.button
                        key={i}
                        ref={(el) => (btnRefs.current[i] = el)}
                        className={`l09-ans l09-${BUBBLES[i % 4]} ${state}`}
                        onClick={() => answer(i)}
                        disabled={phase !== 'question'}
                        initial={{ opacity: 0, y: 16, scale: 0.9 }}
                        animate={
                          state === 'wrong'
                            ? { opacity: 1, y: 0, scale: 1, x: [0, -10, 10, -8, 8, -4, 0] }
                            : state === 'correct' || state === 'reveal'
                              ? { opacity: 1, y: 0, scale: [1, 1.08, 1.03] }
                              : { opacity: 1, y: 0, scale: 1 }
                        }
                        transition={{ delay: phase === 'question' ? 0.15 + i * 0.06 : 0, duration: 0.45 }}
                        whileHover={phase === 'question' ? { y: -3, scale: 1.03 } : undefined}
                        whileTap={phase === 'question' ? { scale: 0.95 } : undefined}
                      >
                        <span className="l09-letter">{state === 'correct' || state === 'reveal' ? '✓' : state === 'wrong' ? '✗' : LETTERS[i]}</span>
                        <span className="l09-opt">{opt}</span>
                      </motion.button>
                    );
                  })}
                </div>
                {phase === 'reveal' && picked === -1 && <div className="l09-timeout">time's up!</div>}
              </motion.div>
            ) : (
              <motion.div
                key="tally"
                className="l09-card l09-tally"
                initial={{ opacity: 0, scale: 0.7, rotate: -4 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 200, damping: 16 }}
              >
                <small>your score</small>
                <div className="l09-big">
                  {score}
                  <span>/{QUIZ.length}</span>
                </div>
                <div className="l09-hearts big">
                  {results.map((r, i) => (
                    <motion.span key={i} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.1 + i * 0.12, type: 'spring' }}>
                      <Heart size={32} fill={r ? '#ff6f9f' : '#e6d6e4'} shine={r} />
                    </motion.span>
                  ))}
                </div>
                <p>{score >= QUIZ_PASS_SCORE ? 'you really know us 🥹💗' : 'hmm… we need to talk, pillu'}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* her reaction */}
      <AnimatePresence>
        {reaction && (
          <motion.div
            key={reaction + idx}
            className="l09-her"
            initial={{ y: 160, rotate: 8 }}
            animate={{ y: 0, rotate: 0 }}
            exit={{ y: 180, rotate: -6 }}
            transition={{ type: 'spring', stiffness: 260, damping: 18 }}
          >
            <motion.div className={`l09-bubble ${reaction}`} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.12, type: 'spring', stiffness: 300 }}>
              {reaction === 'yay' ? 'yesss baby 💗' : 'pillu?!? 😤'}
            </motion.div>
            <HerChibi size={92} mouth={reaction === 'yay' ? 'open' : 'sad'} wave={reaction === 'yay'} wink={reaction === 'yay'} />
          </motion.div>
        )}
      </AnimatePresence>
    </Stage>
  );
}
