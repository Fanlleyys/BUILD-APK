import React, { useState } from 'react';
import { Github, Play, Loader2, Download, CheckCircle2, AlertTriangle, Settings2, Image as ImageIcon, Smartphone, Monitor } from 'lucide-react';
import { BuildStatus } from '../types';

interface BuildFormProps {
  onBuild: (data: any) => void;
  status: BuildStatus;
  apkUrl?: string;
}

export const BuildForm: React.FC<BuildFormProps> = ({ onBuild, status, apkUrl }) => {
  const [url, setUrl] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  
  // --- STATE SETTINGAN ---
  const [appName, setAppName] = useState('KataSensei'); // Nama Default
  const [appId, setAppId] = useState('com.katasensei.app');
  const [orientation, setOrientation] = useState('portrait');
  
  // Default FALSE biar ada Status Bar (Kayak InDrive/WA)
  const [fullscreen, setFullscreen] = useState(false); 
  
  const [iconUrl, setIconUrl] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      // Kirim data lengkap ke App.tsx
      onBuild({
        repoUrl: url,
        appName,
        appId,
        orientation,
        fullscreen,
        iconUrl
      });
    }
  };

  const isLoading = status !== BuildStatus.IDLE && status !== BuildStatus.SUCCESS && status !== BuildStatus.ERROR;

  return (
    <div className="w-full max-w-2xl mx-auto space-y-8">
      <div className="bg-zinc-900/80 p-6 md:p-8 rounded-2xl border border-zinc-800/50 backdrop-blur-xl shadow-2xl relative overflow-hidden">
        
        <form onSubmit={handleSubmit} className="relative z-10 space-y-6">
          {/* 1. INPUT REPO URL */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-zinc-300 ml-1">GitHub Repository URL</label>
            <div className="relative group/input">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Github className="h-5 w-5 text-zinc-500" />
              </div>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://github.com/username/project"
                className="block w-full pl-12 pr-4 py-4 bg-zinc-950/50 border border-zinc-700/50 rounded-xl text-zinc-100 focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition-all"
                disabled={isLoading}
                required
              />
            </div>
          </div>

          {/* 2. TOMBOL TOGGLE SETTINGS */}
          <button 
            type="button"
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-2 text-sm text-zinc-400 hover:text-brand-400 transition-colors"
          >
            <Settings2 className="h-4 w-4" />
            {showSettings ? 'Hide App Settings' : 'Show App Settings (Name, Icon, Layout)'}
          </button>

          {/* 3. MENU SETTINGS (Muncul kalau diklik) */}
          {showSettings && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-zinc-950/30 rounded-xl border border-zinc-800/50 animate-in slide-in-from-top-2">
                
                {/* App Name */}
                <div className="space-y-1">
                    <label className="text-xs text-zinc-400">App Name</label>
                    <input 
                        type="text" 
                        value={appName} 
                        onChange={e => setAppName(e.target.value)} 
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:border-brand-500 outline-none" 
                    />
                </div>

                {/* App ID */}
                <div className="space-y-1">
                    <label className="text-xs text-zinc-400">Package ID</label>
                    <input 
                        type="text" 
                        value={appId} 
                        onChange={e => setAppId(e.target.value)} 
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-400 focus:border-brand-500 outline-none" 
                    />
                </div>

                {/* Orientation */}
                <div className="space-y-1">
                    <label className="text-xs text-zinc-400">Orientation</label>
                    <div className="relative">
                        <Smartphone className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                        <select 
                            value={orientation} 
                            onChange={e => setOrientation(e.target.value)} 
                            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:border-brand-500 outline-none appearance-none"
                        >
                            <option value="portrait">Portrait (Berdiri)</option>
                            <option value="landscape">Landscape (Tidur)</option>
                            <option value="user">Auto (Ikut HP)</option>
                        </select>
                    </div>
                </div>

                {/* Fullscreen Toggle (YANG KAMU CARI) */}
                <div className="flex items-center justify-between bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2">
                    <div className="flex flex-col">
                        <label className="text-xs text-zinc-300 font-medium flex items-center gap-1">
                            <Monitor className="h-3 w-3" /> Immersive Mode
                        </label>
                        <span className="text-[10px] text-zinc-500">
                            {fullscreen 
                                ? 'ON: Hides Status Bar (Game Style)' 
                                : 'OFF: Shows Status Bar (Standard Style)'}
                        </span>
                    </div>
                    <input 
                        type="checkbox" 
                        checked={fullscreen} 
                        onChange={e => setFullscreen(e.target.checked)} 
                        className="accent-brand-500 h-5 w-5 cursor-pointer" 
                    />
                </div>

                {/* Icon URL */}
                <div className="col-span-1 md:col-span-2 space-y-1">
                    <label className="text-xs text-zinc-400 flex items-center gap-1">
                        <ImageIcon className="h-3 w-3"/> Icon URL (Direct Link PNG/JPG)
                    </label>
                    <input 
                        type="url" 
                        value={iconUrl} 
                        onChange={e => setIconUrl(e.target.value)} 
                        placeholder="https://i.imgur.com/your-logo.png" 
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:border-brand-500 outline-none" 
                    />
                </div>
            </div>
          )}

          {/* 4. TOMBOL SUBMIT */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-2">
            <div className="flex items-start gap-2 text-xs text-amber-500/80 bg-amber-950/20 px-3 py-2 rounded-lg border border-amber-500/10 max-w-sm">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <p>Build takes ~3-5 mins. Keep tab open.</p>
            </div>

            <button
              type="submit"
              disabled={isLoading || !url}
              className={`w-full md:w-auto flex items-center justify-center px-8 py-3.5 rounded-xl text-sm font-bold text-white transition-all shadow-lg 
                ${isLoading || !url 
                  ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 hover:shadow-brand-500/40'}`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                  Building...
                </>
              ) : (
                <>
                  <Play className="-ml-1 mr-2 h-4 w-4 fill-current" />
                  Generate APK
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* 5. HASIL DOWNLOAD */}
      {status === BuildStatus.SUCCESS && apkUrl && (
        <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-8 flex flex-col md:flex-row items-center justify-between gap-6 animate-in slide-in-from-bottom-4">
          <div className="flex items-center gap-5">
            <div className="p-4 bg-emerald-500/20 rounded-full ring-1 ring-emerald-500/50">
              <CheckCircle2 className="h-8 w-8 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-emerald-400">Build Complete!</h3>
              <p className="text-sm text-emerald-200/60 mt-1">Your custom APK is ready.</p>
            </div>
          </div>
          <a 
            href={apkUrl} 
            download 
            className="w-full md:w-auto flex items-center justify-center gap-2 px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold rounded-xl transition-all shadow-lg hover:shadow-emerald-500/40"
          >
            <Download className="h-5 w-5" />
            DOWNLOAD APK
          </a>
        </div>
      )}
    </div>
  );
};