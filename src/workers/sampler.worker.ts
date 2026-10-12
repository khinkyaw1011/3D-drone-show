import './worker-shim';
import { expose, transfer } from 'comlink';
import { bake } from '@/engine/formations/sources/baked';
import { type GlbOptions, inspectGlb, sampleGlb } from '@/engine/formations/sources/model';
import { generateFormation } from '@/engine/formations/registry';
import { type CompiledShow, compileShow } from '@/engine/timeline/compile';
import type { FormationData, Show } from '@/engine/types';

const running = new Map<number, AbortController>();

const send = (data: FormationData) =>
  transfer(data, [data.positions.buffer, ...(data.colors ? [data.colors.buffer] : [])] as Transferable[]);

const api = {
  /** Generate any registered formation off the main thread. */
  async generate(requestId: number, sourceId: string, input: unknown, count: number, file?: ArrayBuffer): Promise<FormationData> {
    const controller = new AbortController();
    running.set(requestId, controller);
    try {
      return send(await generateFormation(sourceId, input, { count, signal: controller.signal, file }));
    } finally {
      running.delete(requestId);
    }
  },
  /**
   * Assign every drone a target, stretch transitions to the fleet's limits and plan
   * conflict-free routes. This is the heaviest step of an edit, so it happens here and the
   * page keeps rendering while it runs.
   */
  compile(show: Show, formations: FormationData[]): CompiledShow {
    const compiled = compileShow(show, formations);
    const buffers = [compiled.ground, ...compiled.frames].flatMap((f) => [f.positions.buffer, f.colors.buffer, f.delays.buffer, f.detours.buffer]);
    return transfer(compiled, [...new Set(buffers)] as Transferable[]);
  },
  /** Abort a request; takes effect at the generator's next checkpoint. */
  cancel(requestId: number) {
    running.get(requestId)?.abort();
  },
  /** Animation names in a GLB, read once when the file is linked. */
  inspectGlb(buffer: ArrayBuffer) {
    return inspectGlb(buffer);
  },
  /** Sample an uploaded GLB and freeze it into a shareable `baked` input. */
  async bakeGlb(buffer: ArrayBuffer, options: Omit<GlbOptions, 'signal'>) {
    return bake(await sampleGlb(buffer, options), options.label);
  },
};

export type SamplerApi = typeof api;
expose(api);
