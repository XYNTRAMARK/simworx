(() => {
  const form=document.getElementById('contact-form'); if(!form) return;
  const button=form.querySelector('.ct-submit'); const status=document.getElementById('contact-form-status');
  const show=(msg,type)=>{if(!status)return;status.textContent=msg;status.className=`ct-form-status full show ${type}`};

  // Pre-fill enquiries passed from Frames or the A320 configurator.
  const qs=new URLSearchParams(location.search);
  const interest=qs.get('interest'), platform=qs.get('platform');
  if(interest){const s=form.elements.interest; if(s){[...s.options].some(o=>{if(o.textContent.trim()===interest){s.value=o.value;return true}})}}
  const saved=sessionStorage.getItem('simworxConfiguration');
  if(platform || saved){
    const msg=form.elements.message;
    const parts=[]; if(platform) parts.push(`Platform: ${platform}`); if(saved) parts.push(saved);
    if(msg && !msg.value) msg.value=parts.join('\n\n');
    if(saved) sessionStorage.removeItem('simworxConfiguration');
  }
  if(qs.get('sent')==='1') show('Thank you. Your enquiry has been sent to SIMWORX.','success');

  let sending=false;
  form.addEventListener('submit',async e=>{
    e.preventDefault(); if(sending) return;
    if(!form.reportValidity()){show('Please complete the required fields before sending your enquiry.','error');return}
    sending=true; button.disabled=true; const original=button.textContent; button.textContent='SENDING…'; show('Sending your enquiry…','');
    try{
      const res=await fetch(form.action,{method:'POST',body:new FormData(form),headers:{'Accept':'application/json','X-Requested-With':'XMLHttpRequest'}});
      const data=await res.json().catch(()=>({ok:false,message:'The server returned an unexpected response.'}));
      if(!res.ok || !data.ok) throw new Error(data.message||'Unable to send your enquiry.');
      form.reset(); show('Thank you. Your enquiry has been sent to SIMWORX.','success');
    }catch(err){show(err.message||'Unable to send your enquiry. Please email info@sim-worx.com.','error')}
    finally{sending=false;button.disabled=false;button.textContent=original}
  });
})();
