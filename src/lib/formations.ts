import { type Remote, transfer, wrap } from 'comlink';
import { formationKey, generateFormation, getSource } from '@/engine/formations/registry';
import { linkedFile } from '@/engine/formations/files';
import type { FormationData } from '@/engine/types';
import { linkedFilesVersion, readLinkedFile } from '@/lib/files';
import type { SamplerApi } from '@/workers/sampler.worker';

let remote: Remote<SamplerApi> | null = null;
let nextRequestId = 1;

/** Lazily start the sampling worker (browser only). */
export function sampler(): Remote<SamplerApi> {
  if (!remote) {
    remote = wrap<SamplerApi>(new Worker(new URL('../workers/sampler.worker.ts', import.meta.url), { type: 'module' }));
  }
  return remote;
}

const CACHE_LIMIT = 48;
const cache = new Map<string, Promise<FormationData>>();

/**
 * Formation for (source, input, count), cached. Runs in the worker unless the source
 * needs the DOM. Aborting stops waiting immediately and cancels the worker job at its next checkpoint.
 */
export function requestFormation(sourceId: string, input: unknown, count: number, signal?: AbortSignal): Promise<FormationData> {
  const link = linkedFile(input);
  // A linked file read again after being re-located must not hit the entry cached from before.
  const key = formationKey(sourceId, input, count) + (link ? `@${linkedFilesVersion()}` : '');
  let entry = cache.get(key);
  if (entry) {
    // Refresh recency.
    cache.delete(key);
    cache.set(key, entry);
  } else {
    const requestId = nextRequestId++;
    const onMain = getSource(sourceId).runsIn === 'main';
    entry = (link ? readLinkedFile(link.fileId, link.name) : Promise.resolve(undefined)).then((file) =>
      onMain
        ? generateFormation(sourceId, input, { count, signal, file })
        : file
          ? sampler().generate(requestId, sourceId, input, count, transfer(file, [file]))
          : sampler().generate(requestId, sourceId, input, count),
    );
    signal?.addEventListener('abort', () => void remote?.cancel(requestId), { once: true });
    entry.catch(() => cache.delete(key)); // never cache failures
    cache.set(key, entry);
    if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value!);
  }
  if (!signal) return entry;
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(new DOMException('Aborted', 'AbortError'));
    if (signal.aborted) return onAbort();
    signal.addEventListener('abort', onAbort, { once: true });
    entry.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
  });
}

export const isAbort = (error: unknown) => error instanceof DOMException && error.name === 'AbortError';
