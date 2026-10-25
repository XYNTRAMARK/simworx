from pathlib import Path
from urllib.request import Request, urlopen
import subprocess

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

# Keep the original Step-4 DOM for application wiring, but insert the customer-facing
# Proposal as a separate surface and hide the legacy Step-4 UI visually.
proposal_markup='''<section id="v37-proposal" data-guided-step="4" hidden>
<div class="v37-proposal-head"><div><span class="led-step">COMMERCIAL PROPOSAL</span><h2>Projection system proposal</h2><p class="led-help">Final technical configuration and Simworx commercial estimate.</p></div><a class="led-text-link" href="#led-controls">Change configuration ↑</a></div>
<div class="v37-proposal-meta"><span id="v37-proposal-ref">Reference —</span><span id="v37-proposal-date">Date —</span><span>Validity: confirmed on formal quotation</span></div>
<div class="v37-proposal-grid">
<div style="display:grid;gap:16px">
<section class="v37-proposal-card"><h3>System specification</h3><dl class="v37-proposal-spec" id="v37-proposal-spec"></dl></section>
<section class="v37-proposal-card"><h3>Projector requirement</h3><table class="v37-projector-table"><thead><tr><th>Projector</th><th>Lens position</th><th>Aim</th><th>Throw</th></tr></thead><tbody id="v37-projector-rows"></tbody></table><p class="v37-finance-note">Projectors are customer sourced and are not included in the Simworx commercial total. Final projector/lens suitability must be confirmed with the projector supplier before purchase.</p></section>
<details class="v37-proposal-card"><summary><strong>Technical assumptions &amp; review notes</strong></summary><ul id="v37-proposal-warnings"></ul></details>
</div>
<aside class="v37-proposal-card"><h3>Commercial proposal</h3>
<span class="led-help">Quote currency</span><div class="v37-currency-buttons" id="v37-currency-buttons"><button type="button" data-currency="EUR">EUR</button><button type="button" data-currency="GBP">GBP</button><button type="button" data-currency="USD">USD</button></div>
<div class="v37-finance-grid" style="margin-top:12px"><label>Delivery destination<select id="v37-destination"><option value="spain">Spain</option><option value="eu">European Union</option><option value="uk">United Kingdom</option><option value="usa">United States</option><option value="middle-east">Middle East</option><option value="rest">Rest of world</option></select></label><label>Customer type<select id="v37-customer-type"><option value="personal">Personal</option><option value="business">Business</option></select></label><label id="v37-vat-wrap" hidden>EU VAT number<input id="v37-vat-number" maxlength="32" placeholder="e.g. FR12345678901"></label></div>
<div class="v37-proposal-lines" id="v37-price-lines"></div>
<div class="v37-total-row"><span>Estimated total before delivery</span><strong id="v37-proposal-total">—</strong></div>
<p class="v37-finance-note" id="v37-vat-note"></p>
<p class="v37-finance-note"><strong>Delivery:</strong> To be quoted for the completed screen system. Outside the EU, import duties, tariffs and local import taxes remain the customer responsibility.</p>
<div class="v37-proposal-actions"><button type="button" class="led-button v37-primary" id="v37-print-proposal">Print / save PDF</button><button type="button" class="led-button led-outline" id="v37-download-proposal">Download configuration quote</button><button type="button" class="led-button led-outline" id="v37-email-proposal">Email proposal</button><button type="button" class="led-button led-outline" id="v37-request-quote">Request formal quote</button></div>
<p class="led-action-result" id="v37-proposal-status" role="status"></p>
</aside></div></section>'''
proposal_anchor='<div class="guided-navigation">'
if proposal_anchor not in html:
    raise SystemExit("V37 guided navigation anchor missing")
html=html.replace(proposal_anchor,proposal_markup+proposal_anchor,1)

# Hide the two legacy step-4 setup sections; Proposal replaces them.
proposal_hide_css='<style id="projection-v37-hide-legacy-step4">#led-options[data-guided-step="4"],.led-custom[data-guided-step="4"],#led-review[data-guided-step="4"]{display:none!important}</style>'
html=html.replace('</head>',proposal_hide_css+'\\n</head>',1)

# Static email dialog used by the Proposal actions.
email_dialog='''<dialog id="v37-email-dialog"><div class="v37-email-body"><h3>Email proposal</h3><p class="led-help">The proposal file will download and your email application will open with the proposal summary.</p><div class="v37-email-fields"><label>Recipient email<input id="v37-email-address" type="email" required placeholder="name@example.com"></label><label>Recipient name<input id="v37-email-name" maxlength="100"></label></div><div class="v37-proposal-actions"><button type="button" class="led-button v37-primary" id="v37-email-send">Prepare email</button><button type="button" class="led-button led-outline" id="v37-email-close">Cancel</button></div><p id="v37-email-status" class="led-help"></p></div></dialog>'''
html=html.replace('</main>',email_dialog+'\\n</main>',1)

# Proposal uses the current live/manual projector state. Do not block Step 4 merely because
# manual edits mark the optimiser result dirty; only block when no layout exists at all.
proposal_guard="if(n===4&&(!s.layoutReady||s.layoutDirty)){"
if proposal_guard not in html:
    raise SystemExit("V37 Step 4 layout guard anchor missing")
html=html.replace(proposal_guard,"if(n===4&&!s.layoutReady){",1)

# Keep the shared WebGL viewer inside the V37 left column after V29 step refreshes.
owner_old="if(home.parentNode!==row)row.appendChild(home);"
owner_new="const v37Left=document.getElementById('v37-left-column');const homeTarget=v37Left||row;if(home.parentNode!==homeTarget){if(v37Left)v37Left.insertBefore(home,v37Left.firstChild||null);else row.appendChild(home);}"
if owner_old not in html:
    raise SystemExit("V37 stable-viewer owner anchor missing")
html=html.replace(owner_old,owner_new,1)

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
    const step4=document.querySelector('[data-guided-go="4"]');
    if(step4){
      step4.innerHTML='<b>4</b> Proposal';
      step4.addEventListener('click',()=>setTimeout(()=>{
        const status=q('guided-step-status');
        if(status&&document.querySelector('[data-guided-go="4"]')?.getAttribute('aria-current')==='step')status.textContent='Step 4 of 4 · Proposal';
      },40));
    }
    q('guided-next')?.addEventListener('click',()=>setTimeout(()=>{
      const status=q('guided-step-status');
      if(status&&document.querySelector('[data-guided-go="4"]')?.getAttribute('aria-current')==='step')status.textContent='Step 4 of 4 · Proposal';
    },40));
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

proposal_js=r"""<script id="projection-v37-proposal-js">
(function(){
  const q=id=>document.getElementById(id);
  let reference='';

  function snapshot(){try{return window.SimworxProjection?.snapshot?.()||null}catch(_){return null}}
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function money(value,currency){
    if(typeof value!=='number'||!Number.isFinite(value))return 'To confirm';
    try{return new Intl.NumberFormat('en-GB',{style:'currency',currency:currency,maximumFractionDigits:2}).format(value)}
    catch(_){return value.toFixed(2)+' '+currency}
  }
  function metres(v){return Number(v||0).toFixed(2)+' m'}
  function currentStep(){return Number(document.querySelector('[data-guided-go][aria-current="step"]')?.dataset?.guidedGo||1)}

  function ensureProposal(){
    const proposal=q('v37-proposal');
    if(!proposal||proposal.dataset.bound==='true')return proposal;
    proposal.dataset.bound='true';
    q('v37-currency-buttons').addEventListener('click',event=>{
      const b=event.target.closest('button[data-currency]');if(!b)return;
      const select=q('projection-currency');
      if(select){select.value=b.dataset.currency;select.dispatchEvent(new Event('change',{bubbles:true}));}
      setTimeout(refreshProposal,300);
    });
    ['v37-destination','v37-customer-type','v37-vat-number'].forEach(id=>q(id).addEventListener('input',refreshProposal));
    q('v37-print-proposal').addEventListener('click',printProposal);
    q('v37-download-proposal').addEventListener('click',downloadProposal);
    q('v37-email-proposal').addEventListener('click',()=>q('v37-email-dialog').showModal());
    q('v37-email-close').addEventListener('click',()=>q('v37-email-dialog').close());
    q('v37-email-send').addEventListener('click',emailProposal);
    q('v37-request-quote').addEventListener('click',requestFormalQuote);
    return proposal;
  }

  function financial(snap){
    const cfg=snap.configuration||{},quote=snap.quote||{},currency=cfg.currency||'EUR';
    const lines=(quote.lineItems||[]).filter(line=>!String(line.id||'').startsWith('projector-'));
    const subtotal=lines.reduce((sum,line)=>sum+(typeof line.amount==='number'&&Number.isFinite(line.amount)?line.amount:0),0);
    const destination=q('v37-destination')?.value||'spain';
    const customer=q('v37-customer-type')?.value||'personal';
    const vatNo=(q('v37-vat-number')?.value||'').trim();
    let rate=null,note='';
    if(destination==='spain'){
      rate=21; note='Spanish VAT estimate: 21%.';
    }else if(destination==='eu'){
      if(customer==='business'&&vatNo.length>=6){
        rate=0; note='0% Spanish VAT estimate for an intra-EU business supply, subject to a valid VAT number/VIES check and evidence of dispatch to another EU country.';
      }else{
        rate=null; note='EU consumer/destination VAT is confirmed from the delivery country on the formal quotation.';
      }
    }else{
      rate=0; note='0% Spanish VAT estimate for export, subject to export evidence. Destination duties and local import taxes are not included.';
    }
    const tax=rate===null?null:subtotal*rate/100;
    const total=tax===null?null:subtotal+tax;
    return {currency,lines,subtotal,rate,tax,total,destination,customer,vatNo,note};
  }

  function specRows(snap){
    const cfg=snap.configuration||{},projectors=cfg.projectors||[];
    const area=(Number(cfg.diameter||0)/2)*(Number(cfg.horizontalFov||0)*Math.PI/180)*Number(cfg.viewableHeight||0);
    const throws=projectors.map(p=>Number(p.throwRatio)).filter(Number.isFinite);
    const lensHeight=projectors[0]?.position?.[1];
    const room=cfg.room||{};
    return [
      ['Screen system','Curved projection screen & frame'],
      ['Screen diameter / arc',metres(cfg.diameter)+' / '+Number(cfg.horizontalFov||0).toFixed(0)+'°'],
      ['Viewable height / floor clearance',metres(cfg.viewableHeight)+' / '+metres(cfg.screenBottom)],
      ['Active curved screen area',Number.isFinite(area)?area.toFixed(2)+' m²':'—'],
      ['Room',metres(room.width)+' W × '+metres(room.depth)+' D × '+metres(room.height)+' H'],
      ['Cockpit',q('led-simulatorType')?.selectedOptions?.[0]?.textContent?.trim()||cfg.simulatorType||'Configured cockpit'],
      ['Projector quantity',String(projectors.length)],
      ['Required throw ratio',throws.length?Math.min(...throws).toFixed(3):'—'],
      ['Lens height',Number.isFinite(lensHeight)?metres(lensHeight):'—'],
      ['Ceiling mount drop',Number.isFinite(room.height)&&Number.isFinite(lensHeight)?metres(Math.max(0,room.height-lensHeight)):'—'],
      ['Mounting method',cfg.mountingStyle==='truss'?'Floor-supported truss':'Ceiling mounts'],
      ['Coverage / shadow',(q('projection-coverage-metric')?.textContent||'—')+' / '+(q('projection-shadow-metric')?.textContent||'—')],
      ['Warping / calibration',(snap.quote?.lineItems||[]).find(l=>l.id==='warping')?.label||'Configured package'],
      ['Project notes',cfg.notes||'None supplied']
    ];
  }

  function projectorRows(snap){
    return (snap.configuration?.projectors||[]).map(p=>{
      const pos=(p.position||[]).map(v=>Number(v).toFixed(2)+' m').join(' / ');
      const aim=[p.yaw,p.pitch,p.roll].map(v=>Number(v||0).toFixed(1)+'°').join(' / ');
      return '<tr><td>'+esc(p.id)+'</td><td>'+esc(pos)+'</td><td>'+esc(aim)+'</td><td>'+esc(Number(p.throwRatio||0).toFixed(3))+'</td></tr>';
    }).join('');
  }

  function warningItems(){
    return Array.from(q('projection-review-flags')?.querySelectorAll('li')||[]).map(li=>li.textContent.trim()).filter(Boolean);
  }

  function refreshProposal(){
    const proposal=ensureProposal();if(!proposal)return;
    const step=currentStep();
    proposal.hidden=step!==4;
    const stepButton=document.querySelector('[data-guided-go="4"]');
    if(stepButton)stepButton.innerHTML='<b>4</b> Proposal';
    if(step===3&&q('guided-next')&&!q('guided-next').hidden)q('guided-next').textContent='Continue to proposal';
    if(step===4&&q('guided-step-status'))q('guided-step-status').textContent='Step 4 of 4 · Proposal';
    if(step!==4)return;
    const snap=snapshot();if(!snap)return;
    const quote=snap.quote||{};
    if(!reference)reference=quote.reference||('SWX-PROJ-'+new Date().toISOString().slice(0,10).replaceAll('-',''));
    q('v37-proposal-ref').textContent='Reference: '+reference;
    q('v37-proposal-date').textContent='Date: '+new Date(quote.date||Date.now()).toLocaleDateString('en-GB');
    q('v37-proposal-spec').innerHTML=specRows(snap).map(row=>'<div><dt>'+esc(row[0])+'</dt><dd>'+esc(row[1])+'</dd></div>').join('');
    q('v37-projector-rows').innerHTML=projectorRows(snap);
    const warnings=warningItems();
    q('v37-proposal-warnings').innerHTML=(warnings.length?warnings:['No additional technical notes.']).map(w=>'<li>'+esc(w)+'</li>').join('');

    const fin=financial(snap);
    q('v37-currency-buttons').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.currency===fin.currency)));
    q('v37-vat-wrap').hidden=!(fin.destination==='eu'&&fin.customer==='business');

    q('v37-price-lines').innerHTML=
      fin.lines.map(line=>'<div><span>'+esc(line.label)+(line.status==='included'?' <small>· included</small>':'')+'</span><strong>'+esc(line.status==='included'?'Included':money(line.amount,fin.currency))+'</strong></div>').join('')+
      '<div><span>Matched projectors <small>· customer sourced</small></span><strong>Excluded</strong></div>'+
      '<div><span>Product subtotal excluding VAT</span><strong>'+esc(money(fin.subtotal,fin.currency))+'</strong></div>'+
      '<div><span>VAT'+(fin.rate===null?'':fin.rate===0?' · 0%':' · '+fin.rate+'%')+'</span><strong>'+esc(fin.tax===null?'To confirm':money(fin.tax,fin.currency))+'</strong></div>'+
      '<div><span>Delivery</span><strong>To be quoted</strong></div>';
    q('v37-proposal-total').textContent=fin.total===null?'To confirm':money(fin.total,fin.currency)+' + delivery';
    q('v37-vat-note').textContent=fin.note;
  }

  function plainText(){
    const snap=snapshot();if(!snap)return '';
    const fin=financial(snap);
    const specs=specRows(snap).map(row=>row[0]+': '+row[1]).join('\\n');
    const projectors=(snap.configuration?.projectors||[]).map(p=>p.id+': '+(p.position||[]).map(v=>Number(v).toFixed(2)+' m').join(' / ')+' · throw '+Number(p.throwRatio||0).toFixed(3)).join('\\n');
    const prices=fin.lines.map(l=>l.label+': '+(l.status==='included'?'Included':money(l.amount,fin.currency))).join('\\n');
    return 'SIMWORX PROJECTION SYSTEM PROPOSAL\\nReference: '+reference+'\\n\\nSPECIFICATION\\n'+specs+'\\n\\nPROJECTOR REQUIREMENT\\n'+projectors+'\\nProjectors: customer sourced / excluded from Simworx price\\n\\nCOMMERCIAL PROPOSAL\\n'+prices+'\\nProduct subtotal excluding VAT: '+money(fin.subtotal,fin.currency)+'\\nVAT: '+(fin.tax===null?'To confirm':money(fin.tax,fin.currency))+'\\nDelivery: To be quoted\\nEstimated total before delivery: '+(fin.total===null?'To confirm':money(fin.total,fin.currency))+'\\n\\n'+fin.note+'\\nFinal projector/lens suitability must be verified with the projector supplier before purchase.';
  }

  function documentHtml(){
    const snap=snapshot(),fin=financial(snap);
    return '<!doctype html><html><head><meta charset="utf-8"><title>Simworx Projection Proposal '+esc(reference)+'</title><style>body{font:14px Arial;max-width:980px;margin:36px auto;color:#17202a}h1{font-size:28px}h2{margin-top:28px}table{width:100%;border-collapse:collapse}th,td{padding:9px;border-bottom:1px solid #ddd;text-align:left}.money{text-align:right}.total{font-size:18px;font-weight:bold}.note{font-size:12px;color:#59636e}</style></head><body>'+
      '<h1>Simworx Projection System Proposal</h1><p>'+esc(reference)+' · '+new Date(snap.quote?.date||Date.now()).toLocaleDateString('en-GB')+'<br>Validity confirmed on formal quotation</p>'+
      '<h2>System specification</h2><table>'+specRows(snap).map(row=>'<tr><th>'+esc(row[0])+'</th><td>'+esc(row[1])+'</td></tr>').join('')+'</table>'+
      '<h2>Projector requirement</h2><table><tr><th>Projector</th><th>Lens X/Y/Z</th><th>Yaw/Pitch/Roll</th><th>Throw</th></tr>'+projectorRows(snap)+'</table><p class="note">Projectors are customer sourced and excluded from the Simworx total. Verify final projector/lens suitability with the projector supplier.</p>'+
      '<h2>Commercial proposal</h2><table>'+fin.lines.map(l=>'<tr><td>'+esc(l.label)+'</td><td class="money">'+esc(l.status==='included'?'Included':money(l.amount,fin.currency))+'</td></tr>').join('')+'<tr><td>Matched projectors · customer sourced</td><td class="money">Excluded</td></tr><tr><th>Product subtotal excluding VAT</th><td class="money">'+esc(money(fin.subtotal,fin.currency))+'</td></tr><tr><th>VAT</th><td class="money">'+esc(fin.tax===null?'To confirm':money(fin.tax,fin.currency))+'</td></tr><tr><th>Delivery</th><td class="money">To be quoted</td></tr><tr class="total"><th>Estimated total before delivery</th><td class="money">'+esc(fin.total===null?'To confirm':money(fin.total,fin.currency))+'</td></tr></table>'+
      '<p class="note">'+esc(fin.note)+' Outside the EU, import duties, tariffs and local import taxes remain the customer responsibility.</p>'+
      '</body></html>';
  }

  function downloadProposal(){
    const url=URL.createObjectURL(new Blob([documentHtml()],{type:'text/html'}));
    const a=document.createElement('a');a.href=url;a.download='Simworx_Projection_Proposal_'+reference+'.html';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    q('v37-proposal-status').textContent='Configuration quote downloaded.';
  }
  function printProposal(){
    const w=window.open('','simworxProjectionProposal','popup=yes,width=1000,height=800,resizable=yes,scrollbars=yes');
    if(!w){q('v37-proposal-status').textContent='Popup blocked. Use Download configuration quote instead.';return}
    w.document.open();w.document.write(documentHtml());w.document.close();w.focus();setTimeout(()=>w.print(),250);
  }
  function emailProposal(){
    const email=(q('v37-email-address').value||'').trim();
    if(!q('v37-email-address').reportValidity())return;
    downloadProposal();
    const name=(q('v37-email-name').value||'').trim();
    const body=(name?'Hello '+name+',\\n\\n':'')+plainText();
    q('v37-email-status').textContent='Proposal downloaded. Opening your email application with the proposal summary.';
    window.location.href='mailto:'+encodeURIComponent(email)+'?subject='+encodeURIComponent('Simworx projection proposal '+reference)+'&body='+encodeURIComponent(body);
  }
  function requestFormalQuote(){
    window.location.href='mailto:info@sim-worx.com?subject='+encodeURIComponent('Formal quote request · '+reference)+'&body='+encodeURIComponent(plainText()+'\\n\\nPlease confirm final pricing, delivery and tax treatment.');
    q('v37-proposal-status').textContent='Formal quote request prepared for info@sim-worx.com.';
  }

  const timer=setInterval(()=>{if(ensureProposal()){clearInterval(timer);refreshProposal();}},50);
  new MutationObserver(refreshProposal).observe(document.documentElement,{subtree:true,attributes:true,attributeFilter:['aria-current']});
  document.querySelectorAll('[data-guided-go]').forEach(button=>button.addEventListener('click',()=>setTimeout(refreshProposal,30)));
  q('guided-next')?.addEventListener('click',()=>setTimeout(refreshProposal,30));
  q('guided-back')?.addEventListener('click',()=>setTimeout(refreshProposal,30));
  setInterval(()=>{if(currentStep()===4)refreshProposal();},500);
  document.addEventListener('change',event=>{if(event.target?.id==='projection-currency')setTimeout(refreshProposal,300)});
})();
</script>"""
html=html.replace("</body>",proposal_js+"\\n</body>",1)
# Fail the build immediately if the customer-facing Proposal JavaScript is invalid.
proposal_source=proposal_js[proposal_js.index(">")+1:proposal_js.rindex("</script>")]
Path("/tmp/v37-proposal.js").write_text(proposal_source)
subprocess.run(["node","--check","/tmp/v37-proposal.js"],check=True)


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
    "projection-v37-proposal",
    "projection-v37-proposal-js",
    "Projection system proposal",
    "Download configuration quote",
    "Request formal quote",
    "Projectors are customer sourced",
]
missing=[x for x in checks if x not in html]
if missing:
    raise SystemExit("V37 feature/inheritance check failed "+repr(missing))

TARGET.write_text(html)
print("V37 built from published V36 with Step 3 whitespace optimisation")
