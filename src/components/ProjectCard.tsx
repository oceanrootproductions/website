type Props = {
  title: string
  cover: string
  tags: string[]
  link?: string
  video?: string
  featured?: boolean
}

export default function ProjectCard({ title, cover, tags, link, video, featured }: Props) {
  const aspect = featured ? 'aspect-[16/10] sm:aspect-[21/8]' : 'aspect-[16/10]'
  const content = (
    <>
      <div className={`${aspect} overflow-hidden bg-black/30`}>
        {video ? (
          <video
            className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
            src={video}
            poster={cover}
            preload="metadata"
            playsInline
            muted
            loop
          />
        ) : (
          <img
            src={cover}
            alt={title}
            className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
            loading="lazy"
          />
        )}
      </div>

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink via-ink/25 to-transparent opacity-90 transition-opacity duration-500 group-hover:opacity-75" />

      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-6 sm:p-7">
        <div>
          <div className="flex flex-wrap gap-2">
            {tags.map((t) => (
              <span
                key={t}
                className="rounded-full border border-white/15 bg-ink/60 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/70 backdrop-blur"
              >
                {t}
              </span>
            ))}
          </div>
          <h3 className="mt-3 font-heading text-2xl font-semibold text-seafoam">
            {title}
          </h3>
        </div>
        {link && (
          <span
            aria-hidden
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/20 bg-ink/50 text-lg text-seafoam backdrop-blur transition-all duration-300 group-hover:bg-seafoam group-hover:text-ink"
          >
            ↗
          </span>
        )}
      </div>
    </>
  )

  const cls =
    'group relative block overflow-hidden rounded-3xl border border-white/10 bg-white/5 transition-all duration-300 hover:border-aqua/30 hover:shadow-glow'

  if (link) {
    return (
      <a href={link} target="_blank" rel="noreferrer noopener" className={cls} aria-label={title}>
        {content}
      </a>
    )
  }
  return <div className={cls}>{content}</div>
}
