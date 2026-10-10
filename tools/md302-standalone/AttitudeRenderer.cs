using System.Drawing.Drawing2D;

namespace Simworx.MD302;

internal sealed class AttitudeRenderer : IDisposable
{
    private readonly LayoutConfig _layout;
    private readonly Dictionary<string, Image> _images = new(StringComparer.OrdinalIgnoreCase);

    private static readonly Color Sky = Color.FromArgb(0x53, 0xB8, 0xE6);
    private static readonly Color Ground = Color.FromArgb(0xA3, 0x20, 0x2A);
    private static readonly Color Yellow = Color.FromArgb(0xE6, 0xD2, 0x1B);
    private static readonly Color Red = Color.FromArgb(0xFF, 0x21, 0x21);

    public AttitudeRenderer(LayoutConfig layout)
    {
        _layout = layout;
    }

    public void Load(string assetDirectory)
    {
        DisposeImages();
        LoadImage("pitchLadder", Path.Combine(assetDirectory, "md302_ladder.png"));
        LoadImage("rollScale", Path.Combine(assetDirectory, "md302_roll_scale.png"));
    }

    private void LoadImage(string key, string path)
    {
        if (!File.Exists(path))
            return;

        using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
        using var source = Image.FromStream(stream);
        _images[key] = new Bitmap(source);
    }

    public void Draw(Graphics g, double pitchDeg, double rollDeg)
    {
        foreach (var key in _layout.ZOrder)
        {
            if (!_layout.Elements.TryGetValue(key, out var element) || !element.Visible)
                continue;

            switch (key)
            {
                case "skyGround":
                    DrawSkyGround(g, element, pitchDeg, rollDeg);
                    break;
                case "pitchLadder":
                    DrawPitchLadder(g, element, pitchDeg, rollDeg);
                    break;
                case "horizonLine":
                    DrawHorizonLine(g, element, pitchDeg, rollDeg);
                    break;
                case "aircraftSymbol":
                    DrawAircraftSymbol(g, element, pitchDeg);
                    break;
                case "rollScale":
                    DrawRollScale(g, element);
                    break;
                case "rollPointer":
                    DrawRollPointer(g, element, rollDeg);
                    break;
                case "slipIndicator":
                    DrawSlipIndicator(g, element);
                    break;
                case "headingTape":
                    DrawHeadingTape(g, element);
                    break;
                case "headingWindow":
                    DrawHeadingWindow(g, element);
                    break;
                case "pitchMask":
                    // The mask is a clipping region only and has no production graphic.
                    break;
            }
        }
    }

    private PointF HorizonPivot
    {
        get
        {
            var horizon = _layout.Get("horizonLine");
            return new PointF(horizon.X + horizon.W / 2f, horizon.Y);
        }
    }

    private float PitchPixelsPerDegree
    {
        get
        {
            var ladder = _layout.Get("pitchLadder");
            return ladder.H / 160f;
        }
    }

    private void ApplyAttitudeTransform(Graphics g, double pitchDeg, double rollDeg)
    {
        var pivot = HorizonPivot;
        g.TranslateTransform(pivot.X, pivot.Y);
        g.RotateTransform((float)-rollDeg);
        g.TranslateTransform(0f, (float)(pitchDeg * PitchPixelsPerDegree));
        g.TranslateTransform(-pivot.X, -pivot.Y);
    }

    private void DrawSkyGround(Graphics g, ElementLayout element, double pitchDeg, double rollDeg)
    {
        var state = g.Save();
        g.SetClip(new RectangleF(element.X, element.Y, element.W, element.H));
        ApplyAttitudeTransform(g, pitchDeg, rollDeg);

        var pivot = HorizonPivot;
        using var skyBrush = new SolidBrush(Sky);
        using var groundBrush = new SolidBrush(Ground);

        g.FillRectangle(skyBrush, pivot.X - 1200f, pivot.Y - 1200f, 2400f, 1200f);
        g.FillRectangle(groundBrush, pivot.X - 1200f, pivot.Y, 2400f, 1200f);

        g.Restore(state);
    }

    private void DrawPitchLadder(Graphics g, ElementLayout element, double pitchDeg, double rollDeg)
    {
        var mask = _layout.Get("pitchMask");
        var state = g.Save();
        g.SetClip(new RectangleF(mask.X, mask.Y, mask.W, mask.H));
        ApplyAttitudeTransform(g, pitchDeg, rollDeg);

        if (_images.TryGetValue("pitchLadder", out var image))
        {
            g.DrawImage(image, element.X, element.Y, element.W, element.H);
        }
        else
        {
            DrawPitchLadderFallback(g, element);
        }

        g.Restore(state);
    }

    private static void DrawPitchLadderFallback(Graphics g, ElementLayout element)
    {
        using var pen = new Pen(Color.White, 2f);
        using var font = new Font("Segoe UI", 10f, FontStyle.Bold, GraphicsUnit.Pixel);
        using var brush = new SolidBrush(Color.White);
        using var format = new StringFormat
        {
            Alignment = StringAlignment.Center,
            LineAlignment = StringAlignment.Center
        };

        var centerX = element.X + element.W / 2f;
        var centerY = element.Y + element.H / 2f;
        var pxPerDegree = element.H / 160f;

        for (var degree = -80; degree <= 80; degree += 5)
        {
            var y = centerY - degree * pxPerDegree;
            var major = degree % 10 == 0;
            var halfWidth = major ? element.W * 0.25f : element.W * 0.14f;
            g.DrawLine(pen, centerX - halfWidth, y, centerX + halfWidth, y);

            if (major && degree != 0)
            {
                var label = Math.Abs(degree).ToString();
                g.DrawString(label, font, brush,
                    new RectangleF(element.X, y - 8f, element.W * 0.22f, 16f), format);
                g.DrawString(label, font, brush,
                    new RectangleF(element.X + element.W * 0.78f, y - 8f, element.W * 0.22f, 16f), format);
            }
        }
    }

    private void DrawHorizonLine(Graphics g, ElementLayout element, double pitchDeg, double rollDeg)
    {
        var state = g.Save();
        ApplyAttitudeTransform(g, pitchDeg, rollDeg);

        using var glowPen = new Pen(Color.FromArgb(110, 255, 255, 255), Math.Max(5f, element.H + 3f));
        using var whitePen = new Pen(Color.White, Math.Max(1f, element.H));
        g.DrawLine(glowPen, element.X, element.Y, element.X + element.W, element.Y);
        g.DrawLine(whitePen, element.X, element.Y, element.X + element.W, element.Y);

        g.Restore(state);
    }

    private void DrawAircraftSymbol(Graphics g, ElementLayout element, double pitchDeg)
    {
        if (Math.Abs(pitchDeg) >= 45f)
        {
            DrawRecoveryChevron(g, element, pitchDeg);
            return;
        }

        var centerX = element.X + element.W / 2f;
        var barY = element.Y + element.H * 0.24f;
        var gap = element.W * 0.13f;

        using var pen = new Pen(Yellow, Math.Max(2f, element.H * 0.12f))
        {
            StartCap = LineCap.Round,
            EndCap = LineCap.Round
        };
        using var brush = new SolidBrush(Yellow);

        g.DrawLine(pen, element.X, barY, centerX - gap, barY);
        g.DrawLine(pen, centerX + gap, barY, element.X + element.W, barY);

        PointF[] triangle =
        [
            new(centerX, element.Y + element.H * 0.16f),
            new(centerX - element.W * 0.10f, element.Y + element.H * 0.82f),
            new(centerX + element.W * 0.10f, element.Y + element.H * 0.82f)
        ];
        g.FillPolygon(brush, triangle);
    }

    private static void DrawRecoveryChevron(Graphics g, ElementLayout element, double pitchDeg)
    {
        var centerX = element.X + element.W / 2f;
        var centerY = element.Y + element.H / 2f;
        var direction = pitchDeg > 0 ? 1f : -1f;

        using var pen = new Pen(Red, Math.Max(3f, element.H * 0.22f))
        {
            StartCap = LineCap.Round,
            EndCap = LineCap.Round
        };

        g.DrawLine(pen, centerX - 42f, centerY - 10f * direction,
            centerX - 12f, centerY + 10f * direction);
        g.DrawLine(pen, centerX - 12f, centerY + 10f * direction,
            centerX, centerY - 2f * direction);
        g.DrawLine(pen, centerX, centerY - 2f * direction,
            centerX + 12f, centerY + 10f * direction);
        g.DrawLine(pen, centerX + 12f, centerY + 10f * direction,
            centerX + 42f, centerY - 10f * direction);
    }

    private void DrawRollScale(Graphics g, ElementLayout element)
    {
        if (_images.TryGetValue("rollScale", out var image))
        {
            g.DrawImage(image, element.X, element.Y, element.W, element.H);
            return;
        }

        var centerX = element.X + element.W / 2f;
        var centerY = element.Y + element.H / 2f;
        var radius = Math.Min(element.W, element.H) * 0.45f;
        using var pen = new Pen(Color.White, 2f);
        using var brush = new SolidBrush(Color.White);

        foreach (var angle in new[] { -60f, -45f, -30f, -20f, -10f, 0f, 10f, 20f, 30f, 45f, 60f })
        {
            var rad = (angle - 90f) * MathF.PI / 180f;
            var inner = radius - (angle == 0f ? 15f : 10f);
            g.DrawLine(pen,
                centerX + MathF.Cos(rad) * inner,
                centerY + MathF.Sin(rad) * inner,
                centerX + MathF.Cos(rad) * radius,
                centerY + MathF.Sin(rad) * radius);
        }
    }

    private void DrawRollPointer(Graphics g, ElementLayout element, double rollDeg)
    {
        var rollScale = _layout.Get("rollScale");
        var pivotX = rollScale.X + rollScale.W / 2f;
        var pivotY = rollScale.Y + rollScale.H / 2f;

        var state = g.Save();
        g.TranslateTransform(pivotX, pivotY);
        g.RotateTransform((float)rollDeg);
        g.TranslateTransform(-pivotX, -pivotY);

        using var brush = new SolidBrush(Color.White);
        var centerX = element.X + element.W / 2f;
        var triangleWidth = element.W * 0.92f;
        var triangleHeight = element.H * 0.90f;

        PointF[] triangle =
        [
            new(centerX, element.Y),
            new(centerX + triangleWidth / 2f, element.Y + triangleHeight),
            new(centerX - triangleWidth / 2f, element.Y + triangleHeight)
        ];
        g.FillPolygon(brush, triangle);

        g.Restore(state);
    }

    private static void DrawSlipIndicator(Graphics g, ElementLayout element)
    {
        using var backing = new SolidBrush(Color.FromArgb(225, 0, 0, 0));
        using var whiteBrush = new SolidBrush(Color.White);
        using var whitePen = new Pen(Color.White, 2f);

        g.FillRectangle(backing, element.X, element.Y, element.W, element.H);

        var centerX = element.X + element.W / 2f;
        var centerY = element.Y + element.H / 2f;
        var markerOffset = element.W * 0.13f;
        var padding = Math.Max(2f, element.H * 0.18f);

        g.DrawLine(whitePen, centerX - markerOffset, element.Y + padding,
            centerX - markerOffset, element.Y + element.H - padding);
        g.DrawLine(whitePen, centerX + markerOffset, element.Y + padding,
            centerX + markerOffset, element.Y + element.H - padding);

        var radius = Math.Max(3f, element.H * 0.17f);
        g.FillEllipse(whiteBrush, centerX - radius, centerY - radius, radius * 2f, radius * 2f);
    }

    private static void DrawHeadingTape(Graphics g, ElementLayout element)
    {
        var baseline = element.Y + element.H * 0.82f;
        using var whitePen = new Pen(Color.White, 2f);
        using var whiteBrush = new SolidBrush(Color.White);

        g.DrawLine(whitePen, element.X, baseline, element.X + element.W, baseline);

        var labels = new[]
        {
            new HeadingLabel(element.X + element.W * 0.08f, "30", false),
            new HeadingLabel(element.X + element.W * 0.25f, "33", false),
            new HeadingLabel(element.X + element.W * 0.66f, "N", true),
            new HeadingLabel(element.X + element.W * 0.84f, "3", false)
        };

        var exclusionZones = new List<(float Left, float Right)>();
        foreach (var label in labels)
        {
            using var font = new Font("Segoe UI",
                label.Cardinal ? Math.Max(18f, element.H * 0.34f) : Math.Max(14f, element.H * 0.26f),
                label.Cardinal ? FontStyle.Bold : FontStyle.Regular,
                GraphicsUnit.Pixel);
            var width = g.MeasureString(label.Text, font).Width;
            var half = Math.Max(width * 0.62f, 10f);
            exclusionZones.Add((label.X - half, label.X + half));
        }

        const int tickCount = 24;
        for (var i = 0; i <= tickCount; i++)
        {
            var x = element.X + i * (element.W / tickCount);
            if (exclusionZones.Any(zone => x >= zone.Left && x <= zone.Right))
                continue;

            var height = element.H * 0.26f;
            if (i % 6 == 0)
                height = element.H * 0.48f;
            else if (i % 3 == 0)
                height = element.H * 0.38f;

            g.DrawLine(whitePen, x, baseline, x, baseline - height);
        }

        using var format = new StringFormat
        {
            Alignment = StringAlignment.Center,
            LineAlignment = StringAlignment.Far
        };

        foreach (var label in labels)
        {
            using var font = new Font("Segoe UI",
                label.Cardinal ? Math.Max(18f, element.H * 0.34f) : Math.Max(14f, element.H * 0.26f),
                label.Cardinal ? FontStyle.Bold : FontStyle.Regular,
                GraphicsUnit.Pixel);
            g.DrawString(label.Text, font, whiteBrush,
                new PointF(label.X, baseline - 2f), format);
        }
    }

    private static void DrawHeadingWindow(Graphics g, ElementLayout element)
    {
        using var darkBrush = new SolidBrush(Color.FromArgb(20, 20, 20));
        using var whiteBrush = new SolidBrush(Color.White);
        using var whitePen = new Pen(Color.White, 2f);
        using var font = new Font("Segoe UI", Math.Max(10f, element.H * 0.58f),
            FontStyle.Bold, GraphicsUnit.Pixel);
        using var format = new StringFormat
        {
            Alignment = StringAlignment.Center,
            LineAlignment = StringAlignment.Center
        };

        var box = new RectangleF(element.X, element.Y, element.W, element.H);
        g.FillRectangle(darkBrush, box);
        g.DrawRectangle(whitePen, box.X, box.Y, box.Width, box.Height);
        g.DrawString(element.Text ?? "345", font, whiteBrush, box, format);
    }

    public void DrawDebug(Graphics g, double pitchDeg, double rollDeg)
    {
        if (!_layout.ShowDebug)
            return;

        using var pen = new Pen(Color.Lime, 1f);
        using var font = new Font("Segoe UI", 10f, FontStyle.Bold);
        using var brush = new SolidBrush(Color.Lime);

        foreach (var pair in _layout.Elements)
        {
            var element = pair.Value;
            g.DrawRectangle(pen, element.X, element.Y, element.W, element.H);
            g.DrawString(pair.Key, font, brush, element.X + 2f, element.Y + 2f);
        }

        g.DrawString($"PITCH {pitchDeg:+0.0;-0.0;0.0}°  ROLL {rollDeg:+0.0;-0.0;0.0}°",
            font, brush, 4f, 4f);
    }

    private void DisposeImages()
    {
        foreach (var image in _images.Values)
            image.Dispose();
        _images.Clear();
    }

    public void Dispose()
    {
        DisposeImages();
    }

    private readonly record struct HeadingLabel(float X, string Text, bool Cardinal);
}
