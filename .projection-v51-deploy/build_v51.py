from pathlib import Path
from urllib.request import Request,urlopen
import re,subprocess

BASE="https://www.sim-worx.com"
SOURCE="projection-screen-configurator-v50.html"
TARGET=Path("projection-screen-configurator-v51.html")

req=Request(f"{BASE}/{SOURCE}",headers={"Cache-Control":"no-cache","User-Agent":"Simworx-V51-builder"})
with urlopen(req,timeout=60) as r:
    html=r.read().decode("utf-8","replace")

required=[
    "projection-v50-consistent-viewer",
    "projection-v49-viewer-priority",
    "projection-v48-delivery-fix",
    "projection-v37-space-optimisation",
    'id="projection-mounting-style"',
    'id="guided-mount-drop"',
    'id="guided-calculate"',
    'class="projection-overlay-controls"',
]
missing=[x for x in required if x not in html]
if missing: raise SystemExit("V51 refused: live V50 inheritance/anchors missing "+repr(missing))

css=r"""<style id="projection-v51-step3-simplification">
/* Step 3: layout planning only. Installation hardware choice is deferred. */
#projection-mounting-style{display:none!important}
#projection-mounting-style-v51-hidden{display:none!important}
.v51-hidden-mount-field{display:none!important}
#projection-mounting-note{display:none!important}

/* Preferences now occupy the useful space near the primary action. */
.guided-preferences.v51-preferences{
  margin:0 0 12px!important;
}
.guided-preferences.v51-preferences summary{
  min-height:42px;
  display:flex;
  align-items:center;
  font-weight:750;
}
#guided-calculate.v51-primary-action{
  font-size:15px!important;
  font-weight:850!important;
  min-height:48px!important;
}

/* Four visual toggles live inside the viewer instead of consuming vertical page space. */
#led-canvas-home{position:relative!important}
#v51-viewer-overlays{
  position:absolute;
  top:12px;
  right:12px;
  z-index:8;
  display:grid;
  gap:5px;
  padding:8px 10px;
  border:1px solid rgba(148,163,184,.65);
  border-radius:7px;
  background:rgba(255,255,255,.92);
  box-shadow:0 2px 8px rgba(15,23,42,.08);
  backdrop-filter:blur(3px);
  font-size:10px;
  line-height:1.2;
}
#v51-viewer-overlays label{
  display:flex;
  align-items:center;
  gap:6px;
  white-space:nowrap;
  margin:0;
}
#v51-viewer-overlays input{margin:0}
.projection-overlay-controls.v51-original-overlays{
  min-height:0!important;
  margin:0!important;
  padding:0!important;
}
.projection-overlay-controls.v51-original-overlays:has(.projection-manual-toggle[hidden]){
  display:none!important;
}
@media(max-width:700px){
  #v51-viewer-overlays{
    top:8px;
    right:8px;
    grid-template-columns:1fr 1fr;
    max-width:210px;
    font-size:9px;
  }
}
</style>"""
html=html.replace("</head>",css+"\n</head>",1)

js=r"""<script id="projection-v51-step3-simplification-js">
(function(){
  const q=id=>document.getElementById(id);

  function setCeilingDefault(){
    const select=q('projection-mounting-style');
    if(select){
      select.value='ceiling';
      select.dispatchEvent(new Event('change',{bubbles:true}));
      const field=select.closest('label');
      if(field)field.classList.add('v51-hidden-mount-field');
      select.id='projection-mounting-style-v51-hidden';
    }
    const note=q('projection-mounting-note');
    if(note)note.hidden=true;
  }

  function simplifyPreferences(){
    const details=document.querySelector('.guided-preferences');
    const button=q('guided-calculate');
    if(details&&button){
      details.classList.add('v51-preferences');
      button.parentNode.insertBefore(details,button);
    }
    const clearance=q('guided-mount-drop');
    if(clearance){
      clearance.min='0.2';
      clearance.value='0.20';
      clearance.dispatchEvent(new Event('input',{bubbles:true}));
      clearance.dispatchEvent(new Event('change',{bubbles:true}));
      const label=clearance.closest('.led-field')?.querySelector('label');
      if(label)label.textContent='Minimum projector clearance below ceiling (m)';
    }
    const summary=details?.querySelector('summary');
    if(summary)summary.textContent='Layout preferences · 20 cm ceiling clearance';
    if(button){
      button.textContent='Click To Generate Projector Profile';
      button.classList.add('v51-primary-action');
    }
  }

  function moveViewerToggles(){
    const source=document.querySelector('.projection-overlay-controls');
    const home=q('led-canvas-home');
    if(!source||!home||q('v51-viewer-overlays'))return;
    source.classList.add('v51-original-overlays');
    const box=document.createElement('div');
    box.id='v51-viewer-overlays';
    box.setAttribute('role','group');
    box.setAttribute('aria-label','Projection viewer overlays');
    const ids=['projection-coverage','projection-shadows','projection-frusta','projection-structure'];
    ids.forEach(id=>{
      const input=q(id);
      const label=input?.closest('label');
      if(label)box.appendChild(label);
    });
    home.appendChild(box);
  }

  function install(){
    setCeilingDefault();
    simplifyPreferences();
    moveViewerToggles();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,0));
  else setTimeout(install,0);
  setTimeout(install,250);
})();
</script>"""
body_close=html.rfind("</body>")
if body_close<0: raise SystemExit("V51 body close missing")
html=html[:body_close]+js+"\n"+html[body_close:]

checks=[
    "projection-v51-step3-simplification",
    "projection-v51-step3-simplification-js",
    "Click To Generate Projector Profile",
    "Layout preferences · 20 cm ceiling clearance",
    "Minimum projector clearance below ceiling (m)",
    "v51-viewer-overlays",
    "projection-v50-consistent-viewer",
]
missing=[x for x in checks if x not in html]
if missing: raise SystemExit("V51 checks failed "+repr(missing))

m=re.search(r'<script id="projection-v51-step3-simplification-js">(.*?)</script>',html,re.S)
if not m: raise SystemExit("V51 script missing")
Path("/tmp/v51.js").write_text(m.group(1))
subprocess.run(["node","--check","/tmp/v51.js"],check=True)

TARGET.write_text(html)
print("V51 built strictly from live V50: ceiling default, 20 cm preference, stronger CTA, viewer overlay toggles")
