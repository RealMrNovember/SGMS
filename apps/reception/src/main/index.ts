import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  Notification,
  Tray,
  nativeImage,
} from 'electron';
import path from 'path';
import Store from 'electron-store';
import { Pusher, type PusherClient } from './pusher-client';
import { apiRequest } from './api-client';
import { fetchRecentCheckIns, startCheckInPolling, stopCheckInPolling } from './check-in-poll';
import { SGMS_API_BASE_URL } from '../shared/constants';
import {
  getLaunchAtStartup,
  setLaunchAtStartup,
  shouldStartHidden,
} from './launch-at-startup';
import { initAutoUpdater, installUpdateNow } from './auto-updater';
import { enqueueCheckIn, flushQueue, getQueueStatus, onQueueStatusChange } from './offline-queue';
import type {
  CheckInNotificationPayload,
  LoginInput,
  RealtimePublicConfig,
  ReceptionConfig,
} from '../shared/types';

const store = new Store<{ config?: ReceptionConfig; theme?: 'dark' | 'light' }>({ name: 'sgms-reception' });

let tray: Tray | null = null;
let window: BrowserWindow | null = null;
let pusher: PusherClient | null = null;
let isQuitting = false;
const startHidden = shouldStartHidden();

const APP_ID = 'com.cicibyte.sgms.reception';

function resourcePath(...segments: string[]) {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'resources', ...segments);
  }
  return path.join(__dirname, '../../resources', ...segments);
}

function loadWindowIcon() {
  const icoPath = resourcePath('icon.ico');
  const ico = nativeImage.createFromPath(icoPath);
  if (!ico.isEmpty()) {
    return ico;
  }

  const pngPath = resourcePath('icon.png');
  const pngImage = nativeImage.createFromPath(pngPath);
  if (!pngImage.isEmpty()) {
    return pngImage;
  }

  return nativeImage.createEmpty();
}

function loadTrayIcon() {
  if (process.platform === 'win32') {
    const icoPath = resourcePath('icon.ico');
    const ico = nativeImage.createFromPath(icoPath);
    if (!ico.isEmpty()) {
      return ico;
    }
  }

  const pngPath = resourcePath('icon.png');
  const pngImage = nativeImage.createFromPath(pngPath);
  if (!pngImage.isEmpty()) {
    return pngImage.resize({ width: 16, height: 16 });
  }

  return nativeImage.createEmpty();
}

function orgStaffChannel(organizationId: string) {
  return `private-org.${organizationId}.staff`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

function showAccessNotification(payload: CheckInNotificationPayload) {
  if (!Notification.isSupported()) {
    return;
  }

  const isEntry = payload.direction === 'ENTRY';
  const title = `${isEntry ? 'Giriş' : 'Çıkış'} · ${payload.personName}`;
  const body = [
    formatTime(payload.checkedInAt),
    payload.subtitle,
    payload.deviceName ? payload.deviceName : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const icon = loadTrayIcon();
  const notification = new Notification({
    title,
    body,
    silent: false,
    icon: icon.isEmpty() ? undefined : icon,
  });

  notification.on('click', () => {
    window?.show();
    window?.focus();
  });

  notification.show();

  if (tray) {
    tray.setToolTip(`SGMS · ${title}`);
    setTimeout(() => tray?.setToolTip('SGMS Resepsiyon'), 4000);
  }

  if (window && !window.isDestroyed()) {
    window.webContents.send('checkin', payload);
  }
}

function forwardCheckIn(payload: CheckInNotificationPayload) {
  showAccessNotification(payload);
}

function disconnectRealtime() {
  stopCheckInPolling();
  if (pusher) {
    pusher.disconnect();
    pusher = null;
  }
}

function connectRealtime(config: ReceptionConfig) {
  disconnectRealtime();

  startCheckInPolling(config, forwardCheckIn);

  if (!config.soketiKey) {
    window?.webContents.send('status', { online: false, mode: 'polling' });
    return;
  }

  const apiUrl = new URL(config.apiBaseUrl);
  const forceTLS = config.soketiForceTLS ?? apiUrl.protocol === 'https:';
  const wsPort = config.soketiWsPort ?? (forceTLS ? 443 : 6001);
  const wssPort = config.soketiWssPort ?? 443;

  pusher = new Pusher(config.soketiKey, {
    cluster: 'sgms',
    wsHost: apiUrl.hostname,
    wsPort,
    wssPort,
    wsPath: config.soketiWsPath || '/realtime/app',
    forceTLS,
    disableStats: true,
    enabledTransports: ['ws', 'wss'],
    authEndpoint: `${config.apiBaseUrl.replace(/\/$/, '')}/api/v1/realtime/auth`,
    auth: {
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
      },
    },
  });

  const channel = pusher.subscribe(orgStaffChannel(config.organizationId));
  channel.bind('checkin.created', (data: { checkIn: CheckInNotificationPayload }) => {
    if (data?.checkIn) {
      forwardCheckIn(data.checkIn);
    }
  });
  channel.bind('pusher:subscription_error', () => {
    window?.webContents.send('status', { online: false, mode: 'polling' });
  });

  pusher.connection.bind('connected', () => {
    window?.webContents.send('status', { online: true, mode: 'realtime' });
    void flushQueue(config);
  });
  pusher.connection.bind('disconnected', () => {
    window?.webContents.send('status', { online: false, mode: 'polling' });
  });
  pusher.connection.bind('error', () => {
    window?.webContents.send('status', { online: false, mode: 'polling' });
  });
  pusher.connection.bind('unavailable', () => {
    window?.webContents.send('status', { online: false, mode: 'polling' });
  });
}

function createWindow() {
  const icon = loadWindowIcon();

  window = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1100,
    minHeight: 720,
    show: false,
    frame: false,
    backgroundColor: '#0b1220',
    icon: icon.isEmpty() ? undefined : icon,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    window.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  window.on('maximize', () => {
    window?.webContents.send('window:maximized', true);
  });
  window.on('unmaximize', () => {
    window?.webContents.send('window:maximized', false);
  });

  window.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      window?.hide();
    }
  });
}

function buildTrayMenu() {
  const launchEnabled = getLaunchAtStartup();

  return Menu.buildFromTemplate([
    {
      label: 'Kontrol Panelini Aç',
      click: () => {
        window?.show();
        window?.focus();
      },
    },
    { type: 'separator' },
    {
      label: 'Windows açılışında başlat',
      type: 'checkbox',
      checked: launchEnabled,
      click: (menuItem) => {
        const enabled = menuItem.checked;
        setLaunchAtStartup(enabled);
        window?.webContents.send('launch-at-startup', { enabled });
      },
    },
    { type: 'separator' },
    {
      label: 'Tepsiye Gizle',
      click: () => window?.hide(),
    },
    {
      label: 'Uygulamadan Çık',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);
}

function createTray() {
  const icon = loadTrayIcon();
  if (icon.isEmpty()) {
    console.error('SGMS tray icon could not be loaded from resources/icon.ico');
  }
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
  tray.setToolTip('SGMS Resepsiyon');
  tray.setContextMenu(buildTrayMenu());
  tray.on('double-click', () => {
    window?.show();
    window?.focus();
  });
}

function refreshTrayMenu() {
  tray?.setContextMenu(buildTrayMenu());
}

async function fetchRealtimeConfig(base: string): Promise<RealtimePublicConfig> {
  const res = await fetch(`${base.replace(/\/$/, '')}/api/v1/realtime/config`);
  const json = (await res.json()) as {
    ok: boolean;
    data?: RealtimePublicConfig;
    error?: string;
  };

  if (!res.ok || !json.ok || !json.data?.enabled || !json.data.key) {
    throw new Error(
      'Canlı bildirim servisi şu an kullanılamıyor. Lütfen birkaç dakika sonra tekrar deneyin veya destek ile iletişime geçin.',
    );
  }

  return json.data;
}

async function ensureRealtimeFields(config: ReceptionConfig): Promise<ReceptionConfig> {
  if (config.soketiKey) {
    return config;
  }

  const realtime = await fetchRealtimeConfig(config.apiBaseUrl);
  const next: ReceptionConfig = {
    ...config,
    soketiKey: realtime.key!,
    soketiWsPath: realtime.wsPath,
    soketiForceTLS: realtime.forceTLS,
    soketiWsPort: realtime.wsPort,
    soketiWssPort: realtime.wssPort,
  };
  store.set('config', next);
  return next;
}

async function loginAndConnect(input: LoginInput): Promise<ReceptionConfig> {
  const base = SGMS_API_BASE_URL.replace(/\/$/, '');
  const realtime = await fetchRealtimeConfig(base);

  const res = await fetch(`${base}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: input.email, password: input.password, scope: 'staff' }),
  });
  const json = (await res.json()) as {
    ok: boolean;
    data?: { accessToken: string };
    error?: string;
  };

  if (!res.ok || !json.ok || !json.data?.accessToken) {
    throw new Error(json.error ?? 'E-posta veya parola hatalı');
  }

  const meRes = await fetch(`${base}/api/v1/me`, {
    headers: { Authorization: `Bearer ${json.data.accessToken}` },
  });
  const meJson = (await meRes.json()) as {
    ok: boolean;
    data?: {
      user: { name: string };
      organization: { id: string; name: string };
    };
    error?: string;
  };

  if (!meRes.ok || !meJson.ok || !meJson.data?.organization?.id) {
    throw new Error(meJson.error ?? 'Personel profili alınamadı');
  }

  const config: ReceptionConfig = {
    apiBaseUrl: base,
    accessToken: json.data.accessToken,
    organizationId: meJson.data.organization.id,
    organizationName: meJson.data.organization.name,
    soketiKey: realtime.key!,
    soketiWsPath: realtime.wsPath,
    soketiForceTLS: realtime.forceTLS,
    soketiWsPort: realtime.wsPort,
    soketiWssPort: realtime.wssPort,
    userName: meJson.data.user.name,
  };

  store.set('config', config);

  try {
    const recent = await fetchRecentCheckIns(config);
    window?.webContents.send('feed-init', recent);
    connectRealtime(config);
  } catch (error) {
    console.error('SGMS realtime connection failed after login', error);
    window?.webContents.send('status', { online: false });
  }

  if (!getLaunchAtStartup()) {
    setLaunchAtStartup(true);
    refreshTrayMenu();
    window?.webContents.send('launch-at-startup', { enabled: true });
  }

  return config;
}

ipcMain.handle('login', async (_event, input: LoginInput) => loginAndConnect(input));
ipcMain.handle('api-request', async (_event, payload: { method: string; path: string; body?: unknown }) => {
  const config = store.get('config');
  if (!config?.accessToken) {
    return { ok: false, status: 401, error: 'Oturum bulunamadı' };
  }

  const result = await apiRequest(config, payload.method, payload.path, payload.body);

  // Faz 19.4 — yalnızca manuel check-in için offline kuyruk: ağ hatası (status 0)
  // durumunda kayıp olmasın diye kalıcı kuyruğa alınır, arayüze "kuyruğa alındı"
  // bilgisi (queued: true) dönülür — sert bir hata gibi gösterilmez.
  if (!result.ok && result.status === 0 && payload.method === 'POST' && payload.path === '/api/v1/check-in') {
    const body = payload.body as { gymMemberId?: string; direction?: 'ENTRY' | 'EXIT' } | undefined;
    if (body?.gymMemberId && body.direction) {
      enqueueCheckIn(body.gymMemberId, body.direction);
      return { ok: true, status: 202, data: { queued: true } };
    }
  }

  return result;
});
ipcMain.handle('fetch-recent-checkins', async () => {
  const config = store.get('config');
  if (!config?.accessToken) {
    return { items: [], todayCount: 0 };
  }
  return fetchRecentCheckIns(config);
});
ipcMain.handle('logout', async () => {
  store.delete('config');
  disconnectRealtime();
});
ipcMain.handle('get-config', async () => store.get('config'));
ipcMain.handle('window:minimize', () => window?.minimize());
ipcMain.handle('window:hide', () => window?.hide());
ipcMain.handle('window:toggle-maximize', () => {
  if (!window) return false;
  if (window.isMaximized()) {
    window.unmaximize();
    return false;
  }
  window.maximize();
  return true;
});
ipcMain.handle('window:is-maximized', () => window?.isMaximized() ?? false);
ipcMain.handle('get-launch-at-startup', async () => getLaunchAtStartup());
ipcMain.handle('set-launch-at-startup', async (_event, enabled: boolean) => {
  const next = setLaunchAtStartup(enabled);
  refreshTrayMenu();
  return next;
});
ipcMain.handle('install-update-now', async () => installUpdateNow());
ipcMain.handle('get-queue-status', async () => getQueueStatus());
ipcMain.handle('get-theme', async () => store.get('theme', 'dark'));
ipcMain.handle('set-theme', async (_event, theme: 'dark' | 'light') => {
  store.set('theme', theme);
  return theme;
});

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    window?.show();
    window?.focus();
  });
}

if (process.platform === 'win32') {
  app.setAppUserModelId(APP_ID);
}

app.whenReady().then(async () => {
  createWindow();
  createTray();

  // Faz 19.3 — geliştirme ortamında (paketlenmemiş) autoUpdater'ın "app not packaged"
  // hatası atmasını önlemek için yalnızca paketlenmiş (kurulmuş) sürümde etkinleştirilir.
  if (app.isPackaged) {
    initAutoUpdater(() => window);
  }

  // Faz 19.4 — Pusher yeniden bağlandığında (`connected` event) zaten flush tetikleniyor;
  // bu, polling modunda (Soketi hiç bağlanamadığında) veya Pusher'ın "connected" event'i
  // kaçırıldığı nadir durumlarda bir güvenlik ağı olarak periyodik yeniden dener.
  onQueueStatusChange((status) => {
    window?.webContents.send('queue-status', status);
  });
  setInterval(() => {
    const config = store.get('config');
    if (config?.accessToken) {
      void flushQueue(config);
    }
  }, 30_000);

  const saved = store.get('config');
  if (saved?.accessToken) {
    try {
      const ready = await ensureRealtimeFields({
        ...saved,
        apiBaseUrl: saved.apiBaseUrl || SGMS_API_BASE_URL,
      });
      const recent = await fetchRecentCheckIns(ready);
      connectRealtime(ready);
      window?.webContents.once('did-finish-load', () => {
        window?.webContents.send('logged-in', ready);
        window?.webContents.send('feed-init', recent);
        window?.webContents.send('launch-at-startup', { enabled: getLaunchAtStartup() });
        if (!startHidden) {
          window?.show();
        }
      });
    } catch {
      store.delete('config');
      if (!startHidden) {
        window?.show();
      }
    }
  } else if (!startHidden) {
    window?.show();
  } else {
    window?.webContents.once('did-finish-load', () => {
      window?.show();
    });
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  disconnectRealtime();
});

app.on('window-all-closed', () => {
  // Tepsi modunda kal
});
