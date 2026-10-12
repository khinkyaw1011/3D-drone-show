/**
 * Typefaces the visitor can choose between, for the site's two font slots: body text and
 * headings. Each is loaded with `next/font` in the locale layout as the CSS variable
 * `--font-<id>`; the browser only downloads the ones in use. Geist is the default for both.
 * Components never name a typeface: they use the `font-body` / `font-heading` utilities.
 * To add one: load it in the layout and list it here.
 */
export const FONT_CHOICES = {
  body: { 'geist-sans': 'Geist', inter: 'Inter', manrope: 'Manrope', grotesk: 'Space Grotesk' },
  heading: {
    'geist-sans': 'Geist',
    grotesk: 'Space Grotesk',
    'instrument-serif': 'Instrument Serif',
    playfair: 'Playfair Display',
    fraunces: 'Fraunces',
    dmserif: 'DM Serif Display',
  },
} as const;

export type BodyFont = keyof typeof FONT_CHOICES.body;
export type HeadingFont = keyof typeof FONT_CHOICES.heading;
export const DEFAULT_FONTS: { fontBody: BodyFont; fontHeading: HeadingFont } = { fontBody: 'geist-sans', fontHeading: 'geist-sans' };

/** The CSS variables `globals.css` reads the two faces from; unset means the default. */
export const FONT_SLOTS = { fontBody: '--font-body-face', fontHeading: '--font-heading-face' } as const;
