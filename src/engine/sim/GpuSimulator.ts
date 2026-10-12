import {
  Fn,
  If,
  abs,
  clamp,
  cos,
  float,
  hash,
  instanceIndex,
  max,
  mix,
  mx_noise_vec3,
  normalize,
  sin,
  smoothstep,
  step,
  uniform,
  vec3,
  vec4,
} from 'three/tsl';
import { type Renderer, Vector3 } from 'three/webgpu';
import { SHOW_VOLUME } from '../formations/fit';
import { LAUNCH } from './path';
import type { CompiledFrame } from '../timeline/compile';
import type { PhysicsEffect } from '../types';
import { FLOOR_Y, GROUND_Y, RECOLOR_FADE, SIM_MODE, attitudeBlend, SPRING, type Simulator, type StorageNode, createBuffers, defaultSimParams, uploadFrame } from './Simulator';

const CENTER = vec3(...SHOW_VOLUME.center);
const EFFECT_ID: Record<PhysicsEffect, number> = { drop: 0, burst: 1, wind: 2 };

/** Formation flight on the GPU: TSL compute over storage buffers, no CPU readback. */
export class GpuSimulator implements Simulator {
  readonly kind = 'gpu' as const;
  readonly buffers;
  readonly params = defaultSimParams();

  private u = {
    progress: uniform(1),
    mode: uniform(0),
    stagger: uniform(0.3),
    swarm: uniform(0.25),
    gravity: uniform(9.8),
    restitution: uniform(0.45),
    wind: uniform(new Vector3()),
    dt: uniform(0.016),
    time: uniform(0),
    effect: uniform(0),
    overrideOn: uniform(0),
    /** 1 while show time is advancing, 0 while paused. */
    live: uniform(1),
    rate: uniform(0),
    attitude: uniform(1),
    /** Seconds of show time since the previous step, uncapped. */
    span: uniform(0.016),
    spinStart: uniform(0),
    spinTarget: uniform(0),
    launch: uniform(0),
    /** Colour sweep progress this step and the step before (see `recolorGate`). */
    recolor: uniform(1),
    recolorWas: uniform(1),
  };
  private lastRecolor = 1;
  private updateNode;
  private snapNode;
  private kickNode;
  private pendingSnap = true;
  private pendingKick = false;

  constructor(readonly count: number) {
    const b = (this.buffers = createBuffers(count));
    const u = this.u;

    /** 0..1 per-drone progress: later `delay` => leaves later. */
    const localProgress = (start: ReturnType<StorageNode['element']>) =>
      clamp(u.progress.mul(u.stagger.add(1)).sub(start.w.mul(u.stagger)), 0, 1);

    /** Rotate a point about the vertical axis through the show centre. */
    const spin = (point: ReturnType<StorageNode['element']>, angle: typeof u.spinStart) => {
      const d = point.xyz.sub(CENTER);
      const c = cos(angle);
      const s = sin(angle);
      return vec3(d.x.mul(c).add(d.z.mul(s)), d.y, d.z.mul(c).sub(d.x.mul(s))).add(CENTER);
    };
    /** start -> target for a drone; on launch the climb leads and the sideways slide follows. */
    const flightPath = (from: ReturnType<typeof spin>, to: ReturnType<typeof spin>, local: ReturnType<typeof localProgress>) => {
      const eased = smoothstep(0, 1, local);
      const rise = mix(eased, smoothstep(0, LAUNCH.riseEnd, local), u.launch);
      const slide = mix(eased, smoothstep(LAUNCH.slideStart, 1, local), u.launch);
      return vec3(mix(from.x, to.x, slide), mix(from.y, to.y, rise), mix(from.z, to.z, slide));
    };

    /** Momentum carried into this transition, easing out (see `carryWeight` in path.ts). */
    const coast = () =>
      vec3(b.target.element(instanceIndex).w, b.startColor.element(instanceIndex).w, b.targetColor.element(instanceIndex).w).mul(
        u.progress.mul(float(1).sub(u.progress).pow(3)),
      );

    this.updateNode = Fn(() => {
      const start = b.start.element(instanceIndex);
      // These are used inside the mode branches AND after them. They must be real variables
      // declared up here: an expression first evaluated inside a branch is not reliably
      // available after it in the generated shader (colours and attitude silently read 0).
      const from = spin(start, u.spinStart).toVar();
      const to = spin(b.target.element(instanceIndex), u.spinTarget).toVar();
      const P = b.position.element(instanceIndex).xyz.toVar();
      const V = b.velocity.element(instanceIndex).xyz.toVar();
      // Acceleration rides in the spare w of position / velocity / colour (no storage buffer to spare).
      const before = vec3(V).toVar(); // a copy: `V` is about to change
      const A = vec3(b.position.element(instanceIndex).w, b.velocity.element(instanceIndex).w, b.color.element(instanceIndex).w).toVar();
      const local = localProgress(start).toVar();
      const eased = smoothstep(0, 1, local).toVar();
      const seed = hash(instanceIndex);
      const noise = mx_noise_vec3(P.mul(0.11).add(vec3(u.time.mul(0.22), seed.mul(9), u.time.mul(0.13))));
      const dt = max(u.dt, 0.0001);

      If(u.mode.equal(SIM_MODE.ease), () => {
        // Scrubbable: pose is a pure function of progress, with a noise arc mid-flight.
        // Planned route: exactly the eased path plus its de-conflicting detour. No noise, so the
        // separation worked out before take-off holds and a paused fleet does not jitter.
        const next = flightPath(from, to, local).add(b.override.element(instanceIndex).xyz.mul(sin(local.mul(Math.PI)))).add(coast());
        // Velocity over the time that really passed (not the integration step, which is capped).
        V.assign(clamp(next.sub(P).div(max(u.span, 0.0001)), vec3(-60), vec3(60)));
        P.assign(next);
      })
        .ElseIf(u.mode.equal(SIM_MODE.spring), () => {
          const goal = mix(from, to, step(0.0001, local));
          const acc = goal.sub(P).mul(SPRING.stiffness).sub(V.mul(SPRING.damping)).add(noise.mul(u.swarm).mul(26));
          V.addAssign(acc.mul(dt));
          P.addAssign(V.mul(dt));
        })
        .Else(() => {
          // Ballistic approximation for the drones outside the Rapier subset.
          const acc = vec3(0, u.gravity.negate(), 0).add(u.wind).add(noise.mul(2));
          V.addAssign(acc.mul(dt));
          V.mulAssign(float(1).sub(dt.mul(0.25)));
          P.addAssign(V.mul(dt));
          If(P.y.lessThan(GROUND_Y), () => {
            P.y.assign(GROUND_Y);
            V.assign(vec3(V.x.mul(0.7), abs(V.y).mul(u.restitution), V.z.mul(0.7)));
          });
        });

      const over = b.override.element(instanceIndex);
      const w = over.w.mul(u.overrideOn);
      P.assign(mix(P, over.xyz, w));
      // Whatever the mode, a drone is never under the ground.
      P.y.assign(max(P.y, FLOOR_Y));

      // While the show is paused nothing accelerates: keep velocity and attitude exactly as they were.
      If(u.live.greaterThan(0.5), () => {
        If(u.mode.equal(SIM_MODE.ease), () => {
          // On a planned route acceleration is known exactly: the second derivative of the eased
          // path. No frame-to-frame differencing, so what the drone is asked for is perfectly steady...
          const inFlight = step(0.0001, local).mul(step(local, 0.9999));
          const localRate = u.rate.mul(u.stagger.add(1));
          const demanded = clamp(to.sub(from).mul(float(6).sub(local.mul(12))).mul(localRate).mul(localRate).mul(inFlight), vec3(-12), vec3(12));
          // ...and the airframe takes a moment to tilt to it.
          A.assign(mix(A, demanded, u.attitude));
        }).Else(() => {
          // Integrated flight (spring, physics): estimate it from the change in velocity, heavily smoothed.
          A.assign(mix(A, clamp(V.sub(before).div(dt), vec3(-12), vec3(12)), 0.06));
        });
      }).Else(() => {
        V.assign(before);
      });

      const wanted = mix(b.startColor.element(instanceIndex), b.targetColor.element(instanceIndex), eased).xyz;
      // Colour sweep: new colours travel across the formation, left to right, a drone at a time
      // (`recolorGate` / `recolorShare` in Simulator.ts). With no sweep under way the share is 1.
      const order = clamp(P.x.sub(CENTER.x).div(SHOW_VOLUME.size[0]).add(0.5), 0, 1).mul(0.82).add(hash(instanceIndex.add(71)).mul(0.18));
      const gate = (wave: typeof u.recolor) => smoothstep(0, 1, clamp(wave.sub(order.mul(1 - RECOLOR_FADE)).div(RECOLOR_FADE), 0, 1));
      const now = gate(u.recolor);
      const was = gate(u.recolorWas);
      const share = max(clamp(now.sub(was).div(max(float(1).sub(was), 0.0001)), 0, 1), step(1, now));
      const rgb = mix(b.color.element(instanceIndex).xyz, wanted, share);
      b.position.element(instanceIndex).assign(vec4(P, A.x));
      b.velocity.element(instanceIndex).assign(vec4(V, A.y));
      b.color.element(instanceIndex).assign(vec4(rgb, A.z));
    })().compute(count);

    this.snapNode = Fn(() => {
      const start = b.start.element(instanceIndex);
      const local = localProgress(start);
      const eased = smoothstep(0, 1, local);
      const pose = flightPath(spin(start, u.spinStart), spin(b.target.element(instanceIndex), u.spinTarget), local)
        .add(b.override.element(instanceIndex).xyz.mul(sin(local.mul(Math.PI))))
        .add(coast());
      b.position.element(instanceIndex).assign(vec4(pose, 0));
      b.velocity.element(instanceIndex).assign(vec4(0));
      b.color.element(instanceIndex).assign(vec4(mix(b.startColor.element(instanceIndex), b.targetColor.element(instanceIndex), eased).xyz, 0));
    })().compute(count);

    this.kickNode = Fn(() => {
      const P = b.position.element(instanceIndex).xyz;
      const seed = hash(instanceIndex);
      const jitter = vec3(hash(instanceIndex.add(11)), hash(instanceIndex.add(23)), hash(instanceIndex.add(37))).sub(0.5);
            const V = vec3(0).toVar();
      If(u.effect.equal(EFFECT_ID.burst), () => {
        V.assign(normalize(P.sub(CENTER).add(jitter.mul(0.6))).mul(seed.mul(9).add(7)).add(vec3(0, 4, 0)));
      })
        .ElseIf(u.effect.equal(EFFECT_ID.wind), () => {
          V.assign(jitter.mul(2));
        })
        .Else(() => {
          V.assign(jitter.mul(vec3(1.2, 0.4, 1.2)));
        });
      b.velocity.element(instanceIndex).assign(vec4(V, 0));
    })().compute(count);
  }

  setFrame(from: CompiledFrame, to: CompiledFrame, snap: boolean) {
    uploadFrame(this.buffers, from, to);
    if (snap) this.pendingSnap = true;
  }

  kick(effect: PhysicsEffect) {
    this.u.effect.value = EFFECT_ID[effect];
    this.pendingKick = true;
  }

  setOverride(data: Float32Array | null) {
    this.u.overrideOn.value = data ? 1 : 0;
    if (!data) return;
    const attribute = this.buffers.override.value;
    (attribute.array as Float32Array).set(data);
    attribute.needsUpdate = true;
  }

  step(renderer: Renderer, dt: number, time: number) {
    const { u, params } = this;
    u.progress.value = params.progress;
    u.rate.value = params.rate;
    u.mode.value = params.mode;
    u.stagger.value = params.stagger;
    u.swarm.value = params.swarm;
    u.gravity.value = params.gravity;
    u.restitution.value = params.restitution;
    u.wind.value.set(...params.wind);
    u.spinStart.value = params.spinStart;
    u.spinTarget.value = params.spinTarget;
    u.launch.value = params.launch;
    u.recolorWas.value = this.lastRecolor;
    u.recolor.value = this.lastRecolor = params.recolor;
    u.live.value = dt > 0 ? 1 : 0;
    u.span.value = Math.max(dt, 1e-4);
    u.attitude.value = attitudeBlend(Math.min(dt, 1 / 20));
    u.dt.value = Math.min(Math.max(dt, 1e-4), 1 / 20);
    u.time.value = time;
    if (this.pendingSnap) {
      renderer.compute(this.snapNode);
      this.pendingSnap = false;
    }
    if (this.pendingKick) {
      renderer.compute(this.kickNode);
      this.pendingKick = false;
    }
    renderer.compute(this.updateNode);
  }

  dispose() {
    this.updateNode.dispose();
    this.snapNode.dispose();
    this.kickNode.dispose();
  }
}
