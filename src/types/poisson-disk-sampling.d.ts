declare module 'poisson-disk-sampling' {
  export interface PoissonDiskSamplingOptions {
    shape: number[];
    minDistance: number;
    maxDistance?: number;
    tries?: number;
    distanceFunction?: (point: number[]) => number;
    bias?: number;
  }
  export default class PoissonDiskSampling {
    constructor(options: PoissonDiskSamplingOptions, rng?: () => number);
    fill(): number[][];
    reset(): void;
  }
}
