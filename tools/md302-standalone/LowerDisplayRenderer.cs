using System.Drawing.Drawing2D;
using System.Drawing.Imaging;

namespace Simworx.MD302;

internal sealed class LowerDisplayRenderer : IDisposable
{
    private readonly LowerDisplayConfig _layout;
    private readonly Dictionary<string, Image> _images = new(StringComparer.OrdinalIgnoreCase);

    public LowerDisplayRenderer(LowerDisplayConfig layout)
    {
        _layout = layout;
    }

    public void Load(string assetDirectory)
    {
        DisposeImages();
        LoadImage("airspeedFrame", Path.Combine(assetDirectory, "md302_oriel_s_v.png"));
        LoadImage("baroFrame", Path.Combine(assetDirectory, "md302_oriel_baro.png"));
        LoadImage("baroSync", Path.Combine(assetDirectory, "md302_baro_sync.png"));
        LoadImage("altitudeFrame", Path.Combine(assetDirectory, "md302_oriel_a_v.png"));
    }

    private void LoadImage(string key, string path)
    {
        if (!File.Exists(path))
            return;

        using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
        using var source = Image.FromStream(stream);
        _images[key] = new Bitmap(source);
    }

    public void Draw(Graphics g)
    {
        foreach (var key in _layout.ZOrder)
        {
            if (!_layout.Elements.TryGetValue(key, out var element) || !element.Visible)
                continue;

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

    private void DrawElement(Graphics g, string key, ElementLayout element)
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
                if (!DrawImageAsset(g, key, element))
                    DrawAirspeedFrameFallback(g, element);
                break;
            case "baroFrame":
                if (!DrawImageAsset(g, key, element))
                    DrawBaroFrameFallback(g, element);
                break;
            case "baroSync":
                if (!DrawImageAsset(g, key, element))
                    DrawBaroSyncFallback(g, element);
                break;
            case "altitudeFrame":
                if (!DrawImageAsset(g, key, element))
                    DrawAltitudeFrameFallback(g, element);
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
                else if (element.Kind.Equals("image", StringComparison.OrdinalIgnoreCase))
                    DrawImageAsset(g, key, element);
                break;
        }
    }

    private bool DrawImageAsset(Graphics g, string key, ElementLayout element)
    {
        if (!_images.TryGetValue(key, out var image))
            return false;

        var destination = new RectangleF(element.X, element.Y, element.W, element.H);
        var opacity = Math.Clamp(element.Opacity, 0f, 1f);

        if (opacity >= 0.999f)
        {
            g.DrawImage(image, destination);
            return true;
        }

        using var attributes = new ImageAttributes();
        var matrix = new ColorMatrix { Matrix33 = opacity };
        attributes.SetColorMatrix(matrix, ColorMatrixFlag.Default, ColorAdjustType.Bitmap);
        g.DrawImage(image, Rectangle.Round(destination), 0, 0, image.Width, image.Height,
            GraphicsUnit.Pixel, attributes);
        return true;
    }

    private static void DrawRectangle(Graphics g, ElementLayout element)
    {
        using var brush = new SolidBrush(ParseColor(element.Fill, Color.Black, element.Opacity));
        g.FillRectangle(brush, element.X, element.Y, element.W, element.H);
    }

    private static void DrawText(Graphics g, ElementLayout element)
    {
        var style = element.FontWeight?.Equals("bold", StringComparison.OrdinalIgnoreCase) == true
            ? FontStyle.Bold : FontStyle.Regular;
        var size = element.FontSize > 0f ? element.FontSize : Math.Max(10f, element.H * 0.62f);
        using var font = new Font("Segoe UI", size, style, GraphicsUnit.Pixel);
        using var brush = new SolidBrush(ParseColor(element.Color, Color.White, element.Opacity));
        using var format = new StringFormat(StringFormat.GenericTypographic)
        {
            FormatFlags = StringFormatFlags.NoWrap,
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
        using var format = new StringFormat(StringFormat.GenericTypographic)
        {
            Alignment = StringAlignment.Near,
            LineAlignment = StringAlignment.Center,
            FormatFlags = StringFormatFlags.NoClip
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

    private static void DrawAirspeedFrameFallback(Graphics g, ElementLayout element)
    {
        using var pen = new Pen(Color.White, 2.2f);
        using var darkBrush = new SolidBrush(Color.Black);
        using var whiteBrush = new SolidBrush(Color.White);
        using var path = new GraphicsPath();

        // The element rectangle is the calibrated PNG destination. The visible
        // fallback therefore occupies that exact box instead of adding hidden margins.
        var left = element.X + element.W * 0.20f;
        var right = element.X + element.W;
        var top = element.Y;
        var bottom = element.Y + element.H;
        var centerY = element.Y + element.H / 2f;

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

        using var smallFont = new Font("Segoe UI", Math.Max(8f, element.W * 0.14f),
            FontStyle.Bold, GraphicsUnit.Pixel);
        using var format = new StringFormat(StringFormat.GenericTypographic)
        {
            Alignment = StringAlignment.Center,
            LineAlignment = StringAlignment.Center
        };
        var labelWidth = element.W * 0.18f;
        g.DrawString("0", smallFont, whiteBrush,
            new RectangleF(right - labelWidth, top + 1f, labelWidth, element.H * 0.20f), format);
        g.DrawString("0", smallFont, whiteBrush,
            new RectangleF(right - labelWidth, bottom - element.H * 0.20f - 1f,
                labelWidth, element.H * 0.20f), format);
    }

    private static void DrawBaroFrameFallback(Graphics g, ElementLayout element)
    {
        using var darkBrush = new SolidBrush(Color.Black);
        using var pen = new Pen(Color.White, 2f);
        g.FillRectangle(darkBrush, element.X, element.Y, element.W, element.H);
        g.DrawRectangle(pen, element.X, element.Y, element.W, element.H);
    }

    private static void DrawBaroSyncFallback(Graphics g, ElementLayout element)
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

    private static void DrawAltitudeFrameFallback(Graphics g, ElementLayout element)
    {
        using var pen = new Pen(Color.White, 2.2f);
        using var darkBrush = new SolidBrush(Color.Black);
        using var whiteBrush = new SolidBrush(Color.White);
        using var path = new GraphicsPath();

        var left = element.X;
        var right = element.X + element.W * 0.78f;
        var top = element.Y;
        var bottom = element.Y + element.H;
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

        using var smallFont = new Font("Segoe UI", Math.Max(8f, element.W * 0.12f),
            FontStyle.Bold, GraphicsUnit.Pixel);
        using var format = new StringFormat(StringFormat.GenericTypographic)
        {
            Alignment = StringAlignment.Center,
            LineAlignment = StringAlignment.Center
        };
        var labelWidth = element.W * 0.18f;
        g.DrawString("00", smallFont, whiteBrush,
            new RectangleF(right - labelWidth, top + 1f, labelWidth, element.H * 0.22f), format);
        g.DrawString("20", smallFont, whiteBrush,
            new RectangleF(right - labelWidth, bottom - element.H * 0.22f - 1f,
                labelWidth, element.H * 0.22f), format);
    }

    private static void DrawAltitudeTape(Graphics g, ElementLayout element)
    {
        var values = new[] { 8100, 8000, 7900, 7800, 7700, 7600 };
        using var pen = new Pen(Color.White, 2f);
        using var brush = new SolidBrush(Color.White);
        using var font = new Font("Segoe UI", Math.Max(11f, element.W * 0.20f), FontStyle.Regular, GraphicsUnit.Pixel);
        using var format = new StringFormat(StringFormat.GenericTypographic)
        {
            Alignment = StringAlignment.Far,
            LineAlignment = StringAlignment.Center,
            FormatFlags = StringFormatFlags.NoClip
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
}
