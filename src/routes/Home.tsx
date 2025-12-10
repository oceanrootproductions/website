import ThreeHeroLazy from "../components/ThreeHeroLazy";
import Button from "../components/Button";
import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div>
      <section className="relative">
        <ThreeHeroLazy />
        <div className="absolute inset-0 flex items-end justify-center pointer-events-none px-4 pb-10">
          <div className="pointer-events-auto w-full max-w-4xl rounded-2xl border border-white/10 bg-ink/60 backdrop-blur-md shadow-soft px-6 py-6 sm:px-10 sm:py-8">
            <h1 className="font-heading text-2xl sm:text-5xl tracking-tight text-seafoam">
              We craft immersive VR worlds.
            </h1>
            <p className="mt-3 sm:mt-4 text-lg sm:text-xl text-white/80 max-w-3xl">
              OceanRoot Productions builds amazing, story-rich XR experiences.
            </p>
            <div className="mt-6 sm:mt-8 flex flex-wrap gap-3">
              <Button to="/projects" variant="primary">
                View Projects
              </Button>
              <Button to="/contact" variant="secondary">
                Contact Us
              </Button>
            </div>
            <div className="mt-6 sm:mt-8 text-sm text-white/70">
              <Link
                to="/studio"
                className="hover:text-seafoam/90 underline underline-offset-4"
              >
                Learn more about the studio
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
