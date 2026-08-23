import { useEffect, useRef, useState } from 'react';
import type { PoliceReportRow } from '@/lib/types';
import { LEVEL_META, formatTime, formatClock } from './types';
import { AlertCircle, MapPin, Search, Siren, Trash2 } from 'lucide-react';

interface ReportListProps {
  reports: PoliceReportRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  filter: 'all' | 'critical' | 'danger' | 'caution';
  searchQuery: string;
  onFilterChange: (f: 'all' | 'critical' | 'danger' | 'caution') => void;
  onSearchChange: (q: string) => void;
}

const FILTER_LABELS: { key: 'all' | 'critical' | 'danger' | 'caution'; label: string; color: string }[] = [
  { key: 'all', label: '전체', color: 'text-slate-300' },
  { key: 'critical', label: '고위험', color: 'text-red-300' },
  { key: 'danger', label: '위험', color: 'text-red-300' },
  { key: 'caution', label: '주의', color: 'text-amber-300' },
];

export default function ReportList({
  reports,
  selectedId,
  onSelect,
  onDelete,
  filter,
  searchQuery,
  onFilterChange,
  onSearchChange,
}: ReportListProps) {
  const filtered = reports.filter((r) => {
    if (filter !== 'all') {
      if (filter === 'critical' && r.threat_level !== 'critical') return false;
      if (filter === 'danger' && r.threat_level !== 'danger') return false;
      if (filter === 'caution' && r.threat_level !== 'caution') return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        r.report_id.toLowerCase().includes(q) ||
        r.location.toLowerCase().includes(q) ||
        r.upstage_summary.toLowerCase().includes(q) ||
        r.transcript.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="px-3 pt-3 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="신고 검색 (위치, 내용, ID)"
            className="w-full rounded-lg bg-black/30 border border-white/8 pl-9 pr-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-400/30"
          />
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 px-3 pb-2">
        {FILTER_LABELS.map((f) => (
          <button
            key={f.key}
            onClick={() => onFilterChange(f.key)}
            className={`px-2.5 py-1 rounded-md text-[10px] font-mono font-semibold transition-all ${
              filter === f.key
                ? 'bg-white/10 border border-white/15 text-slate-100'
                : 'bg-transparent border border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            {f.label}
          </button>
        ))}
        <span className="ml-auto text-[10px] font-mono text-slate-600">{filtered.length}건</span>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto scrollbar-slim px-2 pb-2 space-y-1.5 min-h-0">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-2">
            <AlertCircle className="w-6 h-6" />
            <p className="text-xs">접수된 신고가 없습니다</p>
          </div>
        ) : (
          filtered.map((r) => {
            const meta = LEVEL_META[r.threat_level];
            const active = selectedId === r.id;
            return (
              <div
                key={r.id}
                className={`group relative rounded-xl border p-3 transition-all duration-200 animate-fade-in-up ${
                  active
                    ? `${meta.ring} bg-white/[0.06] ${meta.glow}`
                    : 'border-white/8 bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]'
                }`}
              >
                <button
                  onClick={() => onSelect(r.id)}
                  className="w-full text-left"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${meta.dot} ${r.threat_level === 'critical' || r.threat_level === 'danger' ? 'animate-pulse' : ''}`} />
                      <span className={`text-[10px] font-mono font-bold ${meta.text}`}>
                        {meta.ko} · {r.overall_score}%
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-600">{formatTime(r.created_at)}</span>
                  </div>
                  <div className="flex items-center gap-1 mb-1">
                    <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                    <p className="text-xs font-semibold text-slate-200 truncate">{r.location}</p>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-snug line-clamp-2">
                    {r.upstage_summary || r.transcript.slice(0, 60) || '분석 데이터 없음'}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span className="text-[9px] font-mono text-slate-600">{formatClock(r.created_at)}</span>
                    {r.threat_level === 'critical' && (
                      <span className="flex items-center gap-0.5 text-[9px] font-mono text-red-400">
                        <Siren className="w-2.5 h-2.5" />
                        긴급
                      </span>
                    )}
                  </div>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(r.id);
                  }}
                  className="absolute top-2 right-2 w-5 h-5 rounded-md bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-500/30 flex items-center justify-center transition-colors"
                  aria-label="삭제"
                >
                  <Trash2 className="w-2.5 h-2.5 text-slate-500 hover:text-red-300" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
