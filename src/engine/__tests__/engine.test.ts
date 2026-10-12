import { describe, expect, it } from 'vitest';
import { COMMANDS, createDispatcher, describeCommands } from '../commands/commands';
import { mortonAssign, permute } from '../formations/assign';
import { SHOW_VOLUME, fitToVolume, groundGrid } from '../formations/fit';
import { launchDelays } from '../formations/order';
import { generateFormation, listSources } from '../formations/registry';
import { bake } from '../formations/sources/baked';
import { BUILTIN_SHOWS } from '../presets/builtin';
import { SHOW_VERSION, parseShow, showSchema } from '../presets/schema';
import { buildTimeline, formatTimecode, locate, planSegments } from '../timeline/buildTimeline';

describe('fit', () => {
  it('centres points in the show volume without exceeding it', () => {
    const points = fitToVolume(new Float32Array([-100, 0, 0, 100, 50, 10, 0, -50, -10]));
    for (let axis = 0; axis < 3; axis++) {
      const values = [points[axis], points[axis + 3], points[axis + 6]];
      expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(SHOW_VOLUME.size[axis] + 1e-4);
      expect((Math.max(...values) + Math.min(...values)) / 2).toBeCloseTo(SHOW_VOLUME.center[axis], 3);
    }
  });
});

describe('assignment', () => {
  it('gives every drone a distinct target', () => {
    const from = groundGrid(500);
    const to = Float32Array.from({ length: 1500 }, (_, i) => Math.sin(i * 1.7) * 10);
    const assignment = mortonAssign(from, to);
    expect(new Set(assignment).size).toBe(500);
    expect(permute(to, assignment, 3)).toHaveLength(1500);
  });

  it('keeps launch delays within 0..1 for every order', () => {
    const positions = groundGrid(200);
    const colors = new Float32Array(600).fill(0.5);
    for (const order of ['random', 'radial', 'top-down', 'by-color'] as const) {
      const delays = launchDelays(order, positions, colors);
      expect(Math.min(...delays)).toBeGreaterThanOrEqual(0);
      expect(Math.max(...delays)).toBeLessThanOrEqual(1);
    }
  });
});

describe('formation sources', () => {
  it('registers every source with a unique id', () => {
    const ids = listSources().map((s) => s.id);
    expect(ids).toEqual(expect.arrayContaining(['shape', 'text', 'image', 'model', 'svg', 'baked']));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('produces exactly the requested number of drones, deterministically', async () => {
    const a = await generateFormation('shape', { shape: 'saturn' }, { count: 640 });
    const b = await generateFormation('shape', { shape: 'saturn' }, { count: 640 });
    expect(a.count).toBe(640);
    expect(Array.from(a.positions)).toEqual(Array.from(b.positions));
  });

  it('round-trips a baked formation and resamples to another fleet size', async () => {
    const source = await generateFormation('shape', { shape: 'galaxy' }, { count: 300 });
    const baked = bake(source, 'Galaxy');
    const same = await generateFormation('baked', baked, { count: 300 });
    expect(Math.abs(same.positions[10] - source.positions[10])).toBeLessThan(0.01);
    expect(same.colors).toBeDefined();
    expect((await generateFormation('baked', baked, { count: 120 })).count).toBe(120);
  });

  it('rejects input that does not match the source schema', async () => {
    await expect(generateFormation('shape', { shape: 'banana' }, { count: 10 })).rejects.toThrow();
  });
});

describe('show schema', () => {
  it('ships six valid built-in shows at the current version', () => {
    expect(BUILTIN_SHOWS).toHaveLength(6);
    for (const show of BUILTIN_SHOWS) {
      expect(showSchema.safeParse(show).success, show.name).toBe(true);
      expect(show.version).toBe(SHOW_VERSION);
    }
  });

  it('fills defaults and migrates a show saved without a version', () => {
    const show = parseShow({ id: 'x', name: 'Old', keyframes: [] });
    expect(show.version).toBe(SHOW_VERSION);
    expect(show.flight.realistic).toBe(true);
    expect(show.scene.bloom.strength).toBeGreaterThan(0);
  });
});

describe('timeline', () => {
  const keyframes = BUILTIN_SHOWS[0].keyframes;

  it('lays keyframes end to end and labels each one', () => {
    const { timeline, segments, duration } = buildTimeline(keyframes);
    expect(duration).toBeCloseTo(keyframes.reduce((t, k) => t + k.transition.duration + k.hold, 0));
    expect(Object.keys(timeline.labels)).toHaveLength(keyframes.length);
    expect(segments[1].start).toBeCloseTo(segments[0].end);
  });

  it('uses compiled durations when given', () => {
    const stretched = planSegments(keyframes, keyframes.map(() => 30));
    expect(stretched[0].transitionEnd).toBe(30);
  });

  it('locates the keyframe on stage at any time', () => {
    const segments = planSegments(keyframes);
    expect(locate(segments, 0)).toMatchObject({ index: 0, progress: 0, holding: false });
    expect(locate(segments, segments[0].transitionEnd + 0.01)).toMatchObject({ index: 0, progress: 1, holding: true });
    expect(locate(segments, 1e6)?.index).toBe(keyframes.length - 1);
    expect(locate([], 1)).toBeNull();
  });

  it('formats timecodes', () => {
    expect(formatTimecode(75.25)).toBe('01:15.3');
  });
});

describe('commands', () => {
  it('validates payloads before running a handler', async () => {
    const seen: unknown[] = [];
    const handlers = Object.fromEntries(Object.keys(COMMANDS).map((type) => [type, (payload: unknown) => void seen.push([type, payload])]));
    const dispatch = createDispatcher(handlers as never);
    await dispatch({ type: 'playback.seek', t: 3 });
    expect(seen).toEqual([['playback.seek', { t: 3 }]]);
    await expect(dispatch({ type: 'playback.seek', t: -1 })).rejects.toThrow();
    await expect(dispatch({ type: 'show.setDroneCount', count: 5 })).rejects.toThrow();
  });

  it('describes every command for tool-calling', () => {
    const catalogue = describeCommands();
    expect(catalogue).toHaveLength(Object.keys(COMMANDS).length);
    expect(catalogue.every((c) => c.description.length > 3 && typeof c.parameters === 'object')).toBe(true);
  });
});
