import { lazy, createElement } from 'react';

// Load level files lazily; a missing file shows a friendly placeholder instead of crashing.
const files = import.meta.glob('./Level*.jsx');
const Missing = ({ onWin }) =>
  createElement('div', { style: { margin: 'auto', textAlign: 'center', fontFamily: 'var(--font-display)' } },
    createElement('p', null, 'This level is still being built 🛠️'),
    createElement('button', { className: 'btn', onClick: () => onWin() }, 'Skip (dev)'));
const load = (file) => lazy(files[`./${file}`] ?? (() => Promise.resolve({ default: Missing })));

/**
 * Level registry. Each level component receives:
 *   onWin()          — call exactly once when the player wins
 *   onFail(reason?)  — call exactly once when the player fails
 * See src/levels/LEVEL_CONTRACT.md for the full contract.
 */
export const LEVELS = [
  {
    id: 1,
    name: 'Water Breathing',
    theme: 'Demon Slayer',
    icon: 'sword',
    color: ['#9fd8ff', '#4f9ee8'],
    blurb: 'Tanjiro, Nezuko and the crows are flying by! Swipe to slash the glowing targets with Water Breathing.',
    howTo: 'Drag / swipe across the targets to slash them. Hit 15 before time runs out. Avoid slashing Nezuko!',
    component: load('Level01DemonSlayer.jsx'),
  },
  {
    id: 2,
    name: 'The Love Obby',
    theme: 'Roblox Obby',
    icon: 'cube',
    color: ['#b8f0c8', '#4fc38a'],
    blurb: 'A blocky obstacle course with me waiting at the very end. Jump, jump, jump!',
    howTo: 'Tap / click / press Space to jump (hold for a bigger jump). Easy mode: floaty jumps and 5 tries to reach me!',
    component: load('Level02Obby.jsx'),
  },
  {
    id: 3,
    name: 'Desi Kitchen',
    theme: 'Indian Restaurant Chef',
    icon: 'pot',
    color: ['#ffe0a3', '#f2a541'],
    blurb: 'Order up! Cook a perfect Chicken Biryani and a Mango Lassi before the timer runs out.',
    howTo: 'Drag the right ingredients into the pot and the blender. Wrong ones cost time!',
    component: load('Level03Chef.jsx'),
  },
  {
    id: 4,
    name: 'Corporate Escape',
    theme: 'LinkedIn Age',
    icon: 'briefcase',
    color: ['#c7d7ff', '#5b7fe0'],
    blurb: 'Synergy. Circle back. Quick sync? Dodge the corporate jargon and escape to our date!',
    howTo: 'Move left/right (drag, arrows or A/D). Dodge meetings & jargon, grab coffee for a shield.',
    component: load('Level04Corporate.jsx'),
  },
  {
    id: 5,
    name: 'Memory Lane',
    theme: 'Memory Match',
    icon: 'cards',
    color: ['#e4c9ff', '#a072e0'],
    blurb: 'Flip the polaroids and find all of our matching memories.',
    howTo: 'Flip two cards at a time. Match all pairs before you run out of moves.',
    component: load('Level05Memory.jsx'),
  },
  {
    id: 6,
    name: 'Raining Love',
    theme: 'Catch the Hearts',
    icon: 'heart',
    color: ['#ffc6dc', '#ff6f9f'],
    blurb: 'It’s raining hearts! Catch my love, but dodge the broken hearts.',
    howTo: 'Move the basket (drag / arrows). Catch 30 hearts. 3 broken hearts and you lose.',
    component: load('Level06CatchHearts.jsx'),
  },
  {
    id: 7,
    name: 'Written in the Stars',
    theme: 'Constellation',
    icon: 'star',
    color: ['#c2c8ff', '#6c63d9'],
    blurb: 'Connect the stars in order to draw our love across the night sky.',
    howTo: 'Tap the stars in number order to draw each constellation before the night ends.',
    component: load('Level07Constellation.jsx'),
  },
  {
    id: 8,
    name: 'Boba Tower',
    theme: 'Stacking Game',
    icon: 'boba',
    color: ['#f3d9c2', '#c98b5a'],
    blurb: 'Stack the boba cups as high as our love goes. Timing is everything!',
    howTo: 'Tap to drop the sliding cup. Overhangs get trimmed. Stack 12 to win!',
    component: load('Level08BobaStack.jsx'),
  },
  {
    id: 9,
    name: 'Do You Know Us?',
    theme: 'Couple Quiz',
    icon: 'quiz',
    color: ['#bdf0ee', '#3fb8b0'],
    blurb: 'A little quiz about us. No pressure, pillu… (there is pressure).',
    howTo: 'Answer each question before the timer runs out. Get enough right to pass!',
    component: load('Level09Quiz.jsx'),
  },
  {
    id: 10,
    name: 'Fly to My Heart',
    theme: 'Paper Plane Finale',
    icon: 'plane',
    color: ['#ffd1e6', '#ff8fc0'],
    blurb: 'The final level. Fly your paper-plane love letter through the clouds all the way to me.',
    howTo: 'Tap / click / Space to flap upward. Fly through the cloud gaps and collect hearts!',
    component: load('Level10PaperPlane.jsx'),
  },
];

export const TOTAL_LEVELS = LEVELS.length;
export const getLevel = (id) => LEVELS.find((l) => l.id === id);
