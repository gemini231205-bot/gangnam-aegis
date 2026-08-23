import { useEffect, useState } from 'react';
import type { ThreatLevel } from '@/types';

interface GaugeProps {
  value: number;
  max?: number;
  label: string;
  sublabel?: string;
  color: 'cyan' | 'amber' | 'red' | 'emerald';
  size?: number;
}

const COLOR_MAP: Record<GaugeProps['color'], { stroke: string; glow: string; text: string }> = {
  cyan: { stroke: '#22d3ee', glow: 'rgba(34,211,238,0.5)', text: 'text-cyan-300' },
  amber: { stroke: '#f59e0b', glow: 'rgba(245,158,11,0.5)', text: 'text-amber-300' },
  red: { stroke: '#ef4444', glow: 'rgba(239,68,68,0.5)', text: 'text-red-300' },
  emerald: { stroke: '#10b981', glow: 'rgba(16,185,129,0.5)', text: 'text-emerald-300' },
};

export function Gauge({ value, max = 100, label, sublabel, color, size = 150 }: GaugeProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const c = COLOR_MAP[color];

  useEffect(() => {
    const target = Math.min(max, Math.max(0, value));
    let raf: number;
    const start = displayValue;
    const startTime = performance.now();
    const duration = 900;
    const animate = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayValue(start + (target - start) * eased);
      if (t < 1) raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, max]);

  const radius = (size - 24) / 2;
  const circumference = Math.PI * radius; // semicircle
  const pct = Math.min(1, Math.max(0, displayValue / max));
  const offset = circumference * (1 - pct);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size / 2 + 16 }}>
        <svg width={size} height={size / 2 + 16} className="overflow-visible">
          <defs>
            <linearGradient id={`grad-${label}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={c.stroke} stopOpacity="0.5" />
              <stop offset="100%" stopColor={c.stroke} stopOpacity="1" />
            </linearGradient>
          </defs>
          <path
            d={`M ${12} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - 12} ${size / 2}`}
            fill="none"
            stroke="rgba(120,160,220,0.12)"
            strokeWidth="10"
            strokeLinecap="round"
          />
          <path
            d={`M ${12} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - 12} ${size / 2}`}
            fill="none"
            stroke={`url(#grad-${label})`}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{
              transition: 'stroke-dashoffset 0.1s linear',
              filter: `drop-shadow(0 0 6px ${c.glow})`,
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
          <span className={`font-mono text-2xl font-bold ${c.text}`} style={{ textShadow: `0 0 10px ${c.glow}` }}>
            {Math.round(displayValue)}
            <span className="text-sm opacity-60">%</span>
          </span>
        </div>
      </div>
      <div className="text-center">
        <div className="text-xs font-semibold text-slate-200">{label}</div>
        {sublabel && <div className="text-[10px] text-slate-500 mt-0.5">{sublabel}</div>}
      </div>
    </div>
  );
}

interface ThreatGaugeProps {
  level: ThreatLevel;
  overall: number;
}

const LEVEL_MAP: Record<ThreatLevel, { ko: string; color: GaugeProps['color']; ring: string }> = {
  safe: { ko: '안전', color: 'emerald', ring: 'glow-emerald' },
  caution: { ko: '주의', color: 'amber', ring: 'glow-amber' },
  danger: { ko: '위험', color: 'red', ring: 'glow-red' },
  critical: { ko: '심각', color: 'red', ring: 'glow-red' },
};

export function ThreatGauge({ level, overall }: ThreatGaugeProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const cfg = LEVEL_MAP[level];
  const c = COLOR_MAP[cfg.color];

  useEffect(() => {
    const target = overall;
    let raf: number;
    const start = displayValue;
    const startTime = performance.now();
    const duration = 1000;
    const animate = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayValue(start + (target - start) * eased);
      if (t < 1) raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overall]);

  const size = 170;
  const radius = (size - 28) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(1, Math.max(0, displayValue / 100));
  const arcLen = circumference * 0.75; // 270deg arc
  const fgDash = arcLen * pct;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`relative rounded-full ${cfg.ring} p-1`} style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-[135deg]">
          <defs>
            <linearGradient id="threat-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="50%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#ef4444" />
            </linearGradient>
          </defs>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(120,160,220,0.1)"
            strokeWidth="8"
            strokeDasharray={`${arcLen} ${circumference}`}
            strokeLinecap="round"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={`url(#threat-grad)`}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${fgDash} ${circumference}`}
            style={{
              transition: 'stroke-dasharray 0.1s linear',
              filter: `drop-shadow(0 0 8px ${c.glow})`,
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={`font-mono text-3xl font-bold ${c.text}`}
            style={{ textShadow: `0 0 12px ${c.glow}` }}
          >
            {cfg.ko}
          </span>
          <span className="font-mono text-sm text-slate-400 mt-1">{Math.round(displayValue)}/100</span>
        </div>
      </div>
      <div className="text-xs font-semibold text-slate-200">종합 위협등급</div>
    </div>
  );
}
