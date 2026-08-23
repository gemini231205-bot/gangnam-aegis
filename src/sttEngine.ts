/**
 * On-device Speech-to-Text using Transformers.js (Whisper) in a Web Worker.
 * All model loading, resampling, and inference run off the main thread
 * to prevent UI freezing during audio transcription.
 */

import type { AudioFeatures } from './types';

export interface SttResult {
  transcript: string;
  modelLoaded: boolean;
  error?: string;
}

let worker: Worker | null = null;
let preloadPromise: Promise<void> | null = null;
let preloadResolve: (() => void) | null = null;
let preloadReject: ((err: Error) => void) | null = null;
let pendingResolve: ((result: SttResult) => void) | null = null;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./sttWorker.ts', import.meta.url), { type: 'module' });

    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data;
      if (msg.type === 'ready') {
        if (preloadResolve) preloadResolve();
      } else if (msg.type === 'progress') {
        // Progress updates are informational only
      } else if (msg.type === 'result') {
        if (pendingResolve) {
          pendingResolve({
            transcript: msg.transcript || '',
            modelLoaded: !msg.error || msg.error === '',
            error: msg.error,
          });
          pendingResolve = null;
        }
      } else if (msg.type === 'error') {
        if (preloadReject) {
          preloadReject(new Error(msg.error));
        }
        if (pendingResolve) {
          pendingResolve({ transcript: '', modelLoaded: false, error: msg.error });
          pendingResolve = null;
        }
      }
    };

    worker.onerror = (e: ErrorEvent) => {
      if (preloadReject) {
        preloadReject(new Error(e.message || 'Worker error'));
        preloadReject = null;
        preloadResolve = null;
        preloadPromise = null;
      }
      if (pendingResolve) {
        pendingResolve({ transcript: '', modelLoaded: false, error: e.message || 'Worker error' });
        pendingResolve = null;
      }
    };
  }
  return worker;
}

/**
 * Run Whisper STT on the given audio buffer. Returns the recognized text.
 * All processing happens in a Web Worker — the main thread stays responsive.
 */
export async function runStt(
  buffer: AudioBuffer,
  _features: AudioFeatures
): Promise<SttResult> {
  return new Promise<SttResult>((resolve) => {
    if (pendingResolve) {
      resolve({ transcript: '', modelLoaded: false, error: '이미 처리 중입니다.' });
      return;
    }
    pendingResolve = resolve;

    const w = getWorker();

    // Extract channel data for transfer (cannot send AudioBuffer directly)
    const numChannels = buffer.numberOfChannels;
    const channelData: Float32Array[] = [];
    for (let ch = 0; ch < numChannels; ch++) {
      channelData.push(new Float32Array(buffer.getChannelData(ch)));
    }

    w.postMessage(
      {
        type: 'transcribe',
        audio: {
          channelData,
          sampleRate: buffer.sampleRate,
          numberOfChannels: buffer.numberOfChannels,
          length: buffer.length,
        },
      }
    );
  });
}

/** Preload the Whisper model in the worker so the first real analysis is faster. */
export async function preloadSttModel(): Promise<void> {
  if (preloadPromise) return preloadPromise;
  preloadPromise = new Promise<void>((resolve, reject) => {
    preloadResolve = resolve;
    preloadReject = reject;
    const w = getWorker();
    w.postMessage({ type: 'preload' });
  });
  return preloadPromise;
}

/** Check if the STT model is available (loaded or loading). */
export function isSttModelReady(): boolean {
  return preloadPromise !== null;
}

/** Get current model load progress message (for UI display). */
export function getSttLoadProgress(): string | null {
  return null;
}

/** Reset model load error so we can retry. */
export function resetSttError(): void {
  // Worker manages its own state; nothing to reset on the main thread side
}
