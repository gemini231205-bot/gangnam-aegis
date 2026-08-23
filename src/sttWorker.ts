/// <reference lib="webworker" />
/**
 * Web Worker for Whisper STT — runs model load, resampling, and inference
 * off the main thread to prevent UI freezing during audio transcription.
 */

type PipelineFn = (audio: Float32Array, options?: Record<string, unknown>) => Promise<{ text: string }>;

let pipelinePromise: Promise<PipelineFn> | null = null;
let modelLoadError: string | null = null;
let modelLoadProgress: string | null = null;

async function getSttPipeline(): Promise<PipelineFn> {
  if (modelLoadError) throw new Error(modelLoadError);
  if (!pipelinePromise) {
    pipelinePromise = (async () => {
      const transformers = await import('@huggingface/transformers');
      const { pipeline, env } = transformers;

      env.allowLocalModels = false;
      env.useBrowserCache = true;

      const modelConfig = {
        dtype: {
          encoder_model: 'fp32' as const,
          decoder_model_merged: 'fp32' as const,
        },
        progress_callback: (data: unknown) => {
          if (data && typeof data === 'object' && 'progress' in data) {
            const p = data as { progress?: number; file?: string };
            if (p.progress !== undefined && p.file) {
              modelLoadProgress = `${p.file} ${Math.round(p.progress)}%`;
              (self as unknown as DedicatedWorkerGlobalScope).postMessage({
                type: 'progress',
                progress: modelLoadProgress,
              });
            }
          }
        },
      };

      const models = [
        'onnx-community/whisper-small',
        'Xenova/whisper-small',
        'onnx-community/whisper-base',
      ];

      let pipe: unknown = null;
      let lastError: unknown = null;

      for (const modelId of models) {
        try {
          pipe = await pipeline('automatic-speech-recognition', modelId, modelConfig);
          break;
        } catch (err) {
          lastError = err;
        }
      }

      if (!pipe) {
        throw lastError instanceof Error
          ? lastError
          : new Error('모든 Whisper 모델 로드에 실패했습니다.');
      }

      modelLoadProgress = null;
      return pipe as unknown as PipelineFn;
    })();
    pipelinePromise.catch((err) => {
      modelLoadError = err instanceof Error ? err.message : String(err);
      pipelinePromise = null;
    });
  }
  return pipelinePromise;
}

function resampleTo16k(buffer: {
  sampleRate: number;
  numberOfChannels: number;
  getChannelData: (ch: number) => Float32Array;
  length: number;
}): Float32Array {
  const targetRate = 16000;
  const sourceRate = buffer.sampleRate;

  const numChannels = buffer.numberOfChannels;
  let channelData: Float32Array;
  if (numChannels > 1) {
    const len = buffer.getChannelData(0).length;
    channelData = new Float32Array(len);
    for (let ch = 0; ch < numChannels; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        channelData[i] += data[i] / numChannels;
      }
    }
  } else {
    channelData = new Float32Array(buffer.getChannelData(0));
  }

  let result: Float32Array;
  if (sourceRate === targetRate) {
    result = channelData;
  } else if (sourceRate > targetRate) {
    const cutoffRatio = targetRate / sourceRate;
    const filterSize = Math.max(2, Math.floor(1 / cutoffRatio) * 2 + 1);
    const halfSize = Math.floor(filterSize / 2);

    const filter = new Float32Array(filterSize);
    for (let i = 0; i < filterSize; i++) {
      const n = i - halfSize;
      if (n === 0) {
        filter[i] = cutoffRatio;
      } else {
        filter[i] = (Math.sin(Math.PI * cutoffRatio * n) / (Math.PI * n)) * cutoffRatio;
      }
    }
    let filterSum = 0;
    for (let i = 0; i < filterSize; i++) filterSum += filter[i];
    for (let i = 0; i < filterSize; i++) filter[i] /= filterSum;

    const ratio = targetRate / sourceRate;
    const newLength = Math.floor(channelData.length * ratio);
    result = new Float32Array(newLength);
    for (let i = 0; i < newLength; i++) {
      const srcIdx = Math.floor(i / ratio);
      let sum = 0;
      for (let j = 0; j < filterSize; j++) {
        const idx = srcIdx - halfSize + j;
        if (idx >= 0 && idx < channelData.length) {
          sum += channelData[idx] * filter[j];
        }
      }
      result[i] = sum;
    }
  } else {
    const ratio = targetRate / sourceRate;
    const newLength = Math.floor(channelData.length * ratio);
    result = new Float32Array(newLength);
    for (let i = 0; i < newLength; i++) {
      const srcIdx = i / ratio;
      const idx0 = Math.floor(srcIdx);
      const idx1 = Math.min(idx0 + 1, channelData.length - 1);
      const frac = srcIdx - idx0;
      result[i] = channelData[idx0] * (1 - frac) + channelData[idx1] * frac;
    }
  }

  let peak = 0;
  for (let i = 0; i < result.length; i++) {
    const abs = Math.abs(result[i]);
    if (abs > peak) peak = abs;
  }
  if (peak > 0) {
    const scale = 0.95 / peak;
    for (let i = 0; i < result.length; i++) {
      result[i] *= scale;
    }
  }

  const noiseGateThreshold = 0.008;
  for (let i = 0; i < result.length; i++) {
    if (Math.abs(result[i]) < noiseGateThreshold) {
      result[i] = 0;
    }
  }

  return result;
}

function isHallucination(text: string): boolean {
  const hallucinations = [
    'you', 'thank you', 'thanks for watching', 'please subscribe',
    'amara', ' subtitles', 'the end',
  ];
  const lower = text.toLowerCase().trim();
  if (hallucinations.some((h) => lower === h)) return true;

  const words = text.split(/\s+/);
  if (words.length >= 5) {
    const wordCount = new Map<string, number>();
    for (const w of words) {
      wordCount.set(w, (wordCount.get(w) ?? 0) + 1);
    }
    for (const [, count] of wordCount) {
      if (count >= 5) return true;
    }
  }
  return false;
}

self.onmessage = async (e: MessageEvent) => {
  const msg = e.data;

  if (msg.type === 'preload') {
    try {
      await getSttPipeline();
      (self as unknown as DedicatedWorkerGlobalScope).postMessage({ type: 'ready' });
    } catch (err) {
      (self as unknown as DedicatedWorkerGlobalScope).postMessage({
        type: 'error',
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return;
  }

  if (msg.type === 'transcribe') {
    try {
      const pipe = await getSttPipeline();

      // Reconstruct AudioBuffer-like object from transferred channel data
      const { channelData, sampleRate, numberOfChannels, length } = msg.audio;
      const fakeBuffer = {
        sampleRate,
        numberOfChannels,
        length,
        getChannelData: (ch: number) => channelData[ch] as Float32Array,
      };

      const audio16k = resampleTo16k(fakeBuffer);

      if (audio16k.length < 1600) {
        (self as unknown as DedicatedWorkerGlobalScope).postMessage({
          type: 'result',
          transcript: '',
          error: '오디오가 너무 짧습니다 (0.1초 미만).',
        });
        return;
      }

      const maxSamples = 16000 * 300;
      const audioToProcess = audio16k.length > maxSamples ? audio16k.slice(0, maxSamples) : audio16k;

      const output = await pipe(audioToProcess, {
        chunk_length_s: 30,
        stride_length_s: 2,
        language: 'korean',
        task: 'transcribe',
        return_timestamps: false,
      });
      const text = (output.text || '').trim();

      if (text.length < 2 || isHallucination(text)) {
        (self as unknown as DedicatedWorkerGlobalScope).postMessage({
          type: 'result',
          transcript: '',
          error: '음성을 인식할 수 없습니다. (비음성 또는 잡음)',
        });
        return;
      }

      (self as unknown as DedicatedWorkerGlobalScope).postMessage({
        type: 'result',
        transcript: text,
      });
    } catch (err) {
      (self as unknown as DedicatedWorkerGlobalScope).postMessage({
        type: 'result',
        transcript: '',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
};
