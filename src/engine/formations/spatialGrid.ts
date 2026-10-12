/**
 * Uniform hash grid over points in a flat xyz array. Finding everything within `cell` of a
 * point only ever looks at the 27 surrounding cells, so neighbour queries stay linear in
 * fleet size. Used by the sampler, the formation spacing pass and the route planner.
 */
export class SpatialGrid {
  private buckets = new Map<number, number[]>();

  constructor(
    private positions: ArrayLike<number>,
    readonly cell: number,
  ) {}

  /** Pack a cell coordinate into one integer (cells within +-512 of the origin per axis). */
  private key(x: number, y: number, z: number) {
    return (((x + 512) & 1023) << 20) | (((y + 512) & 1023) << 10) | ((z + 512) & 1023);
  }
  private cellOf(v: number) {
    return Math.floor(v / this.cell);
  }

  clear() {
    this.buckets.clear();
  }

  insert(i: number) {
    const p = this.positions;
    const k = this.key(this.cellOf(p[i * 3]), this.cellOf(p[i * 3 + 1]), this.cellOf(p[i * 3 + 2]));
    const bucket = this.buckets.get(k);
    if (bucket) bucket.push(i);
    else this.buckets.set(k, [i]);
  }

  rebuild(count: number) {
    this.clear();
    for (let i = 0; i < count; i++) this.insert(i);
    return this;
  }

  /** Call `visit(j, distance)` for every inserted point within `radius` (<= cell) of (x, y, z). Return true to stop early. */
  near(x: number, y: number, z: number, radius: number, visit: (j: number, distance: number) => boolean | void): boolean {
    const p = this.positions;
    const [cx, cy, cz] = [this.cellOf(x), this.cellOf(y), this.cellOf(z)];
    for (let gx = cx - 1; gx <= cx + 1; gx++)
      for (let gy = cy - 1; gy <= cy + 1; gy++)
        for (let gz = cz - 1; gz <= cz + 1; gz++) {
          const bucket = this.buckets.get(this.key(gx, gy, gz));
          if (!bucket) continue;
          for (const j of bucket) {
            const d = Math.hypot(p[j * 3] - x, p[j * 3 + 1] - y, p[j * 3 + 2] - z);
            if (d < radius && visit(j, d)) return true;
          }
        }
    return false;
  }
}
