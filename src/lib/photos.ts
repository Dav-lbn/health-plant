import { db } from './db';
import type { Photo } from './types';

export const PHOTO_MAX = 1280;
export const THUMB_MAX = 320;
const QUALITY = 0.85;

/** Dimensions réduites pour tenir dans max×max, sans jamais agrandir. */
export function fitWithin(w: number, h: number, max: number): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(w, h));
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}

async function render(bitmap: ImageBitmap, max: number): Promise<Blob> {
  const { width, height } = fitWithin(bitmap.width, bitmap.height, max);
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, width, height);
    return canvas.convertToBlob({ type: 'image/jpeg', quality: QUALITY });
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, width, height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Conversion de la photo impossible'))), 'image/jpeg', QUALITY),
  );
}

/** Photo redimensionnée (1280 px) et miniature (320 px), orientation EXIF appliquée. */
export async function processImage(file: Blob): Promise<{ blob: Blob; thumb: Blob }> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('Cette image ne peut pas être lue. Essayez une photo JPEG ou PNG.');
  }
  try {
    const [blob, thumb] = await Promise.all([render(bitmap, PHOTO_MAX), render(bitmap, THUMB_MAX)]);
    return { blob, thumb };
  } finally {
    bitmap.close();
  }
}

export async function savePhoto(plantId: string, file: Blob): Promise<Photo> {
  const { blob, thumb } = await processImage(file);
  const photo: Photo = { id: crypto.randomUUID(), plantId, blob, thumb, takenAt: new Date().toISOString() };
  await db.photos.add(photo);
  return photo;
}

export function listPhotos(plantId: string): Promise<Photo[]> {
  return db.photos.where('plantId').equals(plantId).toArray();
}

export async function deletePhoto(id: string): Promise<void> {
  await db.photos.delete(id);
  revokeUrls(id);
}

const urls = new Map<string, string>();

/** URL objet mise en cache par clé (ex. `${id}:thumb`). */
export function photoUrl(key: string, blob: Blob): string {
  let url = urls.get(key);
  if (!url) {
    url = URL.createObjectURL(blob);
    urls.set(key, url);
  }
  return url;
}

function revokeUrls(id: string) {
  for (const k of [id, `${id}:thumb`]) {
    const u = urls.get(k);
    if (u) {
      URL.revokeObjectURL(u);
      urls.delete(k);
    }
  }
}
