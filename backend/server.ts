import express from 'express';
import cors from 'cors';
import path from 'path';
import { spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import { fileURLToPath } from 'url';

// ESM fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Hugging Face Spaces exposes port 7860 by default
const PORT = process.env.PORT || 7860;

// Allow CORS from your frontend domain (wildcard for demo)
app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST']
}));
app.use(express.json() as any);

// Path where builds happen (ensure this directory has write permissions)
const WORKSPACE_DIR = path.join(__dirname, 'workspace');
// Path where APKs are served from
const PUBLIC_DIR = path.join(__dirname, 'public');

// Ensure directories exist with wide permissions
if (!fs.existsSync(WORKSPACE_DIR)) fs.mkdirSync(WORKSPACE_DIR, { recursive: true, mode: 0o777 });
if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true, mode: 0o777 });

// Serve static APK files
app.use('/download', express.static(PUBLIC_DIR) as any);

// Helper: Send SSE Event
const sendEvent = (res: any, data: any) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
};

// Helper: Promisified Spawn
function runCommand(command: string, args: string[], cwd: string, logFn?: (msg: string, type: 'info' | 'error') => void): Promise<void> {
    return new Promise((resolve, reject) => {
        // Log the command itself
        if (logFn) logFn(`${command} ${args.join(' ')}`, 'info');

        const child = spawn(command, args, { 
            cwd, 
            shell: true,
            env: { ...process.env, CI: 'true', TERM: 'dumb' } // TERM=dumb prevents color codes from messing up logs
        });

        child.stdout.on('data', (data) => {
            const lines = data.toString().split('\n');
            lines.forEach((line: string) => {
                if (line.trim() && logFn) logFn(line.trim(), 'info');
            });
        });

        child.stderr.on('data', (data) => {
            const lines = data.toString().split('\n');
            lines.forEach((line: string) => {
                if (line.trim() && logFn) logFn(line.trim(), 'info'); 
            });
        });

        child.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Command "${command}" failed with exit code ${code}`));
            }
        });

        child.on('error', (err) => {
            reject(err);
        });
    });
}

// Build Endpoint
app.get('/api/build/stream', async (req, res) => {
    const { repoUrl } = req.query;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    if (!repoUrl || typeof repoUrl !== 'string') {
        sendEvent(res, { type: 'error', message: 'No Repository URL provided' });
        res.end();
        return;
    }

    const buildId = uuidv4();
    const projectDir = path.join(WORKSPACE_DIR, buildId);
    
    const log = (message: string, type: 'info' | 'command' | 'error' | 'success' = 'info') => {
        sendEvent(res, { type: 'log', log: { id: uuidv4(), timestamp: new Date().toLocaleTimeString(), message, type } });
    };

    const updateStatus = (status: string) => {
        sendEvent(res, { type: 'status', status });
    };

    try {
        log(`Starting build process ID: ${buildId}`, 'info');
        
        // 1. Git Clone
        updateStatus('CLONING');
        log(`Cloning ${repoUrl}...`, 'command');
        await runCommand('git', ['clone', repoUrl, '.'], projectDir, log);
        
        // 2. Install Dependencies
        updateStatus('INSTALLING');
        log('Installing dependencies...', 'command');
        await runCommand('npm', ['install'], projectDir, log);

        // 2.1 INJECT CAPACITOR (Crucial for generic web apps)
        // We install capacitor dependencies if they are missing so we can wrap any website
        log('Injecting Capacitor Core & Android engines...', 'command');
        await runCommand('npm', ['install', '@capacitor/core', '@capacitor/cli', '@capacitor/android', '--save-dev'], projectDir, log);

        // 3. Build Web Assets
        updateStatus('BUILDING_WEB');
        log('Building web assets...', 'command');
        // Check for common build scripts
        let buildScript = 'build';
        const pkgPath = path.join(projectDir, 'package.json');
        if (fs.existsSync(pkgPath)) {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
            if (!pkg.scripts || !pkg.scripts.build) {
                log('No "build" script found in package.json. Skipping web build step (assuming static or pre-built).', 'info');
            } else {
                 await runCommand('npm', ['run', 'build'], projectDir, log);
            }
        }

        // 4. Initialize Capacitor
        updateStatus('CAPACITOR_INIT');
        log('Initializing Capacitor...', 'command');
        
        let webDir = 'dist'; 
        if (fs.existsSync(path.join(projectDir, 'build'))) webDir = 'build'; 
        if (fs.existsSync(path.join(projectDir, 'out'))) webDir = 'out'; 
        
        log(`Detected web directory: ${webDir}`, 'info');

        // Init Capacitor
        // We assume index.html exists in webDir. If not, capacitor will complain.
        await runCommand('npx', ['cap', 'init', 'AppBuilder', 'com.appbuilder.generated', '--web-dir', webDir], projectDir, log);

        // 5. Add Android Platform
        log('Adding Android platform...', 'command');
        await runCommand('npx', ['cap', 'add', 'android'], projectDir, log);

        // 6. Sync Capacitor
        updateStatus('ANDROID_SYNC');
        log('Syncing Capacitor...', 'command');
        await runCommand('npx', ['cap', 'sync'], projectDir, log);

        // 7. Build APK with Gradle
        updateStatus('COMPILING_APK');
        log('Compiling APK with Gradle...', 'command');
        
        const androidDir = path.join(projectDir, 'android');
        
        // Fix permissions for gradlew in Docker
        await runCommand('chmod', ['+x', 'gradlew'], androidDir, log);
        
        // Run assembleDebug
        await runCommand('./gradlew', ['assembleDebug'], androidDir, log);

        // 8. Locate and Move APK
        log('Locating generated APK...', 'info');
        const expectedApkPath = path.join(androidDir, 'app/build/outputs/apk/debug/app-debug.apk');
        
        if (fs.existsSync(expectedApkPath)) {
             const publicApkName = `app-${buildId}.apk`;
             const publicApkPath = path.join(PUBLIC_DIR, publicApkName);
             
             fs.renameSync(expectedApkPath, publicApkPath);
             
             // Generate Download URL
             // If behind a proxy (like Hugging Face), we try to construct the URL dynamically
             const protocol = req.headers['x-forwarded-proto'] || req.protocol;
             const host = req.headers['x-forwarded-host'] || req.get('host');
             
             const downloadUrl = `${protocol}://${host}/download/${publicApkName}`;
             
             updateStatus('SUCCESS');
             log('APK generated successfully!', 'success');
             sendEvent(res, { type: 'result', success: true, downloadUrl });
        } else {
            throw new Error('APK file not found at expected path after build.');
        }

    } catch (error: any) {
        console.error(error);
        updateStatus('ERROR');
        log(error.message || 'Unknown build error', 'error');
        sendEvent(res, { type: 'result', success: false, error: error.message });
    } finally {
        // Optional: cleanup
        // fs.rmSync(projectDir, { recursive: true, force: true });
        res.end();
    }
});

app.listen(PORT, () => {
    console.log(`Build Server running on port ${PORT}`);
});