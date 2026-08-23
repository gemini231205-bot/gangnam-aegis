export type ThreatLevel = 'safe' | 'caution' | 'danger' | 'critical';

export interface AudioFeatures {
  durationSec: number;
  rmsVolume: number;
  peakDb: number;
  peakFrequencyHz: number;
  spectralCentroidHz: number;
  highFreqNoiseRatio: number;
  pitchJitter: number;
  zeroCrossingRate: number;
  /** True when the audio contains energy concentrated in human speech band (300–3400 Hz). */
  isSpeech: boolean;
}

export type KeywordGroup =
  | 'agency'
  | 'family'
  | 'money'
  | 'account'
  | 'urgency'
  | 'concealment'
  | 'tech'
  | 'threat'
  | 'loan'
  | 'giftcard'
  | 'crypto'
  | 'personal_info'
  | 'arrest'
  | 'dialect'
  | 'regex'
  | null;

// ─── Contextual Analysis Types ───────────────────────────────────

export type IntentType =
  | 'authority_claim'    // 기관/직책 사칭
  | 'money_request'       // 금전/송금 요구
  | 'info_harvesting'     // 개인정보 수집
  | 'urgency_pressure'    // 시간 압박
  | 'concealment_order'   // 비밀/은폐 지시
  | 'threat_coercion'     // 체포/법적 위협
  | 'family_impersonation'// 가족 사칭
  | 'tech_instruction'    // 앱/원격제어 지시
  | 'dialect_impersonation' // 연변 말투 사칭
  | 'normal_greeting'     // 일상 인사
  | 'normal_logistics'    // 일상 정보
  | 'normal_question'     // 일상 질문
  | 'unknown';

export interface SentenceHit {
  keyword: string;
  category: string;
  group: KeywordGroup;
  weight: number;
}

export interface SentenceAnalysis {
  index: number;
  text: string;
  intent: IntentType;
  intentLabel: string;
  intentScore: number;       // 0–100, per-sentence danger
  hits: SentenceHit[];
  groups: KeywordGroup[];
  regexHits: SentenceHit[];
}

export type ContextSignalType =
  | 'authority_money_combo'      // 기관 사칭 + 송금/계좌 결합
  | 'family_money_combo'         // 가족 사칭 + 금전 요구
  | 'urgency_deadline'           // 시간 압박 + 기한
  | 'concealment_isolation'      // 비밀 지시 + 고립
  | 'threat_coercion_chain'      // 위협 + 금전 결합
  | 'info_harvesting_chain'      // 정보 수집 + 인증
  | 'tech_remote_control'        // 원격제어/앱 설치
  | 'giftcard_crypto_payment'    // 상품권/암호화폐 결제
  | 'repeated_money_request'     // 반복적 송금 요구
  | 'authority_threat_escalation'// 기관 → 위협 → 금전 에스컬레이션
  | 'normal_conversation'        // 일상 대화 패턴
  | 'low_confidence_noise';      // 잡음/인식 불확실

export interface ContextSignal {
  type: ContextSignalType;
  label: string;
  scoreContribution: number;
  description: string;
}

export interface KeywordHit {
  keyword: string;
  category: string;
  group: KeywordGroup;
  weight: number;
  count: number;
  excerpts: string[];
}

export interface RegexHit {
  pattern: string;
  label: string;
  category: string;
  group: KeywordGroup;
  weight: number;
  count: number;
  excerpts: string[];
}

export interface SemanticAnalysis {
  riskScore: number;
  hits: KeywordHit[];
  regexHits: RegexHit[];
  matchedCategories: string[];
  combinationBonuses: string[];
  // ── Contextual analysis fields ──
  sentences: SentenceAnalysis[];
  contextSignals: ContextSignal[];
  intentDistribution: Record<string, number>;
  flowPattern: string;
  confidence: number;
  baseKeywordScore: number;
  contextAdjustedScore: number;
  finalScore: number;
}

export type AgentId = 'acoustic' | 'semantic' | 'action';

export interface LogEntry {
  id: number;
  agent: AgentId;
  agentLabel: string;
  message: string;
  level: 'info' | 'warn' | 'alert' | 'success';
  timestamp: string;
}

export interface PresetConfig {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  expectedLevel: ThreatLevel;
  accent: 'red' | 'emerald' | 'amber';
  transcript: string;
}

export interface AnalysisResult {
  features: AudioFeatures;
  semantic: SemanticAnalysis;
  threatLevel: ThreatLevel;
  overallScore: number;
  reportId: string;
  timestamp: string;
  sourceLabel: string;
  hasAudioAnalysis: boolean;
  upstageAnalysis?: UpstageAnalysis;
}

export interface UpstageAnalysis {
  riskScore: number;
  summary: string;
  detectedPatterns: string[];
  intentClassification: string;
  confidence: number;
  used: boolean;
}
