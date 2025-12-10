import douglas from "../assets/pictures/douglas.jpg";

export default function Contact() {
  return (
    <div className="relative overflow-hidden z-0 min-h-screen">
      <div className="absolute inset-0 z-0">
        <div
          className="absolute inset-0 bg-center bg-cover scale-105 blur-[2px] brightness-110 saturate-125 opacity-80"
          style={{ backgroundImage: `url(${douglas})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-ink/30 via-ink/45 to-ink/75" />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-14 sm:py-20">
        <h2 className="font-heading text-3xl sm:text-5xl">Contact</h2>
        <p className="mt-3 text-white/70 max-w-2xl">
          Interested in collaborating or commissioning a project? Reach out.
        </p>

        <div className="mt-10">
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-deep-ocean/70 via-ink/65 to-ink/90 p-6 sm:p-8 shadow-soft">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.06),transparent_35%)] pointer-events-none" />
            <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-seafoam/60 via-white/0 to-deep-ocean/40" />

            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.22em] text-white/60">
                  Email us
                </div>
                <div className="mt-1 font-heading text-2xl text-seafoam">
                  oceanrootproductions@gmail.com
                </div>
                <p className="mt-2 text-white/70 max-w-xl">
                  We reply fast. Tell us about your VR project, timeline, and how we can help.
                </p>
              </div>
              <a
                href="mailto:oceanrootproductions@gmail.com"
                className="inline-flex items-center justify-center rounded-full bg-seafoam text-ink font-semibold px-6 py-3 shadow-soft hover:-translate-y-0.5 transition-transform"
              >
                Reach us
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
