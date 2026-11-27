@echo off
rem rodrion-vi (KLBF Lab 39 + 7900XT shaders) on GTA VI 1.0.2.1, RX 6600 8 GB, Series X.
rem
rem   run-rodrion.cmd            unified memory / tiled physical-page pool (default)
rem   run-rodrion.cmd classic    no tiled pool, no inplace, no direct DMA
rem   run-rodrion.cmd prebuild   fill the shader + pipeline cache once (slow, do it first)
rem
rem Logs land next to this file as run-rodrion.log / run-rodrion-classic.log.

setlocal
set "REPO=%~dp0_rodrion"
set "EXE=%REPO%\target\release\victory.exe"
set "GAMEDIR=C:\Users\Janeq\Downloads\GTA6.Xbox.v1.0.2.1-CYBERLEEK"
set "DUMP=%GAMEDIR%\game_scarlett_master.exe"
set "VICTORY_CONFIG=%REPO%\victory.toml"
set "LOG=%~dp0run-rodrion.log"

if /I "%~1"=="classic" set "LOG=%~dp0run-rodrion-classic.log"
if /I "%~1"=="classic" set "CLASSIC=1"
if /I "%~1"=="prebuild" set "PREBUILD=1"

if not exist "%EXE%" goto nobuild
if not exist "%DUMP%" goto nodump

rem ---- switches shared with run-amd4, so the A/B against it is fair ----
set "VICTORY_LOG=info"
set "VICTORY_SHADER_LOOP_LIMIT=64"
set "VICTORY_TEXTURE_NO_WAIT=1"
set "VICTORY_CARD_BUFFERS_MIN_MB=1"
set "VICTORY_CARD_BUFFERS_MB=1024"
set "VICTORY_JOIN_COPIES=1"
set "VICTORY_CARD_REHASH_RUNS=1"
set "VICTORY_PIPELINE_WAIT_MS=24"

rem ---- rodrion / KLBF Lab 39 baseline ----
rem 39f0e9aeb156a61c hangs the AMD compiler and grows memory ~240 MB/s.
set "VICTORY_SHADER_OPT=0"
set "VICTORY_SKIP_PIPELINES=39f0e9aeb156a61c"
rem LATE_WAIT=3 is faster but lost the device after ~3 min on the author's card.
set "VICTORY_LATE_WAIT=1"
set "VICTORY_LATE_WAIT_LISTS=256"
set "VICTORY_RELAY=2"
set "VICTORY_RELAY_COPY_QUEUE=0"
set "VICTORY_INDIRECT_WINDOW=1"
set "VICTORY_FOLD_BUFFERS=1"
set "VICTORY_WIDE_BACK=1"
set "VICTORY_WIDE_REFRESH=1"
set "VICTORY_WIDE_MERGE=1"
set "VICTORY_WIDE_THREADS=8"
set "VICTORY_TEXTURE_BATCH=1"
set "VICTORY_GROUPED_MESH_CLAMP=1"
set "VICTORY_CLAMP_WAITS=0"
set "VICTORY_CARD_FETCH_INFLIGHT=1"
set "VICTORY_CARD_FETCH_INFLIGHT_MB=96"
set "VICTORY_COPY_PLAIN=1"
set "VICTORY_WRITE_PLAIN=1"
set "VICTORY_STAGING_POOL=1"
set "VICTORY_WIDE_HEAP=1"
set "VICTORY_WIDE_SYNC=1"
set "VICTORY_HEAP_SCAN_EVERY=16"
set "VICTORY_ASK_QUIET=8"
set "VICTORY_ASK_ONCE=1"
set "VICTORY_UNDER_WRITES_RUNS=65536"
set "VICTORY_BIND_CACHE=1"
set "VICTORY_DECLARE_ONCE=1"
set "VICTORY_GPU_CBV=1"
set "VICTORY_POOL_COMMIT=0"
set "VICTORY_UMA_POOL=0"
set "VICTORY_REBAR=1"
rem ~9,000 textures DirectStorage overwrote after upload came back black/stale.
set "VICTORY_PAGE_WRITES=1"
rem TEXTURE_HEAPS=0 avoids a hang on RDNA 2.
set "VICTORY_TEXTURE_HEAPS=0"
set "VICTORY_DYNAMIC_SLOTS=524288"
set "VICTORY_MERGE_DWORDS=1"
set "VICTORY_PIPELINE_WORKERS=3"
set "VICTORY_PIPELINE_GATE_S=8"
set "VICTORY_D3D12_BACKGROUND=0"

rem ---- VRAM management for 8 GB, open world ----
set "VICTORY_CARD_ROOM_FOR_BUFFERS=1"
set "VICTORY_CARD_ROOM_FOR_TARGETS_MB=3072"
set "VICTORY_CARD_BUFFERS_MIN_KB=256"
set "VICTORY_CARD_BUFFERS_MB=1024"
set "VICTORY_TEXTURE_STAGE_MB=512"
set "VICTORY_TEXTURE_STAGE_MS=80"
set "VICTORY_TEXTURE_CATCHUP=1"
set "VICTORY_ROOT_WINDOW_MB=12"
set "VICTORY_CARD_WINDOWS_MB=512"
set "VICTORY_CARD_WINDOWS_PERCENT=78"
set "VICTORY_TEXTURE_DROP_MIPS=2"
set "VICTORY_TEXTURE_SHORT=1"
set "VICTORY_TEXTURE_SHORT_PERCENT=97"
set "VICTORY_TEXTURE_SHORT_SIDE=128"
set "VICTORY_TEXTURE_ROOM_PERCENT=90"
rem 32, not 4: rehashing every frame caused 52 GB of texture re-uploads.
set "VICTORY_TEXTURE_HASH_EVERY=32"
set "VICTORY_VRAM_IDLE_MS=3000"
set "VICTORY_BAKE_SOURCES_FIRST=1"
set "VICTORY_BAKE_ROOM_PERCENT=96"
set "VICTORY_AMBIENT=0.6"

rem ---- unified memory (the fork's headline feature) vs classic ----
if defined CLASSIC goto classic
set "VICTORY_TILED_POOL=1"
set "VICTORY_TILED_POOL_MB=2560"
set "VICTORY_INPLACE=2"
set "VICTORY_INPLACE_MB=4608"
set "VICTORY_DIRECT_DMA=1"
goto after_mem

:classic
set "VICTORY_TILED_POOL=0"
set "VICTORY_INPLACE=0"
set "VICTORY_DIRECT_DMA=0"

:after_mem
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
echo Starting rodrion-vi, Series X, log: %LOG%
echo   TILED_POOL=%VICTORY_TILED_POOL% LATE_WAIT=%VICTORY_LATE_WAIT%
"%EXE%" run "%DUMP%" --execute --console series-x > "%LOG%" 2>&1
echo RUN_EXIT=%ERRORLEVEL%
echo Log written to %LOG%
goto end

:nobuild
echo MISSING BUILD: %EXE%
echo Build it with:  cd /d "%~dp0_rodrion" ^&^& cargo build --release --bin victory
exit /b 1

:nodump
echo MISSING DUMP: %DUMP%
exit /b 1

:end
endlocal
