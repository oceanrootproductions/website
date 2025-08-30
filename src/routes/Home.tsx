import ThreeHeroLazy from '../components/ThreeHeroLazy'
import Button from '../components/Button'
import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <div>
      <section>
        <ThreeHeroLazy />
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
        <h1 className="font-heading text-4xl sm:text-6xl tracking-tight text-seafoam">
          We craft immersive VR worlds.
        </h1>
        <p className="mt-4 text-lg sm:text-xl text-white/70 max-w-2xl">
          Ocean Root Productions builds serene, story-rich XR experiences.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button to="/projects" variant="primary">View Projects</Button>
          <Button to="/contact" variant="secondary">Contact Us</Button>
        </div>
        <div className="mt-10 text-sm text-white/60">
          <Link to="/studio" className="hover:text-seafoam/90 underline underline-offset-4">Learn more about the studio</Link>
        </div>
      </section>
    </div>
  )
}
