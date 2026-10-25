from pathlib import Path
import subprocess, re

# CRITICAL: V23 is a direct child of the finished V21 artifact.
# Do not rebuild from V18/source and attempt to recreate V19-V21 changes.
subprocess.run(['python3','.projection-v21-deploy/build_v21.py'],check=True)

source=Path('projection-screen-configurator-v21.html')
target=Path('projection-screen-configurator-v23.html')
html=source.read_text()

# ---- Inheritance guardrails: V23 must contain every accepted V21 change. ----
required_v21 = [
    'projection-sticky-estimate-v19',
    'projection-hide-enclosure-options-v20',
    '"screenSystemPerM2Eur":500',
    "label:'Projector ceiling mounts',amount:eur(300)",
    "label:'Floor-supported projector truss',amount:eur(1000)",
    'id="projection-x"',
    'id="projection-y"',
    'id="projection-z"',
    'id="projection-yaw"',
    'id="projection-pitch"',
    'id="projection-roll"',
    'data-transform="translate"',
    'data-transform="rotate"',
    'id="projection-undo"',
]
missing=[x for x in required_v21 if x not in html]
if missing:
    raise SystemExit('V23 refused to build: V21 inheritance missing '+repr(missing))

# ---- Make the existing V21 manual projector controls visible by default. ----
old='<details id="guided-manual" class="projection-placement guided-manual">'
new='<details id="guided-manual" class="projection-placement guided-manual" open>'
if old not in html: raise SystemExit('V23 manual projector details anchor missing')
html=html.replace(old,new,1)

html=html.replace(
    '<summary>Advanced · adjust projector positions manually</summary>',
    '<summary>Projector position, swivel &amp; throw</summary>',1
)
html=html.replace(
    '<p class="led-help">Manual positioning is for geometry comparison only. The customer-facing specification remains brand-neutral.</p>',
    '<p class="led-help">Select a projector and move it left/right, raise/lower it, move it forward/back, then swivel it with yaw, pitch and roll. Use Move or Aim for the existing 3D handles. Adjust throw ratio to widen or narrow the beam until the room geometry works. The result remains a brand-neutral projector requirement.</p>',1
)

# ---- Convert the existing V21 throw control into a broad optical requirement. ----
old_throw='<div class="led-field"><label for="projection-throw">Optical throw ratio <span id="projection-throw-limits"></span></label><input id="projection-throw" type="range" min="0.2" max="2" step="0.001"><output id="projection-throw-value" for="projection-throw"></output></div>'
new_throw='''<section class="projection-throw-planner-v23">
<div class="led-panel-head"><div><span class="led-step">OPTICAL FIT</span><h3>Required throw ratio</h3></div><strong id="projection-throw-class" class="led-model-badge">Short throw</strong></div>
<p class="led-help">Lower throw ratio gives a wider image from the same lens-to-screen distance. Use this after physically positioning the projector to determine the optical specification the room needs.</p>
<div class="led-field"><label for="projection-throw">Throw ratio <span id="projection-throw-limits">(planning range 0.30–2.10)</span></label><input id="projection-throw" type="range" min="0.30" max="2.10" step="0.005"><output id="projection-throw-value" for="projection-throw"></output></div>
<label class="projection-check"><input type="checkbox" id="projection-throw-all" checked> Apply this throw requirement to all projectors</label>
<div class="projection-throw-scale"><span>0.30</span><span>UST / very wide</span><span>ST</span><span>Standard / zoom</span><span>2.10</span></div>
<p class="led-help"><strong>Design check:</strong> if acceptable coverage cannot be achieved within a realistic throw ratio, move the projector, cockpit or screen before committing the customer to the installation.</p>
</section>'''
if old_throw not in html: raise SystemExit('V23 V21 throw UI anchor missing')
html=html.replace(old_throw,new_throw,1)

# ---- V21 application sync: do NOT clamp throw to internal sample projector. ----
new_sync="""  const min=.30,max=2.10;
  $('projection-throw').disabled=p.locked;
  $('projection-throw').min=min;$('projection-throw').max=max;$('projection-throw').step=.005;
  $('projection-throw').value=finite(p.throwRatio)?Math.max(min,Math.min(max,p.throwRatio)):.72;
  $('projection-throw-limits').textContent='(planning range 0.30–2.10)';
  $('projection-throw-value').textContent=finite(p.throwRatio)?p.throwRatio.toFixed(3):'0.720';
  const throwClass=$('projection-throw-class');
  if(throwClass){const r=finite(p.throwRatio)?p.throwRatio:.72;throwClass.textContent=r<.45?'Ultra-short throw / very wide':r<1?'Short throw':'Standard / zoom';}"""
pattern=re.compile(r"  const min=model\?\.throwRatio\?\.min,max=model\?\.throwRatio\?\.max;\\n\s*\$\('projection-throw'\)\.disabled=.*?\$\('projection-throw-value'\)\.textContent=finite\(p\.throwRatio\)\?p\.throwRatio\.toFixed\(3\):'Unknown';",re.S)
html,count=pattern.subn(lambda m:new_sync.replace('\n','\\n'),html,count=1)
if count!=1: raise SystemExit(f'V23 V21 throw sync regex replaced {count}')

# ---- Preserve V21 event logic, but let the throw requirement apply to one/all projectors. ----
old_event="$('projection-throw').addEventListener('input',e=>{selected().throwRatio=Number(e.target.value);update();});"
new_event="$('projection-throw').addEventListener('input',e=>{const ratio=Number(e.target.value),targets=$('projection-throw-all')?.checked?state.projectors:[selected()];for(const p of targets){p.throwRatio=ratio;p.planningThrowRange=[.30,2.10];}state.manualLayout=true;update();});"
if old_event not in html: raise SystemExit('V23 V21 throw event anchor missing')
html=html.replace(old_event,new_event,1)

# ---- V21 embedded projection layer: user planning range overrides sample model limits. ----
new_limits="""  const throwMin = instance.planningThrowRange?.[0] ?? valueAt(profile, ['throwRatio.min', 'throwRatioMin']);
  const throwMax = instance.planningThrowRange?.[1] ?? valueAt(profile, ['throwRatio.max', 'throwRatioMax']);"""
pattern=re.compile(r"  const throwMin = valueAt\(profile, \['throwRatio\.min', 'throwRatioMin'\]\);\\n  const throwMax = valueAt\(profile, \['throwRatio\.max', 'throwRatioMax'\]\);")
html,count=pattern.subn(lambda m:new_limits.replace('\n','\\n'),html,count=1)
if count!=1: raise SystemExit(f'V23 V21 projection-layer throw regex replaced {count}')

# ---- Result specification follows the live manual throw requirement. ----
old_target="  const targetThrow=finite(summary.requiredThrowRatio)?summary.requiredThrowRatio:currentThrow;"
new_target="  const targetThrow=throws.length?currentThrow:(finite(summary.requiredThrowRatio)?summary.requiredThrowRatio:null);"
if old_target not in html: raise SystemExit('V23 required specification throw anchor missing')
html=html.replace(old_target,new_target,1)

# ---- Small UI styling only; all V21 CSS remains untouched. ----
css='''<style id="projection-v23-optical-controls">
.projection-throw-planner-v23{margin:18px 0;padding:16px;border:1px solid #d9e0e7;border-left:4px solid #e11d2e;border-radius:8px;background:#fff}
.projection-throw-planner-v23 h3{margin:2px 0 0}
.projection-throw-planner-v23 #projection-throw{width:100%}
.projection-throw-scale{display:flex;justify-content:space-between;gap:8px;font-size:11px;color:#64748b;margin-top:-4px}
#guided-manual[open]>summary{font-weight:800}
@media(max-width:720px){.projection-throw-scale span:nth-child(2),.projection-throw-scale span:nth-child(4){display:none}}
</style>'''
if '</head>' not in html: raise SystemExit('V23 head anchor missing')
html=html.replace('</head>',css+'\n</head>',1)

target.write_text(html)

# ---- Final inheritance + new-feature guardrails. ----
checks = required_v21 + [
    'Projector position, swivel &amp; throw',
    'id="guided-manual" class="projection-placement guided-manual" open',
    'planning range 0.30–2.10',
    'id="projection-throw-all"',
    'planningThrowRange=[.30,2.10]',
    'instance.planningThrowRange?.[0]',
    'projection-v23-optical-controls',
]
missing=[x for x in checks if x not in html]
if missing: raise SystemExit('V23 final guardrail failed '+repr(missing))
print('V23 built directly from V21 and preserved all V21 acceptance markers')
