import { instancedArray } from 'three/tsl';
import type { Renderer, StorageBufferNode } from 'three/webgpu';
import { PAD_Y } from '../formations/fit';
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
  /**
   * 0..1 progress of a colour change on a fleet that is holding position; 1 = none under way.
   * The new colours sweep across the formation drone by drone (see `recolorGate`).
   */
  recolor: number;
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
  recolor: 1,
});

export type StorageNode = StorageBufferNode<'vec4'>;

/**
 * Every buffer is vec4 so GPU storage alignment and CPU uploads agree:
 *   position xyz+ax, velocity xyz+ay, color rgb+az, start xyz+delay, target xyz+carryX, startColor rgb+carryY, targetColor rgb+carryZ, override (detour xyz_ | physics xyz+weight)
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
  // Momentum (xyz) rides in the spare w of target / startColor / targetColor: no storage buffer to spare.
  const carry = (axis: number) => (to.carry ? to.carry.filter((_, i) => i % 3 === axis) : 0);
  upload(b.start, from.positions, to.delays);
  upload(b.target, to.positions, carry(0));
  upload(b.startColor, from.colors, carry(1));
  upload(b.targetColor, to.colors, carry(2));
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
export const GROUND_Y = PAD_Y + 0.04;
/** Lowest a drone may ever be: resting on the pad. Enforced in every flight mode and again when drawing. */
export const FLOOR_Y = PAD_Y;
/** Shared spring constants so GPU and CPU paths feel the same. */
export const SPRING = { stiffness: 14, damping: 5.5 } as const;
/**
 * How quickly an airframe's attitude follows the acceleration asked of it, in seconds (a time
 * constant). A quadcopter cannot change its tilt instantly; without this every drone would snap
 * to its lean angle on the first frame of a flight.
 */
export const ATTITUDE_RESPONSE = 0.28;
/** Fraction of the way attitude moves towards its target in a step of `dt` seconds. */
export const attitudeBlend = (dt: number) => 1 - Math.exp(-dt / ATTITUDE_RESPONSE);

/** Share of a colour sweep each drone spends fading; the rest is the wave travelling across the fleet. */
export const RECOLOR_FADE = 0.3;
/** Seconds a colour sweep takes to cross the whole formation. */
export const RECOLOR_SECONDS = 1.6;
/**
 * How far a drone is through its own colour change when the sweep is at `wave` (both 0..1).
 * `order` is the drone's place in the sweep (0 = first). Implemented again in TSL in GpuSimulator.
 */
export function recolorGate(wave: number, order: number): number {
  const from = order * (1 - RECOLOR_FADE);
  const t = Math.min(1, Math.max(0, (wave - from) / RECOLOR_FADE));
  return t * t * (3 - 2 * t);
}
/**
 * Blend to apply to a drone's current colour this step so that, over the whole sweep, it goes
 * exactly from the colour it had to the new one. Works from the colour buffer alone: there is
 * no storage buffer left to keep the old colours in.
 */
export function recolorShare(now: number, was: number): number {
  if (now >= 1) return 1;
  return Math.min(1, Math.max(0, (now - was) / Math.max(1 - was, 1e-4)));
}
