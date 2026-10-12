import { nanoid } from 'nanoid';
import { type CommandHandlers, createDispatcher } from '@/engine/commands/commands';
import { getSource } from '@/engine/formations/registry';
import { BUILTIN_SHOWS } from '@/engine/presets/builtin';
import { carryTweaks, resetScope } from '@/engine/presets/reset';
import { flightSchema, droneLookSchema, keyframeSchema, sceneSettingsSchema } from '@/engine/presets/schema';
import type { Keyframe, SceneSettings } from '@/engine/types';
import { currentFleetLimits, history, mutate, useStudio } from './index';
import { initialPlaybackSlice } from './slices/playback';
import { cloneShow, emptyShow } from './slices/show';

const VOLUMETRIC = new Set(['shape', 'model', 'baked']);

const findKeyframe = (keyframes: Keyframe[], id: string) => {
  const index = keyframes.findIndex((k) => k.id === id);
  if (index < 0) throw new Error(`Keyframe "${id}" not found`);
  return index;
};

const seek = (target: { t: number } | { keyframe: number }) =>
  mutate((s) => {
    s.playback.seek = { ...target, nonce: (s.playback.seek?.nonce ?? 0) + 1 };
    if ('t' in target) s.playback.time = target.t;
  });

/** Replace the show. The player flies the airborne fleet into it; no seek, so nothing teleports. */
const loadShow = (show: ReturnType<typeof cloneShow>) =>
  mutate((s) => {
    s.show = show;
    s.selectedKeyframeId = show.keyframes[0]?.id ?? null;
    s.playback.playing = true;
  });

const handlers: CommandHandlers = {
  'formation.add': ({ sourceId, input, at, name }) => {
    const source = getSource(sourceId);
    const parsed = source.inputSchema.parse(input);
    const keyframe = keyframeSchema.parse({
      id: nanoid(8),
      name: name ?? source.describe(parsed),
      formation: { sourceId, input: parsed },
      custom: true,
      // Solid formations turn slowly by default so their depth reads, as on a real show.
      spin: VOLUMETRIC.has(sourceId) ? 8 : 0,
    });
    mutate((s) => {
      s.show.keyframes.splice(at ?? s.show.keyframes.length, 0, keyframe);
      s.selectedKeyframeId = keyframe.id;
    });
  },
  'formation.update': ({ id, input, sourceId, name }) =>
    mutate((s) => {
      const kf = s.show.keyframes[findKeyframe(s.show.keyframes, id)];
      const source = getSource(sourceId ?? kf.formation.sourceId);
      const parsed = source.inputSchema.parse(input);
      // Keep a custom name; follow the formation only while the name is still the auto one.
      const auto = getSource(kf.formation.sourceId).describe(kf.formation.input);
      if (name) kf.name = name;
      else if (kf.name === auto) kf.name = source.describe(parsed);
      kf.formation = { sourceId: source.id, input: parsed };
    }),
  'keyframe.update': ({ id, patch }) =>
    mutate((s) => {
      const index = findKeyframe(s.show.keyframes, id);
      const kf = s.show.keyframes[index];
      const p = patch as Partial<Keyframe>;
      s.show.keyframes[index] = keyframeSchema.parse({
        ...kf,
        ...p,
        id: kf.id,
        formation: kf.formation,
        transition: { ...kf.transition, ...p.transition },
        // `look: null` removes the override; an object merges into it.
        look: p.look === undefined ? kf.look : p.look === null ? undefined : { ...kf.look, ...p.look },
      });
    }),
  'keyframe.remove': ({ id }) =>
    mutate((s) => {
      const index = findKeyframe(s.show.keyframes, id);
      s.show.keyframes.splice(index, 1);
      if (s.selectedKeyframeId === id) s.selectedKeyframeId = s.show.keyframes[Math.min(index, s.show.keyframes.length - 1)]?.id ?? null;
    }),
  'keyframe.duplicate': ({ id }) =>
    mutate((s) => {
      const index = findKeyframe(s.show.keyframes, id);
      const copy = { ...structuredClone(useStudio.getState().show.keyframes[index]), id: nanoid(8) };
      s.show.keyframes.splice(index + 1, 0, copy);
      s.selectedKeyframeId = copy.id;
    }),
  'keyframe.move': ({ from, to }) =>
    mutate((s) => {
      const list = s.show.keyframes;
      if (from >= list.length || to >= list.length) return;
      list.splice(to, 0, ...list.splice(from, 1));
    }),
  'keyframe.select': ({ id }) =>
    mutate((s) => {
      s.selectedKeyframeId = id;
    }),
  'look.set': ({ patch }) =>
    mutate((s) => {
      s.show.look = droneLookSchema.parse({ ...s.show.look, ...patch });
    }),
  'look.clearOverrides': () =>
    mutate((s) => {
      for (const kf of s.show.keyframes) delete kf.look;
    }),
  'flight.set': ({ patch }) =>
    mutate((s) => {
      s.show.flight = flightSchema.parse({ ...s.show.flight, ...patch });
    }),
  'settings.reset': ({ scope }) =>
    mutate((s) => {
      resetScope(s.show, scope);
      // The default fleet may be more than this device can fly.
      s.show.droneCount = currentFleetLimits().clamp(s.show.droneCount);
      if (scope === 'all') s.playback.speed = initialPlaybackSlice().playback.speed;
    }),
  'scene.set': ({ patch }) =>
    mutate((s) => {
      const p = patch as Partial<SceneSettings>;
      s.show.scene = sceneSettingsSchema.parse({
        ...s.show.scene,
        ...p,
        bloom: { ...s.show.scene.bloom, ...p.bloom },
        physics: { ...s.show.scene.physics, ...p.physics },
        fireworks: { ...s.show.scene.fireworks, ...p.fireworks },
        venue: { ...s.show.scene.venue, ...p.venue },
      });
    }),
  'ui.set': ({ patch }) =>
    mutate((s) => {
      // Only known UI keys are accepted, so a stray patch can never add state.
      for (const key of Object.keys(s.ui) as (keyof typeof s.ui)[]) {
        if (key in patch) (s.ui as Record<string, unknown>)[key] = patch[key];
      }
    }),
  'playback.play': () => mutate((s) => void (s.playback.playing = true)),
  'playback.pause': () => mutate((s) => void (s.playback.playing = false)),
  'playback.toggle': () => mutate((s) => void (s.playback.playing = !s.playback.playing)),
  'playback.seek': ({ t }) => seek({ t }),
  'playback.goTo': ({ id }) => {
    const keyframe = findKeyframe(useStudio.getState().show.keyframes, id);
    mutate((s) => {
      s.selectedKeyframeId = id;
      s.playback.playing = true;
    });
    seek({ keyframe });
  },
  'playback.setSpeed': ({ speed }) => mutate((s) => void (s.playback.speed = speed)),
  'playback.step': ({ direction }) => {
    const { show, playback } = useStudio.getState();
    const total = show.keyframes.length;
    if (total === 0) return;
    const keyframe = (playback.index + direction + total) % total;
    mutate((s) => {
      s.selectedKeyframeId = show.keyframes[keyframe].id;
      s.playback.playing = true;
    });
    seek({ keyframe });
  },
  'playback.setLoop': ({ loop }) => mutate((s) => void (s.playback.loop = loop)),
  'preset.apply': ({ presetId, keepTweaks }) => {
    const presets = [...BUILTIN_SHOWS, ...useStudio.getState().userPresets];
    const preset = presets.find((p) => p.id === presetId);
    if (!preset) throw new Error(`Preset "${presetId}" not found`);
    const current = useStudio.getState().show;
    const show = { ...cloneShow(preset), basedOn: preset.id };
    if (keepTweaks) {
      // (Shows saved before `basedOn` existed are matched by the name they kept from their preset.)
      const base = presets.find((p) => p.id === current.basedOn) ?? presets.find((p) => p.name === current.name);
      if (base) carryTweaks(current, base, show);
    }
    // Fleet size, flight limits and the lighting style are the visitor's preferences, not part of a
    // show: they always carry over, so the drones already in the air simply re-form into the new show.
    const { droneCount, flight, look } = current;
    loadShow({ ...show, droneCount, flight, look: { ...show.look, bodyGlow: look.bodyGlow } });
  },
  'preset.save': ({ name }) =>
    mutate((s) => {
      s.userPresets.unshift(cloneShow(useStudio.getState().show, name));
    }),
  'preset.rename': ({ id, name }) =>
    mutate((s) => {
      const preset = s.userPresets.find((p) => p.id === id);
      if (preset) preset.name = name;
    }),
  'preset.delete': ({ id }) =>
    mutate((s) => {
      s.userPresets = s.userPresets.filter((p) => p.id !== id);
    }),
  'show.load': ({ show }) => loadShow(cloneShow(show)),
  'show.new': () => loadShow(emptyShow()),
  'show.rename': ({ name }) => mutate((s) => void (s.show.name = name)),
  'show.setDroneCount': ({ count }) => {
    // Only fleet sizes inside this device's limits are accepted.
    const limits = currentFleetLimits();
    mutate((s) => void (s.show.droneCount = limits.clamp(count)));
  },
  'history.undo': () => history().undo(),
  'history.redo': () => history().redo(),
};

/** The single entry point for changing the studio. */
export const dispatch = createDispatcher(handlers);
