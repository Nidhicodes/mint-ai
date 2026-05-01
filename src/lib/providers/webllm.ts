/**
 * WebLLM provider — runs LLMs directly in the browser via WebGPU.
 * Zero cost, fully offline, complete privacy.
 *
 * Uses @mlc-ai/web-llm which exposes an OpenAI-compatible chat completions API.
 * The model is downloaded once (~2-4GB) and cached in the browser's Cache API.
 */

import type { Message } from '../types';

// Lazy-loaded engine instance (singleton)
let enginePromise: Promise<any> | null = null;
let currentModel: string | null = null;

// Progress callback for model download
type ProgressCallback = (progress: { text: string; progress: number }) => void;
let onProgressCallback: ProgressCallback | null = null;

/** Default model for WebLLM — good balance of size and code quality */
export const WEBLLM_DEFAULT_MODEL = 'Qwen2.5-Coder-7B-Instruct-q4f16_1-MLC';

/** Smaller fallback if user has limited VRAM */
export const WEBLLM_SMALL_MODEL = 'Phi-3.5-mini-instruct-q4f16_1-MLC';

/** Available WebLLM models for the UI */
export const WEBLLM_MODELS = [
  { id: 'Qwen2.5-Coder-7B-Instruct-q4f16_1-MLC', name: 'Qwen 2.5 Coder 7B (recommended)', size: '~4.5GB' },
  { id: 'Phi-3.5-mini-instruct-q4f16_1-MLC', name: 'Phi 3.5 Mini (smaller)', size: '~2.2GB' },
  { id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC', name: 'Llama 3.2 3B (fastest)', size: '~2GB' },
];

/** Check if WebGPU is available in this browser */
export function isWebGPUAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator;
}

/** Set a callback for model download progress */
export function setProgressCallback(cb: ProgressCallback | null) {
  onProgressCallback = cb;
}

/** Get or create the WebLLM engine for the given model */
async function getEngine(model: string) {
  if (enginePromise && currentModel === model) {
    return enginePromise;
  }

  // If switching models, reset
  if (enginePromise && currentModel !== model) {
    try {
      const oldEngine = await enginePromise;
      await oldEngine.unload();
    } catch { /* ignore cleanup errors */ }
    enginePromise = null;
  }

  currentModel = model;
  enginePromise = (async () => {
    let CreateMLCEngine: any;
    try {
      const mod = await import('@mlc-ai/web-llm');
      CreateMLCEngine = mod.CreateMLCEngine;
    } catch {
      throw new Error(
        'WebLLM failed to load. Your browser may not support WebGPU. ' +
        'Try switching to a cloud provider (DeepSeek, OpenAI) in Settings.'
      );
    }
    const engine = await CreateMLCEngine(model, {
      initProgressCallback: (report: any) => {
        onProgressCallback?.({
          text: report.text ?? 'Loading model...',
          progress: report.progress ?? 0,
        });
      },
    });
    return engine;
  })();

  return enginePromise;
}

/** Stream chat completions from WebLLM (OpenAI-compatible interface) */
export async function* streamWebLLM(
  model: string,
  messages: Message[],
): AsyncGenerator<string> {
  const engine = await getEngine(model);

  const response = await engine.chat.completions.create({
    messages,
    stream: true,
    max_tokens: 8192,
    temperature: 0.7,
  });

  for await (const chunk of response) {
    const content = chunk.choices?.[0]?.delta?.content;
    if (content) yield content;
  }
}

/** Unload the current model to free VRAM */
export async function unloadWebLLM() {
  if (enginePromise) {
    try {
      const engine = await enginePromise;
      await engine.unload();
    } catch { /* ignore */ }
    enginePromise = null;
    currentModel = null;
  }
}
