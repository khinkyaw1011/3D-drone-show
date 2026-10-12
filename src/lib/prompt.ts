import { SHAPES, type ShapeName } from '@/engine/formations/sources/shape';

/** Words people type for each shape, in English, Japanese and Burmese. */
const ALIASES: Record<string, ShapeName> = {
  love: 'heart', ハート: 'heart', 愛: 'heart', နှလုံး: 'heart', အချစ်: 'heart',
  星: 'star', スター: 'star', ကြယ်: 'star',
  circle: 'ring', 円: 'ring', 丸: 'ring', リング: 'ring', စက်ဝိုင်း: 'ring', ကွင်း: 'ring',
  spiral: 'galaxy', 銀河: 'galaxy', らせん: 'galaxy', 螺旋: 'galaxy', ဂလက်ဆီ: 'galaxy',
  box: 'cube', キューブ: 'cube', 立方体: 'cube', အတုံး: 'cube',
  ball: 'sphere', globe: 'sphere', planet: 'sphere', 球: 'sphere', ボール: 'sphere', 地球: 'sphere', ဘောလုံး: 'sphere', ကမ္ဘာ: 'sphere',
  donut: 'torus', doughnut: 'torus', ドーナツ: 'torus', トーラス: 'torus',
  dna: 'helix', 二重らせん: 'helix',
  ocean: 'wave', sea: 'wave', 波: 'wave', ウェーブ: 'wave', လှိုင်း: 'wave',
  sakura: 'blossom', cherry: 'blossom', flower: 'blossom', 桜: 'blossom', さくら: 'blossom', サクラ: 'blossom', 花: 'blossom', ဆာကူရာ: 'blossom', ချယ်ရီ: 'blossom', ပန်း: 'blossom',
  firework: 'burst', fireworks: 'burst', explosion: 'burst', 花火: 'burst', 爆発: 'burst', မီးပန်း: 'burst',
  wall: 'grid', グリッド: 'grid',
};

export type PromptResult = { sourceId: 'shape'; input: { shape: ShapeName } } | { sourceId: 'text'; input: { text: string } };

/**
 * "heart", "桜", "HELLO": a known shape name (or alias, in any supported language) becomes
 * that shape; anything else is written in the sky as text.
 */
export function resolvePrompt(raw: string): PromptResult | null {
  const text = raw.trim().slice(0, 40);
  if (!text) return null;
  const lower = text.toLowerCase();
  const words = [lower, ...lower.split(/\s+/), ...lower.split(/\s+/).map((w) => w.replace(/s$/, ''))];
  for (const word of words) {
    if ((SHAPES as readonly string[]).includes(word)) return { sourceId: 'shape', input: { shape: word as ShapeName } };
    if (word in ALIASES) return { sourceId: 'shape', input: { shape: ALIASES[word] } };
  }
  // Scripts without spaces: look for an alias inside the phrase, longest first.
  const contained = Object.keys(ALIASES)
    .filter((k) => /[^\x00-\x7f]/.test(k) && lower.includes(k))
    .sort((a, b) => b.length - a.length)[0];
  if (contained) return { sourceId: 'shape', input: { shape: ALIASES[contained] } };
  return { sourceId: 'text', input: { text } };
}
