import fallbackUrl from "../assets/hero-fallback.svg";
import { isWebGLAvailable } from "../utils/webgl";

import ThreeHero from "../three/ThreeHero";

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

  return <ThreeHero />;
}
