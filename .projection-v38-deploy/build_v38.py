from pathlib import Path
from urllib.request import Request, urlopen
import re, subprocess

BASE_URL="https://www.sim-worx.com"
SOURCE="projection-screen-configurator-v37.html"
TARGET=Path("projection-screen-configurator-v38.html")

req=Request(f"{BASE_URL}/{SOURCE}",headers={"Cache-Control":"no-cache","User-Agent":"Simworx-V38-builder"})
with urlopen(req,timeout=45) as r:
    html=r.read().decode("utf-8")

required=[
    "projection-v37-proposal",
    "projection-v37-proposal-js",
    "projection-v37-space-optimisation",
    "projection-v37-projector-popup",
    "projection-v35-count-lock",
    "projection-v34-height-control",
    "projection-v33-optimisation",
]
missing=[x for x in required if x not in html]
if missing:
    raise SystemExit("V38 refused: V37 inheritance missing "+repr(missing))

def replace_fragment(source, old, new, label):
    if old in source:
        return source.replace(old,new,1)
    old_escaped=old.replace("\n","\\n")
    new_escaped=new.replace("\n","\\n")
    if old_escaped in source:
        return source.replace(old_escaped,new_escaped,1)
    raise SystemExit("V38 "+label+" anchor missing")

# --- Screen & frame price is now GBP-mastered. ---
old_screen="""  const screenRate=Number(commercial.fabrication?.screenSystemPerM2Eur||0);
  const screenPriceEur=d.area*screenRate;
  lines.push({id:'screen-system',label:'Curved projection screen & frame',amount:eur(screenPriceEur),status:'priced'});"""
new_screen="""  const screenRateGbp=d.area<=10?550:600;
  const screenPriceGbp=d.area*screenRateGbp;
  const screenPrice=convertCurrency(screenPriceGbp,'GBP',state.currency,catalogue.ledTariff);
  lines.push({id:'screen-system',label:'Curved projection screen & frame · '+d.area.toFixed(2)+' m² @ £'+screenRateGbp+'/m²',amount:screenPrice,status:'priced',baseGbp:screenPriceGbp,rateGbp:screenRateGbp});"""
html=replace_fragment(html,old_screen,new_screen,"GBP screen pricing")

# --- Proposal add-on UI ---
addons_markup="""<section class="v38-addons">
<h4>Optional Simworx additions</h4>
<p class="v38-screen-rate-note">Screen &amp; frame master rate: <strong>£550/m² up to 10 m²</strong>; <strong>£600/m² above 10 m²</strong>. EUR and USD values are converted from the GBP selling price.</p>
<label><input type="checkbox" id="v38-onsite"> <span><b>Onsite installation &amp; warping</b><small>£5,000 + travel expenses</small></span></label>
<label><input type="checkbox" id="v38-gantry"> <span><b>Built-in screen gantry</b><small>£1,500</small></span></label>
<label><input type="checkbox" id="v38-full-enclosure"> <span><b>Full enclosure</b><small>£5,000</small></span></label>
<label><input type="checkbox" id="v38-custom-enclosure"> <span><b>Custom enclosure</b><small>POA</small></span></label>
<label><input type="checkbox" id="v38-warranty"> <span><b>Extended 5-year screen &amp; frame warranty</b><small>5% of screen &amp; frame price</small></span></label>
<label><input type="checkbox" id="v38-crate"> <span><b>Shipping crate</b><small>£350</small></span></label>
<p class="v38-shipping-note"><strong>Shipping is quoted separately.</strong></p>
</section>"""
price_anchor='<div class="v37-proposal-lines" id="v37-price-lines"></div>'
if price_anchor not in html:
    raise SystemExit("V38 Proposal pricing anchor missing")
html=html.replace(price_anchor,addons_markup+price_anchor,1)

css="""<style id="projection-v38-commercial">
.v38-addons{margin:14px 0 4px;padding:12px;border:1px solid #d9e0e7;border-radius:8px;background:#fbfcfd}
.v38-addons h4{margin:0 0 8px;font-size:14px}
.v38-screen-rate-note,.v38-shipping-note{font-size:10.5px;line-height:1.45;color:#56616d}
.v38-addons label{display:grid;grid-template-columns:18px 1fr;gap:8px;align-items:start;padding:8px 0;border-bottom:1px solid #edf0f3;cursor:pointer}
.v38-addons label:last-of-type{border-bottom:0}
.v38-addons input{margin-top:2px;accent-color:#d52b1e}
.v38-addons span{display:grid;gap:2px}
.v38-addons b{font-size:11px}
.v38-addons small{font-size:10px;color:#64748b}
.v38-known-total-note{font-size:10px;color:#7c2d12;margin-top:5px}
</style>"""
html=html.replace("</head>",css+"\n</head>",1)

# --- Proposal logic: replace the financial function so add-ons feed every output. ---
financial_pattern=re.compile(r"""  function financial\(snap\)\{.*?    return \{currency,lines,subtotal,rate,tax,total,destination,customer,vatNo,note\};\n  \}""",re.S)
financial_new=r"""  function financial(snap){
    const cfg=snap.configuration||{},quote=snap.quote||{},currency=cfg.currency||'EUR';
    const allBase=(quote.lineItems||[]).filter(line=>!String(line.id||'').startsWith('projector-'));
    const baseLines=allBase.filter(line=>!(line.id==='warping'&&(!line.amount||line.amount===0)));
    const area=(Number(cfg.diameter||0)/2)*(Number(cfg.horizontalFov||0)*Math.PI/180)*Number(cfg.viewableHeight||0);
    const screenRateGbp=area<=10?550:600;
    const screenBaseGbp=area*screenRateGbp;
    const screenLine=baseLines.find(line=>line.id==='screen-system');
    const gbpFactor=screenBaseGbp>0&&typeof screenLine?.amount==='number'&&Number.isFinite(screenLine.amount)?screenLine.amount/screenBaseGbp:(currency==='GBP'?1:null);
    const fromGbp=value=>gbpFactor===null?null:Number(value)*gbpFactor;
    const addons=[];
    if(q('v38-onsite')?.checked){
      addons.push({id:'addon-onsite',label:'Onsite installation & warping',amount:fromGbp(5000),status:'priced',baseGbp:5000});
      addons.push({id:'addon-travel',label:'Travel expenses',amount:null,status:'quoted',display:'To be quoted'});
    }
    if(q('v38-gantry')?.checked)addons.push({id:'addon-gantry',label:'Built-in screen gantry',amount:fromGbp(1500),status:'priced',baseGbp:1500});
    if(q('v38-full-enclosure')?.checked)addons.push({id:'addon-full-enclosure',label:'Full enclosure',amount:fromGbp(5000),status:'priced',baseGbp:5000});
    if(q('v38-custom-enclosure')?.checked)addons.push({id:'addon-custom-enclosure',label:'Custom enclosure',amount:null,status:'poa',display:'POA'});
    if(q('v38-warranty')?.checked)addons.push({id:'addon-warranty',label:'Extended 5-year screen & frame warranty · 5%',amount:fromGbp(screenBaseGbp*.05),status:'priced',baseGbp:screenBaseGbp*.05});
    if(q('v38-crate')?.checked)addons.push({id:'addon-crate',label:'Shipping crate',amount:fromGbp(350),status:'priced',baseGbp:350});
    const lines=[...baseLines,...addons];
    const subtotal=lines.reduce((sum,line)=>sum+(typeof line.amount==='number'&&Number.isFinite(line.amount)?line.amount:0),0);
    const unknown=lines.filter(line=>!(typeof line.amount==='number'&&Number.isFinite(line.amount))&&line.display).map(line=>line.label);
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
    return {currency,lines,subtotal,rate,tax,total,destination,customer,vatNo,note,unknown,screenRateGbp,screenBaseGbp};
  }
  function proposalLineValue(line,currency){
    if(line.display)return line.display;
    if(line.status==='included')return 'Included';
    return money(line.amount,currency);
  }"""
html,count=financial_pattern.subn(financial_new,html,count=1)
if count!=1:
    raise SystemExit("V38 Proposal financial function replaced "+str(count))

# Replace display formatting in screen, text, and document outputs.
html=html.replace(
"esc(line.status==='included'?'Included':money(line.amount,fin.currency))",
"esc(proposalLineValue(line,fin.currency))"
)
html=html.replace(
"(l.status==='included'?'Included':money(l.amount,fin.currency))",
"proposalLineValue(l,fin.currency)"
)
html=html.replace(
"esc(l.status==='included'?'Included':money(l.amount,fin.currency))",
"esc(proposalLineValue(l,fin.currency))"
)

# Total should be transparent when selected add-ons still require a separate quote.
old_total="q('v37-proposal-total').textContent=fin.total===null?'To confirm':money(fin.total,fin.currency)+' + delivery';"
new_total="q('v37-proposal-total').textContent=fin.total===null?'To confirm':money(fin.total,fin.currency)+(fin.unknown.length?' + quoted/POA items':'')+' + delivery';"
if old_total not in html:
    raise SystemExit("V38 Proposal total anchor missing")
html=html.replace(old_total,new_total,1)

# Plain-text and downloadable documents must also flag unpriced add-ons.
old_plain="'Estimated total before delivery: '+(fin.total===null?'To confirm':money(fin.total,fin.currency))+'\\n\\n'+fin.note"
new_plain="'Estimated total before delivery: '+(fin.total===null?'To confirm':money(fin.total,fin.currency))+(fin.unknown.length?' + quoted/POA items':'')+'\\n\\n'+fin.note"
if old_plain not in html:
    raise SystemExit("V38 plain-text total anchor missing")
html=html.replace(old_plain,new_plain,1)

old_doc="esc(fin.total===null?'To confirm':money(fin.total,fin.currency))"
new_doc="esc(fin.total===null?'To confirm':money(fin.total,fin.currency)+(fin.unknown.length?' + quoted/POA items':''))"
if old_doc not in html:
    raise SystemExit("V38 document total anchor missing")
html=html.replace(old_doc,new_doc,1)

# Wire add-on checkboxes. Full/custom enclosure are mutually exclusive.
listener_anchor="['v37-destination','v37-customer-type','v37-vat-number'].forEach(id=>q(id).addEventListener('input',refreshProposal));"
listener_new="""['v37-destination','v37-customer-type','v37-vat-number'].forEach(id=>q(id).addEventListener('input',refreshProposal));
    ['v38-onsite','v38-gantry','v38-warranty','v38-crate'].forEach(id=>q(id)?.addEventListener('change',refreshProposal));
    q('v38-full-enclosure')?.addEventListener('change',event=>{if(event.target.checked&&q('v38-custom-enclosure'))q('v38-custom-enclosure').checked=false;refreshProposal();});
    q('v38-custom-enclosure')?.addEventListener('change',event=>{if(event.target.checked&&q('v38-full-enclosure'))q('v38-full-enclosure').checked=false;refreshProposal();});"""
if listener_anchor not in html:
    raise SystemExit("V38 add-on listener anchor missing")
html=html.replace(listener_anchor,listener_new,1)

checks=[
    "screenRateGbp=d.area<=10?550:600",
    "convertCurrency(screenPriceGbp,'GBP',state.currency",
    "£550/m² up to 10 m²",
    "£600/m² above 10 m²",
    "Onsite installation &amp; warping",
    "Built-in screen gantry",
    "Full enclosure",
    "Custom enclosure",
    "Extended 5-year screen &amp; frame warranty",
    "Shipping crate",
    "Shipping is quoted separately",
    "proposalLineValue",
    "quoted/POA items",
    "projection-v37-proposal",
]
missing=[x for x in checks if x not in html]
if missing:
    raise SystemExit("V38 feature/inheritance check failed "+repr(missing))

# Browser-visible Proposal script must remain valid after edits.
m=re.search(r'<script id="projection-v37-proposal-js">(.*?)</script>',html,re.S)
if not m:
    raise SystemExit("V38 Proposal script not found")
Path("/tmp/v38-proposal.js").write_text(m.group(1))
subprocess.run(["node","--check","/tmp/v38-proposal.js"],check=True)

TARGET.write_text(html)
print("V38 built from published V37 with GBP-mastered pricing and commercial add-ons")
