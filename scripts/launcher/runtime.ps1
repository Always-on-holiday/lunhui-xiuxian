function Test-CompatibleNode {
    param([string]$Candidate)

    if (-not (Test-Path -LiteralPath $Candidate)) { return $false }
    try {
        $reportedVersion = (& $Candidate -p "process.versions.node" 2>$null | Select-Object -Last 1)
        if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($reportedVersion)) { return $false }
        return ([version]$reportedVersion.Trim() -ge [version]"22.23.2")
    }
    catch { return $false }
}

function Test-CompatiblePnpm {
    param([string]$Candidate)

    if (-not (Test-Path -LiteralPath $Candidate)) { return $false }
    try {
        $reportedVersion = (& $Candidate --version 2>$null | Select-Object -Last 1)
        return ($LASTEXITCODE -eq 0 -and $reportedVersion.Trim() -eq "11.19.0")
    }
    catch { return $false }
}

function Test-CompatibleBundledPnpm {
    param([string]$Node, [string]$Script)

    if (-not (Test-Path -LiteralPath $Node) -or -not (Test-Path -LiteralPath $Script)) { return $false }
    try {
        $reportedVersion = (& $Node $Script --version 2>$null | Select-Object -Last 1)
        return ($LASTEXITCODE -eq 0 -and $reportedVersion.Trim() -eq "11.19.0")
    }
    catch { return $false }
}

function Install-PortableNode {
    $nodeVersion = "22.23.2"
    $nodeFolderName = "node-v$nodeVersion-win-x64"
    $nodeArchiveName = "$nodeFolderName.zip"
    $nodeArchiveHash = "1177b4137ba5adaa56354ae40f1080c7450e8ae09cecb47da459d1c52ac99f97"
    $portableRoot = Join-Path $env:LOCALAPPDATA "轮回仙途\开发运行时"
    $portableNodeRoot = Join-Path $portableRoot $nodeFolderName
    $portableNodePath = Join-Path $portableNodeRoot "node.exe"

    if (Test-CompatibleNode -Candidate $portableNodePath) { return $portableNodePath }

    Write-Host "没有检测到 Node.js，正在下载游戏专用运行环境……" -ForegroundColor Yellow
    Write-Host "这一步只在首次启动时执行。"
    $downloadRoot = Join-Path $env:TEMP "lunhui-node-$PID"
    $archivePath = Join-Path $downloadRoot $nodeArchiveName
    $expandedPath = Join-Path $downloadRoot "expanded"

    try {
        if (Test-Path -LiteralPath $downloadRoot) { Remove-Item -LiteralPath $downloadRoot -Recurse -Force }
        New-Item -ItemType Directory -Force -Path $downloadRoot, $expandedPath, $portableRoot | Out-Null
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -UseBasicParsing -Uri "https://nodejs.org/dist/v$nodeVersion/$nodeArchiveName" -OutFile $archivePath
        if ((Get-Sha256Hex -Path $archivePath) -ne $nodeArchiveHash) { throw "下载的 Node.js 文件校验失败。" }
        Expand-Archive -LiteralPath $archivePath -DestinationPath $expandedPath -Force
        if (Test-Path -LiteralPath $portableNodeRoot) { Remove-Item -LiteralPath $portableNodeRoot -Recurse -Force }
        Move-Item -LiteralPath (Join-Path $expandedPath $nodeFolderName) -Destination $portableNodeRoot
    }
    catch {
        Stop-Launcher -Message "游戏运行环境下载失败：$($_.Exception.Message)" -Hint "请检查网络后重新双击启动器。"
    }
    finally {
        if (Test-Path -LiteralPath $downloadRoot) {
            Remove-Item -LiteralPath $downloadRoot -Recurse -Force -ErrorAction SilentlyContinue
        }
    }

    return $portableNodePath
}

function Resolve-LauncherNode {
    param([Parameter(Mandatory = $true)][string]$DependenciesRoot)

    $nodePath = Join-Path $DependenciesRoot "node\bin\node.exe"
    if (Test-CompatibleNode -Candidate $nodePath) { return $nodePath }

    $systemNode = Get-Command node -ErrorAction SilentlyContinue
    if ($null -ne $systemNode -and (Test-CompatibleNode -Candidate $systemNode.Source)) {
        return $systemNode.Source
    }

    $nodePath = Install-PortableNode
    if (-not (Test-CompatibleNode -Candidate $nodePath)) {
        Stop-Launcher -Message "没有找到启动游戏所需的运行环境。"
    }
    return $nodePath
}

function Install-PortablePnpm {
    param([Parameter(Mandatory = $true)][string]$NodePath)

    $pnpmToolsRoot = Join-Path $env:LOCALAPPDATA "轮回仙途\开发运行时\pnpm-11.19.0"
    $portablePnpmScript = Join-Path $pnpmToolsRoot "node_modules\pnpm\bin\pnpm.mjs"
    if (Test-CompatibleBundledPnpm -Node $NodePath -Script $portablePnpmScript) {
        return $portablePnpmScript
    }

    if (Test-Path -LiteralPath $pnpmToolsRoot) { Remove-Item -LiteralPath $pnpmToolsRoot -Recurse -Force }
    $npmPath = Join-Path (Split-Path -Parent $NodePath) "npm.cmd"
    if (-not (Test-Path -LiteralPath $npmPath)) {
        $npmCommand = Get-Command npm -ErrorAction SilentlyContinue
        if ($null -ne $npmCommand) { $npmPath = $npmCommand.Source }
    }
    if (-not (Test-Path -LiteralPath $npmPath)) { return $null }

    Write-Host "正在准备游戏专用依赖工具……" -ForegroundColor DarkGray
    $pnpmStageRoot = "$pnpmToolsRoot.tmp-$PID"
    try {
        if (Test-Path -LiteralPath $pnpmStageRoot) { Remove-Item -LiteralPath $pnpmStageRoot -Recurse -Force }
        New-Item -ItemType Directory -Force -Path $pnpmStageRoot | Out-Null
        & $npmPath install --global --prefix $pnpmStageRoot pnpm@11.19.0 --no-audit --no-fund
        $stagedPnpmScript = Join-Path $pnpmStageRoot "node_modules\pnpm\bin\pnpm.mjs"
        if ($LASTEXITCODE -ne 0 -or -not (Test-CompatibleBundledPnpm -Node $NodePath -Script $stagedPnpmScript)) {
            throw "pnpm 11.19.0 未能正确安装。"
        }
        Move-Item -LiteralPath $pnpmStageRoot -Destination $pnpmToolsRoot
    }
    catch {
        Stop-Launcher -Message "游戏专用依赖工具安装失败：$($_.Exception.Message)" -Hint "请检查网络后重新双击启动器。"
    }
    finally {
        if (Test-Path -LiteralPath $pnpmStageRoot) {
            Remove-Item -LiteralPath $pnpmStageRoot -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
    return $portablePnpmScript
}

function Resolve-PnpmInvocation {
    param([string]$DependenciesRoot, [string]$NodePath)

    $bundledPnpmPath = @(
        (Join-Path $DependenciesRoot "node\node_modules\pnpm\bin\pnpm.mjs")
        (Join-Path $DependenciesRoot "node\node_modules\pnpm\bin\pnpm.cjs")
    ) | Where-Object { Test-CompatibleBundledPnpm -Node $NodePath -Script $_ } | Select-Object -First 1

    if (-not [string]::IsNullOrWhiteSpace($bundledPnpmPath)) {
        Write-Host "使用内置依赖工具。" -ForegroundColor DarkGray
        return [pscustomobject]@{ Executable = $NodePath; Prefix = @($bundledPnpmPath) }
    }

    $pnpmCommand = Get-Command pnpm -ErrorAction SilentlyContinue
    if ($null -ne $pnpmCommand -and (Test-CompatiblePnpm -Candidate $pnpmCommand.Source)) {
        return [pscustomobject]@{ Executable = $pnpmCommand.Source; Prefix = @() }
    }

    $portablePnpmScript = Install-PortablePnpm -NodePath $NodePath
    if (Test-CompatibleBundledPnpm -Node $NodePath -Script $portablePnpmScript) {
        return [pscustomobject]@{ Executable = $NodePath; Prefix = @($portablePnpmScript) }
    }
    return $null
}

function Ensure-ProjectDependencies {
    param(
        [Parameter(Mandatory = $true)]$Paths,
        [Parameter(Mandatory = $true)][string]$NodePath,
        [Parameter(Mandatory = $true)][string]$DependenciesRoot
    )

    $activeNodeVersion = (& $NodePath -p "process.versions.node" | Select-Object -Last 1).Trim()
    $expectedInstallState = @(
        "node=$activeNodeVersion"
        "pnpm=11.19.0"
        "package=$(Get-Sha256Hex -Path $Paths.PackagePath)"
        "lock=$(Get-Sha256Hex -Path $Paths.LockfilePath)"
        "workspace=$(Get-Sha256Hex -Path $Paths.WorkspaceConfigPath)"
        "npmrc=$(Get-Sha256Hex -Path $Paths.NpmConfigPath)"
    ) -join "`n"
    $actualInstallState = if (Test-Path -LiteralPath $Paths.InstallStatePath) {
        [System.IO.File]::ReadAllText($Paths.InstallStatePath)
    } else { "" }

    if ((Test-Path -LiteralPath $Paths.WranglerPath) -and $actualInstallState -eq $expectedInstallState) { return }
    if (Test-Path -LiteralPath $Paths.InstallStatePath) { Remove-Item -LiteralPath $Paths.InstallStatePath -Force }

    Write-Host "首次启动，正在自动安装游戏运行文件……" -ForegroundColor Yellow
    Write-Host "这一步只需执行一次，可能需要几分钟。"
    $pnpm = Resolve-PnpmInvocation -DependenciesRoot $DependenciesRoot -NodePath $NodePath
    if ($null -eq $pnpm) {
        Stop-Launcher -Message "没有找到依赖安装工具。" -Hint "请检查网络后重新双击启动器。"
    }

    Push-Location $Paths.ProjectDir
    try {
        $installArguments = @($pnpm.Prefix) + @("install", "--frozen-lockfile")
        & $pnpm.Executable @installArguments
        $installExitCode = $LASTEXITCODE
    }
    finally { Pop-Location }

    if ($installExitCode -ne 0 -or -not (Test-Path -LiteralPath $Paths.WranglerPath)) {
        Stop-Launcher -Message "游戏运行文件安装失败。" -Hint "请检查网络后重试；若仍失败，请把这个窗口截图发给开发者。"
    }

    $installStateTempPath = "$($Paths.InstallStatePath).tmp-$PID"
    try {
        [System.IO.File]::WriteAllText($installStateTempPath, $expectedInstallState, [System.Text.UTF8Encoding]::new($false))
        Move-Item -LiteralPath $installStateTempPath -Destination $Paths.InstallStatePath -Force
    }
    finally {
        if (Test-Path -LiteralPath $installStateTempPath) {
            Remove-Item -LiteralPath $installStateTempPath -Force -ErrorAction SilentlyContinue
        }
    }
    Write-Host "游戏运行文件安装完成。" -ForegroundColor Green
}
