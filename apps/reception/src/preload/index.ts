import { contextBridge, ipcRenderer } from 'electron';
import type { CheckInNotificationPayload, LoginInput, ReceptionConfig } from '../shared/types';

contextBridge.exposeInMainWorld('reception', {
  login: (input: LoginInput) => ipcRenderer.invoke('login', input) as Promise<ReceptionConfig>,
  logout: () => ipcRenderer.invoke('logout') as Promise<void>,
  getConfig: () => ipcRenderer.invoke('get-config') as Promise<ReceptionConfig | undefined>,
  apiRequest: (method: string, path: string, body?: unknown) =>
    ipcRenderer.invoke('api-request', { method, path, body }),
  fetchRecentCheckins: () =>
    ipcRenderer.invoke('fetch-recent-checkins') as Promise<{ items: CheckInNotificationPayload[]; todayCount: number }>,
  minimize: () => ipcRenderer.invoke('window:minimize'),
  hideToTray: () => ipcRenderer.invoke('window:hide'),
  toggleMaximize: () => ipcRenderer.invoke('window:toggle-maximize') as Promise<boolean>,
  isMaximized: () => ipcRenderer.invoke('window:is-maximized') as Promise<boolean>,
  getLaunchAtStartup: () => ipcRenderer.invoke('get-launch-at-startup') as Promise<boolean>,
  setLaunchAtStartup: (enabled: boolean) =>
    ipcRenderer.invoke('set-launch-at-startup', enabled) as Promise<boolean>,
  onCheckIn: (handler: (payload: CheckInNotificationPayload) => void) => {
    ipcRenderer.on('checkin', (_event, payload: CheckInNotificationPayload) => handler(payload));
  },
  onFeedInit: (handler: (payload: { items: CheckInNotificationPayload[]; todayCount: number }) => void) => {
    ipcRenderer.on('feed-init', (_event, payload) => handler(payload));
  },
  onStatus: (handler: (payload: { online: boolean; mode?: 'realtime' | 'polling' }) => void) => {
    ipcRenderer.on('status', (_event, payload) => handler(payload));
  },
  onLoggedIn: (handler: (config: ReceptionConfig) => void) => {
    ipcRenderer.on('logged-in', (_event, config: ReceptionConfig) => handler(config));
  },
  onLaunchAtStartup: (handler: (payload: { enabled: boolean }) => void) => {
    ipcRenderer.on('launch-at-startup', (_event, payload: { enabled: boolean }) => handler(payload));
  },
  onMaximizedChange: (handler: (maximized: boolean) => void) => {
    ipcRenderer.on('window:maximized', (_event, maximized: boolean) => handler(maximized));
  },
});
