using System.Drawing.Drawing2D;

namespace Simworx.MD302;

public sealed class MainForm : Form
{
    private readonly AppConfig _config;
    private Image? _instrumentImage;
    private string? _resolvedAssetPath;

    public MainForm(AppConfig config)
    {
        _config = config;

        Text = "Simworx MD302";
        BackColor = Color.Black;
        DoubleBuffered = true;
        KeyPreview = true;
        TopMost = _config.AlwaysOnTop;

        if (_config.Borderless)
            FormBorderStyle = FormBorderStyle.None;

        StartPosition = FormStartPosition.Manual;
        SetTargetMonitor();

        KeyDown += (_, e) =>
        {
            if (e.KeyCode == Keys.Escape)
                Close();
        };

        Shown += (_, _) =>
        {
            LoadInstrumentImage();
            Invalidate();
        };

        FormClosed += (_, _) => _instrumentImage?.Dispose();
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

        e.Graphics.Clear(Color.Black);
        e.Graphics.CompositingQuality = CompositingQuality.HighQuality;
        e.Graphics.InterpolationMode = InterpolationMode.HighQualityBicubic;
        e.Graphics.PixelOffsetMode = PixelOffsetMode.HighQuality;
        e.Graphics.SmoothingMode = SmoothingMode.HighQuality;

        if (_instrumentImage is null)
        {
            DrawMissingAssetMessage(e.Graphics);
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

        e.Graphics.DrawImage(_instrumentImage, new Rectangle(x, y, width, height));
    }

    private void DrawMissingAssetMessage(Graphics g)
    {
        using var titleFont = new Font("Segoe UI", 24, FontStyle.Bold);
        using var bodyFont = new Font("Segoe UI", 12, FontStyle.Regular);
        using var white = new SolidBrush(Color.White);
        using var grey = new SolidBrush(Color.LightGray);

        var title = "SIMWORX MD302";
        var body =
            "Stage 1 renderer is running, but md302_popup_h.png was not found.\n\n" +
            "Copy the Aerobask MD302 image to:\n" +
            Path.Combine(AppContext.BaseDirectory, "assets", "md302_popup_h.png") +
            "\n\nor set assetPath in appsettings.json.\n\nPress ESC to exit.";

        g.DrawString(title, titleFont, white, new PointF(40, 40));
        g.DrawString(body, bodyFont, grey, new RectangleF(40, 100, ClientSize.Width - 80, ClientSize.Height - 140));
    }
}
