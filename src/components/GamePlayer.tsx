import { useEffect, useRef, useState } from "react";

type Props = {
  title: string;
  /** URL of the web build's index.html. */
  src: string;
  cover: string;
  /** Width / height of the game view. */
  aspectRatio?: number;
};

/**
 * itch.io-style player: shows the cover with a Play button, and only loads
 * the build (in an iframe) once the visitor presses it.
 */
export default function GamePlayer({
  title,
  src,
  cover,
  aspectRatio = 16 / 9,
}: Props) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const canFullscreen = document.fullscreenEnabled;

  useEffect(() => {
    const onChange = () =>
      setFullscreen(document.fullscreenElement === frameRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else frameRef.current?.requestFullscreen();
  };

  return (
    <div>
      <div
        ref={frameRef}
        className="relative mx-auto overflow-hidden rounded-2xl border border-white/10 bg-black shadow-soft [&:fullscreen]:rounded-none [&:fullscreen]:border-0"
        // Full width, but never taller than the screen minus the header.
        style={{
          aspectRatio,
          width: `min(100%, calc((100vh - 8rem) * ${aspectRatio}))`,
        }}
      >
        {playing ? (
          <iframe
            src={src}
            title={title}
            className="absolute inset-0 h-full w-full"
            allow="autoplay; fullscreen; gamepad"
            // Give the game keyboard focus without an extra click.
            onLoad={(e) => e.currentTarget.contentWindow?.focus()}
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="group absolute inset-0 flex flex-col items-center justify-center gap-4 text-seafoam focus:outline-none"
          >
            <img
              src={cover}
              alt=""
              className="absolute inset-0 h-full w-full scale-105 object-cover opacity-50 blur-[3px] transition duration-700 ease-out group-hover:scale-110 group-hover:opacity-60"
            />
            <span className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/50 to-ink/30" />
            <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-seafoam text-ink shadow-glow transition-transform duration-300 group-hover:scale-110 group-focus-visible:ring-4 group-focus-visible:ring-aqua/60 sm:h-24 sm:w-24">
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                className="ml-1 h-7 w-7 sm:h-10 sm:w-10"
                fill="currentColor"
              >
                <path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5Z" />
              </svg>
            </span>
            <span className="relative font-heading text-lg font-semibold sm:text-2xl">
              Play {title}
            </span>
            <span className="relative hidden text-xs uppercase tracking-[0.22em] text-white/60 sm:block">
              Free · Runs in your browser
            </span>
          </button>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-white/50">
        <p>
          {playing
            ? "If the game doesn't respond, click inside it."
            : "The game loads when you press Play."}
        </p>
        {canFullscreen ? (
          <button
            type="button"
            onClick={toggleFullscreen}
            disabled={!playing}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-seafoam transition-colors hover:border-white/30 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
            </svg>
            {fullscreen ? "Exit fullscreen" : "Fullscreen"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
