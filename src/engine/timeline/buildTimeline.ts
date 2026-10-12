import gsap from 'gsap';
import { SIM_CURVES } from '../presets/schema';
import type { Keyframe } from '../types';

export type CurveKind = 'ease' | 'spring' | 'physics';

export interface Segment {
  index: number;
  start: number; // transition begins
  transitionEnd: number; // hold begins
  end: number;
  kind: CurveKind;
  ease: (t: number) => number;
}

export interface TimelineCursor {
  index: number;
  /** Eased 0..1 progress of the keyframe's transition (1 during the hold). */
  progress: number;
  /** Linear 0..1 progress of the transition. */
  linear: number;
  holding: boolean;
}

export function curveKind(curve: string): CurveKind {
  if (curve === 'physics') return 'physics';
  return (SIM_CURVES as readonly string[]).includes(curve) ? 'spring' : 'ease';
}

/** Lay keyframes out on the clock. Easing always comes from GSAP's ease parser. */
export function planSegments(keyframes: Keyframe[]): Segment[] {
  let t = 0;
  return keyframes.map((kf, index) => {
    const kind = curveKind(kf.transition.curve);
    const ease = gsap.parseEase(kind === 'ease' ? kf.transition.curve : 'none') ?? gsap.parseEase('none');
    const segment = { index, start: t, transitionEnd: t + kf.transition.duration, end: t + kf.transition.duration + kf.hold, kind, ease };
    t = segment.end;
    return segment;
  });
}

export function totalDuration(segments: Segment[]): number {
  return segments.length ? segments[segments.length - 1].end : 0;
}

/** Which keyframe is on stage at time `t`, and how far through its transition. Pure, so scrubbing is exact. */
export function locate(segments: Segment[], t: number): TimelineCursor | null {
  if (segments.length === 0) return null;
  const segment = segments.find((s) => t < s.end) ?? segments[segments.length - 1];
  const span = Math.max(segment.transitionEnd - segment.start, 1e-6);
  const linear = Math.min(1, Math.max(0, (t - segment.start) / span));
  return { index: segment.index, progress: segment.ease(linear), linear, holding: t >= segment.transitionEnd };
}

/**
 * The show clock: a paused GSAP timeline with one label per keyframe.
 * GSAP owns play / pause / seek / loop / timeScale; `onTick` reads the playhead.
 */
export function buildTimeline(keyframes: Keyframe[], onTick?: (time: number) => void) {
  const segments = planSegments(keyframes);
  const duration = totalDuration(segments);
  const playhead = { t: 0 };
  const timeline = gsap.timeline({ paused: true, onUpdate: () => onTick?.(timeline.time()) });
  timeline.to(playhead, { t: duration, duration: Math.max(duration, 0.001), ease: 'none' }, 0);
  segments.forEach((s) => timeline.addLabel(`kf-${keyframes[s.index].id}`, s.start));
  return { timeline, segments, duration };
}

export function formatTimecode(seconds: number): string {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${(s - m * 60).toFixed(1).padStart(4, '0')}`;
}
