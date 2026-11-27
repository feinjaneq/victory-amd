# Prebuild every shader into the launcher's cache, the way Workshop > Prebuild
# shaders does, and then make the host pipelines a recorded run wrote down.
#
# The launcher passes VICTORY_CONFIG, VICTORY_GAME_DIR, VICTORY_CACHE_DIR and
# VICTORY_DATA_DIR to every run; so does this, or the cache it fills would not
# be the one Play reads.
param(
    [int]$Passes = 5,
    [int]$Jobs = 10,
    [int]$WarmJobs = 8,
    [switch]$Plan
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$root = Split-Path -Parent $PSScriptRoot
$repo = Join-Path $root '_gl79'

# Whichever build the launcher would pick: diag first, then release.
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

# The game folder is the one chosen in the launcher (gl79-data\settings.json);
# VICTORY_GAME_DIR wins when it is already set.
$gameDir = $env:VICTORY_GAME_DIR
if (-not $gameDir) {
    $settings = Join-Path $root 'gl79-data\settings.json'
    if (Test-Path $settings) {
        try { $gameDir = (Get-Content $settings -Raw | ConvertFrom-Json).gameDir } catch { $gameDir = $null }
    }
}
if (-not $gameDir) {
    # Nothing chosen yet: the folder the launcher itself falls back to, read from
    # server.ts so there is one copy of it and not two.
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
if (-not (Get-ChildItem -Path $gameDir -Filter '*.exe' -File -ErrorAction SilentlyContinue)) {
    Write-Host "That game folder holds no executable: $gameDir" -ForegroundColor Red
    Write-Host 'Open the launcher, Settings > Choose folder..., and pick the right one.' -ForegroundColor Red
    exit 1
}

$env:VICTORY_CONFIG = $config
$env:VICTORY_GAME_DIR = $gameDir
$env:VICTORY_CACHE_DIR = Join-Path $root 'gl79-data\cache-gl79'
$env:VICTORY_DATA_DIR = Join-Path $root 'gl79-data'
$env:VICTORY_LOG = 'warn'

if ($Plan) {
    Write-Host "runtime    $exe"
    Write-Host "config     $env:VICTORY_CONFIG"
    Write-Host "game       $env:VICTORY_GAME_DIR"
    Write-Host "cache      $env:VICTORY_CACHE_DIR"
    Write-Host "would run  victory.exe shaders --jobs $Jobs   (up to $Passes passes)"
    Write-Host "then       victory.exe warm --used --jobs $WarmJobs"
    exit 0
}

Push-Location $repo
try {
    $ok = $false
    for ($pass = 1; $pass -le $Passes; $pass++) {
        Write-Host "=== Pass $pass of $Passes - translating every shader into the cache ($Jobs threads) ===" -ForegroundColor Cyan
        & $exe shaders --jobs $Jobs
        if ($LASTEXITCODE -eq 0) { $ok = $true; break }
        Write-Host "Pass $pass stopped with code $LASTEXITCODE. Starting again: shaders already cached are skipped." -ForegroundColor Yellow
    }
    if (-not $ok) {
        Write-Host "Still failing after $Passes passes: the shader it names above is the one to look at." -ForegroundColor Red
        exit 1
    }
    Write-Host 'Shaders done.' -ForegroundColor Green

    # Host pipelines: only the ones a run has written down (VICTORY_PIPELINE_BOOK,
    # i.e. Play once with -Record). Nothing recorded is not a failure.
    Write-Host '=== Host pipelines of the recorded runs (skipped when nothing is recorded) ===' -ForegroundColor Cyan
    & $exe warm --used --jobs $WarmJobs
    if ($LASTEXITCODE -eq 0) {
        Write-Host 'Pipelines done. Play no longer compiles in its first minutes.' -ForegroundColor Green
    } else {
        Write-Host "No pipelines were made (exit $LASTEXITCODE): no run has recorded its book yet." -ForegroundColor Yellow
        Write-Host 'To record one: launch with the launcher'"'"'s Record option, play a little, then run this again.'
    }
} finally {
    Pop-Location
}
