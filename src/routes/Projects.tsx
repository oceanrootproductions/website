import ProjectCard from '../components/ProjectCard'
import { projects } from '../data/projects'

export default function Projects() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
      <h2 className="font-heading text-3xl sm:text-5xl">Projects</h2>
      <p className="mt-3 text-white/70 max-w-2xl">
        A selection of our VR and XR work exploring underwater calm and narrative.
      </p>
      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((p) => (
          <ProjectCard key={p.id} title={p.title} cover={p.cover} tags={p.tags} link={p.link} video={p.video} />
        ))}
      </div>
    </div>
  )
}
