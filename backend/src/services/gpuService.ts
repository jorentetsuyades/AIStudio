import { execFile } from 'node:child_process';
import os from 'node:os';
import { promisify } from 'node:util';
import type { GpuStatus } from '../types.js';

const execFileAsync = promisify(execFile);
const query = ['--query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu,power.draw', '--format=csv,noheader,nounits'];

export async function getGpuStatus(): Promise<GpuStatus> {
  const ramTotalMb = Math.round(os.totalmem() / 1024 / 1024);
  const ramUsedMb = ramTotalMb - Math.round(os.freemem() / 1024 / 1024);
  try {
    const { stdout } = await execFileAsync('nvidia-smi', query, { timeout: 3_000, windowsHide: true });
    const [name, utilization, memoryUsed, memoryTotal, temperature, power] = stdout.trim().split(',').map((part) => part.trim());
    return {
      available: true,
      name,
      utilizationPercent: Number(utilization),
      memoryUsedMb: Number(memoryUsed),
      memoryTotalMb: Number(memoryTotal),
      temperatureC: Number(temperature),
      powerW: Number(power),
      ramUsedMb,
      ramTotalMb,
    };
  } catch {
    return { available: false, name: 'NVIDIA GPU unavailable', utilizationPercent: null, memoryUsedMb: null, memoryTotalMb: null, temperatureC: null, powerW: null, ramUsedMb, ramTotalMb };
  }
}
