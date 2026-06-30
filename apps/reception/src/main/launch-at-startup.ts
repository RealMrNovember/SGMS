import Store from 'electron-store';
import { app } from 'electron';

type LaunchStore = {
  launchAtStartup?: boolean;
};

const store = new Store<LaunchStore>({ name: 'sgms-reception-preferences' });

export function getLaunchAtStartup(): boolean {
  return store.get('launchAtStartup', false);
}

export function setLaunchAtStartup(enabled: boolean): boolean {
  if (process.platform !== 'win32' && process.platform !== 'darwin') {
    store.set('launchAtStartup', false);
    return false;
  }

  store.set('launchAtStartup', enabled);

  app.setLoginItemSettings({
    openAtLogin: enabled,
    path: process.execPath,
    args: enabled ? ['--tray'] : [],
    name: 'SGMS Resepsiyon',
  });

  return enabled;
}

export function shouldStartHidden(argv: string[] = process.argv): boolean {
  return argv.includes('--tray') || argv.includes('--hidden');
}
