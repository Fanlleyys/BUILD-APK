import React from 'react';
import { motion } from 'framer-motion';
import { GitBranch, Box, Terminal, Code2, FolderOpen, AlertTriangle, CheckCircle2, Cpu, FileJson } from 'lucide-react';

// --- LEVEL 1: QUICK CHIPS (Di bawah Hero) ---
export const QuickChips = () => (
  <motion.div 
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 0.8, duration: 0.5 }}
    className="flex flex-wrap justify-center gap-3 mt-8 text-xs font-mono text-zinc-400"
  >
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors cursor-default">
      <GitBranch className="w-3.5 h-3.5 text-brand-400" />
      <span>Public Repo Only</span>
    </div>
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors cursor-default">
      <Box className="w-3.5 h-3.5 text-brand-400" />
      <span>SPA Frameworks (React/Vue)</span>
    </div>
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors cursor-default">
      <Terminal className="w-3.5 h-3.5 text-brand-400" />
      <span>Node.js Build</span>
    </div>
  </motion.div>
);

// --- LEVEL 2: HOW IT WORKS (Di bawah Form) ---
export const HowItWorks = () => {
  const steps = [
    {
      id: "01",
      title: "Connect Repository",
      desc: "Paste your public GitHub URL. Our engine clones the repo and detects your framework automatically.",
      icon: <GitBranch className="w-5 h-5" />
    },
    {
      id: "02",
      title: "Configure App",
      desc: "Set your App Name, Package ID, Icon, and display mode (Fullscreen/Portrait). No coding needed.",
      icon: <Cpu className="w-5 h-5" />
    },
    {
      id: "03",
      title: "Cloud Build",
      desc: "We wrap your web app with CapacitorJS, build the APK in our cloud, and generate a download link.",
      icon: <CheckCircle2 className="w-5 h-5" />
    }
  ];

  return (
    <section className="mt-24 mb-16 relative">
      <div className="flex items-center justify-between mb-8 px-2">
        <h2 className="text-sm font-bold tracking-[0.2em] text-zinc-500 uppercase flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse"></span>
          System Workflow
        </h2>
        <span className="text-xs font-mono text-zinc-600 hidden sm:block">
          // AUTOMATED PIPELINE
        </span>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {steps.map((step, i) => (
          <motion.div
            key={step.id}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            // 👇 CLASS 'cursor-target' BIAR KURSOR NEMPEL
            className="cursor-target group relative p-6 rounded-2xl bg-zinc-900/40 border border-white/5 hover:border-brand-500/30 transition-all duration-300 hover:bg-zinc-900/60"
          >
            <div className="absolute top-6 right-6 text-4xl font-black text-white/5 group-hover:text-brand-500/10 transition-colors select-none">
              {step.id}
            </div>
            <div className="w-10 h-10 rounded-lg bg-brand-500/10 flex items-center justify-center text-brand-400 mb-4 group-hover:scale-110 transition-transform duration-300 border border-brand-500/20">
              {step.icon}
            </div>
            <h3 className="text-lg font-bold text-white mb-2 group-hover:text-brand-300 transition-colors">
              {step.title}
            </h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              {step.desc}
            </p>
          </motion.div>
        ))}
      </div>
    </section>
  );
};

// --- LEVEL 3: TECH SPECS (Di dekat Footer) ---
export const TechSpecs = () => (
  <section className="max-w-4xl mx-auto mt-16 pt-16 border-t border-white/5">
    <div className="mb-8 text-center">
      <h2 className="text-sm font-bold tracking-[0.2em] text-zinc-500 uppercase mb-2">
        Technical Requirements
      </h2>
      <p className="text-xs text-zinc-600 font-mono">
        ENSURE YOUR REPO MEETS THESE CRITERIA
      </p>
    </div>

    <div className="grid gap-8 md:grid-cols-2 text-sm text-zinc-400 bg-black/20 p-8 rounded-3xl border border-white/5">
      <ul className="space-y-4">
        <li className="flex gap-3">
          <FileJson className="w-5 h-5 text-zinc-500 shrink-0" />
          <span>
            Must have <code className="px-1.5 py-0.5 rounded bg-white/10 text-zinc-200 font-mono text-xs">package.json</code> in root.
          </span>
        </li>
        <li className="flex gap-3">
          <Terminal className="w-5 h-5 text-zinc-500 shrink-0" />
          <span>
            Build script required: <code className="px-1.5 py-0.5 rounded bg-white/10 text-zinc-200 font-mono text-xs">npm run build</code>
          </span>
        </li>
        <li className="flex gap-3">
          <FolderOpen className="w-5 h-5 text-zinc-500 shrink-0" />
          <span>
            Output directory must be <code className="px-1.5 py-0.5 rounded bg-white/10 text-zinc-200 font-mono text-xs">dist</code> or <code className="px-1.5 py-0.5 rounded bg-white/10 text-zinc-200 font-mono text-xs">build</code>
          </span>
        </li>
      </ul>

      <ul className="space-y-4">
        <li className="flex gap-3">
          <Code2 className="w-5 h-5 text-zinc-500 shrink-0" />
          <span>
            <strong>SPA Only:</strong> React, Vue, Angular, Svelte. <br/>
            <span className="text-xs text-zinc-500 italic">(SSR like Next.js API routes are not supported)</span>
          </span>
        </li>
        <li className="flex gap-3">
          <AlertTriangle className="w-5 h-5 text-zinc-500 shrink-0" />
          <span>
            <strong>Public Repositories</strong> only. Private repos cannot be cloned by the build engine yet.
          </span>
        </li>
      </ul>
    </div>
  </section>
);