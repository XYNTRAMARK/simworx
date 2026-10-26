from pathlib import Path
from urllib.request import Request,urlopen
import re,subprocess

BASE="https://www.sim-worx.com"
SOURCE="projection-screen-configurator-v54.html"
TARGET=Path("projection-screen-configurator-v55.html")

req=Request(f"{BASE}/{SOURCE}",headers={"Cache-Control":"no-cache","User-Agent":"Simworx-V55-builder"})
with urlopen(req,timeout=60) as r:
    html=r.read().decode("utf-8","replace")

required=[
    "projection-v54-step3-reversible-js",
    "projection-v53-two-column-step3",
    "projection-v52-proposal-views",
    'id="v39-country"',
    'id="v37-customer-type"',
    "Spanish VAT estimate",
]
missing=[x for x in required if x not in html]
if missing: raise SystemExit("V55 refused: V54 inheritance/VAT anchors missing "+repr(missing))

# 1) Require an explicit country selection.
country_pattern=re.compile(r'(<select id="v39-country">)(.*?)(</select>)',re.S)
m=country_pattern.search(html)
if not m: raise SystemExit("V55 country select missing")
options=re.sub(r'\sselected(?:="selected")?','',m.group(2),flags=re.I)
country_select=m.group(1)+'<option value="" selected>Select delivery country…</option>'+options+m.group(3)
html=html[:m.start()]+country_select+html[m.end():]

# 2) Require an explicit customer type selection.
customer_pattern=re.compile(r'(<select id="v37-customer-type">)(.*?)(</select>)',re.S)
m=customer_pattern.search(html)
if not m: raise SystemExit("V55 customer type select missing")
options=re.sub(r'\sselected(?:="selected")?','',m.group(2),flags=re.I)
customer_select=m.group(1)+'<option value="" selected>Select customer type…</option>'+options+m.group(3)
html=html[:m.start()]+customer_select+html[m.end():]

# 3) Remove implicit Spain/Personal fallbacks in proposal logic.
repls={
    "const country=q('v39-country')?.value||'ES';":"const country=q('v39-country')?.value||'';",
    "const customer=q('v37-customer-type')?.value||'personal';":"const customer=q('v37-customer-type')?.value||'';",
    "['Delivery country',q('v39-country')?.selectedOptions?.[0]?.textContent?.trim()||'Spain']":"['Delivery country',q('v39-country')?.value?(q('v39-country')?.selectedOptions?.[0]?.textContent?.trim()||'Not selected'):'Not selected']",
    "['Customer type',q('v37-customer-type')?.selectedOptions?.[0]?.textContent?.trim()||'Personal']":"['Customer type',q('v37-customer-type')?.value?(q('v37-customer-type')?.selectedOptions?.[0]?.textContent?.trim()||'Not selected'):'Not selected']",
}
for old,new in repls.items():
    if old not in html: raise SystemExit("V55 VAT fallback anchor missing: "+old[:60])
    html=html.replace(old,new,1)

# 4) No VAT treatment until both required selections are complete.
old="    if(onsite&&country!=='ES'){"
new="""    if(!country||!customer){
      rate=null;
      treatment='VAT details required';
      note='Select the delivery country and customer type to calculate the correct VAT treatment for this proposal.';
    }else if(onsite&&country!=='ES'){"""
if old not in html: raise SystemExit("V55 VAT decision anchor missing")
html=html.replace(old,new,1)

# 5) Make the required VAT inputs prominent: amber while incomplete, green when complete.
css=r"""<style id="projection-v55-vat-selection">
#v55-vat-selector{
  margin-top:12px;
  padding:12px;
  border:2px solid #f2a900;
  border-radius:8px;
  background:#fff8dc;
  transition:border-color .15s ease,background .15s ease;
}
#v55-vat-selector.v55-ready{
  border-color:#1f9d55;
  background:#edf9f1;
}
#v55-vat-selector .v55-vat-heading{
  margin:0 0 9px;
  font-size:12px;
  font-weight:850;
  color:#7a5600;
}
#v55-vat-selector.v55-ready .v55-vat-heading{color:#176b3a}
#v55-vat-selector .v37-finance-grid{margin-top:0!important}
#v39-country,#v37-customer-type{
  border:2px solid #f2a900!important;
  background:#fffdf3!important;
  font-weight:700;
}
#v55-vat-selector.v55-ready #v39-country,
#v55-vat-selector.v55-ready #v37-customer-type{
  border-color:#1f9d55!important;
  background:#f7fff9!important;
}
#v55-vat-selector.v55-incomplete #v37-vat-note{
  color:#7a5600;
  font-weight:650;
}
</style>"""
html=html.replace("</head>",css+"\n</head>",1)

# 6) Wrap the existing tax selectors without changing their internal IDs/listeners.
js=r"""<script id="projection-v55-vat-selection-js">
(function(){
  const q=id=>document.getElementById(id);
  function install(){
    const country=q('v39-country'),customer=q('v37-customer-type');
    const grid=country?.closest('.v37-finance-grid');
    if(!country||!customer||!grid)return false;
    let box=q('v55-vat-selector');
    if(!box){
      box=document.createElement('div');
      box.id='v55-vat-selector';
      box.className='v55-incomplete';
      const heading=document.createElement('p');
      heading.className='v55-vat-heading';
      heading.textContent='Complete these two fields to calculate VAT';
      grid.parentNode.insertBefore(box,grid);
      box.appendChild(heading);
      box.appendChild(grid);
    }
    const sync=()=>{
      const ready=Boolean(country.value&&customer.value);
      box.classList.toggle('v55-ready',ready);
      box.classList.toggle('v55-incomplete',!ready);
      const heading=box.querySelector('.v55-vat-heading');
      if(heading)heading.textContent=ready?'VAT details selected':'Complete these two fields to calculate VAT';
    };
    country.addEventListener('change',sync);
    customer.addEventListener('change',sync);
    sync();
    return true;
  }
  const timer=setInterval(()=>{if(install())clearInterval(timer)},50);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
</script>"""
body_close=html.rfind("</body>")
if body_close<0: raise SystemExit("V55 body close missing")
html=html[:body_close]+js+"\n"+html[body_close:]

checks=[
    "projection-v55-vat-selection",
    "projection-v55-vat-selection-js",
    "Select delivery country…",
    "Select customer type…",
    "VAT details required",
    "Complete these two fields to calculate VAT",
    "projection-v54-step3-reversible-js",
]
missing=[x for x in checks if x not in html]
if missing: raise SystemExit("V55 feature checks failed "+repr(missing))

# Guard against the two unwanted implicit defaults.
if "const country=q('v39-country')?.value||'ES';" in html: raise SystemExit("V55 Spain fallback remains")
if "const customer=q('v37-customer-type')?.value||'personal';" in html: raise SystemExit("V55 Personal fallback remains")

m=re.search(r'<script id="projection-v37-proposal-js">(.*?)</script>',html,re.S)
if not m: raise SystemExit("V55 proposal script missing")
Path("/tmp/v55-proposal.js").write_text(m.group(1))
subprocess.run(["node","--check","/tmp/v55-proposal.js"],check=True)

m=re.search(r'<script id="projection-v55-vat-selection-js">(.*?)</script>',html,re.S)
Path("/tmp/v55-vat.js").write_text(m.group(1))
subprocess.run(["node","--check","/tmp/v55-vat.js"],check=True)

TARGET.write_text(html)
print("V55 built from live V54: explicit country/customer selection required before VAT is calculated")
