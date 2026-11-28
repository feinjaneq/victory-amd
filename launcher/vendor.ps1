# The two SDKs this project expects, taken from their own publishers and only
# when they are missing:
#
#   Microsoft's DirectX 12 Agility SDK - the runtime redistributable NuGet
#     package (D3D12Core.dll, d3d12SDKLayers.dll, and its LICENSE.txt), into
#     <root>\agility\, which is a D3D12SDKPath folder as it stands.
#   AMD's FSR SDK, FidelityFX-SDK tag v2.4.0 - the ten files of
#     Kits/FidelityFX/signedbin (what -FidelityFxDir points at), with the SDK's
#     license.md and 3rdpartynotice.md beside them, into
#     <root>\ffx\Kits\FidelityFX\signedbin\.
#
# Downloads go to the temp folder and are removed afterwards, so a failed run
# leaves nothing half-written. -Plan says what it would fetch and stops.
param(
  [string]$Root = (Split-Path -Parent $PSScriptRoot),
  [string]$AgilityVersion = "1.620.2",
  [string]$FsrTag = "v2.4.0",
  [switch]$Plan
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$script:failed = $false

function Get-File([string]$Url, [string]$OutFile, [string]$What) {
  if ($Plan) {
    Write-Host "would download  $What"
    Write-Host "                $Url"
    Write-Host "                -> $OutFile"
    return $false
  }
  Write-Host "downloading     $What"
  Write-Host "                $Url"
  try {
    New-Item -ItemType Directory -Path (Split-Path -Parent $OutFile) -Force | Out-Null
    Invoke-WebRequest -Uri $Url -OutFile $OutFile -UseBasicParsing
    return $true
  } catch {
    Write-Host "failed          $Url" -ForegroundColor Red
    Write-Host "                $($_.Exception.Message)" -ForegroundColor Red
    $script:failed = $true
    return $false
  }
}

# ---------- DirectX 12 Agility SDK ----------

$agility = Join-Path $Root "agility"
$agilityCore = Join-Path $agility "D3D12Core.dll"

if (Test-Path $agilityCore) {
  Write-Host "ok              DirectX 12 Agility SDK is in place: $agility"
} else {
  $temp = Join-Path ([IO.Path]::GetTempPath()) ("retail-game-agility-" + [guid]::NewGuid().ToString("N"))
  try {
    $url = "https://www.nuget.org/api/v2/package/Microsoft.Direct3D.D3D12/$AgilityVersion"
    $zip = Join-Path $temp "agility.zip"
    if (Get-File $url $zip "DirectX 12 Agility SDK $AgilityVersion (Microsoft.Direct3D.D3D12, NuGet)") {
      $out = Join-Path $temp "agility"
      Expand-Archive -Path $zip -DestinationPath $out -Force
      $bin = Join-Path $out "build/native/bin/x64"
      $names = @("D3D12Core.dll", "d3d12SDKLayers.dll")
      foreach ($name in $names) {
        if (-not (Test-Path (Join-Path $bin $name))) {
          throw "the package has no build/native/bin/x64/$name - was $AgilityVersion published?"
        }
      }
      New-Item -ItemType Directory -Path $agility -Force | Out-Null
      foreach ($name in $names) { Copy-Item (Join-Path $bin $name) $agility -Force }
      $license = Join-Path $out "LICENSE.txt"
      if (Test-Path $license) {
        Copy-Item $license (Join-Path $agility "LICENSE.txt") -Force
      } else {
        Write-Host "note            the package has no LICENSE.txt beside its binaries" -ForegroundColor Yellow
      }
      Write-Host "wrote           $agility  ($($names -join ', '), LICENSE.txt)"
    }
  } finally {
    Remove-Item $temp -Recurse -Force -ErrorAction SilentlyContinue
  }
}

# ---------- AMD FSR SDK ----------

$ffx = Join-Path $Root "ffx\Kits\FidelityFX\signedbin"
$upscaler = Join-Path $ffx "amd_fidelityfx_upscaler_dx12.dll"

if (Test-Path $upscaler) {
  Write-Host "ok              AMD FSR SDK is in place: $ffx"
} else {
  # The tag's own files, one by one: the source archive also carries the
  # samples and their media, which none of this needs.
  $names = @(
    "amd_fidelityfx_denoiser_dx12.dll",
    "amd_fidelityfx_framegeneration_dx12.dll",
    "amd_fidelityfx_framegeneration_vk.dll",
    "amd_fidelityfx_loader_dx12.dll",
    "amd_fidelityfx_loader_dx12.lib",
    "amd_fidelityfx_loader_vk.dll",
    "amd_fidelityfx_loader_vk.lib",
    "amd_fidelityfx_radiancecache_dx12.dll",
    "amd_fidelityfx_upscaler_dx12.dll",
    "amd_fidelityfx_upscaler_vk.dll"
  )
  $repo = "https://raw.githubusercontent.com/GPUOpen-LibrariesAndSDKs/FidelityFX-SDK/$FsrTag"
  New-Item -ItemType Directory -Path $ffx -Force | Out-Null

  $wanted = @()
  foreach ($name in $names) {
    if (-not (Test-Path (Join-Path $ffx $name))) { $wanted += $name }
  }
  Write-Host "AMD FSR SDK $FsrTag ($($wanted.Count) of $($names.Count) files missing)"

  foreach ($name in $wanted) {
    Get-File "$repo/Kits/FidelityFX/signedbin/$name" (Join-Path $ffx $name) $name | Out-Null
  }

  # The license the binaries are under, and the third-party notice of the
  # sources they were built from, both beside the files.
  $docs = @(
    @{ Url = "$repo/Kits/FidelityFX/docs/license.md"; Name = "license.md" },
    @{ Url = "$repo/3rdpartynotice.md"; Name = "3rdpartynotice.md" }
  )
  foreach ($doc in $docs) {
    $dash = Join-Path $ffx $doc.Name
    if (-not (Test-Path $dash)) { Get-File $doc.Url $dash $doc.Name | Out-Null }
  }
  Write-Host "wrote           $ffx"
}

if ($Plan) {
  Write-Host "plan only; nothing was downloaded"
  exit 0
}
if ($script:failed) {
  Write-Host "one or more downloads failed; Play will say the SDKs are missing" -ForegroundColor Red
  exit 1
}
exit 0
