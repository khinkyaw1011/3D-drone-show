/**
 * Formations made from a file on the visitor's device (a .glb, a large .svg) do not carry the
 * file in the show. Their input holds a `fileId`; the app resolves it to bytes (see
 * `src/lib/files.ts`) and passes them to `generate` as `opts.file`.
 */
export class FileMissingError extends Error {
  constructor(
    readonly fileId: string,
    readonly fileName: string,
    /** `permission`: the browser wants the visitor to allow reading it again. `missing`: moved, deleted, or another device. */
    readonly reason: 'missing' | 'permission' = 'missing',
  ) {
    super(`The file "${fileName}" is not available`);
    this.name = 'FileMissingError';
  }
}

/** The linked file a formation input needs, if any. */
export function linkedFile(input: unknown): { fileId: string; name: string } | null {
  const candidate = input as { fileId?: unknown; name?: unknown } | null;
  if (!candidate || typeof candidate.fileId !== 'string' || !candidate.fileId) return null;
  return { fileId: candidate.fileId, name: typeof candidate.name === 'string' ? candidate.name : 'file' };
}
