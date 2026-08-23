import type { PoliceReportRow, ReportStatus } from '@/lib/types';

export type { ReportStatus };

export const LEVEL_META: Record<
  PoliceReportRow['threat_level'],
  { ko: string; badge: string; dot: string; text: string; glow: string; ring: string }
> = {
  safe: {
    ko: '안전',
    badge: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300',
    dot: 'bg-emerald-400',
    text: 'text-emerald-300',
    glow: 'glow-emerald',
    ring: 'border-emerald-500/30',
  },
  caution: {
    ko: '주의',
    badge: 'bg-amber-500/15 border-amber-500/30 text-amber-300',
    dot: 'bg-amber-400',
    text: 'text-amber-300',
    glow: 'glow-amber',
    ring: 'border-amber-500/30',
  },
  danger: {
    ko: '위험',
    badge: 'bg-red-500/15 border-red-500/30 text-red-300',
    dot: 'bg-red-400',
    text: 'text-red-300',
    glow: 'glow-red',
    ring: 'border-red-500/30',
  },
  critical: {
    ko: '고위험',
    badge: 'bg-red-600/20 border-red-500/40 text-red-200',
    dot: 'bg-red-500',
    text: 'text-red-200',
    glow: 'glow-red',
    ring: 'border-red-500/40',
  },
};

export const STATUS_META: Record<ReportStatus, { color: string; dot: string }> = {
  '접수': { color: 'text-cyan-300', dot: 'bg-cyan-400' },
  '출동 중': { color: 'text-amber-300', dot: 'bg-amber-400' },
  '통화 중': { color: 'text-blue-300', dot: 'bg-blue-400' },
  '완료': { color: 'text-emerald-300', dot: 'bg-emerald-400' },
};

export function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return `${diff}초 전`;
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return d.toLocaleString('ko-KR');
}

export function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString('ko-KR', { hour12: false });
}
