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

// Limit gede biar bisa upload icon base64
app.use(express.json({ limit: '50mb' }) as any);
app.use(express.urlencoded({ limit: '50mb', extended: true }) as any);

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));

const WORKSPACE_DIR = path.join(__dirname, 'workspace');
const PUBLIC_DIR = path.join(__dirname, 'public');

if (!fs.existsSync(WORKSPACE_DIR)) fs.mkdirSync(WORKSPACE_DIR, { recursive: true, mode: 0o777 });
if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true, mode: 0o777 });

app.get('/', (req, res) => {
    res.status(200).send('AppBuilder-AI v5.0 (Ultimate Edition) is Running. 🚀');
});
app.use('/download', express.static(PUBLIC_DIR) as any);

const sendEvent = (res: any, data: any) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
};

function runCommand(
    command: string,
    args: string[],
    cwd: string,
    logFn?: (msg: string, type: 'info' | 'error' | 'command' | 'success') => void
): Promise<void> {
    return new Promise((resolve, reject) => {
        if (logFn) logFn(`${command} ${args.join(' ')}`, 'info');
        const child = spawn(command, args, {
            cwd,
            shell: true,
            env: { ...process.env, CI: 'true', TERM: 'dumb' }
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
            if (code === 0) resolve();
            else reject(new Error(`Command "${command}" failed with exit code ${code}`));
        });
        child.on('error', (err) => reject(err));
    });
}

app.post('/api/build/stream', async (req, res) => {
    const { repoUrl, appName, appId, orientation, iconUrl, fullscreen, versionCode, versionName } = req.body;

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
    const isFullscreen = fullscreen === true || fullscreen === 'true';
    const vCode = (versionCode as string) || '1';
    const vName = (versionName as string) || '1.0';

    const buildId = uuidv4();
    const projectDir = path.join(WORKSPACE_DIR, buildId);

    const log = (
        message: string,
        type: 'info' | 'command' | 'error' | 'success' = 'info'
    ) => {
        sendEvent(res, {
            type: 'log',
            log: {
                id: uuidv4(),
                timestamp: new Date().toLocaleTimeString(),
                message,
                type
            }
        });
    };
    const updateStatus = (status: string) => {
        sendEvent(res, { type: 'status', status });
    };

    try {
        if (!fs.existsSync(projectDir)) fs.mkdirSync(projectDir, { recursive: true });

        log(`Starting build process ID: ${buildId}`, 'info');
        log(`Config: ${finalAppName} | Fullscreen: ${isFullscreen}`, 'info');

        // 1) Clone repo
        updateStatus('CLONING');
        log(`Cloning ${repoUrl}...`, 'command');
        await runCommand('git', ['clone', repoUrl, '.'], projectDir, log);

        // 2) Deteksi mode: Node.js (ada package.json) vs Static HTML
        const pkgPath = path.join(projectDir, 'package.json');
        const hasPackageJson = fs.existsSync(pkgPath);

        // default webDir untuk project modern
        let webDir = 'dist';

        if (hasPackageJson) {
            // MODE NODE / REACT / VUE
            log('✅ Detected package.json. Using Node.js Build Mode.', 'success');

            updateStatus('INSTALLING');
            log('Installing dependencies...', 'command');
            await runCommand('npm', ['install'], projectDir, log);

            updateStatus('BUILDING_WEB');
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

            if (pkg.scripts && pkg.scripts.build) {
                log('Running build script...', 'command');
                await runCommand('npm', ['run', 'build'], projectDir, log);

                // Auto detect output folder
                if (fs.existsSync(path.join(projectDir, 'dist'))) webDir = 'dist';
                else if (fs.existsSync(path.join(projectDir, 'build'))) webDir = 'build';
                else if (fs.existsSync(path.join(projectDir, 'out'))) webDir = 'out';
                else {
                    // fallback: root
                    webDir = '.';
                    log('Build output folder not found, fallback to root (.).', 'info');
                }
            } else {
                log('No build script found. Using root directory as webDir.', 'info');
                webDir = '.';
            }
        } else {
            // MODE STATIC HTML / GAME SEDERHANA
            log('⚠️ No package.json found. Switching to Static HTML Mode.', 'success');
            log('Skipping npm install & build. Using raw files.', 'info');

            // Bikin package.json dummy biar npm & Capacitor gak error
            await runCommand('npm', ['init', '-y'], projectDir, log);

            // Kita pakai folder "web" sebagai webDir
            webDir = 'web';
            const webDirPath = path.join(projectDir, webDir);
            if (!fs.existsSync(webDirPath)) {
                fs.mkdirSync(webDirPath);
            }

            // Pindahkan semua file/folder web ke dalam "web" (kecuali yang penting)
            const blacklist = new Set([
                'web',
                'android',
                'node_modules',
                '.git',
                'workspace',
                'public',
                'package.json',
                'package-lock.json',
                'pnpm-lock.yaml',
                'yarn.lock'
            ]);

            const entries = fs.readdirSync(projectDir);

            for (const entry of entries) {
                if (blacklist.has(entry)) continue;

                const fromPath = path.join(projectDir, entry);
                const toPath = path.join(webDirPath, entry);

                fs.renameSync(fromPath, toPath);
            }

            log(`Static HTML assets moved into /${webDir}`, 'info');
        }

        // 3) Inject Safe Area (biar gak nabrak status bar)
        if (!isFullscreen) {
            log('Injecting Safe-Area Logic (Meta + CSS)...', 'info');
            const indexHtmlPath =
                webDir === '.'
                    ? path.join(projectDir, 'index.html')
                    : path.join(projectDir, webDir, 'index.html');

            if (fs.existsSync(indexHtmlPath)) {
                let htmlContent = fs.readFileSync(indexHtmlPath, 'utf-8');

                // Inject viewport-fit=cover
                if (htmlContent.includes('<meta name="viewport"')) {
                    htmlContent = htmlContent.replace(
                        '<meta name="viewport" content="',
                        '<meta name="viewport" content="viewport-fit=cover, '
                    );
                } else {
                    htmlContent = htmlContent.replace(
                        '<head>',
                        '<head><meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">'
                    );
                }

                // Inject CSS padding safe area
                const safeAreaCSS = `
                <style>
                    :root { --sat: env(safe-area-inset-top, 35px); }
                    body {
                        padding-top: var(--sat) !important;
                        background-color: #000000;
                        min-height: 100vh;
                        box-sizing: border-box;
                    }
                    #root, #app, #__next { padding-top: 0px !important; }
                </style>
                `;

                if (htmlContent.includes('</head>')) {
                    htmlContent = htmlContent.replace('</head>', `${safeAreaCSS}</head>`);
                    fs.writeFileSync(indexHtmlPath, htmlContent);
                    log('Safe-Area Logic Injected Successfully!', 'success');
                }
            } else {
                log('index.html not found for Safe-Area injection.', 'error');
            }
        }

        // 4) Install Capacitor
        log('Injecting Capacitor...', 'command');
        await runCommand(
            'npm',
            ['install', '@capacitor/core', '@capacitor/cli', '@capacitor/android', '--save-dev'],
            projectDir,
            log
        );

        // 5) Init Capacitor
        updateStatus('CAPACITOR_INIT');
        log(`Initializing Capacitor (WebDir: ${webDir})...`, 'command');
        await runCommand(
            'npx',
            ['cap', 'init', `"${finalAppName}"`, finalAppId, '--web-dir', webDir],
            projectDir,
            log
        );

        log('Adding Android platform...', 'command');
        await runCommand('npx', ['cap', 'add', 'android'], projectDir, log);

        // 6) Custom Android XML / Gradle
        log('Applying custom settings...', 'info');
        const androidManifestPath = path.join(projectDir, 'android/app/src/main/AndroidManifest.xml');
        const stylesPath = path.join(projectDir, 'android/app/src/main/res/values/styles.xml');
        const buildGradlePath = path.join(projectDir, 'android/app/build.gradle');

        // Versioning
        await runCommand(
            `sed -i 's/versionCode 1/versionCode ${vCode}/g' ${buildGradlePath}`,
            [],
            projectDir
        );
        await runCommand(
            `sed -i 's/versionName "1.0"/versionName "${vName}"/g' ${buildGradlePath}`,
            [],
            projectDir
        );

        // Orientation
        if (finalOrientation !== 'user') {
            await runCommand(
                `sed -i 's/<activity/<activity android:screenOrientation="${finalOrientation}"/g' ${androidManifestPath}`,
                [],
                projectDir,
                log
            );
        }

        // Layout (Fullscreen vs Safe Area)
        if (isFullscreen) {
            log('Mode: Fullscreen (Immersive)', 'info');
            await runCommand(
                `sed -i 's|parent="AppTheme.NoActionBar"|parent="Theme.AppCompat.NoActionBar.FullScreen"|g' ${stylesPath}`,
                [],
                projectDir,
                log
            );
            await runCommand(
                `sed -i 's|</style>|<item name="android:windowFullscreen">true</item></style>|g' ${stylesPath}`,
                [],
                projectDir,
                log
            );
        } else {
            log('Mode: Safe Area (Solid Status Bar)', 'info');
            const styleFix = [
                '<item name="android:windowFullscreen">false</item>',
                '<item name="android:windowTranslucentStatus">false</item>',
                '<item name="android:fitsSystemWindows">true</item>',
                '<item name="android:statusBarColor">@android:color/black</item>',
                '<item name="android:windowLightStatusBar">false</item>'
            ].join('');
            await runCommand(
                `sed -i 's|parent="AppTheme.NoActionBar"|parent="Theme.AppCompat.NoActionBar"|g' ${stylesPath}`,
                [],
                projectDir,
                log
            );
            await runCommand(
                `sed -i 's|</style>|${styleFix}</style>|g' ${stylesPath}`,
                [],
                projectDir,
                log
            );
        }

        // 7) Sync Capacitor
        updateStatus('ANDROID_SYNC');
        await runCommand('npx', ['cap', 'sync'], projectDir, log);

        // 8) ICON HANDLING (URL & BASE64)
        if (iconUrl && typeof iconUrl === 'string') {
            const resDir = path.join(projectDir, 'android/app/src/main/res');
            const folders = ['mipmap-mdpi', 'mipmap-hdpi', 'mipmap-xhdpi', 'mipmap-xxhdpi', 'mipmap-xxxhdpi'];

            const adaptiveIconDir = path.join(resDir, 'mipmap-anydpi-v26');
            if (fs.existsSync(adaptiveIconDir)) {
                fs.rmSync(adaptiveIconDir, { recursive: true, force: true });
                log('Removed default adaptive icons to force custom icon.', 'info');
            }

            if (iconUrl.startsWith('http')) {
                log('Downloading custom icon from URL...', 'command');
                for (const folder of folders) {
                    const target = path.join(resDir, folder, 'ic_launcher.png');
                    const targetRound = path.join(resDir, folder, 'ic_launcher_round.png');
                    await runCommand(`curl -L "${iconUrl}" -o ${target}`, [], projectDir);
                    await runCommand(`cp ${target} ${targetRound}`, [], projectDir);
                }
            } else if (iconUrl.startsWith('data:image')) {
                log('Processing uploaded icon (Base64)...', 'command');
                try {
                    const base64Data = iconUrl.split(';base64,').pop();
                    if (base64Data) {
                        const iconBuffer = Buffer.from(base64Data, 'base64');
                        const tempIconPath = path.join(projectDir, 'temp_icon.png');
                        fs.writeFileSync(tempIconPath, iconBuffer);

                        for (const folder of folders) {
                            const target = path.join(resDir, folder, 'ic_launcher.png');
                            const targetRound = path.join(resDir, folder, 'ic_launcher_round.png');
                            fs.copyFileSync(tempIconPath, target);
                            fs.copyFileSync(tempIconPath, targetRound);
                        }
                        log('Custom icon applied successfully!', 'success');
                    }
                } catch (err) {
                    log('Failed to process custom icon. Using default.', 'error');
                }
            }
        }

        // 9) BUILD APK
        updateStatus('COMPILING_APK');
        log('Compiling APK with Gradle...', 'command');
        const androidDir = path.join(projectDir, 'android');
        await runCommand('chmod', ['+x', 'gradlew'], androidDir, log);
        await runCommand('./gradlew', ['assembleDebug'], androidDir, log);

        // 10) MOVE APK KE PUBLIC
        log('Locating generated APK...', 'info');
        const expectedApkPath = path.join(
            androidDir,
            'app/build/outputs/apk/debug/app-debug.apk'
        );

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

app.listen(PORT, () => {
    console.log(`Build Server running on port ${PORT}`);
});