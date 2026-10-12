@AGENTS.md

# Skyloom conventions

Skyloom is a virtual drone-show studio (Next.js App Router, three.js WebGPU/TSL, React Three Fiber). `SPEC` lives in the original brief; `DECISIONS.md` records where and why the build departs from it.

## Commands

- `npm run dev` · `npm run build` · `npm run lint` · `npm run typecheck` · `npm test` (Vitest)
- Run `npm run lint && npm run typecheck && npm test && npm run build` before calling a milestone done.
- npm is the package manager (not pnpm).

## Rules

- **Never reinvent the wheel.** Use the established library first (see the table in `DECISIONS.md`). Custom code is glue, or something no library does; log the reason in `DECISIONS.md`.
- `src/engine/` is pure TypeScript: **no React imports, no `any`**. R3F/Rapier components live in `src/components/canvas/`.
- Import three from `three/webgpu` (class identity matters for node materials). Shaders are TSL only, with TSL's built-in noise.
- **Every user action is a `Command`** through `dispatch` (`src/store/dispatch.ts`). Components never mutate the store; only `dispatch` handlers and runtime mirrors (`LiveShow`) call `mutate`.
- New formation types are a `FormationSource` registered in `engine/formations/registry.ts`. Their settings UI is generated from the zod `inputSchema` by `SchemaForm`; add labels under `Fields.*` / `Options.*` in all three message files.
- All formations go through `toFormation` (fit to the show volume, then the spacing pass). Do not bypass it: drone and LED sizes assume that spacing.
- Persistence only through zustand `persist` (`partialize`, `version`, `migrate`). Undo/redo only through zundo. Timing and easing only through GSAP.
- Schema changes: bump `SHOW_VERSION` / `PERSIST_VERSION`, extend `migrateShow` / `migratePersisted`, add a test. New fields must have a schema default: stored state is re-parsed on every load (`merge` in `src/store/index.ts`), which is what fills them in for shows saved earlier.
- The path function in `engine/sim/path.ts` is implemented three times (TSL in `GpuSimulator`, JS in `CpuSimulator`, and the planner). Change all three together or the pre-flight separation guarantee is void.
- Fleet size limits live in `FLEET` / `TIERS` (`engine/renderer/capabilities.ts`); read them through `useFleetLimits` / `currentFleetLimits`, never hard-code a count.
- The landing deck is a frame (`components/show/QuickControls.tsx`) around small parts in `components/show/deck/` (transport bar, one file per tab, `Chip`); landing page sections are in `components/landing/sections.tsx` (`Section`, `SectionHeading`). Add to those rather than growing the frame.
- Settings controls shared by the landing deck and the studio live in `components/show/settings.tsx`. Add a control there once rather than in each panel.
- Anything that should stop when the show is paused must run on the show clock (`player.motionTime` / the `clock` uniform), not TSL `time`.
- WebGPU allows 8 storage buffers per shader stage; `SimBuffers` is at that limit. Acceleration is packed into the spare `w` of position / velocity / colour.
- In TSL compute functions, anything used both inside an `If` branch and after it must be a `.toVar()` declared before the branch; otherwise it silently reads zero afterwards on WebGPU.
- Step the simulation by `playheadDelta()` (how far the show clock moved), never by frame delta or wall time.
- A new resettable setting must be listed under its feature in `engine/presets/reset.ts`, or its reset button will not see it.
- Firework timing lives in `FIREWORK_SCHEDULE` (`engine/materials/lighting.ts`), shared by the shader and the ground light. Do not move it back into shader-only hashes.
- Files from the visitor's device (models, large SVG) are linked through `src/lib/files.ts` (file handle or IndexedDB copy); a formation input stores only `fileId` + `name` and receives the bytes as `opts.file`. Never put file contents in the show.
- Heavy work (sampling, model parsing) runs in the comlink worker (`src/workers/sampler.worker.ts`). Keep `./worker-shim` as its first import.

## Localisation

- next-intl, locales `en` (default, no prefix), `ja`, `my`. Use `Link`/`useRouter` from `@/i18n/navigation`, never from `next/link` inside `[locale]` routes.
- Every string a user reads comes from `messages/*.json`. `src/__tests__/messages.test.ts` fails if a locale is missing a key or a placeholder.
- Message keys may not contain dots; map values that do with a sanitiser (see `messageKey` in the inspector).
- Format numbers with `formatNumber` (`@/lib/utils`): locale-aware digits differ between Node and browsers for Burmese and break hydration.

## Design

Tokens live in `src/app/globals.css` (`--ink`, `--paper`, `--glow`, `--cyan`). Fonts: use only `font-body` / `font-heading` / `font-mono`; never name a typeface in a component (choices live in `src/lib/fonts.ts`). Dark only. Panels use `.glass`, labels `.eyebrow`, headlines `.display`. Shared controls are in `src/components/controls/fields.tsx`; reuse them rather than styling new inputs.
