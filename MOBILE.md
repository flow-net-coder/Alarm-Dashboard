# Buzzer Mobile App

## Android

The Android app lives in `artifacts/alarm-dashboard/android` and is powered by Capacitor.

Build and sync web assets into Android:

```bash
cd /home/ethan/PROJETS/Buzzer
VITE_API_URL="https://your-buzzer-production-url.up.railway.app/api" pnpm --filter ./artifacts/alarm-dashboard android:sync
```

Open the Android project:

```bash
pnpm --filter ./artifacts/alarm-dashboard android:open
```

Build a debug APK:

```bash
cd /home/ethan/PROJETS/Buzzer/artifacts/alarm-dashboard/android
./gradlew assembleDebug
```

The local APK is written to:

```text
artifacts/alarm-dashboard/android/app/build/outputs/apk/debug/app-debug.apk
```

The Railway-served download copy is:

```text
artifacts/alarm-dashboard/public/downloads/buzzer-debug.apk
```

After Railway deploys, it is available at:

```text
https://your-buzzer-production-url.up.railway.app/downloads/buzzer-debug.apk
```

Native alarm notes:

- The web timer still handles alarms while Buzzer is open in a browser.
- The Android app schedules native local notifications when alarms are saved, enabled, disabled, or deleted.
- Android may ask for notification permission and exact alarm permission.
- Marcus chat in the Android app needs `VITE_API_URL` pointed at the Railway API when building.

Home-screen widget:

- Add the `Marcus` widget from the Android launcher widgets screen.
- Tapping it opens Buzzer directly to Marcus Chat.
