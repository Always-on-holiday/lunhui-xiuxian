function New-ProjectPaths {
    param([Parameter(Mandatory = $true)][string]$ProjectDir)

    $projectRoot = Split-Path -Parent $ProjectDir
    $saveRoot = Join-Path $projectRoot "世界存档"
    return [pscustomobject]@{
        ProjectDir = $ProjectDir
        WranglerPath = Join-Path $ProjectDir "node_modules\wrangler\bin\wrangler.js"
        ConfigPath = Join-Path $ProjectDir "dist\server\wrangler.json"
        BuiltWorkerPath = Join-Path $ProjectDir "dist\server\index.js"
        FrameworkScriptPath = Join-Path $ProjectDir "scripts\run-framework.mjs"
        SaveConfigPath = Join-Path $ProjectDir "wrangler.save.json"
        PackagePath = Join-Path $ProjectDir "package.json"
        LockfilePath = Join-Path $ProjectDir "pnpm-lock.yaml"
        WorkspaceConfigPath = Join-Path $ProjectDir "pnpm-workspace.yaml"
        NpmConfigPath = Join-Path $ProjectDir ".npmrc"
        InstallStatePath = Join-Path $ProjectDir "node_modules\.lunhui-install-state"
        SaveRoot = $saveRoot
        ActiveWorldPath = Join-Path $saveRoot "默认世界"
        LegacyStatePath = Join-Path $ProjectDir ".wrangler\state"
        ContentSourcePath = Join-Path $ProjectDir "public\游戏内容"
        ContentTargetPath = Join-Path $ProjectDir "dist\client\游戏内容"
    }
}

function Assert-CompleteProject {
    param([Parameter(Mandatory = $true)]$Paths)

    $required = @(
        $Paths.FrameworkScriptPath,
        $Paths.SaveConfigPath,
        $Paths.PackagePath,
        $Paths.LockfilePath,
        $Paths.WorkspaceConfigPath,
        $Paths.NpmConfigPath
    )
    if ($required | Where-Object { -not (Test-Path -LiteralPath $_) }) {
        Stop-Launcher -Message "没有找到完整的游戏文件。" -Hint "请在 GitHub Desktop 中重新获取项目后再试。"
    }
}

function Test-GamePortInUse {
    try {
        $listener = [System.Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners() |
            Where-Object { $_.Port -eq 8787 } |
            Select-Object -First 1
        return $null -ne $listener
    }
    catch { return $false }
}

function Get-LatestSourceChange {
    param([Parameter(Mandatory = $true)]$Paths)

    $buildInputs = @(
        (Join-Path $Paths.ProjectDir "app"),
        (Join-Path $Paths.ProjectDir "components"),
        (Join-Path $Paths.ProjectDir "hooks"),
        (Join-Path $Paths.ProjectDir "lib"),
        (Join-Path $Paths.ProjectDir "db"),
        (Join-Path $Paths.ProjectDir "next.config.ts"),
        (Join-Path $Paths.ProjectDir "vite.config.ts"),
        $Paths.PackagePath,
        $Paths.LockfilePath,
        $Paths.WorkspaceConfigPath,
        $Paths.NpmConfigPath
    )
    return $buildInputs |
        Where-Object { Test-Path -LiteralPath $_ } |
        ForEach-Object {
            if ((Get-Item -LiteralPath $_).PSIsContainer) { Get-ChildItem -LiteralPath $_ -Recurse -File }
            else { Get-Item -LiteralPath $_ }
        } |
        Sort-Object LastWriteTimeUtc -Descending |
        Select-Object -First 1
}

function Update-ProjectBuild {
    param([Parameter(Mandatory = $true)]$Paths, [Parameter(Mandatory = $true)][string]$NodePath)

    $latestSourceChange = Get-LatestSourceChange -Paths $Paths
    $needsBuild = -not (Test-Path -LiteralPath $Paths.ConfigPath) -or
        -not (Test-Path -LiteralPath $Paths.BuiltWorkerPath) -or
        ($latestSourceChange -and $latestSourceChange.LastWriteTimeUtc -gt (Get-Item -LiteralPath $Paths.BuiltWorkerPath -ErrorAction SilentlyContinue).LastWriteTimeUtc)
    if (-not $needsBuild) { return }

    Write-Host "检测到网页程序有更新，正在自动构建……" -ForegroundColor Yellow
    & $NodePath $Paths.FrameworkScriptPath build
    $buildExitCode = $LASTEXITCODE
    if ($buildExitCode -ne 0) {
        Write-Host "第一次更新未完成，等待文件占用释放后自动重试……" -ForegroundColor Yellow
        Start-Sleep -Seconds 2
        & $NodePath $Paths.FrameworkScriptPath build
        $buildExitCode = $LASTEXITCODE
    }
    if ($buildExitCode -ne 0 -or -not (Test-Path -LiteralPath $Paths.ConfigPath)) {
        Stop-Launcher -Message "网页更新失败，请把这个窗口截图发给我。" -Hint "若刚关闭过旧联机窗口，请等待数秒后重新双击启动器。"
    }
    Write-Host "网页程序已更新。" -ForegroundColor Green
}

function Initialize-WorldSave {
    param([Parameter(Mandatory = $true)]$Paths)

    New-Item -ItemType Directory -Force -Path $Paths.SaveRoot | Out-Null
    if (Test-Path -LiteralPath $Paths.ActiveWorldPath) { return $false }
    if (Test-Path -LiteralPath $Paths.LegacyStatePath) {
        Copy-Item -LiteralPath $Paths.LegacyStatePath -Destination $Paths.ActiveWorldPath -Recurse -Force
        return $true
    }
    New-Item -ItemType Directory -Force -Path $Paths.ActiveWorldPath | Out-Null
    return $false
}

function Import-LegacyWorld {
    param([Parameter(Mandatory = $true)]$Paths, [Parameter(Mandatory = $true)][string]$NodePath)

    Write-Host "正在把旧测试世界迁入新的存档目录……"
    $bootstrapSql = "CREATE TABLE IF NOT EXISTS d1_migrations(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL); INSERT OR IGNORE INTO d1_migrations(name) VALUES ('0000_ordinary_selene.sql');"
    & $NodePath $Paths.WranglerPath d1 execute DB --config $Paths.SaveConfigPath --local --persist-to $Paths.ActiveWorldPath --command $bootstrapSql --yes
    if ($LASTEXITCODE -ne 0) { Stop-Launcher -Message "旧存档迁移失败，请把这个窗口截图发给我。" }
}

function Update-WorldSchema {
    param([Parameter(Mandatory = $true)]$Paths, [Parameter(Mandatory = $true)][string]$NodePath)

    Write-Host "正在载入世界存档……"
    $hadCiValue = Test-Path Env:CI
    $previousCiValue = $env:CI
    try {
        $env:CI = "true"
        & $NodePath $Paths.WranglerPath d1 migrations apply DB --config $Paths.SaveConfigPath --local --persist-to $Paths.ActiveWorldPath
        $migrationExitCode = $LASTEXITCODE
    }
    finally {
        if ($hadCiValue) { $env:CI = $previousCiValue }
        else { Remove-Item Env:CI -ErrorAction SilentlyContinue }
    }
    if ($migrationExitCode -ne 0) { Stop-Launcher -Message "世界存档读取失败，请把这个窗口截图发给我。" }
}

function Sync-GameContent {
    param([Parameter(Mandatory = $true)]$Paths)

    if (-not (Test-Path -LiteralPath $Paths.ContentSourcePath)) { return }
    New-Item -ItemType Directory -Force -Path $Paths.ContentTargetPath | Out-Null
    Copy-Item -Path (Join-Path $Paths.ContentSourcePath "*") -Destination $Paths.ContentTargetPath -Recurse -Force
    Write-Host "游戏文字已更新。" -ForegroundColor Green
}
