import type {
  KeywordGroup,
  IntentType,
  SentenceAnalysis,
  SentenceHit,
  ContextSignal,
  SemanticAnalysis,
  KeywordHit,
  RegexHit,
} from './types';
import { KEYWORD_DICTIONARY, REGEX_PATTERNS } from './presets';

// ═══════════════════════════════════════════════════════════════════
// 1. Sentence Tokenizer — splits transcript into analyzable units
// ═══════════════════════════════════════════════════════════════════

export function splitSentences(text: string): string[] {
  // Split on Korean + English sentence-ending punctuation, keeping content
  const raw = text
    .split(/(?<=[.!?。])\s+|(?<=[.!?。])|[\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1);
  // Further split very long sentences at conjunctions/commas for finer analysis
  const refined: string[] = [];
  for (const s of raw) {
    if (s.length > 80) {
      const parts = s
        .split(/(?:,\s*(?=(?:그리고|그래서|하지만|근데|그런데|이제|그럼|또|및|and|but|so|then))|\s+(?:그리고|그래서|하지만|근데|그런데|이제|그럼)\s+)/)
        .map((p) => p.trim())
        .filter((p) => p.length > 2);
      refined.push(...(parts.length > 1 ? parts : [s]));
    } else {
      refined.push(s);
    }
  }
  return refined.length > 0 ? refined : (text.trim() ? [text.trim()] : []);
}

// ═══════════════════════════════════════════════════════════════════
// 2. Per-Sentence Keyword + Regex Scanner
// ═══════════════════════════════════════════════════════════════════

function scanKeywordsInSentence(sentence: string): SentenceHit[] {
  const hits: SentenceHit[] = [];
  const lower = sentence.toLowerCase();
  for (const kw of KEYWORD_DICTIONARY) {
    const isEnglish = /[a-zA-Z]/.test(kw.keyword);
    const haystack = isEnglish ? lower : sentence;
    const needle = isEnglish ? kw.keyword.toLowerCase() : kw.keyword;
    if (haystack.includes(needle)) {
      hits.push({
        keyword: kw.keyword,
        category: kw.category,
        group: kw.group,
        weight: kw.weight,
      });
    }
  }
  return hits;
}

function scanRegexInSentence(sentence: string): SentenceHit[] {
  const hits: SentenceHit[] = [];
  for (const rx of REGEX_PATTERNS) {
    const re = new RegExp(rx.pattern.source, rx.pattern.flags.includes('g') ? rx.pattern.flags : rx.pattern.flags + 'g');
    if (re.test(sentence)) {
      re.lastIndex = 0;
      hits.push({
        keyword: rx.label,
        category: rx.category,
        group: rx.group,
        weight: rx.weight,
      });
    }
  }
  return hits;
}

// ═══════════════════════════════════════════════════════════════════
// 3. Intent Classifier — determines what each sentence is DOING
// ═══════════════════════════════════════════════════════════════════

const INTENT_LABELS: Record<IntentType, string> = {
  authority_claim: '기관/직책 사칭',
  money_request: '금전/송금 요구',
  info_harvesting: '개인정보 수집',
  urgency_pressure: '시간 압박',
  concealment_order: '비밀/은폐 지시',
  threat_coercion: '체포/법적 위협',
  family_impersonation: '가족 사칭',
  tech_instruction: '앱/원격제어 지시',
  dialect_impersonation: '연변 말투 사칭',
  normal_greeting: '일상 인사',
  normal_logistics: '일상 정보',
  normal_question: '일상 질문',
  unknown: '미분류',
};

// Intent detection priority: most dangerous first
const INTENT_RULES: { intent: IntentType; groups: KeywordGroup[]; minHits: number; minDialectHits?: number; minDialectWeight?: number }[] = [
  { intent: 'threat_coercion', groups: ['arrest'], minHits: 1 },
  { intent: 'authority_claim', groups: ['agency'], minHits: 1 },
  { intent: 'family_impersonation', groups: ['family'], minHits: 1 },
  { intent: 'money_request', groups: ['money', 'account', 'giftcard', 'crypto'], minHits: 1 },
  { intent: 'info_harvesting', groups: ['personal_info'], minHits: 1 },
  { intent: 'tech_instruction', groups: ['tech'], minHits: 1 },
  { intent: 'concealment_order', groups: ['concealment'], minHits: 1 },
  { intent: 'dialect_impersonation', groups: ['dialect'], minHits: 1, minDialectHits: 1, minDialectWeight: 20 },
  { intent: 'urgency_pressure', groups: ['urgency'], minHits: 1 },
  { intent: 'threat_coercion', groups: ['threat'], minHits: 1 },
];

// Normal conversation indicators
const NORMAL_PATTERNS = [
  /^(안녕|어|여보|자기|학교|회사|점심|저녁|주말|날씨|비|눈|더워|추워|맛있|재밌|수고|고생|잘\s*있|잘\s*가|조심)/,
  /^(hello|hi|hey|how are you|good morning|good evening|see you|take care|have a good)/i,
  /(?:먹을까|갈까|할까|어때|좋지|어디\s*볼까|시간\s*될|연락줘|별일\s*없|조심히)/,
  /(?:lets|shall we|how about|want to|feel like|up for)/i,
];

function classifyIntent(
  hits: SentenceHit[],
  regexHits: SentenceHit[],
  sentence: string
): { intent: IntentType; score: number } {
  const allHits = [...hits, ...regexHits];
  const groups = new Set(allHits.map((h) => h.group).filter(Boolean) as KeywordGroup[]);

  // Check for normal conversation first (low priority override)
  const isNormal = NORMAL_PATTERNS.some((p) => p.test(sentence.trim()));
  const hasDangerousGroups = groups.has('agency') || groups.has('money') || groups.has('account') ||
    groups.has('arrest') || groups.has('family') || groups.has('giftcard') || groups.has('crypto') ||
    groups.has('dialect');

  // If no dangerous keywords and matches normal pattern, classify as normal
  if (!hasDangerousGroups && allHits.length === 0) {
    if (isNormal) {
      // Distinguish greeting vs logistics vs question
      if (/\?$|[\?？]$|(?:할까|갈까|어때|될까|줄래)/.test(sentence.trim())) {
        return { intent: 'normal_question', score: 2 };
      }
      if (/^(안녕|어|hello|hi|hey)/i.test(sentence.trim())) {
        return { intent: 'normal_greeting', score: 1 };
      }
      return { intent: 'normal_logistics', score: 3 };
    }
    // No keywords and not a normal pattern — check if it's a question
    if (/\?|？|(?:할까|갈까|어때|뭐|누구|언제|어디)/.test(sentence)) {
      return { intent: 'normal_question', score: 4 };
    }
    return { intent: 'unknown', score: 5 };
  }

  // Classify by intent rules (priority order)
  for (const rule of INTENT_RULES) {
    const matchCount = rule.groups.filter((g) => groups.has(g)).length;
    if (matchCount >= rule.minHits) {
      // For dialect: trigger on 1 unambiguous marker (weight >= minDialectWeight)
      // OR 2+ dialect keywords of any weight (to catch ambiguous word combos)
      if (rule.minDialectHits !== undefined) {
        const dialectHits = allHits.filter((h) => h.group === 'dialect');
        const unambiguousHits = dialectHits.filter((h) => h.weight >= (rule.minDialectWeight ?? 20));
        if (unambiguousHits.length < 1 && dialectHits.length < 2) continue;
      }
      // Calculate per-sentence score based on hit weights
      const maxWeight = Math.max(...allHits.map((h) => h.weight), 0);
      const totalWeight = allHits.reduce((acc, h) => acc + h.weight, 0);
      // Per-sentence score: base from max weight, boosted by multiple hits
      let score = Math.min(60, maxWeight + Math.min(20, totalWeight * 0.3));
      // Multiple dangerous groups in one sentence = higher intent
      const dangerousCount = rule.groups.filter((g) => groups.has(g)).length;
      if (dangerousCount >= 2) score = Math.min(80, score + 15);
      return { intent: rule.intent, score: Math.round(score) };
    }
  }

  return { intent: 'unknown', score: 5 };
}

// ═══════════════════════════════════════════════════════════════════
// 4. Proximity Analysis — are dangerous concepts near each other?
// ═══════════════════════════════════════════════════════════════════

interface ProximityPair {
  groupA: KeywordGroup;
  groupB: KeywordGroup;
  maxDistance: number; // max sentences apart to count as "near"
  bonus: number;
  label: string;
}

const PROXIMITY_RULES: ProximityPair[] = [
  { groupA: 'agency', groupB: 'account', maxDistance: 3, bonus: 42, label: '수사기관 사칭 ↔ 계좌/이체 (근접)' },
  { groupA: 'agency', groupB: 'money', maxDistance: 3, bonus: 40, label: '수사기관 사칭 ↔ 금액/송금 (근접)' },
  { groupA: 'family', groupB: 'money', maxDistance: 3, bonus: 36, label: '가족 사칭 ↔ 금전 요구 (근접)' },
  { groupA: 'family', groupB: 'urgency', maxDistance: 3, bonus: 28, label: '가족 사칭 ↔ 긴급 압박 (근접)' },
  { groupA: 'arrest', groupB: 'money', maxDistance: 3, bonus: 36, label: '체포 위협 ↔ 금액/송금 (근접)' },
  { groupA: 'agency', groupB: 'giftcard', maxDistance: 3, bonus: 40, label: '기관 사칭 ↔ 상품권 요구 (근접)' },
  { groupA: 'agency', groupB: 'crypto', maxDistance: 3, bonus: 40, label: '기관 사칭 ↔ 암호화폐 요구 (근접)' },
  { groupA: 'agency', groupB: 'tech', maxDistance: 3, bonus: 36, label: '기관 사칭 ↔ 원격제어/앱 (근접)' },
  { groupA: 'agency', groupB: 'personal_info', maxDistance: 3, bonus: 30, label: '기관 사칭 ↔ 개인정보 (근접)' },
  { groupA: 'agency', groupB: 'concealment', maxDistance: 3, bonus: 28, label: '기관 사칭 ↔ 비밀/은폐 (근접)' },
  { groupA: 'loan', groupB: 'money', maxDistance: 3, bonus: 34, label: '대환대출 ↔ 송금 요구 (근접)' },
  { groupA: 'giftcard', groupB: 'urgency', maxDistance: 3, bonus: 30, label: '상품권 ↔ 긴급 압박 (근접)' },
  { groupA: 'crypto', groupB: 'urgency', maxDistance: 3, bonus: 30, label: '암호화폐 ↔ 긴급 압박 (근접)' },
  { groupA: 'dialect', groupB: 'money', maxDistance: 4, bonus: 38, label: '연변 말투 ↔ 금전/송금 (근접)' },
  { groupA: 'dialect', groupB: 'account', maxDistance: 4, bonus: 40, label: '연변 말투 ↔ 계좌/이체 (근접)' },
  { groupA: 'dialect', groupB: 'agency', maxDistance: 4, bonus: 36, label: '연변 말투 ↔ 수사기관 사칭 (근접)' },
  { groupA: 'dialect', groupB: 'giftcard', maxDistance: 4, bonus: 38, label: '연변 말투 ↔ 상품권 요구 (근접)' },
  { groupA: 'dialect', groupB: 'personal_info', maxDistance: 4, bonus: 32, label: '연변 말투 ↔ 개인정보 수집 (근접)' },
  { groupA: 'tech', groupB: 'money', maxDistance: 3, bonus: 34, label: '링크/앱 유도 ↔ 금전/송금 (근접)' },
  { groupA: 'tech', groupB: 'account', maxDistance: 3, bonus: 36, label: '링크/앱 유도 ↔ 계좌/이체 (근접)' },
  { groupA: 'tech', groupB: 'personal_info', maxDistance: 3, bonus: 30, label: '링크/앱 유도 ↔ 개인정보 수집 (근접)' },
];

function analyzeProximity(sentences: SentenceAnalysis[]): ContextSignal[] {
  const signals: ContextSignal[] = [];
  // Build a map: group → list of sentence indices
  const groupIndices = new Map<KeywordGroup, number[]>();
  for (const s of sentences) {
    for (const g of s.groups) {
      if (!g) continue;
      const arr = groupIndices.get(g) ?? [];
      arr.push(s.index);
      groupIndices.set(g, arr);
    }
  }

  for (const rule of PROXIMITY_RULES) {
    const indicesA = groupIndices.get(rule.groupA);
    const indicesB = groupIndices.get(rule.groupB);
    if (!indicesA || !indicesB) continue;
    // Check if any pair is within maxDistance
    let minDist = Infinity;
    for (const a of indicesA) {
      for (const b of indicesB) {
        const dist = Math.abs(a - b);
        if (dist < minDist) minDist = dist;
      }
    }
    if (minDist <= rule.maxDistance) {
      // Closer = stronger signal; same sentence = max bonus
      const proximityFactor = minDist === 0 ? 1.0 : 1.0 - (minDist / (rule.maxDistance + 1)) * 0.3;
      const contribution = Math.round(rule.bonus * proximityFactor);
      signals.push({
        type: 'authority_money_combo', // will be overridden below
        label: rule.label,
        scoreContribution: contribution,
        description: (minDist === 0 ? '같은 문장' : minDist + '문장 간격') + ' 내에서 두 위험 요소가 결합됨',
      });
    }
  }
  return signals;
}

// ═══════════════════════════════════════════════════════════════════
// 5. Conversation Flow Pattern Detection
// ═══════════════════════════════════════════════════════════════════

interface FlowPattern {
  name: string;
  label: string;
  sequence: IntentType[];
  bonus: number;
  description: string;
}

const FLOW_PATTERNS: FlowPattern[] = [
  {
    name: 'authority_to_money',
    label: '기관 사칭 → 금전 요구 패턴',
    sequence: ['authority_claim', 'money_request'],
    bonus: 35,
    description: '수사기관을 사칭한 후 금전/송금을 요구하는 전형적인 보이스피싱 플로우',
  },
  {
    name: 'authority_threat_money',
    label: '기관 사칭 → 체포 위협 → 금전 요구 에스컬레이션',
    sequence: ['authority_claim', 'threat_coercion', 'money_request'],
    bonus: 48,
    description: '기관 사칭 → 법적 위협 → 송금 요구로 이어지는 고위험 에스컬레이션 패턴',
  },
  {
    name: 'family_urgency_money',
    label: '가족 사칭 → 긴급 → 금전 요구 패턴',
    sequence: ['family_impersonation', 'urgency_pressure', 'money_request'],
    bonus: 42,
    description: '가족을 사칭하고 긴급 상황을 조성해 송금을 요구하는 전형적 패턴',
  },
  {
    name: 'authority_concealment',
    label: '기관 사칭 → 비밀 지시 패턴',
    sequence: ['authority_claim', 'concealment_order'],
    bonus: 30,
    description: '수사기관 사칭 후 주변에 알리지 말라고 지시하는 은폐 패턴',
  },
  {
    name: 'authority_info_money',
    label: '기관 사칭 → 정보 수집 → 금전 요구',
    sequence: ['authority_claim', 'info_harvesting', 'money_request'],
    bonus: 42,
    description: '기관 사칭 → 개인정보/인증번호 수집 → 송금 요구 패턴',
  },
  {
    name: 'family_concealment_money',
    label: '가족 사칭 → 비밀 → 금전 요구',
    sequence: ['family_impersonation', 'concealment_order', 'money_request'],
    bonus: 38,
    description: '가족 사칭 후 부모에게 알리지 말라고 하며 송금을 요구하는 패턴',
  },
  {
    name: 'authority_tech',
    label: '기관 사칭 → 원격제어/앱 설치',
    sequence: ['authority_claim', 'tech_instruction'],
    bonus: 35,
    description: '수사기관 사칭 후 원격제어 앱 설치를 지시하는 패턴',
  },
  {
    name: 'dialect_money',
    label: '연변 말투 → 금전 요구 패턴',
    sequence: ['dialect_impersonation', 'money_request'],
    bonus: 40,
    description: '연변 말투가 감지된 후 금전/송금을 요구하는 전형적인 보이스피싱 플로우',
  },
  {
    name: 'dialect_authority_money',
    label: '연변 말투 → 기관 사칭 → 금전 요구 에스컬레이션',
    sequence: ['dialect_impersonation', 'authority_claim', 'money_request'],
    bonus: 52,
    description: '연변 말투로 기관을 사칭한 후 송금을 요구하는 고위험 에스컬레이션 패턴',
  },
  {
    name: 'authority_tech_money',
    label: '기관 사칭 → 링크/앱 유도 → 금전 요구 패턴',
    sequence: ['authority_claim', 'tech_instruction', 'money_request'],
    bonus: 45,
    description: '수사기관을 사칭한 후 링크 클릭이나 앱 설치를 유도하고 송금을 요구하는 피싱 패턴',
  },
];

function detectFlowPatterns(sentences: SentenceAnalysis[]): { pattern: FlowPattern; matched: boolean }[] {
  const results: { pattern: FlowPattern; matched: boolean }[] = [];
  const intents = sentences.map((s) => s.intent);

  for (const pattern of FLOW_PATTERNS) {
    // Check if the sequence appears in order (not necessarily consecutive)
    let searchStart = 0;
    let allFound = true;
    for (const target of pattern.sequence) {
      const idx = intents.indexOf(target, searchStart);
      if (idx === -1) {
        allFound = false;
        break;
      }
      searchStart = idx + 1;
    }
    results.push({ pattern, matched: allFound });
  }
  return results;
}

// ═══════════════════════════════════════════════════════════════════
// 6. Contextual Modifiers — adjust score based on conversation context
// ═══════════════════════════════════════════════════════════════════

interface ContextModifier {
  label: string;
  factor: number;       // multiplier or additive
  additive: number;     // flat bonus
  description: string;
  condition: (ctx: AnalysisContext) => boolean;
}

interface AnalysisContext {
  sentences: SentenceAnalysis[];
  intentDist: Record<string, number>;
  totalSentences: number;
  dangerousSentences: number;
  normalSentences: number;
  maxSentenceScore: number;
  avgSentenceScore: number;
  hasAuthority: boolean;
  hasMoneyRequest: boolean;
  hasFamily: boolean;
  hasThreat: boolean;
  hasUrgency: boolean;
  hasConcealment: boolean;
  hasTech: boolean;
  hasInfoHarvesting: boolean;
  hasGiftcard: boolean;
  hasCrypto: boolean;
  hasDialect: boolean;
  repeatedMoneyRequests: number;
  totalKeywords: number;
  totalRegex: number;
}

function buildContext(sentences: SentenceAnalysis[]): AnalysisContext {
  const dist: Record<string, number> = {};
  let dangerous = 0;
  let normal = 0;
  let maxScore = 0;
  let scoreSum = 0;
  let repeatedMoney = 0;
  let totalKw = 0;
  let totalRx = 0;

  for (const s of sentences) {
    dist[s.intent] = (dist[s.intent] ?? 0) + 1;
    if (s.intent === 'money_request') repeatedMoney++;
    if (s.intent.startsWith('normal') || s.intent === 'unknown') {
      normal++;
    } else {
      dangerous++;
    }
    maxScore = Math.max(maxScore, s.intentScore);
    scoreSum += s.intentScore;
    totalKw += s.hits.length;
    totalRx += s.regexHits.length;
  }

  return {
    sentences,
    intentDist: dist,
    totalSentences: sentences.length,
    dangerousSentences: dangerous,
    normalSentences: normal,
    maxSentenceScore: maxScore,
    avgSentenceScore: sentences.length > 0 ? scoreSum / sentences.length : 0,
    hasAuthority: (dist['authority_claim'] ?? 0) > 0,
    hasMoneyRequest: (dist['money_request'] ?? 0) > 0,
    hasFamily: (dist['family_impersonation'] ?? 0) > 0,
    hasThreat: (dist['threat_coercion'] ?? 0) > 0,
    hasUrgency: (dist['urgency_pressure'] ?? 0) > 0,
    hasConcealment: (dist['concealment_order'] ?? 0) > 0,
    hasTech: (dist['tech_instruction'] ?? 0) > 0,
    hasInfoHarvesting: (dist['info_harvesting'] ?? 0) > 0,
    hasGiftcard: sentences.some((s) => s.groups.includes('giftcard')),
    hasCrypto: sentences.some((s) => s.groups.includes('crypto')),
    hasDialect: (dist['dialect_impersonation'] ?? 0) > 0,
    repeatedMoneyRequests: repeatedMoney,
    totalKeywords: totalKw,
    totalRegex: totalRx,
  };
}

const CONTEXT_MODIFIERS: ContextModifier[] = [
  // ── Escalation: multiple dangerous intents amplify ──
  {
    label: '다중 위험 인텐트 결합',
    factor: 1, additive: 0,
    description: '기관 사칭 + 금전 요구가 동시에 나타나는 전형적 피싱 구조',
    condition: (c) => c.hasAuthority && c.hasMoneyRequest,
  },
  {
    label: '위협 기반 강압',
    factor: 1, additive: 0,
    description: '체포/법적 위협과 금전 요구가 결합된 강압적 구조',
    condition: (c) => c.hasThreat && c.hasMoneyRequest,
  },
  {
    label: '가족 사칭 + 금전 요구',
    factor: 1, additive: 0,
    description: '가족을 사칭하여 금전을 요구하는 전형적 패턴',
    condition: (c) => c.hasFamily && c.hasMoneyRequest,
  },
  {
    label: '비밀 지시 + 고립',
    factor: 1, additive: 0,
    description: '주변에 알리지 말라고 지시하며 고립을 유도',
    condition: (c) => c.hasConcealment && (c.hasAuthority || c.hasFamily),
  },
  {
    label: '반복적 송금 요구',
    factor: 1, additive: 0,
    description: '송금/금전 요구가 여러 문장에서 반복됨 (집요함 지표)',
    condition: (c) => c.repeatedMoneyRequests >= 2,
  },
  {
    label: '정보 수집 + 송금',
    factor: 1, additive: 0,
    description: '개인정보/인증번호 수집 후 송금으로 이어지는 체인',
    condition: (c) => c.hasInfoHarvesting && c.hasMoneyRequest,
  },
  {
    label: '원격제어/앱 설치 지시',
    factor: 1, additive: 0,
    description: '원격제어 앱 설치를 지시하여 기기 제어를 시도',
    condition: (c) => c.hasTech && (c.hasAuthority || c.hasMoneyRequest),
  },
  {
    label: '상품권/암호화폐 결제',
    factor: 1, additive: 0,
    description: '추적이 어려운 상품권/암호화폐로 결제를 요구',
    condition: (c) => (c.hasGiftcard || c.hasCrypto) && (c.hasAuthority || c.hasMoneyRequest),
  },
  {
    label: '연변 말투 + 금전/기관 사칭 결합',
    factor: 1, additive: 0,
    description: '연변 말투가 감지되면서 금전 요구 또는 기관 사칭이 동시에 나타나는 고위험 구조',
    condition: (c) => c.hasDialect && (c.hasMoneyRequest || c.hasAuthority),
  },
  {
    label: '연변 말투 단독 감지',
    factor: 1, additive: 0,
    description: '명백한 연변 말투가 감지됨 — 조선족 사칭 보이스피싱 위험 신호',
    condition: (c) => c.hasDialect,
  },
];

// ── Negative modifiers: reduce score when context is benign ──
const NEGATIVE_MODIFIERS: ContextModifier[] = [
  {
    label: '일상 대화 우세',
    factor: 0.5, additive: 0,
    description: '대부분의 문장이 일상 인사/정보로 구성됨',
    condition: (c) => c.normalSentences > c.dangerousSentences && c.dangerousSentences <= 1 && !c.hasDialect,
  },
  {
    label: '위험 인텐트 부재',
    factor: 0.3, additive: 0,
    description: '위험 인텐트가 전혀 탐지되지 않음',
    condition: (c) => c.dangerousSentences === 0 && !c.hasDialect,
  },
  {
    label: '단일 키워드 노이즈',
    factor: 0.4, additive: 0,
    description: '위험 키워드가 1개만 산발적 출현 (문맥 결여)',
    condition: (c) => c.totalKeywords + c.totalRegex <= 1 && c.dangerousSentences <= 1 && !c.hasDialect,
  },
];

// ═══════════════════════════════════════════════════════════════════
// 7. Score Synthesis — combine all signals into final risk score
// ═══════════════════════════════════════════════════════════════════

export function analyzeContext(transcript: string): SemanticAnalysis {
  const text = transcript;

  // ── 7a. Sentence-level analysis ──
  const sentenceTexts = splitSentences(text);
  const sentences: SentenceAnalysis[] = sentenceTexts.map((s, i) => {
    const hits = scanKeywordsInSentence(s);
    const regexHits = scanRegexInSentence(s);
    const { intent, score } = classifyIntent(hits, regexHits, s);
    const groups = Array.from(new Set(
      [...hits, ...regexHits].map((h) => h.group).filter(Boolean)
    )) as KeywordGroup[];
    return {
      index: i,
      text: s,
      intent,
      intentLabel: INTENT_LABELS[intent],
      intentScore: score,
      hits,
      regexHits,
      groups,
    };
  });

  // ── 7b. Global keyword/regex hits (for report display) ──
  const keywordHits: KeywordHit[] = [];
  for (const kw of KEYWORD_DICTIONARY) {
    let count = 0;
    let idx = text.indexOf(kw.keyword);
    const excerpts: string[] = [];
    const isEnglish = /[a-zA-Z]/.test(kw.keyword);
    const haystack = isEnglish ? text.toLowerCase() : text;
    const needle = isEnglish ? kw.keyword.toLowerCase() : kw.keyword;
    idx = haystack.indexOf(needle);
    while (idx !== -1 && count < 6) {
      count++;
      const start = Math.max(0, idx - 12);
      const end = Math.min(text.length, idx + kw.keyword.length + 12);
      excerpts.push(text.slice(start, end).trim());
      idx = haystack.indexOf(needle, idx + needle.length);
    }
    if (count > 0) {
      keywordHits.push({
        keyword: kw.keyword,
        category: kw.category,
        group: kw.group,
        weight: kw.weight,
        count,
        excerpts,
      });
    }
  }

  const regexHits: RegexHit[] = [];
  for (const rx of REGEX_PATTERNS) {
    const re = new RegExp(rx.pattern.source, rx.pattern.flags);
    let count = 0;
    const excerpts: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null && count < 6) {
      count++;
      const start = Math.max(0, m.index - 12);
      const end = Math.min(text.length, m.index + m[0].length + 12);
      excerpts.push(text.slice(start, end).trim());
    }
    if (count > 0) {
      regexHits.push({
        pattern: rx.label,
        label: rx.label,
        category: rx.category,
        group: rx.group,
        weight: rx.weight,
        count,
        excerpts,
      });
    }
  }

  // ── 7c. Base keyword score (raw weight sum, capped) ──
  let baseKeywordScore = keywordHits.reduce((acc, h) => acc + h.weight * h.count, 0);
  baseKeywordScore += regexHits.reduce((acc, h) => acc + h.weight * h.count, 0);
  baseKeywordScore = Math.min(100, baseKeywordScore);

  // ── 7d. Build analysis context ──
  const ctx = buildContext(sentences);

  // ── 7e. Proximity signals ──
  const proximitySignals = analyzeProximity(sentences);
  const proximityBonus = proximitySignals.reduce((acc, s) => acc + s.scoreContribution, 0);

  // ── 7f. Flow pattern signals ──
  const flowResults = detectFlowPatterns(sentences);
  const matchedFlows = flowResults.filter((f) => f.matched);
  const flowBonus = matchedFlows.reduce((acc, f) => acc + f.pattern.bonus, 0);
  const flowSignals: ContextSignal[] = matchedFlows.map((f) => ({
    type: 'authority_threat_escalation',
    label: f.pattern.label,
    scoreContribution: f.pattern.bonus,
    description: f.pattern.description,
  }));

  // ── 7g. Context modifier signals ──
  const positiveMods = CONTEXT_MODIFIERS.filter((m) => m.condition(ctx));
  const negativeMods = NEGATIVE_MODIFIERS.filter((m) => m.condition(ctx));
  const modifierSignals: ContextSignal[] = [
    ...positiveMods.map((m) => ({
      type: 'authority_money_combo' as const,
      label: m.label,
      scoreContribution: 0, // applied as multiplier below
      description: m.description,
    })),
    ...negativeMods.map((m) => ({
      type: 'normal_conversation' as const,
      label: m.label,
      scoreContribution: 0,
      description: m.description,
    })),
  ];

  // ── 7h. Score synthesis ──
  // Start with sentence-based score (max sentence score as anchor)
  let contextScore = ctx.maxSentenceScore;

  // Add proximity bonus
  contextScore += proximityBonus * 0.7;

  // Add flow pattern bonus
  contextScore += flowBonus * 0.8;

  // Apply positive modifier additive bonuses
  const positiveAdditive = positiveMods.length * 12; // each matched modifier adds
  contextScore += positiveAdditive;

  // Apply negative modifiers (multiplicative dampening)
  for (const mod of negativeMods) {
    contextScore *= mod.factor;
  }

  // Blend with base keyword score (context takes priority, but keyword score provides floor)
  let contextAdjustedScore = contextScore;
  // If keyword score is high but context is low (scattered keywords without pattern), reduce
  if (baseKeywordScore > 40 && contextScore < 30) {
    contextAdjustedScore = Math.max(contextScore, baseKeywordScore * 0.3);
  }
  // If context score is high, ensure it's not lower than 60% of keyword score
  if (contextScore > 50) {
    contextAdjustedScore = Math.max(contextAdjustedScore, baseKeywordScore * 0.5);
  }

  // Final score: weighted blend of context-adjusted and keyword base
  let finalScore = contextAdjustedScore * 0.75 + baseKeywordScore * 0.35;

  // Confidence: higher when more sentences analyzed and more signals detected
  const totalSignals = proximitySignals.length + matchedFlows.length + positiveMods.length;
  let confidence = 0.5;
  if (ctx.totalSentences >= 3) confidence += 0.15;
  if (ctx.totalSentences >= 5) confidence += 0.1;
  if (totalSignals >= 2) confidence += 0.15;
  if (totalSignals >= 4) confidence += 0.1;
  confidence = Math.min(0.98, confidence);

  // If no dangerous signals at all (and no dialect), force low score
  if (ctx.dangerousSentences === 0 && proximitySignals.length === 0 && matchedFlows.length === 0 && !ctx.hasDialect) {
    finalScore = Math.min(finalScore, 10);
  }

  finalScore = Math.min(100, Math.max(0, Math.round(finalScore)));

  // ── 7i. Combine all signals ──
  const allSignals = [...proximitySignals, ...flowSignals, ...modifierSignals];
  const combinationBonuses = allSignals.map((s) => `${s.label} (+${s.scoreContribution || 0})`);

  const matchedCategories = Array.from(
    new Set([...keywordHits.map((h) => h.category), ...regexHits.map((h) => h.category)])
  );

  // Intent distribution
  const intentDistribution: Record<string, number> = {};
  for (const s of sentences) {
    intentDistribution[s.intent] = (intentDistribution[s.intent] ?? 0) + 1;
  }

  // Flow pattern description
  let flowPattern = '일상 대화 흐름';
  if (matchedFlows.length > 0) {
    flowPattern = matchedFlows.map((f) => f.pattern.label).join(' + ');
  } else if (ctx.dangerousSentences > 0) {
    flowPattern = '산발적 위험 키워드 (명확한 패턴 없음)';
  }

  return {
    riskScore: finalScore,
    hits: keywordHits,
    regexHits,
    matchedCategories,
    combinationBonuses,
    sentences,
    contextSignals: allSignals,
    intentDistribution,
    flowPattern,
    confidence,
    baseKeywordScore,
    contextAdjustedScore: Math.round(contextAdjustedScore),
    finalScore,
  };
}
