import { z } from 'zod';
import { showSchema } from '../presets/schema';

const id = z.string().min(1);
const patch = z.record(z.string(), z.unknown());

/**
 * Every user action, as data. The UI, keyboard shortcuts and (later) voice / LLM tool-calls
 * all emit these; nothing else is allowed to change the show.
 */
export const COMMANDS = {
  'formation.add': {
    description: 'Append a formation keyframe (or insert it at an index).',
    schema: z.object({ sourceId: id, input: z.unknown(), at: z.number().int().min(0).optional(), name: z.string().optional() }),
  },
  'formation.update': {
    description: "Change a keyframe's formation settings.",
    schema: z.object({ id, input: z.unknown(), sourceId: id.optional(), name: z.string().optional() }),
  },
  'keyframe.update': {
    description: 'Change hold, transition, name, camera shot or look overrides of a keyframe.',
    schema: z.object({ id, patch }),
  },
  'keyframe.remove': { description: 'Delete a keyframe.', schema: z.object({ id }) },
  'keyframe.duplicate': { description: 'Duplicate a keyframe.', schema: z.object({ id }) },
  'keyframe.move': {
    description: 'Reorder keyframes on the timeline.',
    schema: z.object({ from: z.number().int().min(0), to: z.number().int().min(0) }),
  },
  'keyframe.select': { description: 'Select a keyframe for editing.', schema: z.object({ id: id.nullable() }) },
  'look.set': { description: 'Change how drones look and move (size, glow, colours, swarm...).', schema: z.object({ patch }) },
  'look.clearOverrides': { description: 'Remove per-keyframe look overrides so the show look applies everywhere.', schema: z.object({}) },
  'flight.set': { description: 'Change real-world flight limits: realistic mode, top speed (m/s), minimum separation (m).', schema: z.object({ patch }) },
  'scene.set': { description: 'Change sky, ground, camera, post-FX or physics settings.', schema: z.object({ patch }) },
  'playback.play': { description: 'Play the show.', schema: z.object({}) },
  'playback.pause': { description: 'Pause the show.', schema: z.object({}) },
  'playback.toggle': { description: 'Toggle play / pause.', schema: z.object({}) },
  'playback.seek': { description: 'Move the playhead to a time in seconds.', schema: z.object({ t: z.number().min(0) }) },
  'playback.goTo': { description: 'Fly to a formation by keyframe id.', schema: z.object({ id }) },
  'playback.setSpeed': { description: 'Set the playback speed multiplier.', schema: z.object({ speed: z.number().min(0.25).max(3) }) },
  'playback.step': { description: 'Jump to the next or previous formation.', schema: z.object({ direction: z.union([z.literal(1), z.literal(-1)]) }) },
  'playback.setLoop': { description: 'Turn looping on or off.', schema: z.object({ loop: z.boolean() }) },
  'preset.apply': { description: 'Load a built-in or saved show.', schema: z.object({ presetId: id }) },
  'preset.save': { description: 'Save the current show as a preset.', schema: z.object({ name: z.string().min(1).max(60) }) },
  'preset.rename': { description: 'Rename a saved preset.', schema: z.object({ id, name: z.string().min(1).max(60) }) },
  'preset.delete': { description: 'Delete a saved preset.', schema: z.object({ id }) },
  'show.load': { description: 'Replace the current show (import / shared link).', schema: z.object({ show: showSchema }) },
  'show.new': { description: 'Start an empty show.', schema: z.object({}) },
  'show.rename': { description: 'Rename the show.', schema: z.object({ name: z.string().min(1).max(60) }) },
  'show.setDroneCount': { description: 'Set how many drones fly.', schema: z.object({ count: z.number().int().min(100).max(20000) }) },
  'history.undo': { description: 'Undo the last change.', schema: z.object({}) },
  'history.redo': { description: 'Redo.', schema: z.object({}) },
} as const;

export type CommandType = keyof typeof COMMANDS;
export type CommandPayload<T extends CommandType> = z.infer<(typeof COMMANDS)[T]['schema']>;
/** A command is its `type` plus that command's payload (nothing extra for payload-less commands). */
export type Command = {
  [T in CommandType]: Record<string, never> extends CommandPayload<T> ? { type: T } : { type: T } & CommandPayload<T>;
}[CommandType];
export type CommandHandlers = { [T in CommandType]: (payload: CommandPayload<T>) => void | Promise<void> };

/** Build `dispatch`: validate against the command's schema, then run its handler. */
export function createDispatcher(handlers: CommandHandlers) {
  return async function dispatch(command: Command): Promise<void> {
    const spec = COMMANDS[command.type];
    if (!spec) throw new Error(`Unknown command "${(command as { type: string }).type}"`);
    const { type, ...payload } = command;
    const parsed = spec.schema.parse(payload);
    await (handlers[type] as (p: unknown) => void | Promise<void>)(parsed);
  };
}

/** Machine-readable catalogue, ready to hand to an LLM as tool definitions later. */
export function describeCommands() {
  return (Object.keys(COMMANDS) as CommandType[]).map((type) => ({
    type,
    description: COMMANDS[type].description,
    parameters: z.toJSONSchema(COMMANDS[type].schema, { unrepresentable: 'any' }),
  }));
}
