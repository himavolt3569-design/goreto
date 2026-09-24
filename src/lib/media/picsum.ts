/**
 * Lorem Picsum stand-in photography for the development seed catalog.
 * IDs are fixed (hand-picked for fashion context) so images never change
 * between loads. Allowed in next.config.ts via images.remotePatterns.
 */
export function picsumImage(id: number, width: number, height: number): string {
  for (const value of [id, width, height]) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new TypeError(`picsumImage expects non-negative integers, received ${value}`);
    }
  }
  return `https://picsum.photos/id/${id}/${width}/${height}`;
}
