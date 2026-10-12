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
- **Paused means still.** The simulator and the shaders run on the player's show clock, which only advances while playing, and planned routes carry no noise. A paused fleet holds position exactly; only propellers and LED twinkle keep going.
- **Formation movement** (flap, wave, pulse, sway) is a smooth displacement field applied in the vertex shader while a formation holds. Neighbours move together, but it is not part of route planning, so the separation figure does not cover it.

## Product

- `/` is the live show with a control deck (requested), not the scroll-driven hero in the spec. `/studio` is the full editor on the same persisted show.
- Extra routes: `/gallery`, `/guide`, `/about`. Camera views added: spectator, first-person walk, close-up.
- Default playback is 2× because real-speed lift-off takes 20–30 s; "Real time" is one notch away.
- `react-hooks/immutability` is disabled for `src/components/canvas/**`: R3F mutates three.js objects every frame by design.

## Not done / known gaps

- Formation and preset *names* inside shows are data, not translated.
- Checked in headless Chrome during the build: every route in all three locales, WebGPU rendering, live fly-to, fireworks, and that the WebGL2 fallback (`?webgl`) loads without errors. **Not** exercised end to end: video export, Rapier physics moments in motion, the touch joystick, and frame rate on real phones or with 10k+ drones.
- Path planning runs on the main thread (about 0.2–0.4 s for a 1,200-drone show).
- State: every user action goes through `dispatch`, including interface state (`ui.set`). The one exception is `LiveShow`, which mirrors what the player reports (time, capabilities, device ceiling) into the store with `mutate`. Large fleets get fewer planner iterations.
