function Wait-ForPublicGame {
    param([Parameter(Mandatory = $true)][string]$Url)

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
        catch { }
        Start-Sleep -Seconds 1
    }
    if (-not $dnsReady) { return $false }

    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        try {
            $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 5
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) { return $true }
        }
        catch { }
        Start-Sleep -Seconds 1
    }
    return $false
}

function Open-PublicGame {
    param([Parameter(Mandatory = $true)][string]$Url)

    try { Set-Clipboard -Value $Url }
    catch { Write-Host "未能自动复制网址，请从上方绿色文字中复制。" -ForegroundColor Yellow }

    Write-Host "公网通道已生成，正在等待它真正可访问……" -ForegroundColor Yellow
    if (-not (Wait-ForPublicGame -Url $Url)) {
        Write-Host "公网地址暂时未就绪，请关闭窗口后重新启动。" -ForegroundColor Red
        return
    }
    try {
        Start-Process $Url
        Write-Host "公网游戏页面已经就绪并自动打开。" -ForegroundColor Green
    }
    catch { Write-Host "未能自动打开浏览器，请打开：$Url" -ForegroundColor Yellow }
}

function Start-OnlineGame {
    param([Parameter(Mandatory = $true)]$Paths, [Parameter(Mandatory = $true)][string]$NodePath)

    $arguments = @(
        "--import", "./scripts/sites-env.mjs",
        "./node_modules/wrangler/bin/wrangler.js",
        "dev",
        "--config", "dist/server/wrangler.json",
        "--local",
        "--persist-to", $Paths.ActiveWorldPath,
        "--ip", "127.0.0.1",
        "--inspector-port", "0",
        "--tunnel"
    )
    $tunnelOpened = $false
    try {
        & $NodePath @arguments | ForEach-Object {
            $line = $_.ToString()
            Write-Host $line
            if (-not $tunnelOpened) {
                $urlMatch = [regex]::Match($line, "https://[a-z0-9-]+\.trycloudflare\.com/?", "IgnoreCase")
                if ($urlMatch.Success) {
                    Open-PublicGame -Url ($urlMatch.Value.TrimEnd("/") + "/")
                    $tunnelOpened = $true
                }
            }
        }
        return $LASTEXITCODE
    }
    catch {
        Write-Host ""
        Write-Host "启动失败：$($_.Exception.Message)" -ForegroundColor Red
        return 1
    }
}
