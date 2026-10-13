/** A stable pseudo-random number in [0, 1) for a tile, so decoration looks the same on every machine and reload. */
export function tileRandom(column: number, row: number, salt = 0): number {
  let hash = Math.imul(column, 374761393) + Math.imul(row, 668265263) + Math.imul(salt, 1442695041);
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
  hash ^= hash >>> 16;
  return (hash >>> 0) / 4294967296;
}

export function tileRandomBetween(column: number, row: number, salt: number, min: number, max: number): number {
  return min + tileRandom(column, row, salt) * (max - min);
}
