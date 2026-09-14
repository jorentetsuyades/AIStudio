import path from 'node:path';

const rootDir = path.resolve(process.cwd(), '..');

export const config = {
  port: Number(process.env.PORT ?? 3333),
  aiServiceUrl: process.env.AI_SERVICE_URL ?? 'http://127.0.0.1:8000',
  generatedDir: path.join(rootDir, 'generated'),
  dataDir: path.join(rootDir, 'data'),
  historyFile: path.join(rootDir, 'data', 'generations.json'),
};
