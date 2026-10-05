using System.Text.Json;

namespace Simworx.MD302;

internal sealed class AppConfig
{
    public int MonitorIndex { get; set; } = 1;
    public bool Borderless { get; set; } = true;
    public bool AlwaysOnTop { get; set; } = true;
    public string Background { get; set; } = "black";
    public string AssetPath { get; set; } = @"assets\md302_popup_h.png";
    public string SplashPath { get; set; } = @"assets\md302_splash_h.png";
}

internal static class Program
{
    [STAThread]
    static void Main(string[] args)
    {
        ApplicationConfiguration.Initialize();

        var baseDir = AppContext.BaseDirectory;
        var configPath = Path.Combine(baseDir, "appsettings.json");
        AppConfig config = new();

        if (File.Exists(configPath))
        {
            try
            {
                config = JsonSerializer.Deserialize<AppConfig>(
                    File.ReadAllText(configPath),
                    new JsonSerializerOptions { PropertyNameCaseInsensitive = true }
                ) ?? new AppConfig();
            }
            catch
            {
                // Fall back to safe defaults. The renderer can still start.
            }
        }

        string? cliAsset = null;
        for (int i = 0; i < args.Length - 1; i++)
        {
            if (args[i].Equals("--asset", StringComparison.OrdinalIgnoreCase))
                cliAsset = args[i + 1];
        }

        if (!string.IsNullOrWhiteSpace(cliAsset))
            config.AssetPath = cliAsset;

        Application.Run(new MainForm(config));
    }
}
