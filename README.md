# 💗 Pillu's Love Quest

A 10-level National Boyfriend Day game: React 18 + Vite + Framer Motion.

```
npm install
npm run dev        # http://localhost:5173
npm run build      # static site in dist/ — deploy anywhere (Netlify, Vercel, GitHub Pages)
```

## Personalise it (all in one place)
- **`src/config.js`**: names, letters for every level, finale message, quiz questions, image/audio paths, reward music.
- **`public/photos/`**: all photos (see README.txt there for which photo goes where).
- **`public/audio/`**: your voice lines + music (see README.txt there).
- Character colours (skin/hair) for the chibi art live at the top of `src/art/Characters.jsx`.

## Structure
```
src/
  config.js                 ← all personal content
  state/GameContext.jsx     ← global state: lives, progress, screen, theme, mute (persisted to localStorage)
  audio/soundManager.js     ← custom voice lines (success/fail/kiss), bgm, synthesized SFX
  screens/                  ← Landing, GameMap, LevelScreen (intro/win/fail), Reward, KissScreen, Finale
  levels/                   ← 10 mini-games + index.js registry + kit (shared HUD) + LEVEL_CONTRACT.md
  components/               ← UI (top bar, lives, portal transition, modals), Photo, LipMark, Icons, confetti
  art/Characters.jsx        ← SVG chibis of him + you
```

## Game flow
Landing → Map → Level intro → play → **win**: her voice + confetti → reward letter (+ song) → map
                                   → **fail**: her voice, −1 life → retry, or at 0 lives "Get more life!" → 25 kisses → 3 lives
Beating level 10 → grand finale (boom → vines → framed photo + final message).

Each reward letter plays its own YouTube Music track (set per level in `REWARDS` in `src/config.js`).

Dev shortcut: `?screen=reward&level=3`, `?screen=finale`, `?screen=kiss` jump straight to a screen (dev server only).

Tip: progress is saved in the browser. "start over" on the landing page resets it.
