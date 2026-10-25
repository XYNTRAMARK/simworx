from pathlib import Path
from urllib.request import Request,urlopen
import json,re,subprocess

BASE="https://www.sim-worx.com"
SOURCE="projection-screen-configurator-v47.html"
LED="led-screen-configurator.html"
TARGET=Path("projection-screen-configurator-v48.html")

def fetch(name,agent):
    req=Request(f"{BASE}/{name}",headers={"Cache-Control":"no-cache","User-Agent":agent})
    with urlopen(req,timeout=60) as r:
        return r.read().decode("utf-8","replace")

html=fetch(SOURCE,"Simworx-V48-builder")
led=fetch(LED,"Simworx-V48-led-reference")

# Repair a V38 output-formatting typo inherited by V47. The browser-visible
# proposal used the correct helper, but documentHtml() had lost the esc(...)
# call's parentheses and therefore threw when PDF/email serialization ran.
bad_token="escproposalLineValue(l,fin.currency)"
good_token="esc(proposalLineValue(l,fin.currency))"
if bad_token not in html:
    raise SystemExit("V48 expected inherited proposal serialization typo was not found")
html=html.replace(bad_token,good_token)
if "escproposalLineValue" in html:
    raise SystemExit("V48 malformed proposal serializer token remains")

# V47 still inherited the locked-down CSP from the original standalone preview.
# It blocks Turnstile, fetch(), form submissions and shared site assets. The
# working live LED configurator does not carry this meta policy, so remove it.
html,csp_count=re.subn(
    r"<meta\s+http-equiv=[\"']Content-Security-Policy[\"'][^>]*>",
    '',
    html,
    count=1,
    flags=re.I
)
if csp_count!=1:
    raise SystemExit("V48 expected one standalone CSP meta tag, removed "+str(csp_count))

required=[
    "projection-v47-site-shell",
    "projection-v42-proposal-delivery",
    "projection-v42-turnstile-js",
    "projection-v37-proposal-js",
    "Save proposal as PDF",
    "projection-quote-submit.php",
]
missing=[x for x in required if x not in html]
if missing: raise SystemExit("V48 refused: V47 inheritance missing "+repr(missing))

# Extract the exact client anti-spam controller embedded in the live LED page's
# source bundle. It is the controller currently protecting the working LED form.
needle="const sources="
idx=led.find(needle)
if idx<0: raise SystemExit("V48 could not locate LED source bundle")
raw=led[idx+len(needle):].lstrip()
sources,consumed=json.JSONDecoder().raw_decode(raw)
anti_candidates=[
    value for value in sources.values()
    if isinstance(value,str)
    and "Loading spam protection" in value
    and "window.turnstile.render" in value
    and "form[data-antispam]" in value
]
if len(anti_candidates)!=1:
    raise SystemExit("V48 could not uniquely resolve working LED anti-spam controller: "+str(len(anti_candidates)))
anti_spam=anti_candidates[0]

# Replace the old dialog with a real protected form, matching the live LED
# anti-spam contract and keeping the same customer-facing fields.
dialog=r'''<dialog id="v37-email-dialog">
<div class="v37-email-body">
<h3>Email proposal</h3>
<p class="led-help">The complete specification and commercial proposal will be sent directly from SIMWORX.</p>
<form id="v48-email-form" action="projection-quote-submit.php" method="post" data-antispam data-antispam-action="contact" data-turnstile-size="compact" data-turnstile-sitekey="0x4AAAAAAFVc8FdwUZtXiCo_">
<div class="v37-email-fields">
<label>Recipient email<input id="v37-email-address" name="email" type="email" required maxlength="254" autocomplete="email" placeholder="name@example.com"></label>
<label>Recipient name<input id="v37-email-name" name="name" maxlength="100" autocomplete="name"></label>
</div>
<input type="hidden" name="website" value="">
<div class="v37-proposal-actions">
<button type="submit" class="led-button v37-primary" id="v37-email-send">Send proposal</button>
<button type="button" class="led-button led-outline" id="v37-email-close">Cancel</button>
</div>
<p id="v37-email-status" class="led-help" role="status" aria-live="polite"></p>
</form>
</div>
</dialog>'''
html,count=re.subn(r'<dialog\s+id=["\']v37-email-dialog["\'][^>]*>[\s\S]*?</dialog>',dialog,html,count=1,flags=re.I)
if count!=1: raise SystemExit("V48 email dialog replacement failed")

# Remove the custom V42 Turnstile implementation: V48 uses the exact shared LED
# protected-form controller instead.
html,count=re.subn(r'<script\s+id=["\']projection-v42-turnstile-js["\'][^>]*>[\s\S]*?</script>','',html,count=1,flags=re.I)
if count!=1: raise SystemExit("V48 custom Turnstile removal failed")

# Proposal dialog opener no longer needs to manually instantiate a widget.
html=html.replace(
    "q('v37-email-proposal').addEventListener('click',()=>{q('v37-email-dialog').showModal();window.__v42EnsureProjectionTurnstile?.();});",
    "q('v37-email-proposal').addEventListener('click',()=>q('v37-email-dialog').showModal());",
    1
)

# The form owns submission. The LED anti-spam listener runs first in capture
# phase, then this handler runs only after a valid Turnstile token exists.
html=html.replace(
    "q('v37-email-send').addEventListener('click',emailProposal);",
    "q('v48-email-form').addEventListener('submit',emailProposal);",
    1
)

replacement=r'''  function printProposal(){
    const status=q('v37-proposal-status');
    try{
      const target=q('projection-print-document');
      if(!target)throw new Error('print document is unavailable');
      const parsed=new DOMParser().parseFromString(documentHtml(),'text/html');
      const body=parsed.body?.innerHTML||'';
      if(!body.includes('Simworx Projection System Proposal')||!body.includes('System specification')||!body.includes('Commercial proposal')){
        throw new Error('proposal document is incomplete');
      }
      target.innerHTML=body;
      target.setAttribute('data-proposal-reference',reference||'');
      status.textContent='Proposal ready. Choose “Save as PDF” in the print dialog.';
      requestAnimationFrame(()=>setTimeout(()=>window.print(),60));
    }catch(error){
      status.textContent='The proposal could not be prepared for PDF: '+(error?.message||'unknown error')+'.';
    }
  }
  async function emailProposal(event){
    event?.preventDefault();
    const form=q('v48-email-form');
    if(!form||!form.reportValidity())return;
    const email=(q('v37-email-address').value||'').trim();
    const name=(q('v37-email-name').value||'').trim();
    const status=q('v37-email-status'),button=q('v37-email-send');
    status.classList.remove('v42-error','v42-success','v48-error','v48-success');

    const token=(form.querySelector('[name="cf-turnstile-response"]')?.value||'').trim();
    if(!token){
      status.textContent='Please complete the verification before sending the proposal.';
      status.classList.add('v48-error');
      return;
    }

    let proposalHtml='',proposalText='';
    try{
      status.textContent='Preparing the complete proposal…';
      proposalHtml=documentHtml();
      proposalText=plainText();
      if(!proposalHtml.includes('System specification')||!proposalHtml.includes('Commercial proposal')){
        throw new Error('proposal document is incomplete');
      }
    }catch(error){
      status.textContent='The proposal could not be prepared: '+(error?.message||'unknown error')+'. Please refresh the configurator and try again.';
      status.classList.add('v48-error');
      return;
    }

    const payload=new FormData(form);
    payload.set('email',email);
    payload.set('name',name);
    payload.set('proposal_reference',reference);
    payload.set('proposal_html',proposalHtml);
    payload.set('proposal_text',proposalText);
    payload.set('website','');

    const old=button.textContent;
    button.disabled=true;
    button.textContent='Sending…';
    status.textContent='Sending the complete proposal…';
    try{
      const response=await fetch(form.action,{method:'POST',body:payload,credentials:'same-origin',headers:{Accept:'application/json','X-Requested-With':'XMLHttpRequest'}});
      const reply=await response.json().catch(()=>({ok:false,message:'The server returned an unexpected response.'}));
      if(!response.ok||!reply.ok)throw new Error(reply.message||'Unable to send the proposal.');
      status.textContent='Proposal '+(reply.reference||reference)+' sent successfully to '+email+'.';
      status.classList.add('v48-success');
      q('v37-proposal-status').textContent='Proposal sent successfully to '+email+'.';
      setTimeout(()=>q('v37-email-dialog').close(),700);
    }catch(error){
      status.textContent=error.message||'Unable to send the proposal. Please email info@sim-worx.com.';
      status.classList.add('v48-error');
    }finally{
      button.disabled=false;
      button.textContent=old;
      form.dispatchEvent(new Event('simworx:submission-complete'));
    }
  }
  function requestFormalQuote(){'''

pattern=r'''  function printProposal\(\)\{[\s\S]*?  function requestFormalQuote\(\)\{'''
html,count=re.subn(pattern,replacement,html,count=1)
if count!=1: raise SystemExit("V48 PDF/email handler replacement failed")

# Ensure the old custom token API is no longer referenced.
html=html.replace("window.__v42EnsureProjectionTurnstile?.();","")
html=html.replace("window.__v42ResetProjectionTurnstile?.();","")

# Print override is deliberately more specific than the LED print rule copied
# into the shared shell. Only the generated proposal document is printed.
css=r'''<style id="projection-v48-delivery-fix">
#v42-projection-turnstile{display:none!important}
#v48-email-form .sw-form-honeypot{position:absolute!important;left:-10000px!important;width:1px!important;height:1px!important;overflow:hidden!important}
#v48-email-form .sw-form-verification{margin:12px 0;max-width:100%;overflow:hidden}
#v48-email-form .sw-form-verification-status{font-size:11px;color:#59636e;margin:6px 0}
#v37-email-status.v48-error{color:#a61b1b;font-weight:700}
#v37-email-status.v48-success{color:#16733a;font-weight:700}
@media print{
  body.led-page>*{display:none!important}
  body.led-page>#projection-print-document{display:block!important}
  #projection-print-document{
    font:10pt/1.5 Arial,sans-serif!important;
    color:#17202a!important;
    background:#fff!important;
    width:auto!important;
    max-width:none!important;
    margin:0!important;
    padding:0!important;
  }
  #projection-print-document h1{font-size:22pt!important;margin:0 0 12pt!important}
  #projection-print-document h2{font-size:14pt!important;margin:20pt 0 8pt!important}
  #projection-print-document table{width:100%!important;border-collapse:collapse!important;font-size:9pt!important}
  #projection-print-document th,#projection-print-document td{padding:7pt!important;border-bottom:1pt solid #ddd!important;text-align:left!important}
  #projection-print-document .money{text-align:right!important}
  #projection-print-document .total{font-size:12pt!important;font-weight:700!important}
  #projection-print-document .note{font-size:8.5pt!important;color:#59636e!important}
  @page{size:A4;margin:16mm}
}
</style>'''
html=html.replace("</head>",css+"\n</head>",1)

# Inject the exact working LED form protection controller.
anti_tag='<script id="projection-v48-antispam">\n'+anti_spam+'\n</script>'
body_close=html.rfind("</body>")
if body_close<0: raise SystemExit("V48 body close missing")
html=html[:body_close]+anti_tag+"\n"+html[body_close:]

checks=[
    'projection-v47-site-shell',
    'projection-v48-delivery-fix',
    'projection-v48-antispam',
    'id="v48-email-form"',
    'data-antispam-action="contact"',
    'data-turnstile-sitekey="0x4AAAAAAFVc8FdwUZtXiCo_"',
    'Loading spam protection',
    "target.innerHTML=body",
    "window.print()",
    "form.dispatchEvent(new Event('simworx:submission-complete'))",
    'projection-quote-submit.php',
    'System specification',
    'Commercial proposal',
]
missing=[x for x in checks if x not in html]
if missing: raise SystemExit("V48 delivery checks failed "+repr(missing))
if 'id="projection-v42-turnstile-js"' in html: raise SystemExit("V48 old custom Turnstile script remains")
if "frame.srcdoc=documentHtml()" in html: raise SystemExit("V48 old blank iframe print path remains")
if "escproposalLineValue" in html: raise SystemExit("V48 malformed proposal serializer token remains")
if re.search(r"<meta\s+http-equiv=[\"']Content-Security-Policy[\"']",html,re.I): raise SystemExit("V48 obsolete standalone CSP remains")

# Validate the modified customer-facing proposal JS and extracted protection JS.
for sid,out in [
    ("projection-v37-proposal-js","/tmp/v48-proposal.js"),
    ("projection-v48-antispam","/tmp/v48-antispam.js"),
]:
    m=re.search(r'<script id="'+re.escape(sid)+r'">(.*?)</script>',html,re.S)
    if not m: raise SystemExit("V48 script missing "+sid)
    Path(out).write_text(m.group(1))
    subprocess.run(["node","--check",out],check=True)

TARGET.write_text(html)
print("V48 built: native print document + exact LED protected-form email flow")
