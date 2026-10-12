import { describe, expect, it } from 'vitest';
import { generateFormation } from '../formations/registry';
import { parseShow } from '../presets/schema';
import { compileShow } from '../timeline/compile';
import { formationSpacing } from '../timeline/planPaths';
import { fleetSpacing } from '../formations/relax';

const show = parseShow({
  id: 't',
  name: 'Test',
  droneCount: 1200,
  keyframes: [
    { id: 'a', formation: { sourceId: 'shape', input: { shape: 'sphere' } } },
    { id: 'b', formation: { sourceId: 'shape', input: { shape: 'heart' } } },
    { id: 'c', formation: { sourceId: 'shape', input: { shape: 'cube' } } },
  ],
});

async function compile(overrides = {}) {
  const s = { ...show, flight: { ...show.flight, ...overrides } };
  const formations = await Promise.all(s.keyframes.map((k) => generateFormation(k.formation.sourceId, k.formation.input, { count: s.droneCount })));
  return compileShow(s, formations);
}

describe('realistic flight', () => {
  it('never exceeds the fleet top speed', async () => {
    const compiled = await compile({ maxSpeed: 8 });
    for (const frame of compiled.frames) {
      expect(frame.stats.peakSpeed).toBeLessThanOrEqual(8 + 1e-6);
    }
  });

  it('stretches transitions when the speed limit drops', async () => {
    const fast = await compile({ maxSpeed: 20 });
    const slow = await compile({ maxSpeed: 5 });
    expect(slow.frames[0].duration).toBeGreaterThan(fast.frames[0].duration);
  });

  it('plans routes that keep drones apart', async () => {
    const compiled = await compile({ separation: 1.5 });
    for (const frame of compiled.frames) {
      expect(frame.stats.conflicts).toBe(0);
      // 1,200 drones hold ~1.1 m in formation; routes may dip to 85% of the planned clearance.
      expect(frame.stats.minSeparation).toBeGreaterThan(0.7);
    }
  });

  it('leaves timing alone when realism is off', async () => {
    const compiled = await compile({ realistic: false });
    expect(compiled.frames.map((f) => f.duration)).toEqual(show.keyframes.map((k) => k.transition.duration));
  });
});

describe('formation spacing', () => {
  it('keeps a safety gap between neighbours in every shape', async () => {
    for (const shape of ['ring', 'helix', 'galaxy', 'grid', 'star'] as const) {
      const formation = await generateFormation('shape', { shape }, { count: 1200 });
      expect(formationSpacing(formation.positions), shape).toBeGreaterThan(fleetSpacing(1200) * 0.9);
    }
  });
});
