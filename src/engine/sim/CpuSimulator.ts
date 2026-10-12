import gsap from 'gsap';
import { carryWeight, detourWeight, flightPose, localProgress, smooth } from './path';
import { SHOW_VOLUME } from '../formations/fit';
import { hash01 } from '../formations/order';
import type { CompiledFrame } from '../timeline/compile';
import type { PhysicsEffect } from '../types';
import { FLOOR_Y, GROUND_Y, SIM_MODE, attitudeBlend, recolorGate, recolorShare, SPRING, type Simulator, createBuffers, defaultSimParams, uploadFrame } from './Simulator';

const { clamp, interpolate: lerp } = gsap.utils;

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
  private lastRecolor = 1;

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
      D: f(b.override),
    };
  }

  setFrame(from: CompiledFrame, to: CompiledFrame, snap: boolean) {
    uploadFrame(this.buffers, from, to);
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
    const { P, V, C, S, T, SC, TC, D } = this.arrays;
    const { progress, rate, mode, stagger, swarm, gravity, restitution, wind, spinStart, spinTarget, launch, recolor } = this.params;
    const recolorWas = this.lastRecolor;
    this.lastRecolor = recolor;
    const [cx, , cz] = SHOW_VOLUME.center;
    const rot = [Math.cos(spinStart), Math.sin(spinStart), Math.cos(spinTarget), Math.sin(spinTarget)];
    const from = [0, 0, 0];
    const to = [0, 0, 0];
    const pose = [0, 0, 0];
    const live = rawDt > 0;
    const coasting = carryWeight(progress);
    const dt = Math.min(Math.max(rawDt, 1e-4), 1 / 20);
    const attitude = attitudeBlend(dt);
    const snap = this.pendingSnap;
    this.pendingSnap = false;

    for (let i = 0; i < this.count; i++) {
      const o = i * 4;
      const local = localProgress(progress, stagger, S[o + 3]);
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
      // Same path function as the GPU and the planner, then the planned detour for this drone.
      flightPose(pose, from, to, null, 0, local, launch);
      const bulge = detourWeight(local);
      // Planned detour, plus the momentum carried into this transition (same terms as the GPU and the planner).
      const carry = [T[o + 3], SC[o + 3], TC[o + 3]];
      for (let k = 0; k < 3; k++) pose[k] += D[o + k] * bulge + carry[k] * coasting;

      // Colour sweep across the formation (see GpuSimulator): 1 when none is under way.
      const order = clamp(0, 1, (P[o] - cx) / SHOW_VOLUME.size[0] + 0.5) * 0.82 + hash01(i + 71) * 0.18;
      const share = snap ? 1 : recolorShare(recolorGate(recolor, order), recolorGate(recolorWas, order));

      // Acceleration rides in the spare w of position / velocity / colour, as on the GPU.
      const accel = [P[o + 3], V[o + 3], C[o + 3]];
      for (let k = 0; k < 3; k++) {
        const a = o + k;
        const before = V[a];
        if (snap) {
          P[a] = pose[k];
          V[a] = 0;
        } else if (mode === SIM_MODE.ease) {
          const next = pose[k]; // planned route: no noise, see GpuSimulator
          V[a] = clamp(-60, 60, (next - P[a]) / Math.max(rawDt, 1e-4)); // over the time that really passed
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
        C[a] += (lerp(SC[a], TC[a], eased) - C[a]) * share;
        if (snap) accel[k] = 0;
        else if (!live) V[a] = before; // paused: nothing accelerates
        else if (mode === SIM_MODE.ease) {
          // Exact acceleration of the planned route (see GpuSimulator).
          const localRate = rate * (1 + stagger);
          const demanded = local > 0.0001 && local < 0.9999 ? clamp(-12, 12, (to[k] - from[k]) * (6 - 12 * local) * localRate * localRate) : 0;
          accel[k] += (demanded - accel[k]) * attitude; // the airframe takes a moment to tilt
        } else accel[k] += (clamp(-12, 12, (V[a] - before) / dt) - accel[k]) * 0.06;
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
      P[o + 1] = Math.max(P[o + 1], FLOOR_Y); // never under the ground
      [P[o + 3], V[o + 3], C[o + 3]] = accel;
    }
    this.buffers.position.value.needsUpdate = true;
    this.buffers.velocity.value.needsUpdate = true;
    this.buffers.color.value.needsUpdate = true;
  }

  dispose() {}
}
