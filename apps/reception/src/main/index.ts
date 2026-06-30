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
import Pusher from 'pusher-js';
import {
  getLaunchAtStartup,
  setLaunchAtStartup,
  shouldStartHidden,
} from './launch-at-startup';
import type { CheckInNotificationPayload, LoginInput, ReceptionConfig } from '../shared/types';

const store = new Store<{ config?: ReceptionConfig }>({ name: 'sgms-reception' });

let tray: Tray | null = null;
let window: BrowserWindow | null = null;
let pusher: Pusher | null = null;
let isQuitting = false;
const startHidden = shouldStartHidden();

const APP_ID = 'com.cicibyte.sgms.reception';

function resourcePath(...segments: string[]) {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'resources', ...segments);
  }
  return path.join(__dirname, '../../resources', ...segments);
}

function loadAppIcon() {
  const pngPath = resourcePath('icon.png');
  const pngImage = nativeImage.createFromPath(pngPath);
  if (!pngImage.isEmpty()) {
    return pngImage.resize({ width: 32, height: 32 });
  }

  const svgPath = resourcePath('logo.svg');
  const svgImage = nativeImage.createFromPath(svgPath);
  if (!svgImage.isEmpty()) {
    return svgImage.resize({ width: 32, height: 32 });
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

  const icon = loadAppIcon();
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

function disconnectRealtime() {
  if (pusher) {
    pusher.disconnect();
    pusher = null;
  }
}

function connectRealtime(config: ReceptionConfig) {
  disconnectRealtime();

  const apiUrl = new URL(config.apiBaseUrl);
  const forceTLS = apiUrl.protocol === 'https:';

  pusher = new Pusher(config.soketiKey, {
    cluster: 'sgms',
    wsHost: apiUrl.hostname,
    wsPort: forceTLS ? 443 : 6001,
    wssPort: 443,
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
      showAccessNotification(data.checkIn);
    }
  });

  pusher.connection.bind('connected', () => {
    window?.webContents.send('status', { online: true });
  });
  pusher.connection.bind('disconnected', () => {
    window?.webContents.send('status', { online: false });
  });
  pusher.connection.bind('error', () => {
    window?.webContents.send('status', { online: false });
  });
}

function createWindow() {
  const icon = loadAppIcon();

  window = new BrowserWindow({
    width: 980,
    height: 680,
    minWidth: 900,
    minHeight: 620,
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
  const icon = loadAppIcon();
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

async function loginAndConnect(input: LoginInput): Promise<ReceptionConfig> {
  const base = input.apiBaseUrl.replace(/\/$/, '');
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
    throw new Error(json.error ?? 'Giriş başarısız');
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
    soketiKey: input.soketiKey,
    soketiWsPath: input.soketiWsPath,
    userName: meJson.data.user.name,
  };

  store.set('config', config);
  connectRealtime(config);

  if (!getLaunchAtStartup()) {
    setLaunchAtStartup(true);
    refreshTrayMenu();
    window?.webContents.send('launch-at-startup', { enabled: true });
  }

  return config;
}

ipcMain.handle('login', async (_event, input: LoginInput) => loginAndConnect(input));
ipcMain.handle('logout', async () => {
  store.delete('config');
  disconnectRealtime();
});
ipcMain.handle('get-config', async () => store.get('config'));
ipcMain.handle('window:minimize', () => window?.minimize());
ipcMain.handle('window:hide', () => window?.hide());
ipcMain.handle('get-launch-at-startup', async () => getLaunchAtStartup());
ipcMain.handle('set-launch-at-startup', async (_event, enabled: boolean) => {
  const next = setLaunchAtStartup(enabled);
  refreshTrayMenu();
  return next;
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

app.whenReady().then(() => {
  createWindow();
  createTray();

  const saved = store.get('config');
  if (saved?.accessToken && saved.soketiKey) {
    connectRealtime(saved);
    window?.webContents.once('did-finish-load', () => {
      window?.webContents.send('logged-in', saved);
      window?.webContents.send('launch-at-startup', { enabled: getLaunchAtStartup() });
      if (!startHidden) {
        window?.show();
      }
    });
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
