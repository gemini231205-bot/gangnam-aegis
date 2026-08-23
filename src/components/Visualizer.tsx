import { useEffect, useRef } from 'react';

interface VisualizerProps {
  audioBuffer: AudioBuffer | null;
  isAnalyzing: boolean;
  isPlaying: boolean;
  isRecording: boolean;
}

export default function Visualizer({ audioBuffer, isAnalyzing, isPlaying, isRecording }: VisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    let liveAnalyser: AnalyserNode | null = null;
    let liveSource: AudioBufferSourceNode | null = null;
    let liveCtx: AudioContext | null = null;

    if (audioBuffer && isPlaying) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      liveCtx = new Ctor();
      liveAnalyser = liveCtx.createAnalyser();
      liveAnalyser.fftSize = 2048;
      liveAnalyser.smoothingTimeConstant = 0.8;
      liveSource = liveCtx.createBufferSource();
      liveSource.buffer = audioBuffer;
      liveSource.connect(liveAnalyser);
      liveAnalyser.connect(liveCtx.destination);
      liveSource.start();
      liveSource.onended = () => {
        // Playback finished — visualizer will naturally go idle on next render
      };
    }

    const freqData = new Uint8Array(liveAnalyser ? liveAnalyser.frequencyBinCount : 1024);
    const timeData = new Uint8Array(liveAnalyser ? liveAnalyser.fftSize : 2048);

    let phase = 0;

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      ctx.clearRect(0, 0, w, h);

      // Background grid
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.06)';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 32) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += 32) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      const mid = h / 2;

      if (liveAnalyser) {
        liveAnalyser.getByteFrequencyData(freqData);
        liveAnalyser.getByteTimeDomainData(timeData);

        // Frequency bars
        const bars = 64;
        const step = Math.floor(freqData.length / bars);
        const barW = w / bars;
        for (let i = 0; i < bars; i++) {
          let avg = 0;
          for (let j = 0; j < step; j++) avg += freqData[i * step + j];
          avg /= step;
          const norm = avg / 255;
          const barH = norm * (h * 0.42);
          const hue = 180 + (i / bars) * 60;
          const grad = ctx.createLinearGradient(0, mid - barH, 0, mid + barH);
          grad.addColorStop(0, `hsla(${hue}, 90%, 60%, 0.9)`);
          grad.addColorStop(0.5, `hsla(${hue}, 90%, 55%, 0.6)`);
          grad.addColorStop(1, `hsla(${hue}, 90%, 60%, 0.9)`);
          ctx.fillStyle = grad;
          ctx.fillRect(i * barW + 1, mid - barH, barW - 2, barH * 2);
        }

        // Waveform overlay
        ctx.strokeStyle = 'rgba(232, 238, 248, 0.85)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        const slice = w / timeData.length;
        for (let i = 0; i < timeData.length; i++) {
          const v = (timeData[i] - 128) / 128;
          const y = mid + v * (h * 0.3);
          if (i === 0) ctx.moveTo(0, y);
          else ctx.lineTo(i * slice, y);
        }
        ctx.stroke();
      } else if (isRecording) {
        // Recording animation — pulsing waveform
        phase += 0.1;
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let x = 0; x < w; x += 2) {
          const t = x / w;
          const amp = (Math.sin(phase * 3) * 0.3 + 0.5) * (h * 0.2);
          const y = mid + Math.sin(t * Math.PI * 8 + phase * 2) * amp;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        // Red bars
        const bars = 32;
        const barW = w / bars;
        for (let i = 0; i < bars; i++) {
          const energy = Math.sin(phase + i * 0.5) * 0.5 + 0.5;
          const barH = energy * (h * 0.2);
          ctx.fillStyle = `rgba(239, 68, 68, ${0.3 + energy * 0.4})`;
          ctx.fillRect(i * barW + 1, mid - barH, barW - 2, barH * 2);
        }
      } else {
        // Idle state
        ctx.strokeStyle = 'rgba(120, 160, 220, 0.25)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let x = 0; x < w; x += 2) {
          const t = x / w;
          const y = mid + Math.sin(t * Math.PI * 4 + phase * 0.5) * 6;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        phase += 0.02;
        ctx.stroke();
      }

      rafRef.current = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      if (liveSource) {
        try {
          liveSource.stop();
        } catch {
          /* already stopped */
        }
      }
      if (liveCtx) void liveCtx.close();
    };
  }, [audioBuffer, isAnalyzing, isPlaying, isRecording]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full block rounded-xl"
      style={{ background: 'radial-gradient(ellipse at center, rgba(10,18,34,0.6), rgba(5,7,13,0.9))' }}
    />
  );
}
