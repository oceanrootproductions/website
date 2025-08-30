import avatar1 from '../assets/team/alex.svg'
import avatar2 from '../assets/team/river.svg'
import avatar3 from '../assets/team/sky.svg'

export default function Studio() {
  const team = [
    { name: 'Michel Rento', role: 'Senior Software Engineer', avatar: avatar1 },
    { name: 'Gabriel Rento', role: 'Blender 3D Artist', avatar: avatar2 },
    { name: 'Kenny Diack', role: 'CEO', avatar: avatar3 },
  ]

  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
      <h2 className="font-heading text-3xl sm:text-5xl">Studio</h2>
      <div className="mt-6 grid gap-8 sm:grid-cols-3 items-start">
        <div className="sm:col-span-2">
          <p className="text-white/80 leading-relaxed">
            Ocean Root Productions is a small VR studio crafting serene, story-rich XR experiences. We draw
            inspiration from the ocean’s calm, focusing on gentle interactivity and evocative soundscapes to build
            worlds that feel alive.
          </p>
          <p className="mt-4 text-white/70">
            Our team blends technical art, design, and audio to prototype quickly and iterate thoughtfully. We love
            collaborating with museums, educators, and wellness projects.
          </p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-lg p-4">
          <h3 className="font-heading text-lg">Values</h3>
          <ul className="mt-3 space-y-2 text-sm text-white/70">
            <li>• Calm and clarity in design</li>
            <li>• Sustainable performance budgets</li>
            <li>• Accessible, inclusive experiences</li>
          </ul>
        </div>
      </div>

      <h3 className="mt-12 font-heading text-2xl">Team</h3>
      <div className="mt-6 grid gap-6 sm:grid-cols-3">
        {team.map((t) => (
          <div key={t.name} className="bg-white/5 border border-white/10 rounded-lg p-4 flex items-center gap-4">
            <img src={t.avatar} alt={t.name} className="w-14 h-14 rounded-full object-cover" />
            <div>
              <div className="font-heading">{t.name}</div>
              <div className="text-sm text-white/70">{t.role}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
