import type { PresetConfig, KeywordGroup } from './types';

export const PRESETS: PresetConfig[] = [
  {
    id: 'daechi-phishing',
    label: '대치동 자녀 음성 복제 피싱 사례',
    shortLabel: '대치동 자녀 피싱',
    description: 'AI로 복제된 자녀 목소리로 긴급 합의금 송금을 요구하는 전형적인 보이스피싱 시나리오',
    expectedLevel: 'critical',
    accent: 'red',
    transcript:
      '엄마 나야, 나 지금 대치동 학원 앞인데 조금 전에 차 사고가 났어. ' +
      '상대방이 머리를 다쳐서 지금 당장 합의금이 필요하대. ' +
      '빨리 계좌이체 해줘, 당장 500만원만 보내줘. ' +
      '경찰에 신고하면 안돼, 나 큰일나. 지금 당장 보내야 해. ' +
      '엄마, 제발 빨리, 시간 없어.',
  },
  {
    id: 'gangnam-casual',
    label: '강남역 일상 안부 통화',
    shortLabel: '강남역 일상 안부',
    description: '강남역에서 친구와 나누는 자연스러운 일상 안부 통화 — 위험 요소 없음',
    expectedLevel: 'safe',
    accent: 'emerald',
    transcript:
      '어, 나야. 지금 강남역 10번 출구 앞이야. ' +
      '오늘 날씨 진짜 좋다. 우리 저녁 같이 먹을까? ' +
      '신논현 쪽에 맛있는 식당 생겼대. ' +
      '시간 될 때 연락줘. 별일 없지? 조심히 들어와.',
  },
  {
    id: 'loan-scam-caution',
    label: '대환대출 사기 의심 통화',
    shortLabel: '대환대출 사기 의심',
    description: '저금리 대환대출을 빙자해 기존 대출 상환을 유도하는 의심 통화 — 부분적 위험 신호',
    expectedLevel: 'caution',
    accent: 'amber',
    transcript:
      '안녕하세요, 고객님. 저희 금융센터에서 연락드렸습니다. ' +
      '현재 고객님의 신용등급이 좋아져서 저금리 대환대출이 가능하십니다. ' +
      '기존 대출 상환하시면 더 낮은 이자로 전환할 수 있어요. ' +
      '먼저 상담원 연결해드릴게요. 잠시만 기다려주세요.',
  },
];

// ─── Keyword Definition ──────────────────────────────────────────

export interface KeywordDef {
  keyword: string;
  category: string;
  group: KeywordGroup;
  /** Per-occurrence weight (higher = more dangerous). */
  weight: number;
}

// ─── Korean Keyword Dictionary (~100 patterns) ────────────────────

const KO_AGENCY: KeywordDef[] = [
  { keyword: '검찰청', category: 'KO/수사기관', group: 'agency', weight: 20 },
  { keyword: '서울중앙지검', category: 'KO/수사기관', group: 'agency', weight: 22 },
  { keyword: '대검찰청', category: 'KO/수사기관', group: 'agency', weight: 20 },
  { keyword: '검사', category: 'KO/수사기관', group: 'agency', weight: 20 },
  { keyword: '검찰', category: 'KO/수사기관', group: 'agency', weight: 20 },
  { keyword: '경찰청', category: 'KO/수사기관', group: 'agency', weight: 20 },
  { keyword: '경찰', category: 'KO/수사기관', group: 'agency', weight: 17 },
  { keyword: '수사관', category: 'KO/수사기관', group: 'agency', weight: 20 },
  { keyword: '형사', category: 'KO/수사기관', group: 'agency', weight: 17 },
  { keyword: '금융감독원', category: 'KO/수사기관', group: 'agency', weight: 20 },
  { keyword: '금감원', category: 'KO/수사기관', group: 'agency', weight: 20 },
  { keyword: '국세청', category: 'KO/수사기관', group: 'agency', weight: 17 },
  { keyword: '국정원', category: 'KO/수사기관', group: 'agency', weight: 20 },
  { keyword: '국가정보원', category: 'KO/수사기관', group: 'agency', weight: 20 },
  { keyword: '대포통장', category: 'KO/수사기관', group: 'account', weight: 25 },
  { keyword: '범죄자금', category: 'KO/수사기관', group: 'agency', weight: 20 },
  { keyword: '명의도용', category: 'KO/수사기관', group: 'personal_info', weight: 17 },
  { keyword: '개인정보유출', category: 'KO/수사기관', group: 'personal_info', weight: 17 },
  { keyword: '개인정보 유출', category: 'KO/수사기관', group: 'personal_info', weight: 17 },
  { keyword: '형사고발', category: 'KO/수사기관', group: 'arrest', weight: 20 },
  { keyword: '구속영장', category: 'KO/수사기관', group: 'arrest', weight: 22 },
  { keyword: '체포영장', category: 'KO/수사기관', group: 'arrest', weight: 22 },
  { keyword: '압수수색', category: 'KO/수사기관', group: 'arrest', weight: 20 },
  { keyword: '비상계좌', category: 'KO/수사기관', group: 'account', weight: 22 },
  { keyword: '안전계좌', category: 'KO/수사기관', group: 'account', weight: 25 },
  { keyword: '보안계좌', category: 'KO/수사기관', group: 'account', weight: 25 },
  { keyword: '국가안전계좌', category: 'KO/수사기관', group: 'account', weight: 25 },
  { keyword: '자금 freeze', category: 'KO/수사기관', group: 'agency', weight: 17 },
  { keyword: '자금동결', category: 'KO/수사기관', group: 'agency', weight: 17 },
  { keyword: '금융범죄 연루', category: 'KO/수사기관', group: 'agency', weight: 20 },
  { keyword: '비밀수사', category: 'KO/수사기관', group: 'concealment', weight: 17 },
  { keyword: '은폐 지시', category: 'KO/수사기관', group: 'concealment', weight: 17 },
];

const KO_FINANCIAL: KeywordDef[] = [
  { keyword: '현금인출', category: 'KO/금융송금', group: 'money', weight: 20 },
  { keyword: '계좌이체', category: 'KO/금융송금', group: 'account', weight: 22 },
  { keyword: '계좌 이체', category: 'KO/금융송금', group: 'account', weight: 22 },
  { keyword: '이체', category: 'KO/금융송금', group: 'account', weight: 17 },
  { keyword: '송금', category: 'KO/금융송금', group: 'money', weight: 20 },
  { keyword: '보내줘', category: 'KO/금융송금', group: 'money', weight: 14 },
  { keyword: '입금', category: 'KO/금융송금', group: 'money', weight: 14 },
  { keyword: '합의금', category: 'KO/금융송금', group: 'money', weight: 22 },
  { keyword: '수리비', category: 'KO/금융송금', group: 'money', weight: 20 },
  { keyword: '문화상품권', category: 'KO/금융송금', group: 'giftcard', weight: 25 },
  { keyword: '상품권', category: 'KO/금융송금', group: 'giftcard', weight: 20 },
  { keyword: '상품권 현금화', category: 'KO/금융송금', group: 'giftcard', weight: 25 },
  { keyword: '핀번호', category: 'KO/금융송금', group: 'personal_info', weight: 20 },
  { keyword: '비밀번호', category: 'KO/금융송금', group: 'personal_info', weight: 17 },
  { keyword: '계좌번호', category: 'KO/금융송금', group: 'account', weight: 20 },
  { keyword: '카드번호', category: 'KO/금융송금', group: 'account', weight: 20 },
  { keyword: '수수료 선입금', category: 'KO/금융송금', group: 'money', weight: 22 },
  { keyword: '대출상환', category: 'KO/금융송금', group: 'money', weight: 17 },
  { keyword: '대환대출', category: 'KO/금융송금', group: 'loan', weight: 20 },
  { keyword: '저금리 대환대출', category: 'KO/금융송금', group: 'loan', weight: 22 },
  { keyword: '기존 대출 상환', category: 'KO/금융송금', group: 'loan', weight: 17 },
  { keyword: '대출 보증금', category: 'KO/금융송금', group: 'money', weight: 22 },
  { keyword: '신용등급 조정', category: 'KO/금융송금', group: 'loan', weight: 17 },
  { keyword: '원격제어', category: 'KO/금융송금', group: 'tech', weight: 22 },
  { keyword: '원격제어 앱', category: 'KO/금융송금', group: 'tech', weight: 25 },
  { keyword: '팀뷰어', category: 'KO/금융송금', group: 'tech', weight: 25 },
  { keyword: '악성 앱', category: 'KO/금융송금', group: 'tech', weight: 22 },
  { keyword: '대리 구매', category: 'KO/금융송금', group: 'money', weight: 17 },
  { keyword: '신분증 사진', category: 'KO/금융송금', group: 'personal_info', weight: 20 },
  { keyword: '주민등록증', category: 'KO/금융송금', group: 'personal_info', weight: 20 },
  { keyword: '인증번호', category: 'KO/금융송금', group: 'personal_info', weight: 17 },
  { keyword: 'OTP', category: 'KO/금융송금', group: 'personal_info', weight: 20 },
];

// ─── 링크/앱 유도 키워드 (Link/App sharing lures) ──────────────────
// 피싱에서 "링크 보내줄게", "이 앱 깔아", "여기 접속해" 등
// 링크나 앱 설치를 유도하는 표현을 위험 요소로 탐지합니다.

const KO_LINK_APP: KeywordDef[] = [
  { keyword: '링크', category: 'KO/링크앱유도', group: 'tech', weight: 17 },
  { keyword: '링크 보내', category: 'KO/링크앱유도', group: 'tech', weight: 22 },
  { keyword: '링크 보내줄', category: 'KO/링크앱유도', group: 'tech', weight: 25 },
  { keyword: '링크 보내준다', category: 'KO/링크앱유도', group: 'tech', weight: 25 },
  { keyword: '링크 보내드릴', category: 'KO/링크앱유도', group: 'tech', weight: 25 },
  { keyword: '링크 클릭', category: 'KO/링크앱유도', group: 'tech', weight: 25 },
  { keyword: '링크 눌러', category: 'KO/링크앱유도', group: 'tech', weight: 22 },
  { keyword: '링크 접속', category: 'KO/링크앱유도', group: 'tech', weight: 25 },
  { keyword: '여기 링크', category: 'KO/링크앱유도', group: 'tech', weight: 22 },
  { keyword: '이 링크', category: 'KO/링크앱유도', group: 'tech', weight: 20 },
  { keyword: 'URL', category: 'KO/링크앱유도', group: 'tech', weight: 17 },
  { keyword: 'url', category: 'KO/링크앱유도', group: 'tech', weight: 17 },
  { keyword: '접속해', category: 'KO/링크앱유도', group: 'tech', weight: 20 },
  { keyword: '접속하세요', category: 'KO/링크앱유도', group: 'tech', weight: 22 },
  { keyword: '접속해줘', category: 'KO/링크앱유도', group: 'tech', weight: 22 },
  { keyword: '앱 설치', category: 'KO/링크앱유도', group: 'tech', weight: 25 },
  { keyword: '앱 깔아', category: 'KO/링크앱유도', group: 'tech', weight: 25 },
  { keyword: '앱 깔아봐', category: 'KO/링크앱유도', group: 'tech', weight: 25 },
  { keyword: '앱 다운로드', category: 'KO/링크앱유도', group: 'tech', weight: 22 },
  { keyword: '이 앱', category: 'KO/링크앱유도', group: 'tech', weight: 20 },
  { keyword: '앱 깔아야', category: 'KO/링크앱유도', group: 'tech', weight: 25 },
  { keyword: '설치해', category: 'KO/링크앱유도', group: 'tech', weight: 20 },
  { keyword: '설치하세요', category: 'KO/링크앱유도', group: 'tech', weight: 22 },
  { keyword: '다운로드해', category: 'KO/링크앱유도', group: 'tech', weight: 20 },
  { keyword: '다운받아', category: 'KO/링크앱유도', group: 'tech', weight: 20 },
  { keyword: '보내준다', category: 'KO/링크앱유도', group: 'tech', weight: 14 },
  { keyword: '보내드릴게', category: 'KO/링크앱유도', group: 'tech', weight: 14 },
  { keyword: '보내드릴게요', category: 'KO/링크앱유도', group: 'tech', weight: 14 },
  { keyword: '문자로 보내', category: 'KO/링크앱유도', group: 'tech', weight: 20 },
  { keyword: '문자로 보내줄', category: 'KO/링크앱유도', group: 'tech', weight: 22 },
  { keyword: '문자로 보내드릴', category: 'KO/링크앱유도', group: 'tech', weight: 22 },
  { keyword: '카톡으로 보내', category: 'KO/링크앱유도', group: 'tech', weight: 20 },
  { keyword: '카톡으로 보내줄', category: 'KO/링크앱유도', group: 'tech', weight: 22 },
  { keyword: '카톡으로 보내드릴', category: 'KO/링크앱유도', group: 'tech', weight: 22 },
  { keyword: '클릭해', category: 'KO/링크앱유도', group: 'tech', weight: 20 },
  { keyword: '클릭하세요', category: 'KO/링크앱유도', group: 'tech', weight: 22 },
  { keyword: '눌러봐', category: 'KO/링크앱유도', group: 'tech', weight: 17 },
  { keyword: '눌러보세요', category: 'KO/링크앱유도', group: 'tech', weight: 17 },
  { keyword: '접속해봐', category: 'KO/링크앱유도', group: 'tech', weight: 22 },
  { keyword: '접속해보세요', category: 'KO/링크앱유도', group: 'tech', weight: 22 },
];

const KO_FAMILY: KeywordDef[] = [
  { keyword: '엄마', category: 'KO/가족사칭', group: 'family', weight: 14 },
  { keyword: '아빠', category: 'KO/가족사칭', group: 'family', weight: 14 },
  { keyword: '아들', category: 'KO/가족사칭', group: 'family', weight: 14 },
  { keyword: '딸', category: 'KO/가족사칭', group: 'family', weight: 14 },
  { keyword: '할머니', category: 'KO/가족사칭', group: 'family', weight: 14 },
  { keyword: '할아버지', category: 'KO/가족사칭', group: 'family', weight: 14 },
  { keyword: '손자', category: 'KO/가족사칭', group: 'family', weight: 14 },
  { keyword: '손녀', category: 'KO/가족사칭', group: 'family', weight: 14 },
  { keyword: '핸드폰 액정', category: 'KO/가족사칭', group: 'family', weight: 17 },
  { keyword: '액정 깨짐', category: 'KO/가족사칭', group: 'family', weight: 17 },
  { keyword: '액정 깨졌어', category: 'KO/가족사칭', group: 'family', weight: 20 },
  { keyword: '핸드폰 고장', category: 'KO/가족사칭', group: 'family', weight: 14 },
  { keyword: '급하게', category: 'KO/가족사칭', group: 'urgency', weight: 14 },
  { keyword: '급하게 송금', category: 'KO/가족사칭', group: 'urgency', weight: 20 },
];

const KO_URGENCY: KeywordDef[] = [
  { keyword: '지금 당장', category: 'KO/긴급압박', group: 'urgency', weight: 17 },
  { keyword: '당장', category: 'KO/긴급압박', group: 'urgency', weight: 11 },
  { keyword: '빨리', category: 'KO/긴급압박', group: 'urgency', weight: 8 },
  { keyword: '시간 없어', category: 'KO/긴급압박', group: 'urgency', weight: 14 },
  { keyword: '제발', category: 'KO/긴급압박', group: 'urgency', weight: 8 },
  { keyword: '큰일나', category: 'KO/긴급압박', group: 'urgency', weight: 14 },
  { keyword: '큰일 날', category: 'KO/긴급압박', group: 'urgency', weight: 14 },
  { keyword: '오늘 내로', category: 'KO/긴급압박', group: 'urgency', weight: 17 },
  { keyword: '내일까지', category: 'KO/긴급압박', group: 'urgency', weight: 11 },
  { keyword: '신고하면 안돼', category: 'KO/긴급압박', group: 'concealment', weight: 20 },
  { keyword: '신고', category: 'KO/긴급압박', group: 'concealment', weight: 6 },
  { keyword: '사고', category: 'KO/긴급압박', group: 'threat', weight: 11 },
  { keyword: '다쳐', category: 'KO/긴급압박', group: 'threat', weight: 11 },
  { keyword: '병원', category: 'KO/긴급압박', group: 'threat', weight: 8 },
  { keyword: '수술', category: 'KO/긴급압박', group: 'threat', weight: 11 },
  { keyword: '교통사고', category: 'KO/긴급압박', group: 'threat', weight: 14 },
];

// ─── English Keyword Dictionary (~100 patterns) ───────────────────

const EN_AGENCY: KeywordDef[] = [
  { keyword: 'IRS', category: 'EN/Agency', group: 'agency', weight: 22 },
  { keyword: 'Internal Revenue Service', category: 'EN/Agency', group: 'agency', weight: 22 },
  { keyword: 'FBI', category: 'EN/Agency', group: 'agency', weight: 22 },
  { keyword: 'Federal Bureau', category: 'EN/Agency', group: 'agency', weight: 20 },
  { keyword: 'Police Department', category: 'EN/Agency', group: 'agency', weight: 17 },
  { keyword: 'Police department', category: 'EN/Agency', group: 'agency', weight: 17 },
  { keyword: 'Sheriff', category: 'EN/Agency', group: 'agency', weight: 17 },
  { keyword: 'Social Security Administration', category: 'EN/Agency', group: 'agency', weight: 22 },
  { keyword: 'SSA', category: 'EN/Agency', group: 'agency', weight: 20 },
  { keyword: 'DEA', category: 'EN/Agency', group: 'agency', weight: 20 },
  { keyword: 'Homeland Security', category: 'EN/Agency', group: 'agency', weight: 20 },
  { keyword: 'Federal agent', category: 'EN/Agency', group: 'agency', weight: 20 },
  { keyword: 'Federal arrest warrant', category: 'EN/Agency', group: 'arrest', weight: 25 },
  { keyword: 'Arrest warrant', category: 'EN/Agency', group: 'arrest', weight: 22 },
  { keyword: 'Legal action', category: 'EN/Agency', group: 'arrest', weight: 17 },
  { keyword: 'Lawsuit', category: 'EN/Agency', group: 'arrest', weight: 17 },
  { keyword: 'Court summons', category: 'EN/Agency', group: 'arrest', weight: 20 },
  { keyword: 'Criminal investigation', category: 'EN/Agency', group: 'agency', weight: 20 },
  { keyword: 'Tax fraud', category: 'EN/Agency', group: 'agency', weight: 20 },
  { keyword: 'Tax evasion', category: 'EN/Agency', group: 'agency', weight: 20 },
  { keyword: 'Officer', category: 'EN/Agency', group: 'agency', weight: 11 },
  { keyword: 'Detective', category: 'EN/Agency', group: 'agency', weight: 14 },
  { keyword: 'Agent', category: 'EN/Agency', group: 'agency', weight: 11 },
  { keyword: 'Inspector', category: 'EN/Agency', group: 'agency', weight: 11 },
  { keyword: 'Identity theft', category: 'EN/Agency', group: 'personal_info', weight: 17 },
  { keyword: 'Social Security number', category: 'EN/Agency', group: 'personal_info', weight: 20 },
  { keyword: 'SSN', category: 'EN/Agency', group: 'personal_info', weight: 17 },
  { keyword: 'Suspended account', category: 'EN/Agency', group: 'agency', weight: 14 },
  { keyword: 'Frozen account', category: 'EN/Agency', group: 'account', weight: 20 },
  { keyword: 'Verification account', category: 'EN/Agency', group: 'account', weight: 22 },
  { keyword: 'Vault account', category: 'EN/Agency', group: 'account', weight: 22 },
  { keyword: 'Treasury department', category: 'EN/Agency', group: 'agency', weight: 17 },
  { keyword: 'US Treasury', category: 'EN/Agency', group: 'agency', weight: 20 },
];

const EN_FINANCIAL: KeywordDef[] = [
  { keyword: 'Wire transfer', category: 'EN/Financial', group: 'account', weight: 22 },
  { keyword: 'wire transfer', category: 'EN/Financial', group: 'account', weight: 22 },
  { keyword: 'Gift card', category: 'EN/Financial', group: 'giftcard', weight: 25 },
  { keyword: 'gift card', category: 'EN/Financial', group: 'giftcard', weight: 25 },
  { keyword: 'Apple card', category: 'EN/Financial', group: 'giftcard', weight: 22 },
  { keyword: 'Target card', category: 'EN/Financial', group: 'giftcard', weight: 22 },
  { keyword: 'Google Play card', category: 'EN/Financial', group: 'giftcard', weight: 22 },
  { keyword: 'Steam card', category: 'EN/Financial', group: 'giftcard', weight: 22 },
  { keyword: 'Amazon card', category: 'EN/Financial', group: 'giftcard', weight: 20 },
  { keyword: 'Gift card number', category: 'EN/Financial', group: 'giftcard', weight: 25 },
  { keyword: 'Crypto', category: 'EN/Financial', group: 'crypto', weight: 22 },
  { keyword: 'Bitcoin', category: 'EN/Financial', group: 'crypto', weight: 22 },
  { keyword: 'Ethereum', category: 'EN/Financial', group: 'crypto', weight: 20 },
  { keyword: 'Cryptocurrency', category: 'EN/Financial', group: 'crypto', weight: 20 },
  { keyword: 'Bitcoin ATM', category: 'EN/Financial', group: 'crypto', weight: 25 },
  { keyword: 'Verification code', category: 'EN/Financial', group: 'personal_info', weight: 20 },
  { keyword: 'Passcode', category: 'EN/Financial', group: 'personal_info', weight: 17 },
  { keyword: 'PIN code', category: 'EN/Financial', group: 'personal_info', weight: 20 },
  { keyword: 'Overdue payment', category: 'EN/Financial', group: 'money', weight: 17 },
  { keyword: 'Processing fee', category: 'EN/Financial', group: 'money', weight: 20 },
  { keyword: 'Penalty fee', category: 'EN/Financial', group: 'money', weight: 20 },
  { keyword: 'Outstanding balance', category: 'EN/Financial', group: 'money', weight: 14 },
  { keyword: 'Immediate payment', category: 'EN/Financial', group: 'money', weight: 22 },
  { keyword: 'Bank account number', category: 'EN/Financial', group: 'account', weight: 20 },
  { keyword: 'Credit card number', category: 'EN/Financial', group: 'account', weight: 20 },
  { keyword: 'Routing number', category: 'EN/Financial', group: 'account', weight: 17 },
  { keyword: 'Emergency refund', category: 'EN/Financial', group: 'money', weight: 17 },
  { keyword: 'Bail money', category: 'EN/Financial', group: 'money', weight: 22 },
  { keyword: 'Bail bond', category: 'EN/Financial', group: 'money', weight: 20 },
  { keyword: 'Settlement', category: 'EN/Financial', group: 'money', weight: 14 },
  { keyword: 'Money transfer', category: 'EN/Financial', group: 'money', weight: 17 },
  { keyword: 'Send money', category: 'EN/Financial', group: 'money', weight: 20 },
  { keyword: 'Cash withdrawal', category: 'EN/Financial', group: 'money', weight: 14 },
  { keyword: 'Western Union', category: 'EN/Financial', group: 'account', weight: 20 },
  { keyword: 'MoneyGram', category: 'EN/Financial', group: 'account', weight: 20 },
  { keyword: 'Zelle', category: 'EN/Financial', group: 'account', weight: 17 },
  { keyword: 'Venmo', category: 'EN/Financial', group: 'account', weight: 14 },
];

const EN_URGENCY: KeywordDef[] = [
  { keyword: 'Immediate arrest', category: 'EN/Coercion', group: 'arrest', weight: 22 },
  { keyword: 'Immediately', category: 'EN/Coercion', group: 'urgency', weight: 11 },
  { keyword: 'Right now', category: 'EN/Coercion', group: 'urgency', weight: 11 },
  { keyword: 'Urgent', category: 'EN/Coercion', group: 'urgency', weight: 11 },
  { keyword: 'Emergency', category: 'EN/Coercion', group: 'urgency', weight: 11 },
  { keyword: 'Within', category: 'EN/Coercion', group: 'urgency', weight: 8 },
  { keyword: 'Deadline', category: 'EN/Coercion', group: 'urgency', weight: 11 },
  { keyword: 'Do not hang up', category: 'EN/Coercion', group: 'concealment', weight: 20 },
  { keyword: 'Stay on the line', category: 'EN/Coercion', group: 'concealment', weight: 17 },
  { keyword: 'Do not contact', category: 'EN/Coercion', group: 'concealment', weight: 20 },
  { keyword: 'Do not tell', category: 'EN/Coercion', group: 'concealment', weight: 17 },
  { keyword: 'Dont tell anyone', category: 'EN/Coercion', group: 'concealment', weight: 20 },
  { keyword: 'Confidential', category: 'EN/Coercion', group: 'concealment', weight: 11 },
  { keyword: 'Under investigation', category: 'EN/Coercion', group: 'agency', weight: 17 },
  { keyword: 'Failure to comply', category: 'EN/Coercion', group: 'arrest', weight: 17 },
  { keyword: 'Legal consequences', category: 'EN/Coercion', group: 'arrest', weight: 14 },
  { keyword: 'You will be arrested', category: 'EN/Coercion', group: 'arrest', weight: 22 },
  { keyword: 'Deportation', category: 'EN/Coercion', group: 'arrest', weight: 20 },
  { keyword: 'Car accident', category: 'EN/Coercion', group: 'threat', weight: 14 },
  { keyword: 'Hospital', category: 'EN/Coercion', group: 'threat', weight: 11 },
  { keyword: 'Surgery', category: 'EN/Coercion', group: 'threat', weight: 11 },
  { keyword: 'In jail', category: 'EN/Coercion', group: 'arrest', weight: 17 },
  { keyword: 'In trouble', category: 'EN/Coercion', group: 'threat', weight: 11 },
  { keyword: 'Bail', category: 'EN/Coercion', group: 'money', weight: 17 },
  { keyword: 'Lawyer', category: 'EN/Coercion', group: 'arrest', weight: 11 },
  { keyword: 'Grandma', category: 'EN/Coercion', group: 'family', weight: 11 },
  { keyword: 'Grandpa', category: 'EN/Coercion', group: 'family', weight: 11 },
  { keyword: 'Grandson', category: 'EN/Coercion', group: 'family', weight: 11 },
  { keyword: 'Granddaughter', category: 'EN/Coercion', group: 'family', weight: 11 },
  { keyword: 'Repair fee', category: 'EN/Coercion', group: 'money', weight: 20 },
  { keyword: 'Phone screen', category: 'EN/Coercion', group: 'family', weight: 11 },
  { keyword: 'Cracked screen', category: 'EN/Coercion', group: 'family', weight: 14 },
  { keyword: 'Cracked phone', category: 'EN/Coercion', group: 'family', weight: 14 },
];

// ─── Yanbian Dialect Dictionary (연변 말투) ──────────────────────
// Only unambiguous Yanbian dialect markers that are NOT used in standard Korean.
// These are distinctly Yanbian expressions — their presence strongly suggests
// a Yanbian-accented speaker, which is a known voice phishing risk indicator.

const KO_DIALECT: KeywordDef[] = [
  // 연변 사투리 특유의 어휘 — 표준어에서는 절대 쓰지 않는 표현들 (weight >= 20 = 명백한 연변 말투)
  { keyword: '고마', category: 'KO/연변말투', group: 'dialect', weight: 22 },
  { keyword: '고마우다', category: 'KO/연변말투', group: 'dialect', weight: 25 },
  { keyword: '무쿠다', category: 'KO/연변말투', group: 'dialect', weight: 25 },
  { keyword: '어쩌면', category: 'KO/연변말투', group: 'dialect', weight: 14 },
  { keyword: '맨날', category: 'KO/연변말투', group: 'dialect', weight: 17 },
  { keyword: '쪼매', category: 'KO/연변말투', group: 'dialect', weight: 22 },
  { keyword: '쪼끔', category: 'KO/연변말투', group: 'dialect', weight: 22 },
  { keyword: '가매', category: 'KO/연변말투', group: 'dialect', weight: 20 },
  { keyword: '그람', category: 'KO/연변말투', group: 'dialect', weight: 22 },
  { keyword: '그라믄', category: 'KO/연변말투', group: 'dialect', weight: 25 },
  { keyword: '안그래', category: 'KO/연변말투', group: 'dialect', weight: 17 },
  { keyword: '무신', category: 'KO/연변말투', group: 'dialect', weight: 20 },
  { keyword: '무슨', category: 'KO/연변말투', group: 'dialect', weight: 8 },
  { keyword: '바로', category: 'KO/연변말투', group: 'dialect', weight: 6 },
  { keyword: '지금', category: 'KO/연변말투', group: 'dialect', weight: 6 },
  { keyword: '돈을 만지다', category: 'KO/연변말투', group: 'dialect', weight: 20 },
  { keyword: '돈 만지다', category: 'KO/연변말투', group: 'dialect', weight: 20 },
  { keyword: '말씀', category: 'KO/연변말투', group: 'dialect', weight: 14 },
  { keyword: '말씀드리다', category: 'KO/연변말투', group: 'dialect', weight: 17 },
  { keyword: '잘 있었겄소', category: 'KO/연변말투', group: 'dialect', weight: 25 },
  { keyword: '잘 있었소', category: 'KO/연변말투', group: 'dialect', weight: 22 },
  { keyword: '어디 가심까', category: 'KO/연변말투', group: 'dialect', weight: 25 },
  { keyword: '가심까', category: 'KO/연변말투', group: 'dialect', weight: 25 },
  { keyword: '하심까', category: 'KO/연변말투', group: 'dialect', weight: 25 },
  { keyword: '뭐라오', category: 'KO/연변말투', group: 'dialect', weight: 22 },
  { keyword: '어째서', category: 'KO/연변말투', group: 'dialect', weight: 20 },
  { keyword: '초에', category: 'KO/연변말투', group: 'dialect', weight: 22 },
  { keyword: '폁소', category: 'KO/연변말투', group: 'dialect', weight: 25 },
  { keyword: '흐다', category: 'KO/연변말투', group: 'dialect', weight: 22 },
  { keyword: '고마해라', category: 'KO/연변말투', group: 'dialect', weight: 25 },
  { keyword: '고마 하소', category: 'KO/연변말투', group: 'dialect', weight: 25 },
  { keyword: '그라이가', category: 'KO/연변말투', group: 'dialect', weight: 25 },
  { keyword: '그라이', category: 'KO/연변말투', group: 'dialect', weight: 22 },
  { keyword: '어디 가오', category: 'KO/연변말투', group: 'dialect', weight: 20 },
  { keyword: '어디 가오소', category: 'KO/연변말투', group: 'dialect', weight: 22 },
  { keyword: '예', category: 'KO/연변말투', group: 'dialect', weight: 6 },
  { keyword: '그려', category: 'KO/연변말투', group: 'dialect', weight: 20 },
  { keyword: '그랴', category: 'KO/연변말투', group: 'dialect', weight: 20 },
  { keyword: '마', category: 'KO/연변말투', group: 'dialect', weight: 6 },
  { keyword: '지라이', category: 'KO/연변말투', group: 'dialect', weight: 22 },
  { keyword: '찌라이', category: 'KO/연변말투', group: 'dialect', weight: 22 },
  // 추가 연변 사투리 표현들
  { keyword: '어제', category: 'KO/연변말투', group: 'dialect', weight: 6 },
  { keyword: '그래라', category: 'KO/연변말투', group: 'dialect', weight: 22 },
  { keyword: '그래요', category: 'KO/연변말투', group: 'dialect', weight: 14 },
  { keyword: '하야', category: 'KO/연변말투', group: 'dialect', weight: 20 },
  { keyword: '하야 한다', category: 'KO/연변말투', group: 'dialect', weight: 22 },
  { keyword: '하야 되다', category: 'KO/연변말투', group: 'dialect', weight: 22 },
  { keyword: '겄소', category: 'KO/연변말투', group: 'dialect', weight: 25 },
  { keyword: '겄다', category: 'KO/연변말투', group: 'dialect', weight: 22 },
  { keyword: '뭣하는', category: 'KO/연변말투', group: 'dialect', weight: 22 },
  { keyword: '뭣 하느', category: 'KO/연변말투', group: 'dialect', weight: 22 },
  { keyword: '어째', category: 'KO/연변말투', group: 'dialect', weight: 22 },
  { keyword: '어째서', category: 'KO/연변말투', group: 'dialect', weight: 20 },
  { keyword: '고마치', category: 'KO/연변말투', group: 'dialect', weight: 22 },
  { keyword: '그라치', category: 'KO/연변말투', group: 'dialect', weight: 22 },
  { keyword: '말구', category: 'KO/연변말투', group: 'dialect', weight: 20 },
  { keyword: '가구', category: 'KO/연변말투', group: 'dialect', weight: 20 },
  { keyword: '오니라', category: 'KO/연변말투', group: 'dialect', weight: 22 },
  { keyword: '소니라', category: 'KO/연변말투', group: 'dialect', weight: 22 },
  { keyword: '함더', category: 'KO/연변말투', group: 'dialect', weight: 22 },
  { keyword: '해라', category: 'KO/연변말투', group: 'dialect', weight: 14 },
  { keyword: '한다요', category: 'KO/연변말투', group: 'dialect', weight: 20 },
  { keyword: '배아프다', category: 'KO/연변말투', group: 'dialect', weight: 22 },
  { keyword: '먹었소', category: 'KO/연변말투', group: 'dialect', weight: 20 },
  { keyword: '있었소', category: 'KO/연변말투', group: 'dialect', weight: 20 },
  { keyword: '그랬소', category: 'KO/연변말투', group: 'dialect', weight: 20 },
  { keyword: '그랬구나', category: 'KO/연변말투', group: 'dialect', weight: 20 },
  { keyword: '어떠냐', category: 'KO/연변말투', group: 'dialect', weight: 20 },
  { keyword: '어떠소', category: 'KO/연변말투', group: 'dialect', weight: 22 },
  { keyword: '했구마', category: 'KO/연변말투', group: 'dialect', weight: 22 },
  { keyword: '했구마', category: 'KO/연변말투', group: 'dialect', weight: 22 },
  { keyword: '하구마', category: 'KO/연변말투', group: 'dialect', weight: 22 },
  { keyword: '하구먼', category: 'KO/연변말투', group: 'dialect', weight: 22 },
  { keyword: '했구먼', category: 'KO/연변말투', group: 'dialect', weight: 22 },
  { keyword: '이리오', category: 'KO/연변말투', group: 'dialect', weight: 20 },
  { keyword: '저리오', category: 'KO/연변말투', group: 'dialect', weight: 20 },
  { keyword: '어디 가오', category: 'KO/연변말투', group: 'dialect', weight: 20 },
  { keyword: '뭐라카노', category: 'KO/연변말투', group: 'dialect', weight: 25 },
  { keyword: '뭐라카', category: 'KO/연변말투', group: 'dialect', weight: 22 },
  { keyword: '그라카', category: 'KO/연변말투', group: 'dialect', weight: 22 },
  { keyword: '그라카노', category: 'KO/연변말투', group: 'dialect', weight: 25 },
  { keyword: '안카', category: 'KO/연변말투', group: 'dialect', weight: 20 },
  { keyword: '안카노', category: 'KO/연변말투', group: 'dialect', weight: 22 },
  { keyword: '하것소', category: 'KO/연변말투', group: 'dialect', weight: 25 },
  { keyword: '하것다', category: 'KO/연변말투', group: 'dialect', weight: 22 },
  { keyword: '알았소', category: 'KO/연변말투', group: 'dialect', weight: 20 },
  { keyword: '알았구마', category: 'KO/연변말투', group: 'dialect', weight: 22 },
  { keyword: '갑데', category: 'KO/연변말투', group: 'dialect', weight: 20 },
  { keyword: '갑소', category: 'KO/연변말투', group: 'dialect', weight: 20 },
  { keyword: '보소', category: 'KO/연변말투', group: 'dialect', weight: 20 },
  { keyword: '들어봅소', category: 'KO/연변말투', group: 'dialect', weight: 22 },
  { keyword: '말해봅소', category: 'KO/연변말투', group: 'dialect', weight: 22 },
];

// ─── Combined Dictionary ─────────────────────────────────────────

export const KEYWORD_DICTIONARY: KeywordDef[] = [
  ...KO_AGENCY,
  ...KO_FINANCIAL,
  ...KO_FAMILY,
  ...KO_URGENCY,
  ...KO_DIALECT,
  ...KO_LINK_APP,
  ...EN_AGENCY,
  ...EN_FINANCIAL,
  ...EN_URGENCY,
];

// ─── Regex Generalization Patterns ───────────────────────────────

export interface RegexDef {
  pattern: RegExp;
  label: string;
  category: string;
  group: KeywordGroup;
  weight: number;
}

export const REGEX_PATTERNS: RegexDef[] = [
  // [금액/숫자 — Korean]
  { pattern: /\d[\d,]*\s*만원/g, label: 'N만원', category: 'KO/금액', group: 'money', weight: 14 },
  { pattern: /\d[\d,]*\s*억\s*원/g, label: 'N억원', category: 'KO/금액', group: 'money', weight: 17 },
  { pattern: /\d[\d,]*\s*원/g, label: 'N,000원', category: 'KO/금액', group: 'money', weight: 11 },
  { pattern: /\d[\d,]*\s*달러/g, label: 'N달러', category: 'KO/금액', group: 'money', weight: 11 },
  // [금액/숫자 — English]
  { pattern: /\$\s?\d[\d,]*/g, label: '$N', category: 'EN/Amount', group: 'money', weight: 14 },
  { pattern: /\d[\d,]*\s*(?:dollars|Dollars)/g, label: 'N dollars', category: 'EN/Amount', group: 'money', weight: 11 },
  { pattern: /\d[\d,]*\s*(?:thousand|Thousand|million|Million)/g, label: 'N thousand/million', category: 'EN/Amount', group: 'money', weight: 14 },
  // [계좌/카드번호 — 10~16 digit sequences]
  { pattern: /\d{10,16}/g, label: '10~16자리 숫자 (계좌/카드)', category: '계좌/카드번호', group: 'account', weight: 20 },
  // [시간/기한 — Korean]
  { pattern: /\d+\s*시까지/g, label: 'N시까지', category: 'KO/기한', group: 'urgency', weight: 11 },
  { pattern: /오늘\s*내로/g, label: '오늘 내로', category: 'KO/기한', group: 'urgency', weight: 14 },
  { pattern: /내일까지/g, label: '내일까지', category: 'KO/기한', group: 'urgency', weight: 8 },
  { pattern: /\d+\s*분\s*내/g, label: 'N분 내', category: 'KO/기한', group: 'urgency', weight: 14 },
  { pattern: /\d+\s*시간\s*(?:내|안)/g, label: 'N시간 내/안', category: 'KO/기한', group: 'urgency', weight: 14 },
  // [시간/기한 — English]
  { pattern: /within\s+\d+\s*(?:minutes|hours|days)/gi, label: 'within N minutes/hours', category: 'EN/Deadline', group: 'urgency', weight: 14 },
  { pattern: /in\s+\d+\s*(?:minutes|hours|days)/gi, label: 'in N minutes/hours', category: 'EN/Deadline', group: 'urgency', weight: 11 },
  { pattern: /by\s+(?:today|tomorrow|midnight)/gi, label: 'by today/tomorrow', category: 'EN/Deadline', group: 'urgency', weight: 11 },
  // [이름/직책 — Korean]
  { pattern: /[가-힣]{2,4}\s*검사/g, label: 'OOO 검사', category: 'KO/수사기관', group: 'agency', weight: 20 },
  { pattern: /[가-힣]{2,4}\s*수사관/g, label: 'OOO 수사관', category: 'KO/수사기관', group: 'agency', weight: 20 },
  { pattern: /[가-힣]{2,4}\s*경위/g, label: 'OOO 경위', category: 'KO/수사기관', group: 'agency', weight: 17 },
  { pattern: /[가-힣]{2,4}\s*경장/g, label: 'OOO 경장', category: 'KO/수사기관', group: 'agency', weight: 17 },
  // [이름/직책 — English]
  { pattern: /(?:Agent|Officer|Detective|Inspector)\s+[A-Z][a-z]+/g, label: 'Agent/Officer OOO', category: 'EN/Agency', group: 'agency', weight: 17 },
  { pattern: /[A-Z][a-z]+\s+(?:Miller|Smith|Johnson|Williams|Brown|Jones|Garcia|Rodriguez|Wilson|Lee|Davis|Clark)/g, label: 'Full name (official)', category: 'EN/Agency', group: 'agency', weight: 11 },
  // [링크/URL — http/https, bit.ly, short URLs]
  { pattern: /https?:\/\/[^\s]+/gi, label: 'URL 링크', category: 'KO/링크앱유도', group: 'tech', weight: 22 },
  { pattern: /bit\.ly\/[^\s]+/gi, label: '단축 URL (bit.ly)', category: 'KO/링크앱유도', group: 'tech', weight: 25 },
  { pattern: /me2\.kr\/[^\s]+/gi, label: '단축 URL (me2.kr)', category: 'KO/링크앱유도', group: 'tech', weight: 25 },
  { pattern: /\b(?:click|tap|open)\s+(?:the\s+)?link\b/gi, label: 'click/tap/open link', category: 'EN/LinkApp', group: 'tech', weight: 22 },
  { pattern: /\binstall\s+(?:the\s+)?app\b/gi, label: 'install app', category: 'EN/LinkApp', group: 'tech', weight: 25 },
  { pattern: /\bdownload\s+(?:the\s+)?app\b/gi, label: 'download app', category: 'EN/LinkApp', group: 'tech', weight: 22 },
];
