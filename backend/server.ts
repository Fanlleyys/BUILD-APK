// server.ts
import express from 'express';
import cors from 'cors';
import path from 'path';
import { spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 7860;

app.use(express.json({ limit: '50mb' }) as any);
app.use(express.urlencoded({ limit: '50mb', extended: true }) as any);
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

const WORKSPACE_DIR = path.join(__dirname, 'workspace');
const PUBLIC_DIR = path.join(__dirname, 'public');

if (!fs.existsSync(WORKSPACE_DIR)) fs.mkdirSync(WORKSPACE_DIR, { recursive: true, mode: 0o777 });
if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true, mode: 0o777 });

app.get('/', (req, res) => res.status(200).send('AppBuilder-AI v5.0 (Safe Area Fix) is Running. 🚀'));
app.use('/download', express.static(PUBLIC_DIR) as any);

// SSE helper
const sendEvent = (res: any, data: any) => { try { res.write(`data: ${JSON.stringify(data)}\n\n`); } catch (e) { /* ignore */ } };

function runCommand(command: string, args: string[], cwd: string, logFn?: (msg: string, type: 'info'|'error'|'command') => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const cmdStr = [command, ...args].join(' ');
    if (logFn) logFn(cmdStr, 'command');

    const child = spawn(command, args, { cwd, shell: true, env: { ...process.env, CI: 'true', TERM: 'dumb' } });

    child.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      lines.forEach((l: string) => { if (l.trim() && logFn) logFn(l.trim(), 'info'); });
    });

    child.stderr.on('data', (data) => {
      const lines = data.toString().split('\n');
      lines.forEach((l: string) => { if (l.trim() && logFn) logFn(l.trim(), 'error'); });
    });

    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command "${cmdStr}" failed with exit code ${code}`));
    });
    child.on('error', (err) => reject(err));
  });
}

// copy recursive
async function copyRecursive(src: string, dest: string) {
  if (!fs.existsSync(src)) return;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src);
    for (const e of entries) {
      await copyRecursive(path.join(src, e), path.join(dest, e));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

function readFileSafe(p: string): string | null {
  try { return fs.readFileSync(p, 'utf-8'); } catch (e) { return null; }
}
function writeFileSafe(p: string, content: string) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, 'utf-8');
}
function ensureAndroidManifestOrientation(manifestPath: string, orientation: string): boolean {
  const content = readFileSafe(manifestPath);
  if (!content) return false;
  if (content.includes('android:screenOrientation')) return false;
  const newContent = content.replace(/<activity\b/, `<activity android:screenOrientation="${orientation}"`);
  if (newContent !== content) { writeFileSafe(manifestPath, newContent); return true; }
  return false;
}
function patchStylesAppendItems(stylesPath: string, itemsXml: string): boolean {
  const content = readFileSafe(stylesPath);
  if (!content) return false;
  if (content.includes(itemsXml)) return false;
  if (content.includes('</style>')) {
    const newContent = content.replace('</style>', `${itemsXml}</style>`);
    if (newContent !== content) { writeFileSafe(stylesPath, newContent); return true; }
  }
  return false;
}

// NEW: Patch android gradle to force kotlin stdlib version (idempotent)
function ensureKotlinResolution(androidRoot: string, kotlinVersion = '1.8.22'): boolean {
  // Try project-level build.gradle first, else try android/build.gradle
  const candidates = [
    path.join(androidRoot, 'build.gradle'),
    path.join(androidRoot, 'app', 'build.gradle'),
    path.join(androidRoot, 'settings.gradle'),
    path.join(androidRoot, 'settings.gradle.kts')
  ];
  const forceBlock = `
/* Added by AppBuilder-AI to force Kotlin stdlib resolution and avoid duplicate-class errors */
configurations.all {
    resolutionStrategy {
        force(
            'org.jetbrains.kotlin:kotlin-stdlib:${kotlinVersion}',
            'org.jetbrains.kotlin:kotlin-stdlib-jdk7:${kotlinVersion}',
            'org.jetbrains.kotlin:kotlin-stdlib-jdk8:${kotlinVersion}'
        )
    }
}
`;
  for (const c of candidates) {
    try {
      if (!fs.existsSync(c)) continue;
      const content = fs.readFileSync(c, 'utf-8');
      if (content.includes('Added by AppBuilder-AI to force Kotlin stdlib')) {
        // already applied
        return true;
      }
      // append at end if not present
      fs.appendFileSync(c, `\n${forceBlock}\n`, 'utf-8');
      return true;
    } catch (e) {
      // ignore and continue
    }
  }
  // If no candidate files, create gradle.properties + top-level build.gradle in androidRoot
  try {
    const created = path.join(androidRoot, 'build.gradle');
    fs.writeFileSync(created, `// Auto-generated by AppBuilder-AI\n${forceBlock}\n`, 'utf-8');
    return true;
  } catch (e) {
    return false;
  }
}

app.post('/api/build/stream', async (req, res) => {
  const { repoUrl, appName, appId, orientation, iconUrl, fullscreen, versionCode, versionName } = req.body;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const log = (message: string, type: 'info'|'command'|'error'|'success' = 'info') => {
    sendEvent(res, { type: 'log', log: { id: uuidv4(), timestamp: new Date().toLocaleTimeString(), message, type } });
  };
  const updateStatus = (s: string) => sendEvent(res, { type: 'status', status: s });

  if (!repoUrl || typeof repoUrl !== 'string') {
    sendEvent(res, { type: 'error', message: 'No Repository URL provided' });
    res.end();
    return;
  }

  const finalAppName = (appName as string) || 'My App';
  const finalAppId = (appId as string) || 'com.appbuilder.generated';
  const finalOrientation = (orientation as string) || 'portrait';
  const isFullscreen = fullscreen === true || fullscreen === 'true';
  const vCode = (versionCode as string) || '1';
  const vName = (versionName as string) || '1.0';

  const buildId = uuidv4();
  const projectDir = path.join(WORKSPACE_DIR, buildId);

  try {
    if (!fs.existsSync(projectDir)) fs.mkdirSync(projectDir, { recursive: true });

    log(`Starting build process ID: ${buildId}`, 'info');
    log(`Config: ${finalAppName} | Fullscreen: ${isFullscreen}`, 'info');

    updateStatus('CLONING');
    log(`Cloning ${repoUrl}...`, 'command');
    await runCommand('git', ['clone', repoUrl, '.'], projectDir, log);

    // detect structure
    const rootPkg = path.join(projectDir, 'package.json');
    const frontendDir = path.join(projectDir, 'frontend');
    let buildProducedDir = '';

    const hasRootPkg = fs.existsSync(rootPkg);
    const hasFrontend = fs.existsSync(frontendDir) && fs.statSync(frontendDir).isDirectory();

    if (hasFrontend) {
      log('✅ Detected nested frontend at `./frontend`. Using Nested Node.js Build Mode.', 'success');
      updateStatus('INSTALLING_FRONTEND');
      await runCommand('npm', ['install'], frontendDir, log);
      updateStatus('BUILDING_FRONTEND');
      const frontendPkg = path.join(frontendDir, 'package.json');
      if (fs.existsSync(frontendPkg)) {
        const pkgJson = JSON.parse(fs.readFileSync(frontendPkg, 'utf-8'));
        if (pkgJson.scripts && pkgJson.scripts.build) {
          await runCommand('npm', ['run', 'build'], frontendDir, log);
        } else {
          log('No `build` script in `frontend/package.json`. Skipping frontend build.', 'info');
        }
      }
      if (fs.existsSync(path.join(frontendDir, 'dist'))) buildProducedDir = path.join(frontendDir, 'dist');
      else if (fs.existsSync(path.join(frontendDir, 'build'))) buildProducedDir = path.join(frontendDir, 'build');
      else if (fs.existsSync(path.join(frontendDir, 'out'))) buildProducedDir = path.join(frontendDir, 'out');
    } else if (hasRootPkg) {
      log('✅ Detected package.json at project root. Using Node.js Build Mode.', 'success');
      updateStatus('INSTALLING_ROOT');
      await runCommand('npm', ['install'], projectDir, log);
      updateStatus('BUILDING_ROOT');
      const pkg = JSON.parse(fs.readFileSync(rootPkg, 'utf-8'));
      if (pkg.scripts && pkg.scripts.build) {
        await runCommand('npm', ['run', 'build'], projectDir, log);
      } else {
        log('No `build` script found at root. Will try to use static files.', 'info');
      }
      if (fs.existsSync(path.join(projectDir, 'dist'))) buildProducedDir = path.join(projectDir, 'dist');
      else if (fs.existsSync(path.join(projectDir, 'build'))) buildProducedDir = path.join(projectDir, 'build');
      else if (fs.existsSync(path.join(projectDir, 'out'))) buildProducedDir = path.join(projectDir, 'out');
    } else {
      log('⚠️ No package.json found and no `frontend/`. Using Static HTML Mode.', 'info');
      if (fs.existsSync(path.join(projectDir, 'public'))) buildProducedDir = path.join(projectDir, 'public');
      else if (fs.existsSync(path.join(projectDir, 'web'))) buildProducedDir = path.join(projectDir, 'web');
      else {
        const possible = fs.readdirSync(projectDir).find(f => {
          try { return fs.statSync(path.join(projectDir, f)).isFile() && f.toLowerCase() === 'index.html'; }
          catch (e) { return false; }
        });
        if (possible) buildProducedDir = projectDir;
      }
    }

    const finalWebDirOnFs = path.join(projectDir, 'web');
    if (!fs.existsSync(finalWebDirOnFs)) fs.mkdirSync(finalWebDirOnFs, { recursive: true });

    if (buildProducedDir && fs.existsSync(buildProducedDir)) {
      log(`Copying build output from ${path.relative(projectDir, buildProducedDir)} to ./web ...`, 'info');
      await copyRecursive(buildProducedDir, finalWebDirOnFs);
    } else {
      log('No build output folder detected — copying repo root files into ./web as fallback.', 'info');
      const files = fs.readdirSync(projectDir);
      for (const f of files) {
        if (['android','node_modules','workspace','.git'].includes(f)) continue;
        await copyRecursive(path.join(projectDir, f), path.join(finalWebDirOnFs, f));
      }
      if (!fs.existsSync(path.join(finalWebDirOnFs, 'index.html'))) {
        const candidate = fs.existsSync(path.join(projectDir, 'frontend', 'index.html')) ? './frontend/index.html' : null;
        if (candidate) {
          const redirectHtml = `<!doctype html><meta http-equiv="refresh" content="0; url=${candidate}">`;
          writeFileSafe(path.join(finalWebDirOnFs, 'index.html'), redirectHtml);
          log('Created index.html redirect to nested frontend index.', 'info');
        }
      }
    }

    // Safe-area injection
    if (!isFullscreen) {
      const indexPath = fs.existsSync(path.join(finalWebDirOnFs, 'index.html')) ? path.join(finalWebDirOnFs, 'index.html') : null;
      if (indexPath) {
        try {
          log('Injecting Safe-Area Logic (Meta + CSS)...', 'info');
          let html = fs.readFileSync(indexPath, 'utf-8');
          if (html.includes('<meta name="viewport"')) {
            html = html.replace('<meta name="viewport" content="', '<meta name="viewport" content="viewport-fit=cover, ');
          } else if (html.includes('<head>')) {
            html = html.replace('<head>', '<head><meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">');
          }
          const safeAreaCSS = `
<style>
:root { --sat: env(safe-area-inset-top, 35px); }
body { padding-top: var(--sat) !important; background-color: #000000; min-height:100vh; box-sizing:border-box; }
#root, #app, #__next { padding-top: 0px !important; min-height:100vh; }
header, nav, .fixed-top { margin-top: var(--sat) !important; }
</style>
`;
          if (html.includes('</head>')) {
            html = html.replace('</head>', `${safeAreaCSS}</head>`);
            writeFileSafe(indexPath, html);
            log('Safe-Area Logic Injected Successfully!', 'success');
          }
        } catch (e: any) {
          log('Safe-Area injection failed: ' + (e.message || e), 'error');
        }
      } else {
        log('index.html not found in web, skipping safe-area injection.', 'info');
      }
    }

    // Ensure root package.json exists
    const rootPkgPath = path.join(projectDir, 'package.json');
    if (!fs.existsSync(rootPkgPath)) {
      log('Root package.json not found. Creating dummy package.json.', 'info');
      const dummy = { name: finalAppName.toLowerCase().replace(/\s+/g, '-'), version: vName, description: 'Generated by AppBuilder-AI', main: 'index.js', scripts: {} };
      writeFileSafe(rootPkgPath, JSON.stringify(dummy, null, 2));
    }

    // Install Capacitor
    log('Installing Capacitor dependencies...', 'command');
    await runCommand('npm', ['install', '@capacitor/core', '@capacitor/cli', '@capacitor/android', '--save-dev'], projectDir, log);

    updateStatus('CAPACITOR_INIT');
    log('Initializing Capacitor...', 'command');
    await runCommand('npx', ['cap', 'init', finalAppName, finalAppId, '--web-dir', 'web'], projectDir, log);

    log('Adding Android platform...', 'command');
    await runCommand('npx', ['cap', 'add', 'android'], projectDir, log);

    // Apply Android patches using Node fs (no sed)
    updateStatus('APPLYING_ANDROID_CUSTOM');
    const androidDir = path.join(projectDir, 'android');
    const androidManifestPath = path.join(androidDir, 'app/src/main/AndroidManifest.xml');
    const stylesPath = path.join(androidDir, 'app/src/main/res/values/styles.xml');
    const buildGradlePath = path.join(androidDir, 'app/build.gradle');

    // patch build.gradle versionCode & versionName
    if (fs.existsSync(buildGradlePath)) {
      try {
        let buildGradle = fs.readFileSync(buildGradlePath, 'utf-8');
        const vcRegex = /versionCode\s+\d+/;
        const vnRegex = /versionName\s+"[^"]*"/;
        if (vcRegex.test(buildGradle)) {
          buildGradle = buildGradle.replace(vcRegex, `versionCode ${vCode}`);
        } else {
          buildGradle = buildGradle.replace(/defaultConfig\s*{/, `defaultConfig {\n        versionCode ${vCode}`);
        }
        if (vnRegex.test(buildGradle)) {
          buildGradle = buildGradle.replace(vnRegex, `versionName "${vName}"`);
        } else {
          buildGradle = buildGradle.replace(/versionCode\s+\d+/, `versionCode ${vCode}\n        versionName "${vName}"`);
        }
        fs.writeFileSync(buildGradlePath, buildGradle, 'utf-8');
        log('Patched build.gradle versionCode/versionName via Node fs.', 'info');
      } catch (e: any) {
        log('Warning: failed to patch build.gradle: ' + (e.message || e), 'error');
      }
    } else {
      log('build.gradle not found, skipping version patch.', 'info');
    }

    // patch AndroidManifest orientation
    if (fs.existsSync(androidManifestPath) && finalOrientation !== 'user') {
      try {
        const changed = ensureAndroidManifestOrientation(androidManifestPath, finalOrientation);
        if (changed) log('Injected android:screenOrientation into AndroidManifest.xml', 'info');
        else log('AndroidManifest already has screenOrientation or injection not needed.', 'info');
      } catch (e: any) {
        log('Warning: failed to patch AndroidManifest: ' + (e.message || e), 'error');
      }
    } else {
      log('AndroidManifest not found or orientation set to user; skipping manifest patch.', 'info');
    }

    // patch styles.xml
    if (fs.existsSync(stylesPath)) {
      try {
        let stylesContent = fs.readFileSync(stylesPath, 'utf-8');
        if (stylesContent.includes('parent="AppTheme.NoActionBar"')) {
          stylesContent = stylesContent.replace('parent="AppTheme.NoActionBar"', isFullscreen ? 'parent="Theme.AppCompat.NoActionBar.FullScreen"' : 'parent="Theme.AppCompat.NoActionBar"');
          fs.writeFileSync(stylesPath, stylesContent, 'utf-8');
        }
        if (!isFullscreen) {
          const styleFix = '<item name="android:windowFullscreen">false</item><item name="android:windowTranslucentStatus">false</item><item name="android:fitsSystemWindows">true</item><item name="android:statusBarColor">@android:color/black</item><item name="android:windowLightStatusBar">false</item>';
          patchStylesAppendItems(stylesPath, styleFix);
        } else {
          const fsItem = '<item name="android:windowFullscreen">true</item>';
          patchStylesAppendItems(stylesPath, fsItem);
        }
        log('Applied style tweaks via Node fs.', 'info');
      } catch (e: any) {
        log('Warning: failed to patch styles.xml: ' + (e.message || e), 'error');
      }
    } else {
      log('styles.xml not found, skipping styles patch.', 'info');
    }

    // NEW: ensure consistent Kotlin stdlib resolution to avoid duplicate classes
    try {
      const kotlinForced = ensureKotlinResolution(androidDir, '1.8.22');
      if (kotlinForced) log('Applied Kotlin resolutionStrategy.force(...) to android Gradle files (helps duplicate-class).', 'info');
      else log('Failed to apply Kotlin resolution strategy; Gradle files may be missing.', 'error');
    } catch (e: any) {
      log('Warning: kotlin resolution patch failed: ' + (e.message || e), 'error');
    }

    updateStatus('ANDROID_SYNC');
    await runCommand('npx', ['cap', 'sync'], projectDir, log);

    // Icon handling (basic)
    if (iconUrl && typeof iconUrl === 'string' && fs.existsSync(path.join(androidDir, 'app', 'src', 'main', 'res'))) {
      const resDir = path.join(androidDir, 'app/src/main/res');
      const folders = ['mipmap-mdpi', 'mipmap-hdpi', 'mipmap-xhdpi', 'mipmap-xxhdpi', 'mipmap-xxxhdpi'];
      const adaptiveIconDir = path.join(resDir, 'mipmap-anydpi-v26');
      if (fs.existsSync(adaptiveIconDir)) {
        fs.rmSync(adaptiveIconDir, { recursive: true, force: true });
        log('Removed adaptive icons to force custom icon.', 'info');
      }
      if (iconUrl.startsWith('http')) {
        log('Downloading custom icon from URL...', 'command');
        for (const folder of folders) {
          const target = path.join(resDir, folder, 'ic_launcher.png');
          const targetRound = path.join(resDir, folder, 'ic_launcher_round.png');
          try {
            await runCommand('sh', ['-c', `curl -L "${iconUrl}" -o "${target}"`], projectDir, log);
            await runCommand('sh', ['-c', `cp "${target}" "${targetRound}"`], projectDir, log);
          } catch (e: any) { log('Icon download/copy failed: ' + (e.message || e), 'error'); }
        }
      } else if (iconUrl.startsWith('data:image')) {
        log('Processing uploaded icon (Base64)...', 'info');
        try {
          const base64Data = iconUrl.split(';base64,').pop();
          if (base64Data) {
            const iconBuffer = Buffer.from(base64Data, 'base64');
            const tempIconPath = path.join(projectDir, 'temp_icon.png');
            fs.writeFileSync(tempIconPath, iconBuffer);
            for (const folder of folders) {
              const target = path.join(resDir, folder, 'ic_launcher.png');
              const targetRound = path.join(resDir, folder, 'ic_launcher_round.png');
              try { fs.copyFileSync(tempIconPath, target); fs.copyFileSync(tempIconPath, targetRound); } catch {}
            }
            log('Custom icon applied successfully!', 'success');
          }
        } catch (err: any) { log('Failed to process custom icon: ' + (err.message || err), 'error'); }
      }
    } else {
      log('No custom icon or android res folder missing; skipping icon step.', 'info');
    }

    // Build APK
    updateStatus('COMPILING_APK');
    log('Compiling APK with Gradle...', 'command');
    const gradleDir = androidDir;
    if (fs.existsSync(path.join(gradleDir, 'gradlew'))) {
      await runCommand('chmod', ['+x', 'gradlew'], gradleDir, log);
      await runCommand('./gradlew', ['assembleDebug'], gradleDir, log);
    } else {
      throw new Error('gradlew script not found in android folder.');
    }

    const expectedApkPath = path.join(gradleDir, 'app/build/outputs/apk/debug/app-debug.apk');
    if (fs.existsSync(expectedApkPath)) {
      const publicApkName = `${finalAppName.replace(/\s+/g, '_')}_v${vName}.apk`;
      const publicApkPath = path.join(PUBLIC_DIR, publicApkName);
      fs.renameSync(expectedApkPath, publicApkPath);

      const protocol = (req.headers['x-forwarded-proto'] as string) || req.protocol;
      const host = (req.headers['x-forwarded-host'] as string) || req.get('host');
      const downloadUrl = `${protocol}://${host}/download/${publicApkName}`;

      updateStatus('SUCCESS');
      log('APK generated successfully!', 'success');
      sendEvent(res, { type: 'result', success: true, downloadUrl });
    } else {
      throw new Error('APK not found after gradle assemble. Check gradle output for errors.');
    }

  } catch (error: any) {
    console.error(error);
    updateStatus('ERROR');
    log(error.message || String(error), 'error');
    sendEvent(res, { type: 'result', success: false, error: error.message || String(error) });
  } finally {
    try { res.end(); } catch {}
  }
});

app.listen(PORT, () => console.log(`Build Server running on port ${PORT}`));
