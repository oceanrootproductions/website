import { useEffect, useLayoutEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigationType } from "react-router-dom";

import logo from "./assets/logo-white.png";

const sectionLinks = [
  { id: "projects", label: "Projects" },
  { id: "studio", label: "Studio" },
  { id: "contact", label: "Contact" },
];

/** Links to a section on the one-page home, from any route. */
function AnchorLink({
  id,
  className,
  children,
}: {
  id: string;
  className?: string;
  children: React.ReactNode;
}) {
  const { pathname } = useLocation();
  if (pathname === "/") {
    return (
      <a href={`#${id}`} className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link to={{ pathname: "/", hash: `#${id}` }} className={className}>
      {children}
    </Link>
  );
}

// Scroll position of each history entry, so Back returns to where you were.
const savedScroll = new Map<string, number>();

/** New pages open at the top, Back and Forward return to where you were, and Home handles #hash links. */
function ScrollManager() {
  const { key, hash } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    const save = () => savedScroll.set(key, window.scrollY);
    window.addEventListener("scroll", save, { passive: true });
    return () => window.removeEventListener("scroll", save);
  }, [key]);

  useLayoutEffect(() => {
    if (navigationType === "POP") {
      const top = savedScroll.get(key);
      if (top !== undefined) window.scrollTo({ top, behavior: "instant" });
    } else if (!hash) {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [key, hash, navigationType]);

  return null;
}

export default function App() {
  return (
    <div className="min-h-screen flex flex-col bg-ink text-seafoam">
      <ScrollManager />
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

function Header() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-b border-white/10 bg-ink/80 backdrop-blur-md"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <AnchorLink id="top" className="flex items-center gap-3">
          <img
            src={logo}
            alt="OceanRoot Productions logo"
            className="h-8 w-auto"
          />
          <span className="whitespace-nowrap font-heading text-lg tracking-wide">
            <span className="font-semibold text-seafoam">OceanRoot</span>{" "}
            <span className="hidden text-white/50 sm:inline">Productions</span>
          </span>
        </AnchorLink>

        <div className="flex items-center gap-8">
          <nav className="hidden items-center gap-8 text-sm md:flex">
            {sectionLinks.map((link) => (
              <AnchorLink
                key={link.id}
                id={link.id}
                className="text-white/70 transition-colors hover:text-seafoam"
              >
                {link.label}
              </AnchorLink>
            ))}
          </nav>
          <AnchorLink
            id="contact"
            className="whitespace-nowrap rounded-full bg-seafoam px-4 py-2 text-sm font-semibold text-ink transition-all duration-300 hover:-translate-y-0.5 hover:shadow-glow"
          >
            Let's talk
          </AnchorLink>
        </div>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-white/5 bg-abyss/60">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <div className="flex items-center gap-3">
            <img
              src={logo}
              alt="OceanRoot Productions logo"
              className="h-8 w-auto"
            />
            <span className="font-heading text-lg">
              <span className="font-semibold text-seafoam">OceanRoot</span>{" "}
              <span className="text-white/50">Productions</span>
            </span>
          </div>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/50">
            An independent game studio with deep tech roots, making games for
            web, Android, Steam and VR.
          </p>
        </div>

        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-white/40">
            Explore
          </div>
          <ul className="mt-4 space-y-2.5 text-sm">
            {sectionLinks.map((link) => (
              <li key={link.id}>
                <AnchorLink
                  id={link.id}
                  className="text-white/60 transition-colors hover:text-seafoam"
                >
                  {link.label}
                </AnchorLink>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-white/40">
            Our games
          </div>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li>
              <Link
                to="/clayzics/privacy"
                className="text-white/60 transition-colors hover:text-seafoam"
              >
                Clayzics! — Privacy
              </Link>
            </li>
            <li>
              <Link
                to="/clayzics/terms"
                className="text-white/60 transition-colors hover:text-seafoam"
              >
                Clayzics! — Terms
              </Link>
            </li>
            <li>
              <Link
                to="/bloop/privacy"
                className="text-white/60 transition-colors hover:text-seafoam"
              >
                Bloop — Privacy
              </Link>
            </li>
            <li>
              <Link
                to="/bloop/terms"
                className="text-white/60 transition-colors hover:text-seafoam"
              >
                Bloop — Terms
              </Link>
            </li>
            <li>
              <Link
                to="/twisteddark/privacy"
                className="text-white/60 transition-colors hover:text-seafoam"
              >
                Twisted Dark — Privacy
              </Link>
            </li>
            <li>
              <Link
                to="/twisteddark/terms"
                className="text-white/60 transition-colors hover:text-seafoam"
              >
                Twisted Dark — Terms
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/5">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-white/40 sm:flex-row">
          <p>© {new Date().getFullYear()} OceanRoot Productions. All rights reserved.</p>
          <p>Games, and the tech behind them.</p>
        </div>
      </div>
    </footer>
  );
}
