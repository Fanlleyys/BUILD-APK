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

app.use(cors({ origin: '*', methods: ['GET', 'POST'] }));
app.use(express.json() as any);

const WORKSPACE_DIR = path.join(__dirname, 'workspace');
const PUBLIC_DIR = path.join(__dirname, 'public');

if (!fs.existsSync(WORKSPACE_DIR)) fs.mkdirSync(WORKSPACE_DIR, { recursive: true, mode: 0o777 });
if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true, mode: 0o777 });

app.get('/', (req, res) => { res.status(200).send('AppBuilder-AI v2.3 (Solid Status Bar Fix) is Running. 🚀'); });
app.use('/download', express.static(PUBLIC_DIR) as any);

const sendEvent = (res: any, data: any) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
};

function runCommand(command: string, args: string[], cwd: string, logFn?: (msg: string, type: 'info' | 'error') => void): Promise<void> {
    return new Promise((resolve, reject) => {
        if (logFn) logFn(`${command} ${args.join(' ')}`, 'info');
        const child = spawn(command, args, { cwd, shell: true, env: { ...process.env, CI: 'true', TERM: 'dumb' } });
        child.stdout.on('data', (data) => { const lines = data.toString().split('\n'); lines.forEach((line: string) => { if (line.trim() && logFn) logFn(line.trim(), 'info'); }); });
        child.stderr.on('data', (data) => { const lines = data.toString().split('\n'); lines.forEach((line: string) => { if (line.trim() && logFn) logFn(line.trim(), 'info'); }); });
        child.on('close', (code) => { if (code === 0) resolve(); else reject(new Error(`Command "${command}" failed with exit code ${code}`)); });
        child.on('error', (err) => reject(err));
    });
}

app.get('/api/build/stream', async (req, res) => {
    const { repoUrl, appName, appId, orientation, iconUrl, fullscreen } = req.query;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    if (!repoUrl || typeof repoUrl !== 'string') {
        sendEvent(res, { type: 'error', message: 'No Repository URL provided' });
        res.end();
        return;
    }

    const finalAppName = (appName as string) || 'My App';
    const finalAppId = (appId as string) || 'com.appbuilder.generated';
    const finalOrientation = (orientation as string) || 'portrait';
    const isFullscreen = fullscreen === 'true';

    const buildId = uuidv4();
    const projectDir = path.join(WORKSPACE_DIR, buildId);
    
    const log = (message: string, type: 'info' | 'command' | 'error' | 'success' = 'info') => {
        sendEvent(res, { type: 'log', log: { id: uuidv4(), timestamp: new Date().toLocaleTimeString(), message, type } });
    };
    const updateStatus = (status: string) => { sendEvent(res, { type: 'status', status }); };

    try {
        if (!fs.existsSync(projectDir)) fs.mkdirSync(projectDir, { recursive: true });

        log(`Starting build process ID: ${buildId}`, 'info');
        log(`Settings: Name=${finalAppName}, Fullscreen=${isFullscreen}`, 'info');
        
        updateStatus('CLONING');
        log(`Cloning ${repoUrl}...`, 'command');
        await runCommand('git', ['clone', repoUrl, '.'], projectDir, log);
        
        updateStatus('INSTALLING');
        log('Installing dependencies...', 'command');
        await runCommand('npm', ['install'], projectDir, log);

        log('Injecting Capacitor...', 'command');
        await runCommand('npm', ['install', '@capacitor/core', '@capacitor/cli', '@capacitor/android', '--save-dev'], projectDir, log);

        updateStatus('BUILDING_WEB');
        log('Building web assets...', 'command');
        const pkgPath = path.join(projectDir, 'package.json');
        if (fs.existsSync(pkgPath)) {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
            if (pkg.scripts && pkg.scripts.build) {
                 await runCommand('npm', ['run', 'build'], projectDir, log);
            } else {
                log('No build script found, skipping web build.', 'info');
            }
        }

        updateStatus('CAPACITOR_INIT');
        log('Initializing Capacitor...', 'command');
        let webDir = 'dist'; 
        if (fs.existsSync(path.join(projectDir, 'build'))) webDir = 'build'; 
        
        await runCommand('npx', ['cap', 'init', `"${finalAppName}"`, finalAppId, '--web-dir', webDir], projectDir, log);

        log('Adding Android platform...', 'command');
        await runCommand('npx', ['cap', 'add', 'android'], projectDir, log);

        // --- CUSTOMIZATION AREA ---
        log('Applying custom settings...', 'info');
        const androidManifestPath = path.join(projectDir, 'android/app/src/main/AndroidManifest.xml');
        const stylesPath = path.join(projectDir, 'android/app/src/main/res/values/styles.xml');

        // 1. SET ORIENTATION
        if (finalOrientation !== 'user') {
            await runCommand(`sed -i 's/<activity/<activity android:screenOrientation="${finalOrientation}"/g' ${androidManifestPath}`, [], projectDir, log);
        }

        // 2. HANDLE LAYOUT (FULLSCREEN VS SAFE AREA)
        if (isFullscreen) {
            // MODE GAME: Bablas sampai atas
            log('Mode: Fullscreen (Immersive)', 'info');
            await runCommand(`sed -i 's|parent="AppTheme.NoActionBar"|parent="Theme.AppCompat.NoActionBar.FullScreen"|g' ${stylesPath}`, [], projectDir, log);
            await runCommand(`sed -i 's|<\/style>|<item name="android:windowFullscreen">true<\/item><\/style>|g' ${stylesPath}`, [], projectDir, log);
        } else {
            // MODE APLIKASI BIASA (InDrive Style)
            log('Mode: Safe Area (Solid Status Bar)', 'info');
            
            // A. Paksa FitsSystemWindows
            await runCommand(`sed -i 's|<\/style>|<item name="android:fitsSystemWindows">true<\/item><\/style>|g' ${stylesPath}`, [], projectDir, log);
            
            // B. Paksa Status Bar HITAM (Bukan Transparan)
            await runCommand(`sed -i 's|<\/style>|<item name="android:statusBarColor">@android:color/black<\/item><\/style>|g' ${stylesPath}`, [], projectDir, log);
            
            // C. MATIKAN Translucent Status (Ini biang keroknya kenapa masih tembus)
            await runCommand(`sed -i 's|<\/style>|<item name="android:windowTranslucentStatus">false<\/item><\/style>|g' ${stylesPath}`, [], projectDir, log);
        }

        // 3. SET CUSTOM ICON
        if (iconUrl && typeof iconUrl === 'string' && iconUrl.startsWith('http')) {
            log('Downloading custom icon...', 'command');
            const resDir = path.join(projectDir, 'android/app/src/main/res');
            const folders = ['mipmap-mdpi', 'mipmap-hdpi', 'mipmap-xhdpi', 'mipmap-xxhdpi', 'mipmap-xxxhdpi'];
            for (const folder of folders) {
                const target = path.join(resDir, folder, 'ic_launcher.png');
                const targetRound = path.join(resDir, folder, 'ic_launcher_round.png');
                // Download pakai curl
                await runCommand(`curl -L "${iconUrl}" -o ${target}`, [], projectDir);
                await runCommand(`cp ${target} ${targetRound}`, [], projectDir);
            }
            log('Custom icon applied!', 'success');
        }

        updateStatus('ANDROID_SYNC');
        await runCommand('npx', ['cap', 'sync'], projectDir, log);

        updateStatus('COMPILING_APK');
        log('Compiling APK with Gradle...', 'command');
        const androidDir = path.join(projectDir, 'android');
        await runCommand('chmod', ['+x', 'gradlew'], androidDir, log);
        await runCommand('./gradlew', ['assembleDebug'], androidDir, log);

        log('Locating generated APK...', 'info');
        const expectedApkPath = path.join(androidDir, 'app/build/outputs/apk/debug/app-debug.apk');
        
        if (fs.existsSync(expectedApkPath)) {
             const publicApkName = `${finalAppName.replace(/\s+/g, '_')}-${buildId}.apk`;
             const publicApkPath = path.join(PUBLIC_DIR, publicApkName);
             fs.renameSync(expectedApkPath, publicApkPath);
             
             const protocol = req.headers['x-forwarded-proto'] || req.protocol;
             const host = req.headers['x-forwarded-host'] || req.get('host');
             const downloadUrl = `${protocol}://${host}/download/${publicApkName}`;
             
             updateStatus('SUCCESS');
             log('APK generated successfully!', 'success');
             sendEvent(res, { type: 'result', success: true, downloadUrl });
        } else {
            throw new Error('APK file not found.');
        }

    } catch (error: any) {
        console.error(error);
        updateStatus('ERROR');
        log(error.message || 'Unknown build error', 'error');
        sendEvent(res, { type: 'result', success: false, error: error.message });
    } finally {
        res.end();
    }
});

app.listen(PORT, () => { console.log(`Build Server running on port ${PORT}`); });