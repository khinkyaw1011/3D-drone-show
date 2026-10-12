import gsap from 'gsap';
import { SHOW_VOLUME } from '../formations/fit';
import { hash01 } from '../formations/order';
import type { CompiledFrame } from '../timeline/compile';
import type { PhysicsEffect } from '../types';
import { GROUND_Y, SIM_MODE, SPRING, type Simulator, createBuffers, defaultSimParams, upload } from './Simulator';

const { clamp, interpolate: lerp } = gsap.utils;
const smooth = gsap.parseEase('sine.inOut');

/**
 * WebGL2 fallback: the same motion model as GpuSimulator, integrated in JS and
 * uploaded through the same instanced buffers, so the renderer cannot tell the difference.
 */
export class CpuSimulator implements Simulator {
  readonly kind = 'cpu' as const;
  readonly buffers;
  readonly params = defaultSimParams();
  private override: Float32Array | null = null;
  private pendingSnap = true;

  constructor(readonly count: number) {
    this.buffers = createBuffers(count);
  }

  private get arrays() {
    const b = this.buffers;
    const f = (n: (typeof b)[keyof typeof b]) => n.value.array as Float32Array;
    return {
      P: f(b.position),
      V: f(b.velocity),
      C: f(b.color),
      S: f(b.start),
      T: f(b.target),
      SC: f(b.startColor),
      TC: f(b.targetColor),
    };
  }

  setFrame(from: CompiledFrame, to: CompiledFrame, snap: boolean) {
    const b = this.buffers;
    upload(b.start, from.positions, to.delays);
    upload(b.target, to.positions);
    upload(b.startColor, from.colors, 1);
    upload(b.targetColor, to.colors, 1);
    if (snap) this.pendingSnap = true;
  }

  kick(effect: PhysicsEffect) {
    const { P, V } = this.arrays;
    for (let i = 0; i < this.count; i++) {
      const o = i * 4;
      const j = [hash01(i + 11) - 0.5, hash01(i + 23) - 0.5, hash01(i + 37) - 0.5];
      if (effect === 'burst') {
        const d = [P[o] + j[0] * 0.6, P[o + 1] - 15 + j[1] * 0.6, P[o + 2] + j[2] * 0.6];
        const len = Math.hypot(d[0], d[1], d[2]) || 1;
        const speed = 7 + hash01(i) * 9;
        V[o] = (d[0] / len) * speed;
        V[o + 1] = (d[1] / len) * speed + 4;
        V[o + 2] = (d[2] / len) * speed;
      } else {
        const k = effect === 'wind' ? 2 : 1.2;
        V[o] = j[0] * k;
        V[o + 1] = j[1] * (effect === 'wind' ? 2 : 0.4);
        V[o + 2] = j[2] * k;
      }
    }
  }

  setOverride(data: Float32Array | null) {
    this.override = data;
  }

  step(_renderer: unknown, rawDt: number, time: number) {
    const { P, V, C, S, T, SC, TC } = this.arrays;
    const { progress, mode, stagger, swarm, gravity, restitution, wind, spinStart, spinTarget, launch } = this.params;
    const [cx, , cz] = SHOW_VOLUME.center;
    const rot = [Math.cos(spinStart), Math.sin(spinStart), Math.cos(spinTarget), Math.sin(spinTarget)];
    const from = [0, 0, 0];
    const to = [0, 0, 0];
    const dt = Math.min(Math.max(rawDt, 1e-4), 1 / 20);
    const snap = this.pendingSnap;
    this.pendingSnap = false;

    for (let i = 0; i < this.count; i++) {
      const o = i * 4;
      const local = clamp(0, 1, progress * (1 + stagger) - S[o + 3] * stagger);
      const eased = smooth(local);
      // Cheap per-drone wobble standing in for the GPU noise field.
      const ph = hash01(i) * 6.283 + time * 0.9;
      const noise = [Math.sin(ph), Math.cos(ph * 1.3), Math.sin(ph * 0.7 + 1.7)];

      // Hologram spin: rotate both ends about the vertical axis through the show centre.
      const [sx, sz, tx, tz] = [S[o] - cx, S[o + 2] - cz, T[o] - cx, T[o + 2] - cz];
      from[0] = sx * rot[0] + sz * rot[1] + cx;
      from[1] = S[o + 1];
      from[2] = sz * rot[0] - sx * rot[1] + cz;
      to[0] = tx * rot[2] + tz * rot[3] + cx;
      to[1] = T[o + 1];
      to[2] = tz * rot[2] - tx * rot[3] + cz;
      // Launch: climb first, slide into place after.
      const rise = lerp(eased, smooth(clamp(0, 1, local / 0.72)), launch);
      const slide = lerp(eased, smooth(clamp(0, 1, (local - 0.34) / 0.66)), launch);

      for (let k = 0; k < 3; k++) {
        const a = o + k;
        const pose = lerp(from[k], to[k], k === 1 ? rise : slide);
        if (snap) {
          P[a] = pose;
          V[a] = 0;
        } else if (mode === SIM_MODE.ease) {
          const next = pose + noise[k] * Math.sin(local * Math.PI) * swarm * 1.6;
          V[a] = clamp(-60, 60, (next - P[a]) / dt);
          P[a] = next;
        } else if (mode === SIM_MODE.spring) {
          const goal = local > 0.0001 ? to[k] : from[k];
          V[a] += ((goal - P[a]) * SPRING.stiffness - V[a] * SPRING.damping + noise[k] * swarm * 26) * dt;
          P[a] += V[a] * dt;
        } else {
          V[a] += ((k === 1 ? -gravity : 0) + wind[k] + noise[k] * 2) * dt;
          V[a] *= 1 - dt * 0.25;
          P[a] += V[a] * dt;
        }
        C[a] = lerp(SC[a], TC[a], eased);
      }
      if (mode === SIM_MODE.physics && P[o + 1] < GROUND_Y) {
        P[o + 1] = GROUND_Y;
        V[o] *= 0.7;
        V[o + 1] = Math.abs(V[o + 1]) * restitution;
        V[o + 2] *= 0.7;
      }
      if (this.override && this.override[o + 3] > 0) {
        const w = this.override[o + 3];
        for (let k = 0; k < 3; k++) P[o + k] = lerp(P[o + k], this.override[o + k], w);
      }
      P[o + 3] = 1;
      C[o + 3] = 1;
    }
    this.buffers.position.value.needsUpdate = true;
    this.buffers.velocity.value.needsUpdate = true;
    this.buffers.color.value.needsUpdate = true;
  }

  dispose() {}
}
