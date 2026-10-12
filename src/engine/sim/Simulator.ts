import { instancedArray } from 'three/tsl';
import type { Renderer, StorageBufferNode } from 'three/webgpu';
import type { CompiledFrame } from '../timeline/compile';
import type { PhysicsEffect } from '../types';

export const SIM_MODE = { ease: 0, spring: 1, physics: 2 } as const;
export type SimMode = (typeof SIM_MODE)[keyof typeof SIM_MODE];

/** Live knobs the player sets every frame. Plain numbers; each simulator maps them to its own uniforms. */
export interface SimParams {
  progress: number; // eased 0..1 transition progress
  /** How fast `progress` is advancing, per second of show time. Lets acceleration be derived exactly. */
  rate: number;
  mode: SimMode;
  stagger: number;
  swarm: number;
  gravity: number;
  restitution: number;
  wind: [number, number, number];
  /** Radians the departing / arriving formation is rotated about the vertical axis (hologram spin). */
  spinStart: number;
  spinTarget: number;
  /** 1 while lifting off the launch pad: climb first, then slide into place. */
  launch: number;
}

export const defaultSimParams = (): SimParams => ({
  progress: 1,
  rate: 0,
  mode: SIM_MODE.ease,
  stagger: 0.3,
  swarm: 0.25,
  gravity: 9.8,
  restitution: 0.45,
  wind: [0, 0, 0],
  spinStart: 0,
  spinTarget: 0,
  launch: 0,
});

export type StorageNode = StorageBufferNode<'vec4'>;

/**
 * Every buffer is vec4 so GPU storage alignment and CPU uploads agree:
 *   position xyz_, velocity xyz_, color rgb_, start xyz+delay, target xyz_, startColor rgb_, targetColor rgb_, override (detour xyz_ | physics xyz+weight)
 */
export interface SimBuffers {
  position: StorageNode;
  velocity: StorageNode;
  color: StorageNode;
  start: StorageNode;
  target: StorageNode;
  startColor: StorageNode;
  targetColor: StorageNode;
  /**
   * One buffer, two jobs (WebGPU allows only 8 storage buffers per shader stage):
   * the planned detour (xyz, w = 0) during planned flight, or an external physics pose
   * (xyz, w = blend weight) during a physics moment. The two never overlap in time.
   */
  override: StorageNode;
}

export function createBuffers(count: number): SimBuffers {
  const make = () => instancedArray(count, 'vec4');
  return {
    position: make(),
    velocity: make(),
    color: make(),
    start: make(),
    target: make(),
    startColor: make(),
    targetColor: make(),
    override: make(),
  };
}

/** Copy a stride-3 array into a vec4 storage buffer (optionally filling w) and flag it for upload. */
export function upload(node: StorageNode, src: Float32Array, w?: Float32Array | number) {
  const attribute = node.value;
  const dst = attribute.array as Float32Array;
  const count = dst.length / 4;
  for (let i = 0; i < count; i++) {
    dst[i * 4] = src[i * 3];
    dst[i * 4 + 1] = src[i * 3 + 1];
    dst[i * 4 + 2] = src[i * 3 + 2];
    dst[i * 4 + 3] = typeof w === 'number' ? w : w ? w[i] : 0;
  }
  attribute.needsUpdate = true;
}

/** Load a transition into the buffers shared by both simulators. */
export function uploadFrame(b: SimBuffers, from: CompiledFrame, to: CompiledFrame) {
  upload(b.start, from.positions, to.delays);
  upload(b.target, to.positions);
  upload(b.startColor, from.colors, 1);
  upload(b.targetColor, to.colors, 1);
  upload(b.override, to.detours, 0);
}

export interface Simulator {
  readonly kind: 'gpu' | 'cpu';
  readonly count: number;
  readonly buffers: SimBuffers;
  readonly params: SimParams;
  /** Set where drones come from and go to. `snap` teleports them to the interpolated pose (used on seek). */
  setFrame(from: CompiledFrame, to: CompiledFrame, snap: boolean): void;
  /** Begin a physics effect (initial impulse). */
  kick(effect: PhysicsEffect): void;
  /** xyz+weight per drone from an external physics engine; null clears it. */
  setOverride(data: Float32Array | null): void;
  step(renderer: Renderer, dt: number, time: number): void;
  dispose(): void;
}

/** Ground height drones bounce on during physics moments. */
export const GROUND_Y = 0.34;
/** Lowest a drone may ever be: resting on the pad. Enforced in every flight mode and again when drawing. */
export const FLOOR_Y = 0.3;
/** Shared spring constants so GPU and CPU paths feel the same. */
export const SPRING = { stiffness: 14, damping: 5.5 } as const;
