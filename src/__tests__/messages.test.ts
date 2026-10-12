import { describe, expect, it } from 'vitest';
import en from '../../messages/en.json';
import ja from '../../messages/ja.json';
import my from '../../messages/my.json';

type Tree = { [key: string]: string | Tree };

const flatten = (tree: Tree, prefix = ''): Record<string, string> =>
  Object.entries(tree).reduce<Record<string, string>>((out, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'string' ? { ...out, [path]: value } : { ...out, ...flatten(value, path) };
  }, {});

/** `{name}` / `{count, number}` placeholders in a message. */
const placeholders = (message: string) => [...message.matchAll(/\{(\w+)/g)].map((m) => m[1]).sort();

const base = flatten(en as Tree);

describe.each([
  ['ja', flatten(ja as Tree)],
  ['my', flatten(my as Tree)],
])('%s translations', (_locale, messages) => {
  it('has exactly the same keys as English', () => {
    expect(Object.keys(messages).sort()).toEqual(Object.keys(base).sort());
  });

  it('keeps every placeholder', () => {
    for (const [key, message] of Object.entries(base)) {
      // Plural branches repeat `#`, not names, so comparing variable names is enough.
      expect(new Set(placeholders(messages[key] ?? '')), key).toEqual(new Set(placeholders(message).filter((p) => p !== 'one' && p !== 'other')));
    }
  });
});
