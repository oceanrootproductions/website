/** Extra turn from the visitor dragging the planet, shared by the planet and its moons. */
export type Spin = {
  /** Radians added on top of the planet's own slow rotation. */
  angle: number;
  /** Radians per second left over after a drag, easing back to zero. */
  velocity: number;
  dragging: boolean;
};
