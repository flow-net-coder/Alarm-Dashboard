import { Browser } from '@capacitor/browser';
import { isNativeApp } from '@/lib/native-alarms';

export async function openExternalUrl(url: string) {
  if (isNativeApp()) {
    await Browser.open({ url });
    return;
  }

  window.open(url, '_blank', 'noopener,noreferrer');
}
