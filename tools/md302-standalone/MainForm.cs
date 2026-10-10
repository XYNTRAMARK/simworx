using System.Drawing.Drawing2D;

namespace Simworx.MD302;

internal sealed class MainForm : Form
{
    private readonly AppConfig _config;
    private readonly AttitudeRenderer _attitudeRenderer;
    private readonly System.Windows.Forms.Timer _animationTimer = new();

    private double _pitchDeg;
    private double _rollDeg;
    private double _targetPitchDeg;
    private double _targetRollDeg;

    private const double PitchClickStep = 0.25;
    private const double RollClickStep = 0.50;
    private const double SmoothingFactor = 0.22;

    public MainForm(AppConfig config)
    {
        _config = config;
        _attitudeRenderer = new AttitudeRenderer(_config.Layout);

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

        _animationTimer.Interval = 16;
        _animationTimer.Tick += (_, _) =>
        {
            var previousPitch = _pitchDeg;
            var previousRoll = _rollDeg;

            _pitchDeg += (_targetPitchDeg - _pitchDeg) * SmoothingFactor;
            _rollDeg = ApproachAngle(_rollDeg, _targetRollDeg, SmoothingFactor);

            if (Math.Abs(_targetPitchDeg - _pitchDeg) < 0.001)
                _pitchDeg = _targetPitchDeg;

            if (Math.Abs(ShortestAngleDelta(_rollDeg, _targetRollDeg)) < 0.001)
                _rollDeg = _targetRollDeg;

            if (Math.Abs(previousPitch - _pitchDeg) > 0.0001 ||
                Math.Abs(ShortestAngleDelta(previousRoll, _rollDeg)) > 0.0001)
                Invalidate();
        };

        Shown += (_, _) =>
        {
            _attitudeRenderer.Load(Path.Combine(AppContext.BaseDirectory, "assets"));
            _animationTimer.Start();
            Invalidate();
        };

        FormClosed += (_, _) =>
        {
            _animationTimer.Stop();
            _animationTimer.Dispose();
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
                _targetPitchDeg = Math.Clamp(_targetPitchDeg + PitchClickStep, -90.0, 90.0);
                break;
            case Keys.Down:
                _targetPitchDeg = Math.Clamp(_targetPitchDeg - PitchClickStep, -90.0, 90.0);
                break;
            case Keys.Left:
                _targetRollDeg = NormalizeRoll(_targetRollDeg - RollClickStep);
                break;
            case Keys.Right:
                _targetRollDeg = NormalizeRoll(_targetRollDeg + RollClickStep);
                break;
            case Keys.R:
            case Keys.Home:
                _targetPitchDeg = 0;
                _targetRollDeg = 0;
                break;
            default:
                return;
        }

        Invalidate();
    }

    private static double ApproachAngle(double current, double target, double factor)
    {
        var delta = ShortestAngleDelta(current, target);
        return NormalizeRoll(current + delta * factor);
    }

    private static double ShortestAngleDelta(double from, double to)
    {
        return NormalizeRoll(to - from);
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

    protected override void OnPaint(PaintEventArgs e)
    {
        base.OnPaint(e);

        var g = e.Graphics;
        g.Clear(Color.Black);
        g.CompositingQuality = CompositingQuality.HighQuality;
        g.InterpolationMode = InterpolationMode.HighQualityBicubic;
        g.PixelOffsetMode = PixelOffsetMode.HighQuality;
        g.SmoothingMode = SmoothingMode.HighQuality;

        var client = ClientRectangle;
        var canvasWidth = Math.Max(1, _config.Layout.CanvasWidth);
        var canvasHeight = Math.Max(1, _config.Layout.CanvasHeight);

        var scale = Math.Min(
            client.Width / (double)canvasWidth,
            client.Height / (double)canvasHeight
        );

        var width = (int)Math.Round(canvasWidth * scale);
        var height = (int)Math.Round(canvasHeight * scale);
        var x = (client.Width - width) / 2;
        var y = (client.Height - height) / 2;
        var viewport = new Rectangle(x, y, width, height);

        var state = g.Save();
        g.TranslateTransform(viewport.Left, viewport.Top);
        g.ScaleTransform(
            viewport.Width / (float)canvasWidth,
            viewport.Height / (float)canvasHeight
        );

        _attitudeRenderer.Draw(g, _pitchDeg, _rollDeg);
        _attitudeRenderer.DrawDebug(g, _pitchDeg, _rollDeg);

        g.Restore(state);
    }
}
