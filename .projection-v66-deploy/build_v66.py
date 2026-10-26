from pathlib import Path
from urllib.request import Request,urlopen
import re,subprocess

BASE="https://www.sim-worx.com"
SOURCE="projection-screen-configurator-v65.html"
TARGET=Path("projection-screen-configurator-v66.html")

req=Request(f"{BASE}/{SOURCE}",headers={"Cache-Control":"no-cache","User-Agent":"Simworx-V66-builder"})
with urlopen(req,timeout=60) as r:
    html=r.read().decode("utf-8","replace")

required=[
    "projection-v65-real-pdf-js",
    "projection-v64-hide-recalculate-strip",
    "projection-v63-clear-email-status",
    "async function emailProposal(event){",
    "proposalHtml=documentHtml();",
    "captureProposalViews",
]
missing=[x for x in required if x not in html]
if missing: raise SystemExit("V66 refused: V65 inheritance/email anchors missing "+repr(missing))

# Replace only the email transport function with the working LED-style fetch/FormData pattern.
pattern=re.compile(r"""  async function emailProposal\(event\)\{.*?\n  \}\n\n  function requestFormalQuote""",re.S)
replacement=r'''  async function emailProposal(event){
    event?.preventDefault();
    await captureProposalViews();
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

    /* LED-compatible payload:
       configuration/images are separate fields and the server builds the
       multipart/related email. Keep image data out of proposal_html. */
    const images=(proposalViews||[]).slice(0,4).map((v,i)=>({
      label:v.label||['3D perspective','Front elevation','Top plan','Side elevation'][i]||('View '+(i+1)),
      data:v.data
    }));
    images.forEach((image,i)=>{
      if(image.data)proposalHtml=proposalHtml.split(image.data).join('cid:projection-view-'+(i+1)+'@sim-worx.com');
    });

    const payload=new FormData(form);
    payload.set('email',email);
    payload.set('name',name);
    payload.set('proposal_reference',reference);
    payload.set('proposal_html',proposalHtml);
    payload.set('proposal_text',proposalText);
    payload.set('projection_images',JSON.stringify(images));
    payload.set('quote_action','email');
    payload.set('website','');

    const old=button.textContent;
    button.disabled=true;
    button.textContent='Sending…';
    status.textContent='Sending the complete proposal…';
    try{
      const response=await fetch(form.action,{
        method:'POST',
        body:payload,
        credentials:'same-origin',
        headers:{Accept:'application/json','X-Requested-With':'XMLHttpRequest'}
      });
      const reply=await response.json().catch(()=>({ok:false,message:'Your request could not be confirmed. Please try again.'}));
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

  function requestFormalQuote'''
html,count=pattern.subn(replacement,html,count=1)
if count!=1: raise SystemExit("V66 email function replacement failed: "+str(count))

checks=[
    "projection_images",
    "quote_action','email'",
    "cid:projection-view-",
    "const response=await fetch(form.action",
    "projection-v65-real-pdf-js",
]
missing=[x for x in checks if x not in html]
if missing: raise SystemExit("V66 checks failed "+repr(missing))
if "HTMLFormElement.prototype.submit.call(form)" in html:
    raise SystemExit("V66 old native-form email transport remains")

m=re.search(r'<script id="projection-v37-proposal-js">(.*?)</script>',html,re.S)
if not m: raise SystemExit("V66 proposal script missing")
Path("/tmp/v66-proposal.js").write_text(m.group(1))
subprocess.run(["node","--check","/tmp/v66-proposal.js"],check=True)

TARGET.write_text(html)
print("V66 built from V65: Projection email now follows live LED sender pattern")
