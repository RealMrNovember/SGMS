/// <reference types="vite/client" />

import type { CheckInNotificationPayload, LoginInput, ReceptionConfig } from '../../../shared/types';

declare module '*.svg' {
  const src: string;
  export default src;
}

declare global {
  interface Window {
    reception: {
      login: (input: LoginInput) => Promise<ReceptionConfig>;
      logout: () => Promise<void>;
      getConfig: () => Promise<ReceptionConfig | undefined>;
      apiRequest: (
        method: string,
        path: string,
        body?: unknown,
      ) => Promise<{ ok: boolean; status: number; data?: unknown; error?: string }>;
      fetchRecentCheckins: () => Promise<{ items: CheckInNotificationPayload[]; todayCount: number }>;
      minimize: () => Promise<void>;
      hideToTray: () => Promise<void>;
      toggleMaximize: () => Promise<boolean>;
      isMaximized: () => Promise<boolean>;
      getLaunchAtStartup: () => Promise<boolean>;
      setLaunchAtStartup: (enabled: boolean) => Promise<boolean>;
      onCheckIn: (handler: (payload: CheckInNotificationPayload) => void) => void;
      onFeedInit: (handler: (payload: { items: CheckInNotificationPayload[]; todayCount: number }) => void) => void;
      onStatus: (handler: (payload: { online: boolean; mode?: 'realtime' | 'polling' }) => void) => void;
      onLoggedIn: (handler: (config: ReceptionConfig) => void) => void;
      onLaunchAtStartup: (handler: (payload: { enabled: boolean }) => void) => void;
      onMaximizedChange: (handler: (maximized: boolean) => void) => void;
    };
  }
}

export {};
