export type ThreatLevel = 'safe' | 'caution' | 'danger' | 'critical';
export type ReportStatus = '접수' | '출동 중' | '통화 중' | '완료';

export interface PoliceReportRow {
  id: string;
  report_id: string;
  created_at: string;
  overall_score: number;
  threat_level: ThreatLevel;
  source_label: string;
  transcript: string;
  upstage_summary: string;
  upstage_patterns: string[];
  upstage_intent: string;
  upstage_risk_score: number;
  upstage_confidence: number;
  semantic_hits: Record<string, unknown>;
  matched_categories: string[];
  flow_pattern: string;
  location: string;
  reporter_phone: string;
  status: ReportStatus;
  has_audio: boolean;
  audio_duration: number;
  audio_url: string;
  audio_data: string;
  call_logs: CallLog[];
  latitude: number;
  longitude: number;
}

export interface CallLog {
  started_at: string;
  ended_at: string;
  duration_sec: number;
}

export type PoliceReportInput = Omit<PoliceReportRow, 'id' | 'created_at'> & {
  created_at?: string;
};

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
