# Level contract

Every level is a default-exported React component in `src/levels/LevelNN<Name>.jsx`:

```jsx
export default function Level06CatchHearts({ onWin, onFail }) { ... }
```

## Lifecycle
- The component is mounted by `LevelScreen` **after** the player taps "Let's go" on the intro card,
  so the game should start immediately on mount (a short 3‑2‑1 or "Go!" in-game flourish is fine).
- Call `onWin()` **exactly once** when the player wins; `onFail(reason)` **exactly once** when they fail.
  Guard with a ref (`const ended = useRef(false)`). After calling either, freeze the game (stop loops / input).
- On retry, `LevelScreen` remounts the component with a new `key`, so all state resets naturally.
- Lives, sounds for win/fail (her voice lines), confetti on win, win/fail overlays and navigation are
  all handled by `LevelScreen`. **Do not** play success/fail voice audio or show your own end screens.
- Clean up every rAF / interval / listener on unmount.

## Layout
- The component is rendered inside a flex box that fills the screen below the top bar
  (roughly `min(100vw-32px, 1000px)` × `calc(100dvh - 90px)`), so it must be fully responsive and work in
  portrait phones and landscape desktops. Wrap your game in `<Stage>` from `./kit.jsx`
  (rounded card, shadow, `touch-action: none`).
- Canvas games: use `useLogicalCanvas(W, H)` from `src/hooks/useGameLoop.js` with a fixed logical size and
  keep the canvas at that aspect ratio (`aspect-ratio` CSS + `max-height:100%; max-width:100%; margin:auto`),
  or draw adaptively by reading the canvas's size. DOM/SVG games: use an SVG `viewBox` or flex/grid.
- Input: use **pointer events** (works for mouse + touch) and keyboard where it makes sense.
- Use `<GameHud>`, `<HudPill>`, `<TimerBar>` from `./kit.jsx` for score/timer chips so levels look consistent.

## Shared helpers you can import
- `useGameLoop(cb(dt, t), running)`, `useLogicalCanvas(W, H)`, `useTimer(seconds, running, onEnd)` → `[left, adjust]`
  from `../hooks/useGameLoop`
- `sound.sfx.pop()/boop(i)/click()/slash()/hit()/jump()/coin()/bad()/kiss()/sparkle()/whoosh()/tick()` from `../audio/soundManager`
  (tiny synthesized effects for in-game feedback — use them!)
- `Heart`, `HEART_D` (heart path in a 100×100 box), `LevelIcon` from `../components/Icons`
- `HimChibi`, `HerChibi` (SVG chibis, 100×140 viewBox, props `size`, `mouth: 'smile'|'open'|'kiss'|'sad'`, `wave`)
  from `../art/Characters`. For canvas games you can rasterize them, or draw your own canvas art.
- `Photo` (`<Photo src label />` with pretty fallback when the file is missing) from `../components/Photo`
- `IMAGES`, `QUIZ`, `QUIZ_PASS_SCORE`, `NAMES` from `../config`
- `framer-motion` is installed. `burst(origin, power)` from `../components/confetti` for small in-game bursts.

## Visual bar
Highly stylised, artistic, cute. Pastel pink + pastel blue base palette, rounded everything, soft shadows,
gradients, SVG/canvas art (NOT plain rectangles/circles standing in for things — draw actual little
characters/objects), juicy feedback (squash/stretch, particles, screen shake, floating "+1" text).
Must look good in **both light and dark mode**: read CSS variables (`var(--surface-solid)`, `var(--ink)`,
`var(--accent)`, etc.) for DOM; for canvas read `document.documentElement.dataset.theme === 'dark'`
each frame and switch palettes (e.g. day sky → night sky).

Difficulty: fun and winnable for a casual player in ~30–90 seconds, but you *can* fail.
Co-locate styles as `LevelNN<Name>.css` imported by the component; prefix every class with `lNN-` to avoid clashes.
