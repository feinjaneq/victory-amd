@echo off
rem cool_fox (DoubleGhosty/cool_fox) on GTA VI 1.0.2.1, RX 6600 8 GB, Series X.
rem A/B twin of run-rodrion.cmd: same console, same LATE_WAIT, same skip list,
rem same card/staging numbers, so run-coolfox.log can be diffed against run-amd4.log.
rem
rem   run-coolfox.cmd            run the game
rem   run-coolfox.cmd prebuild   fill the shader + pipeline cache once (slow, do it first)
rem
rem Cache, saved data and logs all live in coolfox-data\ next to this file
rem (never inside _coolfox: the fork refuses asset paths inside its own tree).

setlocal
set "REPO=%~dp0_coolfox"
set "EXE=%REPO%\target\release\victory.exe"
set "GAMEDIR=C:\Users\Janeq\Downloads\GTA6.Xbox.v1.0.2.1-CYBERLEEK"
set "DUMP=%GAMEDIR%\game_scarlett_master.exe"
set "DATADIR=%~dp0coolfox-data"
set "VICTORY_CONFIG=%REPO%\victory.toml"
set "VICTORY_CACHE_DIR=%DATADIR%\cache-coolfox"
set "VICTORY_DATA_DIR=%DATADIR%"
set "LOG=%DATADIR%\run-coolfox.log"

if /I "%~1"=="prebuild" set "PREBUILD=1"

if not exist "%EXE%" goto nobuild
if not exist "%DUMP%" goto nodump
if not exist "%DATADIR%" mkdir "%DATADIR%"

rem ---- switches shared with run-rodrion.cmd / run-amd4, so the A/B is fair ----
set "VICTORY_LOG=info"
set "VICTORY_SHADER_LOOP_LIMIT=64"
set "VICTORY_TEXTURE_NO_WAIT=1"
set "VICTORY_CARD_BUFFERS_MIN_MB=1"
set "VICTORY_CARD_BUFFERS_MB=1024"
set "VICTORY_JOIN_COPIES=1"
set "VICTORY_CARD_REHASH_RUNS=1"
set "VICTORY_PIPELINE_WAIT_MS=24"

rem ---- KLBF Lab 39 baseline switches cool_fox also reads ----
rem 39f0e9aeb156a61c hangs the AMD compiler and grows memory ~240 MB/s.
set "VICTORY_SHADER_OPT=0"
set "VICTORY_SKIP_PIPELINES=39f0e9aeb156a61c"
rem LATE_WAIT=3 is faster but lost the device after ~3 min on the author's card.
set "VICTORY_LATE_WAIT=1"
set "VICTORY_LATE_WAIT_LISTS=256"
set "VICTORY_RELAY=2"
set "VICTORY_INDIRECT_WINDOW=1"
set "VICTORY_WIDE_BACK=1"
set "VICTORY_WIDE_REFRESH=1"
set "VICTORY_WIDE_MERGE=1"
set "VICTORY_ASK_ONCE=1"
set "VICTORY_BIND_CACHE=1"
set "VICTORY_DECLARE_ONCE=1"
set "VICTORY_DYNAMIC_SLOTS=524288"
rem ~9,000 textures DirectStorage overwrote after upload came back black/stale.
set "VICTORY_PAGE_WRITES=1"
set "VICTORY_PIPELINE_WORKERS=3"
set "VICTORY_D3D12_BACKGROUND=0"

rem ---- VRAM management for 8 GB, open world ----
set "VICTORY_CARD_ROOM_FOR_BUFFERS=1"
set "VICTORY_CARD_ROOM_FOR_TARGETS_MB=3072"
set "VICTORY_CARD_BUFFERS_MIN_KB=256"
set "VICTORY_TEXTURE_STAGE_MB=512"
set "VICTORY_TEXTURE_STAGE_MS=80"
set "VICTORY_TEXTURE_CATCHUP=1"
set "VICTORY_TEXTURE_ROOM_PERCENT=90"
set "VICTORY_CARD_WINDOWS_MB=512"
set "VICTORY_AMBIENT=0.6"
rem rodrion's VICTORY_ROOT_WINDOW_MB=12; cool_fox names the same limit ROOT_VIEW_MB.
set "VICTORY_ROOT_VIEW_MB=12"

rem ---- deliberately NOT set: no counterpart in cool_fox ----
rem The rodrion/KLBF launcher also sets these; cool_fox has no such variable, so
rem setting them would prove nothing. They are the feature gap being measured:
rem   VICTORY_POOL_COMMIT / UMA_POOL / TILED_POOL / TILED_POOL_MB
rem   VICTORY_INPLACE / INPLACE_MB / DIRECT_DMA / REBAR
rem   VICTORY_RELAY_COPY_QUEUE / FOLD_BUFFERS / WIDE_THREADS / CLAMP_WAITS
rem   VICTORY_CARD_FETCH_INFLIGHT / CARD_FETCH_INFLIGHT_MB
rem   VICTORY_COPY_PLAIN / WRITE_PLAIN / STAGING_POOL
rem   VICTORY_WIDE_HEAP / WIDE_SYNC / HEAP_SCAN_EVERY / ASK_QUIET
rem   VICTORY_UNDER_WRITES_RUNS / GPU_CBV
rem   VICTORY_TEXTURE_BATCH / GROUPED_MESH_CLAMP / TEXTURE_HEAPS / MERGE_DWORDS
rem   VICTORY_TEXTURE_DROP_MIPS / TEXTURE_SHORT / TEXTURE_SHORT_SIDE / TEXTURE_SHORT_PERCENT
rem   VICTORY_TEXTURE_HASH_EVERY / VRAM_IDLE_MS / BAKE_SOURCES_FIRST / BAKE_ROOM_PERCENT
rem   VICTORY_PIPELINE_GATE_S / CARD_WINDOWS_PERCENT / DISPLAY_MODE
rem Staging: cool_fox bounds it itself (staging_budget_per_frame: 192 MiB at 8 GB),
rem and on a <=32 GiB host limited_host_ram() cuts that to 128 MiB/frame.

if defined PREBUILD goto prebuild
goto run

:prebuild
cd /d "%REPO%"
echo Prebuilding shader + pipeline cache (resumable, expect several minutes)...
"%EXE%" translate --cache --pipelines --jobs 8 "%GAMEDIR%\shaders.rpf"
echo PREBUILD_EXIT=%ERRORLEVEL%
goto end

:run
cd /d "%REPO%"
echo Starting cool_fox, Series X, log: %LOG%
echo   LATE_WAIT=%VICTORY_LATE_WAIT% cache=%VICTORY_CACHE_DIR%
"%EXE%" run "%DUMP%" --execute --console series-x > "%LOG%" 2>&1
echo RUN_EXIT=%ERRORLEVEL%
echo Log written to %LOG%
goto end

:nobuild
echo MISSING BUILD: %EXE%
echo Build it with:  cd /d "%~dp0_coolfox" ^&^& cargo build --release --locked -p victory
exit /b 1

:nodump
echo MISSING DUMP: %DUMP%
exit /b 1

:end
endlocal
