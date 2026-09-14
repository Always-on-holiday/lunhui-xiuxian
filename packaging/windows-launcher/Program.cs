using System.Diagnostics;
using System.IO.Compression;
using System.Net;
using System.Net.Http;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

namespace LunhuiXiuxian.Launcher;

internal static partial class Program
{
    private const string PayloadResourceName = "LunhuiXiuxian.Payload.zip";
    private static readonly List<Process> Children = [];
    private static readonly CancellationTokenSource Shutdown = new();
    private static int _cleanedUp;

    private static async Task<int> Main()
    {
        Console.OutputEncoding = Encoding.UTF8;
        Console.Title = "轮回仙途";
        Console.CancelKeyPress += (_, eventArgs) =>
        {
            eventArgs.Cancel = true;
            Shutdown.Cancel();
        };
        AppDomain.CurrentDomain.ProcessExit += (_, _) => Cleanup();

        WriteHeader();

        try
        {
            var dataRoot = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "轮回仙途");
            var saveRoot = Path.Combine(dataRoot, "世界存档", "默认世界");
            Directory.CreateDirectory(saveRoot);

            Console.WriteLine("正在准备游戏文件，首次启动可能需要一点时间……");
            var runtimeRoot = await ExtractRuntimeAsync(dataRoot);
            var appRoot = Path.Combine(runtimeRoot, "app");
            var nodePath = Path.Combine(runtimeRoot, "node", "node.exe");
            var cloudflaredPath = Path.Combine(runtimeRoot, "bin", "cloudflared.exe");
            var wranglerPath = Path.Combine(appRoot, "node_modules", "wrangler", "bin", "wrangler.js");

            RequireFile(nodePath);
            RequireFile(cloudflaredPath);
            RequireFile(wranglerPath);

            Console.WriteLine("正在升级世界存档……");
            var migrationExitCode = await RunAndWaitAsync(
                nodePath,
                [
                    wranglerPath,
                    "d1", "migrations", "apply", "DB",
                    "--config", Path.Combine(appRoot, "wrangler.save.json"),
                    "--local", "--persist-to", saveRoot,
                ],
                appRoot,
                showOutput: false);
            if (migrationExitCode != 0)
            {
                throw new InvalidOperationException("世界存档升级失败。");
            }

            var port = FindAvailablePort(8787, 20);
            var localOrigin = $"http://127.0.0.1:{port}";
            Console.WriteLine("正在启动本地世界……");
            var server = StartProcess(
                nodePath,
                [
                    "--import", Path.Combine(appRoot, "scripts", "sites-env.mjs"),
                    wranglerPath,
                    "dev",
                    "--config", Path.Combine(appRoot, "dist", "server", "wrangler.json"),
                    "--local", "--persist-to", saveRoot,
                    "--ip", "127.0.0.1", "--port", port.ToString(), "--inspector-port", "0",
                ],
                appRoot,
                captureOutput: true);
            Children.Add(server);
            server.BeginOutputReadLine();
            server.BeginErrorReadLine();

            if (!await WaitForServerAsync(localOrigin, TimeSpan.FromSeconds(60), Shutdown.Token))
            {
                throw new InvalidOperationException("游戏服务器未能在一分钟内启动。");
            }

            Console.WriteLine("正在建立临时联机通道……");
            var publicUrlTask = StartTunnelAsync(cloudflaredPath, localOrigin, appRoot, Shutdown.Token);
            string? publicOrigin = null;
            try
            {
                publicOrigin = await publicUrlTask.WaitAsync(TimeSpan.FromSeconds(45), Shutdown.Token)
                    .ConfigureAwait(false);
            }
            catch (TimeoutException)
            {
                // Local play remains available if Quick Tunnel is slow or blocked.
            }

            var launchUrl = localOrigin;
            if (!string.IsNullOrWhiteSpace(publicOrigin))
            {
                CopyToClipboard(publicOrigin);
                launchUrl += $"/?publicOrigin={Uri.EscapeDataString(publicOrigin)}";
                Console.ForegroundColor = ConsoleColor.Green;
                Console.WriteLine($"联机网址：{publicOrigin}");
                Console.ResetColor();
                Console.WriteLine("联机网址已复制，进入世界后点击“邀请”也会复制正确地址。");
            }
            else
            {
                Console.ForegroundColor = ConsoleColor.Yellow;
                Console.WriteLine("临时联机通道暂未建立，已切换为本机游玩。");
                Console.ResetColor();
            }

            OpenBrowser(launchUrl);
            Console.WriteLine();
            Console.WriteLine("游戏已打开。这个窗口负责运行世界，请保持开启。");
            Console.WriteLine("关闭窗口或按 Ctrl+C 即可停止游戏服务器。");

            try
            {
                await Task.Delay(Timeout.Infinite, Shutdown.Token);
            }
            catch (OperationCanceledException)
            {
                // Normal shutdown.
            }

            return 0;
        }
        catch (Exception exception)
        {
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine();
            Console.WriteLine($"启动失败：{exception.Message}");
            Console.ResetColor();
            Console.WriteLine("请把这个窗口截图发给开发者。按回车关闭。");
            Console.ReadLine();
            return 1;
        }
        finally
        {
            Cleanup();
        }
    }

    private static void WriteHeader()
    {
        Console.ForegroundColor = ConsoleColor.Green;
        Console.WriteLine("==================================================");
        Console.WriteLine("              轮回仙途 · 单文件版");
        Console.WriteLine("==================================================");
        Console.ResetColor();
        Console.WriteLine("无需安装运行环境，游戏会自动启动并打开浏览器。");
        Console.WriteLine();
    }

    private static async Task<string> ExtractRuntimeAsync(string dataRoot)
    {
        var assembly = Assembly.GetExecutingAssembly();
        await using var hashStream = assembly.GetManifestResourceStream(PayloadResourceName)
            ?? throw new InvalidOperationException("安装包中没有找到游戏文件。");
        var hash = Convert.ToHexString(await SHA256.HashDataAsync(hashStream));
        var runtimeRoot = Path.Combine(dataRoot, "运行文件", hash[..16]);
        var readyMarker = Path.Combine(runtimeRoot, ".ready");
        if (File.Exists(readyMarker)) return runtimeRoot;

        var temporaryRoot = runtimeRoot + ".tmp-" + Environment.ProcessId;
        if (Directory.Exists(temporaryRoot)) Directory.Delete(temporaryRoot, recursive: true);
        Directory.CreateDirectory(temporaryRoot);

        await using var payloadStream = assembly.GetManifestResourceStream(PayloadResourceName)
            ?? throw new InvalidOperationException("安装包中没有找到游戏文件。");
        ZipFile.ExtractToDirectory(payloadStream, temporaryRoot, overwriteFiles: true);
        await File.WriteAllTextAsync(Path.Combine(temporaryRoot, ".ready"), hash);

        Directory.CreateDirectory(Path.GetDirectoryName(runtimeRoot)!);
        if (Directory.Exists(runtimeRoot)) Directory.Delete(runtimeRoot, recursive: true);
        Directory.Move(temporaryRoot, runtimeRoot);
        return runtimeRoot;
    }

    private static async Task<int> RunAndWaitAsync(
        string fileName,
        IReadOnlyCollection<string> arguments,
        string workingDirectory,
        bool showOutput)
    {
        using var process = StartProcess(fileName, arguments, workingDirectory, captureOutput: true);
        if (showOutput)
        {
            process.OutputDataReceived += (_, args) => { if (args.Data is not null) Console.WriteLine(args.Data); };
            process.ErrorDataReceived += (_, args) => { if (args.Data is not null) Console.WriteLine(args.Data); };
        }
        process.BeginOutputReadLine();
        process.BeginErrorReadLine();
        await process.WaitForExitAsync(Shutdown.Token);
        return process.ExitCode;
    }

    private static Process StartProcess(
        string fileName,
        IReadOnlyCollection<string> arguments,
        string workingDirectory,
        bool captureOutput)
    {
        var startInfo = new ProcessStartInfo(fileName)
        {
            WorkingDirectory = workingDirectory,
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = captureOutput,
            RedirectStandardError = captureOutput,
        };
        foreach (var argument in arguments) startInfo.ArgumentList.Add(argument);
        startInfo.Environment["CI"] = "true";
        startInfo.Environment["WRANGLER_SEND_METRICS"] = "false";
        startInfo.Environment["WRANGLER_WRITE_LOGS"] = "false";

        var process = Process.Start(startInfo)
            ?? throw new InvalidOperationException($"无法启动 {Path.GetFileName(fileName)}。");
        return process;
    }

    private static async Task<string?> StartTunnelAsync(
        string cloudflaredPath,
        string localOrigin,
        string workingDirectory,
        CancellationToken cancellationToken)
    {
        var process = StartProcess(
            cloudflaredPath,
            ["tunnel", "--url", localOrigin, "--no-autoupdate"],
            workingDirectory,
            captureOutput: true);
        Children.Add(process);

        var completion = new TaskCompletionSource<string?>(TaskCreationOptions.RunContinuationsAsynchronously);
        void Inspect(string? line)
        {
            if (line is null) return;
            var match = QuickTunnelUrl().Match(line);
            if (match.Success) completion.TrySetResult(match.Value.TrimEnd('/'));
        }

        process.OutputDataReceived += (_, args) => Inspect(args.Data);
        process.ErrorDataReceived += (_, args) => Inspect(args.Data);
        process.EnableRaisingEvents = true;
        process.Exited += (_, _) => completion.TrySetResult(null);
        process.BeginOutputReadLine();
        process.BeginErrorReadLine();

        using var registration = cancellationToken.Register(() => completion.TrySetCanceled(cancellationToken));
        return await completion.Task.ConfigureAwait(false);
    }

    private static async Task<bool> WaitForServerAsync(
        string origin,
        TimeSpan timeout,
        CancellationToken cancellationToken)
    {
        using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(2) };
        var deadline = DateTime.UtcNow + timeout;
        while (DateTime.UtcNow < deadline && !cancellationToken.IsCancellationRequested)
        {
            try
            {
                using var response = await client.GetAsync(origin, cancellationToken);
                if (response.StatusCode is >= HttpStatusCode.OK and < HttpStatusCode.BadRequest) return true;
            }
            catch when (!cancellationToken.IsCancellationRequested)
            {
                // Server is still starting.
            }
            await Task.Delay(500, cancellationToken);
        }
        return false;
    }

    private static int FindAvailablePort(int start, int attempts)
    {
        for (var port = start; port < start + attempts; port++)
        {
            try
            {
                var listener = new System.Net.Sockets.TcpListener(IPAddress.Loopback, port);
                listener.Start();
                listener.Stop();
                return port;
            }
            catch
            {
                // Try the next port.
            }
        }
        throw new InvalidOperationException("没有找到可用的本地端口。");
    }

    private static void CopyToClipboard(string text)
    {
        try
        {
            using var clip = Process.Start(new ProcessStartInfo("clip.exe")
            {
                UseShellExecute = false,
                RedirectStandardInput = true,
                CreateNoWindow = true,
            });
            if (clip is null) return;
            clip.StandardInput.Write(text);
            clip.StandardInput.Close();
            clip.WaitForExit(2000);
        }
        catch
        {
            // The URL remains visible in the launcher window.
        }
    }

    private static void OpenBrowser(string url)
    {
        Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
    }

    private static void RequireFile(string path)
    {
        if (!File.Exists(path)) throw new FileNotFoundException($"缺少运行文件：{Path.GetFileName(path)}");
    }

    private static void Cleanup()
    {
        if (Interlocked.Exchange(ref _cleanedUp, 1) != 0) return;
        foreach (var process in Children)
        {
            try
            {
                if (!process.HasExited) process.Kill(entireProcessTree: true);
            }
            catch
            {
                // The child has already stopped.
            }
        }
    }

    [GeneratedRegex(@"https://[a-z0-9-]+\.trycloudflare\.com/?", RegexOptions.IgnoreCase)]
    private static partial Regex QuickTunnelUrl();
}
