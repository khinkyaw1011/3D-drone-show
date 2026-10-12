import gsap from 'gsap';
import type { Renderer } from 'three/webgpu';
import { SHOW_VOLUME } from '../formations/fit';
import { SIM_MODE, type Simulator } from '../sim/Simulator';
import { detourWeight, flightPose, localProgress, smooth, spinXZ } from '../sim/path';
import { type Segment, type TimelineCursor, buildTimeline, locate } from '../timeline/buildTimeline';
import { type CompiledFrame, type CompiledShow, planTransition } from '../timeline/compile';
import type { PhysicsEffect, Show } from '../types';

/** Share of a physics transition spent falling/bursting before drones fly back into formation. */
export const PHYSICS_PHASE = 0.55;
const DEG = Math.PI / 180;
/** Live re-forms never take less than this, even for tiny moves. */
const MIN_FLY_SECONDS = 1.2;
const FLY_STAGGER = 0.25;

export interface PhysicsMoment {
  effect: PhysicsEffect;
  active: boolean;
}

export interface PlayerEvents {
  onTime?: (time: number, index: number) => void;
  onPhysics?: (moment: PhysicsMoment) => void;
  onEnd?: () => void;
}

/** A live "fly to this formation from wherever you are" move, outside the show's own timeline. */
interface LiveFlight {
  index: number;
  state: { progress: number };
  tween: gsap.core.Tween;
  spin: number;
  stats: CompiledFrame['stats'];
}

/**
 * Framework-free show playback: a GSAP clock + a simulator. Reusable for headless export.
 *
 * Two ways to move the fleet:
 *  - the timeline (play / scrub): every pose is a function of the playhead, like film;
 *  - `flyTo` (clicking a formation or switching show): the fleet re-forms from its current
 *    positions along freshly planned, conflict-free routes, like a live show changing cue.
 */
export class ShowPlayer {
  private show: Show | null = null;
  private compiled: CompiledShow | null = null;
  private segments: Segment[] = [];
  private clock: ReturnType<typeof buildTimeline>['timeline'] | null = null;
  private index = -1;
  private laps = 0;
  private forceSnap = true;
  private physicsActive: PhysicsEffect | null = null;
  /** The transition currently loaded in the simulator, so the fleet's pose can be reconstructed. */
  private loaded: { from: CompiledFrame; to: CompiledFrame } | null = null;
  private live: LiveFlight | null = null;
  private wantsPlay = false;
  private timeScale = 1;
  duration = 0;
  loop = true;

  constructor(
    readonly sim: Simulator,
    private events: PlayerEvents = {},
  ) {}

  get time() {
    return this.clock?.time() ?? 0;
  }
  get playing() {
    return this.live ? !this.live.tween.paused() : !!this.clock && !this.clock.paused();
  }
  get cursor(): TimelineCursor | null {
    return locate(this.segments, this.time);
  }
  /** Flight statistics of the transition on stage (peak speed in m/s, closest approach in m). */
  get stats() {
    return this.live?.stats ?? this.compiled?.frames[Math.max(this.index, 0)]?.stats ?? null;
  }
  get segmentTimes() {
    return this.segments.map(({ start, transitionEnd, end }) => ({ start, transitionEnd, end }));
  }

  /**
   * Swap in a (re)compiled show. If a fleet is already in the air it flies from where it is
   * into the new show (same show: the formation it was on; another show: its first formation).
   */
  load(show: Show, compiled: CompiledShow) {
    const pose = this.compiled && this.compiled.count === compiled.count ? this.capturePose() : null;
    const sameShow = this.show?.id === show.id;
    const time = this.time;
    const wasPlaying = this.playing || this.wantsPlay;
    const previousIndex = this.live?.index ?? this.index;
    this.endLiveFlight();
    this.clock?.kill();

    this.show = show;
    this.compiled = compiled;
    const built = buildTimeline(
      show.keyframes,
      compiled.frames.map((f) => f.duration),
    );
    this.clock = built.timeline;
    this.segments = built.segments;
    this.duration = built.duration;
    this.clock.timeScale(this.timeScale);
    this.clock.eventCallback('onComplete', () => {
      if (this.loop && this.duration > 0) {
        this.laps++;
        this.clock?.restart();
      } else this.events.onEnd?.();
    });
    this.wantsPlay = wasPlaying;
    this.index = -1;

    const target = sameShow ? Math.min(Math.max(previousIndex, 0), compiled.frames.length - 1) : 0;
    if (pose && compiled.frames[target] && previousIndex >= 0) {
      this.startLiveFlight(pose, target);
      return;
    }
    this.forceSnap = true;
    this.clock.time(sameShow ? Math.min(time, this.duration) : 0);
    if (!sameShow) this.laps = 0;
    if (wasPlaying) this.clock.play();
  }

  /** Adopt settings that do not need a re-plan (look, scene, physics) without disturbing the flight. */
  refresh(show: Show) {
    if (this.show && this.show.id === show.id && this.show.keyframes.length === show.keyframes.length) this.show = show;
  }

  play() {
    this.wantsPlay = true;
    if (this.live) return void this.live.tween.resume();
    if (!this.clock) return;
    if (this.time >= this.duration - 1e-3) this.clock.time(0);
    this.clock.play();
  }
  pause() {
    this.wantsPlay = false;
    this.live?.tween.pause();
    this.clock?.pause();
  }
  /** Scrub like film: drones jump to where the timeline says they are at `t`. */
  seek(t: number) {
    this.endLiveFlight();
    this.clock?.time(Math.min(Math.max(t, 0), this.duration));
    this.forceSnap = true;
    // Rewinding to the very start replays the lift-off from the launch pad.
    if (t <= 0) this.laps = 0;
  }
  /** Move the playhead without teleporting drones: for frame-by-frame export, where the simulation must keep integrating. */
  scrubTo(t: number) {
    this.endLiveFlight();
    this.clock?.pause();
    this.clock?.time(Math.min(Math.max(t, 0), this.duration));
  }
  setTimeScale(scale: number) {
    this.timeScale = scale;
    this.clock?.timeScale(scale);
    this.live?.tween.timeScale(scale);
  }

  /** Re-form into keyframe `index` from the fleet's current positions, then carry on with the show from there. */
  flyTo(index: number) {
    if (!this.compiled?.frames[index]) return;
    this.startLiveFlight(this.capturePose(), index);
  }

  /** Where every drone is right now (and its colour), rebuilt on the CPU from the loaded transition. */
  private capturePose(): CompiledFrame {
    const count = this.sim.count;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const blank = {
      delays: new Float32Array(count),
      detours: new Float32Array(count * 3),
      duration: 0,
      stats: { peakSpeed: 0, minSeparation: 0, conflicts: 0 },
    };
    const loaded = this.loaded;
    if (!loaded) {
      const ground = this.compiled?.ground;
      return ground ? { ...ground, ...blank } : { positions, colors, ...blank };
    }

    const { progress, stagger, spinStart, spinTarget, launch } = this.sim.params;
    const { from, to } = loaded;
    const [cx, , cz] = SHOW_VOLUME.center;
    const a = [0, 0, 0];
    const b = [0, 0, 0];
    const pose = [0, 0, 0];
    for (let i = 0; i < count; i++) {
      const o = i * 3;
      const local = localProgress(progress, stagger, to.delays[i]);
      [a[0], a[2]] = spinXZ(from.positions[o], from.positions[o + 2], cx, cz, spinStart);
      [b[0], b[2]] = spinXZ(to.positions[o], to.positions[o + 2], cx, cz, spinTarget);
      a[1] = from.positions[o + 1];
      b[1] = to.positions[o + 1];
      flightPose(pose, a, b, null, 0, local, launch);
      const bulge = detourWeight(local);
      const eased = smooth(local);
      for (let k = 0; k < 3; k++) {
        positions[o + k] = pose[k] + to.detours[o + k] * bulge;
        colors[o + k] = from.colors[o + k] + (to.colors[o + k] - from.colors[o + k]) * eased;
      }
    }
    return { positions, colors, ...blank };
  }

  private startLiveFlight(pose: CompiledFrame, index: number) {
    const { show, compiled, clock } = this;
    const segment = this.segments[index];
    if (!show || !compiled || !clock || !segment) return;
    this.endLiveFlight();
    this.setPhysics(null);

    const frame = compiled.frames[index];
    const plan = planTransition(pose.positions, frame.positions, frame.delays, show.flight, {
      stagger: FLY_STAGGER,
      launch: false,
      duration: MIN_FLY_SECONDS,
      planned: true,
    });
    const target: CompiledFrame = { ...frame, ...plan };
    this.sim.setFrame(pose, target, false);
    this.loaded = { from: pose, to: target };
    this.index = index;
    this.forceSnap = false;

    // Park the playhead where this formation is fully formed; the show resumes from there.
    clock.pause();
    clock.time(segment.transitionEnd);
    const state = { progress: 0 };
    const tween = gsap.to(state, {
      progress: 1,
      duration: plan.duration,
      ease: 'none', // per-drone easing happens in the simulator
      paused: !this.wantsPlay,
      onComplete: () => {
        this.live = null;
        if (this.wantsPlay) clock.play();
      },
    });
    tween.timeScale(this.timeScale);
    this.live = {
      index,
      state,
      tween,
      spin: show.keyframes[index].spin * DEG * (segment.transitionEnd - segment.start),
      stats: plan.stats,
    };
  }

  private endLiveFlight() {
    this.live?.tween.kill();
    this.live = null;
  }

  private frame(i: number): CompiledFrame {
    const { frames, ground } = this.compiled!;
    if (i >= 0) return frames[i] ?? ground;
    return this.laps > 0 && frames.length > 1 ? frames[frames.length - 1] : ground;
  }

  private setFrame(from: CompiledFrame, to: CompiledFrame, snap: boolean) {
    this.sim.setFrame(from, to, snap);
    this.loaded = { from, to };
  }

  private setPhysics(effect: PhysicsEffect | null) {
    if (effect === this.physicsActive) return;
    if (effect) this.sim.kick(effect);
    this.events.onPhysics?.({ effect: (effect ?? this.physicsActive)!, active: !!effect });
    this.physicsActive = effect;
  }

  /** Advance the simulation one frame. Call from the render loop (or a fixed-step exporter). */
  update(renderer: Renderer, dt: number, elapsed: number) {
    const { sim, show, compiled } = this;
    if (!show || !compiled) return;
    const p = sim.params;
    p.swarm = show.look.swarm;
    p.wind = [0, 0, 0];

    if (this.live) {
      p.mode = SIM_MODE.ease;
      p.progress = this.live.state.progress;
      p.stagger = FLY_STAGGER;
      p.spinStart = 0;
      p.spinTarget = this.live.spin;
      p.launch = 0;
      sim.step(renderer, dt, elapsed);
      this.events.onTime?.(this.time, this.live.index);
      return;
    }

    const cursor = this.cursor;
    if (!cursor) {
      if (this.index !== -2) {
        this.setFrame(compiled.ground, compiled.ground, true);
        this.index = -2;
      }
      p.progress = 1;
      p.mode = SIM_MODE.ease;
      p.spinStart = p.spinTarget = p.launch = 0;
    } else {
      const kf = show.keyframes[cursor.index];
      const segment = this.segments[cursor.index];
      if (cursor.index !== this.index || this.forceSnap) {
        const sequential = cursor.index === this.index + 1 || (cursor.index === 0 && this.index === this.segments.length - 1);
        this.setFrame(this.frame(cursor.index - 1), this.frame(cursor.index), this.forceSnap || !sequential);
        this.index = cursor.index;
        this.forceSnap = false;
        this.setPhysics(null);
      }
      p.stagger = kf.transition.stagger;
      p.progress = cursor.progress;
      // Spin is a pure function of the playhead, so scrubbing stays exact.
      const previous = this.segments[cursor.index - 1] ?? (this.laps > 0 ? this.segments[this.segments.length - 1] : undefined);
      p.spinTarget = kf.spin * DEG * (this.time - segment.start);
      p.spinStart = previous ? show.keyframes[previous.index].spin * DEG * (previous.end - previous.start) : 0;
      p.launch = cursor.index === 0 && this.laps === 0 ? 1 : 0;

      if (segment.kind === 'ease') p.mode = SIM_MODE.ease;
      else if (segment.kind === 'spring') {
        p.mode = SIM_MODE.spring;
        if (kf.transition.curve === 'swarm') p.swarm = Math.min(1, show.look.swarm * 2 + 0.35);
      } else {
        const effect = kf.transition.effect ?? 'drop';
        const falling = !cursor.holding && cursor.linear < PHYSICS_PHASE;
        const { gravity, restitution, windDirection, windStrength } = show.scene.physics;
        this.setPhysics(falling ? effect : null);
        p.mode = falling ? SIM_MODE.physics : SIM_MODE.spring;
        p.progress = falling ? 0 : (cursor.linear - PHYSICS_PHASE) / (1 - PHYSICS_PHASE);
        p.restitution = restitution;
        p.gravity = effect === 'wind' ? gravity * 0.12 : effect === 'burst' ? gravity * 0.55 : gravity;
        if (effect === 'wind') {
          const a = windDirection * DEG;
          p.wind = [Math.sin(a) * windStrength, 0.6, Math.cos(a) * windStrength];
        }
      }
    }
    sim.step(renderer, dt, elapsed);
    this.events.onTime?.(this.time, Math.max(this.index, 0));
  }

  dispose() {
    this.endLiveFlight();
    this.clock?.kill();
    this.sim.dispose();
  }
}
