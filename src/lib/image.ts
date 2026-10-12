import type { ImageInput } from '@/engine/formations/sources/image';

export const IMAGE_ACCEPT = { 'image/png': ['.png'], 'image/jpeg': ['.jpg', '.jpeg'], 'image/webp': ['.webp'], 'image/svg+xml': ['.svg'] };

/**
 * Shrink an uploaded picture to a small data URL: it is what gets sampled, persisted and
 * shared, so it must stay tiny. Pictures with transparency keep it (PNG, alpha weighting).
 */
export async function fileToImageInput(file: File): Promise<Pick<ImageInput, 'src' | 'name' | 'mode'>> {
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error('Could not read that image');
  });
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not read that image');

  const measure = (longSide: number) => {
    const scale = Math.min(1, longSide / Math.max(bitmap.width || 512, bitmap.height || 512));
    canvas.width = Math.max(8, Math.round((bitmap.width || 512) * scale));
    canvas.height = Math.max(8, Math.round((bitmap.height || 512) * scale));
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  };
  measure(256);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let transparent = 0;
  for (let i = 3; i < pixels.length; i += 4) if (pixels[i] < 200) transparent++;
  const hasAlpha = transparent > pixels.length / 4 / 25;

  let src: string;
  if (hasAlpha) src = canvas.toDataURL('image/png');
  else {
    measure(384); // photos compress well as JPEG, so they can afford more detail
    src = canvas.toDataURL('image/jpeg', 0.82);
  }
  bitmap.close();
  return { src, name: file.name.replace(/\.[^.]+$/, '').slice(0, 60) || 'Image', mode: hasAlpha ? 'alpha' : 'luminance' };
}
