import { useEffect, useRef, useState } from 'react';
import type { PoliceReportRow } from '@/lib/types';
import { LEVEL_META } from './types';
import { Siren, Volume2, VolumeX, X } from 'lucide-react';

interface AlertBarProps {
  report: PoliceReportRow | null;
  onDismiss: () => void;
  onView: (id: string) => void;
}

export default function AlertBar({ report, onDismiss, onView }: AlertBarProps) {
  const [muted, setMuted] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!report || muted) return;
    playAlertSound();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report, muted]);

  const playAlertSound = () => {
    try {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!audioCtxRef.current) audioCtxRef.current = new Ctor();
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') void ctx.resume();

      const playTone = (freq: number, start: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = freq;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0, ctx.currentTime + start);
        gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + start + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + duration);
      };

      playTone(880, 0, 0.3);
      playTone(880, 0.4, 0.3);
      playTone(1100, 0.8, 0.4);
    } catch {
      // Audio not available
    }
  };

  if (!report) return null;
  const meta = LEVEL_META[report.threat_level];

  return (
    <>
      {/* Top alert bar */}
      <div className={`fixed top-0 inset-x-0 z-50 ${report.threat_level === 'critical' ? 'glow-red' : ''} animate-slide-in-right`}>
        <div className={`flex items-center gap-3 px-4 py-2.5 border-b backdrop-blur-xl ${
          report.threat_level === 'critical'
            ? 'bg-red-950/80 border-red-500/40'
            : report.threat_level === 'danger'
              ? 'bg-red-950/60 border-red-500/30'
              : 'bg-amber-950/60 border-amber-500/30'
        }`}>
          <Siren className={`w-5 h-5 ${report.threat_level === 'critical' ? 'text-red-400 animate-pulse' : 'text-amber-400'}`} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-100 truncate">
              <span className={`inline-flex items-center gap-1 ${meta.text}`}>
                <span className={`w-2 h-2 rounded-full ${meta.dot} animate-pulse`} />
                [위험 등급: {meta.ko}]
              </span>
              {' '}
              <span className="text-slate-300">{report.location}</span>
              {' '}
              <span className="text-slate-400">새로운 보이스피싱 신고 접수</span>
            </p>
            <p className="text-[10px] font-mono text-slate-500 truncate">
              {report.report_id} · {report.reporter_phone} · {new Date(report.created_at).toLocaleTimeString('ko-KR', { hour12: false })}
            </p>
          </div>
          <button
            onClick={() => setMuted((m) => !m)}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors shrink-0"
            aria-label={muted ? '음소거 해제' : '음소거'}
          >
            {muted ? <VolumeX className="w-3.5 h-3.5 text-slate-400" /> : <Volume2 className="w-3.5 h-3.5 text-slate-300" />}
          </button>
          <button
            onClick={() => onView(report.id)}
            className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-semibold text-slate-100 transition-colors shrink-0"
          >
            확인
          </button>
          <button
            onClick={onDismiss}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors shrink-0"
            aria-label="닫기"
          >
            <X className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>
      </div>
    </>
  );
}
