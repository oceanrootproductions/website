import { Link } from 'react-router-dom'

type ButtonProps = {
  to?: string
  href?: string
  onClick?: () => void
  children: React.ReactNode
  variant?: 'primary' | 'secondary'
  className?: string
}

export default function Button({ to, href, onClick, children, variant = 'primary', className = '' }: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-aqua/60'
  const styles =
    variant === 'primary'
      ? 'bg-seafoam text-ink hover:-translate-y-0.5 hover:shadow-glow'
      : 'border border-white/15 bg-white/5 text-seafoam backdrop-blur hover:border-white/30 hover:bg-white/10'
  const cls = `${base} ${styles} ${className}`

  if (to) return <Link to={to} className={cls}>{children}</Link>
  if (href) {
    const external = /^https?:/i.test(href)
    return (
      <a
        href={href}
        className={cls}
        {...(external ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
      >
        {children}
      </a>
    )
  }
  return <button className={cls} onClick={onClick}>{children}</button>
}
