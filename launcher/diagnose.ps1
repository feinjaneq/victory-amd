# One session that answers "why do the textures and shaders change, and what
# is the frame time" without a terminal transcript to read: the run's own
# per-five-second statistics go to a log, and every presented frame between
# -PopFrom and -PopTo seconds is read back and compared with its neighbours
# (VICTORY_POP_WATCH, crates/victory-gpu/src/popwatch.rs) — a block one frame
# shows otherwise than the frames before and after it is a blip, and the three
# pictures around it are saved for looking at.
param(
    [ValidateSet('optimized', 'normal')][string]$Mode = 'normal',
    [switch]$NoFrameGen,
    [int]$PopFrom = 10,
    [int]$PopTo = 600,
    [string]$OutDir = '',
    [switch]$Plan
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$root = Split-Path -Parent $PSScriptRoot
$repo = Join-Path $root '_gl79'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
if (-not $OutDir) { $OutDir = Join-Path $root "gl79-data\diagnose-$stamp" }

$exe = Join-Path $repo 'target\diag\victory.exe'
if (-not (Test-Path $exe)) { $exe = Join-Path $repo 'target\release\victory.exe' }
if (-not (Test-Path $exe)) {
    Write-Host 'No runtime build yet. Open the launcher, Workshop > Build runtime, and run this again.' -ForegroundColor Red
    exit 1
}
$config = Join-Path $repo 'victory.toml'
if (-not (Test-Path $config)) {
    Write-Host 'No _gl79\victory.toml. Open the launcher once: it copies victory.example.toml in.' -ForegroundColor Red
    exit 1
}

# The folder the launcher would play, the same way prebuild.ps1 finds it.
$gameDir = $env:VICTORY_GAME_DIR
if (-not $gameDir) {
    $settings = Join-Path $root 'gl79-data\settings.json'
    if (Test-Path $settings) {
        try { $gameDir = (Get-Content $settings -Raw | ConvertFrom-Json).gameDir } catch { $gameDir = $null }
    }
}
if (-not $gameDir) {
    $server = Join-Path $root 'launcher\server.ts'
    if (Test-Path $server) {
        $m = [regex]::Match((Get-Content $server -Raw), 'const DEFAULT_GAME_DIR = "((?:[^"\\]|\\.)+)"')
        if ($m.Success) { $gameDir = $m.Groups[1].Value.Replace('\\', '\') }
    }
}
if (-not $gameDir -or -not (Test-Path $gameDir)) {
    Write-Host 'No game folder. Open the launcher, Settings > Choose folder..., and run this again.' -ForegroundColor Red
    exit 1
}
$gameExe = [regex]::Match((Get-Content (Join-Path $root 'launcher\server.ts') -Raw), 'const GAME_EXE = "([^"]+)"').Groups[1].Value
$game = Join-Path $gameDir $gameExe
if (-not (Test-Path $game)) {
    $only = Get-ChildItem -Path $gameDir -Filter '*.exe' -File
    if ($only.Count -ne 1) {
        Write-Host "$gameDir holds no $gameExe and not one executable either. Settings > Choose folder." -ForegroundColor Red
        exit 1
    }
    $game = $only[0].FullName
}

$ffx = Join-Path $root 'ffx\Kits\FidelityFX\signedbin'
$script = Join-Path $repo 'scripts\play-rx6600.ps1'
$popFolder = Join-Path $OutDir 'pop'
$childArgs = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $script, '-Exe', $game, '-Build', 'diag', '-Stats')
if ($Mode -eq 'optimized') {
    $childArgs += @('-FidelityFxDir', $ffx, '-SeriesS', '-Resolution', '1280x720')
} else {
    $childArgs += @('-SeriesX', '-Resolution', '1920x1080')
}
# The switches this session needs. -Set takes "K=V;K=V", which survives being
# handed to powershell.exe as a command line (a hashtable would not).
$set = "VICTORY_POP_WATCH=$PopFrom-$PopTo;VICTORY_POP_FOLDER=$popFolder"
if ($NoFrameGen) { $set = "VICTORY_FRAMEGEN=0;$set" }
$childArgs += @('-Set', $set)
# powershell.exe is handed a command line, so an argument with a space needs
# the quotes itself.
$argLine = ($childArgs | ForEach-Object { if ($_ -match '[\s;=]') { '"' + $_ + '"' } else { $_ } }) -join ' '

$log = Join-Path $OutDir 'run.log'
$err = Join-Path $OutDir 'run.err.txt'

if ($Plan) {
    Write-Host "runtime  $exe"
    Write-Host "game     $game"
    Write-Host "log      $log"
    Write-Host "would run powershell $argLine"
    exit 0
}

Write-Host "mode       $Mode$(if ($NoFrameGen) { ' (no generated frames)' })" -ForegroundColor Cyan
if ($Mode -eq 'optimized') {
    Write-Host 'note       Optimized composes the two planes into one picture, and popwatch skips composed frames:' -ForegroundColor Yellow
    Write-Host '           this session measures frame time only. Mode normal is the one that saves pictures of blips.' -ForegroundColor Yellow
}
Write-Host "game       $game"
Write-Host "runtime    $exe"
Write-Host "watching   $PopFrom-$PopTo s of presented frames, pictures into $popFolder"
Write-Host "log        $log"
Write-Host 'Play, watch the textures, then quit the game as usual: this window closes when it ends.' -ForegroundColor Yellow

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$child = Start-Process -FilePath 'powershell' -ArgumentList $argLine -RedirectStandardOutput $log -RedirectStandardError $err -NoNewWindow -PassThru
$child.WaitForExit()

$text = if (Test-Path $log) { Get-Content $log -Raw } else { '' }
$summary = [regex]::Matches($text, 'pop watch, since the start[^\r\n]*')
$frames = [regex]::Matches($text, '(\d+\.\d+) fps, (\d+\.\d+) ms/frame')
$times = @($frames | ForEach-Object { [double]$_.Groups[2].Value })
$dropped = [regex]::Matches($text, 'dropped (\d+\.\d+)/frame without a host pipeline: being made')

Write-Host ''
Write-Host "exit $($child.ExitCode)" -ForegroundColor Cyan
if ($times.Count) {
    $sorted = $times | Sort-Object
    $median = $sorted[[int][math]::Floor($sorted.Count / 2)]
    $p90 = $sorted[[int][math]::Floor($sorted.Count * 0.9)]
    Write-Host ("frame time  {0} samples: median {1:N1} ms, p90 {2:N1} ms, worst {3:N1} ms" -f `
        $times.Count, $median, $p90, ($sorted[-1]))
}
if ($dropped.Count) {
    $last = [double]$dropped[$dropped.Count - 1].Groups[1].Value
    Write-Host ("drops       last reported {0:N0} draws/frame without a host pipeline (being made)" -f $last)
}
if ($summary.Count) { $summary | ForEach-Object { Write-Host "pop watch   $($_.Value)" } }
$pictures = @(Get-ChildItem -Path $popFolder -Filter '*.png' -ErrorAction SilentlyContinue)
Write-Host "pictures    $($pictures.Count) in $popFolder"
Write-Host "The whole session is in $log"
