// Emberline look plan. Ember (player team) is warm amber; Tide (enemy team)
// is cool teal. The map itself stays in dark slate / warm sand so the two
// teams read instantly at a distance, even in a small screenshot.
export const PALETTE = {
  canvas: '#14161a',
  surface: '#1e2228',
  hairline: '#2c323a',
  ink: '#e9e6df',
  muted: '#98a0a8',
  accent: '#f0a830', // ember amber
  ember: '#f0a830',
  tide: '#2ec4b6',
  sand: '#8a7a5c',
  slate: '#3a4550',
  brick: '#7a4a3a',
  leaf: '#4a6b4a',
  danger: '#e5484d',
  money: '#7dd87d',
};

export function shade(name) {
  return PALETTE[name];
}
