import type { Capabilities } from '../types';
import { CpuSimulator } from './CpuSimulator';
import { GpuSimulator } from './GpuSimulator';
import type { Simulator } from './Simulator';

export function createSimulator(count: number, capabilities: Capabilities): Simulator {
  return capabilities.compute ? new GpuSimulator(count) : new CpuSimulator(count);
}
