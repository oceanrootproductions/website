import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import ThreeHeroLazy from "../components/ThreeHeroLazy";
import Button from "../components/Button";
import Reveal from "../components/Reveal";
import ProjectCard from "../components/ProjectCard";
import { projects } from "../data/projects";

const marqueeItems = [
  "Virtual Reality",
  "Story-rich XR",
  "Unity",
  "UEFN",
  "Blender pipelines",
  "Gaussian splatting",
  "Photogrammetry",
  "Quest & PCVR",
];

const workflowPillars = [
  {
    title: "Research to realtime",
    badge: "Cutting-edge tech",
    description:
      "We keep an eye on new computer science, then use it where it makes scenes look great and still run smoothly.",
    points: [
      "Custom modeling, triangle splatting, Gaussian splatting, and Google Seurat chosen per scene to keep detail without dropping frames.",
      "Photogrammetry AI tools picked per project to hit quality targets and keep file sizes light.",
      "Simple playbooks help artists and engineers move fast on new captures.",
    ],
  },
  {
    title: "Custom engine integrations",
    badge: "Abstraction layers",
    description:
      "Unity building blocks remove setup work so we can focus on feel, not plumbing.",
    points: [
      "Custom editor tools let us work at high-level abstractions and maximize creativity.",
      "Pre-tuned templates keep Quest and PCVR performance steady.",
      "Quick build and playtest flow, so ideas get in headset in days, not months.",
    ],
  },
  {
    title: "Blender on autopilot",
    badge: "Scene baking tools",
    description:
      "Our custom Blender workflow bakes whole scenes and preps atlases before they ever touch Unity.",
    points: [
      "Texture atlases and light bake presets tuned for VR targets.",
      "Cuts scene development time while keeping quality and comfort high.",
    ],
  },
];

export default function Home() {
  const { hash } = useLocation();

  useEffect(() => {
    if (!hash) return;
    const el = document.getElementById(hash.slice(1));
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [hash]);

  return (
    <div id="top">
      <Hero />
      <Marquee />
      <ProjectsSection />
      <StudioSection />
      <ContactSection />
    </div>
  );
}

function Hero() {
  return (
    <section className="relative">
      <ThreeHeroLazy />

      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-b from-transparent to-ink" />

        <div className="absolute inset-0 flex items-end">
          <div className="mx-auto w-full max-w-6xl px-4 pb-28 sm:pb-32">
            <Reveal className="pointer-events-auto max-w-2xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs uppercase tracking-[0.22em] text-white/70 backdrop-blur">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-aqua" />
                Independent VR · XR studio
              </span>
              <h1 className="mt-6 font-heading text-4xl font-bold leading-[1.05] tracking-tight text-seafoam sm:text-6xl lg:text-7xl">
                We craft{" "}
                <span className="text-gradient">immersive VR worlds.</span>
              </h1>
              <p className="mt-5 max-w-xl text-lg text-white/70 sm:text-xl">
                OceanRoot Productions builds story-rich XR experiences for
                Quest, PCVR, and beyond.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button href="#projects">View projects</Button>
                <Button href="#contact" variant="secondary">
                  Get in touch
                </Button>
              </div>
            </Reveal>
          </div>
        </div>

        <a
          href="#projects"
          className="pointer-events-auto absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 text-white/50 transition-colors hover:text-white/90 sm:flex"
        >
          <span className="text-[10px] uppercase tracking-[0.3em]">Scroll</span>
          <span className="scroll-cue h-8 w-px bg-gradient-to-b from-seafoam/70 to-transparent" />
        </a>
      </div>
    </section>
  );
}

function Marquee() {
  return (
    <div className="relative overflow-hidden border-y border-white/5 bg-abyss/80 py-5">
      <div className="marquee-track flex w-max">
        {[0, 1].map((copy) => (
          <div
            key={copy}
            aria-hidden={copy === 1}
            className="flex shrink-0 items-center"
          >
            {marqueeItems.map((item) => (
              <span
                key={item}
                className="flex items-center text-xs font-semibold uppercase tracking-[0.3em] text-white/40"
              >
                <span className="mx-8">{item}</span>
                <span aria-hidden className="text-aqua/50">
                  ✦
                </span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionHeader({
  index,
  eyebrow,
  title,
  blurb,
}: {
  index: string;
  eyebrow: string;
  title: string;
  blurb?: string;
}) {
  return (
    <Reveal>
      <div className="flex items-baseline gap-4">
        <span className="font-heading text-sm tracking-[0.3em] text-aqua/70">
          {index}
        </span>
        <span className="text-xs uppercase tracking-[0.3em] text-white/50">
          {eyebrow}
        </span>
      </div>
      <h2 className="mt-4 font-heading text-3xl font-bold text-seafoam sm:text-5xl">
        {title}
      </h2>
      {blurb && (
        <p className="mt-4 max-w-2xl text-lg text-white/60">{blurb}</p>
      )}
    </Reveal>
  );
}

function ProjectsSection() {
  return (
    <section id="projects" className="relative scroll-mt-24">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 top-16 h-96 w-96 rounded-full bg-deep-ocean/30 blur-3xl" />
        <div className="absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-aqua/[0.06] blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 py-24 sm:py-32">
        <SectionHeader
          index="01"
          eyebrow="Selected work"
          title="Projects"
          blurb="Games and immersive experiences we've shipped across VR, XR, and the metaverse."
        />
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {projects.map((p, i) => (
            <Reveal
              key={p.id}
              delay={i * 120}
              className={p.featured ? "md:col-span-2" : ""}
            >
              <ProjectCard
                title={p.title}
                cover={p.cover}
                tags={p.tags}
                link={p.link}
                video={p.video}
                featured={p.featured}
                coverPosition={p.coverPosition}
              />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function StudioSection() {
  return (
    <section id="studio" className="relative scroll-mt-24">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-32 top-24 h-96 w-96 rounded-full bg-deep-ocean/30 blur-3xl" />
        <div className="absolute -left-24 bottom-10 h-72 w-72 rounded-full bg-coral-accent/[0.07] blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 py-24 sm:py-32">
        <SectionHeader
          index="02"
          eyebrow="Inside the studio"
          title="Small crew. Engineered to ship."
          blurb="We obsess over our pipeline so polish never has to wait for headcount."
        />

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          <Reveal className="lg:col-span-2">
            <div className="h-full rounded-3xl border border-white/10 bg-white/5 p-8 sm:p-10">
              <p className="text-lg leading-relaxed text-white/80">
                OceanRoot Productions is a small VR studio crafting amazing,
                story-rich XR experiences. We draw inspiration from the ocean's
                calm, focusing on gentle interactivity and evocative
                soundscapes to build worlds that feel alive.
              </p>
              <p className="mt-5 leading-relaxed text-white/60">
                We also obsess over our pipeline. Custom Unity and Blender
                tools, plus careful tech choices, keep us shipping quickly
                without giving up polish. Every system is built to keep the
                crew moving with less rework.
              </p>
            </div>
          </Reveal>

          <Reveal delay={120}>
            <div className="h-full rounded-3xl border border-aqua/20 bg-gradient-to-b from-aqua/10 to-transparent p-8">
              <div className="text-xs uppercase tracking-[0.22em] text-aqua/80">
                Operational focus
              </div>
              <div className="mt-3 font-heading text-2xl text-seafoam">
                Efficiency is our value system
              </div>
              <p className="mt-3 text-sm leading-relaxed text-white/60">
                Faster handoffs, tighter feedback loops, and thoughtful
                automation keep our small crew moving like a much larger team.
              </p>
            </div>
          </Reveal>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-3">
          {workflowPillars.map((pillar, i) => (
            <Reveal key={pillar.title} delay={i * 120}>
              <div className="h-full rounded-3xl border border-white/10 bg-white/5 p-7 transition-colors duration-300 hover:border-aqua/25">
                <span className="inline-flex rounded-full border border-seafoam/25 bg-seafoam/10 px-3 py-1 text-xs font-semibold text-seafoam">
                  {pillar.badge}
                </span>
                <h3 className="mt-4 font-heading text-xl text-seafoam">
                  {pillar.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-white/60">
                  {pillar.description}
                </p>
                <ul className="mt-5 space-y-2.5 text-sm text-white/70">
                  {pillar.points.map((point) => (
                    <li key={point} className="flex gap-2.5">
                      <span
                        aria-hidden
                        className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-aqua/70"
                      />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function ContactSection() {
  return (
    <section id="contact" className="relative scroll-mt-24 overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/2 h-[480px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-deep-ocean/25 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-4xl px-4 py-28 text-center sm:py-36">
        <Reveal>
          <div className="flex items-center justify-center gap-4">
            <span className="font-heading text-sm tracking-[0.3em] text-aqua/70">
              03
            </span>
            <span className="text-xs uppercase tracking-[0.3em] text-white/50">
              Contact
            </span>
          </div>
          <h2 className="mt-5 font-heading text-4xl font-bold leading-tight text-seafoam sm:text-6xl">
            Have a world in mind?
            <br />
            <span className="text-gradient">Let's build it together.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg text-white/60">
            Tell us about your VR project, timeline, and how we can help. We
            reply fast.
          </p>
          <div className="mt-10">
            <a
              href="mailto:admin@oceanrootproductions.com"
              className="inline-flex items-center gap-3 rounded-full bg-seafoam px-6 py-4 text-sm font-semibold text-ink transition-all duration-300 hover:-translate-y-0.5 hover:shadow-glow sm:px-8 sm:text-base"
            >
              admin@oceanrootproductions.com
              <span aria-hidden>↗</span>
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
