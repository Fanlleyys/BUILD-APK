// server.ts
import express from 'express';
import cors from 'cors';
import path from 'path';
import { spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import { fileURLToPath } from 'url';
import util from 'util';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 7860;

// Middlewares
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

app.get('/', (req, res) => { res.status(200).send('AppBuilder-AI v5.0 (Safe Area Fix) is Running. 🚀'); });
app.use('/download', express.static(PUBLIC_DIR) as any);

// Helper: SSE send
const sendEvent = (res: any, data: any) => {
    try { res.write(`data: ${JSON.stringify(data)}\n\n`); } catch (e) { /* ignore */ }
};

// Helper: runCommand with better streaming
function runCommand(command: string, args: string[], cwd: string, logFn?: (msg: string, type: 'info' | 'error' | 'command') => void): Promise<void> {
    return new Promise((resolve, reject) => {
        const cmdStr = [command, ...args].join(' ');
        if (logFn) logFn(cmdStr, 'command');

        // Use shell mode for compatibility and proper quoting
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

// Utility: copy folder recursively (node 18+ has cp but ensure fallback)
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

app.post('/api/build/stream', async (req, res) => {
    const { repoUrl, appName, appId, orientation, iconUrl, fullscreen, versionCode, versionName } = req.body;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sendLog = (msg: string, type: 'info' | 'command' | 'error' | 'success' = 'info') => {
        sendEvent(res, { type: 'log', log: { id: uuidv4(), timestamp: new Date().toLocaleTimeString(), message: msg, type } });
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

        sendLog(`Starting build process ID: ${buildId}`, 'info');
        sendLog(`Config: ${finalAppName} | Fullscreen: ${isFullscreen}`, 'info');

        updateStatus('CLONING');
        sendLog(`Cloning ${repoUrl}...`, 'command');
        await runCommand('git', ['clone', repoUrl, '.'], projectDir, sendLog);

        // Detect package.json location and build type
        let rootPkg = path.join(projectDir, 'package.json');
        let frontendDir = path.join(projectDir, 'frontend');
        let webDir = ''; // final webDir relative to projectDir
        let buildProducedDir = '';

        const hasRootPkg = fs.existsSync(rootPkg);
        const hasFrontend = fs.existsSync(frontendDir) && fs.statSync(frontendDir).isDirectory();

        if (hasFrontend) {
            // Nested frontend case
            sendLog('✅ Detected nested frontend at `./frontend`. Using Nested Node.js Build Mode.', 'success');
            // install & build inside frontend
            updateStatus('INSTALLING_FRONTEND');
            await runCommand('npm', ['install'], frontendDir, sendLog);
            updateStatus('BUILDING_FRONTEND');
            const frontendPkg = path.join(frontendDir, 'package.json');
            if (fs.existsSync(frontendPkg)) {
                const pkgJson = JSON.parse(fs.readFileSync(frontendPkg, 'utf-8'));
                if (pkgJson.scripts && pkgJson.scripts.build) {
                    await runCommand('npm', ['run', 'build'], frontendDir, sendLog);
                } else {
                    sendLog('No `build` script in `frontend/package.json`. Skipping frontend build.', 'info');
                }
            }
            // prefer ./frontend/dist or ./frontend/build
            if (fs.existsSync(path.join(frontendDir, 'dist'))) buildProducedDir = path.join(frontendDir, 'dist');
            else if (fs.existsSync(path.join(frontendDir, 'build'))) buildProducedDir = path.join(frontendDir, 'build');
            else if (fs.existsSync(path.join(frontendDir, 'out'))) buildProducedDir = path.join(frontendDir, 'out');
        } else if (hasRootPkg) {
            // Root node project
            sendLog('✅ Detected package.json at project root. Using Node.js Build Mode.', 'success');
            updateStatus('INSTALLING_ROOT');
            await runCommand('npm', ['install'], projectDir, sendLog);
            updateStatus('BUILDING_ROOT');
            const pkg = JSON.parse(fs.readFileSync(rootPkg, 'utf-8'));
            if (pkg.scripts && pkg.scripts.build) {
                await runCommand('npm', ['run', 'build'], projectDir, sendLog);
            } else {
                sendLog('No `build` script found at root. Will try to use static files.', 'info');
            }

            if (fs.existsSync(path.join(projectDir, 'dist'))) buildProducedDir = path.join(projectDir, 'dist');
            else if (fs.existsSync(path.join(projectDir, 'build'))) buildProducedDir = path.join(projectDir, 'build');
            else if (fs.existsSync(path.join(projectDir, 'out'))) buildProducedDir = path.join(projectDir, 'out');
        } else {
            // Static site or weird structure
            sendLog('⚠️ No package.json found at root and no `frontend/` folder. Using Static HTML Mode.', 'info');
            // move any static folder to /web later
            if (fs.existsSync(path.join(projectDir, 'public'))) buildProducedDir = path.join(projectDir, 'public');
            else if (fs.existsSync(path.join(projectDir, 'web'))) buildProducedDir = path.join(projectDir, 'web');
            else {
                // fallback: try to find index.html anywhere shallow
                const possible = fs.readdirSync(projectDir).find(f => {
                    try {
                        const p = path.join(projectDir, f);
                        return fs.statSync(p).isFile() && f.toLowerCase() === 'index.html';
                    } catch (e) { return false; }
                });
                if (possible) buildProducedDir = projectDir;
            }
        }

        // Ensure webDir = 'web' under project root for Capacitor
        const finalWebDirOnFs = path.join(projectDir, 'web');
        if (!fs.existsSync(finalWebDirOnFs)) fs.mkdirSync(finalWebDirOnFs, { recursive: true });

        // Copy build output to ./web. If there was a built folder, copy it; otherwise, copy whole project (static)
        if (buildProducedDir && fs.existsSync(buildProducedDir)) {
            sendLog(`Copying build output from ${path.relative(projectDir, buildProducedDir)} to ./web ...`, 'info');
            await copyRecursive(buildProducedDir, finalWebDirOnFs);
        } else {
            sendLog('No build output folder detected — copying repo root files into ./web as fallback (will create index.html redirect if needed).', 'info');
            // copy only common static files
            const files = fs.readdirSync(projectDir);
            for (const f of files) {
                if (f === 'android' || f === 'node_modules' || f === 'workspace' || f === '.git') continue;
                await copyRecursive(path.join(projectDir, f), path.join(finalWebDirOnFs, f));
            }
            // if top-level frontend exists and contains index.html, create small redirect index
            if (!fs.existsSync(path.join(finalWebDirOnFs, 'index.html'))) {
                // try to create redirect if frontend/index.html exists
                const candidate = fs.existsSync(path.join(projectDir, 'frontend', 'index.html'))
                    ? './frontend/index.html' : null;
                if (candidate) {
                    const redirectHtml = `<!doctype html><meta http-equiv="refresh" content="0; url=${candidate}">`;
                    fs.writeFileSync(path.join(finalWebDirOnFs, 'index.html'), redirectHtml);
                    sendLog('Created index.html redirect to nested frontend index.', 'info');
                }
            }
        }

        // Inject Safe-Area logic into index.html if exists and not fullscreen
        if (!isFullscreen) {
            const indexHtmlPathCandidates = [
                path.join(finalWebDirOnFs, 'index.html'),
                path.join(finalWebDirOnFs, 'public', 'index.html')
            ];
            const indexPath = indexHtmlPathCandidates.find(p => fs.existsSync(p));
            if (indexPath) {
                try {
                    sendLog('Injecting Safe-Area Logic (Meta + CSS)...', 'info');
                    let htmlContent = fs.readFileSync(indexPath, 'utf-8');
                    if (htmlContent.includes('<meta name="viewport"')) {
                        htmlContent = htmlContent.replace('<meta name="viewport" content="', '<meta name="viewport" content="viewport-fit=cover, ');
                    } else if (htmlContent.includes('<head>')) {
                        htmlContent = htmlContent.replace('<head>', '<head><meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">');
                    }
                    const safeAreaCSS = `
<style>
:root { --sat: env(safe-area-inset-top, 35px); }
body { padding-top: var(--sat) !important; background-color: #000000; min-height:100vh; box-sizing:border-box; }
#root, #app, #__next { padding-top: 0px !important; min-height:100vh; }
header, nav, .fixed-top { margin-top: var(--sat) !important; }
</style>
`;
                    if (htmlContent.includes('</head>')) {
                        htmlContent = htmlContent.replace('</head>', `${safeAreaCSS}</head>`);
                        fs.writeFileSync(indexPath, htmlContent);
                        sendLog('Safe-Area Logic Injected Successfully!', 'success');
                    }
                } catch (e: any) {
                    sendLog('Safe-Area injection failed: ' + (e.message || e), 'error');
                }
            } else {
                sendLog('index.html not found in web assets, skipping safe-area injection.', 'info');
            }
        }

        // Ensure root package.json exists (Capacitor cli wants an npm package in root)
        const rootPkgPath = path.join(projectDir, 'package.json');
        if (!fs.existsSync(rootPkgPath)) {
            sendLog('Root package.json not found. Creating dummy package.json to satisfy Capacitor CLI.', 'info');
            const dummy = {
                name: finalAppName.toLowerCase().replace(/\s+/g, '-'),
                version: vName,
                description: 'Generated by AppBuilder-AI',
                main: 'index.js',
                scripts: {}
            };
            fs.writeFileSync(rootPkgPath, JSON.stringify(dummy, null, 2));
        }

        // Install capacitor deps (dev) in project root
        sendLog('Installing Capacitor dependencies...', 'command');
        await runCommand('npm', ['install', '@capacitor/core', '@capacitor/cli', '@capacitor/android', '--save-dev'], projectDir, sendLog);

        updateStatus('CAPACITOR_INIT');
        sendLog('Initializing Capacitor...', 'command');

        // Use safe webDir name 'web' (relative from projectDir)
        const webDirRelative = 'web';
        // Important: do NOT quote finalAppName as a single parameter; pass as separate argv
        await runCommand('npx', ['cap', 'init', finalAppName, finalAppId, '--web-dir', webDirRelative], projectDir, sendLog);

        sendLog('Adding Android platform...', 'command');
        await runCommand('npx', ['cap', 'add', 'android'], projectDir, sendLog);

        // Apply custom Android settings if files exist
        updateStatus('APPLYING_ANDROID_CUSTOM');
        const androidDir = path.join(projectDir, 'android');
        const androidManifestPath = path.join(androidDir, 'app/src/main/AndroidManifest.xml');
        const stylesPath = path.join(androidDir, 'app/src/main/res/values/styles.xml');
        const buildGradlePath = path.join(androidDir, 'app/build.gradle');

        // Safe sed replacement helper (sh -c)
        const safeSed = async (cmd: string) => {
            await runCommand('sh', ['-c', cmd], projectDir, sendLog);
        };

        // Versioning if build.gradle exists
        if (fs.existsSync(buildGradlePath)) {
            try {
                await safeSed(`sed -i 's/versionCode [0-9]\\+/versionCode ${vCode}/g' "${buildGradlePath}"`);
                await safeSed(`sed -i 's/versionName "[^"]*"/versionName "${vName}"/g' "${buildGradlePath}"`);
            } catch (e) { sendLog('Warning: failed to patch build.gradle: ' + (e as any).message, 'error'); }
        } else {
            sendLog('build.gradle not found, skipping version patch.', 'info');
        }

        // Orientation
        if (fs.existsSync(androidManifestPath) && finalOrientation !== 'user') {
            try {
                await safeSed(`sed -i 's#<activity#<activity android:screenOrientation="${finalOrientation}"#g' "${androidManifestPath}"`);
            } catch (e) { sendLog('Warning: failed to patch AndroidManifest: ' + (e as any).message, 'error'); }
        }

        // Style tweaks (fullscreen vs safe area)
        if (fs.existsSync(stylesPath)) {
            if (isFullscreen) {
                await safeSed(`sed -i 's|parent="AppTheme.NoActionBar"|parent="Theme.AppCompat.NoActionBar.FullScreen"|g' "${stylesPath}"`);
                await safeSed(`sed -i 's|</style>|<item name="android:windowFullscreen">true</item></style>|g' "${stylesPath}"`);
                sendLog('Applied Fullscreen style.', 'info');
            } else {
                const styleFix = [
                    '<item name="android:windowFullscreen">false</item>',
                    '<item name="android:windowTranslucentStatus">false</item>',
                    '<item name="android:fitsSystemWindows">true</item>',
                    '<item name="android:statusBarColor">@android:color/black</item>',
                    '<item name="android:windowLightStatusBar">false</item>'
                ].join('');
                await safeSed(`sed -i 's|parent="AppTheme.NoActionBar"|parent="Theme.AppCompat.NoActionBar"|g' "${stylesPath}"`);
                // append only if </style> exists
                try {
                    await safeSed(`sed -i 's|</style>|${styleFix}<\/style>|g' "${stylesPath}"`);
                } catch (e) { /* ignore */ }
                sendLog('Applied Safe Area style.', 'info');
            }
        } else {
            sendLog('styles.xml not found, skipping style tweaks.', 'info');
        }

        // Sync Capacitor
        updateStatus('ANDROID_SYNC');
        await runCommand('npx', ['cap', 'sync'], projectDir, sendLog);

        // Icon handling (basic)
        if (iconUrl && typeof iconUrl === 'string' && fs.existsSync(path.join(androidDir, 'app', 'src', 'main', 'res'))) {
            const resDir = path.join(androidDir, 'app/src/main/res');
            const folders = ['mipmap-mdpi', 'mipmap-hdpi', 'mipmap-xhdpi', 'mipmap-xxhdpi', 'mipmap-xxxhdpi'];
            const adaptiveIconDir = path.join(resDir, 'mipmap-anydpi-v26');
            if (fs.existsSync(adaptiveIconDir)) {
                fs.rmSync(adaptiveIconDir, { recursive: true, force: true });
                sendLog('Removed default adaptive icons to force custom icon.', 'info');
            }

            if (iconUrl.startsWith('http')) {
                sendLog('Downloading custom icon from URL...', 'command');
                for (const folder of folders) {
                    const target = path.join(resDir, folder, 'ic_launcher.png');
                    const targetRound = path.join(resDir, folder, 'ic_launcher_round.png');
                    try {
                        await runCommand('sh', ['-c', `curl -L "${iconUrl}" -o "${target}"`], projectDir, sendLog);
                        await runCommand('sh', ['-c', `cp "${target}" "${targetRound}"`], projectDir, sendLog);
                    } catch (e) { sendLog('Failed to download/copy icon: ' + (e as any).message, 'error'); }
                }
            } else if (iconUrl.startsWith('data:image')) {
                sendLog('Processing uploaded icon (Base64)...', 'info');
                try {
                    const base64Data = iconUrl.split(';base64,').pop();
                    if (base64Data) {
                        const iconBuffer = Buffer.from(base64Data, 'base64');
                        const tempIconPath = path.join(projectDir, 'temp_icon.png');
                        fs.writeFileSync(tempIconPath, iconBuffer);
                        for (const folder of folders) {
                            const target = path.join(resDir, folder, 'ic_launcher.png');
                            const targetRound = path.join(resDir, folder, 'ic_launcher_round.png');
                            try {
                                fs.copyFileSync(tempIconPath, target);
                                fs.copyFileSync(tempIconPath, targetRound);
                            } catch (e) { /* ignore per-density copy errors */ }
                        }
                        sendLog('Custom icon applied successfully!', 'success');
                    }
                } catch (err) {
                    sendLog('Failed to process custom icon. Using default. ' + (err as any).message, 'error');
                }
            }
        } else {
            sendLog('No custom icon provided or android res folder missing, skipping icon step.', 'info');
        }

        // Build APK
        updateStatus('COMPILING_APK');
        sendLog('Compiling APK with Gradle...', 'command');
        const gradleDir = androidDir;
        if (fs.existsSync(path.join(gradleDir, 'gradlew'))) {
            await runCommand('chmod', ['+x', 'gradlew'], gradleDir, sendLog);
            await runCommand('./gradlew', ['assembleDebug'], gradleDir, sendLog);
        } else {
            throw new Error('gradlew script not found in android folder.');
        }

        // Locate APK
        const expectedApkPath = path.join(gradleDir, 'app/build/outputs/apk/debug/app-debug.apk');
        if (fs.existsSync(expectedApkPath)) {
            const publicApkName = `${finalAppName.replace(/\s+/g, '_')}_v${vName}.apk`;
            const publicApkPath = path.join(PUBLIC_DIR, publicApkName);
            fs.renameSync(expectedApkPath, publicApkPath);

            const protocol = (req.headers['x-forwarded-proto'] as string) || req.protocol;
            const host = (req.headers['x-forwarded-host'] as string) || req.get('host');
            const downloadUrl = `${protocol}://${host}/download/${publicApkName}`;

            updateStatus('SUCCESS');
            sendLog('APK generated successfully!', 'success');
            sendEvent(res, { type: 'result', success: true, downloadUrl });
        } else {
            throw new Error('APK not found after gradle assemble. Check gradle output for errors.');
        }
    } catch (err: any) {
        console.error(err);
        updateStatus('ERROR');
        sendLog(err.message || String(err), 'error');
        sendEvent(res, { type: 'result', success: false, error: err.message || String(err) });
    } finally {
        try { res.end(); } catch (e) { /* ignore */ }
    }
});

app.listen(PORT, () => { console.log(`Build Server running on port ${PORT}`); });