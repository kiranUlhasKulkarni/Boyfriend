import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { TOTAL_LEVELS } from '../levels';
import { sound } from '../audio/soundManager';

export const MAX_LIVES = 3;
const STORAGE_KEY = 'bebu-love-quest-v1';

/** Screens: landing | map | level | reward | kiss | finale */
const initialState = {
  screen: 'landing',
  lives: MAX_LIVES,
  completed: [], // level ids that have been beaten
  currentLevel: null, // id of level being played / just won
  outOfLivesOpen: false,
  muted: false,
  theme: null, // 'light' | 'dark' | null (follow system)
};

/** Dev-only shortcut: ?screen=reward&level=3 (or finale, kiss, map, level) to preview any screen. */
function devOverrides(state) {
  if (!import.meta.env.DEV) return state;
  const p = new URLSearchParams(location.search);
  const screen = p.get('screen');
  if (!screen) return state;
  const level = Number(p.get('level')) || state.currentLevel || 1;
  return { ...state, screen, currentLevel: level };
}

function loadState() {
  return devOverrides(loadSavedState());
}

function loadSavedState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!saved) return initialState;
    return {
      ...initialState,
      lives: Number.isInteger(saved.lives) ? saved.lives : MAX_LIVES,
      completed: Array.isArray(saved.completed) ? saved.completed : [],
      muted: !!saved.muted,
      theme: saved.theme ?? null,
    };
  } catch {
    return initialState;
  }
}

function reducer(state, action) {
  switch (action.type) {
    case 'GO':
      return { ...state, screen: action.screen, outOfLivesOpen: false };
    case 'SET_CURRENT_LEVEL':
      return { ...state, currentLevel: action.id };
    case 'WIN_LEVEL': {
      const completed = state.completed.includes(action.id)
        ? state.completed
        : [...state.completed, action.id].sort((a, b) => a - b);
      return { ...state, completed, currentLevel: action.id };
    }
    case 'LOSE_LIFE': {
      const lives = Math.max(0, state.lives - 1);
      return { ...state, lives };
    }
    case 'OPEN_OUT_OF_LIVES':
      return { ...state, outOfLivesOpen: true };
    case 'CLOSE_OUT_OF_LIVES':
      return { ...state, outOfLivesOpen: false };
    case 'RESTORE_LIVES':
      return { ...state, lives: MAX_LIVES, outOfLivesOpen: false };
    case 'TOGGLE_MUTE':
      return { ...state, muted: !state.muted };
    case 'SET_THEME':
      return { ...state, theme: action.theme };
    case 'RESET_PROGRESS':
      return { ...initialState, muted: state.muted, theme: state.theme, screen: 'landing' };
    default:
      return state;
  }
}

const GameContext = createContext(null);

export function GameProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);
  // Fluid circular "portal" transition between screens
  const [portal, setPortal] = useState(null); // { x, y, phase: 'in'|'out', key }
  const pendingRef = useRef(null);

  // Persist
  useEffect(() => {
    const { lives, completed, muted, theme } = state;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ lives, completed, muted, theme }));
    } catch {
      /* private mode etc. */
    }
  }, [state.lives, state.completed, state.muted, state.theme]);

  // Sound mute sync
  useEffect(() => sound.setMuted(state.muted), [state.muted]);

  // Theme
  const systemDark = useSystemDark();
  const resolvedTheme = state.theme ?? (systemDark ? 'dark' : 'light');
  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolvedTheme === 'dark' ? '#1b1630' : '#ffd6e7');
  }, [resolvedTheme]);

  /** Navigate with a liquid circle wipe expanding from (x, y). */
  const goTo = useCallback((screen, origin) => {
    const x = origin?.x ?? window.innerWidth / 2;
    const y = origin?.y ?? window.innerHeight / 2;
    pendingRef.current = screen;
    setPortal({ x, y, phase: 'in', key: Date.now() });
  }, []);

  const onPortalCovered = useCallback(() => {
    if (pendingRef.current) dispatch({ type: 'GO', screen: pendingRef.current });
    pendingRef.current = null;
    setPortal((p) => (p ? { ...p, phase: 'out' } : p));
  }, []);
  const onPortalDone = useCallback(() => setPortal(null), []);

  const api = useMemo(() => {
    const unlockedUpTo = Math.min(TOTAL_LEVELS, state.completed.length ? Math.max(...state.completed) + 1 : 1);
    return {
      ...state,
      resolvedTheme,
      unlockedUpTo,
      isUnlocked: (id) => id === 1 || state.completed.includes(id - 1) || state.completed.includes(id),
      isCompleted: (id) => state.completed.includes(id),
      dispatch,
      goTo,
      portal,
      onPortalCovered,
      onPortalDone,
      startLevel: (id, origin) => {
        if (state.lives <= 0) return dispatch({ type: 'OPEN_OUT_OF_LIVES' });
        dispatch({ type: 'SET_CURRENT_LEVEL', id });
        goTo('level', origin);
      },
      winLevel: (id) => dispatch({ type: 'WIN_LEVEL', id }),
      loseLife: () => dispatch({ type: 'LOSE_LIFE' }),
      restoreLives: () => dispatch({ type: 'RESTORE_LIVES' }),
      toggleMute: () => dispatch({ type: 'TOGGLE_MUTE' }),
      toggleTheme: () => dispatch({ type: 'SET_THEME', theme: resolvedTheme === 'dark' ? 'light' : 'dark' }),
      resetProgress: () => dispatch({ type: 'RESET_PROGRESS' }),
    };
  }, [state, resolvedTheme, goTo, portal, onPortalCovered, onPortalDone]);

  return <GameContext.Provider value={api}>{children}</GameContext.Provider>;
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used inside <GameProvider>');
  return ctx;
}

function useSystemDark() {
  const query = '(prefers-color-scheme: dark)';
  const [dark, setDark] = useState(() => window.matchMedia?.(query).matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return;
    const fn = (e) => setDark(e.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);
  return dark;
}
