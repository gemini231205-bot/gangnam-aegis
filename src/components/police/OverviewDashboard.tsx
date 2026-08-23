import { useMemo } from 'react';
import {
  Activity,
  AlertTriangle,
  Clock,
  MapPin,
  ShieldAlert,
  ShieldCheck,
  Siren,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';
import type { PoliceReportRow } from '@/lib/types';
import { LEVEL_META, formatClock, formatTime } from './types';

interface OverviewDashboardProps {
  reports: PoliceReportRow[];
}

type ThreatLevel = PoliceReportRow['threat_level'];

function kstDateStr(iso: string): string {
  return new Date(new Date(iso).getTime() + 32400000).toISOString().slice(0, 10);
}

export default function OverviewDashboard({ reports }: OverviewDashboardProps) {
  const analytics = useMemo(() => {
    const total = reports.length;
    const byLevel: Record<ThreatLevel, number> = { safe: 0, caution: 0, danger: 0, critical: 0 };
    const byStatus: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    const byHour: number[] = new Array(24).fill(0);
    const byDong: Record<string, number> = {};
    const allPatterns: Record<string, number> = {};
    let totalScore = 0;
    let totalUpstageRisk = 0;
    let totalDuration = 0;
    let audioCount = 0;
    let completedCount = 0;
    let dispatchedCount = 0;
    const byDate: Record<string, number> = {};
    const todayKST = kstDateStr(new Date().toISOString());

    const sorted = [...reports].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    for (const r of sorted) {
      byLevel[r.threat_level]++;
      byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
      totalScore += r.overall_score;
      totalUpstageRisk += r.upstage_risk_score;

      if (r.has_audio) {
        audioCount++;
        totalDuration += r.audio_duration;
      }
      if (r.status === '완료') completedCount++;
      if (r.status === '출동 중') dispatchedCount++;

      for (const cat of r.matched_categories) {
        byCategory[cat] = (byCategory[cat] ?? 0) + 1;
      }
      for (const p of r.upstage_patterns) {
        allPatterns[p] = (allPatterns[p] ?? 0) + 1;
      }

      const dateStr = kstDateStr(r.created_at);
      byDate[dateStr] = (byDate[dateStr] ?? 0) + 1;

      if (dateStr === todayKST) {
        const hour = (new Date(r.created_at).getUTCHours() + 9) % 24;
        byHour[hour]++;
      }

      const dongMatch = r.location.match(/강남구\s+(\S+)/);
      const dong = dongMatch ? dongMatch[1] : '기타';
      byDong[dong] = (byDong[dong] ?? 0) + 1;
    }

    const avgScore = total > 0 ? Math.round(totalScore / total) : 0;
    const avgUpstageRisk = total > 0 ? Math.round(totalUpstageRisk / total) : 0;
    const avgDuration = audioCount > 0 ? Math.round(totalDuration / audioCount) : 0;

    const topCategories = Object.entries(byCategory)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

    const topPatterns = Object.entries(allPatterns)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    const topDongs = Object.entries(byDong)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

    const maxHourCount = Math.max(...byHour, 1);

    const todayKSTDate = new Date(todayKST + 'T00:00:00.000Z');
    const dailyData: { date: string; count: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(todayKSTDate.getTime() - i * 86400000);
      const dateStr = d.toISOString().slice(0, 10);
      dailyData.push({ date: dateStr, count: byDate[dateStr] ?? 0 });
    }
    const maxDailyCount = Math.max(...dailyData.map((d) => d.count), 1);
    const last7Sum = dailyData.slice(-7).reduce((s, d) => s + d.count, 0);
    const prev7Sum = dailyData.slice(-14, -7).reduce((s, d) => s + d.count, 0);
    const trendDirection = last7Sum > prev7Sum ? 'up' : 'down';

    return {
      total,
      byLevel,
      byStatus,
      avgScore,
      avgUpstageRisk,
      avgDuration,
      audioCount,
      completedCount,
      dispatchedCount,
      topCategories,
      topPatterns,
      topDongs,
      byHour,
      maxHourCount,
      trendDirection,
      dailyData,
      maxDailyCount,
      todayKST,
      sorted,
    };
  }, [reports]);

  const {
    total,
    byLevel,
    byStatus,
    avgScore,
    avgUpstageRisk,
    avgDuration,
    audioCount,
    completedCount,
    dispatchedCount,
    topCategories,
    topPatterns,
    topDongs,
    byHour,
    maxHourCount,
    trendDirection,
    dailyData,
    maxDailyCount,
    todayKST,
    sorted,
  } = analytics;

  if (total === 0) {
    return (
      <div className="glass rounded-2xl flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-400/15 flex items-center justify-center">
          <Activity className="w-8 h-8 text-cyan-300" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-slate-300">분석할 신고 데이터가 없습니다</p>
          <p className="text-xs text-slate-500 mt-1">신고가 접수되면 종합 분석 대시보드에 트렌드가 표시됩니다</p>
        </div>
      </div>
    );
  }

  const levelColors: Record<ThreatLevel, string> = {
    safe: '#10b981',
    caution: '#f59e0b',
    danger: '#ef4444',
    critical: '#dc2626',
  };

  const hourLabels = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className="flex flex-col gap-5">
      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={Siren}
          label="총 신고 건수"
          value={String(total)}
          sublabel="Total Reports"
          color="cyan"
        />
        <KpiCard
          icon={ShieldAlert}
          label="평균 위험도"
          value={`${avgScore}%`}
          sublabel="Avg Threat Score"
          color={avgScore > 60 ? 'red' : avgScore > 28 ? 'amber' : 'emerald'}
        />
        <KpiCard
          icon={Zap}
          label="출동 건수"
          value={String(dispatchedCount)}
          sublabel="Dispatched"
          color="amber"
        />
        <KpiCard
          icon={ShieldCheck}
          label="완료 건수"
          value={String(completedCount)}
          sublabel="Resolved"
          color="emerald"
        />
      </div>

      {/* Threat Level Distribution + Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Threat Level Distribution */}
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-400/15 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4 text-red-300" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">위험 등급 분포</h3>
              <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wide">Threat Level Distribution</p>
            </div>
          </div>

          <div className="space-y-3">
            {(['critical', 'danger', 'caution', 'safe'] as ThreatLevel[]).map((level) => {
              const count = byLevel[level];
              const pct = total > 0 ? (count / total) * 100 : 0;
              const meta = LEVEL_META[level];
              return (
                <div key={level}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
                      <span className="text-xs font-medium text-slate-300">{meta.ko}</span>
                    </div>
                    <span className="text-xs font-mono text-slate-400">
                      {count}건 <span className="text-slate-600">({pct.toFixed(0)}%)</span>
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700 ease-out"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: levelColors[level],
                        boxShadow: `0 0 8px ${levelColors[level]}80`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Trend */}
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-400/15 flex items-center justify-center">
              {trendDirection === 'up' ? (
                <TrendingUp className="w-4 h-4 text-red-300" />
              ) : (
                <TrendingDown className="w-4 h-4 text-emerald-300" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">최근 위험 추세</h3>
              <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wide">Recent Threat Trend</p>
            </div>
          </div>

          {/* Daily report count bar chart */}
          <div className="flex flex-col gap-2">
            <div className="flex gap-1 h-28">
              {dailyData.map((day, i) => {
                const heightPct = maxDailyCount > 0 ? (day.count / maxDailyCount) * 100 : 0;
                const isPeak = day.count === maxDailyCount && day.count > 0;
                const label = day.date.slice(5).replace('-', '/');
                return (
                  <div key={i} className="flex-1 h-full flex flex-col justify-end items-center gap-1 group relative">
                    <div
                      className={`w-full rounded-t-md transition-all duration-500 ${
                        isPeak ? 'bg-red-400' : day.count > 0 ? 'bg-cyan-400/60' : 'bg-white/5'
                      }`}
                      style={{ height: `${day.count > 0 ? Math.max(heightPct, 8) : 3}%` }}
                    />
                    <span className="text-[7px] font-mono text-slate-600 group-hover:text-slate-400 transition-colors">
                      {label}
                    </span>
                    <div className="absolute -top-5 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap rounded bg-slate-800 px-1.5 py-0.5 text-[9px] font-medium text-slate-200 z-10">
                      {label} · {day.count}건
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-2 text-xs pt-1 border-t border-white/5">
              {trendDirection === 'up' ? (
                <>
                  <TrendingUp className="w-3.5 h-3.5 text-red-300" />
                  <span className="text-red-300 font-medium">신고 증가 추세</span>
                </>
              ) : (
                <>
                  <TrendingDown className="w-3.5 h-3.5 text-emerald-300" />
                  <span className="text-emerald-300 font-medium">안정 또는 감소 추세</span>
                </>
              )}
              <span className="ml-auto text-[10px] font-mono text-slate-600">최근 14일</span>
            </div>
          </div>
        </div>
      </div>

      {/* Hourly Distribution */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-400/15 flex items-center justify-center">
            <Clock className="w-4 h-4 text-blue-300" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100">시간대별 신고 분포</h3>
            <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wide">Hourly Report Distribution · Today ({todayKST.slice(5).replace('-', '/')})</p>
          </div>
        </div>
        <div className="flex gap-0.5 h-32">
          {hourLabels.map((hour) => {
            const count = byHour[hour];
            const heightPct = maxHourCount > 0 ? (count / maxHourCount) * 100 : 0;
            const isPeak = count === maxHourCount && count > 0;
            return (
              <div key={hour} className="flex-1 h-full flex flex-col justify-end items-center gap-1 group relative">
                <div
                  className={`w-full rounded-t-md transition-all duration-500 ${
                    isPeak ? 'bg-red-400' : count > 0 ? 'bg-cyan-400/60' : 'bg-white/5'
                  }`}
                  style={{ height: `${count > 0 ? Math.max(heightPct, 5) : 2}%` }}
                >
                  {count > 0 && (
                    <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] font-mono text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      {count}
                    </span>
                  )}
                </div>
                <span className={`text-[8px] font-mono ${hour % 3 === 0 ? 'text-slate-500' : 'text-transparent'}`}>
                  {hour}
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between mt-2 text-[10px] text-slate-600 font-mono">
          <span>00:00</span>
          <span>06:00</span>
          <span>12:00</span>
          <span>18:00</span>
          <span>23:59</span>
        </div>
      </div>

      {/* Category + Pattern Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Top Categories */}
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-400/15 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-amber-300" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">피싱 유형 분석</h3>
              <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wide">Phishing Type Analysis</p>
            </div>
          </div>
          {topCategories.length === 0 ? (
            <p className="text-xs text-slate-500">탐지된 카테고리 없음</p>
          ) : (
            <div className="space-y-2.5">
              {topCategories.map(([cat, count]) => {
                const pct = total > 0 ? (count / total) * 100 : 0;
                return (
                  <div key={cat}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-slate-300">{cat}</span>
                      <span className="text-xs font-mono text-slate-400">{count}건</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-400 to-red-400 transition-all duration-700"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top Patterns */}
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-400/15 flex items-center justify-center">
              <Zap className="w-4 h-4 text-red-300" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">주요 위험 패턴</h3>
              <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wide">Top Risk Patterns</p>
            </div>
          </div>
          {topPatterns.length === 0 ? (
            <p className="text-xs text-slate-500">탐지된 패턴 없음</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {topPatterns.map(([pattern, count]) => (
                <div
                  key={pattern}
                  className="flex items-center gap-1.5 rounded-lg bg-red-500/10 border border-red-500/20 px-2.5 py-1.5"
                >
                  <span className="text-xs text-red-300 font-medium">{pattern}</span>
                  <span className="text-[10px] font-mono text-red-400 bg-red-500/15 rounded px-1">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Location + Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Location Distribution */}
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-400/15 flex items-center justify-center">
              <MapPin className="w-4 h-4 text-blue-300" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">지역별 신고 분포</h3>
              <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wide">Location Distribution</p>
            </div>
          </div>
          {topDongs.length === 0 ? (
            <p className="text-xs text-slate-500">위치 데이터 없음</p>
          ) : (
            <div className="space-y-2.5">
              {topDongs.map(([dong, count]) => {
                const pct = total > 0 ? (count / total) * 100 : 0;
                return (
                  <div key={dong}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-slate-300">{dong}</span>
                      <span className="text-xs font-mono text-slate-400">{count}건</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-blue-400 to-cyan-400 transition-all duration-700"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Status Distribution */}
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-400/15 flex items-center justify-center">
              <Activity className="w-4 h-4 text-emerald-300" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">처리 상태 분포</h3>
              <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wide">Status Distribution</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(byStatus).map(([status, count]) => {
              const pct = total > 0 ? (count / total) * 100 : 0;
              const statusColors: Record<string, string> = {
                '접수': 'text-cyan-300 bg-cyan-500/10 border-cyan-500/20',
                '출동 중': 'text-amber-300 bg-amber-500/10 border-amber-500/20',
                '통화 중': 'text-blue-300 bg-blue-500/10 border-blue-500/20',
                '완료': 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20',
              };
              const colorClass = statusColors[status] ?? 'text-slate-300 bg-white/5 border-white/10';
              return (
                <div key={status} className={`rounded-xl border px-3 py-2.5 ${colorClass}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium">{status}</span>
                    <span className="text-lg font-mono font-bold">{count}</span>
                  </div>
                  <div className="h-1 rounded-full bg-black/20 overflow-hidden">
                    <div className="h-full rounded-full bg-current opacity-60 transition-all duration-700" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent Reports Timeline */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-400/15 flex items-center justify-center">
            <Clock className="w-4 h-4 text-cyan-300" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100">최근 신고 타임라인</h3>
            <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wide">Recent Reports Timeline</p>
          </div>
        </div>
        <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-slim">
          {sorted.slice(-15).reverse().map((r) => {
            const meta = LEVEL_META[r.threat_level];
            return (
              <div
                key={r.id}
                className="flex items-center gap-3 rounded-lg bg-white/[0.03] border border-white/5 px-3 py-2 hover:bg-white/[0.05] transition-colors"
              >
                <span className={`w-2 h-2 rounded-full ${meta.dot} shrink-0`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-200 truncate">{r.report_id}</span>
                    <span className={`text-[10px] font-mono ${meta.text}`}>{meta.ko}</span>
                  </div>
                  <p className="text-[10px] text-slate-500 truncate">{r.location} · {r.matched_categories.join(', ') || '카테고리 없음'}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-mono text-slate-400">{r.overall_score}</span>
                  <span className="text-[10px] font-mono text-slate-600">{formatTime(r.created_at)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  sublabel,
  color,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  sublabel: string;
  color: 'emerald' | 'cyan' | 'red' | 'amber';
}) {
  const colorMap = {
    emerald: 'text-emerald-300 border-emerald-500/20 bg-emerald-500/5',
    cyan: 'text-cyan-300 border-cyan-500/20 bg-cyan-500/5',
    red: 'text-red-300 border-red-500/20 bg-red-500/5',
    amber: 'text-amber-300 border-amber-500/20 bg-amber-500/5',
  };
  return (
    <div className={`glass rounded-2xl p-4 border ${colorMap[color]}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4" />
        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wide">{sublabel}</span>
      </div>
      <p className="text-2xl font-bold font-mono">{value}</p>
      <p className="text-xs text-slate-400 mt-0.5">{label}</p>
    </div>
  );
}
