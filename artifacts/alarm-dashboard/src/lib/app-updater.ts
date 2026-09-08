import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor, registerPlugin } from '@capacitor/core';

type BuzzerUpdaterPlugin = {
  installUpdate(options: { apkUrl: string }): Promise<{ started: boolean }>;
};

export type AppUpdateInfo = {
  currentVersionCode: number;
  latestVersionCode: number;
  latestVersionName: string;
  apkUrl: string;
  notes?: string;
  available: boolean;
};

type UpdateManifest = {
  versionCode: number;
  versionName: string;
  apkUrl: string;
  notes?: string;
};

const BuzzerUpdater = registerPlugin<BuzzerUpdaterPlugin>('BuzzerUpdater');
const DEFAULT_APP_ORIGIN = 'https://flow-net-web-production.up.railway.app';

function apiOrigin() {
  const apiBase = import.meta.env.VITE_API_URL as string | undefined;
  if (!apiBase || apiBase.startsWith('/')) {
    return Capacitor.isNativePlatform() ? DEFAULT_APP_ORIGIN : window.location.origin;
  }

  const url = new URL(apiBase);
  if (url.pathname.endsWith('/api')) {
    url.pathname = url.pathname.slice(0, -4) || '/';
  }
  return url.origin;
}

function absoluteUrl(pathOrUrl: string) {
  return new URL(pathOrUrl, `${apiOrigin()}/`).toString();
}

export async function checkForAppUpdate(): Promise<AppUpdateInfo | null> {
  if (!Capacitor.isNativePlatform()) return null;

  const [appInfo, manifest] = await Promise.all([
    CapacitorApp.getInfo(),
    fetch(absoluteUrl('/downloads/buzzer-update.json'), { cache: 'no-store' }).then((res) => {
      if (!res.ok) throw new Error('Could not check for updates');
      return res.json() as Promise<UpdateManifest>;
    }),
  ]);

  const currentVersionCode = Number(appInfo.build || 0);
  const latestVersionCode = Number(manifest.versionCode || 0);

  return {
    currentVersionCode,
    latestVersionCode,
    latestVersionName: manifest.versionName,
    apkUrl: absoluteUrl(manifest.apkUrl),
    notes: manifest.notes,
    available: latestVersionCode > currentVersionCode,
  };
}

export async function installAppUpdate(apkUrl: string) {
  await BuzzerUpdater.installUpdate({ apkUrl });
}
