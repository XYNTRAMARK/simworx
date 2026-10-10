using System.Text.Json;

namespace Simworx.MD302;

internal sealed class ElementLayout
{
    public string Label { get; set; } = string.Empty;
    public string Kind { get; set; } = string.Empty;
    public float X { get; set; }
    public float Y { get; set; }
    public float W { get; set; }
    public float H { get; set; }
    public bool Visible { get; set; } = true;
    public string? Text { get; set; }
}

internal sealed class LayoutConfig
{
    public int CanvasWidth { get; set; } = 426;
    public int CanvasHeight { get; set; } = 880;
    public bool ShowDebug { get; set; } = false;

    public Dictionary<string, ElementLayout> Elements { get; set; } = CreateDefaultElements();

    public List<string> ZOrder { get; set; } =
    [
        "skyGround",
        "pitchLadder",
        "horizonLine",
        "aircraftSymbol",
        "rollScale",
        "slipIndicator",
        "headingTape",
        "headingWindow",
        "pitchMask",
        "rollPointer"
    ];

    public ElementLayout Get(string key)
    {
        if (!Elements.TryGetValue(key, out var element))
            throw new InvalidOperationException($"Missing MD302 layout element '{key}'.");

        return element;
    }

    private static Dictionary<string, ElementLayout> CreateDefaultElements() => new(StringComparer.OrdinalIgnoreCase)
    {
        ["skyGround"] = new()
        {
            Label = "SKY / GROUND", Kind = "skyGround",
            X = 95.11232f, Y = 80.82131f, W = 235.77535f, H = 314.88205f
        },
        ["pitchLadder"] = new()
        {
            Label = "PITCH LADDER", Kind = "image",
            X = 135.95464f, Y = -16.113382f, W = 146.03024f, H = 461.6976f
        },
        ["horizonLine"] = new()
        {
            Label = "HORIZON LINE", Kind = "line",
            X = 43f, Y = 214f, W = 340f, H = 4f
        },
        ["aircraftSymbol"] = new()
        {
            Label = "AIRCRAFT SYMBOL", Kind = "aircraftSymbol",
            X = 97.90928f, Y = 208.3723f, W = 228f, H = 20f
        },
        ["rollScale"] = new()
        {
            Label = "ROLL SCALE", Kind = "image",
            X = 98.03888f, Y = 106.04582f, W = 225.96976f, H = 241.00458f
        },
        ["rollPointer"] = new()
        {
            Label = "ROLL POINTER", Kind = "rollPointer",
            X = 202.99568f, Y = 130.01375f, W = 16.917917f, H = 23.702183f
        },
        ["slipIndicator"] = new()
        {
            Label = "SLIP INDICATOR", Kind = "slip",
            X = 164.10152f, Y = 308.17068f, W = 96.87688f, H = 15.945018f
        },
        ["headingTape"] = new()
        {
            Label = "HEADING TAPE", Kind = "headingTape",
            X = 45.00432f, Y = 354.65295f, W = 340f, H = 44.95418f
        },
        ["headingWindow"] = new()
        {
            Label = "HEADING WINDOW", Kind = "headingWindow", Text = "345",
            X = 184.05185f, Y = 362.433f, W = 54f, H = 30f
        },
        ["pitchMask"] = new()
        {
            Label = "PITCH MASK", Kind = "mask",
            X = 134.19656f, Y = 149.2245f, W = 161.61551f, H = 133.33105f
        }
    };
}

internal sealed class AppConfig
{
    public int MonitorIndex { get; set; } = 1;
    public bool Borderless { get; set; } = true;
    public bool AlwaysOnTop { get; set; } = true;
    public string Background { get; set; } = "black";
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
        for (var i = 0; i < args.Length - 1; i++)
        {
            if (args[i].Equals("--asset", StringComparison.OrdinalIgnoreCase))
                cliAsset = args[i + 1];
        }

        if (!string.IsNullOrWhiteSpace(cliAsset))
            config.AssetPath = cliAsset;

        Application.Run(new MainForm(config));
    }
}
