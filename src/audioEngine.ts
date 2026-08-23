import type { AudioFeatures } from './types';

export interface AudioBufferInfo {
  context: AudioContext;
  buffer: AudioBuffer;
}

let sharedContext: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (!sharedContext) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    sharedContext = new Ctor();
  }
  if (sharedContext.state === 'suspended') {
    void sharedContext.resume();
  }
  return sharedContext;
}

export async function decodeAudioFile(file: File): Promise<AudioBufferInfo> {
  const ctx = getAudioContext();
  const arrayBuffer = await file.arrayBuffer();
  const buffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
  return { context: ctx, buffer };
}

/**
 * Real acoustic analysis using Web Audio API.
 * Renders the audio offline through an AnalyserNode, reads real FFT bins,
 * and computes spectral centroid, high-frequency noise ratio, peak frequency,
 * pitch jitter, zero-crossing rate, and speech-band energy ratio.
 *
 * A sound is classified as "speech" when a meaningful portion of its spectral
 * energy falls within the human voice band (300–3400 Hz). Non-speech sounds
 * (silence, tongue-rolling, high-frequency noise) are flagged accordingly
 * so the scoring engine can assign them a near-zero risk score.
 */
export async function analyzeAudioBuffer(buffer: AudioBuffer): Promise<AudioFeatures> {
  const sampleRate = buffer.sampleRate;
  const channelData = buffer.getChannelData(0);
  const length = buffer.length;
  const durationSec = buffer.duration;

  // --- Time-domain features from raw samples ---
  let sumSquares = 0;
  let peak = 0;
  let zeroCrossings = 0;
  let prevSign = 0;
  for (let i = 0; i < length; i++) {
    const s = channelData[i];
    sumSquares += s * s;
    const abs = Math.abs(s);
    if (abs > peak) peak = abs;
    const sign = s >= 0 ? 1 : -1;
    if (i > 0 && sign !== prevSign) zeroCrossings++;
    prevSign = sign;
  }
  const rms = Math.sqrt(sumSquares / Math.max(1, length));
  const rmsVolume = Math.min(1, rms * 3.2);
  const peakDb = 20 * Math.log10(Math.max(1e-6, peak));
  const zeroCrossingRate = zeroCrossings / Math.max(1, length);

  // --- Real FFT analysis via OfflineAudioContext + AnalyserNode ---
  const fftSize = 2048;
  const offline = new OfflineAudioContext(1, length, sampleRate);
  const source = offline.createBufferSource();
  source.buffer = buffer;
  const analyser = offline.createAnalyser();
  analyser.fftSize = fftSize;
  analyser.smoothingTimeConstant = 0.3;
  source.connect(analyser);
  analyser.connect(offline.destination);

  const binCount = analyser.frequencyBinCount;
  const nyquist = sampleRate / 2;
  const binHz = nyquist / binCount;
  const highCutoffBin = Math.floor((6000 / nyquist) * binCount);
  const speechLowBin = Math.floor((300 / nyquist) * binCount);
  const speechHighBin = Math.floor((3400 / nyquist) * binCount);

  const frames: Uint8Array[] = [];
  const captureInterval = Math.floor(sampleRate * 0.1);
  const scriptProcessor = offline.createScriptProcessor(4096, 1, 1);
  let sampleCounter = 0;
  scriptProcessor.onaudioprocess = (e) => {
    sampleCounter += 4096;
    if (sampleCounter >= captureInterval) {
      sampleCounter = 0;
      const freqData = new Uint8Array(binCount);
      analyser.getByteFrequencyData(freqData);
      frames.push(freqData);
    }
    const input = e.inputBuffer.getChannelData(0);
    const output = e.outputBuffer.getChannelData(0);
    output.set(input);
  };
  source.connect(scriptProcessor);
  scriptProcessor.connect(offline.destination);

  await offline.startRendering();

  // --- Compute features from real FFT frames ---
  let centroidSum = 0;
  let magSum = 0;
  let highMagSum = 0;
  let totalMagSum = 0;
  let peakMag = 0;
  let peakBin = 0;
  let jitterSum = 0;
  let lastCentroid = 0;
  let frameCount = 0;
  let speechEnergySum = 0;
  let totalEnergySum = 0;

  for (const freqData of frames) {
    let frameCentroid = 0;
    let frameMag = 0;
    let frameHighMag = 0;
    let frameTotalMag = 0;
    let framePeakMag = 0;
    let framePeakBin = 0;
    let frameSpeechEnergy = 0;

    for (let b = 0; b < binCount; b++) {
      const mag = freqData[b] / 255;
      const freq = b * binHz;
      frameCentroid += freq * mag;
      frameMag += mag;
      frameTotalMag += mag;
      if (b >= highCutoffBin) frameHighMag += mag;
      if (b >= speechLowBin && b <= speechHighBin) frameSpeechEnergy += mag;
      if (mag > framePeakMag) {
        framePeakMag = mag;
        framePeakBin = b;
      }
    }

    const centroid = frameMag > 0 ? frameCentroid / frameMag : 0;

    centroidSum += centroid * frameMag;
    magSum += frameMag;
    highMagSum += frameHighMag;
    totalMagSum += frameTotalMag;
    speechEnergySum += frameSpeechEnergy;
    totalEnergySum += frameTotalMag;

    if (framePeakMag > peakMag) {
      peakMag = framePeakMag;
      peakBin = framePeakBin;
    }

    if (lastCentroid > 0) {
      jitterSum += Math.abs(centroid - lastCentroid) / Math.max(1, lastCentroid);
    }
    lastCentroid = centroid;
    frameCount++;
  }

  const spectralCentroidHz = magSum > 0 ? centroidSum / magSum : 0;
  const highFreqNoiseRatio = totalMagSum > 0 ? highMagSum / totalMagSum : 0;
  const pitchJitter = frameCount > 1 ? Math.min(1, jitterSum / frameCount) : 0;
  const peakFrequencyHz = Math.max(0, peakBin * binHz);
  const speechEnergyRatio = totalEnergySum > 0 ? speechEnergySum / totalEnergySum : 0;

  // A sound is classified as speech when at least 15% of its spectral energy
  // lies in the human voice band (300–3400 Hz) and there is meaningful
  // overall energy (not silence). The lower threshold ensures most real
  // speech audio (including quiet or noisy recordings) triggers STT.
  // Pure noise/silence still falls below this threshold.
  const hasSignificantEnergy = rmsVolume > 0.005;
  const isSpeech = hasSignificantEnergy && speechEnergyRatio >= 0.15;

  return {
    durationSec,
    rmsVolume,
    peakDb,
    peakFrequencyHz,
    spectralCentroidHz,
    highFreqNoiseRatio,
    pitchJitter,
    zeroCrossingRate,
    isSpeech,
  };
}
