from pathlib import Path
import subprocess, shutil, json, re

# Recreate the known-good source state through V18.
subprocess.run(['python3','.projection-v18-deploy/build_v18.py'],check=True)

# ---------- UI: expose manual movement / rotation / optical fit ----------
p=Path('projection/main.html')
s=p.read_text()
s=s.replace('<details id="guided-manual" class="projection-placement guided-manual">',
            '<details id="guided-manual" class="projection-placement guided-manual" open>',1)
s=s.replace('<summary>Advanced · adjust projector positions manually</summary>',
            '<summary>Fine tune projector position, aim &amp; optics</summary>',1)
s=s.replace('<p class="led-help">Manual positioning is for geometry comparison only. The customer-facing specification remains brand-neutral.</p>',
            '<p class="led-help">Use these controls as an installation feasibility tool. Move and aim each projector, then change the required throw ratio until the beam covers the screen. Lower throw ratio means a wider image from the same distance. The final result is a projector requirement, not a model recommendation.</p>',1)

anchor='<div class="projection-form-grid">\n<label>X · left / right <span data-position-unit>m</span><input type="number" step="0.05" id="projection-x" data-position="0"></label>'
sliders='''<div class="projection-manual-sliders">
<div class="projection-manual-slider"><label>Move left / right <span data-position-unit>m</span></label><input type="range" min="-10" max="10" step="0.05" value="0" data-position="0" aria-label="Move selected projector left or right"></div>
<div class="projection-manual-slider"><label>Raise / lower <span data-position-unit>m</span></label><input type="range" min="0" max="10" step="0.05" value="3" data-position="1" aria-label="Raise or lower selected projector"></div>
<div class="projection-manual-slider"><label>Move forward / back <span data-position-unit>m</span></label><input type="range" min="-10" max="10" step="0.05" value="0" data-position="2" aria-label="Move selected projector forward or back"></div>
<div class="projection-manual-slider"><label>Rotate left / right</label><input type="range" min="-180" max="180" step="1" value="0" data-aim="yaw" aria-label="Rotate selected projector left or right"></div>
<div class="projection-manual-slider"><label>Tilt up / down</label><input type="range" min="-60" max="60" step="1" value="0" data-aim="pitch" aria-label="Tilt selected projector up or down"></div>
<div class="projection-manual-slider"><label>Roll</label><input type="range" min="-45" max="45" step="1" value="0" data-aim="roll" aria-label="Roll selected projector"></div>
</div>
'''
if anchor not in s: raise SystemExit('V22 source manual controls anchor missing')
s=s.replace(anchor,sliders+anchor,1)

old='<div class="led-field"><label for="projection-throw">Optical throw ratio <span id="projection-throw-limits"></span></label><input id="projection-throw" type="range" min="0.2" max="2" step="0.001"><output id="projection-throw-value" for="projection-throw"></output></div>'
new='''<section class="projection-throw-planner">
<div class="led-panel-head"><div><span class="led-step">OPTICAL FIT</span><h3>Required throw ratio</h3></div><strong id="projection-throw-class" class="led-model-badge">Short throw</strong></div>
<p class="led-help">Adjust this until the projected beam covers the screen from the physical mounting position. This planning range reflects common professional lens families rather than one manufacturer: roughly 0.30–0.45 UST, 0.45–1.00 short/wide throw, and 1.00–2.10 standard/medium zoom.</p>
<div class="led-field"><label for="projection-throw">Throw ratio <span id="projection-throw-limits">(planning range 0.30–2.10)</span></label><input id="projection-throw" type="range" min="0.30" max="2.10" step="0.005"><output id="projection-throw-value" for="projection-throw"></output></div>
<label class="projection-check"><input type="checkbox" id="projection-throw-all" checked> Apply this throw requirement to all projectors</label>
<div class="projection-throw-scale" aria-hidden="true"><span>0.30 UST</span><span>0.45</span><span>1.00</span><span>2.10 standard / medium</span></div>
<p class="led-help"><strong>Sales check:</strong> if a realistic throw ratio still cannot achieve coverage without cockpit shadow, change the projector position, cockpit position or screen geometry before quoting.</p>
</section>'''
if old not in s: raise SystemExit('V22 source throw UI anchor missing')
s=s.replace(old,new,1)
p.write_text(s)

# ---------- App: generic planning throw range and live class ----------
p=Path('projection/src/app.js')
s=p.read_text()
old="""  const min=model?.throwRatio?.min,max=model?.throwRatio?.max;
  $('projection-throw').disabled=p.locked||!finite(min)||!finite(max)||max===min;
  if(finite(min)&&finite(max)){$('projection-throw').min=min;$('projection-throw').max=max;$('projection-throw').value=p.throwRatio??min;}
  $('projection-throw-limits').textContent=finite(min)&&finite(max)?'('+min+'–'+max+')':'(unknown)';
  $('projection-throw-value').textContent=finite(p.throwRatio)?p.throwRatio.toFixed(3):'Unknown';"""
new="""  const min=.30,max=2.10;
  $('projection-throw').disabled=p.locked;
  $('projection-throw').min=min;$('projection-throw').max=max;$('projection-throw').step=.005;$('projection-throw').value=finite(p.throwRatio)?Math.max(min,Math.min(max,p.throwRatio)):.72;
  $('projection-throw-limits').textContent='(planning range 0.30–2.10)';
  $('projection-throw-value').textContent=finite(p.throwRatio)?p.throwRatio.toFixed(3):'0.720';
  const throwClass=$('projection-throw-class');if(throwClass){const r=finite(p.throwRatio)?p.throwRatio:.72;throwClass.textContent=r<.45?'Ultra-short throw':r<1?'Short / wide throw':'Standard / medium zoom';}"""
if old not in s: raise SystemExit('V22 source app throw block missing')
s=s.replace(old,new,1)
old="$('projection-throw').addEventListener('input',e=>{selected().throwRatio=Number(e.target.value);update();});"
new="$('projection-throw').addEventListener('input',e=>{const ratio=Number(e.target.value),targets=$('projection-throw-all')?.checked?state.projectors:[selected()];for(const p of targets){p.throwRatio=ratio;p.planningThrowRange=[.30,2.10];}state.manualLayout=true;update();});"
if old not in s: raise SystemExit('V22 source throw event missing')
s=s.replace(old,new,1)

# Ceiling mounts €300; truss stays €1,000.
old="if(state.mountingStyle==='truss')lines.push({id:'truss',label:'Floor-supported projector truss',amount:eur(1000),status:'priced'});"
new="if(state.mountingStyle==='truss')lines.push({id:'truss',label:'Floor-supported projector truss',amount:eur(1000),status:'priced'});else lines.push({id:'ceiling-mounts',label:'Projector ceiling mounts',amount:eur(300),status:'priced'});"
if old not in s: raise SystemExit('V22 ceiling mount price anchor missing')
s=s.replace(old,new,1)
p.write_text(s)

# ---------- Optics: user-selected planning range overrides sample-model lens bounds ----------
p=Path('projection/src/projection-layer.js')
s=p.read_text()
old="  const throwMin = valueAt(profile, ['throwRatio.min', 'throwRatioMin']);\n  const throwMax = valueAt(profile, ['throwRatio.max', 'throwRatioMax']);"
new="  const throwMin = instance.planningThrowRange?.[0] ?? valueAt(profile, ['throwRatio.min', 'throwRatioMin']);\n  const throwMax = instance.planningThrowRange?.[1] ?? valueAt(profile, ['throwRatio.max', 'throwRatioMax']);"
if old not in s: raise SystemExit('V22 source optics range anchor missing')
s=s.replace(old,new,1)
p.write_text(s)

# ---------- Required specification follows live throw setting ----------
p=Path('projection/src/guided-planner.js')
s=p.read_text()
old="  const targetThrow=finite(summary.requiredThrowRatio)?summary.requiredThrowRatio:currentThrow;"
new="  const targetThrow=throws.length?currentThrow:(finite(summary.requiredThrowRatio)?summary.requiredThrowRatio:null);"
if old not in s: raise SystemExit('V22 source spec throw anchor missing')
s=s.replace(old,new,1)
p.write_text(s)

# ---------- Pricing: €500/m² curved active area ----------
p=Path('projection/catalogue.json')
catalogue=json.loads(p.read_text())
catalogue['commercial']['fabrication']['screenSystemPerM2Eur']=500
p.write_text(json.dumps(catalogue,indent=2,ensure_ascii=False)+'\n')

# ---------- Styling ----------
p=Path('projection/guided.css')
s=p.read_text()+'''
/* V22 manual optical feasibility controls */
.projection-manual-sliders{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin:16px 0 20px}
.projection-manual-slider{border:1px solid #d9e0e7;border-radius:10px;padding:12px;background:#fff}
.projection-manual-slider label{display:flex;justify-content:space-between;font-weight:700;font-size:13px;margin-bottom:9px}
.projection-manual-slider input[type="range"]{width:100%}
.projection-throw-planner{border:1px solid #d9e0e7;border-left:4px solid #e11d2e;border-radius:10px;padding:16px;margin:18px 0;background:#fff}
.projection-throw-planner h3{margin:2px 0 0}
.projection-throw-scale{display:flex;justify-content:space-between;font-size:11px;color:#64748b;margin-top:-5px}
#projection-throw{width:100%}
@media(max-width:720px){.projection-manual-sliders{grid-template-columns:1fr}.projection-throw-scale span:nth-child(2),.projection-throw-scale span:nth-child(3){display:none}}
'''
p.write_text(s)

# Rebuild cleanly from source.
subprocess.run(['python3','tools/build-projection-guided.py'],check=True)
shutil.copyfile('projection-screen-configurator-preview.html','projection-screen-configurator-v22.html')

# Preserve V19 sticky price strip explicitly.
out=Path('projection-screen-configurator-v22.html')
html=out.read_text()
sticky='''<style id="projection-sticky-estimate-v19">
.led-estimate-bar{position:sticky!important;top:0!important;z-index:1000!important;background:#fff!important;box-shadow:0 8px 18px rgba(15,23,42,.08)}
</style>'''
html=html.replace('</head>',sticky+'\n</head>',1)
out.write_text(html)

# Guardrails.
html=out.read_text()
assert 'Fine tune projector position, aim &amp; optics' in html
assert 'Move forward / back' in html and 'Tilt up / down' in html and 'Roll' in html
assert 'planning range 0.30–2.10' in html
assert 'Apply this throw requirement to all projectors' in html
assert 'planningThrowRange=[.30,2.10]' in html
assert '"screenSystemPerM2Eur":500' in html
assert "label:'Projector ceiling mounts',amount:eur(300)" in html
assert "label:'Floor-supported projector truss',amount:eur(1000)" in html
assert 'projection-sticky-estimate-v19' in html
print('V22 source build passed: motion, aim, optical throw planning and current pricing')
