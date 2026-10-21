import { useEffect } from "react";
import { Link, Navigate, useParams } from "react-router-dom";

import GamePlayer from "../components/GamePlayer";
import { games, gameBuildUrl } from "../data/games";
import NotFound from "./NotFound";

/** A game's bare address (/clayzics) goes to its play page. */
export function GameHome() {
  const { slug } = useParams();
  return games.some((g) => g.slug === slug) ? (
    <Navigate to="play" replace />
  ) : (
    <NotFound />
  );
}

/** One page template for every game playable on the site: /<slug>/play. */
export default function GamePage() {
  const { slug } = useParams();
  const game = games.find((g) => g.slug === slug);

  useEffect(() => {
    if (!game) return;
    document.title = `Play ${game.title} | OceanRoot Productions`;
    return () => {
      document.title = "OceanRoot Productions";
    };
  }, [game]);

  if (!game) return <NotFound />;

  const unsupported = game.requiresWebGPU && !("gpu" in navigator);

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-deep-ocean/25 via-ink to-ink" />
        <div className="absolute -left-24 -top-32 h-80 w-80 rounded-full bg-coral-accent/10 blur-3xl" />
        <div className="absolute -right-24 top-1/3 h-96 w-96 rounded-full bg-aqua/[0.06] blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-24 sm:pb-28 sm:pt-28">
        <Link
          to={{ pathname: "/", hash: "#projects" }}
          className="inline-flex items-center gap-2 text-sm text-white/50 transition-colors hover:text-seafoam"
        >
          <span aria-hidden>←</span> All projects
        </Link>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-heading text-3xl font-bold text-seafoam sm:text-5xl">
              {game.title}
            </h1>
            <p className="mt-2 max-w-2xl text-white/60 sm:text-lg">
              {game.tagline}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {game.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/70"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-8">
          <GamePlayer
            title={game.title}
            src={gameBuildUrl(game)}
            cover={game.cover}
            aspectRatio={game.aspectRatio}
          />
          {unsupported ? (
            <p className="mt-3 rounded-2xl border border-coral-accent/30 bg-coral-accent/10 px-4 py-3 text-sm text-coral-accent">
              Your browser can't run {game.title} yet, because the game needs
              WebGPU. Try a recent version of Chrome, Edge or Safari.
            </p>
          ) : null}
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          <section className="rounded-3xl border border-white/10 bg-white/5 p-7 sm:p-9 lg:col-span-2">
            <h2 className="font-heading text-xl text-seafoam">About the game</h2>
            <div className="mt-4 space-y-4 leading-relaxed text-white/70">
              {game.description.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>

            {game.howToPlay || game.controls?.length ? (
              <h2 className="mt-8 font-heading text-xl text-seafoam">
                How to play
              </h2>
            ) : null}

            {game.howToPlay ? (
              <>
                {game.howToPlay.intro ? (
                  <p className="mt-4 leading-relaxed text-white/70">
                    {game.howToPlay.intro}
                  </p>
                ) : null}
                <ul className="mt-4 space-y-2.5 text-sm leading-relaxed text-white/70">
                  {game.howToPlay.steps.map((step) => (
                    <li key={step} className="flex gap-2.5">
                      <span
                        aria-hidden
                        className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-aqua/70"
                      />
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}

            {game.controls?.length ? (
              <>
                <h3 className="mt-6 text-xs uppercase tracking-[0.22em] text-white/40">
                  Controls
                </h3>
                <dl className="mt-3 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[max-content_1fr]">
                  {game.controls.map((control) => (
                    <div key={control.action} className="contents">
                      <dt>
                        <kbd className="rounded-md border border-white/15 bg-ink/60 px-2 py-1 font-sans text-xs text-seafoam">
                          {control.input}
                        </kbd>
                      </dt>
                      <dd className="text-white/70">{control.action}</dd>
                    </div>
                  ))}
                </dl>
              </>
            ) : null}
          </section>

          <aside className="rounded-3xl border border-white/10 bg-white/5 p-7">
            <dl className="space-y-4">
              {game.details.map((detail) => (
                <div key={detail.label}>
                  <dt className="text-xs uppercase tracking-[0.22em] text-white/40">
                    {detail.label}
                  </dt>
                  <dd className="mt-1 text-seafoam">{detail.value}</dd>
                </div>
              ))}
            </dl>

            {game.links?.length ? (
              <ul className="mt-6 space-y-2.5 border-t border-white/10 pt-6 text-sm">
                {game.links.map((link) => (
                  <li key={link.href}>
                    {link.href.startsWith("/") ? (
                      <Link
                        to={link.href}
                        className="text-white/60 transition-colors hover:text-seafoam"
                      >
                        {link.label}
                      </Link>
                    ) : (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-white/60 transition-colors hover:text-seafoam"
                      >
                        {link.label} <span aria-hidden>↗</span>
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            ) : null}
          </aside>
        </div>
      </div>
    </div>
  );
}
