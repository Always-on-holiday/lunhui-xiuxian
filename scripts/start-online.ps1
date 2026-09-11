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
$builtWorkerPath = Join-Path $projectDir "dist\server\index.js"
$frameworkScriptPath = Join-Path $projectDir "scripts\run-framework.mjs"
$saveConfigPath = Join-Path $projectDir "wrangler.save.json"
$projectRoot = Split-Path -Parent $projectDir
$saveRoot = Join-Path $projectRoot "世界存档"
$activeWorldPath = Join-Path $saveRoot "默认世界"
$legacyStatePath = Join-Path $projectDir ".wrangler\state"
$contentSourcePath = Join-Path $projectDir "public\游戏内容"
$contentTargetPath = Join-Path $projectDir "dist\client\游戏内容"

if (
    -not (Test-Path -LiteralPath $wranglerPath) -or
    -not (Test-Path -LiteralPath $frameworkScriptPath) -or
    -not (Test-Path -LiteralPath $saveConfigPath)
) {
    Write-Host "没有找到完整的游戏文件。" -ForegroundColor Red
    Write-Host "请保留启动器和“网页原型”文件夹原来的位置。"
    Read-Host "按回车关闭"
    exit 1
}

$existingServer = Get-NetTCPConnection -LocalPort 8787 -State Listen -ErrorAction SilentlyContinue
if ($existingServer) {
    Write-Host "已有一个游戏服务器正在运行。" -ForegroundColor Yellow
    Write-Host "请使用已经打开的游戏页面，或先关闭旧的黑色窗口。"
    Read-Host "按回车关闭"
    exit 1
}

$buildInputs = @(
    (Join-Path $projectDir "app"),
    (Join-Path $projectDir "db"),
    (Join-Path $projectDir "next.config.ts"),
    (Join-Path $projectDir "vite.config.ts"),
    (Join-Path $projectDir "package.json"),
    (Join-Path $projectDir "pnpm-lock.yaml")
)
$latestSourceChange = $buildInputs |
    Where-Object { Test-Path -LiteralPath $_ } |
    ForEach-Object {
        if ((Get-Item -LiteralPath $_).PSIsContainer) {
            Get-ChildItem -LiteralPath $_ -Recurse -File
        }
        else {
            Get-Item -LiteralPath $_
        }
    } |
    Sort-Object LastWriteTimeUtc -Descending |
    Select-Object -First 1

$needsBuild = -not (Test-Path -LiteralPath $configPath) -or
    -not (Test-Path -LiteralPath $builtWorkerPath) -or
    ($latestSourceChange -and $latestSourceChange.LastWriteTimeUtc -gt (Get-Item -LiteralPath $builtWorkerPath -ErrorAction SilentlyContinue).LastWriteTimeUtc)

if ($needsBuild) {
    Write-Host "检测到网页程序有更新，正在自动构建……" -ForegroundColor Yellow
    & $nodePath $frameworkScriptPath build
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $configPath)) {
        Write-Host "网页更新失败，请把这个窗口截图发给我。" -ForegroundColor Red
        Read-Host "按回车关闭"
        exit 1
    }
    Write-Host "网页程序已更新。" -ForegroundColor Green
}

New-Item -ItemType Directory -Force -Path $saveRoot | Out-Null
$legacySaveImported = $false

if (-not (Test-Path -LiteralPath $activeWorldPath)) {
    if (Test-Path -LiteralPath $legacyStatePath) {
        Copy-Item -LiteralPath $legacyStatePath -Destination $activeWorldPath -Recurse -Force
        $legacySaveImported = $true
    }
    else {
        New-Item -ItemType Directory -Force -Path $activeWorldPath | Out-Null
    }
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
Write-Host "世界会自动保存到：" -ForegroundColor Green
Write-Host $activeWorldPath -ForegroundColor Green
Write-Host ""
Write-Host "这个窗口必须保持开启；想停止联机时按 Ctrl+C。"
Write-Host "关闭后，临时网址会立即失效，下次启动会生成新网址。"
Write-Host "==================================================" -ForegroundColor DarkGreen
Write-Host ""

if ($legacySaveImported) {
    Write-Host "正在把旧测试世界迁入新的存档目录……"
    $bootstrapSql = "CREATE TABLE IF NOT EXISTS d1_migrations(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL); INSERT OR IGNORE INTO d1_migrations(name) VALUES ('0000_ordinary_selene.sql');"
    & $nodePath $wranglerPath d1 execute DB --config $saveConfigPath --local --persist-to $activeWorldPath --command $bootstrapSql --yes
    if ($LASTEXITCODE -ne 0) {
        Write-Host "旧存档迁移失败，请把这个窗口截图发给我。" -ForegroundColor Red
        Read-Host "按回车关闭"
        exit 1
    }
}

Write-Host "正在载入世界存档……"
$hadCiValue = Test-Path Env:CI
$previousCiValue = $env:CI
try {
    $env:CI = "true"
    & $nodePath $wranglerPath d1 migrations apply DB --config $saveConfigPath --local --persist-to $activeWorldPath
    $migrationExitCode = $LASTEXITCODE
}
finally {
    if ($hadCiValue) {
        $env:CI = $previousCiValue
    }
    else {
        Remove-Item Env:CI -ErrorAction SilentlyContinue
    }
}

if ($migrationExitCode -ne 0) {
    Write-Host "世界存档读取失败，请把这个窗口截图发给我。" -ForegroundColor Red
    Read-Host "按回车关闭"
    exit 1
}

if (Test-Path -LiteralPath $contentSourcePath) {
    New-Item -ItemType Directory -Force -Path $contentTargetPath | Out-Null
    Copy-Item -Path (Join-Path $contentSourcePath "*") -Destination $contentTargetPath -Recurse -Force
    Write-Host "游戏文字已更新。" -ForegroundColor Green
}

Write-Host "世界存档已载入，正在开启联机……" -ForegroundColor Green
Write-Host ""

$arguments = @(
    "--import", "./scripts/sites-env.mjs",
    "./node_modules/wrangler/bin/wrangler.js",
    "dev",
    "--config", "dist/server/wrangler.json",
    "--local",
    "--persist-to", $activeWorldPath,
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
