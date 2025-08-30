export default function Contact() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
      <h2 className="font-heading text-3xl sm:text-5xl">Contact</h2>
      <p className="mt-3 text-white/70 max-w-2xl">
        Interested in collaborating or commissioning a project? Reach out.
      </p>

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <div className="bg-white/5 border border-white/10 rounded-lg p-6">
          <h3 className="font-heading text-xl">Email</h3>
          <a href="mailto:hello@oceanroot.productions" className="mt-2 block text-coral-accent hover:underline">
            hello@oceanroot.productions
          </a>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-lg p-6">
          <h3 className="font-heading text-xl">Social</h3>
          <ul className="mt-2 space-y-2 text-white/80">
            <li><a className="hover:text-seafoam" href="https://twitter.com/" target="_blank" rel="noreferrer">X / Twitter</a></li>
            <li><a className="hover:text-seafoam" href="https://instagram.com/" target="_blank" rel="noreferrer">Instagram</a></li>
            <li><a className="hover:text-seafoam" href="https://youtube.com/" target="_blank" rel="noreferrer">YouTube</a></li>
          </ul>
        </div>
      </div>
    </div>
  )
}

