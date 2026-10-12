# Decisions

Where the build departs from, or sharpens, the original spec, and why.

## Stack

| Topic | Decision | Why |
|---|---|---|
| Package manager | npm | Requested; the repo was created with npm. |
| Localisation | next-intl, `en` / `ja` / `my`, `localePrefix: 'as-needed'`, `src/proxy.ts` | Requested after the spec. Static per-locale routes via `setRequestLocale`. |
| Stars, bloom | TSL sky shader and three's TSL `bloom` in a `RenderPipeline` | drei `Stars` and `@react-three/postprocessing` are GLSL/EffectComposer and do not run on `WebGPURenderer`. |
| anime.js | not used | All timing goes through GSAP; a second animation engine adds weight only. |
| leva | not used | The inspector covers tuning. |
| `maath` damping | not used in `CpuSimulator` | `easing.damp3` stores hidden state on the object it damps, so it cannot drive flat typed arrays. The CPU path mirrors the GPU spring instead. `maath/random` is used for shells. |

## Engine

- **Realistic flight (added on request).** `show.flight` holds a top speed (m/s) and a minimum separation (m). Compiling a show stretches each transition until the farthest-flying drone obeys the speed limit, then `planPaths` samples the transition, finds drones passing too close (spatial hash) and bends their routes apart with a per-drone mid-flight detour. 1 world unit = 4 m.
  - Guarantee and its limits: checked at sampled instants for *planned* (GSAP-ease) transitions; a pair may dip to 85 % of the planned clearance. Spring, swarm and physics curves are integrated, not planned, so separation is not guaranteed there. Requested separation is capped by what the formation itself provides.
- **Formation spacing.** After fitting, every formation is relaxed until neighbours are at least `fleetSpacing(count)` apart (about 1.1 m at 1,200 drones). Thin shapes swell slightly rather than stack drones. Airframe and LED sizes derive from that spacing, so drones never visually overlap. Drones are still drawn larger than life (a real show drone is ~0.4 m).
- **Live fly-to vs. scrubbing.** Clicking a formation or switching show calls `ShowPlayer.flyTo`: the current pose is rebuilt on the CPU from the loaded transition (the path is a pure function) and new routes are planned from there. Dragging the timeline scrubber is the only thing that snaps like film.
- **Assignment.** Morton sort-and-pair (`@thi.ng/morton`), then local swaps that shorten squared distance (`improveAssignment`). Not globally optimal (Hungarian is O(n³)); the planner covers what remains.
- **One buffer for detours and physics override.** WebGPU's default limit is 8 storage buffers per stage; the two uses never overlap in time.
- **Physics moments.** Rapier drives a capped subset through the override buffer; the rest follow a matching ballistic model in TSL, so 20k drones need no CPU readback.
- **Cursor push** is a shader displacement, not a Rapier collider: bodies are kinematic during formation flight and would not be pushed, and the shader version moves the whole fleet.
- **Text.** Latin text is extruded from three's typeface fonts. Japanese, Burmese and anything else the fonts lack is rasterised with canvas text and sampled (custom code): typeface JSON for CJK would add tens of megabytes. Only bold weights are bundled, so there is no weight option.
- **Uploaded pictures** are downscaled to a small data URL stored in the keyframe (re-sampleable, persisted, shareable). Uploaded `.glb` files are baked to quantised points (`baked` source) because the file itself cannot live in a link.
- **SVG** parses on the main thread (`SVGLoader` needs `DOMParser`).
- **Worker shim.** Turbopack compiles `typeof window` to truthy in workers; `worker-shim.ts` aliases `window` so three's global check does not throw.
- **Fireworks** are stateless: each spark's position is a pure function of time and its index in the vertex shader, so they cost one draw call and no simulation. They are scenery, not drones, and are not part of route planning.
- **Reset to defaults** (`settings.reset`) re-parses the zod schemas with empty input, so defaults are defined in exactly one place.
- **Seeded sampling** so a show regenerates identically on every device.

- **Every drone is a 3D airframe; the LED is a lamp on it.** There is no light-only mode. That makes drawing, not simulation, the limit, so fleet size is capped per device tier in one config (`FLEET` / `TIERS` in `engine/renderer/capabilities.ts`: 600 / 1,500 / 3,000) with a minimum of 100. A frame-rate watchdog lowers the ceiling at runtime (to 60 % of the current fleet) if the device averages under 24 fps. The schema still accepts up to 20,000 so older saved shows load; the count is clamped when flown.
- **Attitude from physics.** A quadcopter can only accelerate by tilting its thrust, so each airframe leans by atan(a / g) in the direction it is accelerating. On planned routes acceleration is the exact second derivative of the eased path (no frame differencing, so the lean is steady); in spring / physics modes it is estimated from velocity and smoothed. It is stored in the spare `w` of the position, velocity and colour buffers. Transitions are also stretched so peak acceleration stays under `MAX_ACCELERATION` (6 m/s²), alongside the top-speed limit.
- **Flap is a hinge, not a bend.** Each wing rotates rigidly about a shoulder axis along the body, in the formation's own frame (so it survives spin), with a quicker downstroke, trailing tips and a reacting body. Rigid rotation preserves neighbour spacing.
- **Drones never go below the ground.** The simulators clamp height in every mode and the draw position is clamped again after formation movement.
- **Ground lighting.** Grass and trees are lit by a shared scene light: the fleet's average colour (falling off with distance from the show, on faces turned towards it) and firework flashes. Burst timing comes from a CPU-side schedule shared with the firework shader, so the flashes are in step; their colour and position are approximated (one light for the whole field). There are no cast shadows.
- **Wind** (direction, strength) bends the grass as a cantilever and sways the trees in the vertex shader, and is the same setting that pushes drones in wind moments.
- **Changing formation without a hitch.** Found by measuring frame-to-frame change from the browser's own compositor frames while clicking shapes. Four separate causes, all fixed:
  - Compiling a show (assignment and route planning) froze the page for 100–200 ms. It now runs in the worker.
  - GSAP's clock and the render loop tick at different points in a frame, so after any hitch the pose advanced by more show time than the simulation step assumed and every drone registered a one-frame burst of speed. The simulation now steps by how far the playhead itself moved (`playheadDelta`).
  - In the compute shader, values first evaluated inside a mode branch (`local`, `eased`, `from`, `to`) read as zero after it, so on WebGPU colours did not blend during flights and acceleration was always zero. They are now `toVar()`s declared before the branches. Any value used both inside and after an `If` in TSL must be.
  - Drone size and glow were applied instantly when a new formation changed the fleet's spacing; they now ease.
- **Momentum.** A fleet re-formed mid-flight keeps each drone's velocity and eases out of it (`carryWeight` in `sim/path.ts`), stored in the spare `w` of the target / startColor / targetColor buffers and included in route planning.
- **Attitude response.** The lean follows demanded acceleration with a 0.28 s time constant; without it every airframe snapped to its tilt on the first frame of a flight.
- **Paused means still.** The simulator and the shaders run on the player's show clock, which only advances while playing, and planned routes carry no noise. A paused fleet holds position exactly; only propellers and LED twinkle keep going.
- **Formation movement** (flap, wave, pulse, sway) is a smooth displacement field applied in the vertex shader while a formation holds. Neighbours move together, but it is not part of route planning, so the separation figure does not cover it.

## Product

- `/` is the live show with a control deck (requested), not the scroll-driven hero in the spec. It scrolls like a normal page: the canvas takes no pointer or wheel input until the visitor chooses "Explore in 3D" (or the Walk view), which pins the stage, locks page scroll and offers Exit / Esc.
- Reset is declarative (`engine/presets/reset.ts`): a table of which show paths each feature owns drives both the reset and the "has this changed?" test that decides whether a reset button is shown.
- Environments are plain `scene.set` patches (`engine/presets/environments.ts`); fireworks are off unless a show or the Festival environment turns them on. `/studio` is the full editor on the same persisted show.
- Extra routes: `/gallery`, `/guide`, `/about`. Camera views added: spectator, first-person walk, close-up.
- Default playback is 2× because real-speed lift-off takes 20–30 s; "Real time" is one notch away.
- `react-hooks/immutability` is disabled for `src/components/canvas/**`: R3F mutates three.js objects every frame by design.

## Not done / known gaps

- Formation and preset *names* inside shows are data, not translated.
- Measured in headless Chrome on the development Mac (frame limit off): 290–320 fps on every page with 800–1,400 drones, the 70k-blade field and fireworks; no horizontal overflow at 390 px or 1440 px; no console errors. That says nothing about phones or integrated GPUs, which were not tested.
- Checked in headless Chrome during the build: every route in all three locales, WebGPU rendering, live fly-to, fireworks, and that the WebGL2 fallback (`?webgl`) loads without errors. **Not** exercised end to end: video export, Rapier physics moments in motion, the touch joystick, and frame rate on real phones or with 10k+ drones.
- Path planning runs on the main thread (about 0.2–0.4 s for a 1,200-drone show).
- State: every user action goes through `dispatch`, including interface state (`ui.set`). The one exception is `LiveShow`, which mirrors what the player reports (time, capabilities, device ceiling) into the store with `mutate`. Large fleets get fewer planner iterations.

## Lighting, colour sweeps and landing

- **Airframes emit nothing.** They used to be tinted 55% with their LED colour, which read as glowing toys. Now the only emitter is the LED lens; the frame is lit by that lamp as a point light (inverse-square falloff, lit only where a surface faces it), plus a little cool sky light scaled by the scene's ambient. Propellers are thin: they pass the lamp's light through and carry a view-dependent glint. Rotor blur is dithered transparency (`alphaHash`), which needs no sorting across thousands of instances.
- **Colour changes sweep across the fleet.** Changing colours on a formation that is holding position used to switch every LED on the same frame. `SimParams.recolor` now drives a left-to-right sweep; each drone fades in its own slot (`recolorGate`). There is no storage buffer left for the old colours, so each step blends the colour buffer towards the new colour by exactly the share that reproduces a clean old-to-new fade (`recolorShare`, unit-tested at several frame rates). It runs on real time, because it is an edit, not part of the show.
- **Show volume raised** (centre 17 m to 20 m) and **landed drones stand on their skids**: the draw-time floor is deck height plus skid length times the airframe scale, so they neither sink into the deck nor hover over it.
- **Built-in shows no longer use the physics burst.** Drones dropping to the ground looked like a crash, which no real show does. The effect is still available in the studio.

## Files from the visitor's device

- **Models and large artwork are linked, not stored in the show.** A web page is never given a file's path, so a link is the file's `FileSystemFileHandle` kept in IndexedDB (`idb-keyval`) where the browser has the File System Access API (Chromium): nothing is copied and the file is read from disk each time. Safari and Firefox have no handles, so there a copy of the file goes in IndexedDB instead. The show (localStorage) holds only `{ fileId, name }`. Everything is in `src/lib/files.ts`.
- **A file that cannot be read never breaks the show.** `useCompiledShow` flies a ring in its place and `MissingFiles` offers the one fix: "Allow" when the browser only wants permission again (it does after every restart), "Locate file" when the file moved, was deleted, or the show came from another device. Re-linking keeps the same id, so every formation using it recovers.
- **`.glb` only**, including Draco- and meshopt-compressed ones (decoder vendored in `public/draco`). `.gltf` with side files, FBX and OBJ are refused with an export hint: multi-file formats cannot be linked as one file. Replaces the old "bake the upload into the show" path for models; `baked` remains for share links.
- **SVG**: fills, and now strokes too (line icons used to produce "no filled shapes"); an "outline only" option; artwork up to 120 KB stays inline so share links still carry it, larger files are linked.
- **Model animation = formations.** `pose` (0..1 through a clip) samples the model with morph targets and skinning applied. "Play as formations" adds six poses as ordinary formations the fleet flies through: that is how a real drone show animates a figure, and it needed no new playback machinery.
- Shows shared by link do not include linked files; the recipient sees the stand-in and the locate prompt.

## Fonts, project page

- **Two font slots, no typeface names in components.** `font-body` (= `font-sans`) and `font-heading` are the only font utilities components use. Both default to Geist. The font picker (`src/lib/fonts.ts`, `FontPicker`) re-points `--font-body-face` / `--font-heading-face` inline on `<html>`; alternatives are loaded with `next/font` and `preload: false`, so they are only downloaded once chosen. Each `next/font` loader must be its own module-scope `const` (a loader call inside an array literal fails the build).
- **`/project` renders `content/project.<locale>.md`** (one file per language) with `react-markdown` + `remark-gfm` (trusted, static content read at build time). `NEXT_PUBLIC_SHOW_PROJECT_PAGE=false` turns the route into a 404 and removes its nav links (`src/lib/site.ts`); it is read at build time.
- **CJK text is flat.** Dense characters are unreadable when split over two depth layers; they are now one layer placed by best-candidate sampling.
- **Landing lifts off by itself** on load, so the "Launch the show" button is gone. It restores the visitor's saved show and settings (new visitors get Wings, `DEFAULT_SHOW_ID`); it no longer applies a preset on load, which used to overwrite their tweaks. the crowd camera now aims below the middle of the show so the launch deck is in frame (higher on tall phone screens, and never below ground when pulled back).
- **The landing header is clear over the hero and gets its backdrop once the page scrolls past it**, so text never slides under bare links.
- **Views are travelled to, not cut to.** A change of view glides from the camera's actual pose (`SHOT_SMOOTH`), including when the walk view hands the camera back; entering the walk view descends to eye level with a GSAP tween. Only the first camera of a page load appears in place. On the landing page the show is centred in the viewport (the sideways lens shift is no longer used there).
- **Page column is `max-w-7xl mx-auto`** for the header, hero text, every landing section, text pages and footer.
- **Drone body lighting has a site default from the environment.** `NEXT_PUBLIC_DRONE_GLOW` (`true` = whole drone glows, `false` = realistic) is read in `src/lib/site.ts`. `look.bodyGlow` is now unset until the visitor chooses (Look > Drone lighting); precedence is the visitor's choice, then the environment. The choice survives switching shows (`preset.apply` carries it, like fleet size). `SHOW_VERSION` 2: v1 always stored `bodyGlow: 1`, which is dropped on migration because it cannot be told from "never touched".
- **Every tweak is remembered.** `persist` stores the show (look, scene, flight, formations), UI preferences and, from `PERSIST_VERSION` 4, the transport preferences `speed` and `loop`. Only the live playhead is not stored.

