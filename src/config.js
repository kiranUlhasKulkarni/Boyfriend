/**
 * ─────────────────────────────────────────────────────────────
 *  💗  CONTENT CONFIG — everything personal lives in this file.
 *  Photos live in /public/photos, audio in /public/audio.
 *  Missing images fall back to a pretty pastel placeholder and
 *  missing audio is silently skipped, so nothing ever breaks.
 * ─────────────────────────────────────────────────────────────
 */

export const NAMES = {
  him: 'Pillu',
  her: 'cutu',
  appTitle: "Pillu's Love Quest",
  appSubtitle: 'Happy National Boyfriend Day 💗 a 10-level journey made just for you',
};

const p = (n) => `/photos/photo${String(n).padStart(2, '0')}.jpg`;

export const IMAGES = {
  // Landing page polaroids — used ONLY on the landing page, in this exact order.
  landing: [
    { src: '/photos/landing/landing1.jpg', caption: 'my safe place' },
    { src: '/photos/landing/landing2.jpg', caption: 'mwah mwah' },
    { src: '/photos/landing/landing3.jpg', caption: 'never letting go' },
  ],
  // Full-screen photo of cutu for the 25-kisses "get more life" mini-game — used ONLY there.
  herKissPhoto: '/photos/kiss/cutu-kiss.jpg',
  // Framed photo of pillu for the grand finale
  himFinale: p(24),
  // Level 5 memory-match cards (6 photos → 12 cards). Clear face shots work best.
  memoryFaces: [p(3), p(28), p(29), p(13), p(32), p(16)],
  /**
   * Everything else: sprinkled randomly through the app (reward letters,
   * level intro cards, polaroids along the map). Landing photos are excluded.
   */
  pool: [3, 4, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38].map(p),
};

export const AUDIO = {
  // cutu's voice lines. Add as many as you like — one is picked at random.
  success: ['/audio/success.mp3'], // "awww baby yayyy" / "my pillu is amazing"
  fail: ['/audio/fail.mp3'], // "aiyoo baby youll do great try again"
  // Soft, cute background music for the landing page + map (loops)
  bgm: '/audio/bgm.mp3',
  // Optional: a little "mwah" for every kiss in the get-more-life game
  kiss: '/audio/kiss.mp3',
};

/**
 * Reward-screen music. Each level's reward letter plays its own YouTube Music
 * track (youtubeId in REWARDS below). Browsers sometimes block embedded
 * autoplay — the mini player then shows a play button + an "open in YouTube
 * Music" link. Set type: 'file' and drop /audio/reward<N>.mp3 files to use
 * local audio instead (most reliable).
 */
export const REWARD_MUSIC = {
  type: 'youtube',
  file: (level) => `/audio/reward${level}.mp3`,
};

// One letter + song per level, from cutu to pillu.
export const REWARDS = {
  1: {
    title: 'My Water Hashira',
    youtubeId: 'TqyfmFaZlqw',
    letter:
      'Look at you, slashing through demons like you were born with a Nichirin blade! You know what the real water breathing is? The way you calm me down every single time my mind turns into a storm. Tanjiro protects Nezuko, and you protect me — even from my own overthinking. My strongest Hashira, my softest pillu.',
  },
  2: {
    title: 'You Always Find Your Way to Me',
    youtubeId: 'pUwpLoLlzNQ',
    letter:
      'Jump, jump, jump — and there you are, at the finish line, right where I was waiting. That is so us, pillu. No matter how many obstacles life throws in the way, you just keep hopping over them to get to me. I would wait at the end of every obby in the world for you (and I would cheer the whole time).',
  },
  3: {
    title: 'Chef of My Heart',
    youtubeId: 'BCaIO1yELbQ',
    letter:
      'Biryani AND mango lassi? Marry me immediately. Okay but seriously — you put so much love into everything you make, whether it is food, plans, or little surprises for me. You are the perfect recipe: one part dummy, two parts sweetheart, and a whole lot of masala. Thank you for feeding my tummy and my heart.',
  },
  4: {
    title: 'My Favourite Meeting',
    youtubeId: '5LxzQCZRGFc',
    letter:
      'You dodged every "quick sync" and "circle back" just to get to our date — that is the most romantic thing a man can do in this economy. I am so proud of how hard you work, pillu. But never forget: no meeting, deadline, or LinkedIn post is more important than you. Clock out, come home, I am your favourite calendar invite.',
  },
  5: {
    title: 'Every Memory With You',
    youtubeId: 'cE4atI_v-Z0',
    letter:
      'You matched all our memories! Every photo on those cards is a tiny piece of us — the silly faces, the sleepy calls, the random moments that somehow became my favourite days. I want a million more cards in this deck, pillu. Let us keep making memories so good that this game needs a thousand levels.',
  },
  6: {
    title: 'You Catch All My Love',
    youtubeId: 'kyqJ_FId-_w',
    letter:
      'It is raining hearts and you caught every one — but just so you know, I keep throwing them at you all day, every day. Even on the stormy days, you somehow catch the good and dodge the bad and make everything feel lighter. Thank you for holding my love so carefully, pillu.',
  },
  7: {
    title: 'Written in the Stars',
    youtubeId: 'TlrNxJqODBc',
    letter:
      'P for Pillu, drawn across the whole sky. I genuinely think the universe planned us — out of all the stars and all the people, it connected you and me. When I look up at night I think of you, and when I look at you I see my whole sky. You are my favourite constellation.',
  },
  8: {
    title: 'Our Boba Tower',
    youtubeId: 'f1De87ETXwo',
    letter:
      'Twelve cups high! Just like our love — every day we stack one more layer: a laugh, a fight we fixed, a late-night call, a hug that lasted too long. Some layers are wobbly, but together we always balance it out. You are the pearls in my boba, pillu (the best part, obviously).',
  },
  9: {
    title: 'You Know Me Best',
    youtubeId: 'lyGQD1cH4xI',
    letter:
      'You passed the quiz, which means you really, truly know me — and honestly that is the most special feeling in the world. Being known by you, the weird parts and the soft parts, is my favourite thing. One last level left, pillu. I am waiting for you at the very end. Come find me.',
  },
  10: {
    title: 'You Made It to My Heart',
    youtubeId: '_3ZTDkZ38IY',
    letter: 'You flew all the way to my heart. Of course you did — you have been living there for a long time already.',
  },
};

export const FINALE = {
  heading: 'Happy Boyfriend Day, Pillu',
  youtubeId: '_3ZTDkZ38IY',
  message:
    'My pillu — you beat every single level, just like you beat every hard day with that smile of yours. ' +
    'Thank you for being my best friend, my safe place, my favourite person to annoy, and the softest heart I know. ' +
    'You make ordinary days feel like a celebration, and you make me feel loved in a way I did not know was possible. ' +
    'I am so proud of you, so lucky to have you, and so, so in love with you. ' +
    'Happy Boyfriend Day, my love. Forever and always yours.',
  signature: '— your cutu 💗',
};

// Level 9 — "How well do you know us?" quiz. Replace with real questions!
export const QUIZ = [
  { q: 'Where was our first date?', options: ['Coffee shop', 'The park', 'A movie', 'Dinner'], answer: 0 },
  { q: 'What is my favourite food?', options: ['Biryani', 'Pizza', 'Sushi', 'Pasta'], answer: 0 },
  { q: 'What do I call you the most?', options: ['Pillu', 'Babe', 'Dummy', 'All of these'], answer: 3 },
  { q: 'What is my comfort show?', options: ['Demon Slayer', 'Friends', 'The Office', 'Bridgerton'], answer: 0 },
  { q: 'Who said "I love you" first?', options: ['Me', 'You', 'Same time', 'Still arguing'], answer: 3 },
];
export const QUIZ_PASS_SCORE = 4; // need this many correct to win
