from pathlib import Path
from urllib.request import Request, urlopen

BASE_URL="https://www.sim-worx.com"
SOURCE="projection-screen-configurator-v39.html"
TARGET=Path("projection-screen-configurator-v40.html")

req=Request(f"{BASE_URL}/{SOURCE}",headers={"Cache-Control":"no-cache","User-Agent":"Simworx-V40-builder"})
with urlopen(req,timeout=45) as r:
    html=r.read().decode("utf-8")

required=[
    "projection-v39-vat",
    "projection-v39-performance",
    "projection-v38-commercial",
    "projection-v37-proposal",
    "projection-v35-count-lock",
    "projection-v34-height-control",
    "projection-fixed-estimate-v24",
]
missing=[x for x in required if x not in html]
if missing:
    raise SystemExit("V40 refused: V39 inheritance missing "+repr(missing))

# Wrap the existing wizard step strip + status line as one permanent header.
old="""<nav class="guided-steps" id="guided-steps" aria-label="Projection setup steps">"""
start=html.find(old)
if start<0:
    raise SystemExit("V40 guided steps anchor missing")
status_end_marker='<p id="guided-step-status" class="guided-step-status" role="status"></p>'
status_end=html.find(status_end_marker,start)
if status_end<0:
    raise SystemExit("V40 guided status anchor missing")
status_end+=len(status_end_marker)

segment=html[start:status_end]
if 'id="v40-guided-header"' in segment:
    raise SystemExit("V40 guided header already present")
wrapped='<div id="v40-guided-header">'+segment+'</div>'
html=html[:start]+wrapped+html[status_end:]

css="""<style id="projection-v40-fixed-wizard">
:root{--v40-estimate-h:100px;--v40-guide-h:76px}
#v40-guided-header{
  position:fixed!important;
  top:var(--v40-estimate-h)!important;
  left:0!important;
  right:0!important;
  width:100%!important;
  z-index:9990!important;
  background:#fff!important;
  box-shadow:0 4px 12px rgba(15,23,42,.09)!important;
  box-sizing:border-box!important;
  padding:8px 4px 5px!important;
  margin:0!important;
}
#v40-guided-header #guided-steps{margin:0!important}
#v40-guided-header #guided-step-status{
  margin:7px 0 0!important;
  padding:0 4px!important;
  min-height:15px!important;
}
#projection-app{
  padding-top:calc(var(--v40-estimate-h) + var(--v40-guide-h) + 18px)!important;
}
@media(max-width:720px){
  #v40-guided-header{padding:6px 4px 4px!important}
  #projection-app{padding-top:calc(var(--v40-estimate-h) + var(--v40-guide-h) + 12px)!important}
}
</style>"""
html=html.replace("</head>",css+"\n</head>",1)

js=r"""<script id="projection-v40-fixed-wizard-js">
(function(){
  const root=document.documentElement;
  const estimate=document.querySelector('.led-estimate-bar');
  const guide=document.getElementById('v40-guided-header');
  if(!estimate||!guide)return;

  function syncFixedHeader(){
    const estimateHeight=Math.ceil(estimate.getBoundingClientRect().height);
    const guideHeight=Math.ceil(guide.getBoundingClientRect().height);
    root.style.setProperty('--v40-estimate-h',estimateHeight+'px');
    root.style.setProperty('--v40-guide-h',guideHeight+'px');
  }

  const resizeObserver=new ResizeObserver(syncFixedHeader);
  resizeObserver.observe(estimate);
  resizeObserver.observe(guide);
  window.addEventListener('resize',syncFixedHeader,{passive:true});
  document.fonts?.ready?.then(syncFixedHeader).catch(()=>{});
  requestAnimationFrame(()=>requestAnimationFrame(syncFixedHeader));
})();
</script>"""
body_close=html.rfind("</body>")
if body_close<0:
    raise SystemExit("V40 final body close missing")
html=html[:body_close]+js+"\n"+html[body_close:]

checks=[
    'id="v40-guided-header"',
    "projection-v40-fixed-wizard",
    "projection-v40-fixed-wizard-js",
    "top:var(--v40-estimate-h)",
    "padding-top:calc(var(--v40-estimate-h) + var(--v40-guide-h)",
    "ResizeObserver",
    'id="guided-steps"',
    'id="guided-step-status"',
    "projection-v39-vat",
    "projection-v39-performance",
]
missing=[x for x in checks if x not in html]
if missing:
    raise SystemExit("V40 feature/inheritance check failed "+repr(missing))

TARGET.write_text(html)
print("V40 built from published V39 with permanent wizard header")
