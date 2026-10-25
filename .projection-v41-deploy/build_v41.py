from pathlib import Path
from urllib.request import Request, urlopen

BASE_URL="https://www.sim-worx.com"
SOURCE="projection-screen-configurator-v40.html"
TARGET=Path("projection-screen-configurator-v41.html")

req=Request(f"{BASE_URL}/{SOURCE}",headers={"Cache-Control":"no-cache","User-Agent":"Simworx-V41-builder"})
with urlopen(req,timeout=45) as r:
    html=r.read().decode("utf-8")

required=[
    "projection-v40-fixed-wizard",
    "projection-v39-performance",
    "projection-v39-vat",
    "projection-v38-commercial",
    "projection-v37-proposal",
    "projection-v34-height-control",
    "projection-v33-optimisation",
    "projection-v31-enhancements",
    "projection-v30-direct-controls",
]
missing=[x for x in required if x not in html]
if missing:
    raise SystemExit("V41 refused: V40 inheritance missing "+repr(missing))

css="""<style id="projection-v41-projector-priority">
#v41-projector-compact{
  border:1px solid #d9e0e7;
  border-radius:8px;
  background:#fff;
  padding:8px 10px;
  display:grid;
  gap:6px;
}
#v41-projector-compact > .v30-section,
#v41-projector-compact > #v31-projector-count{
  border:0!important;
  border-radius:0!important;
  padding:0!important;
  margin:0!important;
  background:transparent!important;
  display:grid!important;
  grid-template-columns:104px minmax(0,1fr)!important;
  gap:8px!important;
  align-items:center!important;
}
#v41-projector-compact > .v30-section > strong,
#v41-projector-compact > #v31-projector-count > strong{
  margin:0!important;
  font-size:11px!important;
  line-height:1.15!important;
  color:#334155!important;
}
#v41-projector-compact .v31-count-buttons,
#v41-projector-compact .v30-projector-selector{
  margin:0!important;
  gap:5px!important;
}
#v41-projector-compact .v31-count-buttons{
  grid-template-columns:repeat(2,minmax(0,1fr))!important;
}
#v41-projector-compact .v30-projector-selector{
  grid-template-columns:repeat(3,minmax(0,1fr))!important;
}
#v41-projector-compact .v31-count-buttons button,
#v41-projector-compact .v30-projector-selector button{
  min-height:30px!important;
  height:30px!important;
  padding:2px 7px!important;
  font-size:11px!important;
  line-height:1!important;
  border-radius:5px!important;
}
#v41-throw-section{
  order:2!important;
  padding:10px 12px!important;
}
#v41-throw-section .v30-throw-head strong{font-size:16px!important}
#v41-throw-section #v30-throw{margin:7px 0 4px!important}
#v41-throw-section .v30-mode-help{margin-top:6px!important}
#projection-v30-control-surface{gap:10px!important}
@media(max-width:420px){
  #v41-projector-compact > .v30-section,
  #v41-projector-compact > #v31-projector-count{
    grid-template-columns:90px minmax(0,1fr)!important;
  }
}
</style>"""
html=html.replace("</head>",css+"\n</head>",1)

js=r"""<script id="projection-v41-projector-priority-js">
(function(){
  const q=id=>document.getElementById(id);

  function install(){
    const surface=q('projection-v30-control-surface');
    const count=q('v31-projector-count');
    const selector=q('v30-projector-selector')?.closest('.v30-section');
    const throwSection=q('v30-throw')?.closest('.v30-section');
    if(!surface||!count||!selector||!throwSection)return false;
    if(q('v41-projector-compact'))return true;

    const compact=document.createElement('section');
    compact.id='v41-projector-compact';
    compact.setAttribute('aria-label','Projector quantity and selection');

    // Reuse the real controls so no event handlers or state logic are duplicated.
    const head=surface.querySelector('.v30-head');
    if(head)head.insertAdjacentElement('afterend',compact);
    else surface.insertBefore(compact,surface.firstChild);

    compact.appendChild(count);
    compact.appendChild(selector);

    throwSection.id='v41-throw-section';
    compact.insertAdjacentElement('afterend',throwSection);

    // Shorten only the visible labels; IDs/buttons/event handlers stay untouched.
    const countTitle=count.querySelector(':scope > strong');
    if(countTitle)countTitle.textContent='How many?';
    const selectTitle=selector.querySelector(':scope > strong');
    if(selectTitle)selectTitle.textContent='Select';

    return true;
  }

  const timer=setInterval(()=>{if(install())clearInterval(timer);},40);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);
  else install();
})();
</script>"""
body_close=html.rfind("</body>")
if body_close<0:
    raise SystemExit("V41 final body close missing")
html=html[:body_close]+js+"\n"+html[body_close:]

checks=[
    "projection-v41-projector-priority",
    "projection-v41-projector-priority-js",
    "v41-projector-compact",
    "v41-throw-section",
    "How many?",
    "Select",
    "min-height:30px",
    "projection-v40-fixed-wizard",
    "projection-v39-performance",
    "projection-v39-vat",
]
missing=[x for x in checks if x not in html]
if missing:
    raise SystemExit("V41 feature/inheritance check failed "+repr(missing))

TARGET.write_text(html)
print("V41 built from published V40 with compact projector controls and throw prioritised")
