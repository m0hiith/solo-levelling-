/** Stored avatars are re-encoded to this square size to keep them well inside the localStorage quota. */
const AVATAR_SIZE = 256;
const JPEG_QUALITY = 0.85;
/** Guard against someone picking a 50MP RAW before we ever decode it. */
const MAX_SOURCE_BYTES = 12 * 1024 * 1024;

export class AvatarError extends Error {}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new AvatarError('That file could not be decoded as an image.'));
    img.src = src;
  });
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new AvatarError('The file could not be read.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Turns a user-picked file into a small, square, center-cropped JPEG data URL.
 * Raw phone photos are several MB as base64 and would blow the ~5MB localStorage
 * budget on their own, so re-encoding here is what makes the avatar storable.
 */
export async function fileToAvatarDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new AvatarError('Pick an image file (PNG, JPG, WEBP, or GIF).');
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new AvatarError('That image is over 12MB. Pick a smaller one.');
  }

  const img = await loadImage(await readAsDataUrl(file));

  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new AvatarError('Image processing is unavailable in this browser.');

  // Center-crop the largest square the source allows, then scale it down.
  const side = Math.min(img.width, img.height);
  const sx = (img.width - side) / 2;
  const sy = (img.height - side) / 2;
  ctx.drawImage(img, sx, sy, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);

  return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
}

const FALLBACK_COLORS = ['#edb1ff', '#00f1fd', '#7dd3fc', '#c4b5fd', '#f9a8d4', '#86efac'];

export function initialsFor(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Deterministic accent colour so a given name always renders the same fallback tile. */
export function fallbackColorFor(displayName: string): string {
  let hash = 0;
  for (let i = 0; i < displayName.length; i++) {
    hash = (hash * 31 + displayName.charCodeAt(i)) | 0;
  }
  return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length];
}
