import React, { useRef, useState } from 'react';
import { Terminal as TerminalIcon, X, Minus, Square, CheckCircle2, AlertCircle, Loader2, Copy, Check } from 'lucide-react';
import { BuildStatus, LogEntry } from '../types';

interface TerminalProps {
  logs: LogEntry[];
  status: BuildStatus;
}

const getProgress = (status: BuildStatus) => {
  switch (status) {
    case BuildStatus.IDLE: return 0;
    case BuildStatus.CLONING: return 10;
    case BuildStatus.INSTALLING: return 30;
    case BuildStatus.BUILDING_WEB: return 50;
    case BuildStatus.CAPACITOR_INIT: return 65;
    case BuildStatus.ANDROID_SYNC: return 80;
    case BuildStatus.COMPILING_APK: return 90;
    case BuildStatus.SUCCESS: return 100;
    case BuildStatus.ERROR: return 100;
    default: return 0;
  }
};

export const Terminal: React.FC<TerminalProps> = ({ logs, status }) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false); // State buat feedback copy
  const progress = getProgress(status);

  // ✅ Fungsi Copy Log
  const handleCopyLogs = async () => {
    if (logs.length === 0) return;

    // Gabungin semua log jadi satu string rapi
    const logText = logs.map(l => `[${l.timestamp}] ${l.message}`).join('\n');

    try {
      await navigator.clipboard.writeText(logText);
      setCopied(true);
      
      // Balikin tombol jadi normal setelah 2 detik
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy logs', err);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto mt-8 animate-in slide-in-from-bottom-10 duration-700">
      
      {/* === STATUS BAR & PROGRESS === */}
      <div className="mb-4 flex items-center justify-between text-xs font-mono uppercase tracking-widest text-zinc-500">
        <span className="flex items-center gap-2">
            {status === BuildStatus.SUCCESS ? <CheckCircle2 className="text-emerald-500 w-4 h-4" /> : 
             status === BuildStatus.ERROR ? <AlertCircle className="text-red-500 w-4 h-4" /> :
             <Loader2 className="animate-spin w-4 h-4 text-brand-500" />}
            Status: <span className="text-zinc-300">{status.replace(/_/g, ' ')}</span>
        </span>
        <span>{progress}% Complete</span>
      </div>

      {/* Progress Bar Line */}
      <div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden mb-6 relative">
        <div 
            className={`h-full transition-all duration-1000 ease-out ${status === BuildStatus.ERROR ? 'bg-red-600' : status === BuildStatus.SUCCESS ? 'bg-emerald-500' : 'bg-brand-500'}`}
            style={{ width: `${progress}%` }}
        >
            <div className="absolute top-0 right-0 bottom-0 w-20 bg-gradient-to-r from-transparent to-white/50 blur-sm transform translate-x-full animate-[loading_2s_infinite]"></div>
        </div>
      </div>

      {/* === TERMINAL WINDOW === */}
      <div className="rounded-xl overflow-hidden border border-zinc-800 bg-[#0c0c0c]/90 backdrop-blur-xl shadow-2xl shadow-black/50 font-mono text-sm relative group">
        
        {/* Terminal Header */}
        <div className="bg-zinc-900/80 border-b border-white/5 px-4 py-2 flex items-center justify-between select-none">
            {/* Kiri: Window Controls Decoration */}
            <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/80 hover:bg-red-500 transition-colors shadow-[0_0_8px_rgba(239,68,68,0.4)]" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80 hover:bg-yellow-500 transition-colors shadow-[0_0_8px_rgba(234,179,8,0.4)]" />
                <div className="w-3 h-3 rounded-full bg-green-500/80 hover:bg-green-500 transition-colors shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
            </div>

            {/* Tengah: Title */}
            <div className="flex items-center gap-2 text-zinc-500 text-xs absolute left-1/2 -translate-x-1/2">
                <TerminalIcon className="w-3 h-3" />
                <span>build_server.exe — ssh root@builder-ai</span>
            </div>

            {/* Kanan: Copy Button & Controls */}
            <div className="flex items-center gap-4">
                {/* ✅ TOMBOL COPY LOG */}
                <button 
                    onClick={handleCopyLogs}
                    disabled={logs.length === 0}
                    className="flex items-center gap-1.5 text-[10px] font-medium text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Copy all logs to clipboard"
                >
                    {copied ? (
                        <>
                            <Check className="w-3 h-3 text-emerald-500" />
                            <span className="text-emerald-500">Copied</span>
                        </>
                    ) : (
                        <>
                            <Copy className="w-3 h-3" />
                            <span>Copy Log</span>
                        </>
                    )}
                </button>

                {/* Divider Kecil */}
                <div className="w-px h-3 bg-zinc-700/50"></div>

                {/* Fake Window Controls */}
                <div className="flex gap-3 text-zinc-600">
                    <Minus className="w-3 h-3 cursor-pointer hover:text-white" />
                    <Square className="w-3 h-3 cursor-pointer hover:text-white" />
                    <X className="w-3 h-3 cursor-pointer hover:text-white" />
                </div>
            </div>
        </div>

        {/* Terminal Body */}
        <div className="p-4 h-[400px] overflow-y-auto space-y-1 
            scrollbar-thin 
            [&::-webkit-scrollbar]:w-1.5 
            [&::-webkit-scrollbar-track]:bg-transparent 
            [&::-webkit-scrollbar-thumb]:bg-zinc-800 
            [&::-webkit-scrollbar-thumb]:rounded-full 
            [&::-webkit-scrollbar-thumb]:hover:bg-zinc-700"
        >
            {logs.length === 0 && (
                <div className="text-zinc-600 italic opacity-50">Waiting for command...</div>
            )}
            
            {logs.map((log) => (
                <div key={log.id} className="flex gap-2 animate-in fade-in slide-in-from-left-2 duration-300">
                    <span className="text-zinc-600 shrink-0 select-none">[{log.timestamp}]</span>
                    <div className="flex gap-2 break-all">
                        <span className="text-zinc-700 select-none">➜</span>
                        <span className={`
                            ${log.type === 'error' ? 'text-red-400 font-bold' : ''}
                            ${log.type === 'success' ? 'text-emerald-400 font-bold' : ''}
                            ${log.type === 'warning' ? 'text-yellow-400' : ''}
                            ${log.type === 'info' ? 'text-zinc-300' : ''}
                        `}>
                            {log.message}
                        </span>
                    </div>
                </div>
            ))}
            
            {status !== BuildStatus.SUCCESS && status !== BuildStatus.ERROR && (
                <div className="flex items-center gap-2 mt-2">
                    <span className="text-brand-500">➜</span>
                    <span className="w-2.5 h-5 bg-brand-500/50 animate-pulse"></span>
                </div>
            )}
            
            <div ref={bottomRef} />
        </div>

        {/* Scanline Effect */}
        <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-20 bg-[length:100%_2px,3px_100%] opacity-20"></div>
      </div>
    </div>
  );
};