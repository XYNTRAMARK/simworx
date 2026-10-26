from pathlib import Path
from urllib.request import Request,urlopen
import re,subprocess

BASE="https://www.sim-worx.com"
SOURCE="projection-screen-configurator-v51.html"
TARGET=Path("projection-screen-configurator-v52.html")

req=Request(f"{BASE}/{SOURCE}",headers={"Cache-Control":"no-cache","User-Agent":"Simworx-V52-builder"})
with urlopen(req,timeout=60) as r:
    html=r.read().decode("utf-8","replace")

required=[
    "projection-v51-step3-simplification",
    "projection-v50-consistent-viewer",
    "projection-v48-delivery-fix",
    "projection-v37-proposal-js",
    "Built-in screen gantry",
    "function documentHtml(){",
    "function printProposal(){",
    "async function emailProposal(event){",
]
missing=[x for x in required if x not in html]
if missing: raise SystemExit("V52 refused: live V51 inheritance/anchors missing "+repr(missing))

# Customer-facing wording only; preserve the existing addon ID, price and quote logic.
html,label_count=html.replace("Built-in screen gantry","Include Projector Mounting Frame"),html.count("Built-in screen gantry")
if label_count<2:
    raise SystemExit("V52 expected gantry wording in UI and pricing/proposal logic, found "+str(label_count))

css=r"""<style id="projection-v52-proposal-views">
#v52-proposal-views .v52-view-grid{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:10px;
}
#v52-proposal-views figure{
  margin:0;
  border:1px solid #d9e0e7;
  border-radius:6px;
  overflow:hidden;
  background:#f7f9fb;
}
#v52-proposal-views img{
  display:block;
  width:100%;
  aspect-ratio:16/10;
  object-fit:cover;
  background:#eef2f5;
}
#v52-proposal-views figcaption{
  padding:7px 9px;
  font-size:10px;
  color:#475569;
  font-weight:700;
}
#v52-proposal-views .v52-view-note{
  margin:0 0 10px;
  font-size:10.5px;
  line-height:1.45;
  color:#5b6470;
}
@media(max-width:650px){
  #v52-proposal-views .v52-view-grid{grid-template-columns:1fr}
}
</style>"""
html=html.replace("</head>",css+"\n</head>",1)

helpers=r'''
  let proposalViews=[];
  let proposalViewsBusy=null;

  function ensureProposalViewsCard(){
    let card=q('v52-proposal-views');
    if(card)return card;
    const left=q('v37-proposal')?.querySelector('.v37-proposal-grid > div');
    if(!left)return null;
    card=document.createElement('section');
    card.id='v52-proposal-views';
    card.className='v37-proposal-card';
    card.innerHTML='<h3>Configured visual system</h3><p class="v52-view-note">Reference views generated from the customer’s configured screen, cockpit and projector layout.</p><div class="v52-view-grid"></div>';
    const details=left.querySelector('details');
    if(details)left.insertBefore(card,details);else left.appendChild(card);
    return card;
  }

  function renderProposalViews(){
    const card=ensureProposalViewsCard();
    if(!card)return;
    const grid=card.querySelector('.v52-view-grid');
    if(!grid)return;
    if(!proposalViews.length){
      grid.innerHTML='<p class="led-help">Reference views are generated automatically when the proposal opens.</p>';
      return;
    }
    grid.innerHTML=proposalViews.map(v=>'<figure><img alt="'+esc(v.label)+'" src="'+v.data+'"><figcaption>'+esc(v.label)+'</figcaption></figure>').join('');
  }

  function proposalViewsHtml(){
    if(!proposalViews.length)return '';
    return '<h2>Configured visual system</h2><p class="note">Reference views generated from the configured screen, cockpit and projector layout.</p><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:10px 0 18px">'+
      proposalViews.map(v=>'<figure style="margin:0;border:1px solid #ddd;padding:0;break-inside:avoid"><img src="'+v.data+'" alt="'+esc(v.label)+'" style="display:block;width:100%;height:auto"><figcaption style="padding:6px 8px;font-size:9pt;font-weight:700">'+esc(v.label)+'</figcaption></figure>').join('')+
      '</div>';
  }

  function proposalViewerCanvas(){
    return q('led-canvas')?.querySelector('canvas')||null;
  }

  function proposalFrameDelay(){
    return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(resolve,110))));
  }

  async function captureProposalViews(force=false){
    if(proposalViews.length>=4&&!force){renderProposalViews();return proposalViews;}
    if(proposalViewsBusy)return proposalViewsBusy;
    proposalViewsBusy=(async()=>{
      const canvas=proposalViewerCanvas();
      const buttons=Array.from(document.querySelectorAll('.projection-view-tabs [data-view]'));
      if(!canvas||canvas.width<100||canvas.height<100||buttons.length<4){
        renderProposalViews();
        return proposalViews;
      }
      const original=buttons.find(b=>b.getAttribute('aria-pressed')==='true')||buttons.find(b=>b.dataset.view==='perspective');
      const wanted=[
        ['perspective','3D perspective'],
        ['front','Front elevation'],
        ['top','Top plan'],
        ['side','Side elevation'],
      ];
      const captures=[];
      for(const [view,label] of wanted){
        const button=buttons.find(b=>b.dataset.view===view);
        if(!button)continue;
        button.click();
        await proposalFrameDelay();
        try{
          const data=canvas.toDataURL('image/jpeg',0.78);
          if(data&&data.startsWith('data:image/')&&data.length>1000)captures.push({view,label,data});
        }catch(_){}
      }
      if(original){original.click();await proposalFrameDelay();}
      if(captures.length)proposalViews=captures;
      window.__projectionProposalViews=proposalViews;
      renderProposalViews();
      return proposalViews;
    })();
    try{return await proposalViewsBusy;}
    finally{proposalViewsBusy=null;}
  }
'''
anchor="  function documentHtml(){"
if anchor not in html: raise SystemExit("V52 documentHtml anchor missing")
html=html.replace(anchor,helpers+"\n"+anchor,1)

# Add the captured gallery to the printable/email HTML immediately before Commercial proposal.
old="'<h2>Commercial proposal</h2><table>'"
new="proposalViewsHtml()+'<h2>Commercial proposal</h2><table>'"
if old not in html: raise SystemExit("V52 commercial proposal HTML anchor missing")
html=html.replace(old,new,1)

# Pre-capture when Proposal opens, but do not block normal navigation.
old_refresh="    if(step!==4)return;\n    const snap=snapshot();if(!snap)return;"
new_refresh="    if(step!==4)return;\n    ensureProposalViewsCard();\n    captureProposalViews().catch(()=>{});\n    const snap=snapshot();if(!snap)return;"
if old_refresh not in html: raise SystemExit("V52 refreshProposal anchor missing")
html=html.replace(old_refresh,new_refresh,1)

# Print waits for the four clean renderer views before building the print document.
old_print="  function printProposal(){\n    const status=q('v37-proposal-status');"
new_print="  async function printProposal(){\n    await captureProposalViews();\n    const status=q('v37-proposal-status');"
if old_print not in html: raise SystemExit("V52 printProposal anchor missing")
html=html.replace(old_print,new_print,1)

# Email likewise embeds the same customer-specific views into proposal_html.
old_email="  async function emailProposal(event){\n    event?.preventDefault();"
new_email="  async function emailProposal(event){\n    event?.preventDefault();\n    await captureProposalViews();"
if old_email not in html: raise SystemExit("V52 emailProposal anchor missing")
html=html.replace(old_email,new_email,1)

checks=[
    "projection-v52-proposal-views",
    "Include Projector Mounting Frame",
    "Configured visual system",
    "3D perspective",
    "Front elevation",
    "Top plan",
    "Side elevation",
    "window.__projectionProposalViews",
    "await captureProposalViews();",
    "projection-v51-step3-simplification",
]
missing=[x for x in checks if x not in html]
if missing: raise SystemExit("V52 checks failed "+repr(missing))
if "Built-in screen gantry" in html: raise SystemExit("V52 old gantry wording remains")

m=re.search(r'<script id="projection-v37-proposal-js">(.*?)</script>',html,re.S)
if not m: raise SystemExit("V52 proposal script missing")
Path("/tmp/v52-proposal.js").write_text(m.group(1))
subprocess.run(["node","--check","/tmp/v52-proposal.js"],check=True)

TARGET.write_text(html)
print("V52 built strictly from live V51: mounting-frame wording + four proposal renderer views")
