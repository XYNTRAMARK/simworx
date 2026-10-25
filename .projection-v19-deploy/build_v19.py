from pathlib import Path
import subprocess, shutil

# Build the known-good V18 first, including the planner syntax repair.
subprocess.run(['python3','.projection-v18-deploy/build_v18.py'],check=True)

source=Path('projection-screen-configurator-v18.html')
target=Path('projection-screen-configurator-v19.html')
html=source.read_text()

sticky_css = """
<style id="projection-sticky-estimate-v19">
.led-estimate-bar{
  position: sticky !important;
  top: 0 !important;
  z-index: 1000 !important;
  background: #fff !important;
  box-shadow: 0 8px 18px rgba(15,23,42,.08);
}
@media (max-width: 720px){
  .led-estimate-bar{top:0 !important;}
}
</style>
"""

if '</head>' not in html:
    raise SystemExit('V19 could not find </head> for sticky estimate CSS')
html=html.replace('</head>', sticky_css+'\n</head>', 1)
target.write_text(html)

assert 'projection-sticky-estimate-v19' in html
assert 'position: sticky !important' in html
print('V19 keeps configuration estimate visible while scrolling')
