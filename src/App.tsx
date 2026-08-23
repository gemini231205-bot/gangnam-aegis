import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  Mic,
  Play,
  RadioTower,
  RotateCcw,
  ScanFace,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Square,
  Volume2,
} from 'lucide-react';
import type { AnalysisResult, LogEntry, PresetConfig } from '@/types';
import { PRESETS } from '@/presets';
import { analyzeAudioBuffer, decodeAudioFile } from '@/audioEngine';
import { runStt, preloadSttModel } from '@/sttEngine';
import {
  analyzeSemantics,
  buildAgentSteps,
  buildResult,
  computeThreatLevel,
} from '@/agentEngine';
import { analyzeWithUpstage, correctTranscript } from '@/upstageEngine';
import AudioUploader from '@/components/AudioUploader';
import Visualizer from '@/components/Visualizer';
import TerminalConsole from '@/components/TerminalConsole';
import { Gauge, ThreatGauge } from '@/components/Gauge';
import EvidenceReport from '@/components/EvidenceReport';

const PRESET_ACCENT: Record<PresetConfig['accent'], { ring: string; text: string; dot: string; bg: string }> = {
  red: { ring: 'border-red-500/30', text: 'text-red-300', dot: 'bg-red-400', bg: 'bg-red-500/5' },
  emerald: { ring: 'border-emerald-500/30', text: 'text-emerald-300', dot: 'bg-emerald-400', bg: 'bg-emerald-500/5' },
  amber: { ring: 'border-amber-500/30', text: 'text-amber-300', dot: 'bg-amber-400', bg: 'bg-amber-500/5' },
};

// Web Speech API type declarations
interface SpeechRecognitionResultLike {
  0: { transcript: string };
  isFinal: boolean;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: { length: number; [index: number]: SpeechRecognitionResultLike };
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

export default function App() {
  const [selectedPreset, setSelectedPreset] = useState<PresetConfig | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedBuffer, setUploadedBuffer] = useState<AudioBuffer | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [transcript, setTranscript] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [clock, setClock] = useState(new Date());
  const [isRecording, setIsRecording] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [sttLoading, setSttLoading] = useState(false);
  const [sttTranscript, setSttTranscript] = useState('');

  const logIdRef = useRef(0);
  const streamTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const analyzingRef = useRef(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    void preloadSttModel();
  }, []);

  const clearStreamTimer = () => {
    if (streamTimerRef.current) {
      clearTimeout(streamTimerRef.current);
      streamTimerRef.current = null;
    }
  };

  useEffect(() => () => clearStreamTimer(), []);

  const handleFile = useCallback(async (file: File) => {
    setUploadedFile(file);
    setFileName(file.name);
    setSelectedPreset(null);
    setUploadedBuffer(null);
    setIsPlaying(false);
    setResult(null);
    setLogs([]);
    setTranscript('');
    setLiveTranscript('');
    setSttTranscript('');
    try {
      const { buffer } = await decodeAudioFile(file);
      setUploadedBuffer(buffer);
    } catch {
      alert('오디오 디코딩에 실패했습니다. 지원되는 형식인지 확인하세요.');
      setUploadedFile(null);
      setFileName(null);
    }
  }, []);

  const handleClearFile = () => {
    setUploadedFile(null);
    setUploadedBuffer(null);
    setFileName(null);
    setIsPlaying(false);
    setResult(null);
    setLogs([]);
    setTranscript('');
    setSttTranscript('');
  };

  const handlePreset = (preset: PresetConfig) => {
    clearStreamTimer();
    setSelectedPreset(preset);
    setUploadedFile(null);
    setUploadedBuffer(null);
    setFileName(null);
    setIsPlaying(false);
    setResult(null);
    setLogs([]);
    setTranscript(preset.transcript);
    setLiveTranscript('');
    setSttTranscript('');
  };

  const togglePlay = () => {
    if (!uploadedBuffer && !selectedPreset) return;
    setIsPlaying((p) => !p);
  };

  // Web Speech API live recognition
  const toggleRecording = useCallback(() => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }
    const Ctor = (window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor }).SpeechRecognition
      || (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionCtor }).webkitSpeechRecognition;
    if (!Ctor) {
      alert('이 브라우저는 Web Speech API를 지원하지 않습니다. Chrome을 사용해주세요.');
      return;
    }
    const recognition = new Ctor();
    recognition.lang = 'ko-KR';
    recognition.continuous = true;
    recognition.interimResults = true;
    let finalText = '';
    recognition.onresult = (e: SpeechRecognitionEventLike) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          finalText += e.results[i][0].transcript;
        } else {
          interim += e.results[i][0].transcript;
        }
      }
      setLiveTranscript(finalText + interim);
      setTranscript(finalText + interim);
    };
    recognition.onend = () => {
      setIsRecording(false);
    };
    recognition.onerror = () => {
      setIsRecording(false);
    };
    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
    setSelectedPreset(null);
    setUploadedFile(null);
    setUploadedBuffer(null);
    setFileName(null);
    setResult(null);
    setLogs([]);
    setLiveTranscript('');
    setTranscript('');
  }, [isRecording]);

  const streamLogs = useCallback(
    (steps: ReturnType<typeof buildAgentSteps>, onDone: () => void) => {
      setIsStreaming(true);
      let i = 0;
      const next = () => {
        if (i >= steps.length) {
          setIsStreaming(false);
          onDone();
          return;
        }
        const step = steps[i];
        const entry: LogEntry = {
          id: ++logIdRef.current,
          agent: step.agent,
          agentLabel: step.label,
          message: step.message,
          level: step.level,
          timestamp: new Date().toLocaleTimeString('ko-KR', { hour12: false }),
        };
        setLogs((prev) => [...prev, entry]);
        i++;
        streamTimerRef.current = setTimeout(next, step.delay);
      };
      next();
    },
    []
  );

  const runAnalysis = useCallback(async () => {
    if (analyzingRef.current) return;
    analyzingRef.current = true;
    clearStreamTimer();
    setIsAnalyzing(true);
    setIsStreaming(true);
    setResult(null);
    setShowReport(false);
    setLogs([]);

    let features = null;
    let semantic: ReturnType<typeof analyzeSemantics>;
    let sourceLabel: string;
    let hasAudio = false;
    let analysisTranscript = '';

    if (uploadedBuffer && uploadedFile) {
      sourceLabel = uploadedFile.name;
      hasAudio = true;
      features = await analyzeAudioBuffer(uploadedBuffer);

      // Always attempt Whisper STT on uploaded audio — the isSpeech classifier
      // can be wrong, and Whisper itself can distinguish speech from noise.
      // Only skip if the audio is completely silent (near-zero RMS).
      const isCompletelySilent = features.rmsVolume < 0.001;

      if (!isCompletelySilent) {
        setSttLoading(true);
        const sttResult = await runStt(uploadedBuffer, features);
        setSttLoading(false);
        if (sttResult.transcript) {
          // Send rough Whisper output to Solar LLM for Korean correction
          const corrected = await correctTranscript(sttResult.transcript);
          setSttTranscript(corrected);
          setTranscript(corrected);
          analysisTranscript = corrected;
        } else if (sttResult.error) {
          setSttTranscript(`[Whisper AI 인식 실패] ${sttResult.error}`);
          analysisTranscript = transcript;
        } else {
          setSttTranscript('[Whisper AI 인식 결과 없음] 음성이 너무 작거나 인식할 수 없습니다.');
          analysisTranscript = transcript;
        }
        semantic = analyzeSemantics(analysisTranscript);
      } else {
        setSttTranscript('[무음 오디오] 오디오에 소리가 거의 없습니다. 텍스트를 직접 입력해주세요.');
        analysisTranscript = transcript;
        semantic = analyzeSemantics(analysisTranscript);
      }
    } else if (selectedPreset) {
      sourceLabel = selectedPreset.label;
      hasAudio = false;
      analysisTranscript = selectedPreset.transcript;
      semantic = analyzeSemantics(analysisTranscript);
    } else if (transcript.trim()) {
      sourceLabel = isRecording ? '실시간 음성 인식 (Web Speech API)' : '텍스트 입력';
      hasAudio = false;
      analysisTranscript = transcript;
      semantic = analyzeSemantics(analysisTranscript);
    } else {
      analyzingRef.current = false;
      setIsAnalyzing(false);
      setIsStreaming(false);
      return;
    }

    // Upstage AI contextual analysis
    const upstageResult = await analyzeWithUpstage(analysisTranscript);

    const threat = computeThreatLevel(features, semantic.riskScore);
    const steps = buildAgentSteps(features, semantic, sourceLabel, threat, hasAudio, sttTranscript, upstageResult);

    streamTimerRef.current = setTimeout(() => {
      streamLogs(steps, () => {
        const finalResult: AnalysisResult = buildResult(features, semantic, sourceLabel, hasAudio, upstageResult);
        setResult(finalResult);
        analyzingRef.current = false;
        setIsAnalyzing(false);
        setIsStreaming(false);
        setShowReport(true);
      });
    }, 50);
  }, [uploadedBuffer, uploadedFile, selectedPreset, transcript, isRecording, streamLogs, sttTranscript]);

  const reset = () => {
    clearStreamTimer();
    analyzingRef.current = false;
    if (isRecording) recognitionRef.current?.stop();
    setSelectedPreset(null);
    setUploadedFile(null);
    setUploadedBuffer(null);
    setFileName(null);
    setIsPlaying(false);
    setIsAnalyzing(false);
    setIsStreaming(false);
    setResult(null);
    setLogs([]);
    setShowReport(false);
    setTranscript('');
    setLiveTranscript('');
    setSttTranscript('');
    setSttLoading(false);
    setIsRecording(false);
  };

  const hasSource = selectedPreset || uploadedBuffer || transcript.trim();
  const canAnalyze = !!hasSource && !isAnalyzing;

  return (
    <div className="min-h-screen w-full bg-base-900 text-slate-100 grid-bg relative overflow-hidden">
      {/* Ambient glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-cyan-500/10 blur-[120px]" />
        <div className="absolute -top-20 right-0 w-96 h-96 rounded-full bg-blue-500/10 blur-[120px]" />
        <div className="absolute bottom-0 left-1/3 w-96 h-96 rounded-full bg-red-500/5 blur-[120px]" />
      </div>

      {/* Scan line */}
      <div className="pointer-events-none fixed inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent animate-scan" />

      <div className="relative z-10 max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-5">
        {/* Header */}
        <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-3.5">
            <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500/25 to-blue-600/25 border border-cyan-400/30 flex items-center justify-center">
              <Shield className="w-6 h-6 text-cyan-300" />
              <div className="absolute inset-0 rounded-2xl border border-cyan-400/20 animate-pulse-ring" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-extrabold tracking-tight">
                강남 <span className="text-cyan-300 text-glow-cyan">AI-Aegis</span>
              </h1>
              <p className="text-[11px] sm:text-xs text-slate-500 font-medium">
                딥페이크 / 음성복제 보이스피싱 실시간 방어 에이전트
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <StatusChip icon={RadioTower} label="로컬 엔진" status="ONLINE" color="emerald" />
            <StatusChip icon={Activity} label="WebAudio API" status="READY" color="cyan" />
            <StatusChip icon={Sparkles} label="Whisper STT" status={sttLoading ? 'LOADING' : 'READY'} color={sttLoading ? 'amber' : 'emerald'} />
            <StatusChip icon={ShieldCheck} label="에이전트" status={isAnalyzing ? 'BUSY' : 'STANDBY'} color={isAnalyzing ? 'amber' : 'cyan'} />
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg glass font-mono text-xs text-slate-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {clock.toLocaleTimeString('ko-KR', { hour12: false })}
            </div>
          </div>
        </header>

        {/* Main split view */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* LEFT PANEL */}
          <div className="glass rounded-2xl p-5 flex flex-col gap-4">
            <PanelTitle icon={Volume2} title="오디오 처리 및 업로드" subtitle="Audio Processing & Upload" />

            {/* Uploader */}
            <AudioUploader onFile={handleFile} selectedFileName={fileName} onClear={handleClearFile} disabled={isAnalyzing} />

            {/* Divider */}
            <div className="flex items-center gap-3 my-1">
              <div className="h-px flex-1 bg-white/5" />
              <span className="text-[10px] font-mono text-slate-600 uppercase tracking-widest">또는 프리셋 선택</span>
              <div className="h-px flex-1 bg-white/5" />
            </div>

            {/* Presets */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {PRESETS.map((preset) => {
                const a = PRESET_ACCENT[preset.accent];
                const active = selectedPreset?.id === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => handlePreset(preset)}
                    disabled={isAnalyzing}
                    className={`group relative text-left rounded-xl border p-3 transition-all duration-200 disabled:opacity-50
                      ${active ? `${a.bg} ${a.ring} glow-cyan` : 'border-white/8 hover:border-white/15 bg-white/[0.02]'}`}
                  >
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className={`w-2 h-2 rounded-full ${a.dot}`} />
                      <span className={`text-[10px] font-mono uppercase tracking-wide ${a.text}`}>
                        {preset.expectedLevel === 'critical' ? 'High Risk' : preset.expectedLevel === 'safe' ? 'Safe' : 'Caution'}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-slate-200 leading-snug">{preset.shortLabel}</p>
                    <p className="text-[10px] text-slate-500 mt-1 leading-snug line-clamp-2">{preset.description}</p>
                    {active && (
                      <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Visualizer */}
            <div className="relative rounded-xl border border-white/8 bg-black/30 overflow-hidden h-44 sm:h-52">
              <Visualizer audioBuffer={uploadedBuffer} isAnalyzing={isAnalyzing} isPlaying={isPlaying} isRecording={isRecording} />
              {/* Overlay label */}
              <div className="absolute top-2.5 left-3 flex items-center gap-1.5 text-[10px] font-mono text-slate-500">
                <Activity className="w-3 h-3" />
                {uploadedBuffer ? (isPlaying ? 'LIVE FFT · WAVEFORM' : 'AUDIO LOADED') : isRecording ? 'LIVE STT · RECORDING' : 'IDLE'}
              </div>
              {/* Play control overlay */}
              {uploadedBuffer && (
                <button
                  onClick={togglePlay}
                  disabled={isAnalyzing}
                  className="absolute bottom-2.5 right-2.5 w-9 h-9 rounded-full glass-strong flex items-center justify-center hover:scale-105 transition-transform disabled:opacity-40"
                  aria-label={isPlaying ? '정지' : '재생'}
                >
                  {isPlaying ? <Square className="w-3.5 h-3.5 text-cyan-300" /> : <Play className="w-4 h-4 text-cyan-300 ml-0.5" />}
                </button>
              )}
              {/* Recording indicator */}
              {isRecording && (
                <div className="absolute top-2.5 right-3 flex items-center gap-1.5 text-[10px] font-mono text-red-400">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  REC
                </div>
              )}
            </div>

            {/* Live STT button */}
            <button
              onClick={toggleRecording}
              disabled={isAnalyzing}
              className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-all duration-200 disabled:opacity-50
                ${isRecording
                  ? 'bg-red-500/20 border border-red-500/30 text-red-300 glow-red'
                  : 'bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10'}`}
            >
              <Mic className={`w-4 h-4 ${isRecording ? 'animate-pulse' : ''}`} />
              {isRecording ? '실시간 음성 인식 중지' : '실시간 음성 인식 (Web Speech API)'}
            </button>

            {/* Transcript input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs text-slate-400 font-medium">전사 텍스트 (키워드 스캔 대상)</label>
                <span className="text-[10px] text-slate-600 font-mono">{transcript.length}자</span>
              </div>
              {sttLoading && (
                <div className="flex items-center gap-2 mb-2 text-[11px] text-amber-300">
                  <span className="w-3 h-3 border-2 border-amber-300/30 border-t-amber-300 rounded-full animate-spin" />
                  Whisper AI 온디바이스 음성 인식 중…
                </div>
              )}
              {sttTranscript && (
                <div className="mb-2 rounded-lg bg-cyan-500/5 border border-cyan-500/15 px-3 py-2">
                  <p className="text-[10px] text-cyan-400 mb-0.5 font-mono">Whisper AI STT 결과</p>
                  <p className="text-xs text-slate-200 leading-relaxed">{sttTranscript}</p>
                </div>
              )}
              <textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                disabled={isAnalyzing}
                placeholder="오디오 업로드 시 Whisper AI가 자동으로 텍스트를 추출합니다. 또는 직접 입력/실시간 음성 인식을 사용하세요."
                className="w-full h-24 rounded-xl bg-black/30 border border-white/8 px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 resize-none focus:outline-none focus:border-cyan-400/30 scrollbar-slim disabled:opacity-50"
              />
            </div>

            {/* Audio meta strip */}
            {(selectedPreset || uploadedBuffer) && (
              <div className="grid grid-cols-4 gap-2 text-center">
                <MetaChip label="상태" value={isPlaying ? '재생중' : '대기'} />
                <MetaChip label="소스" value={selectedPreset ? '프리셋' : '업로드'} />
                <MetaChip label="재생시간" value={uploadedBuffer ? `${uploadedBuffer.duration.toFixed(1)}s` : selectedPreset ? '텍스트' : '-'} />
                <MetaChip label="포맷" value={uploadedFile ? uploadedFile.name.split('.').pop()?.toUpperCase() || '-' : 'TXT'} />
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2.5 mt-1">
              <button
                onClick={runAnalysis}
                disabled={!canAnalyze}
                className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-3 font-semibold text-sm transition-all duration-200
                  ${
                    canAnalyze
                      ? 'bg-gradient-to-r from-cyan-500/25 to-blue-600/25 border border-cyan-400/30 text-cyan-100 hover:from-cyan-500/35 hover:to-blue-600/35 glow-cyan'
                      : 'bg-white/5 border border-white/10 text-slate-500 cursor-not-allowed'
                  }`}
              >
                {isAnalyzing ? (
                  <>
                    <span className="w-4 h-4 border-2 border-cyan-300/30 border-t-cyan-300 rounded-full animate-spin" />
                    분석 중…
                  </>
                ) : (
                  <>
                    <ScanFace className="w-4 h-4" />
                    로컬 AI 에이전트 분석 실행
                  </>
                )}
              </button>
              <button
                onClick={reset}
                disabled={isAnalyzing}
                className="w-11 h-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-white/10 transition-colors disabled:opacity-40"
                aria-label="초기화"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* RIGHT PANEL */}
          <div className="flex flex-col gap-5">
            {/* Metrics row */}
            <div className="glass rounded-2xl p-5">
              <PanelTitle icon={ShieldAlert} title="위협 지표" subtitle="Threat Metrics" />
              <div className="grid grid-cols-2 sm:grid-cols-[1fr_1fr_1.2fr] gap-4 items-center justify-items-center mt-3">
                <Gauge
                  value={result?.overallScore ?? 0}
                  label="종합 위험도"
                  sublabel="Overall Threat Score"
                  color={result ? (result.overallScore > 60 ? 'red' : result.overallScore > 28 ? 'amber' : 'emerald') : 'emerald'}
                />
                <Gauge
                  value={result?.semantic.riskScore ?? 0}
                  label="의미론적 위험"
                  sublabel="Semantic Risk Score"
                  color={result ? (result.semantic.riskScore > 50 ? 'red' : result.semantic.riskScore > 28 ? 'amber' : 'emerald') : 'emerald'}
                />
                <ThreatGauge level={result?.threatLevel ?? 'safe'} overall={result?.overallScore ?? 0} />
              </div>

              {/* Threat level legend */}
              <div className="flex items-center justify-center gap-3 mt-4 flex-wrap">
                {(['safe', 'caution', 'danger', 'critical'] as const).map((lvl) => {
                  const active = result?.threatLevel === lvl;
                  const dotColor =
                    lvl === 'safe' ? 'bg-emerald-400' : lvl === 'caution' ? 'bg-amber-400' : 'bg-red-400';
                  const ko = lvl === 'safe' ? '안전' : lvl === 'caution' ? '주의' : lvl === 'danger' ? '위험' : '심각';
                  return (
                    <div key={lvl} className={`flex items-center gap-1.5 text-[10px] font-mono transition-opacity ${active ? 'opacity-100' : 'opacity-40'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${dotColor} ${active ? 'animate-pulse' : ''}`} />
                      <span className="text-slate-400">{ko}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Terminal console */}
            <div className="glass rounded-2xl flex-1 min-h-[320px] flex flex-col overflow-hidden">
              <div className="px-5 pt-4 pb-2">
                <PanelTitle icon={Sparkles} title="멀티 에이전트 실행 콘솔" subtitle="Multi-Agent Execution Console" />
              </div>
              <div className="flex-1 min-h-0 mx-4 mb-4 rounded-xl border border-white/8 bg-black/40 overflow-hidden">
                <TerminalConsole logs={logs} isStreaming={isStreaming} />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] text-slate-600 font-mono">
          <span>강남 AI-Aegis · Whisper STT + Web Audio API + Local Multi-Agent Engine · 100% On-Device</span>
          <span>위험 신호 감지 시 즉시 112 신고 · 강남구청 보이스피싱 신고센터 1577-1289</span>
        </footer>
      </div>

      {/* Evidence report modal */}
      {result && showReport && (
        <EvidenceReport result={result} onClose={() => setShowReport(false)} audioFile={uploadedFile} />
      )}
    </div>
  );
}

function PanelTitle({ icon: Icon, title, subtitle }: { icon: typeof Volume2; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-400/15 flex items-center justify-center">
        <Icon className="w-4 h-4 text-cyan-300" />
      </div>
      <div>
        <h2 className="text-sm font-bold text-slate-100">{title}</h2>
        <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wide">{subtitle}</p>
      </div>
    </div>
  );
}

function StatusChip({
  icon: Icon,
  label,
  status,
  color,
}: {
  icon: typeof Activity;
  label: string;
  status: string;
  color: 'emerald' | 'cyan' | 'amber';
}) {
  const colorMap = {
    emerald: 'text-emerald-300 border-emerald-500/20',
    cyan: 'text-cyan-300 border-cyan-500/20',
    amber: 'text-amber-300 border-amber-500/20',
  };
  const dotMap = { emerald: 'bg-emerald-400', cyan: 'bg-cyan-400', amber: 'bg-amber-400' };
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg glass border ${colorMap[color]}`}>
      <Icon className="w-3.5 h-3.5" />
      <span className="text-[10px] font-mono text-slate-400">{label}</span>
      <span className={`w-1.5 h-1.5 rounded-full ${dotMap[color]} ${status === 'BUSY' ? 'animate-pulse' : ''}`} />
      <span className="text-[10px] font-mono font-semibold">{status}</span>
    </div>
  );
}

function MetaChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/[0.03] border border-white/5 px-2 py-1.5">
      <p className="text-[9px] text-slate-600 uppercase tracking-wide">{label}</p>
      <p className="text-xs font-mono text-slate-300 truncate">{value}</p>
    </div>
  );
}
