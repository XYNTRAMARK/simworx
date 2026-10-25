from pathlib import Path
import subprocess

# Build V20 first: V19 + hidden Step 2 enclosure options.
subprocess.run(['python3','.projection-v20-deploy/build_v20.py'],check=True)

source=Path('projection-screen-configurator-v20.html')
target=Path('projection-screen-configurator-v21.html')
html=source.read_text()

# Screen system selling rate: €500 per square metre of curved active screen area.
old_rate='"screenSystemPerM2Eur":750'
new_rate='"screenSystemPerM2Eur":500'
if old_rate not in html:
    raise SystemExit('V21 screen rate anchor not found')
html=html.replace(old_rate,new_rate,1)

# Mounting price: ceiling mounts €300; floor-supported truss remains €1,000.
old_mount="if(state.mountingStyle==='truss')lines.push({id:'truss',label:'Floor-supported projector truss',amount:eur(1000),status:'priced'});"
new_mount="if(state.mountingStyle==='truss')lines.push({id:'truss',label:'Floor-supported projector truss',amount:eur(1000),status:'priced'});else lines.push({id:'ceiling-mounts',label:'Projector ceiling mounts',amount:eur(300),status:'priced'});"
if old_mount not in html:
    raise SystemExit('V21 mounting quote anchor not found')
html=html.replace(old_mount,new_mount,1)

target.write_text(html)

assert '"screenSystemPerM2Eur":500' in html
assert "label:'Projector ceiling mounts',amount:eur(300)" in html
assert "label:'Floor-supported projector truss',amount:eur(1000)" in html
assert 'projection-hide-enclosure-options-v20' in html
assert 'projection-sticky-estimate-v19' in html
print('V21 pricing: screen €500/m², ceiling mounts €300, truss €1,000')
