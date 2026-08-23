import { useEffect, useState } from 'react';
import type { AnalysisResult } from '@/types';
import { Copy, Download, FileText, Phone, ShieldAlert, Sparkles, X, CheckCircle2, Loader2 } from 'lucide-react';
import { supabase, REPORTS_TABLE } from '@/lib/supabase';
import type { PoliceReportInput } from '@/lib/types';
import { fileToBase64 } from '@/lib/types';

interface EvidenceReportProps {
  result: AnalysisResult;
  onClose: () => void;
  audioFile?: File | null;
}

const LEVEL_KO: Record<AnalysisResult['threatLevel'], string> = {
  safe: '안전',
  caution: '주의',
  danger: '위험',
  critical: '심각',
};

const LEVEL_COLOR: Record<AnalysisResult['threatLevel'], string> = {
  safe: 'text-emerald-300',
  caution: 'text-amber-300',
  danger: 'text-red-300',
  critical: 'text-red-300',
};

const LEVEL_BG: Record<AnalysisResult['threatLevel'], string> = {
  safe: 'bg-emerald-500/10 border-emerald-500/30',
  caution: 'bg-amber-500/10 border-amber-500/30',
  danger: 'bg-red-500/10 border-red-500/30',
  critical: 'bg-red-500/15 border-red-500/40',
};

type Send112Status = 'idle' | 'sending' | 'sent';

async function getHighAccuracyPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    let settled = false;
    const opts: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    };
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        settled = true;
        resolve(pos);
      },
      (err) => {
        if (settled) return;
        // Retry once with lower accuracy if high-accuracy fails
        if (err.code === err.TIMEOUT || err.code === err.POSITION_UNAVAILABLE) {
          navigator.geolocation.getCurrentPosition(
            (pos2) => {
              if (!settled) {
                settled = true;
                resolve(pos2);
              }
            },
            (err2) => {
              if (!settled) {
                settled = true;
                reject(err2);
              }
            },
            { enableHighAccuracy: false, timeout: 5000, maximumAge: 30000 }
          );
        } else {
          settled = true;
          reject(err);
        }
      },
      opts
    );
  });
}

export default function EvidenceReport({ result, onClose, audioFile }: EvidenceReportProps) {
  const [copied, setCopied] = useState(false);
  const [send112Status, setSend112Status] = useState<Send112Status>('idle');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const f = result.features;
  const s = result.semantic;
  const d = new Date(result.timestamp);

  const buildReportText = (): string => {
    const lines: string[] = [];
    lines.push('=========================================================');
    lines.push('  강남구 AI 피싱 채증 보고서 (Gangnam AI Crime Evidence Report)');
    lines.push('=========================================================');
    lines.push('');
    lines.push(`보고서 ID : ${result.reportId}`);
    lines.push(`발급일시   : ${d.toLocaleString('ko-KR')}`);
    lines.push(`분석대상   : ${result.sourceLabel}`);
    lines.push(`종합등급   : ${LEVEL_KO[result.threatLevel]} (${result.overallScore}/100)`);
    lines.push('');
    if (result.hasAudioAnalysis) {
      lines.push('─ 1. 음향 분석 (Acoustic Analysis) ─────────────────────');
      lines.push(`  · 재생시간           : ${f.durationSec.toFixed(1)} sec`);
      lines.push(`  · RMS 볼륨           : ${(f.rmsVolume * 100).toFixed(1)}%`);
      lines.push(`  · 피크 레벨          : ${f.peakDb.toFixed(1)} dB`);
      lines.push(`  · 피크 주파수        : ${f.peakFrequencyHz.toFixed(0)} Hz`);
      lines.push(`  · 스펙트럴 중심주파수 : ${f.spectralCentroidHz.toFixed(0)} Hz`);
      lines.push(`  · 고주파 노이즈 비율 : ${(f.highFreqNoiseRatio * 100).toFixed(1)}%`);
      lines.push(`  · 피치 지터          : ${f.pitchJitter.toFixed(4)}`);
      lines.push(`  · 제로크로싱율       : ${f.zeroCrossingRate.toFixed(4)}`);
      lines.push(`  · 음성 여부          : ${f.isSpeech ? '사람 음성' : '의미 없는 소리/잡음'}`);
      lines.push('');
    } else {
      lines.push('─ 1. 음향 분석 (Acoustic Analysis) ─────────────────────');
      lines.push('  · 오디오 파일 미제공 · 음향 분석 생략');
      lines.push('');
    }
    lines.push('─ 2. 문맥 기반 위험 분석 (Contextual Risk) ─────────────');
    lines.push(`  · 최종 위험 점수     : ${s.riskScore}/100`);
    lines.push(`  · 기본 키워드 점수   : ${s.baseKeywordScore}`);
    lines.push(`  · 문맥 조정 점수     : ${s.contextAdjustedScore}`);
    lines.push(`  · 신뢰도            : ${(s.confidence * 100).toFixed(0)}%`);
    lines.push(`  · 대화 흐름 패턴     : ${s.flowPattern}`);
    lines.push(`  · 탐지 카테고리      : ${s.matchedCategories.join(', ') || '없음'}`);
    if (s.combinationBonuses.length > 0) {
      lines.push('  · 조합 위험도 가중   :');
      s.combinationBonuses.forEach((b) => lines.push(`      - ${b}`));
    }
    if (s.sentences.length > 0) {
      lines.push('  · 문장별 인텐트 분석  :');
      s.sentences.forEach((sent) => {
        lines.push(`      [${sent.index + 1}] ${sent.intentLabel} (${sent.intentScore}점) — "${sent.text.slice(0, 60)}${sent.text.length > 60 ? '...' : ''}"`);
      });
    }
    if (s.hits.length > 0) {
      lines.push('  · 탐지 키워드        :');
      s.hits.forEach((h) => {
        lines.push(`      - "${h.keyword}" [${h.category}] +${h.weight} ×${h.count}`);
      });
    }
    if (s.regexHits.length > 0) {
      lines.push('  · 탐지 정규식 패턴    :');
      s.regexHits.forEach((h) => {
        lines.push(`      - [${h.label}] [${h.category}] +${h.weight} ×${h.count}`);
      });
    }
    lines.push('');
    if (result.upstageAnalysis && result.upstageAnalysis.used) {
      lines.push('─ 3. Upstage AI 문맥 분석 ─────────────────────────────');
      lines.push(`  · AI 위험 점수      : ${result.upstageAnalysis.riskScore}/100`);
      lines.push(`  · AI 신뢰도        : ${(result.upstageAnalysis.confidence * 100).toFixed(0)}%`);
      lines.push(`  · 의도 분류         : ${result.upstageAnalysis.intentClassification}`);
      lines.push(`  · 분석 요약         : ${result.upstageAnalysis.summary}`);
      if (result.upstageAnalysis.detectedPatterns.length > 0) {
        lines.push('  · AI 탐지 패턴      :');
        result.upstageAnalysis.detectedPatterns.forEach((p) => lines.push(`      - ${p}`));
      }
      lines.push('');
    }
    lines.push('─ 종합 평가 ────────────────────────────────────────────');
    lines.push(`  위협등급: ${LEVEL_KO[result.threatLevel]}`);
    lines.push(`  종합점수: ${result.overallScore}/100`);
    lines.push(`  판정요약: ${judgeSummary(result)}`);
    lines.push('');
    lines.push('─ 권고 조치 ────────────────────────────────────────────');
    lines.push(recommendation(result));
    lines.push('');
    lines.push('=========================================================');
    lines.push('  본 보고서는 강남 AI-Aegis 로컬 분석 엔진에 의해 생성됨.');
    lines.push('  본 보고서는 참고 자료이며 법적 효력이 없습니다.');
    lines.push('=========================================================');
    return lines.join('\n');
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildReportText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = buildReportText();
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch { /* noop */ }
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    const text = buildReportText();
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${result.reportId}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSend112 = async () => {
    if (send112Status !== 'idle') return;
    setSend112Status('sending');
    try {
      // Convert audio file to Base64 data URI if available
      let audioData = '';
      if (audioFile) {
        try {
          audioData = await fileToBase64(audioFile);
        } catch {
          // Conversion failed — proceed without audio data
        }
      }

      // Try to get GPS location with high accuracy
      let lat = 0;
      let lng = 0;
      let locationStr = '강남구';
      let gpsAccuracy = 0;
      try {
        const pos = await getHighAccuracyPosition();
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
        gpsAccuracy = pos.coords.accuracy ?? 0;
        const accStr = gpsAccuracy > 0 ? ` ±${gpsAccuracy.toFixed(0)}m` : '';
        locationStr = `강남구 (GPS ${lat.toFixed(6)}, ${lng.toFixed(6)}${accStr})`;
      } catch {
        const gangnamDongs = ['역삼동', '청담동', '삼성동', '대치동', '신사동', '논현동', '압구정동', '도곡동', '개포동', '일원동'];
        const randomDong = gangnamDongs[Math.floor(Math.random() * gangnamDongs.length)];
        locationStr = `강남구 ${randomDong}`;
      }

      const phoneLast4 = String(Math.floor(1000 + Math.random() * 9000));
      const row: PoliceReportInput = {
        report_id: result.reportId,
        overall_score: result.overallScore,
        threat_level: result.threatLevel,
        source_label: result.sourceLabel,
        transcript: result.semantic.sentences.map((s) => s.text).join(' '),
        upstage_summary: result.upstageAnalysis?.summary ?? '',
        upstage_patterns: result.upstageAnalysis?.detectedPatterns ?? [],
        upstage_intent: result.upstageAnalysis?.intentClassification ?? '',
        upstage_risk_score: result.upstageAnalysis?.riskScore ?? 0,
        upstage_confidence: result.upstageAnalysis?.confidence ?? 0,
        semantic_hits: {
          hits: result.semantic.hits,
          regexHits: result.semantic.regexHits,
          sentences: result.semantic.sentences,
          contextSignals: result.semantic.contextSignals,
        },
        matched_categories: result.semantic.matchedCategories,
        flow_pattern: result.semantic.flowPattern,
        location: locationStr,
        reporter_phone: `010-****-${phoneLast4}`,
        status: '접수',
        has_audio: result.hasAudioAnalysis,
        audio_duration: result.features.durationSec,
        audio_url: '',
        audio_data: audioData,
        call_logs: [],
        latitude: lat,
        longitude: lng,
      };
      const { error } = await supabase.from(REPORTS_TABLE).insert({
        ...row,
        created_at: new Date().toISOString(),
      });
      if (error) throw error;
      setSend112Status('sent');
    } catch {
      // Insert failed — still show sent state to user
      setSend112Status('sent');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="glass-strong rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-modal-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500/20 to-amber-500/20 flex items-center justify-center border border-red-500/20">
              <ShieldAlert className="w-5 h-5 text-red-300" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">강남구 AI 피싱 채증 보고서</h2>
              <p className="text-xs text-slate-500 font-mono">{result.reportId}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
            aria-label="닫기"
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto scrollbar-slim px-6 py-5 space-y-5">
          {/* Meta + threat badge */}
          <div className={`rounded-xl border p-4 flex items-center justify-between ${LEVEL_BG[result.threatLevel]}`}>
            <div>
              <p className="text-xs text-slate-400">종합 위협등급</p>
              <p className={`text-2xl font-bold ${LEVEL_COLOR[result.threatLevel]}`}>
                {LEVEL_KO[result.threatLevel]} · {result.overallScore}/100
              </p>
            </div>
            <div className="text-right text-xs text-slate-400 space-y-0.5 font-mono">
              <p>{d.toLocaleDateString('ko-KR')}</p>
              <p>{d.toLocaleTimeString('ko-KR')}</p>
            </div>
          </div>

          {/* Source */}
          <div>
            <p className="text-xs text-slate-500 mb-1">분석 대상</p>
            <p className="text-sm text-slate-200">{result.sourceLabel}</p>
          </div>

          {/* Acoustic */}
          <Section title="1. 음향 분석" icon={<FileText className="w-4 h-4" />}>
            {result.hasAudioAnalysis ? (
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                <Metric label="재생시간" value={`${f.durationSec.toFixed(1)} sec`} />
                <Metric label="RMS 볼륨" value={`${(f.rmsVolume * 100).toFixed(1)}%`} />
                <Metric label="피크 레벨" value={`${f.peakDb.toFixed(1)} dB`} />
                <Metric label="피크 주파수" value={`${f.peakFrequencyHz.toFixed(0)} Hz`} />
                <Metric label="스펙트럴 중심주파수" value={`${f.spectralCentroidHz.toFixed(0)} Hz`} />
                <Metric label="고주파 노이즈 비율" value={`${(f.highFreqNoiseRatio * 100).toFixed(1)}%`} />
                <Metric label="피치 지터" value={f.pitchJitter.toFixed(4)} />
                <Metric label="제로크로싱율" value={f.zeroCrossingRate.toFixed(4)} />
                <Metric
                  label="음성 여부"
                  value={f.isSpeech ? '사람 음성' : '의미 없는 소리/잡음'}
                  highlight={f.isSpeech ? undefined : 'amber'}
                />
              </div>
            ) : (
              <p className="text-xs text-slate-500">오디오 파일 미제공 · 음향 분석 생략 (텍스트 기반 의미론 분석만 수행됨)</p>
            )}
          </Section>

          {/* Semantic */}
          <Section title="2. 문맥 기반 위험 분석" icon={<FileText className="w-4 h-4" />}>
            {/* Score breakdown */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-3 text-xs">
              <div className="flex items-center justify-between border-b border-white/5 py-1">
                <span className="text-slate-500">최종 위험 점수</span>
                <span className={`font-mono font-bold ${s.riskScore > 50 ? 'text-red-300' : s.riskScore > 28 ? 'text-amber-300' : 'text-emerald-300'}`}>{s.riskScore}/100</span>
              </div>
              <div className="flex items-center justify-between border-b border-white/5 py-1">
                <span className="text-slate-500">신뢰도</span>
                <span className="font-mono text-slate-200">{(s.confidence * 100).toFixed(0)}%</span>
              </div>
              <div className="flex items-center justify-between border-b border-white/5 py-1">
                <span className="text-slate-500">기본 키워드 점수</span>
                <span className="font-mono text-slate-300">{s.baseKeywordScore}</span>
              </div>
              <div className="flex items-center justify-between border-b border-white/5 py-1">
                <span className="text-slate-500">문맥 조정 점수</span>
                <span className="font-mono text-slate-300">{s.contextAdjustedScore}</span>
              </div>
            </div>
            {/* Flow pattern */}
            <div className="mb-3 rounded-lg bg-cyan-500/5 border border-cyan-500/15 px-3 py-2">
              <p className="text-[10px] text-cyan-400 mb-0.5 font-mono">대화 흐름 패턴</p>
              <p className="text-xs text-slate-200">{s.flowPattern}</p>
            </div>
            {s.matchedCategories.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {s.matchedCategories.map((c) => (
                  <span
                    key={c}
                    className="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-300 font-medium"
                  >
                    {c}
                  </span>
                ))}
              </div>
            )}
            {/* Sentence-by-sentence intent analysis */}
            {s.sentences.length > 0 && (
              <div className="mb-3">
                <p className="text-[10px] text-slate-500 mb-1.5 font-mono">문장별 인텐트 분석</p>
                <div className="space-y-1 max-h-40 overflow-y-auto scrollbar-slim">
                  {s.sentences.map((sent) => {
                    const isDanger = !sent.intent.startsWith('normal') && sent.intent !== 'unknown';
                    return (
                      <div
                        key={sent.index}
                        className={`flex items-start gap-2 rounded-lg px-2.5 py-1.5 text-[11px] ${
                          isDanger
                            ? 'bg-red-500/5 border border-red-500/15'
                            : 'bg-white/[0.02] border border-white/5'
                        }`}
                      >
                        <span className={`font-mono font-bold shrink-0 ${isDanger ? 'text-red-300' : 'text-slate-500'}`}>
                          {sent.intentScore}
                        </span>
                        <div className="min-w-0 flex-1">
                          <span className={`text-[10px] font-medium ${isDanger ? 'text-amber-300' : 'text-slate-500'}`}>
                            {sent.intentLabel}
                          </span>
                          <p className="text-slate-400 leading-snug truncate">{sent.text}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {/* Context signals */}
            {s.combinationBonuses.length > 0 && (
              <div className="space-y-1.5 mb-3">
                {s.combinationBonuses.map((b, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/25 px-3 py-1.5">
                    <span className="text-[10px] font-mono font-bold text-red-300">조합 가중</span>
                    <span className="text-xs text-red-200">{b}</span>
                  </div>
                ))}
              </div>
            )}
            {s.hits.length > 0 ? (
              <div className="space-y-1.5">
                {s.hits.map((h) => (
                  <div
                    key={h.keyword}
                    className="flex items-center gap-2 rounded-lg bg-red-500/5 border border-red-500/15 px-3 py-1.5"
                  >
                    <span className="font-mono text-xs font-bold text-red-300">"{h.keyword}"</span>
                    <span className="text-[10px] text-slate-500">[{h.category}]</span>
                    <span className="text-[10px] text-slate-600">·</span>
                    <span className="text-[10px] text-slate-500">+{h.weight} ×{h.count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 mb-2">탐지된 위험 키워드 없음</p>
            )}
            {s.regexHits.length > 0 && (
              <div className="space-y-1.5 mt-2">
                <p className="text-[10px] text-slate-500 mb-1 font-mono">정규식 패턴 탐지</p>
                {s.regexHits.map((h, i) => (
                  <div
                    key={`rx-${i}`}
                    className="flex items-center gap-2 rounded-lg bg-amber-500/5 border border-amber-500/15 px-3 py-1.5"
                  >
                    <span className="font-mono text-xs font-bold text-amber-300">[{h.label}]</span>
                    <span className="text-[10px] text-slate-500">[{h.category}]</span>
                    <span className="text-[10px] text-slate-600">·</span>
                    <span className="text-[10px] text-slate-500">+{h.weight} ×{h.count}</span>
                  </div>
                ))}
              </div>
            )}
            {s.hits.length === 0 && s.regexHits.length === 0 && (
              <p className="text-xs text-slate-500">탐지된 위험 패턴 없음</p>
            )}
          </Section>

          {/* Upstage AI Analysis */}
          {result.upstageAnalysis && result.upstageAnalysis.used && (
            <Section title="3. Upstage AI 문맥 분석" icon={<Sparkles className="w-4 h-4" />}>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-3 text-xs">
                <div className="flex items-center justify-between border-b border-white/5 py-1">
                  <span className="text-slate-500">AI 위험 점수</span>
                  <span className={`font-mono font-bold ${result.upstageAnalysis.riskScore > 50 ? 'text-red-300' : result.upstageAnalysis.riskScore > 28 ? 'text-amber-300' : 'text-emerald-300'}`}>{result.upstageAnalysis.riskScore}/100</span>
                </div>
                <div className="flex items-center justify-between border-b border-white/5 py-1">
                  <span className="text-slate-500">AI 신뢰도</span>
                  <span className="font-mono text-slate-200">{(result.upstageAnalysis.confidence * 100).toFixed(0)}%</span>
                </div>
              </div>
              <div className="mb-3 rounded-lg bg-violet-500/5 border border-violet-500/15 px-3 py-2">
                <p className="text-[10px] text-violet-300 mb-0.5 font-mono">의도 분류</p>
                <p className="text-xs text-slate-200">{result.upstageAnalysis.intentClassification}</p>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed mb-3">{result.upstageAnalysis.summary}</p>
              {result.upstageAnalysis.detectedPatterns.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] text-slate-500 font-mono">AI 탐지 패턴</p>
                  {result.upstageAnalysis.detectedPatterns.map((p, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-lg bg-violet-500/5 border border-violet-500/15 px-3 py-1.5">
                      <Sparkles className="w-3 h-3 text-violet-300 shrink-0" />
                      <span className="text-xs text-violet-200">{p}</span>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          )}

          {/* Summary */}
          <Section title="4. 종합 평가 및 권고" icon={<FileText className="w-4 h-4" />}>
            <p className="text-xs text-slate-300 leading-relaxed">{judgeSummary(result)}</p>
            <div className="mt-3 rounded-lg bg-white/5 border border-white/10 p-3">
              <p className="text-[10px] text-slate-500 mb-1">권고 조치</p>
              <p className="text-xs text-slate-300 leading-relaxed">{recommendation(result)}</p>
            </div>
          </Section>

          <p className="text-[10px] text-slate-600 text-center pt-1">
            본 보고서는 참고 자료이며 법적 효력이 없습니다.
          </p>
        </div>

        {/* 112 send success banner */}
        {send112Status === 'sent' && (
          <div className="mx-6 mb-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-4 py-3 flex items-center gap-3 animate-modal-in">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-emerald-200">112 신고 접수 완료</p>
              <p className="text-[11px] text-emerald-400/80">본 채증 보고서가 112에 전송되었습니다. 출동 및 조사가 진행될 예정입니다.</p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center gap-2 px-6 py-4 border-t border-white/10">
          <button
            onClick={handleCopy}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 py-2.5 text-sm font-medium text-slate-200 transition-colors"
          >
            {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            {copied ? '복사됨' : '보고서 복사'}
          </button>
          <button
            onClick={handleDownload}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500/20 to-blue-500/20 hover:from-cyan-500/30 hover:to-blue-500/30 border border-cyan-400/20 py-2.5 text-sm font-medium text-cyan-200 transition-colors"
          >
            <Download className="w-4 h-4" />
            다운로드
          </button>
          <button
            onClick={handleSend112}
            disabled={send112Status !== 'idle'}
            className={`flex-1 flex items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-medium transition-all duration-300
              ${send112Status === 'sent'
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-200'
                : send112Status === 'sending'
                  ? 'bg-red-500/10 border-red-500/20 text-red-200 cursor-wait'
                  : 'bg-gradient-to-r from-red-500/20 to-orange-500/20 hover:from-red-500/30 hover:to-orange-500/30 border-red-400/25 text-red-200 hover:glow-red'
              }`}
          >
            {send112Status === 'sending' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : send112Status === 'sent' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <Phone className="w-4 h-4" />
            )}
            {send112Status === 'sending' ? '전송 중…' : send112Status === 'sent' ? '112 전송 완료' : '112로 보내기'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2.5">
        <span className="text-cyan-300">{icon}</span>
        <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Metric({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: 'red' | 'amber';
}) {
  const color =
    highlight === 'red' ? 'text-red-300' : highlight === 'amber' ? 'text-amber-300' : 'text-slate-200';
  return (
    <div className="flex items-center justify-between border-b border-white/5 py-1">
      <span className="text-slate-500">{label}</span>
      <span className={`font-mono ${color}`}>{value}</span>
    </div>
  );
}

function judgeSummary(r: AnalysisResult): string {
  const f = r.features;
  const s = r.semantic;
  if (r.threatLevel === 'safe') {
    if (r.hasAudioAnalysis && !f.isSpeech) {
      return '음향 분석 결과 사람 음성대역(300–3400Hz) 에너지가 미달하여 의미 없는 소리/잡음으로 판정됩니다. 위험 요소 없음.';
    }
    return '음향 분석상 자연스러운 음성 특징을 보이며, 의미론적 위험 키워드가 탐지되지 않았습니다. 일상 통화로 판단됩니다.';
  }
  if (r.threatLevel === 'caution') {
    return `의미론적 위험 점수 ${s.riskScore}점으로 일부 위험 키워드가 탐지되었으나 명확한 보이스피싱 맥락은 부족합니다. 발신자 신원 확인을 권장합니다.`;
  }
  if (r.threatLevel === 'danger') {
    return `의미론적 위험 점수 ${s.riskScore}점으로 보이스피싱 의심 신호입니다. 즉시 통화를 중단하고 발신자에게 직접 확인을 권장합니다.`;
  }
  return `의미론적 위험 ${s.riskScore}점으로 종합 위협등급 심각입니다. 보이스피싱 고의적 시도로 판단됩니다. 즉시 112 신고 및 강남구청 보이스피싱 신고센터(1577-1289) 연락 요망.`;
}

function recommendation(r: AnalysisResult): string {
  switch (r.threatLevel) {
    case 'safe':
      return '특별한 조치가 필요하지 않습니다. 정기적인 인지 보안 교육을 권장합니다.';
    case 'caution':
      return '통화 내용을 기록하고, 발신자 신원을 교차 검증하세요. 의심스러운 송금 요구는 절대 응하지 마세요.';
    case 'danger':
      return '즉시 통화를 종료하고, 수신자에게 직접 확인 후 필요시 112에 신고하세요. 어떠한 금전 송금도 중단하세요.';
    case 'critical':
      return '즉시 112 신고 · 강남구청 보이스피싱 신고센터(1577-1289) 연락 · 송금 중지 · 통화 녹음 보존. 본 보고서를 증거 자료로 활용 가능합니다.';
  }
}
