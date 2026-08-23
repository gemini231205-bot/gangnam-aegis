import type { UpstageAnalysis } from './types';

const UPSTAGE_API_KEY = import.meta.env.VITE_UPSTAGE_API_KEY as string;
const UPSTAGE_URL = 'https://api.upstage.ai/v1/solar/chat/completions';

const SYSTEM_PROMPT = `당신은 보이스피싱 탐지 전문 AI 분석가입니다. 주어진 통화 텍스트를 분석하여 보이스피싱 위험도를 평가해야 합니다.

다음 항목들을 분석하세요:
1. 통화의 전체적인 맥락과 의도 파악
2. 수사기관 사칭 여부 (검찰, 경찰, 금융감독원 등)
3. 금전 요구 및 송금 유도 여부
4. 긴급성 부여 및 시간 압박 여부
5. 비밀 유지 / 타인에게 알리지 말 것 요구 여부
6. 개인정보 수집 시도 여부
7. 대화 흐름의 자연스러움 (사기 패턴 vs 일상 대화)
8. 연변 말투 (조선족 사투리) 사용 여부 — 연변 말투가 명백하게 감지되면 위험 요소로 판단하세요. 연변 말투의 특징: '고마', '그라믄', '쪼매', '가심까', '하심까', '무쿠다', '그라이가', '고마해라', '어디 가오', '뭐라오' 등. 단, 단어 1-2개만 우연히 일반어와 겹치는 경우는 연변 말투로 간주하지 말고, 명백한 연변 사투리 패턴이 2개 이상일 때만 위험 요소로 판단하세요.
9. 링크/앱 유도 여부 — "링크 보내줄게", "이 앱 깔아", "여기 접속해", "문자로 보내줄게", "카톡으로 보낼게" 등 링크나 앱 설치를 유도하는 표현이 있으면 위험 요소로 판단하세요. 특히 수사기관 사칭이나 금전 요구와 함께 나타나면 고위험으로 평가하세요.

반드시 다음 JSON 형식으로만 응답하세요:
{
  "riskScore": 0-100 사이의 정수,
  "summary": "통화 내용 요약 및 위험 분석 (2-3문장)",
  "detectedPatterns": ["탐지된 보이스피싱 패턴 목록"],
  "intentClassification": "전체 통화의 의도 분류 (예: 보이스피싱 시도, 일상 대화, 대출 사기 의심, 연변 말투 기반 피싱 의심 등)",
  "confidence": 0-1 사이의 소수
}

위험도 기준:
- 0-20: 안전 (일상 대화)
- 21-40: 주의 (일부 위험 신호)
- 41-70: 위험 (보이스피싱 의심)
- 71-100: 심각 (명확한 보이스피싱)`;

const CORRECT_PROMPT = `당신은 한국어 음성 인식(STT) 오인식 교정 전문가입니다. 음성 인식기가 출력한 텍스트에서 오인식된 단어를 문맥에 맞게 교정하여 자연스러운 한국어 문장으로 만듭니다.

출력 규칙 (절대 준수):
- 교정된 텍스트만 출력. 설명, 메모, 주석, 이유, 근거를 절대 출력하지 마세요.
- "원문에 존재하는 단어로...", "의미를 파악할 수 없어...", "오타일 가능성이..." 같은 부가 설명 절대 금지.
- JSON, 마크다운, 따옴표 없이 순수 교정된 텍스트만 출력.

교정 규칙:
1. 발음이 비슷해 잘못 들린 단어를 올바른 단어로 교체. 원문에 없는 단어라도, 발음이 비슷하고 문맥에 맞는 올바른 한국어 단어라면 교체 가능.
   예: "대포어" → "계좌번호", "삼청만원" → "삼천만원", "담장" → "당장", "존솔치" → "전화번호"
2. 보이스피싱 관련 단어가 오인식된 경우 적극적으로 복원:
   검찰, 경찰, 금융감독원, 계좌, 계좌번호, 통장, 송금, 입금, 비밀번호, 신분증, 인증, 앱, 링크, 수사, 당장, 금융
   예: "대포어" → "계좌번호", "금감" → "금융감독원", "송금" → "송금"
3. 문맥상 어색한 조사/어미를 자연스러운 것으로 교정 (예: "입금해 말해" → "입금해 달라고 해")
4. 띄어쓰기 교정 (예: "차주인이" → "차 주인이")
5. 잘못 들린 단어가 여러 개면 모두 교정 (개수 제한 없음)

금지 사항:
- 문장 수 변경 (1문장 입력 → 1문장 출력)
- 원문의 핵심 의미를 다른 의미로 변경
- 발음과 전혀 다른, 문맥과 무관한 새로운 정보나 단어 생성
- 문장 부호 추가/변경
- 출력에 설명, 이유, 메모, 주석 포함

교정된 문장은 한국어 원어민이 읽었을 때 전혀 어색함이 없어야 합니다.

아래는 교정 예시입니다 (이 예시는 절대 출력에 포함하지 마세요):
입력: 지금 담장 삼청만원만 이끌어줘
출력: 지금 당장 삼천만원만 입금해줘

입력: 엄마 차사고 갔는데 차주인이 100만원을 입금해 말해
출력: 엄마 차 사고 났는데 차 주인이 100만 원을 입금해 달라고 해

입력: 대포어 알려드릴게요
출력: 계좌번호 알려드릴게요

위 예시는 참고용이며, 실제 입력에 대해서만 교정된 텍스트만 출력하세요.`;

const EXPLAIN_PATTERNS = [
  /원문에\s*존재하는/i,
  /의미를\s*파악할\s*수\s*없/i,
  /오타일\s*가능성/i,
  /교정된\s*텍스트/i,
  /—\s*원문/i,
  /-\s*원문/i,
  /원문에\s*없는/i,
  /그대로\s*유지/i,
  /수정하지\s*않았/i,
];

const FEW_SHOT_SENTENCES = [
  '지금 당장 삼천만원만 입금해줘',
  '엄마 차 사고 났는데 차 주인이 100만 원을 입금해 달라고 해',
  '계좌번호 알려드릴게요',
];

export async function correctTranscript(transcript: string): Promise<string> {
  if (!transcript.trim()) return transcript;
  if (!UPSTAGE_API_KEY) return transcript;

  try {
    const response = await fetch(UPSTAGE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${UPSTAGE_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'solar-pro',
        messages: [
          { role: 'system', content: CORRECT_PROMPT },
          { role: 'user', content: transcript },
        ],
        temperature: 0.1,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) return transcript;

    const data = await response.json();
    let corrected = (data.choices?.[0]?.message?.content ?? '').trim();

    const lines = corrected.split('\n');
    if (lines.length > 1) {
      const cleanLines = lines.filter((l: string) => !EXPLAIN_PATTERNS.some((p) => p.test(l)));
      if (cleanLines.length > 0 && cleanLines.length < lines.length) {
        corrected = cleanLines.join(' ').trim();
      }
    }
    for (const p of EXPLAIN_PATTERNS) {
      const match = corrected.match(p);
      if (match && match.index !== undefined && match.index > 0) {
        corrected = corrected.slice(0, match.index).trim();
      }
    }

    for (const fs of FEW_SHOT_SENTENCES) {
      if (corrected.includes(fs) && !transcript.includes(fs)) {
        corrected = corrected.replace(fs, '').trim();
      }
    }

    return corrected || transcript;
  } catch {
    return transcript;
  }
}

export async function analyzeWithUpstage(transcript: string): Promise<UpstageAnalysis> {
  if (!transcript.trim()) {
    return {
      riskScore: 0,
      summary: '분석할 텍스트가 없습니다.',
      detectedPatterns: [],
      intentClassification: '텍스트 없음',
      confidence: 0,
      used: false,
    };
  }

  if (!UPSTAGE_API_KEY) {
    return {
      riskScore: 0,
      summary: 'Upstage AI 분석을 사용할 수 없습니다. 로컬 문맥 분석으로 판단합니다.',
      detectedPatterns: [],
      intentClassification: '분석 불가 (API 키 없음)',
      confidence: 0,
      used: false,
    };
  }

  try {
    const response = await fetch(UPSTAGE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${UPSTAGE_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'solar-pro',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `다음 통화 텍스트를 분석하세요:\n\n${transcript}` },
        ],
        temperature: 0.3,
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      throw new Error(`Upstage API error (${response.status})`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? '';

    let parsed: {
      riskScore: number;
      summary: string;
      detectedPatterns: string[];
      intentClassification: string;
      confidence: number;
    };

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch {
      return {
        riskScore: 50,
        summary: content.slice(0, 200) || 'Upstage AI 분석 응답 파싱 실패',
        detectedPatterns: [],
        intentClassification: '분석 오류',
        confidence: 0.3,
        used: true,
      };
    }

    return {
      riskScore: Math.min(100, Math.max(0, Math.round(parsed.riskScore ?? 0))),
      summary: parsed.summary ?? '',
      detectedPatterns: parsed.detectedPatterns ?? [],
      intentClassification: parsed.intentClassification ?? '',
      confidence: Math.min(1, Math.max(0, parsed.confidence ?? 0.5)),
      used: true,
    };
  } catch {
    return {
      riskScore: 0,
      summary: 'Upstage AI 분석을 사용할 수 없습니다. 로컬 문맥 분석으로 판단합니다.',
      detectedPatterns: [],
      intentClassification: '분석 불가 (API 오류)',
      confidence: 0,
      used: false,
    };
  }
}
