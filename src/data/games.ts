export type WebGame = {
  /** The page lives at /<slug>/play; the web build at public/builds/<slug>/index.html. */
  slug: string
  title: string
  tagline: string
  description: string[]
  cover: string
  tags: string[]
  /** Width / height of the game view. Defaults to 16 / 9. */
  aspectRatio?: number
  /** Shows a notice to visitors whose browser has no WebGPU. */
  requiresWebGPU?: boolean
  /** Shows a notice on touch screens, for builds without touch controls. */
  needsKeyboard?: boolean
  /** Wording for experiences that aren't games; the defaults suit a game. */
  actionLabel?: string // the Play button and browser tab title; defaults to "Play <title>"
  aboutHeading?: string // defaults to "About the game"
  howToHeading?: string // defaults to "How to play"
  howToPlay?: { intro?: string; steps: string[] }
  controls?: { input: string; action: string }[]
  details: { label: string; value: string }[]
  links?: { label: string; href: string }[]
}

import coverClayzics from '../assets/pictures/clayzics.jpg'
import coverPeelCathedral from '../assets/pictures/peel-cathedral.jpg'

export const games: WebGame[] = [
  {
    slug: 'peel-cathedral',
    title: 'Peel Cathedral',
    tagline: 'A walk through Peel Cathedral, captured with Gaussian splatting and rendered live in your browser.',
    description: [
      'Historic buildings carry centuries of craft and memory, and they change with every year of weather and use. Digital capture lets us record them as they are today, in enough detail to walk through, study and share with anyone, anywhere.',
      'For this project we scanned Peel Cathedral on the Isle of Man and rebuilt it as a Gaussian splat: a 3D capture of the real building that keeps its light, its stone and its smallest details, from the carved pews to the stained glass. You can walk through it right here, rendered live by the new Gaussian splatting renderer in Ocean Engine, our own engine.',
      'Our sincere thanks to Peel Cathedral for welcoming us and allowing us to carry out the scanning.',
    ],
    cover: coverPeelCathedral,
    tags: ['Gaussian splatting', 'Heritage', 'Ocean Engine'],
    requiresWebGPU: true,
    needsKeyboard: true,
    actionLabel: 'Explore Peel Cathedral',
    aboutHeading: 'About the project',
    howToHeading: 'How to explore',
    howToPlay: {
      intro: 'Take your time: the cathedral is yours to wander.',
      steps: [
        'Click inside the view to look around with your mouse.',
        'Walk with W, A, S and D. Hold Shift to walk faster.',
        'Press Esc to free your mouse again.',
      ],
    },
    controls: [
      { input: 'W A S D', action: 'Walk' },
      { input: 'Mouse', action: 'Look around (click the view first)' },
      { input: 'Shift', action: 'Walk faster' },
      { input: 'Esc', action: 'Free your mouse' },
    ],
    details: [
      { label: 'Type', value: 'Interactive heritage capture' },
      { label: 'Technology', value: 'Gaussian splatting, rendered by Ocean Engine' },
      { label: 'Platform', value: 'Web browser on a computer' },
      { label: 'Controls', value: 'Keyboard and mouse' },
      { label: 'Download', value: 'About 130 MB' },
      { label: 'With thanks to', value: 'Peel Cathedral' },
      { label: 'Developer', value: 'OceanRoot Productions' },
    ],
  },
  {
    slug: 'clayzics',
    title: 'Clayzics!',
    tagline: 'A fast, physics-driven arena battler with squishy clay fighters.',
    description: [
      'Clayzics! is a fast, physics-driven arena battler starring a cast of squishy clay fighters. Pick three cards, drop your fighters onto your half of a floating island, and watch them march on the enemy tower while your opponent does the same.',
      'Nothing is scripted: cannonballs send fighters flying, every punch is a real ragdoll hit, and anyone knocked off the edge of the island is out. Win ranked matches to climb from the Grass Arena through the Ice and Candy Arenas and become the Clay Champion. Earn coins, open packs, and upgrade a roster of boxers, vikings, gladiators, mages, priests, thieves and more.',
    ],
    cover: coverClayzics,
    tags: ['Arena battler', 'Physics', 'Card collecting'],
    requiresWebGPU: true,
    howToPlay: {
      intro:
        "Goal: punch the enemy tower down before they punch yours. Every match is a one-on-one duel between your tower and the opponent's.",
      steps: [
        'Clay fills up over time. Each card costs Clay to deploy.',
        'Pick a card, then click (or tap on mobile) anywhere on your half of the island to deploy that fighter. Your fighters march toward the enemy tower on their own and punch whatever stands in the way.',
        "Your cannon aims and fires by itself, and so does the enemy's. Cannonballs fling fighters, and anyone knocked off the edge of the island is out.",
        'Arena Mode is ranked: a win earns trophies and coins, a loss costs trophies, and your trophy count decides which arena you fight in. Quick Battle is a practice match with nothing at stake.',
        'In Deck Setup, choose up to 3 cards for battle, upgrade them with coins, or open packs for new fighters.',
      ],
    },
    controls: [
      { input: 'Left click', action: 'Pick a card and deploy fighters (desktop).' },
      { input: 'Tap', action: 'The same on phones and tablets. No keyboard needed.' },
    ],
    details: [
      { label: 'Genre', value: 'Arena battler, card collecting' },
      { label: 'Players', value: 'Single-player' },
      { label: 'Platforms', value: 'Web browser, Android' },
      { label: 'Controls', value: 'Mouse or touch' },
      { label: 'Download', value: 'About 60 MB' },
      { label: 'Developer', value: 'OceanRoot Productions' },
    ],
    links: [
      { label: 'Privacy policy', href: '/clayzics/privacy' },
      { label: 'Terms of use', href: '/clayzics/terms' },
    ],
  },
]

export const gameBuildUrl = (game: WebGame) =>
  `${import.meta.env.BASE_URL}builds/${game.slug}/index.html`
