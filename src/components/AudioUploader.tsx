import { useRef, useState } from 'react';
import { FileAudio, Upload, X } from 'lucide-react';

interface AudioUploaderProps {
  onFile: (file: File) => void;
  selectedFileName: string | null;
  onClear: () => void;
  disabled?: boolean;
}

export default function AudioUploader({ onFile, selectedFileName, onClear, disabled }: AudioUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    const okTypes = ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/m4a', 'audio/x-m4a', 'audio/mp4', 'audio/aac'];
    const okExt = /\.(mp3|wav|m4a|aac)$/i.test(file.name);
    if (!okTypes.includes(file.type) && !okExt) {
      alert('지원 형식: .mp3, .wav, .m4a');
      return;
    }
    onFile(file);
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept=".mp3,.wav,.m4a,.aac,audio/*"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      {!selectedFileName ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFiles(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          className={`group relative cursor-pointer rounded-2xl border-2 border-dashed transition-all duration-300 p-8 text-center
            ${
              dragOver
                ? 'border-cyan-400 bg-cyan-400/5 glow-cyan'
                : 'border-white/10 hover:border-cyan-400/40 hover:bg-cyan-400/5'
            }
            ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
        >
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center border border-cyan-400/20">
                <Upload className="w-6 h-6 text-cyan-300" />
              </div>
              <div className="absolute inset-0 rounded-2xl bg-cyan-400/10 animate-pulse-ring" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-200">오디오 파일 드래그 앤 드롭</p>
              <p className="text-xs text-slate-500 mt-1">또는 클릭하여 파일 선택 · .mp3 · .wav · .m4a</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-4 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center shrink-0">
            <FileAudio className="w-5 h-5 text-cyan-300" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-200 truncate">{selectedFileName}</p>
            <p className="text-xs text-slate-500">업로드 완료 · 분석 준비됨</p>
          </div>
          <button
            onClick={onClear}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-red-500/20 flex items-center justify-center transition-colors shrink-0"
            aria-label="파일 제거"
          >
            <X className="w-4 h-4 text-slate-400 hover:text-red-400" />
          </button>
        </div>
      )}
    </div>
  );
}
