using System.Drawing.Drawing2D;

namespace Simworx.MD302;

internal sealed class LowerDisplayRenderer
{
    private readonly LowerDisplayConfig _layout;

    public LowerDisplayRenderer(LowerDisplayConfig layout)
    {
        _layout = layout;
    }

    public void Draw(Graphics g)
    {
        foreach (var key in _layout.ZOrder)
        {
            if (!_layout.Elements.TryGetValue(key, out var element) || !element.Visible)
                continue;

            // The calibration reference is intentionally not part of the production instrument.
            if (key.Equals("referenceImage", StringComparison.OrdinalIgnoreCase))
                continue;

            var state = g.Save();
            if (element.ClipToScreen)
            {
                var mask = _layout.ScreenMask;
                g.SetClip(new RectangleF(mask.X, mask.Y, mask.W, mask.H));
            }

            DrawElement(g, key, element);
            g.Restore(state);
        }
    }

    private static void DrawElement(Graphics g, string key, ElementLayout element)
    {
        switch (key)
        {
            case "lowerBackground":
                DrawRectangle(g, element);
                break;
            case "airspeedBand":
                DrawAirspeedBand(g, element);
                break;
            case "airspeedTape":
                DrawAirspeedTape(g, element);
                break;
            case "airspeedFrame":
                DrawAirspeedFrame(g, element);
                break;
            case "baroFrame":
                DrawBaroFrame(g, element);
                break;
            case "baroSync":
                DrawBaroSync(g, element);
                break;
            case "altitudeFrame":
                DrawAltitudeFrame(g, element);
                break;
            case "altitudeTape":
                DrawAltitudeTape(g, element);
                break;
            case "altitudeTrend":
                DrawTrendBar(g, element);
                break;
            default:
                if (element.Kind.Equals("text", StringComparison.OrdinalIgnoreCase))
                    DrawText(g, element);
                else if (element.Kind.Equals("rect", StringComparison.OrdinalIgnoreCase))
                    DrawRectangle(g, element);
                break;
        }
    }

    private static void DrawRectangle(Graphics g, ElementLayout element)
    {
        using var brush = new SolidBrush(ParseColor(element.Fill, Color.Black, element.Opacity));
        g.FillRectangle(brush, element.X, element.Y, element.W, element.H);
    }

    private static void DrawText(Graphics g, ElementLayout element)
    {
        var fontStyle = element.FontWeight?.Equals("bold", StringComparison.OrdinalIgnoreCase) == true
            ? FontStyle.Bold
            : FontStyle.Regular;
        var fontSize = element.FontSize > 0f ? element.FontSize : Math.Max(10f, element.H * 0.62f);

        using var font = new Font("Segoe UI", fontSize, fontStyle, GraphicsUnit.Pixel);
        using var brush = new SolidBrush(ParseColor(element.Color, Color.White, element.Opacity));
        using var format = new StringFormat
        {
            LineAlignment = StringAlignment.Center,
            Alignment = element.Align?.ToLowerInvariant() switch
            {
                "right" => StringAlignment.Far,
                "center" => StringAlignment.Center,
                _ => StringAlignment.Near
            }
        };

        g.DrawString(element.Text ?? string.Empty, font, brush,
            new RectangleF(element.X, element.Y, element.W, element.H), format);
    }

    private static void DrawAirspeedBand(Graphics g, ElementLayout element)
    {
        using var yellow = new SolidBrush(Color.FromArgb(255, 241, 225, 65));
        using var green = new SolidBrush(Color.FromArgb(255, 111, 201, 84));
        using var white = new SolidBrush(Color.FromArgb(220, 255, 255, 255));

        var yellowHeight = element.H * 0.36f;
        g.FillRectangle(yellow, element.X, element.Y, element.W, yellowHeight);
        g.FillRectangle(green, element.X, element.Y + yellowHeight, element.W, element.H - yellowHeight);
        g.FillRectangle(white, element.X, element.Y + yellowHeight - 1.5f, element.W, 3f);
    }

    private static void DrawAirspeedTape(Graphics g, ElementLayout element)
    {
        var values = new[] { 180, 170, 160, 150, 140, 130, 120 };
        using var pen = new Pen(Color.White, 2f);
        using var brush = new SolidBrush(Color.White);
        using var font = new Font("Segoe UI", Math.Max(11f, element.W * 0.27f), FontStyle.Regular, GraphicsUnit.Pixel);
        using var format = new StringFormat
        {
            Alignment = StringAlignment.Near,
            LineAlignment = StringAlignment.Center
        };

        for (var i = 0; i < values.Length; i++)
        {
            var y = element.Y + i / (float)(values.Length - 1) * element.H;
            g.DrawLine(pen, element.X, y, element.X + element.W * 0.35f, y);
            g.DrawString(values[i].ToString(), font, brush,
                new RectangleF(element.X + element.W * 0.42f, y - 10f, element.W * 0.58f, 20f), format);

            if (i >= values.Length - 1)
                continue;

            var minorY = y + element.H / (values.Length - 1) / 2f;
            g.DrawLine(pen, element.X, minorY, element.X + element.W * 0.22f, minorY);
        }
    }

    private static void DrawAirspeedFrame(Graphics g, ElementLayout element)
    {
        using var pen = new Pen(Color.White, 2.2f);
        using var darkBrush = new SolidBrush(Color.Black);
        using var path = new GraphicsPath();

        var left = element.X + element.W * 0.20f;
        var right = element.X + element.W * 0.92f;
        var top = element.Y + element.H * 0.06f;
        var bottom = element.Y + element.H * 0.92f;
        var centerY = element.Y + element.H / 2f;
        var notch = element.W * 0.18f;

        path.AddPolygon(
        [
            new PointF(left, top),
            new PointF(right, top),
            new PointF(right, bottom),
            new PointF(left, bottom),
            new PointF(left, centerY + element.H * 0.10f),
            new PointF(element.X, centerY),
            new PointF(left, centerY - element.H * 0.10f)
        ]);
        path.CloseFigure();

        g.FillPath(darkBrush, path);
        g.DrawPath(pen, path);

        using var smallFont = new Font("Segoe UI", Math.Max(9f, element.W * 0.15f), FontStyle.Bold, GraphicsUnit.Pixel);
        using var whiteBrush = new SolidBrush(Color.White);
        using var centerFormat = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center };
        g.DrawString("0", smallFont, whiteBrush,
            new RectangleF(right - notch, top + 2f, notch, element.H * 0.20f), centerFormat);
        g.DrawString("0", smallFont, whiteBrush,
            new RectangleF(right - notch, bottom - element.H * 0.20f - 2f, notch, element.H * 0.20f), centerFormat);
    }

    private static void DrawBaroFrame(Graphics g, ElementLayout element)
    {
        using var darkBrush = new SolidBrush(Color.Black);
        using var pen = new Pen(Color.White, 2f);
        g.FillRectangle(darkBrush, element.X, element.Y, element.W, element.H);
        g.DrawRectangle(pen, element.X, element.Y, element.W, element.H);
    }

    private static void DrawBaroSync(Graphics g, ElementLayout element)
    {
        using var pen = new Pen(Color.LightGray, Math.Max(1f, element.H * 0.20f));
        var centerY = element.Y + element.H / 2f;
        var centerX = element.X + element.W / 2f;
        var inset = element.W * 0.12f;

        g.DrawLine(pen, element.X, centerY, centerX - inset, centerY);
        g.DrawLine(pen, centerX + inset, centerY, element.X + element.W, centerY);
        g.DrawLine(pen, centerX - inset, centerY, centerX - inset - 4f, centerY - 3f);
        g.DrawLine(pen, centerX - inset, centerY, centerX - inset - 4f, centerY + 3f);
        g.DrawLine(pen, centerX + inset, centerY, centerX + inset + 4f, centerY - 3f);
        g.DrawLine(pen, centerX + inset, centerY, centerX + inset + 4f, centerY + 3f);
    }

    private static void DrawAltitudeFrame(Graphics g, ElementLayout element)
    {
        using var pen = new Pen(Color.White, 2.2f);
        using var darkBrush = new SolidBrush(Color.Black);
        using var path = new GraphicsPath();

        var left = element.X + element.W * 0.05f;
        var right = element.X + element.W * 0.78f;
        var top = element.Y + element.H * 0.08f;
        var bottom = element.Y + element.H * 0.92f;
        var centerY = element.Y + element.H / 2f;

        path.AddPolygon(
        [
            new PointF(left, top),
            new PointF(right, top),
            new PointF(right, centerY - element.H * 0.12f),
            new PointF(element.X + element.W, centerY),
            new PointF(right, centerY + element.H * 0.12f),
            new PointF(right, bottom),
            new PointF(left, bottom)
        ]);
        path.CloseFigure();

        g.FillPath(darkBrush, path);
        g.DrawPath(pen, path);

        using var smallFont = new Font("Segoe UI", Math.Max(9f, element.W * 0.13f), FontStyle.Bold, GraphicsUnit.Pixel);
        using var whiteBrush = new SolidBrush(Color.White);
        using var centerFormat = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center };
        g.DrawString("00", smallFont, whiteBrush,
            new RectangleF(right - element.W * 0.18f, top, element.W * 0.18f, element.H * 0.22f), centerFormat);
        g.DrawString("20", smallFont, whiteBrush,
            new RectangleF(right - element.W * 0.18f, bottom - element.H * 0.22f, element.W * 0.18f, element.H * 0.22f), centerFormat);
    }

    private static void DrawAltitudeTape(Graphics g, ElementLayout element)
    {
        var values = new[] { 8100, 8000, 7900, 7800, 7700, 7600 };
        using var pen = new Pen(Color.White, 2f);
        using var brush = new SolidBrush(Color.White);
        using var font = new Font("Segoe UI", Math.Max(11f, element.W * 0.20f), FontStyle.Regular, GraphicsUnit.Pixel);
        using var format = new StringFormat
        {
            Alignment = StringAlignment.Far,
            LineAlignment = StringAlignment.Center
        };

        for (var i = 0; i < values.Length; i++)
        {
            var y = element.Y + i / (float)(values.Length - 1) * element.H;
            g.DrawString(values[i].ToString(), font, brush,
                new RectangleF(element.X, y - 10f, element.W * 0.63f, 20f), format);
            g.DrawLine(pen, element.X + element.W * 0.72f, y, element.X + element.W, y);

            if (i >= values.Length - 1)
                continue;

            for (var minor = 1; minor < 5; minor++)
            {
                var minorY = y + element.H / (values.Length - 1) * (minor / 5f);
                var length = minor is 2 or 3 ? 0.20f : 0.14f;
                g.DrawLine(pen,
                    element.X + element.W * (1f - length), minorY,
                    element.X + element.W, minorY);
            }
        }
    }

    private static void DrawTrendBar(Graphics g, ElementLayout element)
    {
        using var brush = new SolidBrush(ParseColor(element.Fill, Color.Magenta, element.Opacity));
        using var pen = new Pen(Color.White, 1.5f);
        g.FillRectangle(brush, element.X, element.Y, element.W, element.H);
        g.DrawRectangle(pen, element.X, element.Y, element.W, element.H);
    }

    private static Color ParseColor(string? html, Color fallback, float opacity)
    {
        Color baseColor;
        try
        {
            baseColor = string.IsNullOrWhiteSpace(html) ? fallback : ColorTranslator.FromHtml(html);
        }
        catch
        {
            baseColor = fallback;
        }

        var alpha = Math.Clamp((int)Math.Round(opacity * 255f), 0, 255);
        return Color.FromArgb(alpha, baseColor.R, baseColor.G, baseColor.B);
    }
}
