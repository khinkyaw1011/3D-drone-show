/**
 * Site-wide switches read from the environment at build time.
 * `NEXT_PUBLIC_SHOW_PROJECT_PAGE=false` hides the "Project" page and its navigation links;
 * anything else (or leaving it unset) shows them. Restart `next dev` after changing it.
 */
export const SHOW_PROJECT_PAGE = process.env.NEXT_PUBLIC_SHOW_PROJECT_PAGE !== 'false';
