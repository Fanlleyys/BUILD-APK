import React, { useState } from 'react';
import { Github, Play, Loader2, Download, CheckCircle2, AlertCircle } from 'lucide-react';
import { BuildStatus } from '../types';

interface BuildFormProps {
  onBuild: (url: string, isSimulated: boolean) => void;
  status: BuildStatus;
  apkUrl?: string;
}

export const BuildForm: React.FC<BuildFormProps> = ({ onBuild, status, apkUrl }) => {
  const [url, setUrl] = useState('');
  const [isSimulated, setIsSimulated] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onBuild(url, isSimulated);
    }
  };

  const isLoading = status !== BuildStatus.IDLE && status !== BuildStatus.SUCCESS && status !== BuildStatus.ERROR;

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      <div className="bg-zinc-900/50 p-6 rounded-xl border border-zinc-800 backdrop-blur-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm font-medium text-zinc-400 mb-1">
            GitHub Repository URL
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Github className="h-5 w-5 text-zinc-500" />
            </div>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://github.com/username/project-name"
              className="block w-full pl-10 pr-3 py-3 border border-zinc-700 rounded-lg leading-5 bg-zinc-950 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all"
              disabled={isLoading}
              required
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
               <label className="flex items-center space-x-2 text-xs text-zinc-500 cursor-pointer hover:text-zinc-300 transition-colors">
                <input 
                  type="checkbox" 
                  checked={isSimulated}
                  onChange={(e) => setIsSimulated(e.target.checked)}
                  className="rounded bg-zinc-800 border-zinc-700 text-brand-600 focus:ring-brand-500/50"
                />
                <span>Demo Simulation Mode (No Server Required)</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading || !url}
              className={`flex items-center justify-center px-6 py-2.5 rounded-lg text-sm font-semibold text-white transition-all shadow-lg
                ${isLoading || !url 
                  ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 hover:shadow-brand-500/25'
                }`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                  Building...
                </>
              ) : (
                <>
                  <Play className="-ml-1 mr-2 h-4 w-4 fill-current" />
                  Start Build
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {status === BuildStatus.SUCCESS && apkUrl && (
        <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-6 flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-500/20 rounded-full">
              <CheckCircle2 className="h-6 w-6 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-emerald-400">Build Successful!</h3>
              <p className="text-sm text-emerald-200/60">Your APK is ready for download.</p>
            </div>
          </div>
          <a
            href={apkUrl}
            download
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold rounded-lg transition-colors shadow-lg shadow-emerald-900/20"
          >
            <Download className="h-4 w-4" />
            Download APK
          </a>
        </div>
      )}

      {status === BuildStatus.ERROR && (
        <div className="bg-red-950/30 border border-red-500/30 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
          <p className="text-sm text-red-200">Build failed. Please check the logs above for details.</p>
        </div>
      )}
    </div>
  );
};