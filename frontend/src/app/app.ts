import { Component, OnInit, signal } from '@angular/core';

@Component({
  selector: 'app-root',
  imports: [],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  protected readonly prompt = signal('A futuristic cyberpunk motorcycle parked on a neon-lit Tokyo street at night, cinematic lighting, photorealistic');
  protected readonly negativePrompt = signal('blurry, distorted, low quality, watermark');
  protected readonly model = signal('sdxl-turbo');
  protected readonly resolution = signal('512');
  protected readonly enhancementStrength = signal('0.35');
  protected readonly sourceImage = signal<string | null>(null);
  protected readonly activeView = signal('Generate');
  protected readonly isGenerating = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly result = signal<Generation | null>(null);
  protected readonly history = signal<Generation[]>([]);
  protected readonly gpu = signal<GpuStatus | null>(null);
  protected readonly localStatus = signal('Checking local services...');
  protected readonly aiServiceOnline = signal(false);

  private readonly apiUrl = 'http://127.0.0.1:3333/api';

  ngOnInit(): void {
    void this.loadHistory();
    void this.refreshGpu();
    void this.refreshHealth();
    window.setInterval(() => { void this.refreshGpu(); void this.refreshHealth(); }, 5000);
  }

  protected async generate(): Promise<void> {
    this.isGenerating.set(true);
    this.errorMessage.set('');
    try {
      const response = await fetch(`${this.apiUrl}/generate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt: this.prompt(), negativePrompt: this.negativePrompt(), model: this.model(), width: Number(this.resolution()), height: Number(this.resolution()), count: 1 })
      });
      const data = await response.json() as Generation | { error?: string };
      if (!response.ok) throw new Error('error' in data ? data.error : 'Generation failed');
      this.result.set(data as Generation);
      await this.loadHistory();
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : 'Unable to reach the local AI service.');
    } finally {
      this.isGenerating.set(false);
    }
  }

  protected onImageSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.item(0);
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 9 * 1024 * 1024) {
      this.errorMessage.set('Choose a PNG, JPG, or WebP image smaller than 9MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => this.sourceImage.set(String(reader.result));
    reader.readAsDataURL(file);
    this.errorMessage.set('');
  }

  protected async enhance(): Promise<void> {
    if (!this.sourceImage()) return;
    this.isGenerating.set(true);
    this.errorMessage.set('');
    try {
      const response = await fetch(`${this.apiUrl}/enhance`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ imageBase64: this.sourceImage()!.split(',')[1], prompt: this.prompt(), negativePrompt: this.negativePrompt(), model: this.model(), width: Number(this.resolution()), height: Number(this.resolution()), strength: Number(this.enhancementStrength()) })
      });
      const data = await response.json() as Generation | { error?: string };
      if (!response.ok) throw new Error('error' in data ? data.error : 'Enhancement failed');
      this.result.set(data as Generation);
      await this.loadHistory();
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : 'Unable to enhance the image.');
    } finally {
      this.isGenerating.set(false);
    }
  }

  protected reuseGeneration(generation: Generation): void {
    this.prompt.set(generation.prompt);
    this.negativePrompt.set(generation.negativePrompt);
    this.model.set(generation.model);
    this.resolution.set(String(generation.width));
    this.result.set(generation);
    this.activeView.set('Generate');
  }

  protected clear(): void {
    this.prompt.set('');
    this.negativePrompt.set('');
    this.result.set(null);
    this.sourceImage.set(null);
    this.errorMessage.set('');
  }

  protected imageUrl(path: string): string {
    return `http://127.0.0.1:3333${path}`;
  }

  private async loadHistory(): Promise<void> {
    try {
      const response = await fetch(`${this.apiUrl}/generations`);
      this.history.set(await response.json() as Generation[]);
    } catch {
      this.errorMessage.set('The backend is offline. Start the local API to generate images.');
    }
  }

  private async refreshGpu(): Promise<void> {
    try {
      this.gpu.set(await (await fetch(`${this.apiUrl}/system/gpu`)).json() as GpuStatus);
    } catch {
      this.gpu.set(null);
    }
  }

  private async refreshHealth(): Promise<void> {
    try {
      const health = await (await fetch(`${this.apiUrl}/system/health`)).json() as { backend: boolean; aiService: { available: boolean } };
      const aiOnline = health.backend && health.aiService.available;
      this.aiServiceOnline.set(aiOnline);
      this.localStatus.set(aiOnline ? 'Local services ready' : 'AI service offline');
    } catch {
      this.aiServiceOnline.set(false);
      this.localStatus.set('Frontend demo · local services unavailable');
    }
  }
}

type Generation = {
  id: string;
  prompt: string;
  negativePrompt: string;
  model: string;
  width: number;
  height: number;
  seed: number;
  imageUrl: string;
  createdAt: string;
  durationMs: number;
};

type GpuStatus = {
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
