import React, { useState, useCallback } from 'react';
import { BuildForm } from './components/BuildForm';
import { Terminal } from './components/Terminal';
import LightRays from './components/LightRays';
import BlurText from './components/BlurText';
import { QuickChips, HowItWorks, TechSpecs } from './components/GuideSection';
import TargetCursor from './components/TargetCursor';
import { BuildStatus, LogEntry } from './types';
import { Layers, Download, Zap, ShieldCheck, Cpu } from 'lucide-react';

const ENV_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
const FALLBACK_URL = 'https://fanlley-apk-builder.hf.space';
const API_BASE_URL = (ENV_URL || FALLBACK_URL).replace(/\/$/, '');

export default function App() {
  const [status, setStatus] = useState<BuildStatus>(BuildStatus.IDLE);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [apkUrl, setApkUrl] = useState<string | undefined>(undefined);

  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    setLogs((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(7),
        timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
        message,
        type,
      },
    ]);
  }, []);

  const handleBuild = async (formData: any) => {
    setStatus(BuildStatus.CLONING);
    setLogs([]);
    setApkUrl(undefined);
    
    addLog(`Initiating build sequence for: ${formData.repoUrl}`, 'info');
    addLog(`Target: ${formData.appName} (v${formData.versionName}) | Mode: ${formData.fullscreen ? 'Immersive' : 'Standard'}`, 'warning');

    try {
      addLog(`Establishing secure connection to ${API_BASE_URL}...`, 'info');
      
      // ✅ PERBAIKAN: Ganti EventSource (GET) jadi Fetch (POST)
      // Biar bisa kirim gambar Base64 yang panjang tanpa error URL limit
      const response = await fetch(`${API_BASE_URL}/api/build/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          repoUrl: formData.repoUrl,
          appName: formData.appName || 'My App',
          appId: formData.appId || 'com.appbuilder.generated',
          orientation: formData.orientation || 'portrait',
          fullscreen: formData.fullscreen, // Kirim boolean langsung aman di JSON
          iconUrl: formData.iconUrl || '', // Base64 aman dikirim lewat body
          versionCode: formData.versionCode || '1',
          versionName: formData.versionName || '1.0'
        }),
      });

      if (!response.ok) {
        throw new Error(`Server Error: ${response.statusText}`);
      }

      if (!response.body) throw new Error("ReadableStream not supported in this browser.");

      // ✅ LOGIKA BACA STREAM MANUAL (Pengganti onmessage EventSource)
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n'); // SSE biasanya dipisah double newline
        buffer = lines.pop() || ''; // Simpan sisa potongan yang belum lengkap

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.replace('data: ', '').trim();
            if (jsonStr === '[DONE]') break; // Sinyal selesai dari server (opsional)

            try {
              const data = JSON.parse(jsonStr);
              
              // Logic sama persis kayak sebelumnya
              if (data.type === 'log') {
                addLog(data.log.message, data.log.type);
              } else if (data.type === 'status') {
                const statusMap: Record<string, BuildStatus> = {
                    'CLONING': BuildStatus.CLONING,
                    'INSTALLING': BuildStatus.INSTALLING,
                    'BUILDING_WEB': BuildStatus.BUILDING_WEB,
                    'CAPACITOR_INIT': BuildStatus.CAPACITOR_INIT,
                    'ANDROID_SYNC': BuildStatus.ANDROID_SYNC,
                    'COMPILING_APK': BuildStatus.COMPILING_APK,
                    'SUCCESS': BuildStatus.SUCCESS,
                    'ERROR': BuildStatus.ERROR
                };
                if(statusMap[data.status]) setStatus(statusMap[data.status]);
                
              } else if (data.type === 'result') {
                if (data.success) {
                  setApkUrl(data.downloadUrl);
                  setStatus(BuildStatus.SUCCESS);
                  addLog('Build pipeline completed successfully. Artifact ready.', 'success');
                } else {
                  setStatus(BuildStatus.ERROR);
                  addLog(`Build pipeline failed: ${data.error}`, 'error');
                }
              } else if (data.type === 'error') {
                 setStatus(BuildStatus.ERROR);
                 addLog(data.message, 'error');
              }
            } catch (e) {
              console.error('Error parsing stream chunk', e);
            }
          }
        }
      }

    } catch (error: any) {
      setStatus(BuildStatus.ERROR);
      addLog(`Connection failed: ${error.message || 'Unknown error'}`, 'error');
      console.error(error);
    }
  };

  return (
    <div className="min-h-screen bg-[#030305] text-zinc-100 selection:bg-brand-500/30 relative overflow-x-hidden font-sans">
      
      <TargetCursor spinDuration={4} hideDefaultCursor={true} parallaxOn={true} />

      <div className="fixed inset-0 z-0 pointer-events-none">
         <LightRays raysOrigin="top-center" raysColor="#6366f1" raysSpeed={1.0} lightSpread={2.5} rayLength={1.5} followMouse={true} mouseInfluence={0.2} noiseAmount={0.03} distortion={0.1} />
      </div>
      <div className="fixed top-[-10%] left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-brand-500/15 blur-[120px] rounded-full pointer-events-none z-0"></div>

      {/* === HEADER === */}
      <header className="border-b border-white/5 bg-black/20 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-14 md:h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 group cursor-pointer">
            <div className="p-1.5 md:p-2 bg-gradient-to-br from-brand-500 to-indigo-600 rounded-xl shadow-lg shadow-brand-500/30 group-hover:shadow-brand-500/50 transition-all">
                <Layers className="h-4 w-4 md:h-5 md:w-5 text-white" />
            </div>
            <span className="text-lg md:text-xl font-bold tracking-tight">AppBuilder<span className="text-brand-400">.AI</span></span>
          </div>
          
          <div className="hidden md:flex items-center gap-6 text-xs font-mono text-zinc-400">
             <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4" />
                <span>v2.0.4-beta</span>
             </div>
             <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>Systems Operational</span>
             </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-5xl mx-auto px-4 py-8 md:py-16">
        
        {/* === HERO SECTION === */}
        <div className="text-center mb-10 md:mb-16 space-y-4 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-full bg-brand-500/10 border border-brand-500/20 text-xs md:text-sm text-brand-200 mb-2 md:mb-4 hover:bg-brand-500/20 transition-colors cursor-default shadow-[0_0_20px_rgba(99,102,241,0.2)]">
            <Zap className="w-3 h-3 md:w-4 md:h-4 text-yellow-300 fill-yellow-300" />
            <span>Powered by CapacitorJS</span>
          </div>
          
          <h1 className="text-4xl md:text-7xl font-extrabold tracking-tight drop-shadow-2xl flex flex-wrap justify-center gap-x-2 md:gap-x-4 gap-y-1">
             <BlurText 
                text="Web to APK" 
                delay={150} 
                animateBy="words" 
                direction="top" 
                className="text-white"
             />
             <BlurText 
                text="Generator" 
                delay={500}
                animateBy="words" 
                direction="top" 
                className="text-indigo-400 drop-shadow-[0_0_15px_rgba(129,140,248,0.6)]"
             />
          </h1>

          <p className="text-zinc-300 text-sm md:text-xl max-w-2xl mx-auto leading-relaxed px-2">
            Transform your React, Vue, or Angular projects into production-ready Android applications in minutes.
          </p>

          <QuickChips />
        </div>

        {/* === FORM WIZARD === */}
        <BuildForm onBuild={handleBuild} status={status} apkUrl={apkUrl} />

        {/* === RESULT AREA === */}
        {(status !== BuildStatus.IDLE || logs.length > 0) && (
            <div className="space-y-8 mt-12">
                {status === BuildStatus.SUCCESS && apkUrl && (
                    <div className="animate-in zoom-in-95 duration-500 bg-gradient-to-r from-emerald-900/40 to-black border border-emerald-500/30 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-[0_0_50px_rgba(16,185,129,0.1)]">
                        <div className="flex items-start gap-4 text-center md:text-left flex-col md:flex-row items-center md:items-start">
                            <div className="p-3 bg-emerald-500/20 rounded-2xl border border-emerald-500/30">
                                <ShieldCheck className="w-8 h-8 text-emerald-400" />
                            </div>
                            <div>
                                <h3 className="text-xl md:text-2xl font-bold text-white mb-1">Build Successful!</h3>
                                <p className="text-emerald-200/60 text-sm md:text-base">Your APK has been compiled, signed, and is ready.</p>
                            </div>
                        </div>
                        <a 
                            href={apkUrl} 
                            className="cursor-target w-full md:w-auto px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-lg rounded-xl flex items-center justify-center gap-3 transition-all hover:scale-105 shadow-lg shadow-emerald-500/20"
                        >
                            <Download className="w-5 h-5" /> 
                            Download APK
                        </a>
                    </div>
                )}
                <Terminal logs={logs} status={status} />
            </div>
        )}

        <HowItWorks />
        <TechSpecs />

      </main>
      
      <footer className="py-8 text-center text-zinc-600 text-xs md:text-sm relative z-10">
        <p>&copy; 2025 AppBuilder AI. All systems nominal.</p>
      </footer>
    </div>
  );
}