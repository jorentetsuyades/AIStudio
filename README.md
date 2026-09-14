# Joren AI Studio

Joren AI Studio is a local-first text-to-image workspace. Angular provides the UI, the Node.js API owns validation/history/system telemetry, and a local Python Diffusers service performs inference on the NVIDIA GPU. The API binds to `127.0.0.1` by default and never accepts shell commands or arbitrary filesystem paths.

## Current MVP

- Dark responsive Angular studio with prompt, negative prompt, model, resolution, preview, save, regenerate, clear, and history reuse controls.
- Local image enhancement mode with PNG/JPG/WebP upload, img2img strength, output size, before/after preview, and history storage.
- Express REST API with input validation, local JSON metadata storage, restricted generated-image serving, and error handling.
- SDXL Turbo via Hugging Face Diffusers, loaded once and kept in FP16 on CUDA.
- Attention slicing, VAE slicing, VAE tiling, one-image batches, and conservative 512/768/1024 resolution choices for an 8 GB RTX 3070.
- Live `nvidia-smi` GPU telemetry plus system RAM usage.

The Python service must be installed separately because this machine currently has no Python interpreter. The Node/Angular portions are already scaffolded and build successfully.

## Requirements

- Windows 10/11
- Node.js 24.15+ is recommended. Angular 21 is used here because the installed Node version is 24.14.0.
- Python 3.11 or 3.12, added to PATH
- NVIDIA RTX 3070 8 GB or similar, a current NVIDIA driver, and visible `nvidia-smi`
- Enough disk space for the model cache (SDXL Turbo is several GB)

## Install

From PowerShell in the project root:

```powershell
npm --prefix backend install
npm --prefix frontend install

python -m venv ai-service\.venv
ai-service\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
```

Install a CUDA-enabled PyTorch build using the command recommended by the [official PyTorch selector](https://pytorch.org/get-started/locally/). For example, a current CUDA wheel may look like:

```powershell
python -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cu128
python -m pip install -r ai-service\requirements.txt
```

Verify CUDA before starting the app:

```powershell
python -c "import torch; print(torch.cuda.is_available()); print(torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'CUDA unavailable')"
nvidia-smi
```

The first generation downloads `stabilityai/sdxl-turbo` from Hugging Face into the local model cache. No paid AI API or cloud generation endpoint is used; model download is only setup, and inference runs locally afterward.

## Run

Open three PowerShell terminals in the project root:

```powershell
npm run start:ai-service
```

```powershell
npm run start:backend
```

```powershell
npm run start:frontend
```

Open `http://localhost:4200`. The backend is `http://127.0.0.1:3333`; the inference service is `http://127.0.0.1:8000`.

The frontend checks `/api/system/health` every five seconds. When the local backend and AI service are reachable, it shows **Local services ready**. When the frontend is deployed to GitHub Pages or the services are stopped, it shows **Frontend demo - local services unavailable**. The interface remains available for testing, but generation and enhancement require the local services.

## GitHub Pages frontend

This repository includes `.github/workflows/deploy-pages.yml`, which builds and deploys the Angular frontend automatically whenever `main` changes.

One-time setup on GitHub:

1. Open the repository **Settings**.
2. Select **Pages** under **Code and automation**.
3. Set **Source** to **GitHub Actions**.
4. Push to `main` or run the **Deploy Angular frontend to GitHub Pages** workflow manually under **Actions**.

The site URL will be:

```text
https://jorentetsuyades.github.io/AIStudio/
```

You can also publish the Angular build manually. From the `frontend` directory, build with your repository name as the base path:

```powershell
npm run build -- --base-href /YOUR-REPOSITORY-NAME/
```

Publish `frontend/dist/frontend/browser` with GitHub Pages. GitHub Pages cannot run Node, Python, CUDA, or the SDXL model. Also, a GitHub Pages HTTPS page generally cannot call the local HTTP API directly because of browser mixed-content restrictions. Use `http://localhost:4200` for full generation testing; use GitHub Pages to preview the interface and verify the offline-service checker.

## API

- `POST /api/generate` creates one local image. Body: `prompt`, `negativePrompt`, `model`, `width`, `height`, `count`, optional `seed`.
- `POST /api/enhance` refines one uploaded base64 PNG/JPG/WebP image locally. Body: `imageBase64`, `prompt`, `negativePrompt`, `model`, `width`, `height`, and `strength` from `0.1` to `0.8`.
- `GET /api/generations` lists the most recent 100 local records.
- `GET /api/generations/:id` gets one record.
- `DELETE /api/generations/:id` deletes metadata for one record.
- `GET /api/models` lists configured models.
- `GET /api/system/gpu` returns NVIDIA and RAM telemetry.
- `GET /api/system/health` reports backend and AI-service availability.

Generated files are stored only under `generated/`; metadata is stored in `data/generations.json`.

## Architecture

```text
frontend/       Angular standalone UI and local API client
backend/        Express routes, validation, history, telemetry, AI client
ai-service/     FastAPI + Diffusers CUDA inference boundary
generated/      Generated PNG files (ignored by Git)
data/           Local generation metadata (ignored by Git)
```

The AI client is deliberately separate from API routes so image-to-image, inpainting, queues, LoRA, and additional model adapters can be added without making the HTTP layer model-specific. Only one pipeline is loaded at a time.

## Enhance an image

Start all three services, open `http://localhost:4200`, and select **Enhance** in the sidebar. Choose a local PNG, JPG, or WebP under 9MB. Use **High** to preserve the source closely, **Balanced** for a moderate cleanup, or **Creative** for a stronger reinterpretation. Add a short direction such as `restore natural detail, improve lighting, keep the original composition`, choose the output size, and select **Enhance image**.

The first enhancement in a fresh process loads the same SDXL Turbo model used for generation. It does not load a second model, but it still requires several GB of VRAM and may take a few minutes on an RTX 3070.

## Troubleshooting

- **Python is not recognized:** install Python 3.11/3.12 and reopen PowerShell. Then recreate `ai-service\.venv`.
- **CUDA unavailable:** install the CUDA-enabled PyTorch wheel, confirm the NVIDIA driver with `nvidia-smi`, and run the CUDA verification command above.
- **Out of memory:** use 512 x 512, close GPU-heavy applications, and avoid changing `count` above one. The service already enables FP16, attention slicing, and VAE optimizations.
- **AI service offline in the UI:** start `npm run start:ai-service` after activating the virtual environment.
- **Port in use:** set `PORT=3334` for the backend or change the corresponding frontend `apiUrl` in `frontend/src/app/app.ts`.

## Verification

```powershell
npm --prefix backend run build
npm --prefix frontend run build
Invoke-RestMethod http://127.0.0.1:3333/api/system/gpu
```

An actual GPU image-generation smoke test requires the Python/CUDA setup above; this host did not have Python installed at scaffold time.