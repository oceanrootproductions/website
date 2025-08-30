import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-20 text-center">
      <h1 className="font-heading text-5xl">404</h1>
      <p className="mt-2 text-white/70">Page not found.</p>
      {/* Use the built base URL so this works on GitHub Pages project sites */}
      <a href={import.meta.env.BASE_URL} className="mt-6 inline-block text-deep-ocean hover:underline underline-offset-4">
        Return home
      </a>
    </div>
  )
}
