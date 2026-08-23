import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  BarChart3,
  Car,
  CarFront,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Headphones,
  MapPin,
  Pause,
  Phone,
  PhoneCall,
  PhoneOff,
  Play,
  RadioTower,
  Shield,
  ShieldAlert,
  Siren,
  Sparkles,
  Trash2,
  Volume2,
} from 'lucide-react';
import { supabase, REPORTS_TABLE } from '@/lib/supabase';
import type { PoliceReportRow, CallLog } from '@/lib/types';
import { LEVEL_META, STATUS_META, formatClock, formatTime, type ReportStatus } from './types';
import AlertBar from './AlertBar';
import ReportList from './ReportList';
import GangnamMap from './GangnamMap';
import CallDialog from './CallDialog';
import ErrorBoundary from './ErrorBoundary';
import OverviewDashboard from './OverviewDashboard';

export default function PoliceDashboard() {
  const [reports, setReports] = useState<PoliceReportRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'critical' | 'danger' | 'caution'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [alertReport, setAlertReport] = useState<PoliceReportRow | null>(null);
  const [dispatched, setDispatched] = useState(false);
  const [showCallDialog, setShowCallDialog] = useState(false);
  const [callConnected, setCallConnected] = useState(false);
  const [callStartTime, setCallStartTime] = useState<number | null>(null);
  const [callElapsed, setCallElapsed] = useState(0);
  const [callEnded, setCallEnded] = useState(false);
  const callStartTimeRef = useRef<number | null>(null);
  const [clock, setClock] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [selectedStationId, setSelectedStationId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'individual' | 'overview'>('individual');
  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = selectedId;
  const reportsRef = useRef<PoliceReportRow[]>([]);
  reportsRef.current = reports;
  const knownReportIdsRef = useRef<Set<string>>(new Set());

  // Realtime subscription via Supabase (initial load + live INSERT/UPDATE/DELETE)
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const loadAndSubscribe = async () => {
      // Initial load
      const { data, error } = await supabase
        .from(REPORTS_TABLE)
        .select('*')
      if (error) {
        setLoading(false);
        return;
      }
      const rows = (data ?? []).map((row) => mapDbRow(row));
      rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setReports(rows);
      setLoading(false);
      rows.forEach((r) => knownReportIdsRef.current.add(r.id));

      // Realtime subscription
      channel = supabase
        .channel('police_reports_changes')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: REPORTS_TABLE }, (payload) => {
          const newRow = mapDbRow(payload.new);
          setReports((prev) => {
            if (prev.some((r) => r.id === newRow.id)) return prev;
            const next = [newRow, ...prev];
            next.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            return next;
          });
          // Alert only for genuinely new reports
          if (!knownReportIdsRef.current.has(newRow.id)) {
            knownReportIdsRef.current.add(newRow.id);
            if (newRow.threat_level === 'critical' || newRow.threat_level === 'danger') {
              setAlertReport(newRow);
            }
          }
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: REPORTS_TABLE }, (payload) => {
          const updatedRow = mapDbRow(payload.new);
          setReports((prev) =>
            prev.map((r) => (r.id === updatedRow.id ? updatedRow : r))
          );
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: REPORTS_TABLE }, (payload) => {
          const deletedId = payload.old?.id as string | undefined;
          if (!deletedId) return;
          setReports((prev) => prev.filter((r) => r.id !== deletedId));
          knownReportIdsRef.current.delete(deletedId);
        })
        .subscribe();
    };

    void loadAndSubscribe();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  // Clock
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Call elapsed timer
  useEffect(() => {
    if (!callConnected || !callStartTime) return;
    const t = setInterval(() => {
      setCallElapsed(Math.floor((Date.now() - callStartTime) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [callConnected, callStartTime]);

  const selected = reports.find((r) => r.id === selectedId) ?? null;

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
    setDispatched(false);
    setCallConnected(false);
    setCallStartTime(null);
    setCallElapsed(0);
    setCallEnded(false);
    callStartTimeRef.current = null;
    setSelectedStationId('');
  }, []);

  // Stable dispatch handler — uses ref to avoid dependency on `selected`
  const handleDispatch = useCallback(async () => {
    const id = selectedIdRef.current;
    if (!id) return;
    setDispatched(true);
    setToast('🚨 출동 지시 완료 — 순찰차 이동을 시작했습니다');
    setTimeout(() => setToast(null), 4000);
    try {
      const { error } = await supabase.from(REPORTS_TABLE).update({ status: '출동 중' }).eq('id', id);
      if (error) throw error;
    } catch {
      // Status update failed — UI still shows dispatched state
    }
  }, []);

  const handleCall = useCallback(() => {
    setShowCallDialog(true);
    setCallEnded(false);
  }, []);

  // Stable call-connected handler — uses ref
  const handleCallConnected = useCallback(async () => {
    setCallConnected(true);
    const now = Date.now();
    setCallStartTime(now);
    callStartTimeRef.current = now;
    setCallEnded(false);
    const id = selectedIdRef.current;
    if (id) {
      try {
        const { error } = await supabase.from(REPORTS_TABLE).update({ status: '통화 중' }).eq('id', id);
        if (error) throw error;
      } catch {
        // Status update failed
      }
    }
  }, []);

  // Stable call-end handler — uses ref
  const handleCallEnd = useCallback(async () => {
    const id = selectedIdRef.current;
    const start = callStartTimeRef.current;
    const end = Date.now();
    const durationSec = start ? Math.round((end - start) / 1000) : 0;
    setCallConnected(false);
    setCallStartTime(null);
    callStartTimeRef.current = null;
    setCallElapsed(0);
    setCallEnded(true);
    setToast('통화가 종료되었습니다');
    setTimeout(() => setToast(null), 3000);
    if (id) {
      try {
        const report = reportsRef.current.find((r) => r.id === id);
        const existingLogs = report?.call_logs ?? [];
        const newLog: CallLog = {
          started_at: start ? new Date(start).toISOString() : new Date().toISOString(),
          ended_at: new Date(end).toISOString(),
          duration_sec: durationSec,
        };
        const { error } = await supabase.from(REPORTS_TABLE)
          .update({ status: '완료', call_logs: [...existingLogs, newLog] })
          .eq('id', id);
        if (error) throw error;
      } catch {
        // Status update failed
      }
    }
  }, []);

  const handleDeleteReport = useCallback(async (id: string) => {
    setReports((prev) => prev.filter((r) => r.id !== id));
    if (selectedIdRef.current === id) {
      setSelectedId(null);
      setDispatched(false);
      setCallConnected(false);
      setCallStartTime(null);
      setCallElapsed(0);
      setCallEnded(false);
      callStartTimeRef.current = null;
      setSelectedStationId('');
    }
    setToast('신고 1건이 삭제되었습니다');
    setTimeout(() => setToast(null), 3000);
    try {
      const { error } = await supabase.from(REPORTS_TABLE).delete().eq('id', id);
      if (error) throw error;
    } catch {
      // Delete failed — already removed from local state
    }
  }, []);

  const handleDeleteAll = useCallback(async () => {
    if (reports.length === 0) return;
    const count = reports.length;
    setReports([]);
    setSelectedId(null);
    setDispatched(false);
    setCallConnected(false);
    setCallStartTime(null);
    setCallElapsed(0);
    setCallEnded(false);
    callStartTimeRef.current = null;
    setSelectedStationId('');
    setToast(`신고 ${count}건 전체 삭제 완료`);
    setTimeout(() => setToast(null), 3000);
    try {
      const { error } = await supabase.from(REPORTS_TABLE).delete().in('id', reports.map((r) => r.id));
      if (error) throw error;
    } catch {
      // Delete failed — already cleared local state
    }
  }, [reports]);

  const handleDownloadPdf = useCallback(() => {
    if (!selected) return;
    const text = buildPdfReport(selected);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `police_report_${selected.report_id}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [selected]);

  const stats = useMemo(() => {
    const total = reports.length;
    const critical = reports.filter((r) => r.threat_level === 'critical').length;
    const danger = reports.filter((r) => r.threat_level === 'danger').length;
    const dispatchedCount = reports.filter((r) => r.status === '출동 중').length;
    return { total, critical, danger, dispatchedCount };
  }, [reports]);

  return (
    <div className="min-h-screen w-full bg-base-900 text-slate-100 grid-bg relative overflow-hidden">
      {/* Ambient glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-red-500/10 blur-[120px]" />
        <div className="absolute -top-20 right-0 w-96 h-96 rounded-full bg-blue-500/10 blur-[120px]" />
        <div className="absolute bottom-0 left-1/3 w-96 h-96 rounded-full bg-cyan-500/5 blur-[120px]" />
      </div>

      {/* Scan line */}
      <div className="pointer-events-none fixed inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-400/30 to-transparent animate-scan" />

      {/* Alert bar */}
      <AlertBar
        report={alertReport}
        onDismiss={() => setAlertReport(null)}
        onView={(id) => {
          handleSelect(id);
          setAlertReport(null);
        }}
      />

      <div className="relative z-10 max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-5">
        {/* Header */}
        <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-3.5">
            <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-red-500/25 to-blue-600/25 border border-red-400/30 flex items-center justify-center">
              <ShieldAlert className="w-6 h-6 text-red-300" />
              <div className="absolute inset-0 rounded-2xl border border-red-400/20 animate-pulse-ring" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-extrabold tracking-tight">
                강남 <span className="text-red-300 text-glow-red">경찰 관제</span> 대시보드
              </h1>
              <p className="text-[11px] sm:text-xs text-slate-500 font-medium">
                실시간 보이스피싱 신고 접수 · 출동 지시 · 수사 지원 시스템
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <StatusChip icon={RadioTower} label="실시간 수신" status="ONLINE" color="emerald" />
            <StatusChip icon={Activity} label="신고 접수" status={String(stats.total)} color="cyan" />
            <StatusChip icon={Siren} label="고위험" status={String(stats.critical)} color="red" />
            <StatusChip icon={CarFront} label="출동 중" status={String(stats.dispatchedCount)} color="amber" />
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg glass font-mono text-xs text-slate-300">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
              {clock.toLocaleTimeString('ko-KR', { hour12: false })}
            </div>
          </div>
        </header>

        {/* Tab switcher */}
        <div className="flex items-center gap-2 mb-5">
          <button
            onClick={() => setActiveTab('individual')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
              activeTab === 'individual'
                ? 'bg-gradient-to-r from-red-500/25 to-orange-500/25 border border-red-400/30 text-red-100 glow-red'
                : 'bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10 hover:text-slate-200'
            }`}
          >
            <Siren className="w-4 h-4" />
            개별 분석
          </button>
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
              activeTab === 'overview'
                ? 'bg-gradient-to-r from-cyan-500/25 to-blue-600/25 border border-cyan-400/30 text-cyan-100 glow-cyan'
                : 'bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10 hover:text-slate-200'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            종합 분석
          </button>
        </div>

        {/* Main layout — individual analysis (always mounted, toggled via CSS) */}
        <div className={activeTab === 'individual' ? 'grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5' : 'hidden'}>
          {/* Left sidebar — report list */}
          <div className="glass rounded-2xl flex flex-col overflow-hidden h-[calc(100vh-180px)] lg:sticky lg:top-5">
            <div className="px-4 pt-4 pb-2 border-b border-white/5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-400/15 flex items-center justify-center">
                  <Siren className="w-4 h-4 text-red-300" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-100">신고 접수 목록</h2>
                  <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wide">Incoming Reports</p>
                </div>
                <button
                  onClick={handleDeleteAll}
                  disabled={reports.length === 0}
                  className="ml-auto flex items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/10 px-2.5 py-1.5 text-[10px] font-mono font-semibold text-red-300 transition-colors hover:bg-red-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="전체 삭제"
                >
                  <Trash2 className="w-3 h-3" />
                  전체 삭제
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <span className="w-6 h-6 border-2 border-cyan-300/30 border-t-cyan-300 rounded-full animate-spin" />
                </div>
              ) : (
                <ReportList
                  reports={reports}
                  selectedId={selectedId}
                  onSelect={handleSelect}
                  onDelete={handleDeleteReport}
                  filter={filter}
                  searchQuery={searchQuery}
                  onFilterChange={setFilter}
                  onSearchChange={setSearchQuery}
                />
              )}
            </div>
          </div>

          {/* Main center area */}
          <div className="flex flex-col gap-5 min-h-0">
            {selected ? (
              <ReportDetail
                report={selected}
                dispatched={dispatched}
                selectedStationId={selectedStationId}
                onStationSelect={setSelectedStationId}
                onDispatch={handleDispatch}
                onCall={handleCall}
                onCallEnd={handleCallEnd}
                callConnected={callConnected}
                callElapsed={callElapsed}
                callEnded={callEnded}
                onDownload={handleDownloadPdf}
                onSelectReport={handleSelect}
                allReports={reports}
              />
            ) : (
              <EmptyState />
            )}
          </div>
        </div>

        {/* Overview analysis (always mounted, toggled via CSS for realtime sync) */}
        <div className={activeTab === 'overview' ? 'block' : 'hidden'}>
          <OverviewDashboard reports={reports} />
        </div>

        {/* Footer */}
        <footer className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] text-slate-600 font-mono">
          <span>강남 경찰 관제 대시보드 · Supabase Realtime · 112 신고 연동 시스템</span>
          <span>강남경찰서 보이스피싱 수사팀 · 비상근무 24시간 운영</span>
        </footer>
      </div>

      {/* Toast notification */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[55] animate-fade-in-up">
          <div className="glass-strong rounded-xl border border-amber-500/30 px-5 py-3 flex items-center gap-2.5 shadow-2xl">
            <Siren className="w-4 h-4 text-amber-300 shrink-0" />
            <span className="text-sm font-medium text-amber-100">{toast}</span>
          </div>
        </div>
      )}

      {/* Call dialog */}
      {showCallDialog && selected && (
        <ErrorBoundary>
          <CallDialog
            phone={selected.reporter_phone}
            onClose={() => setShowCallDialog(false)}
            onConnected={handleCallConnected}
          />
        </ErrorBoundary>
      )}
    </div>
  );
}

// ─── Report Detail View ─────────────────────────────────────────────

interface ReportDetailProps {
  report: PoliceReportRow;
  dispatched: boolean;
  selectedStationId: string;
  onStationSelect: (id: string) => void;
  onDispatch: () => void;
  onCall: () => void;
  onCallEnd: () => void;
  callConnected: boolean;
  callElapsed: number;
  callEnded: boolean;
  onDownload: () => void;
  onSelectReport: (id: string) => void;
  allReports: PoliceReportRow[];
}

function ReportDetail({ report, dispatched, selectedStationId, onStationSelect, onDispatch, onCall, onCallEnd, callConnected, callElapsed, callEnded, onDownload }: ReportDetailProps) {
  const meta = LEVEL_META[report.threat_level];
  const statusMeta = STATUS_META[report.status as ReportStatus] ?? STATUS_META['접수'];
  const semanticHits = report.semantic_hits as {
    hits?: Array<{ keyword: string; category: string; weight: number; count: number }>;
    regexHits?: Array<{ label: string; category: string; weight: number; count: number }>;
    sentences?: Array<{ index: number; text: string; intent: string; intentLabel: string; intentScore: number }>;
    contextSignals?: Array<{ label: string; scoreContribution: number; description: string }>;
  };

  const dangerSentences = (semanticHits.sentences ?? []).filter(
    (s) => !s.intent.startsWith('normal') && s.intent !== 'unknown'
  );

  return (
    <>
      {/* Risk gauge + summary */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-400/15 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4 text-red-300" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100">AI 통합 분석 리포트</h2>
              <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wide">Integrated Analysis Report</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-mono font-bold ${meta.badge}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${meta.dot} animate-pulse`} />
              {meta.ko}
            </span>
            <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-white/10 text-[10px] font-mono ${statusMeta.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dot}`} />
              {report.status}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-5 items-center">
          {/* Gauge */}
          <div className="flex flex-col items-center justify-center">
            <CircularGauge value={report.overall_score} level={report.threat_level} />
          </div>

          {/* AI Summary */}
          <div className="space-y-3">
            <div>
              <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wide mb-1">Upstage AI 문맥 요약</p>
              <p className="text-sm text-slate-200 leading-relaxed">
                {report.upstage_summary || 'AI 분석 요약 없음'}
              </p>
            </div>

            {/* Keyword tags */}
            {report.upstage_patterns.length > 0 && (
              <div>
                <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wide mb-1.5">핵심 키워드 태그</p>
                <div className="flex flex-wrap gap-1.5">
                  {report.upstage_patterns.map((p, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded-md bg-red-500/10 border border-red-500/20 text-[10px] text-red-300 font-medium"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Intent classification */}
            {report.upstage_intent && (
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
                <span className="text-xs text-slate-400">의도 분류:</span>
                <span className="text-xs font-semibold text-cyan-200">{report.upstage_intent}</span>
              </div>
            )}

            {/* Meta info */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              <InfoChip icon={MapPin} label="위치" value={report.location} />
              <InfoChip icon={Phone} label="신고자" value={report.reporter_phone} />
              <InfoChip icon={Clock} label="접수시간" value={formatClock(report.created_at)} />
              <InfoChip icon={FileText} label="보고서 ID" value={report.report_id} />
            </div>
          </div>
        </div>
      </div>

      {/* STT transcript + Map */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-5">
        {/* STT Transcript */}
        <div className="glass rounded-2xl p-5 flex flex-col">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-400/15 flex items-center justify-center">
              <FileText className="w-4 h-4 text-cyan-300" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">Whisper AI STT 전사 텍스트</h3>
              <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wide">Speech-to-Text Transcript</p>
            </div>
          </div>

          {/* Audio player */}
          <AudioPlayer audioData={report.audio_data} duration={report.audio_duration} hasAudio={report.has_audio} />

          {/* Transcript with highlighted danger sentences */}
          <div className="flex-1 overflow-y-auto scrollbar-slim rounded-xl bg-black/30 border border-white/8 p-3 max-h-48">
            {report.transcript ? (
              <p className="text-xs text-slate-300 leading-relaxed">
                {highlightDangerText(report.transcript, dangerSentences.map((s) => s.text))}
              </p>
            ) : (
              <p className="text-xs text-slate-500 italic">전사 텍스트 없음</p>
            )}
          </div>

          {/* Danger sentence list */}
          {dangerSentences.length > 0 && (
            <div className="mt-3">
              <p className="text-[10px] text-red-400 font-mono mb-1.5">위험 발화 구간 ({dangerSentences.length}개)</p>
              <div className="space-y-1 max-h-24 overflow-y-auto scrollbar-slim">
                {dangerSentences.map((s, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 rounded-lg bg-red-500/5 border border-red-500/15 px-2.5 py-1.5 text-[11px]"
                  >
                    <span className="font-mono font-bold text-red-300 shrink-0">{s.intentScore}</span>
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-medium text-amber-300">{s.intentLabel}</span>
                      <p className="text-slate-400 leading-snug">{s.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* GIS Map */}
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-400/15 flex items-center justify-center">
              <MapPin className="w-4 h-4 text-blue-300" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">강남구 GIS 실시간 위치 지도</h3>
              <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wide">Real-time GIS Location</p>
            </div>
          </div>
          <ErrorBoundary>
            <GangnamMap location={report.location} latitude={report.latitude} longitude={report.longitude} dispatched={dispatched} selectedStationId={selectedStationId} onStationSelect={onStationSelect} />
          </ErrorBoundary>
          {dispatched && (
            <div className="mt-3 rounded-lg bg-amber-500/10 border border-amber-500/25 px-3 py-2 flex items-center gap-2 animate-fade-in-up">
              <Car className="w-4 h-4 text-amber-300 shrink-0" />
              <p className="text-xs text-amber-200">
                순찰차 출동 지시 완료 — 관할 파출소 순찰차 이동 중
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Action bar */}
      <div className="glass-strong rounded-2xl p-4">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-400/15 flex items-center justify-center">
            <Siren className="w-3.5 h-3.5 text-amber-300" />
          </div>
          <h3 className="text-sm font-bold text-slate-100">경찰관 실무 액션</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <button
            onClick={onDispatch}
            disabled={dispatched}
            className={`flex items-center justify-center gap-2 rounded-xl py-3 font-semibold text-sm transition-all duration-200 ${
              dispatched
                ? 'bg-amber-500/15 border border-amber-500/30 text-amber-200 cursor-default'
                : 'bg-gradient-to-r from-red-500/25 to-orange-500/25 hover:from-red-500/35 hover:to-orange-500/35 border border-red-400/30 text-red-100 hover:glow-red'
            }`}
          >
            {dispatched ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                출동 지시 완료
              </>
            ) : (
              <>
                <Siren className="w-4 h-4" />
                최우선 순찰차 출동 지시
              </>
            )}
          </button>
          <button
            onClick={onDownload}
            className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500/20 to-blue-500/20 hover:from-cyan-500/30 hover:to-blue-500/30 border border-cyan-400/20 py-3 font-semibold text-sm text-cyan-200 transition-colors"
          >
            <Download className="w-4 h-4" />
            수사 제출용 리포트 다운로드
          </button>
          <div className="flex gap-2.5">
            <button
              onClick={onCall}
              disabled={callConnected}
              className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-3 font-semibold text-sm transition-all duration-200 ${
                callConnected
                  ? 'bg-blue-500/20 border border-blue-400/30 text-blue-200 cursor-default'
                  : 'bg-gradient-to-r from-blue-500/20 to-indigo-500/20 hover:from-blue-500/30 hover:to-indigo-500/30 border border-blue-400/20 text-blue-200'
              }`}
            >
              {callConnected ? (
                <>
                  <PhoneCall className="w-4 h-4 animate-pulse" />
                  통화 중 {formatCallDuration(callElapsed)}
                </>
              ) : callEnded ? (
                <>
                  <Headphones className="w-4 h-4" />
                  다시 통화 연결
                </>
              ) : (
                <>
                  <Headphones className="w-4 h-4" />
                  신고자 직통 긴급 연결
                </>
              )}
            </button>
            {callConnected && (
              <button
                onClick={onCallEnd}
                className="flex items-center justify-center gap-2 rounded-xl bg-red-500/25 hover:bg-red-500/35 border border-red-400/40 py-3 px-4 font-semibold text-sm text-red-100 transition-all duration-200 animate-fade-in-up"
              >
                <PhoneOff className="w-4 h-4" />
                통화 종료
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Call history */}
      {report.call_logs && report.call_logs.length > 0 && (
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-400/15 flex items-center justify-center">
              <PhoneCall className="w-3.5 h-3.5 text-blue-300" />
            </div>
            <h3 className="text-sm font-bold text-slate-100">통화 이력</h3>
            <span className="text-[10px] font-mono text-slate-500">{report.call_logs.length}건</span>
          </div>
          <div className="space-y-1.5">
            {report.call_logs.map((log, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg bg-white/[0.03] border border-white/5 px-3 py-2">
                <PhoneCall className="w-3.5 h-3.5 text-blue-300 shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-slate-300">{new Date(log.started_at).toLocaleString('ko-KR')}</span>
                  <span className="text-[10px] text-slate-500 mx-2">→</span>
                  <span className="text-xs text-slate-400">{new Date(log.ended_at).toLocaleString('ko-KR')}</span>
                </div>
                <span className="text-xs font-mono font-bold text-blue-200 shrink-0">{formatCallDuration(log.duration_sec)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// ─── Circular Gauge ─────────────────────────────────────────────────

function CircularGauge({ value, level }: { value: number; level: PoliceReportRow['threat_level'] }) {
  const [display, setDisplay] = useState(0);
  const displayRef = useRef(0);
  const meta = LEVEL_META[level];
  const color = level === 'safe' ? '#10b981' : level === 'caution' ? '#f59e0b' : '#ef4444';

  useEffect(() => {
    let raf = 0;
    const startValue = displayRef.current;
    const startTime = performance.now();
    const duration = 1000;
    const animate = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const val = startValue + (value - startValue) * eased;
      displayRef.current = val;
      setDisplay(val);
      if (t < 1) raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  const size = 120;
  const radius = (size - 20) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(1, Math.max(0, display / 100));
  const dash = circumference * pct;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`relative rounded-full ${meta.glow} p-1`} style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(120,160,220,0.1)" strokeWidth="6" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
            style={{ filter: `drop-shadow(0 0 6px ${color}80)` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`font-mono text-2xl font-bold ${meta.text}`} style={{ textShadow: `0 0 10px ${color}80` }}>
            {Math.round(display)}
            <span className="text-sm opacity-60">%</span>
          </span>
        </div>
      </div>
      <span className={`text-xs font-bold ${meta.text}`}>{meta.ko}</span>
    </div>
  );
}

// ─── Helper Components ──────────────────────────────────────────────

function StatusChip({
  icon: Icon,
  label,
  status,
  color,
}: {
  icon: typeof Activity;
  label: string;
  status: string;
  color: 'emerald' | 'cyan' | 'red' | 'amber';
}) {
  const colorMap = {
    emerald: 'text-emerald-300 border-emerald-500/20',
    cyan: 'text-cyan-300 border-cyan-500/20',
    red: 'text-red-300 border-red-500/20',
    amber: 'text-amber-300 border-amber-500/20',
  };
  const dotMap = { emerald: 'bg-emerald-400', cyan: 'bg-cyan-400', red: 'bg-red-400', amber: 'bg-amber-400' };
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg glass border ${colorMap[color]}`}>
      <Icon className="w-3.5 h-3.5" />
      <span className="text-[10px] font-mono text-slate-400">{label}</span>
      <span className={`w-1.5 h-1.5 rounded-full ${dotMap[color]} animate-pulse`} />
      <span className="text-[10px] font-mono font-semibold">{status}</span>
    </div>
  );
}

function InfoChip({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/[0.03] border border-white/5 px-2.5 py-1.5">
      <div className="flex items-center gap-1 mb-0.5">
        <Icon className="w-3 h-3 text-slate-500" />
        <span className="text-[9px] text-slate-600 uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-xs font-mono text-slate-300 truncate">{value}</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="glass rounded-2xl flex flex-col items-center justify-center py-20 gap-4">
      <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-400/15 flex items-center justify-center">
        <Shield className="w-8 h-8 text-cyan-300" />
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-slate-300">신고를 선택해주세요</p>
        <p className="text-xs text-slate-500 mt-1">좌측 목록에서 신고 건을 클릭하면 상세 분석 리포트가 표시됩니다</p>
      </div>
      <div className="flex items-center gap-2 text-[10px] font-mono text-slate-600">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        실시간 신고 대기 중…
      </div>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────

function highlightDangerText(text: string, dangerSentences: string[]): React.ReactNode {
  if (dangerSentences.length === 0) return text;
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;
  let found = true;
  while (found) {
    found = false;
    let earliestIdx = -1;
    let earliestSentence = '';
    for (const ds of dangerSentences) {
      const idx = remaining.indexOf(ds);
      if (idx !== -1 && (earliestIdx === -1 || idx < earliestIdx)) {
        earliestIdx = idx;
        earliestSentence = ds;
      }
    }
    if (earliestIdx !== -1) {
      found = true;
      if (earliestIdx > 0) {
        parts.push(<span key={key++}>{remaining.slice(0, earliestIdx)}</span>);
      }
      parts.push(
        <span key={key++} className="bg-red-500/20 border-b border-red-500/40 rounded px-0.5 text-red-200">
          {earliestSentence}
        </span>
      );
      remaining = remaining.slice(earliestIdx + earliestSentence.length);
    }
  }
  if (remaining) parts.push(<span key={key}>{remaining}</span>);
  return parts;
}

// ─── Audio Player ───────────────────────────────────────────────────

function AudioPlayer({ audioData, duration, hasAudio }: { audioData: string; duration: number; hasAudio: boolean }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => {
      setCurrentTime(audio.currentTime);
      if (audio.duration > 0) {
        setProgress((audio.currentTime / audio.duration) * 100);
      }
    };
    const onEnded = () => {
      setPlaying(false);
      setProgress(0);
      setCurrentTime(0);
    };
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('ended', onEnded);
    };
  }, [audioData]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      void audio.play();
      setPlaying(true);
    }
  };

  const formatSec = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  if (!audioData) {
    return (
      <div className="flex items-center gap-2 mb-3 rounded-lg bg-black/30 border border-white/8 px-3 py-2">
        <div className="w-7 h-7 rounded-full bg-slate-600/20 border border-slate-500/30 flex items-center justify-center shrink-0">
          <Volume2 className="w-3.5 h-3.5 text-slate-500" />
        </div>
        <span className="text-[10px] font-mono text-slate-500">
          {hasAudio ? '오디오 데이터 없음' : '텍스트 기반 분석 (오디오 없음)'}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 mb-3 rounded-lg bg-black/30 border border-white/8 px-3 py-2">
      <audio ref={audioRef} src={audioData} preload="metadata" />
      <button
        onClick={togglePlay}
        className="w-7 h-7 rounded-full bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center shrink-0 hover:bg-cyan-500/30 transition-colors"
        aria-label={playing ? '일시정지' : '재생'}
      >
        {playing ? (
          <Pause className="w-3 h-3 text-cyan-300" />
        ) : (
          <Play className="w-3.5 h-3.5 text-cyan-300 ml-0.5" />
        )}
      </button>
      <div
        className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden cursor-pointer"
        onClick={(e) => {
          const audio = audioRef.current;
          if (!audio || !audio.duration) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const pct = (e.clientX - rect.left) / rect.width;
          audio.currentTime = pct * audio.duration;
        }}
      >
        <div
          className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
      <span className="text-[10px] font-mono text-slate-500 shrink-0">
        {formatSec(currentTime)} / {duration > 0 ? formatSec(duration) : '--:--'}
      </span>
    </div>
  );
}

function normalizeTimestamp(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') {
    const iso = value.replace(' ', 'T').replace(/\+00$/, '+00:00').replace(/\+(\d{2})$/, '+$1:00');
    const parsed = new Date(iso);
    if (!isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return new Date().toISOString();
}

function mapDbRow(row: Record<string, unknown>): PoliceReportRow {
  const created_at = normalizeTimestamp(row.created_at);
  return {
    id: String(row.id),
    report_id: String(row.report_id ?? ''),
    created_at,
    overall_score: Number(row.overall_score ?? 0),
    threat_level: (row.threat_level as PoliceReportRow['threat_level']) ?? 'safe',
    source_label: String(row.source_label ?? ''),
    transcript: String(row.transcript ?? ''),
    upstage_summary: String(row.upstage_summary ?? ''),
    upstage_patterns: (row.upstage_patterns as string[]) ?? [],
    upstage_intent: String(row.upstage_intent ?? ''),
    upstage_risk_score: Number(row.upstage_risk_score ?? 0),
    upstage_confidence: Number(row.upstage_confidence ?? 0),
    semantic_hits: (row.semantic_hits as Record<string, unknown>) ?? {},
    matched_categories: (row.matched_categories as string[]) ?? [],
    flow_pattern: String(row.flow_pattern ?? ''),
    location: String(row.location ?? '강남구'),
    reporter_phone: String(row.reporter_phone ?? '010-****-0000'),
    status: (row.status as PoliceReportRow['status']) ?? '접수',
    has_audio: Boolean(row.has_audio ?? false),
    audio_duration: Number(row.audio_duration ?? 0),
    audio_url: String(row.audio_url ?? ''),
    audio_data: String(row.audio_data ?? ''),
    call_logs: (row.call_logs as CallLog[]) ?? [],
    latitude: Number(row.latitude ?? 0),
    longitude: Number(row.longitude ?? 0),
  };
}

function formatCallDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function buildPdfReport(r: PoliceReportRow): string {
  const lines: string[] = [];
  lines.push('=========================================================');
  lines.push('  강남구 경찰 관제 수사 제출용 리포트');
  lines.push('  Police Investigation Report — Voice Phishing');
  lines.push('=========================================================');
  lines.push('');
  lines.push(`보고서 ID     : ${r.report_id}`);
  lines.push(`접수일시       : ${new Date(r.created_at).toLocaleString('ko-KR')}`);
  lines.push(`종합 위험도   : ${r.overall_score}/100 (${LEVEL_META[r.threat_level].ko})`);
  lines.push(`신고자 위치    : ${r.location}`);
  lines.push(`신고자 전화    : ${r.reporter_phone}`);
  lines.push(`사건 상태      : ${r.status}`);
  lines.push(`분석 대상      : ${r.source_label}`);
  lines.push('');
  lines.push('─ Upstage AI 분석 ─────────────────────────────────────');
  lines.push(`  AI 위험 점수  : ${r.upstage_risk_score}/100`);
  lines.push(`  AI 신뢰도    : ${(r.upstage_confidence * 100).toFixed(0)}%`);
  lines.push(`  의도 분류    : ${r.upstage_intent}`);
  lines.push(`  분석 요약    : ${r.upstage_summary}`);
  if (r.upstage_patterns.length > 0) {
    lines.push('  탐지 패턴    :');
    r.upstage_patterns.forEach((p) => lines.push(`      - ${p}`));
  }
  lines.push('');
  lines.push('─ 전사 텍스트 (STT) ────────────────────────────────────');
  lines.push(r.transcript || '전사 텍스트 없음');
  lines.push('');
  lines.push('─ 매칭 카테고리 ────────────────────────────────────────');
  lines.push(r.matched_categories.join(', ') || '없음');
  lines.push('');
  lines.push('─ 대화 흐름 패턴 ──────────────────────────────────────');
  lines.push(r.flow_pattern || '없음');
  lines.push('');
  if (r.call_logs && r.call_logs.length > 0) {
    lines.push('─ 통화 이력 ────────────────────────────────────────────');
    r.call_logs.forEach((log, i) => {
      lines.push(`  [${i + 1}] ${new Date(log.started_at).toLocaleString('ko-KR')} ~ ${new Date(log.ended_at).toLocaleString('ko-KR')} (${formatCallDuration(log.duration_sec)})`);
    });
    lines.push('');
  }
  lines.push('=========================================================');
  lines.push('  본 리포트는 강남 AI-Aegis 시스템에 의해 자동 생성됨.');
  lines.push('  수사 자료로 활용 가능하며 법적 효력은 법원 판단에 따름.');
  lines.push('=========================================================');
  return lines.join('\n');
}
