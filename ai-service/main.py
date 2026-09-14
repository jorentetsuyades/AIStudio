import base64
import io
import os
import time
from typing import Optional

import torch
from diffusers import AutoPipelineForImage2Image, AutoPipelineForText2Image
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from PIL import Image

MODEL_ID = os.getenv('MODEL_ID', 'stabilityai/sdxl-turbo')
DEVICE = 'cuda' if torch.cuda.is_available() else 'cpu'
DTYPE = torch.float16 if DEVICE == 'cuda' else torch.float32
app = FastAPI(title='Joren AI Studio local inference service')
pipeline = None

class GenerationRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=2000)
    negativePrompt: str = Field(default='', max_length=2000)
    model: str = Field(default='sdxl-turbo', pattern=r'^[a-zA-Z0-9._-]+$')
    width: int = Field(default=512)
    height: int = Field(default=512)
    count: int = Field(default=1, le=1)
    seed: Optional[int] = Field(default=None, ge=0, le=4294967295)

class EnhancementRequest(BaseModel):
    imageBase64: str = Field(min_length=100, max_length=12_000_000)
    prompt: str = Field(default='Enhance this image with natural detail and clean lighting', max_length=2000)
    negativePrompt: str = Field(default='', max_length=2000)
    model: str = Field(default='sdxl-turbo', pattern=r'^[a-zA-Z0-9._-]+$')
    width: int = Field(default=512)
    height: int = Field(default=512)
    strength: float = Field(default=0.35, ge=0.1, le=0.8)
    seed: Optional[int] = Field(default=None, ge=0, le=4294967295)

def load_pipeline():
    global pipeline
    if pipeline is not None:
        return pipeline
    if DEVICE != 'cuda':
        raise RuntimeError('CUDA is unavailable. Install an NVIDIA CUDA-enabled PyTorch build.')
    pipeline = AutoPipelineForText2Image.from_pretrained(MODEL_ID, torch_dtype=DTYPE, variant='fp16', use_safetensors=True)
    pipeline.to('cuda')
    pipeline.enable_attention_slicing()
    pipeline.vae.enable_slicing()
    pipeline.vae.enable_tiling()
    return pipeline

@app.get('/health')
def health():
    return {'available': DEVICE == 'cuda', 'device': DEVICE, 'model': MODEL_ID}

@app.post('/generate')
def generate(request: GenerationRequest):
    if request.width not in (512, 768, 1024) or request.height not in (512, 768, 1024):
        raise HTTPException(status_code=400, detail='Resolution must be 512, 768, or 1024.')
    started = time.perf_counter()
    try:
        generator = torch.Generator(device='cuda').manual_seed(request.seed) if request.seed is not None else None
        image = load_pipeline()(prompt=request.prompt, negative_prompt=request.negativePrompt, width=request.width, height=request.height, num_images_per_prompt=1, num_inference_steps=4, guidance_scale=0.0, generator=generator).images[0]
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error)) from error
    buffer = io.BytesIO()
    image.save(buffer, format='PNG')
    seed = request.seed if request.seed is not None else int(torch.randint(0, 4294967295, (1,)).item())
    return {'imageBase64': base64.b64encode(buffer.getvalue()).decode('ascii'), 'seed': seed, 'durationMs': round((time.perf_counter() - started) * 1000)}

@app.post('/enhance')
def enhance(request: EnhancementRequest):
    if request.width not in (512, 768, 1024) or request.height not in (512, 768, 1024):
        raise HTTPException(status_code=400, detail='Resolution must be 512, 768, or 1024.')
    started = time.perf_counter()
    try:
        source = Image.open(io.BytesIO(base64.b64decode(request.imageBase64))).convert('RGB')
        source = source.resize((request.width, request.height), Image.Resampling.LANCZOS)
        generator = torch.Generator(device='cuda').manual_seed(request.seed) if request.seed is not None else None
        image_pipe = AutoPipelineForImage2Image.from_pipe(load_pipeline())
        image = image_pipe(prompt=request.prompt, negative_prompt=request.negativePrompt, image=source, strength=request.strength, num_inference_steps=4, guidance_scale=0.0, generator=generator).images[0]
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error)) from error
    buffer = io.BytesIO()
    image.save(buffer, format='PNG')
    seed = request.seed if request.seed is not None else int(torch.randint(0, 4294967295, (1,)).item())
    return {'imageBase64': base64.b64encode(buffer.getvalue()).decode('ascii'), 'seed': seed, 'durationMs': round((time.perf_counter() - started) * 1000)}
