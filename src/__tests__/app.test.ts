import { describe, expect, it } from 'vitest';
import { BUILTIN_SHOWS } from '@/engine/presets/builtin';
import { resolvePrompt } from '@/lib/prompt';
import { decodeShow, encodeShow, shareHash, showFromHash } from '@/lib/share';

describe('share links', () => {
  it('round-trips a show through the URL hash', () => {
    const show = BUILTIN_SHOWS[2];
    expect(decodeShow(encodeShow(show))).toEqual(show);
    expect(showFromHash(shareHash(show))).toEqual(show);
  });

  it('ignores hashes without a show and rejects corrupted ones', () => {
    expect(showFromHash('#section')).toBeNull();
    expect(() => showFromHash('#s=not-a-show')).toThrow();
  });
});

describe('prompt', () => {
  it.each([
    ['heart', 'heart'],
    ['a big STAR please', 'star'],
    ['hearts', 'heart'],
    ['桜', 'blossom'],
    ['きれいな花火', 'burst'],
    ['နှလုံး', 'heart'],
    ['saturn', 'saturn'],
  ])('reads "%s" as the %s shape', (text, shape) => {
    expect(resolvePrompt(text)).toEqual({ sourceId: 'shape', input: { shape } });
  });

  it('writes anything else as text', () => {
    expect(resolvePrompt('  Hello Yangon ')).toEqual({ sourceId: 'text', input: { text: 'Hello Yangon' } });
    expect(resolvePrompt('   ')).toBeNull();
  });
});

describe('persisted state migration', () => {
  it('keeps valid shows, upgrades old ones and drops garbage instead of throwing', async () => {
    const { PERSIST_VERSION, migratePersisted } = await import('@/store');
    const saved = BUILTIN_SHOWS[0];
    const unversioned: Record<string, unknown> = { ...BUILTIN_SHOWS[1] };
    delete unversioned.version;
    const migrated = migratePersisted({ show: saved, userPresets: [unversioned, { nonsense: true }, null], ui: { leftOpen: false, mobilePanel: 'library' } });
    expect(PERSIST_VERSION).toBeGreaterThanOrEqual(1);
    expect(migrated.show).toEqual(saved);
    expect(migrated.userPresets).toHaveLength(1);
    expect(migrated.userPresets[0].version).toBe(saved.version);
    expect(migrated.ui.leftOpen).toBe(false);
    expect(migrated.ui.mobilePanel).toBeNull();
  });

  it('falls back to a built-in show when nothing usable was stored', async () => {
    const { migratePersisted } = await import('@/store');
    expect(migratePersisted(undefined).show.keyframes.length).toBeGreaterThan(0);
    expect(migratePersisted({ show: 'broken' }).userPresets).toEqual([]);
  });
});

describe('reset to defaults', () => {
  it('restores one area or everything, and keeps the formations', async () => {
    const { useStudio } = await import('@/store');
    const { dispatch } = await import('@/store/dispatch');
    const defaults = (await import('@/engine/presets/schema')).showSchema.parse({ id: 'd', name: 'd', keyframes: [] });
    const formations = useStudio.getState().show.keyframes.length;

    await dispatch({ type: 'look.set', patch: { glow: 2.5, colorMode: 'random' } });
    await dispatch({ type: 'show.setDroneCount', count: 3000 });
    await dispatch({ type: 'scene.set', patch: { stars: 1, fireworks: { intensity: 0.9 } } });
    await dispatch({ type: 'flight.set', patch: { maxSpeed: 5 } });

    await dispatch({ type: 'settings.reset', scope: 'look' });
    expect(useStudio.getState().show.look).toEqual(defaults.look);
    expect(useStudio.getState().show.droneCount).toBe(defaults.droneCount);
    expect(useStudio.getState().show.flight.maxSpeed).toBe(5);

    await dispatch({ type: 'settings.reset', scope: 'scene' });
    expect(useStudio.getState().show.scene.stars).toBe(defaults.scene.stars);
    expect(useStudio.getState().show.scene.fireworks.intensity).toBe(0.9);

    await dispatch({ type: 'settings.reset', scope: 'all' });
    const { show } = useStudio.getState();
    expect([show.look, show.scene, show.flight]).toEqual([defaults.look, defaults.scene, defaults.flight]);
    expect(show.keyframes).toHaveLength(formations);
  });
});

describe('shows saved before a setting existed', () => {
  it('gain the new settings with their defaults when loaded', async () => {
    const { migratePersisted } = await import('@/store');
    // A show as an older build stored it: no fireworks, flight rules, drone size or star size.
    const old = structuredClone(BUILTIN_SHOWS[0]) as unknown as { scene: Record<string, unknown>; look: Record<string, unknown>; flight?: unknown };
    delete old.scene.fireworks;
    delete old.scene.starSize;
    delete old.scene.ambient;
    delete old.look.body;
    delete old.flight;
    const { show } = migratePersisted({ show: old });
    expect(show.scene.fireworks).toEqual({ intensity: 0, size: 1, palette: 'show', style: 'mixed', height: 1 });
    expect(show.scene.venue.beams).toBeGreaterThan(0);
    expect(show.flight.realistic).toBe(true);
    expect(show.look.body).toBeGreaterThan(0);
    expect(show.scene.starSize).toBeGreaterThan(0);
  });
});
