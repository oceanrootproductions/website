export default function NotFound() {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-40 text-center">
      <p className="font-heading text-sm tracking-[0.3em] text-aqua/70">404</p>
      <h1 className="mt-4 font-heading text-4xl font-bold text-seafoam sm:text-6xl">
        Lost at sea.
      </h1>
      <p className="mt-4 text-white/60">
        The page you're looking for drifted away.
      </p>
      {/* Use the built base URL so this works on GitHub Pages project sites */}
      <a
        href={import.meta.env.BASE_URL}
        className="mt-8 inline-flex items-center gap-2 rounded-full bg-seafoam px-6 py-3 text-sm font-semibold text-ink transition-all duration-300 hover:-translate-y-0.5 hover:shadow-glow"
      >
        Return home
      </a>
    </div>
  )
}
