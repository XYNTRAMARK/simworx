from pathlib import Path
import subprocess, shutil

subprocess.run(['python3','.projection-v17-deploy/build_v17.py'],check=True)

p=Path('projection/src/guided-planner.js')
s=p.read_text()

start_marker=" for(const id of ['guided-count','guided-mount-drop','guided-resize'])$(id)?.addEventListener('change',preferencesChanged);"
end_marker="\n\n $('guided-optimise-screen').addEventListener"
start=s.find(start_marker)
end=s.find(end_marker,start)
if start<0 or end<0:
    raise SystemExit('V18 planner listener repair anchors not found')

clean=start_marker
s=s[:start]+clean+s[end:]
p.write_text(s)

subprocess.run(['node','--check','projection/src/guided-planner.js'],check=True)
subprocess.run(['python3','tools/build-projection-guided.py'],check=True)
shutil.copyfile('projection-screen-configurator-preview.html','projection-screen-configurator-v18.html')

guided=Path('projection/src/guided-planner.js').read_text()
assert "if(!input?.reportValidity())return" not in guided
assert guided.count("['guided-count','guided-mount-drop','guided-resize']")==1
print('V18 removed orphaned budget listener tail')
