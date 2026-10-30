/** Validate dimensions before using persisted metadata in HTML or CSS geometry. */
export function hasImageDimensions(value: { width: number; height: number } | null | undefined): value is { width: number; height: number } {
  return !!value && Number.isFinite(value.width) && Number.isFinite(value.height) && value.width > 0 && value.height > 0;
}

/** Reserve the intrinsic ratio without enlarging small images or exceeding the reader's height limit. */
export function getImageBounds(value?: { width: number; height: number } | null): { width: number; height: number } {
  if (!hasImageDimensions(value)) return { width: 600, height: 337.5 };
  const scale = Math.min(1, 600 / value.height);
  return { width: value.width * scale, height: value.height * scale };
}
