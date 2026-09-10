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

function Wait-ForPublicGame {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Url
    )

    $hostName = ([uri]$Url).DnsSafeHost
    $dnsQueryUrl = "https://cloudflare-dns.com/dns-query?name=$([uri]::EscapeDataString($hostName))&type=A"
    $dnsHeaders = @{ Accept = "application/dns-json" }
    $dnsReady = $false

    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        try {
            $dnsResult = Invoke-RestMethod -Uri $dnsQueryUrl -Headers $dnsHeaders -TimeoutSec 5
            $addressRecords = @($dnsResult.Answer | Where-Object { $_.type -eq 1 -or $_.type -eq 28 })
            if ($dnsResult.Status -eq 0 -and $addressRecords.Count -gt 0) {
                $dnsReady = $true
                break
            }
        }
        catch {
            # The temporary hostname is still being registered.
        }

        Start-Sleep -Seconds 1
    }

    if (-not $dnsReady) {
        return $false
    }

    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        try {
            $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 5
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) {
                return $true
            }
        }
        catch {
            # DNS is ready, but the tunnel may still need a moment.
        }

        Start-Sleep -Seconds 1
    }

    return $false
}

Set-Location -LiteralPath $projectDir
Clear-Host
Write-Host "==================================================" -ForegroundColor DarkGreen
Write-Host "          轮回仙途 - 互联网临时联机" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor DarkGreen
Write-Host ""
Write-Host "正在启动本地世界并建立临时联机通道……"
Write-Host ""
Write-Host "公网地址生成后，会自动使用默认浏览器打开。" -ForegroundColor Green
Write-Host "成功后，窗口会显示一个以 trycloudflare.com 结尾的网址。" -ForegroundColor Yellow
Write-Host "该网址也会自动复制；直接粘贴发给朋友即可。" -ForegroundColor Yellow
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

$tunnelOpened = $false

try {
    & $nodePath @arguments 2>&1 | ForEach-Object {
        $line = $_.ToString()
        Write-Host $line

        if (-not $tunnelOpened) {
            $urlMatch = [regex]::Match($line, "https://[a-z0-9-]+\.trycloudflare\.com/?", "IgnoreCase")
            if ($urlMatch.Success) {
                $publicGameUrl = $urlMatch.Value.TrimEnd("/") + "/"

                try {
                    Set-Clipboard -Value $publicGameUrl
                }
                catch {
                    Write-Host "未能自动复制网址，请从上方绿色文字中复制。" -ForegroundColor Yellow
                }

                Write-Host "公网通道已生成，正在等待它真正可访问……" -ForegroundColor Yellow
                if (Wait-ForPublicGame -Url $publicGameUrl) {
                    try {
                        Start-Process $publicGameUrl
                        Write-Host "公网游戏页面已经就绪并自动打开。" -ForegroundColor Green
                    }
                    catch {
                        Write-Host "未能自动打开浏览器，请打开：$publicGameUrl" -ForegroundColor Yellow
                    }
                }
                else {
                    Write-Host "公网地址暂时未就绪，请关闭窗口后重新启动。" -ForegroundColor Red
                }

                $tunnelOpened = $true
            }
        }
    }
    $exitCode = $LASTEXITCODE
}
catch {
    Write-Host ""
    Write-Host "启动失败：$($_.Exception.Message)" -ForegroundColor Red
    $exitCode = 1
}

Write-Host ""
Write-Host "联机已经停止，原来的临时网址现已失效。" -ForegroundColor Yellow
Read-Host "按回车关闭"
exit $exitCode
