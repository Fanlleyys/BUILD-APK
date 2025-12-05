import React, { useState, useEffect } from 'react';
import { Github, Play, Loader2, ArrowRight, Monitor, Smartphone, LayoutTemplate, Box, CheckCircle2 } from 'lucide-react';
import { BuildStatus } from '../types';
import Stepper, { Step } from './Stepper';
import { BorderBeam } from './BorderBeam';

interface BuildFormProps {
  onBuild: (data: any) => void;
  status: BuildStatus;
  apkUrl?: string;
}

const generatePackageId = (appName: string): string => {
  const slug = appName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .substring(0, 20);
  return `com.${slug || 'myapp'}.app`;
};

export const BuildForm: React.FC<BuildFormProps> = ({ onBuild, status }) => {
  const [step, setStep] = useState(1); 
  
  const [url, setUrl] = useState('');
  const [appName, setAppName] = useState('KataSensei');
  const [appId, setAppId] = useState('com.katasensei.app');
  const [orientation, setOrientation] = useState('portrait');
  const [fullscreen, setFullscreen] = useState(false);
  const [iconUrl, setIconUrl] = useState('');
  const [versionCode, setVersionCode] = useState('1');
  const [versionName, setVersionName] = useState('1.0.0');

  useEffect(() => {
    if (step === 2) {
      setAppId(generatePackageId(appName)); 
    }
  }, [appName, step]);

  const handleNext = () => {
    if (step === 1 && url) setStep(2);
    else if (step === 2) setStep(3);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = () => {
    onBuild({
      repoUrl: url,
      appName,
      appId,
      orientation,
      fullscreen,
      iconUrl,
      versionCode,
      versionName
    });
  };

  const isLoading = status !== BuildStatus.IDLE && status !== BuildStatus.SUCCESS && status !== BuildStatus.ERROR;
  const isGithubUrl = url.includes('github.com');

  return (
    <div className="w-full max-w-4xl mx-auto mb-10">
      
      <div className="bg-zinc-900/40 rounded-3xl border border-white/10 backdrop-blur-xl shadow-2xl shadow-brand-500/5 overflow-hidden relative group">
        
        <BorderBeam size={300} duration={12} delay={9} borderWidth={1.5} colorFrom="#818cf8" colorTo="#c084fc" />

        {/* === PROGRESS HEADER === */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-white/5 bg-black/20 relative z-10">
            {[1, 2, 3].map((s) => (
                <div key={s} className="flex items-center gap-3 relative z-10">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-500 border-2 
                        ${step >= s 
                            ? 'bg-brand-600 border-brand-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)]' 
                            : 'bg-zinc-900 border-zinc-700 text-zinc-500'}`}>
                        {step > s ? <CheckCircle2 className="w-5 h-5" /> : s}
                    </div>
                    <div className="hidden md:block">
                        <span className={`text-xs font-bold uppercase tracking-wider block ${step >= s ? 'text-brand-400' : 'text-zinc-600'}`}>
                            Step {s}
                        </span>
                        <span className={`text-sm font-medium ${step >= s ? 'text-zinc-200' : 'text-zinc-600'}`}>
                            {s === 1 ? 'Repository' : s === 2 ? 'Configuration' : 'Build APK'}
                        </span>
                    </div>
                </div>
            ))}
            <div className="absolute left-10 right-10 top-11 h-0.5 bg-zinc-800 -z-0 hidden md:block"></div>
            <div 
                className="absolute left-10 top-11 h-0.5 bg-brand-600 -z-0 transition-all duration-500 hidden md:block shadow-[0_0_10px_#6366f1]"
                style={{ width: `${((step - 1) / 2) * 85}%` }} 
            ></div>
        </div>

        {/* === CONTENT BODY === */}
        <div className="p-6 md:p-10 min-h-[400px] relative z-10">
            <Stepper currentStep={step} className="transition-all duration-500">
                
                {/* === STEP 1: REPOSITORY === */}
                <Step>
                    <div className="space-y-8 max-w-2xl mx-auto py-4">
                        <div className="text-center space-y-3">
                            <h2 className="text-3xl font-bold text-white tracking-tight">Import from GitHub</h2>
                            <p className="text-zinc-400 text-lg">Paste your repository URL to start the magic.</p>
                        </div>
                        
                        <div className="relative group">
                            <div className="absolute -inset-1 bg-gradient-to-r from-brand-600 to-purple-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                                    <Github className={`h-6 w-6 transition-colors ${url ? 'text-brand-400' : 'text-zinc-500'}`} />
                                </div>
                                <input
                                    type="url"
                                    value={url}
                                    onChange={(e) => setUrl(e.target.value)}
                                    placeholder="https://github.com/username/project"
                                    className="block w-full pl-14 pr-4 py-6 bg-zinc-950/80 border border-zinc-800 rounded-2xl text-xl text-zinc-100 focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition-all placeholder-zinc-700 shadow-inner"
                                    autoFocus
                                />
                            </div>
                            {url && !isGithubUrl && (
                                <p className="text-red-400 text-sm mt-3 ml-2 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                                    Please enter a valid GitHub URL
                                </p>
                            )}
                        </div>

                        <div className="flex justify-center pt-4">
                            <button 
                                onClick={handleNext}
                                disabled={!url || !isGithubUrl}
                                // 👇 CLASS 'cursor-target'
                                className="cursor-target group relative px-8 py-4 bg-zinc-100 text-zinc-950 font-bold text-lg rounded-full hover:scale-105 transition-all disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed overflow-hidden"
                            >
                                <span className="relative z-10 flex items-center gap-2">
                                    Check Repository <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                                </span>
                                <div className="absolute inset-0 bg-gradient-to-r from-white to-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            </button>
                        </div>
                    </div>
                </Step>

                {/* === STEP 2: CONFIGURATION === */}
                <Step>
                    <div className="space-y-8">
                        <div className="flex items-center justify-between border-b border-white/5 pb-4">
                            <h2 className="text-2xl font-bold text-white">App Settings</h2>
                            <button onClick={handleBack} className="text-sm text-zinc-500 hover:text-brand-400 transition-colors">Change Repo</button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Left Col */}
                            <div className="space-y-6">
                                <div className="group">
                                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 block">Application Name</label>
                                    <input value={appName} onChange={e => setAppName(e.target.value)} className="w-full bg-zinc-900/50 border border-zinc-700/50 rounded-xl px-5 py-4 text-white focus:border-brand-500 focus:bg-zinc-900 outline-none transition-all text-lg" placeholder="My App" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 block">Package ID</label>
                                    <input value={appId} onChange={e => setAppId(e.target.value)} className="w-full bg-zinc-900/50 border border-zinc-700/50 rounded-xl px-5 py-4 text-zinc-400 font-mono text-sm focus:border-brand-500 outline-none transition-all" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                        <div>
                                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 block">Version Code</label>
                                        <input type="number" value={versionCode} onChange={e => setVersionCode(e.target.value)} className="w-full bg-zinc-900/50 border border-zinc-700/50 rounded-xl px-5 py-4 text-white outline-none transition-all" />
                                        </div>
                                        <div>
                                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 block">Version Name</label>
                                        <input value={versionName} onChange={e => setVersionName(e.target.value)} className="w-full bg-zinc-900/50 border border-zinc-700/50 rounded-xl px-5 py-4 text-white outline-none transition-all" />
                                        </div>
                                </div>
                            </div>

                            {/* Right Col */}
                            <div className="space-y-6">
                                <div>
                                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 block">App Icon URL</label>
                                    <div className="flex gap-4">
                                        <input value={iconUrl} onChange={e => setIconUrl(e.target.value)} className="flex-1 bg-zinc-900/50 border border-zinc-700/50 rounded-xl px-5 py-4 text-white text-sm outline-none transition-all" placeholder="https://example.com/icon.png" />
                                        <div className="w-16 h-16 bg-zinc-800 rounded-2xl border border-zinc-700 flex items-center justify-center overflow-hidden shrink-0 shadow-lg">
                                            {iconUrl ? <img src={iconUrl} alt="Preview" className="w-full h-full object-cover" /> : <Box className="text-zinc-600 h-6 w-6" />}
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="p-5 bg-zinc-800/30 rounded-2xl border border-zinc-700/50 space-y-4">
                                    <label className="flex items-center justify-between cursor-pointer group p-2 hover:bg-white/5 rounded-lg transition-colors">
                                        <div className="flex items-center gap-3 text-sm text-zinc-300 group-hover:text-white transition-colors">
                                            <div className="p-2 bg-zinc-800 rounded-lg"><Smartphone className="h-4 w-4" /></div>
                                            Portrait Mode
                                        </div>
                                        <input type="radio" name="orient" checked={orientation === 'portrait'} onChange={() => setOrientation('portrait')} className="accent-brand-500 w-5 h-5 cursor-pointer" />
                                    </label>
                                    <label className="flex items-center justify-between cursor-pointer group p-2 hover:bg-white/5 rounded-lg transition-colors">
                                        <div className="flex items-center gap-3 text-sm text-zinc-300 group-hover:text-white transition-colors">
                                            <div className="p-2 bg-zinc-800 rounded-lg"><Monitor className="h-4 w-4" /></div>
                                            Landscape Mode
                                        </div>
                                        <input type="radio" name="orient" checked={orientation === 'landscape'} onChange={() => setOrientation('landscape')} className="accent-brand-500 w-5 h-5 cursor-pointer" />
                                    </label>
                                    <div className="h-px bg-white/5 my-2"></div>
                                    <label className="flex items-center justify-between cursor-pointer group p-2 hover:bg-white/5 rounded-lg transition-colors">
                                        <div className="flex items-center gap-3 text-sm text-zinc-300 group-hover:text-white transition-colors">
                                            <div className="p-2 bg-zinc-800 rounded-lg"><LayoutTemplate className="h-4 w-4" /></div>
                                            Fullscreen (Immersive)
                                        </div>
                                        <input type="checkbox" checked={fullscreen} onChange={e => setFullscreen(e.target.checked)} className="accent-brand-500 w-5 h-5 cursor-pointer" />
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-between mt-8 pt-6 border-t border-white/5">
                            <button onClick={handleBack} className="px-6 py-3 text-zinc-400 hover:text-white transition-colors font-medium">Back</button>
                            <button onClick={handleNext} className="px-10 py-3 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-brand-500/20 transition-all hover:scale-105 active:scale-95">
                                Review Configuration
                            </button>
                        </div>
                    </div>
                </Step>

                {/* === STEP 3: REVIEW & BUILD === */}
                <Step>
                    <div className="space-y-8 text-center py-4">
                        <div className="max-w-md mx-auto bg-zinc-900/80 p-8 rounded-3xl border border-zinc-800 relative overflow-hidden group hover:border-brand-500/30 transition-colors">
                            <div className="absolute top-0 right-0 w-40 h-40 bg-brand-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                            
                            <div className="w-24 h-24 bg-zinc-800 mx-auto rounded-2xl mb-6 border border-zinc-700 overflow-hidden shadow-2xl relative z-10 group-hover:scale-105 transition-transform duration-500">
                                    {iconUrl ? <img src={iconUrl} className="w-full h-full object-cover" /> : <Box className="w-full h-full p-6 text-zinc-600" />}
                            </div>
                            <h3 className="text-2xl font-bold text-white relative z-10 mb-1">{appName}</h3>
                            <p className="text-zinc-500 text-sm font-mono mb-8 relative z-10">{appId}</p>

                            <div className="space-y-3 text-sm text-left bg-black/40 p-5 rounded-2xl border border-white/5 relative z-10">
                                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                                    <span className="text-zinc-500">Repository</span> 
                                    <span className="text-zinc-300 font-mono truncate max-w-[150px]">{url.split('/').slice(-2).join('/')}</span>
                                </div>
                                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                                    <span className="text-zinc-500">Version</span> 
                                    <span className="text-zinc-300">{versionName} <span className="text-zinc-600">({versionCode})</span></span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-zinc-500">Display</span> 
                                    <span className="text-zinc-300 capitalize flex items-center gap-2">
                                        {orientation} {fullscreen && <span className="text-xs bg-brand-500/20 text-brand-300 px-2 py-0.5 rounded-full">Full</span>}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col gap-4 justify-center items-center mt-8">
                            <button
                                onClick={handleSubmit}
                                disabled={isLoading}
                                // 👇 CLASS 'cursor-target'
                                className={`cursor-target w-full max-w-md flex items-center justify-center px-8 py-5 rounded-2xl text-xl font-bold text-white transition-all shadow-2xl relative overflow-hidden group
                                    ${isLoading 
                                    ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' 
                                    : 'bg-gradient-to-r from-brand-600 via-indigo-600 to-brand-600 bg-[length:200%_auto] hover:bg-[position:right_center] hover:scale-[1.02] hover:shadow-brand-500/40 active:scale-95'}`}
                            >
                                {isLoading ? (
                                    <>
                                    <Loader2 className="animate-spin -ml-1 mr-3 h-6 w-6" />
                                    Building App...
                                    </>
                                ) : (
                                    <span className="flex items-center animate-shimmer bg-clip-text text-transparent bg-[linear-gradient(110deg,#ffffff,45%,#a5b4fc,55%,#ffffff)] bg-[length:200%_100%]">
                                        <Play className="-ml-1 mr-3 h-6 w-6 fill-white text-white" />
                                        Start Cloud Build
                                    </span>
                                )}
                            </button>
                            
                            {!isLoading && (
                                // 👇 CLASS 'cursor-target'
                                <button onClick={handleBack} className="cursor-target text-zinc-500 text-sm hover:text-zinc-300 transition-colors mt-2">
                                    Back to Configuration
                                </button>
                            )}
                        </div>
                        
                        {isLoading && (
                            <div className="mt-6 flex flex-col items-center gap-3 animate-in fade-in duration-500">
                                <p className="text-sm text-zinc-400">Initializing cloud engine...</p>
                                <div className="w-64 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-brand-500 animate-[loading_1s_ease-in-out_infinite] w-1/3 rounded-full"></div>
                                </div>
                                <p className="text-xs text-zinc-600">Please do not close this tab</p>
                            </div>
                        )}
                    </div>
                </Step>

            </Stepper>
        </div>
      </div>
    </div>
  );
};