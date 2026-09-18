param(
    [string]$DependenciesRoot = "",
    [switch]$InstallDependenciesOnly,
    [switch]$NoPause
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()

function Pause-BeforeExit {
    if (-not $NoPause) {
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

function Test-CompatibleNode {
    param([string]$Candidate)

    if (-not (Test-Path -LiteralPath $Candidate)) {
        return $false
    }

    try {
        $reportedVersion = (& $Candidate -p "process.versions.node" 2>$null | Select-Object -Last 1)
        if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($reportedVersion)) {
            return $false
        }
        return ([version]$reportedVersion.Trim() -ge [version]"22.23.2")
    }
    catch {
        return $false
    }
}

function Test-CompatiblePnpm {
    param([string]$Candidate)

    if (-not (Test-Path -LiteralPath $Candidate)) {
        return $false
    }

    try {
        $reportedVersion = (& $Candidate --version 2>$null | Select-Object -Last 1)
        return ($LASTEXITCODE -eq 0 -and $reportedVersion.Trim() -eq "11.19.0")
    }
    catch {
        return $false
    }
}

function Test-CompatibleBundledPnpm {
    param(
        [string]$Node,
        [string]$Script
    )

    if (-not (Test-Path -LiteralPath $Node) -or -not (Test-Path -LiteralPath $Script)) {
        return $false
    }

    try {
        $reportedVersion = (& $Node $Script --version 2>$null | Select-Object -Last 1)
        return ($LASTEXITCODE -eq 0 -and $reportedVersion.Trim() -eq "11.19.0")
    }
    catch {
        return $false
    }
}

function Get-Sha256Hex {
    param([string]$Path)

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

$launcherMutex = [System.Threading.Mutex]::new($false, "Local\LunhuiXiuxianLauncher")
try {
    $ownsLauncherMutex = $launcherMutex.WaitOne(0)
}
catch [System.Threading.AbandonedMutexException] {
    $ownsLauncherMutex = $true
}

if (-not $ownsLauncherMutex) {
    Stop-Launcher `
        -Message "已有一个游戏启动窗口正在运行。" `
        -Hint "请使用原来的窗口；若它刚关闭，请等待几秒后重试。"
}

$projectDir = Split-Path -Parent $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($DependenciesRoot)) {
    $DependenciesRoot = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies"
}

$nodePath = Join-Path $DependenciesRoot "node\bin\node.exe"

if (-not (Test-CompatibleNode -Candidate $nodePath)) {
    $systemNode = Get-Command node -ErrorAction SilentlyContinue
    if ($null -ne $systemNode -and (Test-CompatibleNode -Candidate $systemNode.Source)) {
        $nodePath = $systemNode.Source
    }
    else {
        $nodeVersion = "22.23.2"
        $nodeFolderName = "node-v$nodeVersion-win-x64"
        $nodeArchiveName = "$nodeFolderName.zip"
        $nodeArchiveHash = "1177b4137ba5adaa56354ae40f1080c7450e8ae09cecb47da459d1c52ac99f97"
        $portableRoot = Join-Path $env:LOCALAPPDATA "轮回仙途\开发运行时"
        $portableNodeRoot = Join-Path $portableRoot $nodeFolderName
        $nodePath = Join-Path $portableNodeRoot "node.exe"

        if (-not (Test-CompatibleNode -Candidate $nodePath)) {
            Write-Host "没有检测到 Node.js，正在下载游戏专用运行环境……" -ForegroundColor Yellow
            Write-Host "这一步只在首次启动时执行。"

            $downloadRoot = Join-Path $env:TEMP "lunhui-node-$PID"
            $archivePath = Join-Path $downloadRoot $nodeArchiveName
            $expandedPath = Join-Path $downloadRoot "expanded"

            try {
                if (Test-Path -LiteralPath $downloadRoot) {
                    Remove-Item -LiteralPath $downloadRoot -Recurse -Force
                }
                New-Item -ItemType Directory -Force -Path $downloadRoot, $expandedPath, $portableRoot | Out-Null

                [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
                Invoke-WebRequest `
                    -UseBasicParsing `
                    -Uri "https://nodejs.org/dist/v$nodeVersion/$nodeArchiveName" `
                    -OutFile $archivePath

                $actualHash = Get-Sha256Hex -Path $archivePath
                if ($actualHash -ne $nodeArchiveHash) {
                    throw "下载的 Node.js 文件校验失败。"
                }

                Expand-Archive -LiteralPath $archivePath -DestinationPath $expandedPath -Force
                if (Test-Path -LiteralPath $portableNodeRoot) {
                    Remove-Item -LiteralPath $portableNodeRoot -Recurse -Force
                }
                Move-Item -LiteralPath (Join-Path $expandedPath $nodeFolderName) -Destination $portableNodeRoot
            }
            catch {
                Stop-Launcher `
                    -Message "游戏运行环境下载失败：$($_.Exception.Message)" `
                    -Hint "请检查网络后重新双击启动器。"
            }
            finally {
                if (Test-Path -LiteralPath $downloadRoot) {
                    Remove-Item -LiteralPath $downloadRoot -Recurse -Force -ErrorAction SilentlyContinue
                }
            }
        }
    }
}

if (-not (Test-CompatibleNode -Candidate $nodePath)) {
    Stop-Launcher -Message "没有找到启动游戏所需的运行环境。"
}

# pnpm 的生命周期脚本（例如 esbuild 安装）会从 PATH 查找 node。
# 始终把已经验证过版本的 Node 放在最前面，避免误用旧版本。
$nodeDirectory = Split-Path -Parent $nodePath
$env:PATH = "$nodeDirectory;$env:PATH"

$wranglerPath = Join-Path $projectDir "node_modules\wrangler\bin\wrangler.js"
$configPath = Join-Path $projectDir "dist\server\wrangler.json"
$builtWorkerPath = Join-Path $projectDir "dist\server\index.js"
$frameworkScriptPath = Join-Path $projectDir "scripts\run-framework.mjs"
$saveConfigPath = Join-Path $projectDir "wrangler.save.json"
$packagePath = Join-Path $projectDir "package.json"
$lockfilePath = Join-Path $projectDir "pnpm-lock.yaml"
$workspaceConfigPath = Join-Path $projectDir "pnpm-workspace.yaml"
$npmConfigPath = Join-Path $projectDir ".npmrc"
$installStatePath = Join-Path $projectDir "node_modules\.lunhui-install-state"
$projectRoot = Split-Path -Parent $projectDir
$saveRoot = Join-Path $projectRoot "世界存档"
$activeWorldPath = Join-Path $saveRoot "默认世界"
$legacyStatePath = Join-Path $projectDir ".wrangler\state"
$contentSourcePath = Join-Path $projectDir "public\游戏内容"
$contentTargetPath = Join-Path $projectDir "dist\client\游戏内容"

if (
    -not (Test-Path -LiteralPath $frameworkScriptPath) -or
    -not (Test-Path -LiteralPath $saveConfigPath) -or
    -not (Test-Path -LiteralPath $packagePath) -or
    -not (Test-Path -LiteralPath $lockfilePath) -or
    -not (Test-Path -LiteralPath $workspaceConfigPath) -or
    -not (Test-Path -LiteralPath $npmConfigPath)
) {
    Stop-Launcher `
        -Message "没有找到完整的游戏文件。" `
        -Hint "请在 GitHub Desktop 中重新获取项目后再试。"
}

$activeNodeVersion = (& $nodePath -p "process.versions.node" | Select-Object -Last 1).Trim()
$packageHash = Get-Sha256Hex -Path $packagePath
$lockfileHash = Get-Sha256Hex -Path $lockfilePath
$workspaceConfigHash = Get-Sha256Hex -Path $workspaceConfigPath
$npmConfigHash = Get-Sha256Hex -Path $npmConfigPath
$expectedInstallState = @(
    "node=$activeNodeVersion"
    "pnpm=11.19.0"
    "package=$packageHash"
    "lock=$lockfileHash"
    "workspace=$workspaceConfigHash"
    "npmrc=$npmConfigHash"
) -join "`n"
$actualInstallState = if (Test-Path -LiteralPath $installStatePath) {
    [System.IO.File]::ReadAllText($installStatePath)
}
else {
    ""
}
$needsDependencyInstall = -not (Test-Path -LiteralPath $wranglerPath) -or
    $actualInstallState -ne $expectedInstallState

if ($needsDependencyInstall) {
    # 旧标记只能代表上一次完整安装。重装一开始就使它失效，
    # 这样即使本次在中途失败，下次启动仍会继续修复依赖。
    if (Test-Path -LiteralPath $installStatePath) {
        Remove-Item -LiteralPath $installStatePath -Force
    }

    Write-Host "首次启动，正在自动安装游戏运行文件……" -ForegroundColor Yellow
    Write-Host "这一步只需执行一次，可能需要几分钟。"

    $pnpmExecutable = $null
    $pnpmArgumentsPrefix = @()
    $bundledPnpmPath = @(
        (Join-Path $DependenciesRoot "node\node_modules\pnpm\bin\pnpm.mjs")
        (Join-Path $DependenciesRoot "node\node_modules\pnpm\bin\pnpm.cjs")
    ) | Where-Object {
        Test-CompatibleBundledPnpm -Node $nodePath -Script $_
    } | Select-Object -First 1

    if (-not [string]::IsNullOrWhiteSpace($bundledPnpmPath)) {
        $pnpmExecutable = $nodePath
        $pnpmArgumentsPrefix = @($bundledPnpmPath)
        Write-Host "使用内置依赖工具。" -ForegroundColor DarkGray
    }
    else {
        $pnpmCommand = Get-Command pnpm -ErrorAction SilentlyContinue
        if ($null -ne $pnpmCommand -and (Test-CompatiblePnpm -Candidate $pnpmCommand.Source)) {
            $pnpmExecutable = $pnpmCommand.Source
        }
        else {
            $pnpmToolsRoot = Join-Path $env:LOCALAPPDATA "轮回仙途\开发运行时\pnpm-11.19.0"
            $portablePnpmScript = Join-Path $pnpmToolsRoot "node_modules\pnpm\bin\pnpm.mjs"

            if (-not (Test-CompatibleBundledPnpm -Node $nodePath -Script $portablePnpmScript)) {
                if (Test-Path -LiteralPath $pnpmToolsRoot) {
                    Remove-Item -LiteralPath $pnpmToolsRoot -Recurse -Force
                }

                $npmPath = Join-Path (Split-Path -Parent $nodePath) "npm.cmd"
                if (-not (Test-Path -LiteralPath $npmPath)) {
                    $npmCommand = Get-Command npm -ErrorAction SilentlyContinue
                    if ($null -ne $npmCommand) {
                        $npmPath = $npmCommand.Source
                    }
                }

                if (Test-Path -LiteralPath $npmPath) {
                    Write-Host "正在准备游戏专用依赖工具……" -ForegroundColor DarkGray
                    $pnpmStageRoot = "$pnpmToolsRoot.tmp-$PID"
                    try {
                        if (Test-Path -LiteralPath $pnpmStageRoot) {
                            Remove-Item -LiteralPath $pnpmStageRoot -Recurse -Force
                        }
                        New-Item -ItemType Directory -Force -Path $pnpmStageRoot | Out-Null
                        & $npmPath install --global --prefix $pnpmStageRoot pnpm@11.19.0 --no-audit --no-fund
                        $stagedPnpmScript = Join-Path $pnpmStageRoot "node_modules\pnpm\bin\pnpm.mjs"
                        if ($LASTEXITCODE -ne 0 -or -not (Test-CompatibleBundledPnpm -Node $nodePath -Script $stagedPnpmScript)) {
                            throw "pnpm 11.19.0 未能正确安装。"
                        }
                        Move-Item -LiteralPath $pnpmStageRoot -Destination $pnpmToolsRoot
                    }
                    catch {
                        Stop-Launcher `
                            -Message "游戏专用依赖工具安装失败：$($_.Exception.Message)" `
                            -Hint "请检查网络后重新双击启动器。"
                    }
                    finally {
                        if (Test-Path -LiteralPath $pnpmStageRoot) {
                            Remove-Item -LiteralPath $pnpmStageRoot -Recurse -Force -ErrorAction SilentlyContinue
                        }
                    }
                }
            }

            if (Test-CompatibleBundledPnpm -Node $nodePath -Script $portablePnpmScript) {
                $pnpmExecutable = $nodePath
                $pnpmArgumentsPrefix = @($portablePnpmScript)
            }
        }
    }

    if ([string]::IsNullOrWhiteSpace($pnpmExecutable)) {
        Stop-Launcher `
            -Message "没有找到依赖安装工具。" `
            -Hint "请检查网络后重新双击启动器。"
    }

    Push-Location $projectDir
    try {
        $installArguments = @($pnpmArgumentsPrefix) + @("install", "--frozen-lockfile")
        & $pnpmExecutable @installArguments
        $installExitCode = $LASTEXITCODE
    }
    finally {
        Pop-Location
    }

    if ($installExitCode -ne 0 -or -not (Test-Path -LiteralPath $wranglerPath)) {
        Stop-Launcher `
            -Message "游戏运行文件安装失败。" `
            -Hint "请检查网络后重试；若仍失败，请把这个窗口截图发给开发者。"
    }

    $installStateTempPath = "$installStatePath.tmp-$PID"
    try {
        [System.IO.File]::WriteAllText(
            $installStateTempPath,
            $expectedInstallState,
            [System.Text.UTF8Encoding]::new($false)
        )
        Move-Item -LiteralPath $installStateTempPath -Destination $installStatePath -Force
    }
    finally {
        if (Test-Path -LiteralPath $installStateTempPath) {
            Remove-Item -LiteralPath $installStateTempPath -Force -ErrorAction SilentlyContinue
        }
    }
    Write-Host "游戏运行文件安装完成。" -ForegroundColor Green
}

if ($InstallDependenciesOnly) {
    Write-Host "Windows 干净环境依赖检查通过。" -ForegroundColor Green
    exit 0
}

try {
    $existingServer = [System.Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners() |
        Where-Object { $_.Port -eq 8787 } |
        Select-Object -First 1
}
catch {
    $existingServer = $null
}

if ($null -ne $existingServer) {
    Write-Host "已有一个游戏服务器正在运行。" -ForegroundColor Yellow
    Write-Host "请使用已经打开的游戏页面，或先关闭旧的黑色窗口。"
    Pause-BeforeExit
    exit 1
}

$buildInputs = @(
    (Join-Path $projectDir "app"),
    (Join-Path $projectDir "db"),
    (Join-Path $projectDir "next.config.ts"),
    (Join-Path $projectDir "vite.config.ts"),
    (Join-Path $projectDir "package.json"),
    (Join-Path $projectDir "pnpm-lock.yaml"),
    (Join-Path $projectDir "pnpm-workspace.yaml"),
    (Join-Path $projectDir ".npmrc")
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
    $buildExitCode = $LASTEXITCODE

    if ($buildExitCode -ne 0) {
        Write-Host "第一次更新未完成，等待文件占用释放后自动重试……" -ForegroundColor Yellow
        Start-Sleep -Seconds 2
        & $nodePath $frameworkScriptPath build
        $buildExitCode = $LASTEXITCODE
    }

    if ($buildExitCode -ne 0 -or -not (Test-Path -LiteralPath $configPath)) {
        Write-Host "网页更新失败，请把这个窗口截图发给我。" -ForegroundColor Red
        Write-Host "若刚关闭过旧联机窗口，请等待数秒后重新双击启动器。" -ForegroundColor Yellow
        Pause-BeforeExit
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
        Pause-BeforeExit
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
    Pause-BeforeExit
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
    # Wrangler 的正常警告会写到 stderr。不要把 stderr 合并进 PowerShell
    # 的错误管道；只分析 stdout 中的公网网址。
    & $nodePath @arguments | ForEach-Object {
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
Pause-BeforeExit
exit $exitCode
