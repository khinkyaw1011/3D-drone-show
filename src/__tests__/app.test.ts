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
  it('restores one feature at a time, then everything, and keeps the formations', async () => {
    const { useStudio } = await import('@/store');
    const { dispatch } = await import('@/store/dispatch');
    const { isScopeChanged } = await import('@/engine/presets/reset');
    const defaults = (await import('@/engine/presets/schema')).showSchema.parse({ id: 'd', name: 'd', keyframes: [] });
    const show = () => useStudio.getState().show;
    const formations = show().keyframes.length;
    await dispatch({ type: 'settings.reset', scope: 'all' });
    expect(isScopeChanged(show(), 'all')).toBe(false);

    await dispatch({ type: 'look.set', patch: { glow: 2.5, colorMode: 'random' } });
    await dispatch({ type: 'show.setDroneCount', count: 3000 });
    await dispatch({ type: 'scene.set', patch: { stars: 1, fireworks: { intensity: 0.9 }, venue: { beams: 1 } } });
    await dispatch({ type: 'flight.set', patch: { maxSpeed: 5 } });
    expect(['look', 'color', 'sky', 'fireworks', 'venue', 'flight'].map((scope) => isScopeChanged(show(), scope as never))).toEqual(Array(6).fill(true));
    expect(isScopeChanged(show(), 'fx')).toBe(false);

    // Drones: size, glow and fleet size come back; colour is its own feature and stays.
    await dispatch({ type: 'settings.reset', scope: 'look' });
    expect(show().look.glow).toBe(defaults.look.glow);
    expect(show().droneCount).toBe(defaults.droneCount);
    expect(show().look.colorMode).toBe('random');

    // Sky: stars come back; fireworks and venue lighting are untouched.
    await dispatch({ type: 'settings.reset', scope: 'sky' });
    expect(show().scene.stars).toBe(defaults.scene.stars);
    expect(show().scene.fireworks.intensity).toBe(0.9);
    expect(show().scene.venue.beams).toBe(1);

    await dispatch({ type: 'settings.reset', scope: 'fireworks' });
    expect(show().scene.fireworks).toEqual(defaults.scene.fireworks);

    await dispatch({ type: 'settings.reset', scope: 'all' });
    expect([show().look, show().scene, show().flight, show().droneCount]).toEqual([defaults.look, defaults.scene, defaults.flight, defaults.droneCount]);
    expect(isScopeChanged(show(), 'all')).toBe(false);
    expect(show().keyframes).toHaveLength(formations);
  });

  it('ships fireworks switched off, except in the shows built around them', async () => {
    const lit = BUILTIN_SHOWS.filter((show) => show.scene.fireworks.intensity > 0).map((show) => show.id);
    expect(lit).toEqual(['new-year']);
  });
});

describe('shows saved before a setting existed', () => {
  it('gain the new settings with their defaults when loaded', async () => {
    const { migratePersisted } = await import('@/store');
    // A show as an older build stored it: no fireworks, flight rules, drone size, venue or star settings.
    const old = structuredClone(BUILTIN_SHOWS[0]) as unknown as { scene: Record<string, unknown>; look: Record<string, unknown>; flight?: unknown };
    for (const key of ['fireworks', 'venue', 'starSize', 'starTwinkle', 'milkyWay', 'ambient']) delete old.scene[key];
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
