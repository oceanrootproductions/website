type Props = {
  title: string
  cover: string
  tags: string[]
  link?: string
  video?: string
}

export default function ProjectCard({ title, cover, tags, link, video }: Props) {
  return (
    <div className="rounded-lg overflow-hidden bg-white/5 border border-white/10 hover:border-white/20 transition-colors">
      <div className="aspect-video relative bg-black/30">
        {video ? (
          <video className="w-full h-full object-cover" src={video} poster={cover} preload="metadata" playsInline muted loop></video>
        ) : (
          <img src={cover} alt={title} className="w-full h-full object-cover" loading="lazy" />
        )}
        {link && (
          <a href={link} target="_blank" rel="noreferrer noopener" className="absolute inset-0" aria-label={title} />
        )}
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-base">{title}</h3>
          {link && (
            <span className="text-xs text-white/60">↗</span>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {tags.map((t) => (
            <span key={t} className="text-[10px] uppercase tracking-wide bg-white/10 px-2 py-1 rounded">
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

