param(
    [string]$NodePath = ""
)

$ErrorActionPreference = "Stop"
$script:LauncherNoPause = $true
$scriptsRoot = Split-Path -Parent $PSScriptRoot
$launcherRoot = Join-Path $scriptsRoot "launcher"
. (Join-Path $launcherRoot "core.ps1")
. (Join-Path $launcherRoot "runtime.ps1")
. (Join-Path $launcherRoot "project.ps1")
. (Join-Path $launcherRoot "online.ps1")

if ([string]::IsNullOrWhiteSpace($NodePath)) {
    $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
    if ($null -eq $nodeCommand) {
        throw "Node.js was not found. Pass -NodePath with a compatible node.exe path."
    }
    $NodePath = $nodeCommand.Source
}

if (-not (Test-CompatibleNode -Candidate $NodePath)) {
    throw "Node compatibility check rejected the test runtime."
}

$projectDir = Split-Path -Parent $scriptsRoot
$paths = New-ProjectPaths -ProjectDir $projectDir
Assert-CompleteProject -Paths $paths

$testRoot = Join-Path ([System.IO.Path]::GetTempPath()) "lunhui-launcher-module-test-$PID"
$resolvedTempRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
$resolvedTestRoot = [System.IO.Path]::GetFullPath($testRoot)
if (-not $resolvedTestRoot.StartsWith($resolvedTempRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to create a launcher fixture outside the temporary directory."
}

try {
    $wranglerDirectory = Join-Path $testRoot "node_modules\wrangler\bin"
    $fixtureScriptsDirectory = Join-Path $testRoot "scripts"
    $savePath = Join-Path $testRoot "玩家 世界\默认世界"
    New-Item -ItemType Directory -Force -Path $wranglerDirectory, $fixtureScriptsDirectory, $savePath | Out-Null
    [System.IO.File]::WriteAllText(
        (Join-Path $fixtureScriptsDirectory "sites-env.mjs"),
        "",
        [System.Text.UTF8Encoding]::new($false)
    )
    $fixturePath = Join-Path $wranglerDirectory "wrangler.js"
    $fixture = @'
const args = process.argv.slice(2);
const required = ["--tunnel", "--persist-to", "--config", "--ip", "127.0.0.1", "--inspector-port", "0"];
const persistIndex = args.indexOf("--persist-to");
const persistPath = persistIndex >= 0 ? args[persistIndex + 1] ?? "" : "";
if (!required.every((value) => args.includes(value)) || !persistPath.includes("玩家 世界")) {
  process.stderr.write(`invalid launcher arguments: ${JSON.stringify(args)}\n`);
  process.exit(91);
}
process.stderr.write("fixture stderr warning\n");
process.stdout.write("fixture server stopped cleanly\n");
'@
    [System.IO.File]::WriteAllText($fixturePath, $fixture, [System.Text.UTF8Encoding]::new($false))
    Push-Location $testRoot
    try {
        $exitCode = Start-OnlineGame -Paths ([pscustomobject]@{ ActiveWorldPath = $savePath }) -NodePath $NodePath
    }
    finally { Pop-Location }
    if ($exitCode -ne 0) { throw "Online launcher module returned exit code $exitCode." }
}
finally {
    if (Test-Path -LiteralPath $resolvedTestRoot) {
        Remove-Item -LiteralPath $resolvedTestRoot -Recurse -Force
    }
}

Write-Host "Launcher module checks passed." -ForegroundColor Green
