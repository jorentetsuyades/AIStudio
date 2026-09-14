import cors from 'cors';
import express from 'express';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.js';
import type { EnhancementRequest, GenerationRequest } from './types.js';
import { generationSchema } from './validation.js';
import { addGeneration, deleteGeneration, getGeneration, listGenerations } from './services/historyService.js';
import { getGpuStatus } from './services/gpuService.js';
import { getAiHealth, requestImageEnhancement, requestImageGeneration } from './services/aiServiceClient.js';

const app = express();
app.use(cors({ origin: ['http://localhost:4200', 'http://127.0.0.1:4200'] }));
app.use(express.json({ limit: '15mb' }));
app.use('/generated', express.static(config.generatedDir));

app.get('/api/system/gpu', async (_request, response) => response.json(await getGpuStatus()));
app.get('/api/system/health', async (_request, response) => response.json({ backend: true, aiService: await getAiHealth() }));
app.get('/api/models', (_request, response) => response.json([{ id: 'sdxl-turbo', name: 'SDXL Turbo', description: 'Fast local text-to-image model for 8GB GPUs' }]));
app.get('/api/generations', async (_request, response) => response.json(await listGenerations()));
app.get('/api/generations/:id', async (request, response) => {
  const generation = await getGeneration(request.params.id);
  return generation ? response.json(generation) : response.status(404).json({ error: 'Generation not found' });
});
app.delete('/api/generations/:id', async (request, response) => response.json({ deleted: await deleteGeneration(request.params.id) }));

app.post('/api/generate', async (request, response) => {
  const parsed = generationSchema.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ error: 'Invalid generation settings', details: parsed.error.flatten() });
  try {
    const generationRequest = parsed.data as GenerationRequest;
    const generated = await requestImageGeneration(generationRequest);
    const id = randomUUID();
    const fileName = `${id}.png`;
    await mkdir(config.generatedDir, { recursive: true });
    await writeFile(path.join(config.generatedDir, fileName), Buffer.from(generated.imageBase64, 'base64'));
    const generation = { ...generationRequest, id, seed: generated.seed, imageUrl: `/generated/${fileName}`, createdAt: new Date().toISOString(), durationMs: generated.durationMs };
    await addGeneration(generation);
    return response.status(201).json(generation);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Image generation failed';
    return response.status(502).json({ error: message });
  }
});

app.post('/api/enhance', async (request, response) => {
  const body = request.body as Partial<EnhancementRequest>;
  const validImage = typeof body.imageBase64 === 'string' && body.imageBase64.length > 100 && body.imageBase64.length <= 12_000_000 && /^[A-Za-z0-9+/=]+$/.test(body.imageBase64);
  const validText = typeof body.prompt === 'string' && body.prompt.trim().length <= 2_000;
  const validNumber = [512, 768, 1024].includes(Number(body.width)) && [512, 768, 1024].includes(Number(body.height));
  const strength = Number(body.strength ?? 0.35);
  if (!validImage || !validText || !validNumber || !Number.isFinite(strength) || strength < 0.1 || strength > 0.8) {
    return response.status(400).json({ error: 'Invalid enhancement settings or image. Use a supported image under 9MB and strength from 0.1 to 0.8.' });
  }
  try {
    const enhancementRequest = { imageBase64: body.imageBase64, prompt: body.prompt?.trim() || 'Enhance this image with natural detail and clean lighting', negativePrompt: body.negativePrompt ?? '', model: body.model ?? 'sdxl-turbo', width: Number(body.width), height: Number(body.height), strength } as EnhancementRequest;
    const enhanced = await requestImageEnhancement(enhancementRequest);
    const id = randomUUID();
    const fileName = `${id}.png`;
    await mkdir(config.generatedDir, { recursive: true });
    await writeFile(path.join(config.generatedDir, fileName), Buffer.from(enhanced.imageBase64, 'base64'));
    const generation = { prompt: enhancementRequest.prompt, negativePrompt: enhancementRequest.negativePrompt, model: enhancementRequest.model, width: enhancementRequest.width, height: enhancementRequest.height, count: 1 as const, id, seed: enhanced.seed, imageUrl: `/generated/${fileName}`, createdAt: new Date().toISOString(), durationMs: enhanced.durationMs };
    await addGeneration(generation);
    return response.status(201).json(generation);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Image enhancement failed';
    return response.status(502).json({ error: message });
  }
});

app.listen(config.port, '127.0.0.1', () => console.log(`Joren AI Studio backend listening on http://127.0.0.1:${config.port}`));
