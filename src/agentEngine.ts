import type {
  AgentId,
  AnalysisResult,
  AudioFeatures,
  LogEntry,
  SemanticAnalysis,
  ThreatLevel,
  PresetConfig,
  UpstageAnalysis,
} from './types';
import { KEYWORD_DICTIONARY, REGEX_PATTERNS } from './presets';
import { analyzeContext } from './contextEngine';

// ─── Scoring constants ───────────────────────────────────────────
const NORMAL_CONVERSATION_SCORE = 8;
const NONSPEECH_SCORE = 2;
const MAX_SCORE = 100;

// Re-export for App.tsx compatibility
export function analyzeSemantics(transcript: string): SemanticAnalysis {
  return analyzeContext(transcript);
}

export function computeThreatLevel(
  features: AudioFeatures | null,
  semanticRisk: number
): {
  level: ThreatLevel;
  overall: number;
} {
  let overall: number;

  if (features && features.isSpeech === false && semanticRisk === 0) {
    overall = NONSPEECH_SCORE;
  } else if (semanticRisk === 0) {
    overall = features && features.isSpeech === false ? NONSPEECH_SCORE : NORMAL_CONVERSATION_SCORE;
  } else {
    overall = semanticRisk;
  }

  overall = Math.min(MAX_SCORE, Math.max(0, overall));
  let level: ThreatLevel = 'safe';
  if (overall >= 70) level = 'critical';
  else if (overall >= 50) level = 'danger';
  else if (overall >= 28) level = 'caution';
  return { level, overall };
}

export interface AgentStep {
  agent: AgentId;
  label: string;
  message: string;
  level: LogEntry['level'];
  delay: number;
}

export function buildAgentSteps(
  features: AudioFeatures | null,
  semantic: SemanticAnalysis,
  sourceLabel: string,
  threat: { level: ThreatLevel; overall: number },
  hasAudio: boolean,
  sttTranscript?: string,
  upstage?: UpstageAnalysis
): AgentStep[] {
  const steps: AgentStep[] = [];

  // ── Agent 1 — Acoustic Anomaly ──
  if (hasAudio && features) {
    steps.push({
      agent: 'acoustic',
      label: 'Agent 1: Acoustic Anomaly',
      message: `AudioContext 초기화 · 샘플레이트 ${features.durationSec > 0 ? '분석' : '대기'} 중…`,
      level: 'info',
      delay: 93,
    });
    steps.push({
      agent: 'acoustic',
      label: 'Agent 1: Acoustic Anomaly',
      message: `FFT 스펙트럼 분석 · 스펙트럴 중심주파수 ${features.spectralCentroidHz.toFixed(0)}Hz · 피크 ${features.peakFrequencyHz.toFixed(0)}Hz`,
      level: 'info',
      delay: 113,
    });
    steps.push({
      agent: 'acoustic',
      label: 'Agent 1: Acoustic Anomaly',
      message: `제로크로싱율 ${features.zeroCrossingRate.toFixed(4)} · 피치 지터 ${features.pitchJitter.toFixed(4)}`,
      level: 'info',
      delay: 107,
    });
    steps.push({
      agent: 'acoustic',
      label: 'Agent 1: Acoustic Anomaly',
      message: `고주파 노이즈 비율 ${(features.highFreqNoiseRatio * 100).toFixed(1)}% · 음성대역(300–3400Hz) 에너지 분석…`,
      level: 'info',
      delay: 120,
    });
    if (!features.isSpeech) {
      steps.push({
        agent: 'acoustic',
        label: 'Agent 1: Acoustic Anomaly',
        message: `사람 음성대역 에너지 미달 · 의미 없는 소리/잡음으로 판정 · 위험 점수 ${NONSPEECH_SCORE}점 (안전)`,
        level: 'success',
        delay: 100,
      });
    } else {
      steps.push({
        agent: 'acoustic',
        label: 'Agent 1: Acoustic Anomaly',
        message: `음성대역 에너지 확인 · 사람 음성으로 판정 · Whisper STT로 전환…`,
        level: 'success',
        delay: 100,
      });
      if (sttTranscript) {
        steps.push({
          agent: 'acoustic',
          label: 'Agent 1: Acoustic Anomaly',
          message: `Whisper AI STT 완료 · 추출된 텍스트: "${sttTranscript.slice(0, 60)}${sttTranscript.length > 60 ? '...' : ''}"`,
          level: 'success',
          delay: 107,
        });
      } else {
        steps.push({
          agent: 'acoustic',
          label: 'Agent 1: Acoustic Anomaly',
          message: `Whisper AI STT 완료 · 인식된 음성 없음 (무의미 소리/잡음)`,
          level: 'success',
          delay: 107,
        });
      }
    }
  } else {
    steps.push({
      agent: 'acoustic',
      label: 'Agent 1: Acoustic Anomaly',
      message: `오디오 파일 없음 · 음향 분석 생략 (텍스트 기반 문맥 분석 수행)`,
      level: 'info',
      delay: 93,
    });
  }

  // ── Agent 2 — Contextual Semantic Risk ──
  const totalPatterns = KEYWORD_DICTIONARY.length + REGEX_PATTERNS.length;
  steps.push({
    agent: 'semantic',
    label: 'Agent 2: Contextual Risk',
    message: `문맥 분석 엔진 시작 · 키워드 사전 ${KEYWORD_DICTIONARY.length}개 + 정규식 ${REGEX_PATTERNS.length}개 (총 ${totalPatterns} 패턴) 로드…`,
    level: 'info',
    delay: 93,
  });

  // Sentence parsing
  steps.push({
    agent: 'semantic',
    label: 'Agent 2: Contextual Risk',
    message: `문장 단위 분할 · ${semantic.sentences.length}개 문장 식별 · 인텐트 분류 시작…`,
    level: 'info',
    delay: 100,
  });

  // Per-sentence intent analysis (show top 3)
  const dangerousSentences = semantic.sentences.filter(
    (s) => !s.intent.startsWith('normal') && s.intent !== 'unknown'
  );
  if (dangerousSentences.length > 0) {
    const topSentences = dangerousSentences.slice(0, 3);
    for (const s of topSentences) {
      steps.push({
        agent: 'semantic',
        label: 'Agent 2: Contextual Risk',
        message: `문장 ${s.index + 1} [${s.intentLabel}] 점수 ${s.intentScore} · "${s.text.slice(0, 50)}${s.text.length > 50 ? '...' : ''}"`,
        level: s.intentScore > 40 ? 'alert' : 'warn',
        delay: 93,
      });
    }
    if (dangerousSentences.length > 3) {
      steps.push({
        agent: 'semantic',
        label: 'Agent 2: Contextual Risk',
        message: `외 ${dangerousSentences.length - 3}개 문장에서 위험 인텐트 탐지…`,
        level: 'warn',
        delay: 87,
      });
    }
  } else {
    steps.push({
      agent: 'semantic',
      label: 'Agent 2: Contextual Risk',
      message: `위험 인텐트 미탐지 · 모든 문장이 일상/안부 패턴으로 분류됨`,
      level: 'success',
      delay: 87,
    });
  }

  // Intent distribution
  const intentEntries = Object.entries(semantic.intentDistribution)
    .filter(([k]) => k !== 'normal_greeting' && k !== 'normal_logistics' && k !== 'normal_question' && k !== 'unknown')
    .sort((a, b) => b[1] - a[1]);
  if (intentEntries.length > 0) {
    steps.push({
      agent: 'semantic',
      label: 'Agent 2: Contextual Risk',
      message: `인텐트 분포: ${intentEntries.map(([k, v]) => `${k}(${v})`).join(', ')}`,
      level: 'info',
      delay: 100,
    });
  }

  // Proximity analysis
  const proximitySignals = semantic.contextSignals.filter(
    (s) => s.description.includes('문장') || s.description.includes('같은')
  );
  if (proximitySignals.length > 0) {
    steps.push({
      agent: 'semantic',
      label: 'Agent 2: Contextual Risk',
      message: `근접 분석: ${proximitySignals.length}개 위험 요소 결합 탐지 (문장 간 근접도 기반)`,
      level: 'alert',
      delay: 107,
    });
  }

  // Flow pattern detection
  if (semantic.flowPattern !== '일상 대화 흐름' && semantic.flowPattern !== '산발적 위험 키워드 (명확한 패턴 없음)') {
    steps.push({
      agent: 'semantic',
      label: 'Agent 2: Contextual Risk',
      message: `대화 흐름 패턴 탐지: ${semantic.flowPattern}`,
      level: 'alert',
      delay: 113,
    });
  }

  // Context modifiers
  const modSignals = semantic.contextSignals.filter(
    (s) => !s.description.includes('문장') && !s.description.includes('같은') && !s.description.includes('대화')
  );
  if (modSignals.length > 0) {
    for (const m of modSignals.slice(0, 4)) {
      steps.push({
        agent: 'semantic',
        label: 'Agent 2: Contextual Risk',
        message: `문맥 신호: ${m.label} — ${m.description}`,
        level: m.type === 'normal_conversation' ? 'success' : 'alert',
        delay: 93,
      });
    }
  }

  // Score synthesis
  steps.push({
    agent: 'semantic',
    label: 'Agent 2: Contextual Risk',
    message: `기본 키워드 점수: ${semantic.baseKeywordScore} · 문맥 조정 점수: ${semantic.contextAdjustedScore}`,
    level: 'info',
    delay: 100,
  });
  steps.push({
    agent: 'semantic',
    label: 'Agent 2: Contextual Risk',
    message: `신뢰도: ${(semantic.confidence * 100).toFixed(0)}% · 최종 문맥 위험 점수: ${semantic.riskScore}/100`,
    level: semantic.riskScore > 50 ? 'alert' : semantic.riskScore > 28 ? 'warn' : 'success',
    delay: 107,
  });

  // ── Upstage AI contextual analysis ──
  if (upstage && upstage.used) {
    steps.push({
      agent: 'semantic',
      label: 'Agent 2: Contextual Risk',
      message: `Upstage Solar LLM 문맥 분석 요청 · 통화 텍스트 전송 중…`,
      level: 'info',
      delay: 100,
    });
    steps.push({
      agent: 'semantic',
      label: 'Agent 2: Contextual Risk',
      message: `Upstage AI 의도 분류: ${upstage.intentClassification} · 신뢰도 ${(upstage.confidence * 100).toFixed(0)}%`,
      level: upstage.riskScore > 50 ? 'alert' : upstage.riskScore > 28 ? 'warn' : 'success',
      delay: 107,
    });
    if (upstage.detectedPatterns.length > 0) {
      steps.push({
        agent: 'semantic',
        label: 'Agent 2: Contextual Risk',
        message: `Upstage AI 탐지 패턴: ${upstage.detectedPatterns.slice(0, 3).join(', ')}`,
        level: 'alert',
        delay: 100,
      });
    }
    steps.push({
      agent: 'semantic',
      label: 'Agent 2: Contextual Risk',
      message: `Upstage AI 위험 점수: ${upstage.riskScore}/100`,
      level: upstage.riskScore > 50 ? 'alert' : upstage.riskScore > 28 ? 'warn' : 'success',
      delay: 100,
    });
  } else if (upstage && !upstage.used) {
    steps.push({
      agent: 'semantic',
      label: 'Agent 2: Contextual Risk',
      message: `Upstage AI 분석 생략 (텍스트 없음 또는 API 오류) · 로컬 문맥 분석으로 판정`,
      level: 'info',
      delay: 93,
    });
  }

  // ── Agent 3 — Gangnam Emergency Action ──
  const upstageScore = upstage?.used ? upstage.riskScore : null;
  steps.push({
    agent: 'action',
    label: 'Agent 3: Gangnam Emergency Action',
    message: `위험지수 종합 평가 중 (로컬 문맥 ${semantic.riskScore}점${upstageScore !== null ? ` · Upstage AI ${upstageScore}점` : ''}${features ? ` · 음성 ${features.isSpeech ? '확인' : '미감지'}` : ''})…`,
    level: 'info',
    delay: 107,
  });
  const levelMap: Record<ThreatLevel, { ko: string; lvl: LogEntry['level'] }> = {
    safe: { ko: '안전', lvl: 'success' },
    caution: { ko: '주의', lvl: 'warn' },
    danger: { ko: '위험', lvl: 'alert' },
    critical: { ko: '심각', lvl: 'alert' },
  };
  steps.push({
    agent: 'action',
    label: 'Agent 3: Gangnam Emergency Action',
    message: `종합 위협등급: ${levelMap[threat.level].ko} (점수 ${threat.overall}/100)`,
    level: levelMap[threat.level].lvl,
    delay: 100,
  });
  steps.push({
    agent: 'action',
    label: 'Agent 3: Gangnam Emergency Action',
    message: `강남구청 채증 보고서 생성 완료 · 증거 ID 발급 대기…`,
    level: 'success',
    delay: 93,
  });
  steps.push({
    agent: 'action',
    label: 'Agent 3: Gangnam Emergency Action',
    message: `분석 대상: ${sourceLabel} · 보고서 준비 완료`,
    level: 'success',
    delay: 87,
  });

  return steps;
}

function generateReportId(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `GN-AEGIS-${stamp}-${rand}`;
}

export function buildResult(
  features: AudioFeatures | null,
  semantic: SemanticAnalysis,
  sourceLabel: string,
  hasAudio: boolean,
  upstage?: UpstageAnalysis
): AnalysisResult {
  // Blend local context score (60%) with Upstage AI score (40%) when available
  let blendedRisk = semantic.riskScore;
  if (upstage && upstage.used && upstage.riskScore > 0) {
    blendedRisk = Math.round(semantic.riskScore * 0.6 + upstage.riskScore * 0.4);
  }
  const threat = computeThreatLevel(features, blendedRisk);
  return {
    features: features ?? {
      durationSec: 0,
      rmsVolume: 0,
      peakDb: 0,
      peakFrequencyHz: 0,
      spectralCentroidHz: 0,
      highFreqNoiseRatio: 0,
      pitchJitter: 0,
      zeroCrossingRate: 0,
      isSpeech: false,
    },
    semantic,
    threatLevel: threat.level,
    overallScore: threat.overall,
    reportId: generateReportId(),
    timestamp: new Date().toISOString(),
    sourceLabel,
    hasAudioAnalysis: hasAudio,
    upstageAnalysis: upstage,
  };
}

export function runPresetAnalysis(preset: PresetConfig): AnalysisResult {
  const semantic = analyzeContext(preset.transcript);
  return buildResult(null, semantic, preset.label, false);
}

export function runFileAnalysis(
  features: AudioFeatures,
  transcript: string,
  sourceLabel: string
): AnalysisResult {
  const semantic = analyzeContext(transcript);
  return buildResult(features, semantic, sourceLabel, true);
}
