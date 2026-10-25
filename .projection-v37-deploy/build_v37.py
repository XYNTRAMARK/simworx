from pathlib import Path
from urllib.request import Request, urlopen

BASE_URL="https://www.sim-worx.com"
SOURCE="projection-screen-configurator-v36.html"
TARGET=Path("projection-screen-configurator-v37.html")

req=Request(f"{BASE_URL}/{SOURCE}",headers={"Cache-Control":"no-cache","User-Agent":"Simworx-V37-builder"})
with urlopen(req,timeout=45) as r:
    html=r.read().decode("utf-8")

required=[
    "projection-v35-count-lock",
    "projection-v34-height-control",
    "projection-v33-optimisation",
    "projection-v32-single-count",
    "projection-v31-enhancements",
    "projection-v30-direct-controls",
    "projection-v29-stable-viewer-owner",
    "projection-fixed-estimate-v24",
    "Move projector",
]
missing=[x for x in required if x not in html]
if missing:
    raise SystemExit("V37 refused: V36 inheritance missing "+repr(missing))

if '<button type="button" data-guided-go="4"><b>4</b> Review</button>' not in html:
    raise SystemExit("V37 Step 4 Review nav anchor missing")
html=html.replace('<button type="button" data-guided-go="4"><b>4</b> Review</button>','<button type="button" data-guided-go="4"><b>4</b> Proposal</button>',1)
if "const names=['Room & budget','Screen & cockpit','Projectors','Review'];" not in html:
    raise SystemExit("V37 guided names anchor missing")
html=html.replace("const names=['Room & budget','Screen & cockpit','Projectors','Review'];","const names=['Room & budget','Screen & cockpit','Projectors','Proposal'];",1)


css="""<style id="projection-v37-space-optimisation">
.projection-v29-edit-row.is-step3{
  grid-template-columns:minmax(0,1.65fr) minmax(300px,360px)!important;
  gap:12px!important;
  align-items:start!important;
}
.v37-left-column{min-width:0;display:grid;gap:12px;align-content:start}
.v37-left-below{display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr);gap:12px;align-items:start}
.v37-left-below .v30-section,.v37-left-below .v31-ai-card{margin:0!important;height:100%;box-sizing:border-box}
.v37-left-below .v30-fit-grid{grid-template-columns:repeat(3,minmax(0,1fr))}
.projection-v29-edit-row.is-step3 .v37-left-column #led-canvas-home{position:static;align-self:start}
.projection-v29-edit-row.is-step3 #projection-v25-controls{align-self:start}
@media(max-width:1050px){
  .projection-v29-edit-row.is-step3{grid-template-columns:1fr!important}
  .projection-v29-edit-row.is-step3 .v37-left-column #led-canvas-home{position:static}
  .v37-left-below{grid-template-columns:1fr 1fr}
}
@media(max-width:700px){
  .v37-left-below{grid-template-columns:1fr}
}
</style>"""
html=html.replace("</head>",css+"\n</head>",1)

proposal_css="""<style id="projection-v37-proposal">
.v37-old-step4{display:none!important}
#v37-proposal{max-width:1500px;margin:0 auto 32px}
.v37-proposal-head{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;margin-bottom:16px}
.v37-proposal-head h2{margin:3px 0 6px;font-size:26px}
.v37-proposal-meta{display:flex;gap:12px;flex-wrap:wrap;font-size:11px;color:#64748b;margin-bottom:16px}
.v37-proposal-grid{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(360px,.75fr);gap:16px;align-items:start}
.v37-proposal-card{border:1px solid #d9e0e7;border-radius:8px;background:#fff;padding:16px}
.v37-proposal-card h3{margin:0 0 12px;font-size:18px}
.v37-proposal-spec{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 14px}
.v37-proposal-spec div{border-bottom:1px solid #edf0f3;padding:7px 0}
.v37-proposal-spec dt{font-size:10px;color:#64748b}
.v37-proposal-spec dd{margin:2px 0 0;font-size:13px;font-weight:750}
.v37-finance-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.v37-finance-grid label{display:grid;gap:5px;font-size:11px}
.v37-finance-grid select,.v37-finance-grid input{min-height:40px;border:1px solid #cbd5e1;border-radius:6px;padding:8px;background:#fff}
.v37-currency-buttons{display:flex;gap:7px;flex-wrap:wrap}
.v37-currency-buttons button{min-height:38px;padding:0 13px;border:1px solid #cbd5e1;background:#fff;border-radius:6px;font-weight:800}
.v37-currency-buttons button[aria-pressed="true"]{border-color:#d52b1e;background:#fff2f1;color:#991b1b}
.v37-proposal-lines{margin:12px 0 0}
.v37-proposal-lines>div,.v37-total-row{display:flex;justify-content:space-between;gap:16px;padding:7px 0;border-bottom:1px solid #edf0f3;font-size:12px}
.v37-proposal-lines small{color:#64748b}
.v37-total-row{font-size:15px;font-weight:900;border-top:2px solid #111;border-bottom:0;margin-top:8px;padding-top:12px}
.v37-finance-note{margin:10px 0 0;font-size:10.5px;line-height:1.5;color:#5b6470}
.v37-proposal-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px}
.v37-proposal-actions button{min-height:44px}
.v37-proposal-actions .v37-primary{background:#f2a900;border-color:#f2a900;color:#111}
#v37-email-dialog{max-width:560px;width:calc(100% - 30px);border:1px solid #cbd5e1;border-radius:10px;padding:0}
#v37-email-dialog::backdrop{background:rgba(15,23,42,.45)}
.v37-email-body{padding:18px}
.v37-email-fields{display:grid;gap:10px}
.v37-email-fields label{display:grid;gap:5px;font-size:11px}
.v37-email-fields input{min-height:42px;border:1px solid #cbd5e1;border-radius:6px;padding:8px}
.v37-projector-table{width:100%;border-collapse:collapse;font-size:11px}
.v37-projector-table th,.v37-projector-table td{text-align:left;padding:7px;border-bottom:1px solid #edf0f3}
@media(max-width:950px){.v37-proposal-grid{grid-template-columns:1fr}.v37-proposal-spec{grid-template-columns:1fr}.v37-finance-grid{grid-template-columns:1fr}}
@media(max-width:600px){.v37-proposal-actions{grid-template-columns:1fr}}
</style>"""
html=html.replace("</head>",proposal_css+"\n</head>",1)

popup_css="""<style id="projection-v37-projector-popup">
#v37-projector-popup-fallback{max-width:640px;width:calc(100% - 32px);border:1px solid #cbd5e1;border-radius:10px;padding:0}
#v37-projector-popup-fallback::backdrop{background:rgba(15,23,42,.45)}
#v37-projector-popup-fallback .v37-popup-body{padding:18px}
#v37-projector-popup-fallback .v37-popup-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
</style>"""
html=html.replace("</head>",popup_css+"\n</head>",1)

js=r"""<script id="projection-v37-space-optimisation-js">
(function(){
  const q=id=>document.getElementById(id);

  function install(){
    const row=q('projection-v29-edit-row');
    const home=q('led-canvas-home');
    const panel=q('projection-v25-controls');
    if(!row||!home||!panel||q('v37-left-column'))return false;

    const left=document.createElement('div');
    left.id='v37-left-column';
    left.className='v37-left-column';

    const below=document.createElement('div');
    below.id='v37-left-below';
    below.className='v37-left-below';

    row.insertBefore(left,home);
    left.appendChild(home);
    left.appendChild(below);

    const live=q('v30-coverage')?.closest('.v30-section');
    const lookup=q('v31-projector-lookup');
    if(live)below.appendChild(live);
    if(lookup)below.appendChild(lookup);

    window.dispatchEvent(new Event('resize'));
    return true;
  }

  const timer=setInterval(()=>{
    if(install())clearInterval(timer);
  },50);

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);
  else install();
})();
</script>"""
html=html.replace("</body>",js+"\n</body>",1)

popup_js=r"""<script id="projection-v37-projector-popup-js">
(function(){
  const q=id=>document.getElementById(id);

  function ensureFallback(){
    let dialog=q('v37-projector-popup-fallback');
    if(dialog)return dialog;
    dialog=document.createElement('dialog');
    dialog.id='v37-projector-popup-fallback';
    dialog.innerHTML='<div class="v37-popup-body"><h3>Projector search</h3><p>Your browser blocked the projector-results popup. The configurator has been kept open.</p><p id="v37-projector-popup-query" class="led-help"></p><div class="v37-popup-actions"><a id="v37-projector-popup-open" class="led-button led-primary" target="_blank" rel="noopener noreferrer">Open results in new tab</a><button type="button" id="v37-projector-popup-close" class="led-button led-outline">Close</button></div></div>';
    document.body.appendChild(dialog);
    q('v37-projector-popup-close').addEventListener('click',()=>dialog.close());
    return dialog;
  }

  function install(){
    const link=q('v31-projector-search');
    if(!link||link.dataset.popupBound==='true')return false;
    link.dataset.popupBound='true';
    link.removeAttribute('target');
    link.addEventListener('click',event=>{
      event.preventDefault();
      if(link.getAttribute('aria-disabled')==='true'||!link.href)return;
      const width=1100,height=780;
      const left=Math.max(0,Math.round((window.screen.width-width)/2));
      const top=Math.max(0,Math.round((window.screen.height-height)/2));
      const popup=window.open(link.href,'simworxProjectorResults','popup=yes,width='+width+',height='+height+',left='+left+',top='+top+',resizable=yes,scrollbars=yes');
      const status=q('v31-projector-search-status');
      if(popup){
        try{popup.focus();}catch(_){}
        if(status)status.textContent='Projector results opened in a separate results window. This configurator remains open.';
        return;
      }
      const dialog=ensureFallback();
      q('v37-projector-popup-query').textContent=link.dataset.searchPrompt||'The calculated projector specification is ready to search.';
      q('v37-projector-popup-open').href=link.href;
      dialog.showModal();
      if(status)status.textContent='Your browser blocked the popup; use the fallback viewing box below.';
    });
    return true;
  }

  const timer=setInterval(()=>{if(install())clearInterval(timer);},50);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
</script>"""
html=html.replace("</body>",popup_js+"\n</body>",1)

checks=[
    "projection-v37-space-optimisation",
    "projection-v37-space-optimisation-js",
    "v37-left-column",
    "v37-left-below",
    "v30-coverage",
    "v31-projector-lookup",
    "projection-v35-count-lock",
    "projection-v34-height-control",
    "Move projector",
    "projection-v37-projector-popup",
    "projection-v37-projector-popup-js",
    "simworxProjectorResults",
    "This configurator remains open.",
]
missing=[x for x in checks if x not in html]
if missing:
    raise SystemExit("V37 feature/inheritance check failed "+repr(missing))

TARGET.write_text(html)
print("V37 built from published V36 with Step 3 whitespace optimisation")
