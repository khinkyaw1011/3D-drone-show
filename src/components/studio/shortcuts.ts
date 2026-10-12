/** One table drives both the key bindings and the "?" dialog, so they cannot drift apart. */
export const SHORTCUTS = [
  { id: 'toggle', keys: 'space', display: ['Space'] },
  { id: 'next', keys: 'right, period', display: ['→'] },
  { id: 'previous', keys: 'left, comma', display: ['←'] },
  { id: 'loop', keys: 'l', display: ['L'] },
  { id: 'undo', keys: 'mod+z', display: ['⌘/Ctrl', 'Z'] },
  { id: 'redo', keys: 'mod+shift+z, mod+y', display: ['⌘/Ctrl', 'Shift', 'Z'] },
  { id: 'duplicate', keys: 'mod+d', display: ['⌘/Ctrl', 'D'] },
  { id: 'delete', keys: 'backspace, delete', display: ['Delete'] },
  { id: 'share', keys: 'mod+shift+s', display: ['⌘/Ctrl', 'Shift', 'S'] },
  { id: 'help', keys: 'shift+slash', display: ['?'] },
] as const;

export type ShortcutId = (typeof SHORTCUTS)[number]['id'];
