@echo off
rem gleaf-6/VIctory-7900XTX- on GTA VI 1.0.2.1, RX 6600 8 GB.
rem The fork's own measured 8 GB profile: Series S, the console 720p upscale
rem answered by the PC FidelityFX (FSR 4.1.2 from the SDK), AMD frame
rem generation, title buffers kept in the card's memory (auto: 1 GiB at 8 GB).
rem
rem   run-gl79.cmd            Series S + FSR + frame generation (the profile)
rem   run-gl79.cmd seriesx    the bigger console, no upscaler (fallback)
rem   run-gl79.cmd prebuild   translate every shader into the cache once (minutes)
rem
rem Cache, saved data and the log live in gl79-data\ next to this file (never
rem inside _gl79: the tools refuse asset paths inside their own tree).
rem The FidelityFX folder is ffx\Kits\FidelityFX\signedbin (SDK v2.4.0).

setlocal
set "REPO=%~dp0_gl79"
set "PS1=%REPO%\scripts\play-rx7600.ps1"
set "GAMEDIR=C:\Users\Janeq\Downloads\GTA6.Xbox.v1.0.2.1-CYBERLEEK"
set "DUMP=%GAMEDIR%\game_scarlett_master.exe"
set "DATADIR=%~dp0gl79-data"
set "FFX=%~dp0ffx\Kits\FidelityFX\signedbin"
set "LOG=%DATADIR%\run-gl79.log"
set "VICTORY_CONFIG=%REPO%\victory.toml"
set "VICTORY_CACHE_DIR=%DATADIR%\cache-gl79"
set "VICTORY_DATA_DIR=%DATADIR%"

set "CONSOLE=-SeriesS"
if /I "%~1"=="seriesx" set "CONSOLE=-SeriesX"

if not exist "%REPO%\target\diag\victory.exe" goto nobuild
if /I "%~1"=="prebuild" goto prebuild
if not exist "%DUMP%" goto nodump
if not exist "%FFX%\amd_fidelityfx_upscaler_dx12.dll" goto noffx
if not exist "%DATADIR%" mkdir "%DATADIR%"

echo Starting gleaf-6 VIctory-7900XTX %CONSOLE% (720p + FSR + frame generation)
echo Log: %LOG%
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1%" -Exe "%DUMP%" -FidelityFxDir "%FFX%" %CONSOLE% -Resolution 1280x720 -Stats > "%LOG%" 2>&1

set "RC=%ERRORLEVEL%"
rem victory's own exit code is lost through the script; a logged Error or panic wins.
findstr /i /c:"Error:" /c:"panicked" "%LOG%" >nul 2>&1
if not errorlevel 1 set "RC=1"
echo.
echo RUN_EXIT=%RC%
echo Log written to %LOG%
echo.
powershell -NoProfile -Command "Get-Content '%LOG%' -Tail 12"
endlocal & exit /b %RC%

:prebuild
echo Translating every shader into %VICTORY_CACHE_DIR% (a few minutes, once)
"%REPO%\target\diag\victory.exe" shaders --jobs 10 > "%DATADIR%\prebuild-gl79.log" 2>&1
echo PREBUILD_EXIT=%ERRORLEVEL%
powershell -NoProfile -Command "Get-Content '%DATADIR%\prebuild-gl79.log' -Tail 6"
endlocal & exit /b 0

:nobuild
echo No %REPO%\target\diag\victory.exe. Build it:
echo   cd /d "%~dp0_gl79"
echo   cargo build --locked --profile diag -p victory --features diagnostics
exit /b 2

:nodump
echo No %DUMP%. Point the script at your own dump.
exit /b 2

:noffx
echo No %FFX%\amd_fidelityfx_upscaler_dx12.dll.
echo Extract Kits\FidelityFX\signedbin from the FidelityFX SDK 2.x into %~dp0ffx
echo (that folder is what makes Series S draw a picture instead of a black world).
exit /b 2
