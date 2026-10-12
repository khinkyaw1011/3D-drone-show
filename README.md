# Skyloom — virtual drone show studio

Design a 3D drone light show in the browser: a fleet lifts off from a launch pad, flies at real-world speeds along collision-checked routes, and builds volumetric formations from shapes, words, pictures and 3D models. English, Japanese and Myanmar.

```bash
npm install
npm run dev      # http://localhost:3000
```

## What is in it

| Route | What it is |
|---|---|
| `/` | The live show with a control deck: pick a show, type a shape or word, upload a picture, change colours, fleet size, top speed and separation, switch views |
| `/studio` | Full editor: formation library, sortable timeline, inspector, presets, undo/redo, share link, PNG and video export |
| `/show` | Full-screen viewer for a share link (`#s=…`) or a built-in show (`?p=sakura-night`) |
| `/gallery`, `/guide`, `/about` | Built-in shows, how to use it, how it works |

Prefix any route with `/ja` or `/my` for Japanese or Myanmar.

Also: fireworks behind the show, star and background-brightness controls, per-area and global reset to defaults. Everything you change is saved in this browser (localStorage) and can be undone in the studio.

Views: crowd (spectator), first-person walk (W A S D / arrows, drag to look), close-up, front, low, top, orbit.

## How it works

1. **Formations** come from a plugin registry (`src/engine/formations`): each source turns its input into one point per drone, fitted to the show volume and spaced so neighbours keep a safety gap.
2. **Compiling a show** assigns every drone a target, stretches each transition to the fleet's top speed and plans routes that keep drones apart (`src/engine/timeline`).
3. **Simulation** runs in a TSL compute shader on WebGPU, with a CPU fallback on WebGL2 (`src/engine/sim`). A GSAP timeline is the clock.
4. **Rendering** is one instanced draw for LEDs and one for quadcopter airframes, plus a TSL sky, water reflection and bloom.
5. **Every action is a typed command** (`src/engine/commands`), so the UI, shortcuts and future voice/LLM control share one entry point.

See `DECISIONS.md` for trade-offs and known gaps, `CLAUDE.md` for conventions, `CREDITS.md` for assets.

## Scripts

`npm run lint` · `npm run typecheck` · `npm test` · `npm run build`

Append `?webgl` to a URL to force the WebGL2 fallback.

## Requirements

A browser with WebGPU gives the full experience (up to 20,000 drones). Without it the show runs on WebGL2 with a smaller fleet. Video export needs WebCodecs.
