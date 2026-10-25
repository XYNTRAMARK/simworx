from pathlib import Path
from urllib.request import Request, urlopen
import re

BASE_URL = "https://www.sim-worx.com"
SOURCE = "projection-screen-configurator-v30.html"
TARGET = Path("projection-screen-configurator-v31.html")

req = Request(f"{BASE_URL}/{SOURCE}", headers={"Cache-Control":"no-cache","User-Agent":"Simworx-V31-builder"})
with urlopen(req, timeout=45) as r:
    html = r.read().decode("utf-8")

required_v30 = [
    "projection-v30-direct-controls",
    "projection-v30-direct-controls-js",
    "projection-v29-stable-viewer-owner",
    "projection-v29-navigation-fix",
    "projection-fixed-estimate-v24",
    '"screenSystemPerM2Eur":500',
]
missing = [x for x in required_v30 if x not in html]
if missing:
    raise SystemExit("V31 refused: V30 inheritance missing " + repr(missing))

# 1) Runway preview becomes a genuine coverage-limited test image.
old_runway = "$('led-runway-view').addEventListener('change',async e=>{if(e.target.checked){state.showCoverage=false;$('projection-coverage').checked=false;}await viewer?.setRunwayVisible(e.target.checked);layer?.update();});"
new_runway = "$('led-runway-view').addEventListener('change',async e=>{const on=e.target.checked;state.runwayPreview=on;if(on){state.runwayPreviousOverlay={coverage:state.showCoverage,shadows:state.showShadows};state.showCoverage=false;state.showShadows=false;$('projection-coverage').checked=false;$('projection-shadows').checked=false;}else if(state.runwayPreviousOverlay){state.showCoverage=state.runwayPreviousOverlay.coverage!==false;state.showShadows=state.runwayPreviousOverlay.shadows!==false;$('projection-coverage').checked=state.showCoverage;$('projection-shadows').checked=state.showShadows;}await viewer?.setRunwayVisible(on);layer?.update();});"
if old_runway not in html:
    raise SystemExit("V31 runway event anchor missing")
html = html.replace(old_runway, new_runway, 1)

old_cov = "if(key==='showCoverage'&&e.target.checked){$('led-runway-view').checked=false;viewer?.setRunwayVisible(false);}"
new_cov = "if(key==='showCoverage'&&e.target.checked){state.runwayPreview=false;$('led-runway-view').checked=false;viewer?.setRunwayVisible(false);}"
if old_cov not in html:
    raise SystemExit("V31 coverage/runway exclusivity anchor missing")
html = html.replace(old_cov, new_cov, 1)

draw_new = """    mapContext.clearRect(0, 0, canvas.width, canvas.height);
    const runwayMask = state.runwayPreview === true;
    overlayMaterial.opacity = runwayMask ? 1 : 0.82;
    for (const cell of result.cells) {
      const { classification } = cell;
      const shadows = classification === 'shadow' || classification === 'partial-shadow';
      if (runwayMask) {
        const usableLight = cell.projectors.some(projector => projector.usable === true);
        if (usableLight) continue;
        const x = cell.column * tile;
        const y = (result.rows - cell.row - 1) * tile;
        mapContext.globalAlpha = 1;
        mapContext.fillStyle = '#000000';
        mapContext.fillRect(x, y, tile, tile);
        continue;
      }"""
draw_pattern = re.compile(r"    mapContext\.clearRect\(0, 0, canvas\.width, canvas\.height\);\\n    for \(const cell of result\.cells\) \{\\n      const \{ classification \} = cell;\\n      const shadows = classification === 'shadow' \|\| classification === 'partial-shadow';")
html, count = draw_pattern.subn(lambda m: draw_new.replace("\n","\\n"), html, count=1)
if count != 1:
    raise SystemExit(f"V31 bundled coverage draw anchor replaced {count}")

old_visible = "if (overlay) overlay.visible = state.showCoverage !== false || state.showShadows !== false;"
new_visible = "if (overlay) overlay.visible = state.runwayPreview === true || state.showCoverage !== false || state.showShadows !== false;"
if old_visible not in html:
    raise SystemExit("V31 overlay visibility anchor missing")
html = html.replace(old_visible, new_visible, 1)

runway_label = '<label><input type="checkbox" id="led-runway-view"> Runway preview</label>'
runway_label_new = '<label class="v31-runway-label"><input type="checkbox" id="led-runway-view"> Runway preview <small id="v31-runway-note">coverage test image</small></label>'
if runway_label not in html:
    raise SystemExit("V31 runway label anchor missing")
html = html.replace(runway_label, runway_label_new, 1)

css = """<style id="projection-v31-enhancements">
#v31-runway-note{font-size:10px;color:#64748b;margin-left:4px}
.v31-hide-original-count{display:none!important}
.v31-count-buttons{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:9px}
.v31-count-buttons button{min-height:42px;border:1px solid #bfc8d2;background:#fff;border-radius:6px;font-weight:800;cursor:pointer}
.v31-count-buttons button[aria-pressed="true"]{border-color:#d52b1e;background:#fff2f1;color:#991b1b}
.v31-ai-card{border:1px solid #d9e0e7;border-left:4px solid #e11d2e;border-radius:8px;padding:14px;background:#fff}
.v31-ai-card h4{margin:0 0 5px;font-size:16px}
.v31-ai-card p{font-size:11px;line-height:1.5;color:#475569}
.v31-ai-card .v31-disclaimer{padding:10px;border-radius:6px;background:#f8fafc;color:#27364a}
.v31-ai-card .v31-disclaimer strong{color:#991b1b}
#v31-projector-search[aria-disabled="true"]{opacity:.5;pointer-events:none}
#v31-projector-search-status{margin-top:7px}
</style>"""
html = html.replace("</head>", css + "\n</head>", 1)

js = r"""<script id="projection-v31-enhancements-js">
(function(){
  const q=id=>document.getElementById(id);
  let installed=false;

  function countValue(){return Number(q('projection-count')?.value||3);}
  function syncCount(){
    const n=countValue();
    q('v31-count-2')?.setAttribute('aria-pressed',String(n===2));
    q('v31-count-3')?.setAttribute('aria-pressed',String(n===3));
  }
  function setCount(n){
    const select=q('projection-count');
    if(!select)return;
    select.value=String(n);
    select.dispatchEvent(new Event('change',{bubbles:true}));
    setTimeout(()=>{syncCount();refreshSearch();},60);
  }

  function text(id){return (q(id)?.textContent||'').replace(/\s+/g,' ').trim();}
  function currentThrow(){
    const raw=Number(q('v30-throw')?.value||q('projection-throw')?.value||0);
    return Number.isFinite(raw)?raw:null;
  }
  function searchBrief(){
    const required=text('guided-required-spec').slice(0,900);
    const throwRatio=currentThrow();
    const count=countValue();
    const diameter=text('led-readout-diameter');
    const height=text('led-readout-height');
    const fov=text('led-readout-fov');
    return [
      'Find only 3 to 5 currently available professional projector and lens combinations for a flight-simulator curved-screen visual system.',
      'Use manufacturer or authorised-supplier specifications only. Do not invent or estimate product specifications.',
      'Projector count: '+count+'.',
      throwRatio?'Target throw ratio: approximately '+throwRatio.toFixed(3)+'. The published lens range MUST include this value.':'',
      diameter?'Curved screen diameter: '+diameter+'.':'',
      height?'Viewable screen height: '+height+'.':'',
      fov?'Screen arc: '+fov+'.':'',
      required?'Planner requirement: '+required:'',
      'Prefer professional laser installation or simulation projectors. For each candidate give manufacturer, exact projector model, exact lens model where interchangeable, published throw-ratio range, brightness basis and value, native resolution, manufacturer source link, and a short explanation of why it matches.',
      'Exclude any candidate whose documented lens range does not include the required throw ratio. Flag discontinued products clearly.'
    ].filter(Boolean).join(' ');
  }
  function refreshSearch(){
    const link=q('v31-projector-search'),status=q('v31-projector-search-status');
    if(!link)return;
    const ready=!q('guided-result')?.hidden && text('guided-required-spec').length>10;
    if(!ready){
      link.setAttribute('aria-disabled','true');
      link.removeAttribute('href');
      if(status)status.textContent='Calculate the projector requirement first; the AI search will then use the resulting specification.';
      return;
    }
    const prompt=searchBrief();
    link.href='https://www.google.com/search?udm=50&q='+encodeURIComponent(prompt);
    link.setAttribute('aria-disabled','false');
    link.dataset.searchPrompt=prompt;
    if(status)status.textContent='The AI search is restricted to 3–5 matching projector/lens combinations.';
  }

  function install(){
    if(installed)return;
    const surface=q('projection-v30-control-surface');
    if(!surface)return;
    installed=true;

    const countSelect=q('projection-count');
    const originalField=countSelect?.closest('.led-field');
    if(originalField)originalField.classList.add('v31-hide-original-count');

    const countSection=document.createElement('div');
    countSection.className='v30-section';
    countSection.id='v31-projector-count';
    countSection.innerHTML='<strong>How many projectors?</strong><div class="v31-count-buttons"><button type="button" id="v31-count-2" aria-pressed="false">2 projectors</button><button type="button" id="v31-count-3" aria-pressed="true">3 projectors</button></div>';
    const firstSection=surface.querySelector('.v30-section');
    if(firstSection)surface.insertBefore(countSection,firstSection);
    else surface.appendChild(countSection);
    q('v31-count-2').addEventListener('click',()=>setCount(2));
    q('v31-count-3').addEventListener('click',()=>setCount(3));

    const ai=document.createElement('section');
    ai.className='v31-ai-card';
    ai.id='v31-projector-lookup';
    ai.innerHTML='<h4>Find projectors with this specification</h4><p>Use the calculated geometry and throw requirement to look for a small number of real projector/lens candidates.</p><a id="v31-projector-search" class="led-button led-primary" target="_blank" rel="noopener noreferrer" aria-disabled="true">Find projectors with AI</a><p id="v31-projector-search-status"></p><p class="v31-disclaimer"><strong>This is an advice utility only.</strong> You MUST double-check your calculations with the projector supplier. Simworx does not resell projectors; however, we can select them for you. Our projector-selection service is €500.</p>';
    surface.appendChild(ai);

    q('projection-count')?.addEventListener('change',()=>setTimeout(()=>{syncCount();refreshSearch();},0));
    q('v30-throw')?.addEventListener('input',()=>setTimeout(refreshSearch,60));
    const result=q('guided-result');
    if(result)new MutationObserver(refreshSearch).observe(result,{attributes:true,subtree:true,childList:true,characterData:true});

    q('led-runway-view')?.addEventListener('change',e=>{
      const note=q('v31-runway-note');
      if(note)note.textContent=e.target.checked?'coverage-limited test image':'coverage test image';
    });

    syncCount();
    refreshSearch();
  }

  const timer=setInterval(()=>{install();if(installed)clearInterval(timer);},50);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
</script>"""
html = html.replace("</body>", js + "\n</body>", 1)

checks = [
    "state.runwayPreview=on",
    "const runwayMask = state.runwayPreview === true",
    "mapContext.fillStyle = '#000000'",
    "v31-projector-count",
    "2 projectors",
    "3 projectors",
    "v31-projector-lookup",
    "Find projectors with AI",
    "You MUST double-check your calculations with the projector supplier",
    "Our projector-selection service is €500",
    "udm=50",
    "projection-v30-direct-controls",
    "projection-v29-stable-viewer-owner",
    "projection-fixed-estimate-v24",
]
missing = [x for x in checks if x not in html]
if missing:
    raise SystemExit("V31 feature/inheritance check failed " + repr(missing))

TARGET.write_text(html)
print("V31 built from published V30")
