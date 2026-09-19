function Pause-BeforeExit {
    if (-not $script:LauncherNoPause) {
        Read-Host "按回车关闭" | Out-Null
    }
}

function Stop-Launcher {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Message,
        [string]$Hint = "请把这个窗口截图发给开发者。"
    )

    Write-Host $Message -ForegroundColor Red
    if (-not [string]::IsNullOrWhiteSpace($Hint)) {
        Write-Host $Hint
    }
    Pause-BeforeExit
    exit 1
}

function Get-Sha256Hex {
    param([Parameter(Mandatory = $true)][string]$Path)

    $stream = [System.IO.File]::OpenRead($Path)
    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    try {
        $hashBytes = $sha256.ComputeHash($stream)
        return ([System.BitConverter]::ToString($hashBytes)).Replace("-", "").ToLowerInvariant()
    }
    finally {
        $sha256.Dispose()
        $stream.Dispose()
    }
}

function New-LauncherMutex {
    $mutex = [System.Threading.Mutex]::new($false, "Local\LunhuiXiuxianLauncher")
    try {
        $ownsMutex = $mutex.WaitOne(0)
    }
    catch [System.Threading.AbandonedMutexException] {
        $ownsMutex = $true
    }

    if (-not $ownsMutex) {
        Stop-Launcher `
            -Message "已有一个游戏启动窗口正在运行。" `
            -Hint "请使用原来的窗口；若它刚关闭，请等待几秒后重试。"
    }
    return $mutex
}

function Write-LauncherHeader {
    param([Parameter(Mandatory = $true)][string]$SavePath)

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
    Write-Host $SavePath -ForegroundColor Green
    Write-Host ""
    Write-Host "这个窗口必须保持开启；想停止联机时按 Ctrl+C。"
    Write-Host "关闭后，临时网址会立即失效，下次启动会生成新网址。"
    Write-Host "==================================================" -ForegroundColor DarkGreen
    Write-Host ""
}
