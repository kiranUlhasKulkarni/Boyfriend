import { IMAGES } from './config';

/**
 * Random-but-stable photo picks. The pool is shuffled once per page load,
 * then each "slot" (e.g. 'reward-3', 'intro-5', 'map-2') always gets the same
 * photo for the rest of the session, and different slots get different photos
 * for as long as the pool lasts.
 */
const shuffled = [...IMAGES.pool];
for (let i = shuffled.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
}

const assigned = new Map();
let cursor = 0;

export function photoFor(slot) {
  if (!assigned.has(slot)) {
    assigned.set(slot, shuffled[cursor % shuffled.length]);
    cursor++;
  }
  return assigned.get(slot);
}

export const photoPool = shuffled;
