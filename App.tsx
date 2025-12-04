import React, { useState, useCallback } from 'react';
import { BuildForm } from './components/BuildForm';
import { Terminal } from './components/Terminal';
import { StatusSteps } from './components/StatusSteps';
import { BuildStatus, LogEntry } from './types';
import { Layers, Rocket, Code2, Cpu } from 'lucide-react';

// Live Hugging Face Backend URL
const API_BASE_URL = 'https://fanlley-apk-builder.hf.space';

export default function App() {
  const [status, setStatus] = useState<BuildStatus>(BuildStatus.IDLE);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [apkUrl, setApkUrl] = useState<string | undefined>(undefined);

  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    setLogs((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(7),
        timestamp: new Date().toLocaleTimeString(),
        message,
        type,
      },
    ]);
  }, []);

  const handleBuild = async (repoUrl: string) => {
    // Reset state
    setStatus(BuildStatus.CLONING);
    setLogs([]);
    setApkUrl(undefined);
    addLog(`Initiating build for: ${repoUrl}`, 'info');

    // Real Backend Connection via SSE
    try {
      addLog(`Connecting to Build Server at ${API_BASE_URL}...`, 'info');
      
      const eventSource = new EventSource(`${API_BASE_URL}/api/build/stream?repoUrl=${encodeURIComponent(repoUrl)}`);

      eventSource.onopen = () => {
        addLog('Connected to Cloud Build Engine.', 'success');
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'log') {
            addLog(data.log.message, data.log.type);
          } else if (data.type === 'status') {
            setStatus(data.status as BuildStatus);
          } else if (data.type === 'result') {
            if (data.success) {
              setApkUrl(data.downloadUrl);
              addLog('Build completed successfully!', 'success');
            } else {
              setStatus(BuildStatus.ERROR);
              addLog(`Build failed: ${data.error}`, 'error');
            }
            eventSource.close();
          } else if (data.type === 'error') {
             setStatus(BuildStatus.ERROR);
             addLog(data.message, 'error');
             eventSource.close();
          }
        } catch (e) {
          console.error('Error parsing SSE data', e);
        }
      };

      eventSource.onerror = (err) => {
        console.error('EventSource failed:', err);
        eventSource.close();
        if (status !== BuildStatus.SUCCESS) {
          setStatus(BuildStatus.ERROR);
          addLog('Connection to build server failed or was interrupted.', 'error');
          addLog('Please check if the Hugging Face Space is running and awake.', 'info');
        }
      };

    } catch (error) {
      setStatus(BuildStatus.ERROR);
      addLog('Critical system error during build pipeline.', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900 via-zinc-950 to-black text-zinc-100 selection:bg-brand-500/30">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-950/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-gradient-to-tr from-brand-600 to-indigo-600 rounded-lg shadow-lg shadow-brand-500/20">
              <Layers className="h-6 w-6 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">
              AppBuilder<span className="text-brand-500">.AI</span>
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm font-medium text-zinc-400">
            <div className="flex items-center gap-1.5 hidden md:flex">
              <Code2 size={14} />
              <span>React</span>
            </div>
            <div className="flex items-center gap-1.5 hidden md:flex">
              <Cpu size={14} />
              <span>Node.js</span>
            </div>
            <div className="flex items-center gap-1.5 hidden md:flex">
              <Rocket size={14} />
              <span>Capacitor</span>
            </div>
            <div className="h-4 w-px bg-zinc-800 hidden md:block"></div>
            <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              Cloud Engine Ready
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12 space-y-4">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-4">
            Turn your <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-indigo-400">Web App</span> into an <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">APK</span>
          </h1>
          <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
            Automated CI/CD pipeline powered by Capacitor & Gradle. 
            Simply paste your GitHub repository URL, and we'll handle the build process.
          </p>
        </div>

        {/* Build Pipeline Visualization */}
        <StatusSteps currentStatus={status} />

        {/* Input Area */}
        <BuildForm onBuild={handleBuild} status={status} apkUrl={apkUrl} />

        {/* Terminal / Logs Area */}
        <div className="mt-12 max-w-5xl mx-auto">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-200">Build Logs</h2>
            <div className="flex gap-2">
               <span className="w-3 h-3 rounded-full bg-red-500 block"></span>
               <span className="w-3 h-3 rounded-full bg-yellow-500 block"></span>
               <span className="w-3 h-3 rounded-full bg-green-500 block"></span>
            </div>
          </div>
          <Terminal logs={logs} status={status} />
        </div>
      </main>
      
      <footer className="py-8 border-t border-zinc-900 mt-20 text-center text-zinc-600 text-sm">
        <p>© 2024 AppBuilder-AI. Powered by Node.js, Capacitor, and Gradle.</p>
      </footer>
    </div>
  );
}