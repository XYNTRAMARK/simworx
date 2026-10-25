from pathlib import Path
import subprocess, re

# Build the known-good V19 first.
subprocess.run(['python3','.projection-v19-deploy/build_v19.py'],check=True)

source=Path('projection-screen-configurator-v19.html')
target=Path('projection-screen-configurator-v20.html')
html=source.read_text()

pattern = re.compile(r'<div class="led-shape-bar" data-guided-step="2">.*?</fieldset></div>', re.S)
replacement = '<div class="projection-enclosure-default" hidden><input type="radio" name="projection-enclosure" value="screen-only" checked></div>'
html, count = pattern.subn(replacement, html, count=1)
if count != 1:
    raise SystemExit(f'Expected one enclosure option block, replaced {count}')

target.write_text(html)

assert 'Semi enclosed' not in html
assert 'Fully enclosed' not in html
assert 'value="screen-only" checked' in html
print('V20 removes visible enclosure choices while retaining screen-only default state')
