from pathlib import Path
from urllib.request import Request,urlopen
import re,subprocess

BASE="https://www.sim-worx.com"
SOURCE="projection-screen-configurator-v55.html"
TARGET=Path("projection-screen-configurator-v56.html")

req=Request(f"{BASE}/{SOURCE}",headers={"Cache-Control":"no-cache","User-Agent":"Simworx-V56-builder"})
with urlopen(req,timeout=60) as r:
    html=r.read().decode("utf-8","replace")

required=[
    "projection-v55-vat-selection",
    "projection-v54-step3-reversible-js",
    "projection-v53-two-column-step3",
    "projection-v52-proposal-views",
    'id="projection-v25-controls"',
]
missing=[x for x in required if x not in html]
if missing: raise SystemExit("V56 refused: V55 inheritance/control anchors missing "+repr(missing))

css=r"""<style id="projection-v56-restore-projector-controls">
/* V56 regression repair only:
   keep the existing Step-3 two-column layout and restore the existing
   projector controls beneath the viewer in the RIGHT column. */
.led-workbench.v53-step3 #projection-v25-controls{
  display:block!important;
  width:100%!important;
  min-width:0!important;
  margin:14px 0 0!important;
  padding:14px!important;
  box-sizing:border-box!important;
}
.led-workbench.v53-step3 #projection-v25-controls #projection-v30-control-surface{
  display:grid!important;
}
/* Projector controls belong only to the right-hand preview, never the left stack. */
.led-workbench.v53-step3 #v53-left-stack #projection-v25-controls{
  display:none!important;
}
</style>"""
html=html.replace("</head>",css+"\n</head>",1)

js=r"""<script id="projection-v56-restore-projector-controls-js">
(function(){
  const q=id=>document.getElementById(id);
  const panel=q('projection-v25-controls');
  const preview=q('led-preview');
  if(!panel||!preview)return;

  const original={
    parent:panel.parentNode,
    next:panel.nextSibling,
    hidden:panel.hidden
  };

  function step(){
    return Number(document.querySelector('[data-guided-go][aria-current="step"]')?.dataset?.guidedGo||1);
  }

  function restore(){
    if(!original.parent)return;
    if(original.next&&original.next.parentNode===original.parent)original.parent.insertBefore(panel,original.next);
    else original.parent.appendChild(panel);
    panel.hidden=original.hidden;
  }

  function placeRight(){
    const tabs=preview.querySelector('.projection-view-tabs');
    const toolbar=preview.querySelector('.led-viewer-toolbar');
    const anchor=tabs||toolbar;
    if(anchor){
      if(anchor.nextSibling)preview.insertBefore(panel,anchor.nextSibling);
      else preview.appendChild(panel);
    }else{
      preview.appendChild(panel);
    }
    panel.hidden=false;
  }

  function sync(){
    if(step()===3){
      /* Run after V53/V54 ownership logic so this is the final Step-3 placement. */
      setTimeout(()=>{
        placeRight();
        window.dispatchEvent(new Event('resize'));
      },220);
    }else{
      restore();
    }
  }

  let timer;
  function schedule(){clearTimeout(timer);timer=setTimeout(sync,180);}
  new MutationObserver(records=>{
    if(records.some(r=>r.type==='attributes'&&r.attributeName==='aria-current'))schedule();
  }).observe(document.documentElement,{subtree:true,attributes:true,attributeFilter:['aria-current']});
  document.querySelectorAll('[data-guided-go]').forEach(b=>b.addEventListener('click',schedule));

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(sync,1300));
  else setTimeout(sync,1300);
})();
</script>"""
body_close=html.rfind("</body>")
if body_close<0: raise SystemExit("V56 body close missing")
html=html[:body_close]+js+"\n"+html[body_close:]

checks=[
    "projection-v56-restore-projector-controls",
    "projection-v56-restore-projector-controls-js",
    "projection-v55-vat-selection",
    "projection-v54-step3-reversible-js",
    "projection-v52-proposal-views",
]
missing=[x for x in checks if x not in html]
if missing: raise SystemExit("V56 checks failed "+repr(missing))

m=re.search(r'<script id="projection-v56-restore-projector-controls-js">(.*?)</script>',html,re.S)
if not m: raise SystemExit("V56 script missing")
Path("/tmp/v56.js").write_text(m.group(1))
subprocess.run(["node","--check","/tmp/v56.js"],check=True)

TARGET.write_text(html)
print("V56 built from live V55: projector controls restored under right-hand viewer only")
