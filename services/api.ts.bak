import { BuildStatus } from '../types';

// Ambil URL dari ENV Vercel, atau fallback ke link HF kamu
const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://fanlley-apk-builder.hf.space';

export const startBuildStream = (
  repoUrl: string,
  onLog: (msg: string) => void,
  onStatus: (status: BuildStatus) => void,
  onSuccess: (downloadUrl: string) => void,
  onError: (error: string) => void
) => {
  // 1. Bersihkan URL (Hapus slash di akhir jika ada)
  const cleanUrl = BASE_URL.replace(/\/$/, '');
  
  // 2. Buka Koneksi Streaming (SSE) ke endpoint baru
  const eventSource = new EventSource(`${cleanUrl}/api/build/stream?repoUrl=${encodeURIComponent(repoUrl)}`);

  eventSource.onopen = () => {
    onLog('🔌 Connecting to Build Server...');
  };

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);

      // A. Handle Log Masuk
      if (data.type === 'log') {
        onLog(data.log.message);
      }
      
      // B. Handle Status Berubah
      if (data.type === 'status') {
        // Mapping status dari server ke Enum Frontend
        switch (data.status) {
            case 'CLONING': onStatus(BuildStatus.CLONING); break;
            case 'INSTALLING': onStatus(BuildStatus.INSTALLING); break;
            case 'BUILDING_WEB': onStatus(BuildStatus.BUILDING_WEB); break;
            case 'CAPACITOR_INIT': onStatus(BuildStatus.CAPACITOR); break;
            case 'ANDROID_SYNC': onStatus(BuildStatus.CAPACITOR); break;
            case 'COMPILING_APK': onStatus(BuildStatus.GRADLE); break;
            case 'SUCCESS': onStatus(BuildStatus.SUCCESS); break;
            case 'ERROR': onStatus(BuildStatus.ERROR); break;
            default: break;
        }
      }

      // C. Handle Sukses (Dapet Link Download)
      if (data.type === 'result' && data.success) {
        onSuccess(data.downloadUrl);
        eventSource.close(); // Tutup koneksi
      }

      // D. Handle Error dari Server
      if (data.type === 'result' && !data.success) {
        onError(data.error || 'Unknown build error');
        eventSource.close();
      }

    } catch (e) {
      console.error('Parse error:', e);
    }
  };

  eventSource.onerror = (err) => {
    console.error('EventSource failed:', err);
    // Jangan langsung error kalau baru connect (kadang browser retry)
    if (eventSource.readyState === EventSource.CLOSED) {
        onError('Connection to Build Server lost. Please check if Hugging Face Space is running.');
    }
    eventSource.close();
  };

  // Return fungsi buat batalin build (cleanup)
  return () => {
    eventSource.close();
  };
};