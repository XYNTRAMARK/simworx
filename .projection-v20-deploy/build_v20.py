from pathlib import Path
import subprocess

# Build the known-good V19 first.
subprocess.run(['python3','.projection-v19-deploy/build_v19.py'],check=True)

source=Path('projection-screen-configurator-v19.html')
target=Path('projection-screen-configurator-v20.html')
html=source.read_text()

hide_css = """
<style id="projection-hide-enclosure-options-v20">
.led-shape-bar[data-guided-step="2"]{
  display:none !important;
}
</style>
"""

if '</head>' not in html:
    raise SystemExit('V20 could not find </head> for enclosure CSS')
html=html.replace('</head>', hide_css+'\n</head>', 1)

target.write_text(html)

assert 'projection-hide-enclosure-options-v20' in html
assert '.led-shape-bar[data-guided-step="2"]' in html
assert 'display:none !important' in html
print('V20 hides enclosure choices on Step 2 while retaining screen-only internal state')
