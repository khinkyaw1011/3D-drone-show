import type { Renderer } from 'three/webgpu';
import { SIM_MODE, type Simulator } from '../sim/Simulator';
import { type Segment, type TimelineCursor, buildTimeline, locate } from '../timeline/buildTimeline';
import type { CompiledFrame, CompiledShow } from '../timeline/compile';
import type { PhysicsEffect, Show } from '../types';

/** Share of a physics transition spent falling/bursting before drones fly back into formation. */
export const PHYSICS_PHASE = 0.55;

export interface PhysicsMoment {
  effect: PhysicsEffect;
  active: boolean;
}

export interface PlayerEvents {
  onTime?: (time: number, index: number) => void;
  onPhysics?: (moment: PhysicsMoment) => void;
  onEnd?: () => void;
}

/** Framework-free show playback: a GSAP clock + a simulator. Reusable for headless export. */
export class ShowPlayer {
  private show: Show | null = null;
  private compiled: CompiledShow | null = null;
  private segments: Segment[] = [];
  private clock: ReturnType<typeof buildTimeline>['timeline'] | null = null;
  private index = -1;
  private laps = 0;
  private forceSnap = true;
  private physicsActive: PhysicsEffect | null = null;
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
    return !!this.clock && !this.clock.paused();
  }
  get cursor(): TimelineCursor | null {
    return locate(this.segments, this.time);
  }

  /** Swap in a (re)compiled show, keeping the playhead where it was. */
  load(show: Show, compiled: CompiledShow) {
    const time = this.time;
    const wasPlaying = this.playing;
    this.clock?.kill();
    this.show = show;
    this.compiled = compiled;
    const built = buildTimeline(show.keyframes);
    this.clock = built.timeline;
    this.segments = built.segments;
    this.duration = built.duration;
    this.clock.eventCallback('onComplete', () => {
      if (this.loop && this.duration > 0) {
        this.laps++;
        this.clock?.restart();
      } else this.events.onEnd?.();
    });
    this.index = -1;
    this.forceSnap = true;
    this.clock.time(Math.min(time, this.duration));
    if (wasPlaying) this.clock.play();
  }

  play() {
    if (!this.clock) return;
    if (this.time >= this.duration - 1e-3) this.clock.time(0);
    this.clock.play();
  }
  pause() {
    this.clock?.pause();
  }
  seek(t: number) {
    this.clock?.time(Math.min(Math.max(t, 0), this.duration));
    this.forceSnap = true;
  }
  /** Move the playhead without teleporting drones: for frame-by-frame export, where the simulation must keep integrating. */
  scrubTo(t: number) {
    this.clock?.pause();
    this.clock?.time(Math.min(Math.max(t, 0), this.duration));
  }
  seekToKeyframe(index: number, settle = true) {
    const s = this.segments[index];
    if (s) this.seek(settle ? s.transitionEnd : s.start);
  }
  setTimeScale(scale: number) {
    this.clock?.timeScale(scale);
  }

  private frame(i: number): CompiledFrame {
    const { frames, ground } = this.compiled!;
    if (i >= 0) return frames[i] ?? ground;
    return this.laps > 0 && frames.length > 1 ? frames[frames.length - 1] : ground;
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
    const cursor = this.cursor;
    const p = sim.params;
    p.swarm = show.look.swarm;
    p.wind = [0, 0, 0];

    if (!cursor) {
      if (this.index !== -2) {
        sim.setFrame(compiled.ground, compiled.ground, true);
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
        sim.setFrame(this.frame(cursor.index - 1), this.frame(cursor.index), this.forceSnap || !sequential);
        this.index = cursor.index;
        this.forceSnap = false;
        this.setPhysics(null);
      }
      p.stagger = kf.transition.stagger;
      // Spin is a pure function of the playhead, so scrubbing stays exact.
      const previous = this.segments[cursor.index - 1] ?? (this.laps > 0 ? this.segments[this.segments.length - 1] : undefined);
      const toRadians = Math.PI / 180;
      p.spinTarget = kf.spin * toRadians * (this.time - segment.start);
      p.spinStart = previous ? show.keyframes[previous.index].spin * toRadians * (previous.end - previous.start) : 0;
      p.launch = cursor.index === 0 && this.laps === 0 ? 1 : 0;
      p.progress = cursor.progress;
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
          const a = (windDirection * Math.PI) / 180;
          p.wind = [Math.sin(a) * windStrength, 0.6, Math.cos(a) * windStrength];
        }
      }
    }
    sim.step(renderer, dt, elapsed);
    this.events.onTime?.(this.time, Math.max(this.index, 0));
  }

  dispose() {
    this.clock?.kill();
    this.sim.dispose();
  }
}
