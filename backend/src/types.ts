export type GenerationRequest = {
  prompt: string;
  negativePrompt: string;
  model: string;
  width: number;
  height: number;
  count: number;
  seed?: number;
};

export type EnhancementRequest = {
  imageBase64: string;
  prompt: string;
  negativePrompt: string;
  model: string;
  width: number;
  height: number;
  strength: number;
  seed?: number;
};

export type GenerationRecord = GenerationRequest & {
  id: string;
  imageUrl: string;
  createdAt: string;
  durationMs: number;
};

export type GpuStatus = {
  available: boolean;
  name: string;
  utilizationPercent: number | null;
  memoryUsedMb: number | null;
  memoryTotalMb: number | null;
  temperatureC: number | null;
  powerW: number | null;
  ramUsedMb: number;
  ramTotalMb: number;
};
