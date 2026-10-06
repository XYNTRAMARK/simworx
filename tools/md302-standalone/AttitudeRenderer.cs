using System.Drawing.Drawing2D;

namespace Simworx.MD302;

internal sealed class AttitudeRenderer : IDisposable
{
    private readonly Dictionary<string, Image> _images = new(StringComparer.OrdinalIgnoreCase);
    private readonly LayoutConfig _layout;

    private const float HorizonCanvasSize = 560f;

    public AttitudeRenderer(LayoutConfig layout)
    {
        _layout = layout;
    }

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
        var assembly = g.Save();

        g.TranslateTransform(_layout.AttitudeX, _layout.AttitudeY);
        g.ScaleTransform(_layout.AttitudeScale, _layout.AttitudeScale);

        DrawMovingAttitude(g, pitchDeg, rollDeg);
        DrawFixedOverlays(g, rollDeg);

        g.Restore(assembly);
    }

    private void DrawMovingAttitude(Graphics g, double pitchDeg, double rollDeg)
    {
        var state = g.Save();

        g.SetClip(new RectangleF(
            0f,
            0f,
            _layout.AttitudeClipWidth,
            _layout.AttitudeClipHeight
        ));

        g.TranslateTransform(
            _layout.AttitudeCenterX,
            _layout.AttitudeCenterY
        );

        g.RotateTransform((float)-rollDeg);
        g.TranslateTransform(
            0f,
            (float)(pitchDeg * _layout.PitchPixelsPerDegree)
        );

        if (_images.TryGetValue("md302_horizon.png", out var horizon))
        {
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

        // Recovery chevrons are an unusual-attitude cue, not a normal layer.
        // The real MD302 shows them only beyond the configured pitch threshold.
        if (Math.Abs(pitchDeg) >= _layout.UnusualPitchChevronThreshold)
            DrawCentered(g, "md302_chevrons.png");

        g.Restore(state);
    }

    private void DrawFixedOverlays(Graphics g, double rollDeg)
    {
        var clip = g.Save();
        g.SetClip(new RectangleF(
            0f,
            0f,
            _layout.AttitudeClipWidth,
            _layout.AttitudeClipHeight
        ));

        // Keep the Aerobask mask aligned to the 320-wide display but crop its
        // lower portion so the heading presentation can occupy the bottom.
        DrawAt(g, "md302_att_mask.png", 0f, 0f);

        if (_images.TryGetValue("md302_roll_scale.png", out var scale))
        {
            g.DrawImage(
                scale,
                _layout.AttitudeCenterX - scale.Width / 2f,
                _layout.AttitudeCenterY - scale.Height / 2f,
                scale.Width,
                scale.Height
            );
        }

        if (_images.TryGetValue("md302_roll_index.png", out var index))
        {
            var state = g.Save();
            g.TranslateTransform(
                _layout.AttitudeCenterX,
                _layout.AttitudeCenterY
            );
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
                _layout.AttitudeCenterX - symbol.Width / 2f,
                _layout.AttitudeCenterY - symbol.Height / 2f,
                symbol.Width,
                symbol.Height
            );
        }

        g.Restore(clip);
    }

    public void DrawDebug(Graphics g, double pitchDeg, double rollDeg)
    {
        if (!_layout.ShowDebug)
            return;

        var state = g.Save();
        g.TranslateTransform(_layout.AttitudeX, _layout.AttitudeY);
        g.ScaleTransform(_layout.AttitudeScale, _layout.AttitudeScale);

        using var pen = new Pen(Color.Lime, 1f);
        using var font = new Font("Segoe UI", 10f, FontStyle.Bold);
        using var brush = new SolidBrush(Color.Lime);

        g.DrawRectangle(
            pen,
            0f,
            0f,
            _layout.AttitudeClipWidth,
            _layout.AttitudeClipHeight
        );

        g.DrawString(
            $"PITCH {pitchDeg:+0.0;-0.0;0.0}°   ROLL {rollDeg:+0.0;-0.0;0.0}°",
            font,
            brush,
            4f,
            4f
        );

        g.Restore(state);
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
