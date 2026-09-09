import { Capacitor, registerPlugin } from '@capacitor/core';

type BuzzerDeviceSettingsPlugin = {
  getBatteryOptimizationStatus(): Promise<{ ignored: boolean }>;
  openBatterySettings(): Promise<void>;
  openNotificationSettings(): Promise<void>;
};

const BuzzerDeviceSettings = registerPlugin<BuzzerDeviceSettingsPlugin>('BuzzerDeviceSettings');

export async function getBatteryOptimizationIgnored() {
  if (!Capacitor.isNativePlatform()) return null;
  const result = await BuzzerDeviceSettings.getBatteryOptimizationStatus();
  return result.ignored;
}

export async function openBatteryOptimizationSettings() {
  if (!Capacitor.isNativePlatform()) return;
  await BuzzerDeviceSettings.openBatterySettings();
}

export async function openAppNotificationSettings() {
  if (!Capacitor.isNativePlatform()) return;
  await BuzzerDeviceSettings.openNotificationSettings();
}
