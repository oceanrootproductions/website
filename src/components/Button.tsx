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
    'inline-flex items-center rounded-md px-5 py-2.5 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-deep-ocean/50'
  const styles =
    variant === 'primary'
      ? 'bg-deep-ocean text-seafoam hover:bg-[#0d4a74]'
      : 'bg-white/10 text-seafoam hover:bg-white/15'
  const cls = `${base} ${styles} ${className}`

  if (to) return <Link to={to} className={cls}>{children}</Link>
  if (href) return <a href={href} className={cls} target="_blank" rel="noreferrer noopener">{children}</a>
  return <button className={cls} onClick={onClick}>{children}</button>
}
