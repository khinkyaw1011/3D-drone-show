import type { FormationData, FormationSource, GenerateOptions } from '../types';
import { bakedSource } from './sources/baked';
import { imageSource } from './sources/image';
import { glbSource, modelSource } from './sources/model';
import { shapeSource } from './sources/shape';
import { svgSource } from './sources/svg';
import { textSource } from './sources/text';

const sources = new Map<string, FormationSource>();

/** Add a formation type. Future sources ('ai-image', 'voice', ...) only need this call. */
export function registerSource<Input>(source: FormationSource<Input>) {
  sources.set(source.id, source as FormationSource);
}

export function getSource(id: string): FormationSource {
  const source = sources.get(id);
  if (!source) throw new Error(`Unknown formation source "${id}"`);
  return source;
}

export function listSources(): FormationSource[] {
  return [...sources.values()];
}

/** Validate the input against the source's schema, then generate. */
export async function generateFormation(sourceId: string, input: unknown, opts: GenerateOptions): Promise<FormationData> {
  const source = getSource(sourceId);
  return source.generate(source.inputSchema.parse(input), opts);
}

/** Stable cache key for a formation request. */
export function formationKey(sourceId: string, input: unknown, count: number): string {
  return `${sourceId}:${count}:${JSON.stringify(input)}`;
}

registerSource(shapeSource);
registerSource(textSource);
registerSource(imageSource);
registerSource(modelSource);
registerSource(glbSource);
registerSource(svgSource);
registerSource(bakedSource);
