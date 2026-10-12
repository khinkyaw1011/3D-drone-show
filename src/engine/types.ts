import type { z } from 'zod';
import type {
  cameraShotSchema,
  droneLookSchema,
  flightSchema,
  keyframeSchema,
  physicsSettingsSchema,
  sceneSettingsSchema,
  showSchema,
  transitionSchema,
} from './presets/schema';

export type Vec3 = [number, number, number];

export type DroneLook = z.infer<typeof droneLookSchema>;
export type SceneSettings = z.infer<typeof sceneSettingsSchema>;
export type PhysicsSettings = z.infer<typeof physicsSettingsSchema>;
export type FlightSettings = z.infer<typeof flightSchema>;
export type CameraShot = z.infer<typeof cameraShotSchema>;
export type Transition = z.infer<typeof transitionSchema>;
export type Keyframe = z.infer<typeof keyframeSchema>;
export type Show = z.infer<typeof showSchema>;
export type PhysicsEffect = NonNullable<Transition['effect']>;

/** What every formation source produces. */
export interface FormationData {
  positions: Float32Array; // xyz * count
  colors?: Float32Array; // rgb * count (0..1); undefined = use look palette
  count: number;
  meta: { sourceId: string; label: string; bounds: { min: Vec3; max: Vec3 } };
}

export interface GenerateOptions {
  count: number;
  signal?: AbortSignal;
  /** Bytes of the linked file named by the input's `fileId` (see `formations/files.ts`). */
  file?: ArrayBuffer;
}

/** Plugin interface: register new formation types in `formations/registry.ts`. */
export interface FormationSource<Input = unknown> {
  id: string;
  label: string;
  icon: string; // lucide icon name
  inputSchema: z.ZodType<Input>;
  /** Where `generate` may run. `main` = needs DOM APIs. */
  runsIn: 'worker' | 'main';
  describe(input: Input): string;
  generate(input: Input, opts: GenerateOptions): Promise<FormationData>;
}

export interface QualityTier {
  name: 'low' | 'medium' | 'high';
  maxDrones: number;
  dpr: [number, number];
  reflections: boolean;
  bloomScale: number;
}

export interface Capabilities {
  webgpu: boolean;
  compute: boolean;
  mobile: boolean;
  tier: QualityTier;
}
