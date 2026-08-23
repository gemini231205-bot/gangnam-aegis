import { useEffect, useRef } from 'react';
import type { LogEntry } from '@/types';
import { Activity, AlertTriangle, CheckCircle2, Info, Shield } from 'lucide-react';

interface TerminalConsoleProps {
  logs: LogEntry[];
  isStreaming: boolean;
}

const AGENT_META: Record<
  LogEntry['agent'],
  { color: string; icon: typeof Info }
> = {
  acoustic: { color: 'text-cyan-300', icon: Activity },
  semantic: { color: 'text-amber-300', icon: AlertTriangle },
  action: { color: 'text-emerald-300', icon: Shield },
};

const LEVEL_COLOR: Record<LogEntry['level'], string> = {
  info: 'text-slate-300',
  warn: 'text-amber-400',
  alert: 'text-red-400',
  success: 'text-emerald-400',
};

export default function TerminalConsole({ logs, isStreaming }: TerminalConsoleProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/70" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
          </div>
          <span className="font-mono text-xs text-slate-400 ml-2">agent-console@aegis:~$</span>
        </div>
        <div className="flex items-center gap-1.5">
          {isStreaming ? (
            <span className="flex items-center gap-1.5 text-[10px] font-mono text-cyan-300">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              STREAMING
            </span>
          ) : (
            <span className="text-[10px] font-mono text-slate-600">IDLE</span>
          )}
        </div>
      </div>
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto scrollbar-slim px-4 py-3 font-mono text-xs space-y-1.5 min-h-0"
      >
        {logs.length === 0 && !isStreaming && (
          <div className="text-slate-600 italic">
            에이전트 대기 중… 오디오를 업로드하거나 프리셋을 선택한 후 분석을 실행하세요.
          </div>
        )}
        {logs.map((log) => {
          const meta = AGENT_META[log.agent];
          const Icon = meta.icon;
          return (
            <div key={log.id} className="flex items-start gap-2 animate-fade-in-up">
              <span className="text-slate-600 shrink-0">{log.timestamp}</span>
              <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${meta.color}`} />
              <span className={`shrink-0 font-semibold ${meta.color}`}>[{log.agentLabel}]</span>
              <span className={`break-words ${LEVEL_COLOR[log.level]}`}>{log.message}</span>
            </div>
          );
        })}
        {isStreaming && (
          <div className="flex items-center gap-2 text-cyan-300">
            <span className="w-2 h-4 bg-cyan-400 animate-blink" />
          </div>
        )}
      </div>
    </div>
  );
}
