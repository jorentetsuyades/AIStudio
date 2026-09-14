import type { EnhancementRequest, GenerationRequest } from '../types.js';
import { config } from '../config.js';

export async function requestImageGeneration(request: GenerationRequest): Promise<{ imageBase64: string; seed: number; durationMs: number }> {
  const response = await fetch(`${config.aiServiceUrl}/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(10 * 60 * 1_000),
  });
  if (!response.ok) throw new Error(`AI service returned ${response.status}: ${await response.text()}`);
  return await response.json() as { imageBase64: string; seed: number; durationMs: number };
}

export async function requestImageEnhancement(request: EnhancementRequest): Promise<{ imageBase64: string; seed: number; durationMs: number }> {
  const response = await fetch(`${config.aiServiceUrl}/enhance`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(10 * 60 * 1_000),
  });
  if (!response.ok) throw new Error(`AI service returned ${response.status}: ${await response.text()}`);
  return await response.json() as { imageBase64: string; seed: number; durationMs: number };
}

export async function getAiHealth(): Promise<{ available: boolean; model: string }> {
  try {
    const response = await fetch(`${config.aiServiceUrl}/health`, { signal: AbortSignal.timeout(2_000) });
    if (!response.ok) return { available: false, model: 'unavailable' };
    return await response.json() as { available: boolean; model: string };
  } catch {
    return { available: false, model: 'unavailable' };
  }
}
