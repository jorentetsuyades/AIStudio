import { z } from 'zod';

export const generationSchema = z.object({
  prompt: z.string().trim().min(1).max(2_000),
  negativePrompt: z.string().trim().max(2_000).default(''),
  model: z.string().regex(/^[a-zA-Z0-9._-]+$/).default('sdxl-turbo'),
  width: z.union([z.literal(512), z.literal(768), z.literal(1024)]).default(512),
  height: z.union([z.literal(512), z.literal(768), z.literal(1024)]).default(512),
  count: z.literal(1).default(1),
  seed: z.number().int().min(0).max(4_294_967_295).optional(),
});
