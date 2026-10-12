import './worker-shim';
import { expose, transfer } from 'comlink';
import { bake } from '@/engine/formations/sources/baked';
import { type GlbOptions, sampleGlb } from '@/engine/formations/sources/model';
import { generateFormation } from '@/engine/formations/registry';
import type { FormationData } from '@/engine/types';

const running = new Map<number, AbortController>();

const send = (data: FormationData) =>
  transfer(data, [data.positions.buffer, ...(data.colors ? [data.colors.buffer] : [])] as Transferable[]);

const api = {
  /** Generate any registered formation off the main thread. */
  async generate(requestId: number, sourceId: string, input: unknown, count: number): Promise<FormationData> {
    const controller = new AbortController();
    running.set(requestId, controller);
    try {
      return send(await generateFormation(sourceId, input, { count, signal: controller.signal }));
    } finally {
      running.delete(requestId);
    }
  },
  /** Abort a request; takes effect at the generator's next checkpoint. */
  cancel(requestId: number) {
    running.get(requestId)?.abort();
  },
  /** Sample an uploaded GLB and freeze it into a shareable `baked` input. */
  async bakeGlb(buffer: ArrayBuffer, options: Omit<GlbOptions, 'signal'>) {
    return bake(await sampleGlb(buffer, options), options.label);
  },
};

export type SamplerApi = typeof api;
expose(api);
