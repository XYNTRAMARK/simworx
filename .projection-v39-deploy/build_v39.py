from pathlib import Path
from urllib.request import Request, urlopen
import re, subprocess

BASE_URL="https://www.sim-worx.com"
SOURCE="projection-screen-configurator-v38.html"
TARGET=Path("projection-screen-configurator-v39.html")

req=Request(f"{BASE_URL}/{SOURCE}",headers={"Cache-Control":"no-cache","User-Agent":"Simworx-V39-builder"})
with urlopen(req,timeout=45) as r:
    html=r.read().decode("utf-8")

required=[
    "projection-v38-commercial",
    "projection-v37-proposal",
    "projection-v37-space-optimisation",
    "projection-v35-count-lock",
    "projection-v34-height-control",
    "projection-v33-optimisation",
    "projection-v30-direct-controls",
]
missing=[x for x in required if x not in html]
if missing:
    raise SystemExit("V39 refused: V38 inheritance missing "+repr(missing))

def replace_fragment(source, old, new, label):
    if old in source:
        return source.replace(old,new,1)
    old_escaped=old.replace("\n","\\n")
    new_escaped=new.replace("\n","\\n")
    if old_escaped in source:
        return source.replace(old_escaped,new_escaped,1)
    raise SystemExit("V39 "+label+" anchor missing")

# ---------------------------------------------------------------------------
# PERFORMANCE: decouple interactive dragging from full engineering analysis.
# ---------------------------------------------------------------------------

# Add a lightweight preview animation-frame slot beside existing coarse/fine jobs.
old_vars="""  let scheduledFine = null;
  let scheduledCoarse = null;
  let lastPositions = frameOf(getState());"""
new_vars="""  let scheduledFine = null;
  let scheduledCoarse = null;
  let scheduledPreview = null;
  let dragIdleTimer = null;
  let lastPositions = frameOf(getState());"""
html=replace_fragment(html,old_vars,new_vars,"projection scheduler variables")

# Insert a preview-only beam/body update before drag handlers.
drag_anchor="""  function onDragging(event) {
    dragging = event.value;"""
preview_code="""  function previewInteraction() {
    if (destroyed) return;
    const state = getState();
    const current = viewer.context();
    syncing = true;
    const activeProjectors = state.layoutReady === true && state.guidedStep >= 3 ? state.projectors : [];
    const records = activeProjectors.map((instance, index) => {
      const profile = getProfile(instance.modelId) || {};
      bodyFor(instance, profile, index);
      return opticalRecord(instance, profile);
    });
    syncing = false;
    drawFrusta(records, state, lastResult);
    select(state.selectedProjector, false);
    current.invalidate();
  }

  function onDragging(event) {
    dragging = event.value;"""
html=replace_fragment(html,drag_anchor,preview_code,"interactive preview insertion")

old_drag="""    if (dragging) {
      clearTimeout(scheduledFine);
      dragStart = frameOf(getState());
      previousControlsEnabled = viewer.context().controls.enabled;
      viewer.context().controls.enabled = false;
    } else {
      viewer.context().controls.enabled = previousControlsEnabled && !viewer.context().pilotMode;
      if (dragStart && stateKey(dragStart) !== stateKey(frameOf(getState()))) remember(dragStart);
      dragStart = null;
      emitTransform(true);
      if (scheduledCoarse !== null) {
        cancelAnimationFrame(scheduledCoarse);
        scheduledCoarse = null;
      }
      clearTimeout(scheduledFine);
      scheduledFine = setTimeout(() => update({ fine: true }), 70);
    }"""
new_drag="""    if (dragging) {
      clearTimeout(scheduledFine);
      clearTimeout(dragIdleTimer);
      dragStart = frameOf(getState());
      previousControlsEnabled = viewer.context().controls.enabled;
      viewer.context().controls.enabled = false;
      if (overlay) overlayMaterial.opacity = Math.min(overlayMaterial.opacity, 0.28);
    } else {
      viewer.context().controls.enabled = previousControlsEnabled && !viewer.context().pilotMode;
      if (dragStart && stateKey(dragStart) !== stateKey(frameOf(getState()))) remember(dragStart);
      dragStart = null;
      clearTimeout(dragIdleTimer);
      if (scheduledPreview !== null) {
        cancelAnimationFrame(scheduledPreview);
        scheduledPreview = null;
      }
      emitTransform(true);
      if (scheduledCoarse !== null) {
        cancelAnimationFrame(scheduledCoarse);
        scheduledCoarse = null;
      }
      update();
    }"""
html=replace_fragment(html,old_drag,new_drag,"drag lifecycle")

old_object="""  function onObjectChange() {
    if (syncing) return;
    // The owner writes the patch immediately. Coalesce high-frequency pointer
    // events into one coarse physical-coverage calculation per rendered frame.
    emitTransform(false);
    if (scheduledCoarse === null) {
      scheduledCoarse = requestAnimationFrame(() => {
        scheduledCoarse = null;
        update();
      });
    }
  }"""
new_object="""  function onObjectChange() {
    if (syncing) return;
    // Interactive manipulation is preview-first: update the live projector state
    // and beam every animation frame, but defer the engineering shadow/coverage
    // calculation until the pointer pauses or is released.
    emitTransform(false);
    if (scheduledPreview === null) {
      scheduledPreview = requestAnimationFrame(() => {
        scheduledPreview = null;
        previewInteraction();
      });
    }
    clearTimeout(dragIdleTimer);
    dragIdleTimer = setTimeout(() => {
      if (dragging) update();
    }, 180);
  }"""
if old_object not in html and old_object.replace("\n","\\n") not in html:
    for marker in ["function onObjectChange()","emitTransform(false);","scheduledCoarse"]:
        idx=html.find(marker)
        if idx<0: idx=html.find(marker.replace("\n","\\n"))
        print("V39 DEBUG",marker,idx,html[max(0,idx-1200):idx+3200] if idx>=0 else "missing")
html=replace_fragment(html,old_object,new_object,"object change")

# Cancel the new timers on destroy.
old_destroy="""    clearTimeout(scheduledFine);
    if (scheduledCoarse !== null) cancelAnimationFrame(scheduledCoarse);"""
new_destroy="""    clearTimeout(scheduledFine);
    clearTimeout(dragIdleTimer);
    if (scheduledCoarse !== null) cancelAnimationFrame(scheduledCoarse);
    if (scheduledPreview !== null) cancelAnimationFrame(scheduledPreview);"""
html=replace_fragment(html,old_destroy,new_destroy,"destroy cleanup")

# Expose previewInteraction to the app so throw can use it without recalculating shadows.
old_return="""    update, select, planningContext, testObstruction:obstruction,"""
new_return="""    update, previewInteraction, select, planningContext, testObstruction:obstruction,"""
html=replace_fragment(html,old_return,new_return,"projection layer public API")

# Do not sync the whole UI / proposal / quote on every transform-control pointer event.
old_move_tail="""  if(!initialising){guided?.changed();syncInputs();queueQuote();}
}"""
new_move_tail="""  if(!initialising&&finished){guided?.changed();syncInputs();queueQuote();}
}"""
html=replace_fragment(html,old_move_tail,new_move_tail,"onMove commit-only UI sync")

# Add a dedicated throw debounce variable.
old_app_vars="let catalogue,reference,state,viewer,layer,eyeControls,quote=null,result=null,unit='metric',pilotSeat='primary',pilotMode=false,quoteTimer,quoteSerial=0,fineTimer;"
new_app_vars="let catalogue,reference,state,viewer,layer,eyeControls,quote=null,result=null,unit='metric',pilotSeat='primary',pilotMode=false,quoteTimer,quoteSerial=0,fineTimer,interactiveThrowTimer;"
html=replace_fragment(html,old_app_vars,new_app_vars,"app interactive throw timer")

# Throw: beam updates immediately; engineering catches up after a short pause.
old_throw="$('projection-throw').addEventListener('input',e=>{const ratio=Number(e.target.value),targets=state.projectors;for(const p of targets){p.throwRatio=ratio;p.planningThrowRange=[.30,2.10];}const all=$('projection-throw-all');if(all)all.checked=true;state.manualLayout=true;guided?.changed();layer?.update();syncInputs();queueQuote();});"
new_throw="$('projection-throw').addEventListener('input',e=>{const ratio=Number(e.target.value),targets=state.projectors;for(const p of targets){p.throwRatio=ratio;p.planningThrowRange=[.30,2.10];}const all=$('projection-throw-all');if(all)all.checked=true;state.manualLayout=true;layer?.previewInteraction?.();clearTimeout(interactiveThrowTimer);interactiveThrowTimer=setTimeout(()=>{guided?.changed();layer?.update();syncInputs();queueQuote();},180);});"
if old_throw not in html:
    raise SystemExit("V39 global throw anchor missing")
html=html.replace(old_throw,new_throw,1)

perf_css="""<style id="projection-v39-performance">
#v39-engineering-status{font-size:10px;color:#64748b;margin:5px 0 0}
</style>"""
html=html.replace("</head>",perf_css+"\n</head>",1)

# ---------------------------------------------------------------------------
# VAT: country + customer type + VAT-number aware proposal treatment.
# ---------------------------------------------------------------------------

# Replace broad delivery destination selector with country-specific selector.
old_destination='<label>Delivery destination<select id="v37-destination"><option value="spain">Spain</option><option value="eu">European Union</option><option value="uk">United Kingdom</option><option value="usa">United States</option><option value="middle-east">Middle East</option><option value="rest">Rest of world</option></select></label>'
country_options=[
("ES","Spain — mainland & Balearic Islands"),
("AT","Austria"),("BE","Belgium"),("BG","Bulgaria"),("HR","Croatia"),("CY","Cyprus"),("CZ","Czechia"),("DK","Denmark"),
("EE","Estonia"),("FI","Finland"),("FR","France"),("DE","Germany"),("GR","Greece"),("HU","Hungary"),("IE","Ireland"),
("IT","Italy"),("LV","Latvia"),("LT","Lithuania"),("LU","Luxembourg"),("MT","Malta"),("NL","Netherlands"),("PL","Poland"),
("PT","Portugal"),("RO","Romania"),("SK","Slovakia"),("SI","Slovenia"),("SE","Sweden"),
("MC","Monaco"),
("ES-CN","Spain — Canary Islands"),("ES-CE","Spain — Ceuta"),("ES-ML","Spain — Melilla"),
("GB","United Kingdom"),("US","United States"),("CA","Canada"),("CH","Switzerland"),("NO","Norway"),
("AE","United Arab Emirates"),("SA","Saudi Arabia"),("QA","Qatar"),("AU","Australia"),("NZ","New Zealand"),
("JP","Japan"),("SG","Singapore"),("KR","South Korea"),("IN","India"),("ZA","South Africa"),("TR","Türkiye"),
("MA","Morocco"),("MX","Mexico"),("BR","Brazil"),("OTHER","Other non-EU country")
]
opts=''.join('<option value="'+code+'">'+name+'</option>' for code,name in country_options)
new_destination='<label>Delivery country<select id="v39-country">'+opts+'</select></label>'
if old_destination not in html:
    raise SystemExit("V39 Proposal destination selector anchor missing")
html=html.replace(old_destination,new_destination,1)

# Add VIES helper under the VAT number field.
old_vat='<label id="v37-vat-wrap" hidden>EU VAT number<input id="v37-vat-number" maxlength="32" placeholder="e.g. FR12345678901"></label>'
new_vat='<label id="v37-vat-wrap" hidden>EU VAT number<input id="v37-vat-number" maxlength="32" placeholder="e.g. FR12345678901"><a class="led-text-link" id="v39-vies-link" href="https://ec.europa.eu/taxation_customs/vies/" target="_blank" rel="noopener noreferrer">Validate in VIES ↗</a></label>'
if old_vat not in html:
    raise SystemExit("V39 VAT number field anchor missing")
html=html.replace(old_vat,new_vat,1)

vat_css="""<style id="projection-v39-vat">
#v39-vies-link{font-size:10px}
.v39-vat-treatment{margin-top:8px;padding:9px;border-radius:6px;background:#f8fafc;font-size:10.5px;line-height:1.45;color:#475569}
</style>"""
html=html.replace("</head>",vat_css+"\n</head>",1)

# Add EU standard rates / names to Proposal script.
proposal_marker="let reference='';"
vat_constants=r"""let reference='';
  const v39EuVat={AT:20,BE:21,BG:20,HR:25,CY:19,CZ:21,DK:25,EE:24,FI:25.5,FR:20,DE:19,GR:24,HU:27,IE:23,IT:22,LV:21,LT:21,LU:17,MT:18,NL:21,PL:23,PT:23,RO:21,SK:23,SI:22,SE:25,MC:20};
  const v39CountryNames={ES:'Spain — mainland & Balearic Islands',AT:'Austria',BE:'Belgium',BG:'Bulgaria',HR:'Croatia',CY:'Cyprus',CZ:'Czechia',DK:'Denmark',EE:'Estonia',FI:'Finland',FR:'France',DE:'Germany',GR:'Greece',HU:'Hungary',IE:'Ireland',IT:'Italy',LV:'Latvia',LT:'Lithuania',LU:'Luxembourg',MT:'Malta',NL:'Netherlands',PL:'Poland',PT:'Portugal',RO:'Romania',SK:'Slovakia',SI:'Slovenia',SE:'Sweden',MC:'Monaco','ES-CN':'Spain — Canary Islands','ES-CE':'Spain — Ceuta','ES-ML':'Spain — Melilla',GB:'United Kingdom',US:'United States',CA:'Canada',CH:'Switzerland',NO:'Norway',AE:'United Arab Emirates',SA:'Saudi Arabia',QA:'Qatar',AU:'Australia',NZ:'New Zealand',JP:'Japan',SG:'Singapore',KR:'South Korea',IN:'India',ZA:'South Africa',TR:'Türkiye',MA:'Morocco',MX:'Mexico',BR:'Brazil',OTHER:'Other non-EU country'};"""
if proposal_marker not in html:
    raise SystemExit("V39 Proposal constants anchor missing")
html=html.replace(proposal_marker,vat_constants,1)

# Replace V38 financial function with country-aware VAT treatment while preserving add-ons.
financial_pattern=re.compile(r"""  function financial\(snap\)\{.*?    return \{currency,lines,subtotal,rate,tax,total,destination,customer,vatNo,note,unknown,screenRateGbp,screenBaseGbp\};\n  \}""",re.S)
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
    const onsite=q('v38-onsite')?.checked===true;
    if(onsite){
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
    const country=q('v39-country')?.value||'ES';
    const countryName=v39CountryNames[country]||country;
    const customer=q('v37-customer-type')?.value||'personal';
    const vatNo=(q('v37-vat-number')?.value||'').trim();
    const euLike=Object.prototype.hasOwnProperty.call(v39EuVat,country);
    const specialExport=['ES-CN','ES-CE','ES-ML'].includes(country);
    let rate=null,note='',treatment='',requiresVatNumber=false;
    if(onsite&&country!=='ES'){
      rate=null;
      treatment='Supply with installation / assembly — formal tax confirmation required';
      note='Onsite installation is selected. Goods installed or assembled by or on behalf of the supplier can be taxable where installation takes place. The formal quote will confirm local VAT/registration or reverse-charge treatment before invoicing.';
    }else if(country==='ES'){
      rate=21;
      treatment='Spanish domestic supply';
      note='Spanish VAT estimate: 21% for mainland Spain and the Balearic Islands.';
    }else if(specialExport){
      rate=0;
      treatment='Outside EU VAT territory';
      note=country==='ES-CN'?'0% Spanish VAT export estimate. Canary Islands IGIC and any local import/clearance charges are not included.':'0% Spanish VAT export estimate. Local IPSI and any import/clearance charges are not included.';
    }else if(euLike){
      if(customer==='business'){
        requiresVatNumber=True if False else false;
        if(vatNo.length>=6){
          rate=0;
          treatment='Intra-EU B2B supply — provisional 0%';
          requiresVatNumber=true;
          note='Provisional 0% intra-EU supply. The VAT number must be validated in VIES and dispatch to the destination Member State must be evidenced before zero-rating.';
        }else{
          rate=21;
          treatment='EU business without validated VAT number';
          requiresVatNumber=true;
          note='Spanish 21% VAT estimate because no valid EU VAT number has been supplied. A validated VAT number and qualifying intra-EU dispatch may change the formal quote to 0%.';
        }
      }else{
        rate=v39EuVat[country];
        treatment='EU consumer distance sale — destination VAT estimate';
        note=countryName+' standard VAT estimate: '+rate+'%. This assumes destination-VAT/OSS rules apply; the formal quote confirms whether the EUR 10,000 small-seller exception affects the transaction.';
      }
    }else{
      rate=0;
      treatment='Export outside EU VAT territory';
      note='0% Spanish VAT export estimate, subject to export evidence. Import VAT, customs duties, tariffs and local taxes in '+countryName+' are not included.';
    }
    const tax=rate===null?null:subtotal*rate/100;
    const total=tax===null?null:subtotal+tax;
    return {currency,lines,subtotal,rate,tax,total,country,countryName,customer,vatNo,note,treatment,requiresVatNumber,unknown,screenRateGbp,screenBaseGbp,onsite};
  }"""
# Remove accidental Python-esque token after construction.
financial_new=financial_new.replace("        requiresVatNumber=True if False else false;\n","")
html,count=financial_pattern.subn(financial_new,html,count=1)
if count!=1:
    raise SystemExit("V39 Proposal financial function replaced "+str(count))

# Proposal binding now listens to country instead of broad destination.
html=html.replace("['v37-destination','v37-customer-type','v37-vat-number']","['v39-country','v37-customer-type','v37-vat-number']")

# VAT number visibility follows country/business treatment.
old_vat_visibility="q('v37-vat-wrap').hidden=!(fin.destination==='eu'&&fin.customer==='business');"
new_vat_visibility="q('v37-vat-wrap').hidden=!fin.requiresVatNumber;"
if old_vat_visibility not in html:
    raise SystemExit("V39 VAT visibility anchor missing")
html=html.replace(old_vat_visibility,new_vat_visibility,1)

# Add the country/treatment to the financial note.
old_note="q('v37-vat-note').textContent=fin.note;"
new_note="q('v37-vat-note').innerHTML='<strong>'+esc(fin.countryName)+' · '+esc(fin.treatment)+'</strong><br>'+esc(fin.note);"
if old_note not in html:
    raise SystemExit("V39 VAT note anchor missing")
html=html.replace(old_note,new_note,1)

# Add country/tax treatment to downloaded/email specification.
old_project_notes="['Project notes',cfg.notes||'None supplied']"
new_project_notes="['Delivery country',q('v39-country')?.selectedOptions?.[0]?.textContent?.trim()||'Spain'],['Customer type',q('v37-customer-type')?.selectedOptions?.[0]?.textContent?.trim()||'Personal'],['Project notes',cfg.notes||'None supplied']"
if old_project_notes not in html:
    raise SystemExit("V39 Proposal spec rows anchor missing")
html=html.replace(old_project_notes,new_project_notes,1)

checks=[
    "previewInteraction()",
    "scheduledPreview = requestAnimationFrame",
    "dragIdleTimer = setTimeout",
    "if(!initialising&&finished)",
    "interactiveThrowTimer",
    "layer?.previewInteraction?.()",
    "projection-v39-vat",
    "id=\"v39-country\"",
    "v39EuVat={AT:20",
    "EE:24",
    "FI:25.5",
    "RO:21",
    "SK:23",
    "onsite&&country!=='ES'",
    "installed or assembled",
    "VIES",
    "EUR 10,000",
    "Canary Islands IGIC",
]
missing=[x for x in checks if x not in html]
if missing:
    raise SystemExit("V39 feature/inheritance check failed "+repr(missing))

# Validate all major injected scripts as the browser will see them.
for script_id in ["projection-v37-proposal-js","projection-v30-direct-controls-js"]:
    m=re.search(r'<script id="'+re.escape(script_id)+r'">(.*?)</script>',html,re.S)
    if m:
        path=Path("/tmp/"+script_id+".js")
        path.write_text(m.group(1))
        subprocess.run(["node","--check",str(path)],check=True)

TARGET.write_text(html)
print("V39 built from published V38 with deferred engineering interaction and country-aware VAT")
