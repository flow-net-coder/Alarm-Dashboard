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
      iconColor: '#E69C73',
    },
  },
};

export default config;
