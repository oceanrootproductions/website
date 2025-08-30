export type Project = {
  id: string
  title: string
  cover: string
  tags: string[]
  link?: string
  video?: string
}

import cover1 from '../assets/projects/reef-story.svg'
import cover2 from '../assets/projects/tide-garden.svg'
import cover3 from '../assets/projects/abyss-lullaby.svg'
import cover4 from '../assets/projects/coral-signal.svg'

export const projects: Project[] = [
  {
    id: 'reef-story',
    title: 'Reef Story',
    cover: cover1,
    tags: ['VR', 'Narrative', 'Unity'],
    link: 'https://example.com/reef-story'
  },
  {
    id: 'tide-garden',
    title: 'Tide Garden',
    cover: cover2,
    tags: ['XR', 'Interactive', 'Prototype'],
    link: 'https://example.com/tide-garden'
  },
  {
    id: 'abyss-lullaby',
    title: 'Abyss Lullaby',
    cover: cover3,
    tags: ['Music', 'Immersive', 'WebXR'],
    link: 'https://example.com/abyss-lullaby'
  },
  {
    id: 'coral-signal',
    title: 'Coral Signal',
    cover: cover4,
    tags: ['Research', 'Audio', 'VR'],
    link: 'https://example.com/coral-signal'
  },
]
