import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { config } from '../config.js';
import type { GenerationRecord } from '../types.js';

async function readHistory(): Promise<GenerationRecord[]> {
  try {
    return JSON.parse(await readFile(config.historyFile, 'utf8')) as GenerationRecord[];
  } catch {
    return [];
  }
}

export async function listGenerations(): Promise<GenerationRecord[]> {
  return (await readHistory()).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function getGeneration(id: string): Promise<GenerationRecord | undefined> {
  return (await readHistory()).find((generation) => generation.id === id);
}

export async function addGeneration(generation: GenerationRecord): Promise<void> {
  await mkdir(config.dataDir, { recursive: true });
  const history = await readHistory();
  await writeFile(config.historyFile, JSON.stringify([generation, ...history].slice(0, 100), null, 2));
}

export async function deleteGeneration(id: string): Promise<boolean> {
  const history = await readHistory();
  const next = history.filter((generation) => generation.id !== id);
  if (next.length === history.length) return false;
  await writeFile(config.historyFile, JSON.stringify(next, null, 2));
  return true;
}
