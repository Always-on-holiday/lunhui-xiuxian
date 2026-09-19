param(
    [string]$DependenciesRoot = "",
    [switch]$InstallDependenciesOnly,
    [switch]$NoPause
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
$script:LauncherNoPause = [bool]$NoPause

$launcherRoot = Join-Path $PSScriptRoot "launcher"
. (Join-Path $launcherRoot "core.ps1")
. (Join-Path $launcherRoot "runtime.ps1")
. (Join-Path $launcherRoot "project.ps1")
. (Join-Path $launcherRoot "online.ps1")

$launcherMutex = New-LauncherMutex
$projectDir = Split-Path -Parent $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($DependenciesRoot)) {
    $DependenciesRoot = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies"
}

$nodePath = Resolve-LauncherNode -DependenciesRoot $DependenciesRoot
$nodeDirectory = Split-Path -Parent $nodePath
$env:PATH = "$nodeDirectory;$env:PATH"

$paths = New-ProjectPaths -ProjectDir $projectDir
Assert-CompleteProject -Paths $paths
Ensure-ProjectDependencies -Paths $paths -NodePath $nodePath -DependenciesRoot $DependenciesRoot

if ($InstallDependenciesOnly) {
    Write-Host "Windows 干净环境依赖检查通过。" -ForegroundColor Green
    exit 0
}

if (Test-GamePortInUse) {
    Write-Host "已有一个游戏服务器正在运行。" -ForegroundColor Yellow
    Write-Host "请使用已经打开的游戏页面，或先关闭旧的黑色窗口。"
    Pause-BeforeExit
    exit 1
}

Set-Location -LiteralPath $projectDir
Update-ProjectBuild -Paths $paths -NodePath $nodePath
$legacySaveImported = Initialize-WorldSave -Paths $paths
Write-LauncherHeader -SavePath $paths.ActiveWorldPath

if ($legacySaveImported) {
    Import-LegacyWorld -Paths $paths -NodePath $nodePath
}
Update-WorldSchema -Paths $paths -NodePath $nodePath
Sync-GameContent -Paths $paths

Write-Host "世界存档已载入，正在开启联机……" -ForegroundColor Green
Write-Host ""
$exitCode = Start-OnlineGame -Paths $paths -NodePath $nodePath

Write-Host ""
Write-Host "联机已经停止，原来的临时网址现已失效。" -ForegroundColor Yellow
Pause-BeforeExit
exit $exitCode
