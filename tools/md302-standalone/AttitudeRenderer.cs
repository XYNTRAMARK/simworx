using System.Drawing.Drawing2D;

namespace Simworx.MD302;

internal sealed class AttitudeRenderer : IDisposable
{
    private readonly Dictionary<string, Image> _images = new(StringComparer.OrdinalIgnoreCase);

    // Aerobask horizontal popup is 880x380. The attitude display occupies
    // the 320x320 aperture on the right side.
    private readonly RectangleF _attitudeWindow = new(30f, 30f, 320f, 320f);
    private readonly PointF _attitudeCenter = new(190f, 190f);

    // The ladder's major pitch groups are 32 px apart and represent 10 degrees.
    private const float PitchPixelsPerDegree = 3.2f;

    // Large enough to cover the clipped attitude aperture at any bank angle.
    private const float HorizonCanvasSize = 560f;

    public void Load(string assetDirectory)
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
            var path = Path.Combine(assetDirectory, file);
            if (!File.Exists(path))
                continue;

            using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
            using var source = Image.FromStream(stream);
            _images[file] = new Bitmap(source);
        }
    }

    public bool HasCoreAssets =>
        _images.ContainsKey("md302_horizon.png") &&
        _images.ContainsKey("md302_ladder.png") &&
        _images.ContainsKey("md302_att_mask.png");

    public void Draw(Graphics g, double pitchDeg, double rollDeg)
    {
        DrawMovingAttitude(g, pitchDeg, rollDeg);
        DrawFixedOverlays(g, rollDeg);
    }

    private void DrawMovingAttitude(Graphics g, double pitchDeg, double rollDeg)
    {
        var state = g.Save();
        g.SetClip(_attitudeWindow);

        g.TranslateTransform(_attitudeCenter.X, _attitudeCenter.Y);

        // Aircraft right-wing-down makes the perceived horizon rotate left.
        g.RotateTransform((float)-rollDeg);

        // Nose-up makes the apparent horizon move down.
        g.TranslateTransform(0f, (float)(pitchDeg * PitchPixelsPerDegree));

        if (_images.TryGetValue("md302_horizon.png", out var horizon))
        {
            // The supplied 16x128 horizon is a colour source strip. Stretching
            // it preserves Aerobask's exact sky/ground colours while ensuring
            // the horizon covers the aperture during large bank angles.
            g.DrawImage(
                horizon,
                -HorizonCanvasSize / 2f,
                -HorizonCanvasSize / 2f,
                HorizonCanvasSize,
                HorizonCanvasSize
            );
        }

        DrawCentered(g, "md302_ladder.png");
        DrawCentered(g, "md302_hline.png");
        DrawCentered(g, "md302_chevrons.png");

        g.Restore(state);
    }

    private void DrawFixedOverlays(Graphics g, double rollDeg)
    {
        // Mask is exactly the 320x320 attitude aperture.
        DrawAt(g, "md302_att_mask.png", _attitudeWindow.Left, _attitudeWindow.Top);

        // Roll scale is 240x240 and concentric with the attitude display.
        if (_images.TryGetValue("md302_roll_scale.png", out var scale))
        {
            g.DrawImage(
                scale,
                _attitudeCenter.X - scale.Width / 2f,
                _attitudeCenter.Y - scale.Height / 2f,
                scale.Width,
                scale.Height
            );
        }

        // The bank pointer moves around the fixed roll scale but does not move
        // vertically with pitch.
        if (_images.TryGetValue("md302_roll_index.png", out var index))
        {
            var state = g.Save();
            g.TranslateTransform(_attitudeCenter.X, _attitudeCenter.Y);
            g.RotateTransform((float)rollDeg);

            const float pointerRadius = 126f;
            g.DrawImage(
                index,
                -index.Width / 2f,
                -pointerRadius - index.Height / 2f,
                index.Width,
                index.Height
            );

            g.Restore(state);
        }

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
