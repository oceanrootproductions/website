import { NavLink, Outlet } from 'react-router-dom'

import logo from './assets/icon.jpg'

export default function App() {
  return (
    <div className="min-h-screen flex flex-col bg-ink text-seafoam">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}

function Header() {
  return (
    <header className="sticky top-0 z-40 backdrop-blur bg-ink/70 border-b border-white/5">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
        <NavLink to="/" className="flex items-center gap-3 font-heading text-lg tracking-wide">
          <img src={logo} alt="Ocean Root Productions logo" className="h-8 w-8 rounded" />
          <span className="text-seafoam">Ocean Root</span>
          <span className="text-deep-ocean"> Productions</span>
        </NavLink>
        <nav className="hidden sm:flex gap-6 text-sm">
          <NavLink to="/projects" className={({isActive}) => isActive ? 'text-coral-accent' : 'hover:text-seafoam/80'}>Projects</NavLink>
          <NavLink to="/studio" className={({isActive}) => isActive ? 'text-coral-accent' : 'hover:text-seafoam/80'}>Studio</NavLink>
          <NavLink to="/contact" className={({isActive}) => isActive ? 'text-coral-accent' : 'hover:text-seafoam/80'}>Contact</NavLink>
        </nav>
      </div>
    </header>
  )
}

function Footer() {
  return (
    <footer className="border-t border-white/5">
      <div className="mx-auto max-w-6xl px-4 py-8 text-xs text-white/60 flex flex-col sm:flex-row gap-2 sm:gap-4 items-center justify-between">
        <p>© {new Date().getFullYear()} Ocean Root Productions</p>
        <p>We craft immersive VR worlds.</p>
      </div>
    </footer>
  )
}
