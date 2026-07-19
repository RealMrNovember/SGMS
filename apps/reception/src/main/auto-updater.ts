import { autoUpdater } from 'electron-updater';
import type { BrowserWindow } from 'electron';

export type UpdateStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'available'; version: string }
  | { state: 'not-available' }
  | { state: 'downloading'; percent: number }
  | { state: 'downloaded'; version: string }
  | { state: 'error'; message: string };

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 saatte bir arka planda kontrol

let getWindow: (() => BrowserWindow | null) | null = null;

function send(status: UpdateStatus) {
  const window = getWindow?.();
  if (window && !window.isDestroyed()) {
    window.webContents.send('update-status', status);
  }
}

/**
 * Faz 19.3 — kullanıcı hiçbir şey yapmadan (en fazla bir yeniden başlatmayla) güncel
 * kalmalı. `autoDownload: true` ile yeni sürüm sessizce arka planda iner; kuruluma
 * ise yalnızca uygulama kapanırken (`autoInstallOnAppQuit`) veya kullanıcı "şimdi
 * yeniden başlat" derse geçilir — resepsiyon çalışırken aniden yeniden başlamaz.
 */
export function initAutoUpdater(windowGetter: () => BrowserWindow | null): void {
  getWindow = windowGetter;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = console;

  autoUpdater.on('checking-for-update', () => send({ state: 'checking' }));
  autoUpdater.on('update-available', (info) => send({ state: 'available', version: info.version }));
  autoUpdater.on('update-not-available', () => send({ state: 'not-available' }));
  autoUpdater.on('download-progress', (progress) => {
    send({ state: 'downloading', percent: Math.round(progress.percent) });
  });
  autoUpdater.on('update-downloaded', (info) => send({ state: 'downloaded', version: info.version }));
  autoUpdater.on('error', (error) => {
    console.error('[auto-updater]', error);
    send({ state: 'error', message: error.message });
  });

  const checkNow = () => {
    autoUpdater.checkForUpdates().catch((error) => {
      console.error('[auto-updater] checkForUpdates failed', error);
    });
  };

  // İlk kontrol, uygulama tamamen ayağa kalktıktan birkaç saniye sonra — açılışı
  // yavaşlatmamak için.
  setTimeout(checkNow, 10_000);
  setInterval(checkNow, CHECK_INTERVAL_MS);
}

/** Kullanıcı "Şimdi yeniden başlat" derse (indirilmiş bir güncelleme varsa) çağrılır. */
export function installUpdateNow(): void {
  autoUpdater.quitAndInstall();
}
