from pathlib import Path
from urllib.request import Request,urlopen
import re,subprocess

BASE="https://www.sim-worx.com"
SOURCE="projection-screen-configurator-v61.html"
TARGET=Path("projection-screen-configurator-v62.html")

req=Request(f"{BASE}/{SOURCE}",headers={"Cache-Control":"no-cache","User-Agent":"Simworx-V62-builder"})
with urlopen(req,timeout=60) as r:
    html=r.read().decode("utf-8","replace")

required=[
    "const limit=650000",
    "projection-v60-throw-scale",
    "projection-v59-hide-material-choice",
    "projection-v58-compact-price-bar",
    "async function emailProposal(event){",
    "const response=await fetch(form.action",
]
missing=[x for x in required if x not in html]
if missing: raise SystemExit("V62 refused: V61 inheritance/email transport anchors missing "+repr(missing))

old=r'''    try{
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
    }'''

new=r'''    try{
      /* V62: submit the existing protected form through a hidden same-origin iframe.
         This avoids the browser/request-layer fetch parser that was returning
         INVALID_JSON before the PHP endpoint could process the proposal. */
      const frame=document.createElement('iframe');
      frame.name='projection-email-submit-'+Date.now();
      frame.hidden=true;
      frame.setAttribute('aria-hidden','true');
      document.body.appendChild(frame);

      const hidden=[];
      const add=(name,value)=>{
        const input=document.createElement('input');
        input.type='hidden';input.name=name;input.value=value;
        form.appendChild(input);hidden.push(input);
      };
      add('proposal_reference',reference);
      add('proposal_html',proposalHtml);
      add('proposal_text',proposalText);
      if(!form.querySelector('[name="website"]'))add('website','');

      const previousTarget=form.getAttribute('target');
      const previousMethod=form.getAttribute('method');
      const previousEnctype=form.getAttribute('enctype');
      form.target=frame.name;
      form.method='post';
      form.enctype='multipart/form-data';

      const reply=await new Promise((resolve,reject)=>{
        let submitted=false;
        const timer=setTimeout(()=>reject(new Error('The proposal server did not respond. Please try again.')),20000);
        frame.addEventListener('load',()=>{
          if(!submitted)return;
          clearTimeout(timer);
          try{
            const text=(frame.contentDocument?.body?.textContent||'').trim();
            const data=JSON.parse(text);
            resolve(data);
          }catch(error){
            reject(new Error('The proposal server returned an unexpected response.'));
          }
        });
        submitted=true;
        HTMLFormElement.prototype.submit.call(form);
      });

      if(!reply?.ok)throw new Error(reply?.message||'Unable to send the proposal.');
      status.textContent='Proposal '+(reply.reference||reference)+' sent successfully to '+email+'.';
      status.classList.add('v48-success');
      q('v37-proposal-status').textContent='Proposal sent successfully to '+email+'.';
      setTimeout(()=>q('v37-email-dialog').close(),700);

      if(previousTarget===null)form.removeAttribute('target');else form.setAttribute('target',previousTarget);
      if(previousMethod===null)form.removeAttribute('method');else form.setAttribute('method',previousMethod);
      if(previousEnctype===null)form.removeAttribute('enctype');else form.setAttribute('enctype',previousEnctype);
      hidden.forEach(input=>input.remove());
      frame.remove();
    }catch(error){
      status.textContent=error.message||'Unable to send the proposal. Please email info@sim-worx.com.';
      status.classList.add('v48-error');
    }finally{
      button.disabled=false;
      button.textContent=old;
      form.dispatchEvent(new Event('simworx:submission-complete'));
    }'''

if old not in html: raise SystemExit("V62 fetch transport block not found")
html=html.replace(old,new,1)

checks=[
    "HTMLFormElement.prototype.submit.call(form)",
    "projection-email-submit-",
    "multipart/form-data",
    "const limit=650000",
    "projection-v60-throw-scale",
]
missing=[x for x in checks if x not in html]
if missing: raise SystemExit("V62 checks failed "+repr(missing))
if "const response=await fetch(form.action" in html: raise SystemExit("V62 old fetch transport remains")

m=re.search(r'<script id="projection-v37-proposal-js">(.*?)</script>',html,re.S)
if not m: raise SystemExit("V62 proposal script missing")
Path("/tmp/v62-proposal.js").write_text(m.group(1))
subprocess.run(["node","--check","/tmp/v62-proposal.js"],check=True)

TARGET.write_text(html)
print("V62 built from V61: proposal email uses native protected form POST instead of fetch")
