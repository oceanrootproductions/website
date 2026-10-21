export type Project = {
  id: string
  title: string
  cover: string
  tags: string[]
  link?: string
  video?: string
  /** Featured projects render as a full-width banner card. */
  featured?: boolean
  /** Tailwind object-position class for cropping the cover, e.g. 'object-top' to keep a logo in view. */
  coverPosition?: string
}

import coverBloop from '../assets/pictures/bloop.webp'
import coverClayzics from '../assets/pictures/clayzics.jpg'
import coverFortnite from '../assets/pictures/hauntedmansion.jpeg'
import coverTwisted from '../assets/pictures/twisteddark.jpeg'

export const projects: Project[] = [
  {
    id: 'clayzics',
    title: 'Clayzics!',
    cover: coverClayzics,
    tags: ['Play in browser', 'Arena battler'],
    link: '/clayzics/play',
    coverPosition: 'object-top',
  },
  {
    id: 'bloop',
    title: 'Bloop!',
    cover: coverBloop,
    tags: ['VR', 'Puzzle', 'Meta Quest'],
    link: 'https://www.meta.com/experiences/bloop/1185448207983215/',
  },
  {
    id: 'twisted-dark',
    title: 'Twisted Dark VR',
    cover: coverTwisted,
    tags: ['VR', 'Comic Book', 'Unity'],
    link: 'https://www.twistedcomics.co.uk/twisted-dark-the-beginning/'
  },
  {
    id: 'fortnite-island',
    title: 'Fortnite Island: OceanRoot',
    cover: coverFortnite,
    tags: ['Fortnite', 'UEFN', 'Metaverse'],
    link: 'https://www.fortnite.com/@oceanroot/3918-1398-7925?lang=en-US'
  },
]
