# Motormila Android — Windows build guide

## Prereqs

1. **JDK 17** (Temurin or Oracle). Gradle 8.11.1 + AGP 8.9.2 require JDK 17.
   ```powershell
   $env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-17.0.11.9-hotspot"
   java -version  # must print 17.x
   ```
2. **Android SDK** at `C:\Users\suven\AppData\Local\Android\Sdk`
   (already wired in `android/local.properties`). Install via Android Studio
   SDK Manager: **Platform android-35** + **Build-Tools 35.0.0**.
3. Accept licences once: `sdkmanager --licenses`.

## First-time wrapper jar

`gradle/wrapper/gradle-wrapper.jar` is intentionally NOT committed (binary).
Generate it once on any machine with Gradle installed:

```powershell
cd android
gradle wrapper --gradle-version 8.11.1
```

After that `.\gradlew.bat` is self-sufficient.

## Build

```powershell
cd android
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-17.0.11.9-hotspot"
.\gradlew.bat :app:assembleDebug
# APK: app\build\outputs\apk\debug\app-debug.apk
```

Release (v1: minify off, no R8 risk). Sideload-signed with the SDK debug
keystore unless `ANDROID_KEYSTORE_*` env vars are set:

```powershell
.\gradlew.bat :app:assembleRelease
# APK: app\build\outputs\apk\release\app-release.apk
```

GitHub Releases: tag `android-v1.0.0` (or later) and push. Workflow
`.github/workflows/android-release.yml` publishes `motormila-<version>.apk`.

## Debug backend

Override debug `BASE_URL` with `MOTORMILA_API_URL` or `-PmotormilaApiUrl`.
Local emulator loopback: `http://10.0.2.2:8000/api/v1`.
`network_security_config.xml` permits cleartext **only** for `10.0.2.2`.
Release `BASE_URL` = `https://seo292-vehicle-platform-backend.hf.space/api/v1`.

Play Billing and FCM are stubbed in v1 (server checkout-intent fallback; local
notification routing until a Firebase backend lands).

## Linux / CI

JVM unit tests (no emulator image):

```bash
cd android
chmod +x gradlew
./gradlew :app:testDebugUnitTest
```

GitHub Actions runs the same command in `.github/workflows/android.yml`
(`android-unit` job) on Ubuntu with JDK 17.
