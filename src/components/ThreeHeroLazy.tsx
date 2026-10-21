import { lazy, Suspense } from "react";

import fallbackUrl from "../assets/hero-fallback.svg";
import { isWebGLAvailable } from "../utils/webgl";

// three.js loads in its own chunk, so the headline shows before the 3D scene is ready.
const ThreeHero = lazy(() => import("../three/ThreeHero"));

export default function ThreeHeroLazy() {
  const webgl = typeof window !== "undefined" ? isWebGLAvailable() : false;

  if (!webgl) {
    return (
      <div
        className="ocean-gradient flex items-center justify-center"
        style={{ height: "100svh" }}
      >
        <img
          src={fallbackUrl}
          alt="OceanRoot Reef"
          className="w-full max-w-3xl opacity-90"
        />
      </div>
    );
  }

  return (
    <Suspense fallback={<div className="ocean-gradient" style={{ height: "100svh" }} />}>
      <ThreeHero />
    </Suspense>
  );
}
