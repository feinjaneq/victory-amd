@echo off
rem One session that measures the frame time and counts textures that change
rem from frame to frame, with the pictures of the worst of them saved.
rem Play, then quit the game: this window prints the numbers when it ends.
rem
rem   diagnose.cmd                 Normal profile: Series X, 1080p, no upscaler.
rem                                The only one popwatch can see: Optimized composes
rem                                its two planes, and composed frames are skipped.
rem   diagnose.cmd -Mode optimized  frame-time numbers of the Optimized profile
rem   diagnose.cmd -Mode optimized -NoFrameGen   the same, without FSR and generated frames
title Retail Game launcher - diagnose
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0launcher\diagnose.ps1" %*
echo.
pause
