import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-20 text-center">
      <h1 className="font-heading text-5xl">404</h1>
      <p className="mt-2 text-white/70">Page not found.</p>
      <Link to="/" className="mt-6 inline-block text-coral-accent hover:underline underline-offset-4">Return home</Link>
    </div>
  )
}

