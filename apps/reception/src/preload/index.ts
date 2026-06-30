import { contextBridge, ipcRenderer } from 'electron';
import type { CheckInNotificationPayload, LoginInput, ReceptionConfig } from '../shared/types';

contextBridge.exposeInMainWorld('reception', {
  login: (input: LoginInput) => ipcRenderer.invoke('login', input) as Promise<ReceptionConfig>,
  logout: () => ipcRenderer.invoke('logout') as Promise<void>,
  getConfig: () => ipcRenderer.invoke('get-config') as Promise<ReceptionConfig | undefined>,
  minimize: () => ipcRenderer.invoke('window:minimize'),
  hideToTray: () => ipcRenderer.invoke('window:hide'),
  getLaunchAtStartup: () => ipcRenderer.invoke('get-launch-at-startup') as Promise<boolean>,
  setLaunchAtStartup: (enabled: boolean) =>
    ipcRenderer.invoke('set-launch-at-startup', enabled) as Promise<boolean>,
  onCheckIn: (handler: (payload: CheckInNotificationPayload) => void) => {
    ipcRenderer.on('checkin', (_event, payload: CheckInNotificationPayload) => handler(payload));
  },
  onStatus: (handler: (payload: { online: boolean }) => void) => {
    ipcRenderer.on('status', (_event, payload: { online: boolean }) => handler(payload));
  },
  onLoggedIn: (handler: (config: ReceptionConfig) => void) => {
    ipcRenderer.on('logged-in', (_event, config: ReceptionConfig) => handler(config));
  },
  onLaunchAtStartup: (handler: (payload: { enabled: boolean }) => void) => {
    ipcRenderer.on('launch-at-startup', (_event, payload: { enabled: boolean }) => handler(payload));
  },
});
