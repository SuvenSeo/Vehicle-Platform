# Local Windows build helper for the Motormila Android app.
# Uses a local JDK 17 + Gradle 8.11.1 (no system install needed).
# Usage: pwsh -File build-local.ps1  (or pass extra gradle args, e.g. .\build-local.ps1 :app:lintDebug)
$ErrorActionPreference = "Continue"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$env:JAVA_HOME = "C:\Users\suven\AppData\Local\Temp\opencode\jdk17\jdk-17.0.20.1+1"
$env:PATH = "$env:JAVA_HOME\bin;" + $env:PATH
$env:ANDROID_HOME = "C:\Users\suven\AppData\Local\Android\Sdk"
$gradle = "C:\Users\suven\AppData\Local\Temp\opencode\gradle-dl\gradle-8.11.1\bin\gradle.bat"
$tasks = if ($args.Count -gt 0) { $args } else { @(":app:assembleDebug") }
Set-Location $here
& $gradle $tasks --console=plain --stacktrace > build-local.log 2>&1
"EXIT:$LASTEXITCODE" | Out-File build-local.status
Write-Output "done exit=$LASTEXITCODE (see build-local.log)"
