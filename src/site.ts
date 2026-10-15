// Central site content & navigation data, recovered from the live kavalo.top build.

export const SITE = {
  title: 'kavalo — Outfitting Small Dogs',
  description:
    'Field notes on the gear a small dog actually needs when you go out: backpacks, strollers, harnesses, water bottles. Every item tested on our own dog first.',
  email: 'hello@kavalo.top',
};

export const NAV = [
  { label: 'Journal', href: '/blog/' },
  { label: 'How we test', href: '/how-we-test/' },
  { label: 'About', href: '/#about' },
  { label: 'Contact', href: 'mailto:hello@kavalo.top' },
];

export const CATEGORIES = [
  { label: 'backpack carrier', slug: 'backpack-carrier' },
  { label: 'carrier', slug: 'carrier' },
  { label: 'harness', slug: 'harness' },
  { label: 'stroller', slug: 'stroller' },
  { label: 'water bottle', slug: 'water-bottle' },
  { label: 'sizing guide', slug: 'sizing-guide' },
];

export const TRUST = [
  { strong: '0', text: 'sponsored placements' },
  { strong: '0', text: 'free products accepted' },
  { text: 'Peanut — 8 lb corgi, 13 in back' },
  { text: 'Every test logged publicly' },
];

export const HERO = {
  title: 'Taking your dog out shouldn’t be a battle.',
  text: 'We test small dog travel gear — backpacks, strollers, harnesses, water bottles — on our own dog, and write up what actually holds up. No product pages copied, no affiliate hype.',
  image: '/images/stroller.webp',
  imageFallback: '/images/stroller.jpg',
  imageAlt: 'Small dog riding in a stroller on a walk',
  caption:
    'Reference photo: a small dog in the kind of stroller we test. Photo: Wikimedia Commons (CC0).',
};

export const STORY = {
  title: 'Why this site exists',
  paras: [
    'After bringing home an 8 lb corgi, we found that half of the "pet travel" gear out there is decorative: stuffy backpacks, strollers that won’t fold, harnesses that pull at the throat. Every mistake we made became a testing list — this site is those field notes.',
    'Two rules only: our own dog will actually use it, and it survives three months. Here’s exactly how we test — the scales, the leak tests, the pull measurements — so you can judge the verdicts yourself instead of taking our word for it.',
  ],
  sig: '— the kavalo owner',
  image: '/images/corgi.webp',
  imageFallback: '/images/corgi.jpg',
  imageAlt: 'A young corgi puppy looking at the camera',
  caption: 'Photo: Wikimedia Commons, CC BY 4.0.',
};

// Curated "start with your problem" block on the journal page.
export const PROBLEMS = [
  {
    label: 'Harnesses',
    href: '/blog/category/harness/',
    title: 'Your dog pulls on walks',
    desc: 'Front-clip and dual-clip harnesses that redirect force instead of fighting it.',
    articles: [
      'Best Breathable Mesh Harness for Hot Summers',
      'PHOEPET No Pull Dog Harness for Night Walks',
    ],
  },
  {
    label: 'Escape-proof',
    href: '/blog/escape-proof-harness-small-dogs/',
    title: 'Your dog backs out and bolts',
    desc: 'Harnesses and carriers with closures that escape artists cannot reverse through.',
    articles: ['Best Escape-Proof Harness for Small Dogs'],
  },
  {
    label: 'Strollers',
    href: '/blog/category/stroller/',
    title: 'Long outings or bad joints',
    desc: 'Strollers and carriers that keep your dog mobile without straining their spine.',
    articles: ['Best Strollers for Two Small Dogs', 'Small Dog Stroller Buying Guide'],
  },
  {
    label: 'Flight carriers',
    href: '/blog/category/carrier/',
    title: 'Flying with your dog',
    desc: 'Airline-approved carriers matched to real under-seat limits, step-by-step.',
    articles: [
      'The Best Airline-Approved Dog Carriers for In-Cabin Travel',
      'How to Fly with a Small Dog in Cabin (Step by Step)',
    ],
  },
  {
    label: 'Water bottles',
    href: '/blog/category/water-bottle/',
    title: 'Your dog won’t drink on walks',
    desc: 'Bottles and bowls that actually work one-handed when you are holding a leash.',
    articles: [
      'Best Dog Water Bottle for Travel and Road Trips',
      'How to Get a Small Dog to Drink on Hot Walks',
    ],
  },
  {
    label: 'Sizing guide',
    href: '/blog/small-dog-gear-sizing-guide/',
    title: 'Don’t know where to start',
    desc: 'Measure your dog once. This guide covers chest, back length, and weight for every category.',
    articles: ['Small Dog Sizing Guide'],
  },
];
