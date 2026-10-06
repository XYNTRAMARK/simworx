using System.Text.Json;

namespace Simworx.MD302;

internal sealed class LayoutConfig
{
    public int CanvasWidth { get; set; } = 380;
    public int CanvasHeight { get; set; } = 880;

    public bool ShowBezel { get; set; } = false;
    public bool ShowDebug { get; set; } = false;

    // One transform moves/scales the complete attitude assembly.
    public float AttitudeX { get; set; } = 30f;
    public float AttitudeY { get; set; } = 10f;
    public float AttitudeScale { get; set; } = 1.0f;

    // Visible portion of the upper display. The heading strip will occupy
    // the space below this in the next stage.
    public float AttitudeClipWidth { get; set; } = 320f;
    public float AttitudeClipHeight { get; set; } = 245f;

    // Centre of rotation inside the 320 px-wide attitude artwork.
    public float AttitudeCenterX { get; set; } = 160f;
    public float AttitudeCenterY { get; set; } = 122f;

    public float PitchPixelsPerDegree { get; set; } = 3.2f;
    public float UnusualPitchChevronThreshold { get; set; } = 45f;
}

internal sealed class AppConfig
{
    public int MonitorIndex { get; set; } = 1;
    public bool Borderless { get; set; } = true;
    public bool AlwaysOnTop { get; set; } = true;
    public string Background { get; set; } = "black";

    // Used as the optional software-bezel image and to locate sibling assets.
    public string AssetPath { get; set; } = @"assets\md302_popup_v.png";
    public string SplashPath { get; set; } = @"assets\md302_splash_v.png";

    public LayoutConfig Layout { get; set; } = new();
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
                // Safe defaults still allow the instrument to start.
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
