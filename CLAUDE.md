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
- WebGPU allows 8 storage buffers per shader stage; `SimBuffers` is at that limit.
- Heavy work (sampling, model parsing) runs in the comlink worker (`src/workers/sampler.worker.ts`). Keep `./worker-shim` as its first import.

## Localisation

- next-intl, locales `en` (default, no prefix), `ja`, `my`. Use `Link`/`useRouter` from `@/i18n/navigation`, never from `next/link` inside `[locale]` routes.
- Every string a user reads comes from `messages/*.json`. `src/__tests__/messages.test.ts` fails if a locale is missing a key or a placeholder.
- Message keys may not contain dots; map values that do with a sanitiser (see `messageKey` in the inspector).
- Format numbers with `formatNumber` (`@/lib/utils`): locale-aware digits differ between Node and browsers for Burmese and break hydration.

## Design

Tokens live in `src/app/globals.css` (`--ink`, `--paper`, `--glow`, `--cyan`). Dark only. Panels use `.glass`, labels `.eyebrow`, headlines `.display`. Shared controls are in `src/components/controls/fields.tsx`; reuse them rather than styling new inputs.
