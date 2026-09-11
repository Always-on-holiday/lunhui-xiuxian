param(
    [switch]$Test
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()

$projectDir = Split-Path -Parent $PSScriptRoot
$contentDir = Join-Path $projectDir "public\游戏内容"
$contentFile = Join-Path $contentDir "界面文字.json"

if (-not (Test-Path -LiteralPath $contentFile)) {
    Write-Host "没有找到游戏内容配置。" -ForegroundColor Red
    Write-Host "请保留启动器和“网页原型”文件夹原来的位置。"
    if (-not $Test) {
        Read-Host "按回车关闭"
    }
    exit 1
}

if ($Test) {
    Write-Output "CONTENT_DIR_OK=$contentDir"
    exit 0
}

Start-Process -FilePath "explorer.exe" -ArgumentList $contentDir
