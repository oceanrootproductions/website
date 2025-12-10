import douglas from "../assets/pictures/douglas.jpg";

export default function Studio() {
  const workflowPillars = [
    {
      title: "Research to realtime",
      badge: "Cutting Edge Tech Research",
      description:
        "We keep an eye on new computer science, then use them where they make scenes look great and still run smoothly.",
      points: [
        "Custom modeling, Triangle splatting, Gaussian splatting, and Google Seurat chosen per scene to keep detail without dropping frames.",
        "Photogrammetry AI tools picked per project to hit quality targets and keep file sizes light.",
        "Simple playbooks help artists and engineers move fast on new captures.",
      ],
    },
    {
      title: "Custom Engine Integrations",
      badge: "Abstraction layers",
      description:
        "Unity building blocks remove setup work so we can focus on feel, not plumbing.",
      points: [
        "Custom Editor tools allow us to focus on high level abstractions and maximize creativity.",
        "Pre-tuned templates keep Quest and PCVR performance steady.",
        "Quick build and playtest flow so ideas get in headset in days not months.",
      ],
    },
    {
      title: "Blender on autopilot",
      badge: "Scene baking tools",
      description:
        "Our Custom Blender workflow help's on baking whole scenes and prep atlases before they ever touch Unity.",
      points: [
        "Texture atlases and light bake presets tuned for VR targets.",
        "Cuts scene development time while keeping quality and comfort high.",
      ],
    },
  ];

  return (
    <div className="relative overflow-hidden z-0">
      <div className="absolute inset-0 z-0">
        <div
          className="absolute inset-0 bg-center bg-cover scale-105 blur-[4px] brightness-110 saturate-125 opacity-85"
          style={{ backgroundImage: `url(${douglas})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-ink/15 via-ink/25 to-ink/55" />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-14 sm:py-20">
        <h2 className="font-heading text-3xl sm:text-5xl">Studio</h2>
        <div className="mt-6 grid gap-8 lg:grid-cols-12 items-start">
          <div className="lg:col-span-8">
            <p className="text-white/80 leading-relaxed">
              OceanRoot Productions is a small VR studio crafting amazing,
              story-rich XR experiences. We draw inspiration from the ocean’s
              calm, focusing on gentle interactivity and evocative soundscapes
              to build worlds that feel alive.
            </p>
            <p className="mt-4 text-white/70">
              We also obsess over our pipeline. Custom Unity and Blender tools,
              plus careful tech choices, keep us shipping quickly without giving
              up polish. Every system is built to keep the crew moving with less
              rework.
            </p>
          </div>
          <div className="lg:col-span-4 space-y-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-soft">
              <div className="text-xs uppercase tracking-[0.18em] text-white/60">
                Operational focus
              </div>
              <div className="mt-2 font-heading text-lg text-seafoam">
                Efficiency is our value system
              </div>
              <p className="mt-2 text-sm text-white/70">
                Faster handoffs, tighter feedback loops, and thoughtful
                automation keep our small crew moving like a much larger team.
              </p>
            </div>
          </div>
        </div>

        <h3 className="mt-12 font-heading text-2xl">
          Workflow that keeps us shipping
        </h3>
        <div className="mt-6 relative">
          <div className="absolute left-3 top-0 bottom-0 w-px bg-gradient-to-b from-seafoam/80 via-white/20 to-deep-ocean/60 pointer-events-none" />
          <div className="space-y-6">
            {workflowPillars.map((pillar) => (
              <div key={pillar.title} className="relative pl-10">
                <div className="absolute left-1 top-7 h-3 w-3 rounded-full bg-seafoam shadow-soft" />
                <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6 sm:p-8 shadow-soft">
                  <div className="flex flex-wrap items-center gap-3 text-sm text-white/70">
                    <span className="rounded-full border border-seafoam/30 bg-seafoam/10 text-seafoam px-3 py-1 font-semibold">
                      {pillar.badge}
                    </span>
                    <span className="text-white/60">Workflow pillar</span>
                  </div>
                  <div className="mt-3 font-heading text-xl text-seafoam">
                    {pillar.title}
                  </div>
                  <p className="mt-2 text-white/70">{pillar.description}</p>
                  <ul className="mt-4 space-y-2 text-sm text-white/80">
                    {pillar.points.map((point) => (
                      <li key={point} className="flex items-start gap-2">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-seafoam" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
