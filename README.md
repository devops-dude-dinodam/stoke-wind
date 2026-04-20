# Stoke

A personal kiteboarding forecast app for Pringle Bay and Silversands (Betty's Bay), South Africa.

Stoke gives you a Go / No-Go verdict for each spot based on wind direction, wind speed, gusts, and swell — personalised to your weight, board length, kite quiver, skill level, and riding style. It also recommends which kite to fly, shows a 3-day outlook, and sends you a daily push notification with the morning conditions.

---

## Features

- Go / No-Go / Marginal status for Pringle Bay and Silversands
- Kite size recommendation based on weight, board length, skill level, and riding style
- Twin tip, wave strapped, and wave strapless riding styles with separate size logic
- Wind direction rating with spot-specific offshore/onshore knowledge baked in
- Gust-weighted effective wind speed for safer kite sizing
- 3-day forecast showing max wind, dominant direction, swell, and kite rec per day
- Next tide event (high or low) for False Bay using M2 harmonic calculation
- Current weather condition and temperature
- Thunderstorm hard No-Go with lightning warning
- Daily push notification at a time you choose
- Instant notification when conditions flip green during the day
- Hourly background condition checks

---

## Spots

**Pringle Bay**
SW to NW is ideal (side-on to onshore). SE winds come over the mountains and are gusty and unreliable. E/ESE is offshore and dangerous. Minimum wind 12 knots.

**Silversands (Betty's Bay)**
SE is the ideal cross-shore direction. NW is offshore and dangerous. Minimum wind 14 knots. Heavy shorebreak focus — swell warnings trigger earlier than Pringle.

---

## Kite Size Algorithm

Base formula: `S = (weight / effective_wind) x 2.0`

Effective wind uses a gust-weighted speed: `wind_avg + (gust - wind_avg) x 0.7` for twin tip, `x 0.8` for wave riders.

Board length adjustment applied to final size:
- Below 138 cm: +1 m
- 138 to 144 cm: no change
- Above 144 cm: -1 m

Skill multipliers: beginner 1.1, intermediate 1.0, advanced 0.9.

Riding style multipliers: twin tip 1.0, wave strapped 0.85, wave strapless 0.75.

Wave riding hard cap: 12 m maximum regardless of calculation.

---

## Weather Data

Conditions are fetched from Open-Meteo (free, no API key required):
- Wind speed, gusts, direction: Open-Meteo forecast API
- Wave height, swell height, swell period: Open-Meteo marine API
- Weather code and temperature: Open-Meteo forecast API

Data is refreshed on app launch and on manual pull-to-refresh. A background task checks conditions hourly.

---

## Installing the APK (Sideloading on Android)

Stoke is not on the Play Store. Install it directly from the GitHub releases page.

**What you need**
- An Android phone
- A file manager app or a browser to open the APK

**Step 1 — Allow installs from unknown sources**

On Android 8 and above the permission is per app, not a global toggle.

1. Open Settings on your phone.
2. Go to Apps (or Application Manager).
3. Find the app you will use to open the APK — usually your browser (Chrome) or Files app.
4. Tap Permissions or Advanced.
5. Enable Install unknown apps.

On older Android versions go to Settings > Security > Unknown sources and enable it.

**Step 2 — Download the APK**

Go to the releases page on GitHub:

```
https://github.com/devops-dude-dinodam/stoke-wind/releases
```

Tap the latest release and download the `stoke-vX.X.apk` file to your phone.

**Step 3 — Install**

Open the downloaded APK file from your notifications or from your Downloads folder. Tap Install when prompted. Once installed, tap Open.

**Updating**

Download the new APK from the releases page and install it over the existing version. You do not need to uninstall first. Your profile and settings are preserved.

**Installing via ADB (optional)**

If you have Android Debug Bridge installed on your computer and USB debugging enabled on your phone:

```bash
adb install stoke-v1.2.apk
```

---

## Building from Source

Requires Node.js, Java 21, and Android SDK.

```bash
git clone git@github.com:devops-dude-dinodam/stoke-wind.git
cd stoke-wind
npm install
cd android
JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64 ./gradlew assembleRelease
```

The APK will be at `android/app/build/outputs/apk/release/app-release.apk`.

---

## Tech Stack

- React Native 0.81 with Expo SDK 54
- TypeScript strict mode
- Zustand v5 with AsyncStorage persistence
- Open-Meteo weather and marine APIs
- expo-notifications for push alerts
- expo-background-fetch and expo-task-manager for hourly background checks
- lucide-react-native for icons

---

## Licence

Personal use. Not for distribution.
