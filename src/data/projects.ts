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
import coverFortnite from '../assets/pictures/hauntedmansion.jpeg'

export const projects: Project[] = [
  {
    id: 'twisted-dark',
    title: 'Twisted Dark VR',
    cover: cover1,
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
