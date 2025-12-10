import ProjectCard from "../components/ProjectCard";
import { projects } from "../data/projects";
import douglas from "../assets/pictures/douglas.jpg";

export default function Projects() {
  return (
    <div className="relative overflow-hidden z-0 min-h-screen">
      <div className="absolute inset-0 z-0">
        <div
          className="absolute inset-0 bg-center bg-cover scale-105 blur-[2px] brightness-110 saturate-125 opacity-75"
          style={{ backgroundImage: `url(${douglas})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-ink/25 via-ink/40 to-ink/75" />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-14 sm:py-20">
        <h2 className="font-heading text-3xl sm:text-5xl">Projects</h2>
        <p className="mt-3 text-white/70 max-w-2xl">
          A selection of our games and VR, XR work.
        </p>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <ProjectCard
              key={p.id}
              title={p.title}
              cover={p.cover}
              tags={p.tags}
              link={p.link}
              video={p.video}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
