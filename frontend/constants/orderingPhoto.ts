export const MAX_PHOTO_COUNT = 5;

export function getLimitedPhotoUrls(rawPhotoUrl?: string): string[] {
  if (!rawPhotoUrl) return [];
  return String(rawPhotoUrl)
    .split("\n")
    .map((url) => url.trim())
    .filter((url) => Boolean(url))
    .slice(0, MAX_PHOTO_COUNT);
}
