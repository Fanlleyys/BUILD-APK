import { BuildStatus } from '../types';

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://fanlley-apk-builder.hf.space';

// Tambahin parameter baru di interface function
export const startBuildStream = (
  repoUrl: string,
  settings: {
    appName: string;
    appId: string;
    orientation: string;
    iconUrl: string;
    fullscreen: boolean;
  },
  onLog: (msg: string) => void,
  onStatus: (status: BuildStatus) => void,
  onSuccess: (downloadUrl: string) => void,
  onError: (error: string) => void
) => {
  const cleanUrl = BASE_URL.replace(/\/$/, '');
  
  // Bikin Query String yang panjang
  const queryParams = new URLSearchParams({
    repoUrl: repoUrl,
    appName: settings.appName,
    appId: settings.appId,
    orientation: settings.orientation,
    iconUrl: settings.iconUrl,
    fullscreen: settings.fullscreen.toString()
  }).toString();

  const eventSource = new EventSource(`${cleanUrl}/api/build/stream?${queryParams}`);

  eventSource.onopen = () => { onLog('🔌 Connecting to Build Server...'); };

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'log') onLog(data.log.message);
      if (data.type === 'status') {
        switch (data.status) {
            case 'CLONING': onStatus(BuildStatus.CLONING); break;
            case 'INSTALLING': onStatus(BuildStatus.INSTALLING); break;
            case 'BUILDING_WEB': onStatus(BuildStatus.BUILDING_WEB); break;
            case 'CAPACITOR_INIT': case 'ANDROID_SYNC': onStatus(BuildStatus.CAPACITOR); break;
            case 'COMPILING_APK': onStatus(BuildStatus.GRADLE); break;
            case 'SUCCESS': onStatus(BuildStatus.SUCCESS); break;
            case 'ERROR': onStatus(BuildStatus.ERROR); break;
        }
      }
      if (data.type === 'result' && data.success) { onSuccess(data.downloadUrl); eventSource.close(); }
      if (data.type === 'result' && !data.success) { onError(data.error || 'Unknown error'); eventSource.close(); }
    } catch (e) { console.error(e); }
  };

  eventSource.onerror = (err) => {
    if (eventSource.readyState === EventSource.CLOSED) onError('Connection lost.');
    eventSource.close();
  };

  return () => { eventSource.close(); };
};