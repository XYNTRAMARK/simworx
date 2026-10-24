from pathlib import Path
import subprocess, shutil

subprocess.run(['python3','.projection-v9-deploy/build_v9.py'],check=True)

p=Path('projection/guided.css')
s=p.read_text()

# Remove the V7 internal width reservation that narrowed the whole configurator.
s=s.replace('.led-shell{padding-right:360px!important;}','')

# Restore a fluid desktop shell. Keep only sensible viewport gutters; the price
# card floats independently and no longer steals layout width.
s += """
/* V10: restore the original fluid-width configurator layout. */
@media(min-width:1101px){
  #projection-app.led-shell{
    width:calc(100% - 40px)!important;
    max-width:none!important;
    margin-left:auto!important;
    margin-right:auto!important;
    padding-left:0!important;
    padding-right:0!important;
  }
  .led-estimate-bar{
    position:fixed!important;
    top:calc(var(--sw-header-h,62px) + 16px)!important;
    right:18px!important;
    width:330px!important;
    max-width:calc(100vw - 36px)!important;
    margin:0!important;
    z-index:140!important;
  }
}
@media(max-width:1100px){
  #projection-app.led-shell{
    width:calc(100% - 32px)!important;
    max-width:none!important;
    margin-left:auto!important;
    margin-right:auto!important;
    padding-left:0!important;
    padding-right:0!important;
  }
}
"""
p.write_text(s)

subprocess.run(['python3','tools/build-projection-guided.py'],check=True)
shutil.copyfile('projection-screen-configurator-preview.html','projection-screen-configurator-v10.html')

css=Path('projection/guided.css').read_text()
assert '.led-shell{padding-right:360px!important;}' not in css
assert 'width:calc(100% - 40px)!important;' in css
assert 'max-width:none!important;' in css
print('V10 fluid-width checks passed')
