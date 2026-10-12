// Turbopack compiles `typeof window !== 'undefined'` to `true` for every client bundle,
// workers included, so three's `window.__THREE__` check throws in a worker.
// Aliasing `window` to the worker global keeps those branches harmless.
// Must be the first import of the worker entry.
const scope = globalThis as unknown as { window?: unknown };
scope.window ??= globalThis;

export {};
