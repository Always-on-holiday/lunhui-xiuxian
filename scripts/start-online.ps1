$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()

$projectDir = Split-Path -Parent $PSScriptRoot
$nodePath = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"

if (-not (Test-Path -LiteralPath $nodePath)) {
    $systemNode = Get-Command node -ErrorAction SilentlyContinue
    if ($null -eq $systemNode) {
        Write-Host "没有找到启动游戏所需的运行环境。" -ForegroundColor Red
        Write-Host "请把这个窗口截图发给我。"
        Read-Host "按回车关闭"
        exit 1
    }
    $nodePath = $systemNode.Source
}

$wranglerPath = Join-Path $projectDir "node_modules\wrangler\bin\wrangler.js"
$configPath = Join-Path $projectDir "dist\server\wrangler.json"

if (-not (Test-Path -LiteralPath $wranglerPath) -or -not (Test-Path -LiteralPath $configPath)) {
    Write-Host "没有找到完整的游戏文件。" -ForegroundColor Red
    Write-Host "请保留启动器和“网页原型”文件夹原来的位置。"
    Read-Host "按回车关闭"
    exit 1
}

Set-Location -LiteralPath $projectDir
Clear-Host
Write-Host "==================================================" -ForegroundColor DarkGreen
Write-Host "          轮回仙途 - 互联网临时联机" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor DarkGreen
Write-Host ""
Write-Host "正在启动本地世界并建立临时联机通道……"
Write-Host ""
Write-Host "游戏准备好后，会自动使用默认浏览器打开。" -ForegroundColor Green
Write-Host "成功后，窗口会显示一个以 trycloudflare.com 结尾的网址。" -ForegroundColor Yellow
Write-Host "把完整网址发给朋友；你自己的页面无需复制网址。" -ForegroundColor Yellow
Write-Host "第一次若询问是否下载 cloudflared，请输入 y 后回车。"
Write-Host ""
Write-Host "这个窗口必须保持开启；想停止联机时按 Ctrl+C。"
Write-Host "关闭后，临时网址会立即失效，下次启动会生成新网址。"
Write-Host "==================================================" -ForegroundColor DarkGreen
Write-Host ""

$arguments = @(
    "--import", "./scripts/sites-env.mjs",
    "./node_modules/wrangler/bin/wrangler.js",
    "dev",
    "--config", "dist/server/wrangler.json",
    "--local",
    "--persist-to", ".wrangler/state",
    "--ip", "127.0.0.1",
    "--inspector-port", "0",
    "--tunnel"
)

$localGameUrl = "http://127.0.0.1:8787"
$browserJob = Start-Job -ScriptBlock {
    param($gameUrl)

    for ($attempt = 0; $attempt -lt 120; $attempt++) {
        try {
            $response = Invoke-WebRequest -UseBasicParsing -Uri $gameUrl -TimeoutSec 2
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) {
                Start-Process $gameUrl
                return
            }
        }
        catch {
            # The local server is still starting.
        }

        Start-Sleep -Milliseconds 500
    }
} -ArgumentList $localGameUrl

try {
    & $nodePath @arguments
    $exitCode = $LASTEXITCODE
}
catch {
    Write-Host ""
    Write-Host "启动失败：$($_.Exception.Message)" -ForegroundColor Red
    $exitCode = 1
}
finally {
    Stop-Job -Job $browserJob -ErrorAction SilentlyContinue
    Remove-Job -Job $browserJob -Force -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "联机已经停止，原来的临时网址现已失效。" -ForegroundColor Yellow
Read-Host "按回车关闭"
exit $exitCode
