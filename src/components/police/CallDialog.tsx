import { useEffect, useRef, useState } from 'react';
import { Lock, Phone, PhoneCall, ShieldCheck, X } from 'lucide-react';

interface CallDialogProps {
  phone: string;
  onClose: () => void;
  onConnected: () => void;
}

type CallState = 'connecting' | 'connected';

export default function CallDialog({ phone, onClose, onConnected }: CallDialogProps) {
  const [state, setState] = useState<CallState>('connecting');
  const [elapsed, setElapsed] = useState(0);
  const [closing, setClosing] = useState(false);

  const onConnectedRef = useRef(onConnected);
  const onCloseRef = useRef(onClose);
  const closedRef = useRef(false);

  onConnectedRef.current = onConnected;
  onCloseRef.current = onClose;

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    let connectTimer: ReturnType<typeof setTimeout> | null = null;
    let closeTimer: ReturnType<typeof setTimeout> | null = null;

    // 1-second interval — created once, cleaned up on unmount
    timer = setInterval(() => {
      setElapsed((e) => e + 1);
    }, 1000);

    // After 3 seconds, switch to connected
    connectTimer = setTimeout(() => {
      setState('connected');
      if (!closedRef.current) {
        onConnectedRef.current();
      }
      // Auto-close after 2 more seconds
      closeTimer = setTimeout(() => {
        if (!closedRef.current) {
          closedRef.current = true;
          setClosing(true);
          setTimeout(() => onCloseRef.current(), 400);
        }
      }, 2000);
    }, 3000);

    return () => {
      if (timer) clearInterval(timer);
      if (connectTimer) clearTimeout(connectTimer);
      if (closeTimer) clearTimeout(closeTimer);
    };
  }, []);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const handleClose = () => {
    if (closedRef.current) return;
    closedRef.current = true;
    setClosing(true);
    setTimeout(() => onCloseRef.current(), 300);
  };

  return (
    <div
      className={`fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md transition-opacity duration-300 ${
        closing ? 'opacity-0' : 'opacity-100'
      }`}
      onClick={state === 'connected' ? handleClose : undefined}
    >
      <div
        className="glass-strong rounded-2xl w-full max-w-sm overflow-hidden animate-modal-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
              state === 'connected'
                ? 'bg-emerald-500/15 border-emerald-500/30'
                : 'bg-blue-500/15 border-blue-500/30'
            }`}>
              {state === 'connected' ? (
                <PhoneCall className="w-4 h-4 text-emerald-300" />
              ) : (
                <Phone className="w-4 h-4 text-blue-300" />
              )}
            </div>
            <div>
              <p className="text-sm font-bold text-slate-100">
                {state === 'connected' ? '통화 연결 됨' : '신고자 긴급 연결'}
              </p>
              <p className="text-[10px] font-mono text-slate-500">
                {state === 'connected' ? formatTime(elapsed) : '연결 중...'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
            aria-label="닫기"
          >
            <X className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-6 flex flex-col items-center gap-4">
          {/* Timer display */}
          <div className="relative">
            {state === 'connecting' ? (
              <div className="flex items-center gap-2 text-blue-300">
                <Lock className="w-4 h-4" />
                <span className="font-mono text-lg font-bold">
                  [{formatTime(elapsed)}]
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-emerald-300">
                <PhoneCall className="w-4 h-4" />
                <span className="font-mono text-lg font-bold">
                  [{formatTime(elapsed)}]
                </span>
              </div>
            )}
            {state === 'connecting' && (
              <div className="absolute -inset-3 rounded-full border border-blue-400/20 animate-pulse-ring" />
            )}
          </div>

          {/* Phone number */}
          <div className="text-center">
            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wide">신고자</p>
            <p className="text-base font-mono font-bold text-slate-100 mt-0.5">{phone}</p>
          </div>

          {/* Status text */}
          {state === 'connecting' ? (
            <p className="text-xs text-slate-400 text-center leading-relaxed">
              보안 암호화 라인으로 통화 연결 중입니다.<br />
              통화 내용이 실시간 기록됩니다.
            </p>
          ) : (
            <p className="text-xs text-emerald-300 text-center leading-relaxed">
              통화가 연결되었습니다. 보안 통화가 시작되었습니다.
            </p>
          )}

          {/* Animated dots while connecting */}
          {state === 'connecting' && (
            <div className="flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-2 h-2 rounded-full bg-blue-400 animate-blink"
                  style={{ animationDelay: `${i * 0.2}s` }}
                />
              ))}
            </div>
          )}

          {/* Security badge */}
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-600">
            <ShieldCheck className="w-3 h-3" />
            End-to-End Encrypted
          </div>
        </div>

        {/* Footer */}
        {state === 'connected' && (
          <div className="px-5 pb-4">
            <button
              onClick={handleClose}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-red-500/15 border border-red-500/30 py-2.5 text-sm font-medium text-red-200 hover:bg-red-500/20 transition-colors"
            >
              <PhoneCall className="w-4 h-4" />
              통화 종료
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
