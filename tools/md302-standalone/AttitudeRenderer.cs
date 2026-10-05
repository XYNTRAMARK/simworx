using System.Drawing.Drawing2D;

namespace Simworx.MD302;

internal sealed class AttitudeRenderer : IDisposable
{
    private readonly Dictionary<string, Image> _images = new(StringComparer.OrdinalIgnoreCase);

    // Native horizontal-popup coordinates. These are isolated here so we can
    // tune against the real Aerobask popup without touching the rest of the app.
    private readonly RectangleF _attitudeWindow = new(82f, 52f, 302f, 276f);
    private readonly PointF _attitudeCenter = new(233f, 190f);
    private const float PitchPixelsPerDegree = 5.25f;

    public void Load(string baseDirectory)
    {
        Dispose();

        foreach (var file in new[]
        {
            "md302_horizon.png",
            "md302_ladder.png",
            "md302_att_mask.png",
            "md302_roll_scale.png",
            "md302_roll_index.png",
            "md302_symbol_trad.png",
            "md302_chevrons.png",
            "md302_hline.png"
        })
        {
            var path = Path.Combine(baseDirectory, "assets", file);
            if (!File.Exists(path))
                continue;

            using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
            using var source = Image.FromStream(stream);
            _images[file] = new Bitmap(source);
        }
    }

    public bool HasCoreAssets =>
        _images.ContainsKey("md302_horizon.png") &&
        _images.ContainsKey("md302_ladder.png");

    public void Draw(Graphics g, double pitchDeg, double rollDeg)
    {
        var movingState = g.Save();
        g.SetClip(_attitudeWindow);

        // Aircraft right wing down should make the horizon rotate left.
        g.TranslateTransform(_attitudeCenter.X, _attitudeCenter.Y);
        g.RotateTransform((float)-rollDeg);

        // Nose-up moves the apparent horizon downward.
        g.TranslateTransform(0f, (float)(pitchDeg * PitchPixelsPerDegree));

        DrawCentered(g, "md302_horizon.png");
        DrawCentered(g, "md302_ladder.png");
        DrawCentered(g, "md302_chevrons.png");

        g.Restore(movingState);

        // Fixed overlays remain aligned with the instrument body.
        DrawAt(g, "md302_att_mask.png", _attitudeWindow.Left, _attitudeWindow.Top);
        DrawAt(g, "md302_roll_scale.png", _attitudeWindow.Left, _attitudeWindow.Top);
        DrawAt(g, "md302_roll_index.png", _attitudeWindow.Left, _attitudeWindow.Top);
        DrawAt(g, "md302_hline.png", _attitudeWindow.Left, _attitudeWindow.Top);

        if (_images.TryGetValue("md302_symbol_trad.png", out var symbol))
        {
            g.DrawImage(
                symbol,
                _attitudeCenter.X - symbol.Width / 2f,
                _attitudeCenter.Y - symbol.Height / 2f,
                symbol.Width,
                symbol.Height
            );
        }
    }

    public void DrawDebug(Graphics g, double pitchDeg, double rollDeg)
    {
        using var pen = new Pen(Color.Lime, 1f);
        using var font = new Font("Segoe UI", 10f, FontStyle.Bold);
        using var brush = new SolidBrush(Color.Lime);

        g.DrawRectangle(
            pen,
            _attitudeWindow.X,
            _attitudeWindow.Y,
            _attitudeWindow.Width,
            _attitudeWindow.Height
        );

        g.DrawString(
            $"PITCH {pitchDeg:+0.0;-0.0;0.0}°   ROLL {rollDeg:+0.0;-0.0;0.0}°",
            font,
            brush,
            12f,
            10f
        );
    }

    private void DrawCentered(Graphics g, string key)
    {
        if (!_images.TryGetValue(key, out var image))
            return;

        g.DrawImage(
            image,
            -image.Width / 2f,
            -image.Height / 2f,
            image.Width,
            image.Height
        );
    }

    private void DrawAt(Graphics g, string key, float x, float y)
    {
        if (!_images.TryGetValue(key, out var image))
            return;

        g.DrawImage(image, x, y, image.Width, image.Height);
    }

    public void Dispose()
    {
        foreach (var image in _images.Values)
            image.Dispose();

        _images.Clear();
    }
}
