@echo off
rem Prebuild every shader into the launcher's shader cache, then make the host
rem pipelines a recorded run wrote down. The same work as Workshop > Prebuild
rem shaders, from a command prompt: no window, more passes, and it resumes.
rem
rem   prebuild-shaders.cmd              (10 threads, 5 passes)
rem   prebuild-shaders.cmd -Plan        show what it would run, then stop
rem   prebuild-shaders.cmd -Jobs 6 -Passes 8
title Retail Game launcher - prebuild shaders
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0launcher\prebuild.ps1" %*
set "CODE=%ERRORLEVEL%"
echo.
if not "%CODE%"=="0" echo Prebuild stopped with code %CODE%. The lines above say why.
pause
exit /b %CODE%
