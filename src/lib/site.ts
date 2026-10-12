/**
 * Site-wide switches read from the environment at build time.
 * `NEXT_PUBLIC_SHOW_PROJECT_PAGE=false` hides the "Project" page and its navigation links;
 * anything else (or leaving it unset) shows them. Restart `next dev` after changing it.
 */
export const SHOW_PROJECT_PAGE = process.env.NEXT_PUBLIC_SHOW_PROJECT_PAGE !== 'false';

/** Airframe glow of the two lighting styles: the whole drone glowing in its colour, or lit mostly by its own lamp. */
export const LIGHTING_GLOW = { glow: 1, realistic: 0.15 } as const;
export type DroneLighting = keyof typeof LIGHTING_GLOW;

/**
 * The lighting style drones start with, from `NEXT_PUBLIC_DRONE_GLOW`:
 * `true` (or unset) = the whole drone glows; `false` = realistic, lit by its own lamp.
 * Order of precedence: what the visitor chose in the settings, then this environment value.
 */
export const DEFAULT_DRONE_LIGHTING: DroneLighting = process.env.NEXT_PUBLIC_DRONE_GLOW === 'false' ? 'realistic' : 'glow';

/** The airframe glow to draw with: the visitor's own setting if they made one, else the site default. */
export const bodyGlowOf = (look: { bodyGlow?: number }) => look.bodyGlow ?? LIGHTING_GLOW[DEFAULT_DRONE_LIGHTING];
