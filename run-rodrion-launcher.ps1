param(
    [switch]$FrameGen,
    [switch]$SimpleUpscale,
    [switch]$Res720p,
    [int]$DropMips = 2,
    [int]$CardWindowsMB = 512,
    [int]$WideThreads = 8,
    [switch]$Safe,
    [switch]$SeriesS,
    [switch]$DiagLog,
    [switch]$NoHud,
    [switch]$MouseCamera,
    [double]$MouseSens = 1.0,
    [switch]$MouseInvertY,
    [string]$MouseButtons = "off",
    [switch]$NoUnifiedMemory,
    [switch]$LiteGraphics,
    [string]$Keymap = ""
)

$RepoDir = "C:\Users\Janeq\.config\freebuff-desktop\local-projects\f5d5af6a-46c0-4a93-9559-a06120a29c94\_rodrion"
$GameExe = "C:\Users\Janeq\Downloads\GTA6.Xbox.v1.0.2.1-CYBERLEEK\game_scarlett_master.exe"
$Exe = Join-Path $RepoDir "target\release\victory.exe"
$FfxDir = "C:\Users\Janeq\.config\freebuff-desktop\local-projects\f5d5af6a-46c0-4a93-9559-a06120a29c94\rodrion-data\ffx-sdk-2.4"
$CacheDir = "C:\Users\Janeq\.config\freebuff-desktop\local-projects\f5d5af6a-46c0-4a93-9559-a06120a29c94\rodrion-data\cache-klbf-lab39"
$SkipFile = Join-Path $RepoDir "docs\klbf\skip-amd.txt"
$Console = if ($SeriesS) { "series-s" } else { "series-x" }
$ResTag = if ($Res720p) { "720p" } else { "1080p" }
$Tag = if (-not $SeriesS) { "unificado-sx-$ResTag" } elseif ($FrameGen) { "unificado-ss-fg-$ResTag" } elseif ($SimpleUpscale) { "unificado-ss-$ResTag" } else { "unificado-ss-fsr-$ResTag" }
$LogFile = "C:\Users\Janeq\.config\freebuff-desktop\local-projects\f5d5af6a-46c0-4a93-9559-a06120a29c94\rodrion-data\run-$Tag.log"
$HudScript = "C:\Users\Janeq\.config\freebuff-desktop\local-projects\f5d5af6a-46c0-4a93-9559-a06120a29c94\_rodrion\victory-hud.py"

if (-not (Test-Path $Exe)) {
    Write-Host "Build release nao encontrado em $Exe" -ForegroundColor Red
    exit 1
}

# Limpa variaveis experimentais/perigosas ou que possam causar conflito
foreach ($v in 'VICTORY_BVH_BUILDER','VICTORY_BVH_QUARANTINE','VICTORY_RT','VICTORY_LEVELS_ON_DEMAND','VICTORY_POOL_COMMIT','VICTORY_POOL_COMMIT_MB','VICTORY_UMA_POOL','VICTORY_TILED_POOL','VICTORY_TILED_POOL_MB','VICTORY_KEYMAP','VICTORY_LITE_GFX','VICTORY_TEXTURE_CATCHUP','VICTORY_ROOT_WINDOW_MB','VICTORY_TEXTURE_STAGE_MS','VICTORY_HOST_WAVE','VICTORY_INPLACE','VICTORY_INPLACE_MB','VICTORY_DIRECT_DMA','VICTORY_WINDOW_KB','VICTORY_FFX_DIR','VICTORY_FFX_FG_DIR','VICTORY_FFX_SIMPLE','VICTORY_FRAMEGEN','VICTORY_DISPLAY_MODE','VICTORY_FPS_OVERLAY','VICTORY_CLAMP_WAITS','VICTORY_CARD_FETCH_INFLIGHT','VICTORY_CARD_WINDOWS_MB','VICTORY_CARD_WINDOWS_PERCENT','VICTORY_WIDE_THREADS','VICTORY_LATE_WAIT_LISTS','VICTORY_COPY_PLAIN','VICTORY_WRITE_PLAIN','VICTORY_STAGING_POOL','VICTORY_TEXTURE_HEAPS','VICTORY_DYNAMIC_SLOTS','VICTORY_MERGE_DWORDS','VICTORY_HEAP_PASS_FULL','VICTORY_INDIRECT_RAW','VICTORY_TEXTURE_HASH_EVERY','VICTORY_VRAM_IDLE_MS','VICTORY_VRAM_IDLE_BY_ROOM','VICTORY_CARD_ROOM_FOR_TARGETS_MB','VICTORY_DSTORAGE_OWN_HANDLES','VICTORY_D3D12_BACKGROUND','VICTORY_WINDOW_TAILS','VICTORY_EARLY_TEXTURES_MS','VICTORY_BAKE_TEXTURES_MS','VICTORY_CARD_BUFFERS_MIN_KB','VICTORY_TEXTURE_STAGE_MB','VICTORY_PACE','VICTORY_SYNC_NULL_SKIP','VICTORY_COPY_CHANGED','VICTORY_TEXTURE_BATCH','VICTORY_GROUPED_MESH_CLAMP','VICTORY_PIPELINE_GATE_S','VICTORY_PIPELINE_WORKERS','VICTORY_MOUSE_CAMERA','VICTORY_MOUSE_SENS','VICTORY_MOUSE_INVERT_Y','VICTORY_MOUSE_BUTTONS','VICTORY_WIDE_HEAP','VICTORY_WIDE_SYNC','VICTORY_HEAP_SCAN_EVERY','VICTORY_REBAR','VICTORY_ASK_QUIET','VICTORY_UNDER_WRITES_RUNS','VICTORY_PAGE_WRITES','VICTORY_BIND_CACHE','VICTORY_DECLARE_ONCE','VICTORY_GPU_CBV','VICTORY_LAZY_BACK') {
    Remove-Item "Env:$v" -ErrorAction SilentlyContinue
}

$env:VICTORY_CONFIG = Join-Path $RepoDir "victory.toml"
# INFO registra apenas 1 linha de telemetria a cada 5s (custo ~0 FPS) e mostra o tempo exato de cada etapa!
$env:VICTORY_LOG = "info"

# --- Fixes AMD RDNA 2 + KLBF Lab 39 (Agua + Plane 1 Menus/HUD Series S) ---
$env:VICTORY_SHADER_OPT = "0"
if (Test-Path $SkipFile) {
    $env:VICTORY_SKIP_PIPELINES = (Get-Content $SkipFile -Raw).Trim()
} else {
    $env:VICTORY_SKIP_PIPELINES = "39f0e9aeb156a61c"
}

# --- Performance Unificada FPS MAX (rorodev6/shadowdog00 + Trexies + ShakiraRED + myokex + KytyPS5 + KLBF 39) ---
# LATE_WAIT=3 (rorodev6 RX 6700 XT preset): Stage 2 merge sem stall + Stage 3 Present assincrono!
$env:VICTORY_LATE_WAIT = if ($Safe) { "1" } else { "3" }
$env:VICTORY_LATE_WAIT_LISTS = "256"
$env:VICTORY_RELAY = "2"
$env:VICTORY_RELAY_COPY_QUEUE = "0"
$env:VICTORY_INDIRECT_WINDOW = "1"
$env:VICTORY_FOLD_BUFFERS = "1"
$env:VICTORY_WIDE_BACK = "1"
$env:VICTORY_WIDE_REFRESH = "1"
$env:VICTORY_WIDE_MERGE = "1"
$env:VICTORY_WIDE_THREADS = "$WideThreads"
$env:VICTORY_JOIN_COPIES = "1"
$env:VICTORY_TEXTURE_NO_WAIT = "1"
$env:VICTORY_CARD_REHASH_RUNS = "1"
$env:VICTORY_ASK_ONCE = "1"

if (-not $Safe) {
    # rorodev6 / shadowdog00: detile/hash paralelo de texturas em multi-thread + batch seguro de 32 mesh indirects
    $env:VICTORY_TEXTURE_BATCH = "1"
    $env:VICTORY_GROUPED_MESH_CLAMP = "1"
    # Remove ~12.000 stalls globais de UAV/frame nos indirect clamps (Trexies 6b358fe)
    $env:VICTORY_CLAMP_WAITS = "0"
    # Traz dados da VRAM dentro do proprio flight sem nova rodada na fila GPU (~80ms economizados)
    $env:VICTORY_CARD_FETCH_INFLIGHT = "1"
    $env:VICTORY_CARD_FETCH_INFLIGHT_MB = "96"
    # ShakiraRED V1: copias CPU ERMS in-place com VEH fallback + pool de staging buffers
    $env:VICTORY_COPY_PLAIN = "1"
    $env:VICTORY_WRITE_PLAIN = "1"
    $env:VICTORY_STAGING_POOL = "1"
    # RDNA 2 FastComm v2: bindless lock-free + ASK_QUIET (menos GetWriteWatch) + UNDER_WRITES_RUNS + ReBAR auto
    $env:VICTORY_WIDE_HEAP = "1"
    $env:VICTORY_WIDE_SYNC = "1"
    $env:VICTORY_HEAP_SCAN_EVERY = "16"
    $env:VICTORY_ASK_QUIET = "8"
    $env:VICTORY_UNDER_WRITES_RUNS = "65536"
    $env:VICTORY_BIND_CACHE = "1"
    $env:VICTORY_DECLARE_ONCE = "1"
    $env:VICTORY_GPU_CBV = "1"
    # RDNA 2 True Unified Memory (UMA + Tiled Pool) vs Modo Classico AMD (-NoUnifiedMemory)
    $env:VICTORY_POOL_COMMIT = "0"
    $env:VICTORY_UMA_POOL = "0"
    if ($NoUnifiedMemory) {
        $env:VICTORY_TILED_POOL = "0"
        $env:VICTORY_INPLACE = "0"
        $env:VICTORY_DIRECT_DMA = "0"
    } else {
        $env:VICTORY_TILED_POOL = "1"
        $env:VICTORY_TILED_POOL_MB = "2560"
        $env:VICTORY_INPLACE = "2"
        $env:VICTORY_INPLACE_MB = "4608"
        $env:VICTORY_DIRECT_DMA = "1"
    }
    $env:VICTORY_REBAR = "1"
    # Corrige ~9.000 texturas que o DirectStorage sobrescrevia apos o upload e ficavam pretas/velhas!
    $env:VICTORY_PAGE_WRITES = "1"
    # myokex vi-fx3: 524k dynamic slots AMD + merge por dwords (TEXTURE_HEAPS=0 evita hang RDNA 2)
    $env:VICTORY_TEXTURE_HEAPS = "0"
    $env:VICTORY_DYNAMIC_SLOTS = "524288"
    $env:VICTORY_MERGE_DWORDS = "1"
} else {
    $env:VICTORY_WIDE_HEAP = "0"
    $env:VICTORY_WIDE_SYNC = "0"
    $env:VICTORY_HEAP_SCAN_EVERY = "16"
    $env:VICTORY_ASK_QUIET = "0"
    $env:VICTORY_UNDER_WRITES_RUNS = "512"
    $env:VICTORY_GPU_CBV = "0"
    $env:VICTORY_POOL_COMMIT = "0"
    $env:VICTORY_UMA_POOL = "0"
    $env:VICTORY_TILED_POOL = "0"
    $env:VICTORY_INPLACE = "0"
    $env:VICTORY_DIRECT_DMA = "0"
    $env:VICTORY_PAGE_WRITES = "1"
    $env:VICTORY_REBAR = "0"
    $env:VICTORY_TEXTURE_BATCH = "0"
    $env:VICTORY_GROUPED_MESH_CLAMP = "0"
    $env:VICTORY_COPY_PLAIN = "0"
    $env:VICTORY_WRITE_PLAIN = "0"
    $env:VICTORY_TEXTURE_HEAPS = "0"
    $env:VICTORY_DYNAMIC_SLOTS = "524288"
}

# Se o usuario ja rodou o PreCompilar-Shaders, usa 24 ms + gate curto (8s) para nao travar 4-12s no mundo aberto!
# Limita workers de compilacao AMD a 3 threads em prioridade minima para nao sufocar o Ryzen 5 4500.
$env:VICTORY_PIPELINE_WORKERS = "3"
$PrecompiledMarker = Join-Path $CacheDir "precompiled.ok"
if (Test-Path $PrecompiledMarker) {
    $env:VICTORY_PIPELINE_WAIT_MS = "24"
    $env:VICTORY_PIPELINE_GATE_S = "8"
    $env:VICTORY_D3D12_BACKGROUND = "0"
    $CacheStatus = "Cache Pre-Compilado (24ms | Gate 8s | 3 workers | BgOff)"
} else {
    $env:VICTORY_PIPELINE_WAIT_MS = "500"
    $env:VICTORY_PIPELINE_GATE_S = "45"
    $CacheStatus = "Cache Quente/Frio (500ms - rode PreCompilar-Shaders para 24ms)"
}

# --- Gestao de VRAM 8 GB (RX 6600) calibrada para o MUNDO ABERTO ---
$env:VICTORY_CARD_ROOM_FOR_BUFFERS = "1"
# Em 720p Series S, reserva 1800 MB em vez de 3072 MB (4K), mantendo eviction padrao 5s/2.5s/1s intacto!
$env:VICTORY_CARD_ROOM_FOR_TARGETS_MB = if ($SeriesS) { "1800" } else { "3072" }
$env:VICTORY_CARD_BUFFERS_MIN_KB = "256"
$env:VICTORY_CARD_BUFFERS_MB = "1024"
# Equilibrio para RX 6600: drena a fila de texturas sem travar 17.000 slots nem dar picos de 1024 MB
$env:VICTORY_TEXTURE_STAGE_MB = "512"
# YukiRyuu/7900XT: 80 ms normal + CATCHUP=1 (3x so na carga inicial da cena) para drenar a fila sem deixar texturas pretas!
$env:VICTORY_TEXTURE_STAGE_MS = "80"
$env:VICTORY_TEXTURE_CATCHUP = "1"
$env:VICTORY_ROOT_WINDOW_MB = "12"

# --- Mouse como Camera (Analogico Direito) + Botoes configuraveis pelo Launcher ---
if ($MouseCamera) {
    $env:VICTORY_MOUSE_CAMERA = "1"
    $env:VICTORY_MOUSE_SENS = ([string]::Format([System.Globalization.CultureInfo]::InvariantCulture, "{0:0.##}", $MouseSens))
    if ($MouseInvertY) { $env:VICTORY_MOUSE_INVERT_Y = "1" }
}
if ($MouseButtons -and $MouseButtons -ne "off") {
    $env:VICTORY_MOUSE_BUTTONS = $MouseButtons
}
if ($Keymap -and $Keymap.Trim().Length -gt 0) {
    $env:VICTORY_KEYMAP = $Keymap.Trim()
}
# Com ReBAR / SAM ativo na RX 6600: coloca 512 MB das janelas mais quentes direto na VRAM (224 GB/s + GPU Compare Shaders!)
# e o restante continua no Tiled Pool (economizando 50% de RAM em buracos esparsos). Em FrameGen, usa 256 MB para sobrar VRAM.
$EffectiveCardWin = if ($FrameGen) { 256 } else { $CardWindowsMB }
$env:VICTORY_CARD_WINDOWS_MB = "$EffectiveCardWin"
$env:VICTORY_CARD_WINDOWS_PERCENT = "78"
$EffectiveDropMips = if ($LiteGraphics) { 3 } else { $DropMips }
$env:VICTORY_TEXTURE_DROP_MIPS = "$EffectiveDropMips"
$env:VICTORY_TEXTURE_SHORT = "1"
$env:VICTORY_TEXTURE_SHORT_PERCENT = "97"
# 128px fallback sob pressao de VRAM (ou 64px no Modo Grafico Leve)
$env:VICTORY_TEXTURE_SHORT_SIDE = if ($LiteGraphics) { "64" } else { "128" }
$env:VICTORY_TEXTURE_ROOM_PERCENT = "90"
# Evita despejo hiper-agressivo a cada 1s (4 frames) que causava 52 GB de re-uploads de texturas!
$env:VICTORY_TEXTURE_HASH_EVERY = "32"
$env:VICTORY_VRAM_IDLE_MS = "3000"
$env:VICTORY_BAKE_SOURCES_FIRST = "1"
$env:VICTORY_BAKE_ROOM_PERCENT = "96"
if ($LiteGraphics) {
    $env:VICTORY_LITE_GFX = "1"
    $env:VICTORY_AMBIENT = "0.2"
} else {
    $env:VICTORY_AMBIENT = "0.6"
}

# --- Resolucao: 720p (menor RAM/VRAM e mais FPS) ou 1080p ---
if ($Res720p) {
    $env:VICTORY_DISPLAY_MODE = "1280x720"
}

# --- Upscaler Series S (Simple = mais estavel/rapido; FSR 2.4 = necessario para FrameGen) ---
if ($SeriesS) {
    if ((-not $FrameGen) -and ($LiteGraphics -or $SimpleUpscale -or -not (Test-Path (Join-Path $FfxDir "amd_fidelityfx_loader_dx12.dll")))) {
        $env:VICTORY_FFX_SIMPLE = "1"
    } else {
        $env:VICTORY_FFX_DIR = $FfxDir
        if ($FrameGen) {
            $env:VICTORY_FFX_FG_DIR = $FfxDir
            $env:VICTORY_FRAMEGEN = "1"
        }
    }
}

$hudProc = $null
if (-not $NoHud -and (Test-Path $HudScript)) {
    $hudProc = Start-Process -FilePath "pythonw.exe" -ArgumentList "`"$HudScript`"" -PassThru -ErrorAction SilentlyContinue
}

# Prioridade Alta no agendador do Windows para o processo do jogo (herdado pelo victory.exe)
try {
    [System.Diagnostics.Process]::GetCurrentProcess().PriorityClass = [System.Diagnostics.ProcessPriorityClass]::High
} catch {}

Set-Location $RepoDir
$ModeDesc = if (-not $SeriesS) {
    "Series X ($ResTag)"
} elseif ($FrameGen) {
    "Series S + FSR 2.4 + FrameGen ($ResTag)"
} elseif ($SimpleUpscale) {
    "Series S + Simple ($ResTag)"
} else {
    "Series S + AMD FSR 2.4 ($ResTag)"
}
$PerfTag = if ($Safe) { "SAFE" } else { "FPS-BOOST (ClampWaits=0 + InflightFetch + PlainCopy + CardWin=${EffectiveCardWin}MB + ${WideThreads}T)" }
Write-Host "Iniciando GTA VI UNIFICADO RX 6600 [$ModeDesc | $PerfTag]" -ForegroundColor Green
Write-Host "Agua KLBF 39 | DROP_MIPS=$DropMips | $CacheStatus | Prioridade CPU: ALTA" -ForegroundColor Cyan
$ErrorActionPreference = "Continue"
try {
    & $Exe run --console $Console $GameExe --execute 2> $LogFile
} finally {
    if ($hudProc -and -not $hudProc.HasExited) {
        Stop-Process -Id $hudProc.Id -Force -ErrorAction SilentlyContinue
    }
}
