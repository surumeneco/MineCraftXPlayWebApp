/** Vue's v-model converts native type=number inputs to numbers, or '' when cleared. */
export function hasBlankSpotCoordinate(coordinates: { x: string | number; z: string | number }): boolean {
  return Object.values(coordinates).some(value => String(value).trim() === '')
}
