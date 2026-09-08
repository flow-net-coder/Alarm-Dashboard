import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.buzzer.timekeeper',
  appName: 'Buzzer',
  webDir: 'dist/public',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#E69C73',
      sound: 'beep.wav',
    },
  },
};

export default config;
