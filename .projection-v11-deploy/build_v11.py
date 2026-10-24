from pathlib import Path
import subprocess, shutil

subprocess.run(['python3','.projection-v10-deploy/build_v10.py'],check=True)

p=Path('projection/guided.css')
s=p.read_text()

# V11: exact LED-derived estimate strip and common page spacing.
s += """
/* V11: align projection page spacing and estimate strip with LED configurator. */
#projection-app.led-shell{
  box-sizing:border-box!important;
  width:100%!important;
  max-width:none!important;
  margin:0 auto!important;
  padding:26px 28px 70px!important;
}
.led-estimate-bar{
  display:flex!important;
  justify-content:space-between!important;
  align-items:center!important;
  gap:20px!important;
  padding:16px 20px!important;
  background:#fff!important;
  border:1px solid #dfe2e5!important;
  border-left:4px solid #c5251c!important;
  border-radius:6px!important;
  position:sticky!important;
  top:0!important;
  right:auto!important;
  width:auto!important;
  max-width:none!important;
  z-index:40!important;
  box-shadow:0 3px 12px #00000008!important;
  margin:0 0 22px!important;
}
@media(max-width:820px){
  #projection-app.led-shell{
    width:auto!important;
    padding-left:14px!important;
    padding-right:14px!important;
  }
}
"""
p.write_text(s)

subprocess.run(['python3','tools/build-projection-guided.py'],check=True)
shutil.copyfile('projection-screen-configurator-preview.html','projection-screen-configurator-v11.html')

css=Path('projection/guided.css').read_text()
assert 'padding:26px 28px 70px!important;' in css
assert 'padding:16px 20px!important;' in css
assert 'position:sticky!important;' in css
assert 'right:auto!important;' in css
assert 'padding-left:14px!important;' in css
print('V11 LED-common padding and sticky price strip checks passed')
