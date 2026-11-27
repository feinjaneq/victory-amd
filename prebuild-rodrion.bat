@echo off
rem The launcher's "precompile shaders" button calls this.
rem Fills the rodrion shader + pipeline cache, then drops the marker the
rem launcher and run-rodrion-launcher.ps1 look for (24 ms wait, 8 s gate).
cd /d "%~dp0"
call "%~dp0run-rodrion.cmd" prebuild
if errorlevel 1 goto failed
if not exist "%~dp0rodrion-data\cache-klbf-lab39" mkdir "%~dp0rodrion-data\cache-klbf-lab39"
> "%~dp0rodrion-data\cache-klbf-lab39\precompiled.ok" echo done
echo Cache prebuilt.
pause
exit /b 0

:failed
echo Prebuild failed - the run will fall back to 500 ms waits and a 45 s gate.
pause
exit /b 1
