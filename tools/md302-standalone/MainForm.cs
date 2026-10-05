using System.Drawing.Drawing2D;

namespace Simworx.MD302;

public sealed class MainForm : Form
{
    private readonly AppConfig _config;
    private readonly AttitudeRenderer _attitudeRenderer = new();

    private Image? _instrumentImage;
    private string? _resolvedAssetPath;

    private double _pitchDeg;
    private double _rollDeg;

    public MainForm(AppConfig config)
    {
        _config = config;

        Text = "Simworx MD302 - Stage 2";
        BackColor = Color.Black;
        DoubleBuffered = true;
        KeyPreview = true;
        TopMost = _config.AlwaysOnTop;

        if (_config.Borderless)
            FormBorderStyle = FormBorderStyle.None;

        StartPosition = FormStartPosition.Manual;
        SetTargetMonitor();

        KeyDown += HandleTestControls;

        Shown += (_, _) =>
        {
            LoadInstrumentImage();
            _attitudeRenderer.Load(AppContext.BaseDirectory);
            Invalidate();
        };

        FormClosed += (_, _) =>
        {
            _instrumentImage?.Dispose();
            _attitudeRenderer.Dispose();
        };
    }

    private void HandleTestControls(object? sender, KeyEventArgs e)
    {
        switch (e.KeyCode)
        {
            case Keys.Escape:
                Close();
                return;

            case Keys.Up:
                _pitchDeg = Math.Clamp(_pitchDeg + 1.0, -90.0, 90.0);
                break;

            case Keys.Down:
                _pitchDeg = Math.Clamp(_pitchDeg - 1.0, -90.0, 90.0);
                break;

            case Keys.Left:
                _rollDeg = NormalizeRoll(_rollDeg - 2.0);
                break;

            case Keys.Right:
                _rollDeg = NormalizeRoll(_rollDeg + 2.0);
                break;

            case Keys.R:
            case Keys.Home:
                _pitchDeg = 0;
                _rollDeg = 0;
                break;

            default:
                return;
        }

        Invalidate();
    }

    private static double NormalizeRoll(double value)
    {
        while (value > 180.0) value -= 360.0;
        while (value < -180.0) value += 360.0;
        return value;
    }

    private void SetTargetMonitor()
    {
        var screens = Screen.AllScreens;
        var index = Math.Clamp(_config.MonitorIndex, 0, Math.Max(0, screens.Length - 1));
        var target = screens[index];

        Bounds = target.Bounds;
        WindowState = FormWindowState.Normal;
    }

    private void LoadInstrumentImage()
    {
        _instrumentImage?.Dispose();
        _instrumentImage = null;

        var baseDir = AppContext.BaseDirectory;
        var candidates = new[]
        {
            _config.AssetPath,
            Path.Combine(baseDir, _config.AssetPath),
            Path.Combine(baseDir, "assets", "md302_popup_h.png")
        };

        _resolvedAssetPath = candidates
            .Select(Path.GetFullPath)
            .FirstOrDefault(File.Exists);

        if (_resolvedAssetPath is null)
            return;

        using var fs = new FileStream(_resolvedAssetPath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
        using var temp = Image.FromStream(fs);
        _instrumentImage = new Bitmap(temp);
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        base.OnPaint(e);

        var g = e.Graphics;
        g.Clear(Color.Black);
        g.CompositingQuality = CompositingQuality.HighQuality;
        g.InterpolationMode = InterpolationMode.HighQualityBicubic;
        g.PixelOffsetMode = PixelOffsetMode.HighQuality;
        g.SmoothingMode = SmoothingMode.HighQuality;

        if (_instrumentImage is null)
        {
            DrawMissingAssetMessage(g);
            return;
        }

        var client = ClientRectangle;
        var scale = Math.Min(
            client.Width / (double)_instrumentImage.Width,
            client.Height / (double)_instrumentImage.Height
        );

        var width = (int)Math.Round(_instrumentImage.Width * scale);
        var height = (int)Math.Round(_instrumentImage.Height * scale);
        var x = (client.Width - width) / 2;
        var y = (client.Height - height) / 2;

        var viewport = new Rectangle(x, y, width, height);

        // Fixed popup artwork remains the instrument body.
        g.DrawImage(_instrumentImage, viewport);

        // Draw moving attitude layers in the popup's native coordinate system.
        var state = g.Save();
        g.TranslateTransform(viewport.Left, viewport.Top);
        g.ScaleTransform(
            viewport.Width / (float)_instrumentImage.Width,
            viewport.Height / (float)_instrumentImage.Height
        );

        _attitudeRenderer.Draw(g, _pitchDeg, _rollDeg);
        _attitudeRenderer.DrawDebug(g, _pitchDeg, _rollDeg);

        g.Restore(state);
    }

    private void DrawMissingAssetMessage(Graphics g)
    {
        using var titleFont = new Font("Segoe UI", 24, FontStyle.Bold);
        using var bodyFont = new Font("Segoe UI", 12, FontStyle.Regular);
        using var white = new SolidBrush(Color.White);
        using var grey = new SolidBrush(Color.LightGray);

        var title = "SIMWORX MD302";
        var body =
            "Stage 2 renderer is running, but md302_popup_h.png was not found.\n\n" +
            "Copy the Aerobask MD302 assets into the application's assets folder.\n\n" +
            "Controls:\n" +
            "Up / Down = pitch\n" +
            "Left / Right = roll\n" +
            "R or Home = reset attitude\n" +
            "ESC = exit.";

        g.DrawString(title, titleFont, white, new PointF(40, 40));
        g.DrawString(body, bodyFont, grey, new RectangleF(40, 100, ClientSize.Width - 80, ClientSize.Height - 140));
    }
}
