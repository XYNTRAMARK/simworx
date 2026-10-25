from pathlib import Path
from urllib.request import Request, urlopen
import re, subprocess

BASE_URL="https://www.sim-worx.com"
SOURCE="projection-screen-configurator-v41.html"
TARGET=Path("projection-screen-configurator-v42.html")

req=Request(f"{BASE_URL}/{SOURCE}",headers={"Cache-Control":"no-cache","User-Agent":"Simworx-V42-builder"})
with urlopen(req,timeout=45) as r:
    html=r.read().decode("utf-8")

required=[
    "projection-v41-projector-priority",
    "projection-v40-fixed-wizard",
    "projection-v39-performance",
    "projection-v39-vat",
    "projection-v38-commercial",
    "projection-v37-proposal",
]
missing=[x for x in required if x not in html]
if missing:
    raise SystemExit("V42 refused: V41 inheritance missing "+repr(missing))

# One customer-facing document: specification + commercial proposal.
html=html.replace('>Print / save PDF<','>Save proposal as PDF<',1)
html=html.replace('>Download configuration quote<','>Download configuration quote<',1)
html=html.replace(
    'The proposal file will download and your email application will open with the proposal summary.',
    'The complete specification and commercial proposal will be sent directly from SIMWORX.',
    1
)
html=html.replace('id="v37-email-send">Prepare email<','id="v37-email-send">Send proposal<',1)

# Hide the redundant HTML-download action. Keep the element in the DOM so inherited
# binding code remains safe; the supported customer document action is PDF/print.
css=r"""<style id="projection-v42-proposal-delivery">
#v37-download-proposal{display:none!important}
#v42-projection-turnstile{min-height:68px;margin:8px 0 2px}
#v37-email-status.v42-error{color:#a61b1b;font-weight:700}
#v37-email-status.v42-success{color:#16733a;font-weight:700}
</style>"""
html=html.replace("</head>",css+"\n</head>",1)

# Make opening the email dialog initialise the same Turnstile protection used by LED.
old_open="q('v37-email-proposal').addEventListener('click',()=>q('v37-email-dialog').showModal());"
new_open="q('v37-email-proposal').addEventListener('click',()=>{q('v37-email-dialog').showModal();window.__v42EnsureProjectionTurnstile?.();});"
if old_open not in html:
    raise SystemExit("V42 email opener anchor missing")
html=html.replace(old_open,new_open,1)

# Replace the old download/mailto implementation while staying inside the original
# proposal closure so documentHtml(), plainText(), reference and snapshot remain canonical.
pattern=r"""  function downloadProposal\(\)\{.*?  function requestFormalQuote\(\)\{"""
replacement=r"""  function downloadProposal(){ printProposal(); }
  function printProposal(){
    const status=q('v37-proposal-status');
    let frame=q('v42-print-frame');
    if(frame)frame.remove();
    frame=document.createElement('iframe');
    frame.id='v42-print-frame';
    frame.setAttribute('title','Projection proposal print document');
    frame.style.position='fixed';frame.style.right='0';frame.style.bottom='0';
    frame.style.width='1px';frame.style.height='1px';frame.style.opacity='0';
    frame.style.pointerEvents='none';frame.style.border='0';
    frame.onload=()=>{
      setTimeout(()=>{
        try{
          frame.contentWindow.focus();
          frame.contentWindow.print();
          if(status)status.textContent='Proposal ready. Choose “Save as PDF” in the print dialog.';
        }catch(_){
          if(status)status.textContent='The print dialog could not be opened. Please allow printing for this page and try again.';
        }
      },120);
    };
    document.body.appendChild(frame);
    frame.srcdoc=documentHtml();
  }
  async function emailProposal(){
    const email=(q('v37-email-address').value||'').trim();
    if(!q('v37-email-address').reportValidity())return;
    const name=(q('v37-email-name').value||'').trim();
    const status=q('v37-email-status'),button=q('v37-email-send');
    status.classList.remove('v42-error','v42-success');
    const token=window.__v42ProjectionTurnstileToken?.()||'';
    if(!token){
      status.textContent='Please complete the verification before sending the proposal.';
      status.classList.add('v42-error');
      window.__v42EnsureProjectionTurnstile?.();
      return;
    }
    const payload=new FormData();
    payload.set('email',email);
    payload.set('name',name);
    payload.set('proposal_reference',reference);
    payload.set('proposal_html',documentHtml());
    payload.set('proposal_text',plainText());
    payload.set('website','');
    payload.set('cf-turnstile-response',token);
    const old=button.textContent;button.disabled=true;button.textContent='Sending…';
    status.textContent='Sending the complete proposal…';
    try{
      const response=await fetch('projection-quote-submit.php',{method:'POST',body:payload,credentials:'same-origin',headers:{Accept:'application/json','X-Requested-With':'XMLHttpRequest'}});
      const reply=await response.json().catch(()=>({ok:false,message:'The server returned an unexpected response.'}));
      if(!response.ok||!reply.ok)throw new Error(reply.message||'Unable to send the proposal.');
      status.textContent='Proposal '+(reply.reference||reference)+' sent successfully to '+email+'.';
      status.classList.add('v42-success');
      q('v37-proposal-status').textContent='Proposal sent successfully to '+email+'.';
      setTimeout(()=>q('v37-email-dialog').close(),700);
    }catch(error){
      status.textContent=error.message||'Unable to send the proposal. Please email info@sim-worx.com.';
      status.classList.add('v42-error');
    }finally{
      button.disabled=false;button.textContent=old;
      window.__v42ResetProjectionTurnstile?.();
    }
  }
  function requestFormalQuote(){"""
html,count=re.subn(pattern,replacement,html,count=1,flags=re.S)
if count!=1:
    raise SystemExit("V42 proposal action replacement failed")

turnstile=r"""<script id="projection-v42-turnstile-js">
(function(){
  let widgetId=null,loading=false;
  const sitekey='0x4AAAAAAFVc8FdwUZtXiCo_';
  function holder(){
    const dialog=document.getElementById('v37-email-dialog');
    if(!dialog)return null;
    let el=document.getElementById('v42-projection-turnstile');
    if(!el){
      el=document.createElement('div');el.id='v42-projection-turnstile';
      const actions=dialog.querySelector('.v37-proposal-actions');
      actions?.insertAdjacentElement('beforebegin',el);
    }
    return el;
  }
  function render(){
    const el=holder();if(!el||!window.turnstile||widgetId!==null)return;
    try{widgetId=window.turnstile.render(el,{sitekey,action:'contact',theme:'auto',size:'compact','response-field-name':'cf-turnstile-response'});}
    catch(_){document.getElementById('v37-email-status').textContent='Verification could not load. Please retry.';}
  }
  function ensure(){
    holder();
    if(window.turnstile){render();return}
    if(loading)return;loading=true;
    window.__v42TurnstileReady=()=>{loading=false;render();};
    const s=document.createElement('script');
    s.src='https://challenges.cloudflare.com/turnstile/v0/api.js?onload=__v42TurnstileReady&render=explicit';
    s.async=true;
    s.onerror=()=>{loading=false;const st=document.getElementById('v37-email-status');if(st)st.textContent='Verification could not load. Please retry.';};
    document.head.appendChild(s);
  }
  window.__v42EnsureProjectionTurnstile=ensure;
  window.__v42ProjectionTurnstileToken=()=>widgetId!==null&&window.turnstile?window.turnstile.getResponse(widgetId):'';
  window.__v42ResetProjectionTurnstile=()=>{if(widgetId!==null&&window.turnstile)window.turnstile.reset(widgetId);};
})();
</script>"""
body_close=html.rfind("</body>")
if body_close<0: raise SystemExit("V42 final body close missing")
html=html[:body_close]+turnstile+"\n"+html[body_close:]

checks=[
    "projection-v42-proposal-delivery",
    "projection-v42-turnstile-js",
    "Save proposal as PDF",
    "Send proposal",
    "projection-quote-submit.php",
    "cf-turnstile-response",
    "__v42ProjectionTurnstileToken",
    "System specification",
    "Commercial proposal",
    "projection-v41-projector-priority",
]
missing=[x for x in checks if x not in html]
if missing:
    raise SystemExit("V42 feature/inheritance check failed "+repr(missing))

# Validate the modified proposal and Turnstile JavaScript.
for script_id,out in [
    ("projection-v37-proposal-js","/tmp/v42-proposal.js"),
    ("projection-v42-turnstile-js","/tmp/v42-turnstile.js"),
]:
    m=re.search(r'<script id="'+re.escape(script_id)+r'">(.*?)</script>',html,re.S)
    if not m: raise SystemExit("V42 script missing "+script_id)
    Path(out).write_text(m.group(1))
    subprocess.run(["node","--check",out],check=True)

TARGET.write_text(html)
print("V42 built: combined PDF proposal + protected direct email sending")
