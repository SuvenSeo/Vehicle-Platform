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

Release (v1: minify off, no R8 risk):

```powershell
.\gradlew.bat :app:assembleRelease
```

## Debug backend

Debug `BASE_URL` = `http://10.0.2.2:8000/api/v1` (emulator loopback to host).
`network_security_config.xml` permits cleartext **only** for `10.0.2.2`.
Release `BASE_URL` = `https://seo292-vehicle-platform-backend.hf.space/api/v1`.
