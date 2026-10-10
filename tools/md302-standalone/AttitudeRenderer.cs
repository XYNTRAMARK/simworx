using System.Drawing.Drawing2D;

namespace Simworx.MD302;

internal sealed class AttitudeRenderer : IDisposable
{
    private readonly LayoutConfig _layout;

    private static readonly Color Sky = Color.FromArgb(0x2E, 0xA5, 0xF5);
    private static readonly Color Ground = Color.FromArgb(0x9A, 0x59, 0x2E);
    private static readonly Color Amber = Color.FromArgb(0xFF, 0x9E, 0x00);
    private static readonly Color Red = Color.FromArgb(0xFF, 0x21, 0x21);

    public AttitudeRenderer(LayoutConfig layout)
    {
        _layout = layout;
    }

    public void Load(string assetDirectory) { }

    public void Draw(Graphics g, double pitchDeg, double rollDeg)
    {
        var assembly = g.Save();
        g.TranslateTransform(_layout.AttitudeX, _layout.AttitudeY);
        g.ScaleTransform(_layout.AttitudeScale, _layout.AttitudeScale);

        DrawBackground(g, pitchDeg, rollDeg);
        DrawPitchLadder(g, pitchDeg, rollDeg);
        DrawRollScale(g, rollDeg);
        DrawAircraftSymbol(g, pitchDeg);
        DrawSlipIndicator(g);
        DrawHeadingScale(g);

        g.Restore(assembly);
    }

    private void DrawBackground(Graphics g, double pitchDeg, double rollDeg)
    {
        var s = g.Save();
        g.SetClip(new RectangleF(0, 0, _layout.AttitudeClipWidth, _layout.AttitudeClipHeight));

        g.TranslateTransform(_layout.AttitudeCenterX, _layout.AttitudeCenterY);
        g.RotateTransform((float)-rollDeg);
        g.TranslateTransform(0, (float)(pitchDeg * _layout.PitchPixelsPerDegree));

        using var skyBrush = new SolidBrush(Sky);
        using var groundBrush = new SolidBrush(Ground);
        using var horizonPen = new Pen(Color.White, 2f);

        g.FillRectangle(skyBrush, -900, -900, 1800, 900);
        g.FillRectangle(groundBrush, -900, 0, 1800, 900);
        g.DrawLine(horizonPen, -900, 0, 900, 0);

        g.Restore(s);
    }

    private void DrawPitchLadder(Graphics g, double pitchDeg, double rollDeg)
    {
        var s = g.Save();

        g.SetClip(new RectangleF(
            0,
            _layout.PitchWindowTop,
            _layout.AttitudeClipWidth,
            _layout.PitchWindowHeight
        ));

        g.TranslateTransform(_layout.AttitudeCenterX, _layout.AttitudeCenterY);
        g.RotateTransform((float)-rollDeg);
        g.TranslateTransform(0, (float)(pitchDeg * _layout.PitchPixelsPerDegree));

        using var pen = new Pen(Color.White, 2f);
        using var font = new Font("Segoe UI", 8f, FontStyle.Bold, GraphicsUnit.Pixel);
        using var brush = new SolidBrush(Color.White);
        using var fmt = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center };

        for (int deg = -90; deg <= 90; deg += 5)
        {
            var y = (float)(-deg * _layout.PitchPixelsPerDegree);
            var major = deg % 10 == 0;
            var halfWidth = major ? 34f : 18f;

            // 0° is the horizon reference. The zero line sits exactly on
            // the full-width horizon; the reference unit does not need 0 labels.
            if (deg == 0)
            {
                using var zeroPen = new Pen(Color.White, 2.5f);
                g.DrawLine(zeroPen, -40f, 0f, 40f, 0f);
                continue;
            }

            g.DrawLine(pen, -halfWidth, y, halfWidth, y);

            if (major)
            {
                var label = Math.Abs(deg).ToString();
                g.DrawString(label, font, brush, new RectangleF(-68, y - 7, 28, 14), fmt);
                g.DrawString(label, font, brush, new RectangleF(40, y - 7, 28, 14), fmt);
            }
        }

        g.Restore(s);
    }

    private void DrawRollScale(Graphics g, double rollDeg)
    {
        var s = g.Save();

        g.TranslateTransform(_layout.RollCenterX, _layout.RollCenterY);

        using var scalePen = new Pen(Color.White, 2f);
        using var indexPen = new Pen(Color.White, 3f);
        using var whiteBrush = new SolidBrush(Color.White);

        foreach (var angle in new[] { -60f, -45f, -30f, -20f, -10f, 0f, 10f, 20f, 30f, 45f, 60f })
        {
            var rad = (angle - 90f) * MathF.PI / 180f;
            var outer = 108f;
            var inner = angle == 0 ? 94f : 98f;

            var x1 = MathF.Cos(rad) * inner;
            var y1 = MathF.Sin(rad) * inner;
            var x2 = MathF.Cos(rad) * outer;
            var y2 = MathF.Sin(rad) * outer;

            g.DrawLine(scalePen, x1, y1, x2, y2);
        }

        // Fixed top triangle.
        PointF[] topTriangle =
        {
            new(-6f, -112f),
            new(6f, -112f),
            new(0f, -101f)
        };
        g.FillPolygon(whiteBrush, topTriangle);

        // Moving bank pointer: deliberately inset so the tips do not touch.
        var p = g.Save();
        g.RotateTransform((float)rollDeg);
        var r = _layout.RollPointerRadius;
        PointF[] pointer =
        {
            new(-6f, -r + 10f),
            new(6f, -r + 10f),
            new(0f, -r)
        };
        g.FillPolygon(whiteBrush, pointer);
        g.Restore(p);

        g.Restore(s);
    }

    private void DrawAircraftSymbol(Graphics g, double pitchDeg)
    {
        var s = g.Save();
        g.TranslateTransform(_layout.AttitudeCenterX, _layout.AttitudeCenterY);

        if (Math.Abs(pitchDeg) < _layout.UnusualPitchChevronThreshold)
        {
            using var pen = new Pen(Amber, 5f)
            {
                StartCap = LineCap.Round,
                EndCap = LineCap.Round
            };

            g.DrawLine(pen, -48, 0, -14, 0);
            g.DrawLine(pen, 14, 0, 48, 0);
            g.DrawLine(pen, -14, 0, 0, 8);
            g.DrawLine(pen, 0, 8, 14, 0);
            g.DrawLine(pen, -48, 0, -48, 10);
            g.DrawLine(pen, 48, 0, 48, 10);
        }
        else
        {
            using var pen = new Pen(Red, 5f)
            {
                StartCap = LineCap.Round,
                EndCap = LineCap.Round
            };

            var direction = pitchDeg > 0 ? 1f : -1f;
            g.DrawLine(pen, -42, -10 * direction, -12, 10 * direction);
            g.DrawLine(pen, -12, 10 * direction, 0, -2 * direction);
            g.DrawLine(pen, 0, -2 * direction, 12, 10 * direction);
            g.DrawLine(pen, 12, 10 * direction, 42, -10 * direction);
        }

        g.Restore(s);
    }

    private void DrawSlipIndicator(Graphics g)
    {
        var y = 292f;
        using var backing = new SolidBrush(Color.FromArgb(210, 0, 0, 0));
        using var whiteBrush = new SolidBrush(Color.White);
        using var whitePen = new Pen(Color.White, 2f);

        var x = _layout.AttitudeCenterX;
        g.FillRectangle(backing, x - 42f, y - 10f, 84f, 20f);
        g.DrawLine(whitePen, x - 14f, y - 7f, x - 14f, y + 7f);
        g.DrawLine(whitePen, x + 14f, y - 7f, x + 14f, y + 7f);
        g.FillEllipse(whiteBrush, x - 5f, y - 5f, 10f, 10f);
    }

    private void DrawHeadingScale(Graphics g)
    {
        var yTop = 350f;
        var yBottom = _layout.AttitudeClipHeight;
        using var groundBrush = new SolidBrush(Ground);
        using var whiteBrush = new SolidBrush(Color.White);
        using var darkBrush = new SolidBrush(Color.FromArgb(25, 25, 25));
        using var whitePen = new Pen(Color.White, 2f);
        using var font = new Font("Segoe UI", 12f, FontStyle.Bold, GraphicsUnit.Pixel);
        using var headingFont = new Font("Segoe UI", 18f, FontStyle.Bold, GraphicsUnit.Pixel);
        using var fmt = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center };

        g.FillRectangle(groundBrush, 0, yTop, _layout.AttitudeClipWidth, yBottom - yTop);

        var center = _layout.AttitudeCenterX;
        for (int i = -4; i <= 4; i++)
        {
            var x = center + i * 28f;
            var major = i % 3 == 0;
            var h = major ? 18f : 11f;
            g.DrawLine(whitePen, x, yTop + 7f, x, yTop + 7f + h);
        }

        g.DrawString("30", font, whiteBrush, new RectangleF(2, yTop + 38f, 34, 18), fmt);
        g.DrawString("33", font, whiteBrush, new RectangleF(54, yTop + 38f, 34, 18), fmt);
        g.DrawString("N", font, whiteBrush, new RectangleF(_layout.AttitudeClipWidth - 92, yTop + 38f, 30, 18), fmt);
        g.DrawString("3", font, whiteBrush, new RectangleF(_layout.AttitudeClipWidth - 36, yTop + 38f, 28, 18), fmt);

        var box = new RectangleF(center - 32f, yTop + 30f, 64f, 30f);
        g.FillRectangle(darkBrush, box);
        g.DrawRectangle(whitePen, box.X, box.Y, box.Width, box.Height);
        g.DrawString("345", headingFont, whiteBrush, box, fmt);
    }

    public void DrawDebug(Graphics g, double pitchDeg, double rollDeg)
    {
        if (!_layout.ShowDebug) return;

        var s = g.Save();
        g.TranslateTransform(_layout.AttitudeX, _layout.AttitudeY);
        g.ScaleTransform(_layout.AttitudeScale, _layout.AttitudeScale);

        using var pen = new Pen(Color.Lime, 1f);
        using var font = new Font("Segoe UI", 10f, FontStyle.Bold);
        using var brush = new SolidBrush(Color.Lime);

        g.DrawRectangle(pen, 0, 0, _layout.AttitudeClipWidth, _layout.AttitudeClipHeight);
        g.DrawString($"PITCH {pitchDeg:+0.0;-0.0;0.0}°  ROLL {rollDeg:+0.0;-0.0;0.0}°", font, brush, 4, 4);

        g.Restore(s);
    }

    public void Dispose() { }
}
