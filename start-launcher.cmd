@echo off
rem Double-click this: opens the launcher window (retail game, gleaf-6 fork).
rem It starts a local page that plays the fork's own 8 GB script, either as
rem Optimized (Series S, 720p, FSR + frame generation) or Normal (Series X).

if /I "%~1"=="--run" goto run
rem Relaunch hidden, so no console stays behind the window.
powershell -NoProfile -WindowStyle Hidden -Command "Start-Process -FilePath '%~f0' -ArgumentList '--run' -WindowStyle Hidden"
exit /b

:run
setlocal
set "ROOT=%~dp0"
set "BUN="
for /f "delims=" %%B in ('where bun 2^>nul') do if not defined BUN set "BUN=%%B"
if not defined BUN if exist "%FREEBUFF_BUN%" set "BUN=%FREEBUFF_BUN%"
if not defined BUN if exist "%LOCALAPPDATA%\Programs\@codebufffreebuff-desktop\resources\bun\bun.exe" set "BUN=%LOCALAPPDATA%\Programs\@codebufffreebuff-desktop\resources\bun\bun.exe"
if not defined BUN goto nobun

"%BUN%" run "%ROOT%launcher\server.ts" >> "%ROOT%launcher\server.log" 2>&1
exit /b

:nobun
powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('bun.exe was not found. Install Bun, or set FREEBUFF_BUN to its path.')"
exit /b 2
