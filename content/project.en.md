Skyloom is a virtual drone light show studio that runs entirely in the browser. You design formations, the app plans how a fleet of quadcopters would fly them, and you watch the result in real time, from the crowd, from the air, or walking underneath.

Nothing is uploaded and there is no account. This page explains what is in the project and how it is built.

## What you can do

| Feature | What it does |
| --- | --- |
| Live show on the home page | A fleet lifts off the launch deck and flies a show. Every control beside it changes the show while it is in the air. |
| Nine built-in shows | Sakura Night, Wings, 日本の夜, Neon Tokyo, Cosmos, Aurora, New Year, Ocean and Gold Gala. |
| Type a formation | Type a word and press Enter. Shape names (heart, galaxy, 桜) become shapes; anything else is written in the sky. |
| Any script | Latin text is extruded into 3D letters. Japanese, Chinese, Korean and Myanmar fly as a flat, evenly spaced sign. |
| Your own files | Pictures (PNG, JPEG, WebP), SVG artwork including line icons, and `.glb` 3D models. |
| Model animation | A model's animation can be posed, or played as a run of formations the fleet flies through. |
| Studio | Timeline, per-formation timing and transitions, camera shots, undo and redo, presets, share links, image and video export. |
| Views | Crowd, walk (first person, with a touch joystick on phones), close-up, front, low, top and orbit. |
| Environment | Meadow, lakeside, city, festival, aurora, deep space and blackout, with stars, fog, fireworks and venue lights. |
| Languages | English, Japanese and Myanmar. |

## The drones

Every drone is a 3D quadcopter, not a point of light: canopy, battery, four arms, motors, two-blade propellers that spin in alternating directions, landing skids and one LED under the hub.

- **Lighting.** By default the whole airframe glows in its colour, which reads well from the crowd. Switch on *Realistic lighting* and the airframe becomes dark carbon lit only by its own lamp, with falloff and shading, and propellers that catch the light.
- **Attitude.** A quadcopter can only accelerate by tilting. Each drone leans by the angle its acceleration demands, and takes a moment to get there.
- **Colour changes** sweep across the formation drone by drone instead of switching all at once.
- **Landing.** A drone on the deck stands on its skids at the right height, whatever size it is drawn at.
- **Paused means paused.** Hover drift and formation movement run on the show clock, so a paused fleet holds still.

## How a show is planned

1. **Sample.** Each formation source turns its input into points, one per drone, coloured from the source.
2. **Fit and space.** Points are scaled into the show volume, then pushed apart until every drone has its safety gap.
3. **Assign.** Each drone gets the nearest free point, then swaps are tried to shorten the total distance flown.
4. **Plan routes.** Timing is stretched until no drone exceeds the top speed or acceleration limit. Routes that pass too close get a detour.
5. **Fly.** The same path function runs on the GPU, on the CPU fallback and in the planner, so what was checked is what you see.

Clicking a formation does not jump the playhead like a video. The fleet re-forms from wherever each drone is right now, carrying its momentum into the new route.

## Your files stay on your device

A web page is never told where a file lives, so Skyloom *links* files instead:

- In Chromium browsers it keeps a handle to the file on disk. Nothing is copied, and the file is read fresh each time.
- In Safari and Firefox it keeps a copy in the browser's IndexedDB, which has no practical size limit.

The show itself stores only a small id and the file's name. If a linked file is moved, deleted, or the show is opened on another device, a ring flies in its place and you are offered a **Locate file** button. After a browser restart Chromium asks you to **Allow** reading the file again; that is the browser's rule, not a fault.

Supported model format: binary `.glb`, including Draco and meshopt compression. Multi-file `.gltf`, FBX and OBJ are not supported; export as `.glb`.

## Technology

| Area | Used |
| --- | --- |
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| 3D | three.js with the WebGPU renderer and TSL shaders, React Three Fiber, drei |
| Simulation | TSL compute shaders over storage buffers; a CPU simulator on WebGL 2 |
| Physics | Rapier, for optional physics moments |
| Timing | GSAP timeline as the show clock |
| State | zustand with immer, zundo for undo, `persist` to localStorage |
| Validation | zod schemas are the source of truth for shows, settings and commands |
| Heavy work | A comlink web worker samples formations, parses models and plans routes |
| Files | File System Access API and IndexedDB through idb-keyval |
| UI | Tailwind CSS v4, shadcn/ui on Radix, lucide icons, sonner |
| Languages | next-intl |
| Fonts | Google Fonts through `next/font`, with a picker for body and headline typefaces |
| Tests | Vitest |

## Design rules the code follows

- **One way to change anything.** Every user action is a typed command through a single dispatcher. Components never write to the store.
- **New formation types are plugins.** A source declares a zod schema and a `generate` function; its settings form is generated from the schema.
- **One source of limits.** Fleet sizes come from one table and adapt to the device; nothing hard-codes a count.
- **Stored state is re-validated on every load**, so a show saved by an older version can never be missing a setting.
- **Libraries first.** Custom code is glue, or something no library does, and each such case is recorded in `DECISIONS.md`.

## Limits worth knowing

- It is a design and visualisation tool, not flight-control software.
- Share links do not carry linked files; the recipient is asked to locate them.
- The fleet is capped by device class (600 to 3,000 drones) and lowered automatically if the frame rate drops.
- Text formations use the fonts installed on your system for scripts outside Latin.
