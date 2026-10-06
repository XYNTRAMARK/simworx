/* SIMWORX FRAMES V11 — unified sales actions + resilient ECB FX */
(()=>{
  const root=document.querySelector('[data-frame-configurator]'); if(!root) return;
  const product=root.dataset.product||'Cockpit Structure';
  const productCode=root.dataset.productCode||'';
  const inputs=[...root.querySelectorAll('input[data-item]')];
  const lines=document.getElementById('framecfg-lines');
  const count=document.getElementById('framecfg-count');
  const region=document.getElementById('framecfg-region');
  const lead=document.getElementById('framecfg-lead');
  const shipping=document.getElementById('framecfg-shipping');
  const subtotal=document.getElementById('framecfg-subtotal');
  const grand=document.getElementById('framecfg-grand');
  const previewImg=document.getElementById('framecfg-component-image');
  const previewPlaceholder=document.getElementById('framecfg-component-placeholder');
  const previewTag=document.getElementById('framecfg-component-tag');
  const previewTitle=document.getElementById('framecfg-component-preview-title');
  const previewText=document.getElementById('framecfg-component-preview-text');
  const descTitle=document.getElementById('framecfg-component-title');
  const descText=document.getElementById('framecfg-component-copy');
  const fxSource=document.getElementById('framecfg-fx-source');
  const currencyButtons=[...document.querySelectorAll('[data-currency]')];

  let currency='EUR';
  let rates={EUR:1,USD:1.1605,GBP:0.85608};
  let rateDate='2026-08-19';
  let rateMode='stored';
  const selected=()=>inputs.filter(i=>i.checked);
  const formatEUR=n=>new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(n);
  const money=n=>{
    const rate=rates[currency]||1;
    const value=n*rate;
    return new Intl.NumberFormat(currency==='USD'?'en-US':currency==='GBP'?'en-GB':'en-IE',{style:'currency',currency,maximumFractionDigits:0}).format(value);
  };

  function shippingEUR(sel){
    if(!sel.length) return 0;
    let base=250;
    if(productCode==='f16' && sel.some(i=>i.dataset.item==='Full Cockpit')) base+=200;
    if(productCode==='a320-full'){
      const hasShell=sel.some(i=>i.dataset.item==='Cockpit Shell Only');
      const structuralOnly=new Set(['Cockpit Shell Only','Base','Liners']);
      const extra=sel.some(i=>!structuralOnly.has(i.dataset.item) && Number(i.dataset.price)!==0);
      if(hasShell && extra) base=450;
    }
    if(region?.value==='usa') base+=500;
    if(region?.value==='middle-east') base+=650;
    return base;
  }

  function longestLead(sel){
    const vals=sel.map(i=>Number(i.dataset.leadweeks)).filter(v=>Number.isFinite(v)&&v>0);
    if(!vals.length) return 'To be confirmed';
    const max=Math.max(...vals); return `${max} week${max===1?'':'s'}`;
  }

  function renderPreview(input){
    if(!input){
      previewImg.hidden=true; previewImg.removeAttribute('src'); previewPlaceholder.hidden=false;
      previewTag.textContent=product;
      previewTitle.textContent='Select a component';
      previewText.textContent='Choose any component on the right. Its individual product image will appear here when the component photography is supplied.';
      descTitle.textContent='Select a component';
      descText.textContent='Component details will appear here as you move through the configuration.';
      return;
    }
    const item=input.dataset.item||'Component';
    const copy=input.dataset.description||'';
    const img=input.dataset.image||'';
    descTitle.textContent=item; descText.textContent=copy;
    previewTag.textContent=product;
    previewTitle.textContent=item;
    previewText.textContent=img?'':(copy||'Individual component image to be supplied.');
    if(img){previewImg.src=img;previewImg.alt=item;previewImg.hidden=false;previewPlaceholder.hidden=true;}
    else{previewImg.hidden=true;previewImg.removeAttribute('src');previewPlaceholder.hidden=false;}
  }

  function refresh(last){
    const sel=selected();
    lines.innerHTML='';
    if(!sel.length) lines.innerHTML='<div class="framecfg-empty">No components selected yet.</div>';
    let sub=0;
    for(const i of sel){
      const p=Number(i.dataset.price||0); sub+=p;
      const row=document.createElement('div'); row.className='framecfg-line';
      row.innerHTML=`<span>${i.dataset.item}</span><strong>${p===0?'No extra cost':money(p)}</strong>`;
      lines.appendChild(row);
    }
    const ship=shippingEUR(sel);
    count.textContent=`${sel.length} selected`;
    lead.textContent=sel.length?longestLead(sel):'—';
    shipping.textContent=sel.length?money(ship):'—';
    subtotal.textContent=money(sub);
    grand.textContent=money(sub+ship);
    document.querySelectorAll('[data-eur-price]').forEach(el=>{
      const p=Number(el.dataset.eurPrice); el.textContent=p===0?'NO EXTRA COST':money(p);
    });
    renderPreview(last||sel[sel.length-1]||null);
  }

  async function loadRates(){
    // Currency conversion works immediately from a verified stored ECB rate,
    // then attempts to refresh from the live Frankfurter ECB feed.
    fxSource.textContent=`Indicative conversions using ECB euro reference rates · ${rateDate} · stored fallback. EUR remains the base quote currency.`;
    refresh();
    try{
      let usd=null,gbp=null,date='';
      try{
        const r=await fetch('https://api.frankfurter.dev/v2/rates?base=EUR&quotes=USD,GBP&providers=ECB',{cache:'no-store'});
        if(!r.ok) throw new Error('V2 HTTP '+r.status);
        const rows=await r.json();
        if(!Array.isArray(rows)) throw new Error('Unexpected V2 FX format');
        const lookup={};
        for(const row of rows){ if(row&&row.quote) lookup[row.quote]=Number(row.rate); }
        usd=lookup.USD; gbp=lookup.GBP; date=(rows.find(x=>x&&x.date)?.date)||'';
        if(!usd||!gbp) throw new Error('V2 FX data incomplete');
      }catch(v2err){
        // V1 is kept by Frankfurter for compatibility and has a very simple JSON shape.
        const r=await fetch('https://api.frankfurter.dev/v1/latest?base=EUR&symbols=USD,GBP',{cache:'no-store'});
        if(!r.ok) throw new Error('V1 HTTP '+r.status);
        const data=await r.json();
        usd=Number(data.rates?.USD); gbp=Number(data.rates?.GBP); date=data.date||'';
        if(!usd||!gbp) throw new Error('V1 FX data incomplete');
      }
      rates.USD=usd; rates.GBP=gbp; rateDate=date||rateDate; rateMode='live';
      fxSource.textContent=`Indicative conversions using European Central Bank (ECB) reference rates via Frankfurter · ${rateDate}. EUR remains the base quote currency.`;
      refresh();
    }catch(e){
      rateMode='stored';
      fxSource.textContent=`Indicative conversions using stored ECB reference rates · ${rateDate}. Live rate refresh is temporarily unavailable. EUR remains the base quote currency.`;
      refresh();
    }
  }

  inputs.forEach(i=>i.addEventListener('change',()=>refresh(i)));
  region?.addEventListener('change',()=>refresh());
  currencyButtons.forEach(btn=>btn.addEventListener('click',()=>{
    const next=btn.dataset.currency;
    if(next!=='EUR'&&!rates[next]) return;
    currency=next;
    currencyButtons.forEach(b=>b.classList.toggle('active',b===btn));
    refresh();
  }));

  function submit(formal){
    const sel=selected(); if(!sel.length){alert('Select at least one component first.');return;}
    const sub=sel.reduce((s,i)=>s+Number(i.dataset.price||0),0); const ship=shippingEUR(sel);
    const config=sel.map(i=>`${i.dataset.item} (${Number(i.dataset.price||0)===0?'No extra cost':formatEUR(Number(i.dataset.price))})`).join('; ');
    const qs=new URLSearchParams({interest:'Cockpit Shells & Frames',platform:product,configuration:config,shipping_region:region?.options[region.selectedIndex].text||'Mainland Europe',shipping_estimate_eur:formatEUR(ship),subtotal_eur:formatEUR(sub),estimated_total_eur:formatEUR(sub+ship),lead_time:longestLead(sel),display_currency:currency,quote:formal?'Formal quote':'Configuration review'});
    location.href='contact.html?'+qs.toString();
  }
  document.getElementById('framecfg-review')?.addEventListener('click',()=>submit(false));
  document.getElementById('framecfg-quote')?.addEventListener('click',()=>submit(true));
  refresh(); loadRates();


  // ---------- V11 shared physical-product action controls ----------
  function ensureSharedActionButtons(){
    const actions=document.querySelector('.framecfg-actions');
    if(!actions) return;
    const disclaimer=actions.querySelector('.framecfg-disclaimer');
    const defs=[
      ['framecfg-buy','BUY IT NOW','framecfg-buy-now'],
      ['framecfg-more-info','INTERESTED, BUT NEED MORE INFORMATION?','framecfg-more-info'],
      ['framecfg-quote','REQUEST A FORMAL QUOTE','framecfg-secondary']
    ];
    for(const [id,label,cls] of defs){
      if(document.getElementById(id)) continue;
      const b=document.createElement('button');
      b.id=id; b.type='button'; b.className=cls; b.textContent=label;
      if(disclaimer) actions.insertBefore(b,disclaimer); else actions.appendChild(b);
    }
  }
  ensureSharedActionButtons();

  // ---------- V11 sales conversion layer ----------
  const buyBtn=document.getElementById('framecfg-buy');
  const infoBtn=document.getElementById('framecfg-more-info');
  const buyModal=document.getElementById('framecfg-buy-modal');
  const infoModal=document.getElementById('framecfg-info-modal');
  const salesEndpoint='frames-sales-submit.php';

  function eurSnapshot(){
    const sel=selected();
    const sub=sel.reduce((s,i)=>s+Number(i.dataset.price||0),0);
    const ship=shippingEUR(sel);
    return {sel,sub,ship,total:sub+ship,lead:longestLead(sel),region:region?.options[region.selectedIndex].text||'Mainland Europe'};
  }
  function configText(sel){
    return sel.map(i=>`${i.dataset.item} (${Number(i.dataset.price||0)===0?'No extra cost':formatEUR(Number(i.dataset.price))})`).join('; ');
  }
  function currentIdentity(){
    let id={};
    try{id=JSON.parse(localStorage.getItem('simworxSalesIdentityV1')||'{}')||{}}catch(e){}
    try{const v=JSON.parse(sessionStorage.getItem('simworxAssistVisitorV1')||'{}')||{};if(!id.email&&v.email)id.email=v.email}catch(e){}
    return id;
  }
  function saveIdentity(form){
    const data=Object.fromEntries(new FormData(form).entries());
    localStorage.setItem('simworxSalesIdentityV1',JSON.stringify({name:data.name||'',email:data.email||'',company:data.company||'',phone:data.phone||'',country:data.country||''}));
  }
  function prefill(form){
    const id=currentIdentity();
    ['name','email','company','phone','country'].forEach(k=>{const el=form?.elements?.namedItem(k);if(el&&!el.value&&id[k])el.value=id[k]});
  }
  function snapshotHtml(){
    const s=eurSnapshot();
    return `<b>${product}</b><p>${s.sel.length?configText(s.sel):'No components selected.'}</p><p>Shipping destination: ${s.region} · Lead time: ${s.lead}</p><div class="sum"><span>Estimated total incl. shipping</span><strong>${formatEUR(s.total)}</strong></div><p>EUR is the base order currency. Display conversions are indicative only.</p>`;
  }
  function openModal(modal){
    if(!modal)return; modal.hidden=false; document.body.style.overflow='hidden';
    modal.querySelector('.framecfg-order-snapshot')?.replaceChildren();
    const snap=modal.querySelector('.framecfg-order-snapshot');if(snap)snap.innerHTML=snapshotHtml();
    prefill(modal.querySelector('form'));
  }
  function closeModal(modal){if(!modal)return;modal.hidden=true;document.body.style.overflow=''}
  document.querySelectorAll('[data-framecfg-close]').forEach(el=>el.addEventListener('click',()=>closeModal(el.closest('.framecfg-modal'))));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeModal(buyModal);closeModal(infoModal)}});

  function approvedAnswer(q){
    const t=q.toLowerCase().trim();
    if(!t)return null;
    if(/custom|custom made|bespoke|modify|modified|different size|dimension/.test(t))return 'Yes. These structures are built to order, so many dimensional, mounting and finish changes can be accommodated. Tell us what you need and sales will confirm the change before production.';
    if(/aluminium|aluminum|metal|material|made of|construction/.test(t))return 'The principal cockpit structures are aluminium construction unless a specific component is described otherwise. If you have a particular material requirement, sales can confirm it before production.';
    if(/paint|colour|color|ral|finish|powder/.test(t))return 'Custom finishes are available. We normally supply the standard SIMWORX finish shown for the product, but you can request a different RAL colour when ordering. Sales will confirm the exact colour and any cost before production.';
    if(/winwing/.test(t))return 'Yes. Where the configurator lists Winwing FCU compatibility, that mounting option is available at no extra cost.';
    if(/skalarki/.test(t))return 'Yes. Where listed, the main panel and FCU can be supplied with Skalarki-compatible mounting at no extra cost.';
    if(/sl3/.test(t))return 'Yes. Where listed, the main panel can be supplied in the SL3-compatible mounting format at no extra cost.';
    if(/individual|separate|single part|one part|parts only|component only/.test(t))return 'Yes. There is no compulsory base package on these configurators. You can select and order only the components you require.';
    if(/shipping|delivery|freight|pallet/.test(t)){const s=eurSnapshot();return `For the configuration currently selected, estimated shipping to ${s.region} is ${formatEUR(s.ship)}. Final delivery details are confirmed before payment.`}
    if(/tax|vat|duty|duties|tariff|import/.test(t))return 'Base prices are in Euros and exclude VAT. Import duties, tariffs and local taxes are the customer’s responsibility. The applicable tax treatment is confirmed from the customer and delivery details.';
    if(/lead|how long|delivery time|weeks|production time/.test(t)){const s=eurSnapshot();return s.lead==='To be confirmed'?'Lead time is based on the longest selected component. The individual production lead times are still being finalised, so sales will confirm the current lead time before payment.':`The current estimated package lead time is ${s.lead}, based on the longest selected component.`}
    if(/monitor|screen|hdmi|mip/.test(t))return 'MIP options vary by product. Where both versions are shown, you can choose the MIP structure without monitors or the version with integrated monitor provision. Select the relevant option in the configurator for the exact price.';
    if(/payment|pay|card|buy now|deposit/.test(t))return 'The Buy It Now process sends the exact configuration to SIMWORX for final specification, shipping and tax confirmation. Sales then provides the secure payment instructions for the confirmed order.';
    return null;
  }

  async function postSales(payload,button,statusEl){
    const old=button.textContent;button.disabled=true;button.textContent='SENDING…';
    if(statusEl)statusEl.innerHTML='';
    try{
      const body=new URLSearchParams(payload);
      const r=await fetch(salesEndpoint,{method:'POST',headers:{'X-Requested-With':'XMLHttpRequest','Accept':'application/json','Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},body});
      const data=await r.json().catch(()=>({ok:false,message:'Unexpected server response.'}));
      if(!r.ok||!data.ok)throw new Error(data.message||'Unable to send.');
      if(statusEl)statusEl.innerHTML=`<div class="framecfg-success">${data.message||'Sent successfully.'}</div>`;
      return true;
    }catch(e){if(statusEl)statusEl.innerHTML=`<div class="framecfg-error">${e.message||'Unable to send. Please email sales@sim-worx.com.'}</div>`;return false}
    finally{button.disabled=false;button.textContent=old}
  }

  buyBtn?.addEventListener('click',()=>{
    const s=eurSnapshot();
    if(!s.sel.some(i=>Number(i.dataset.price||0)>0)){alert('Select at least one priced component first.');return}
    const form=buyModal?.querySelector('form');if(form){form.reset();prefill(form)}
    openModal(buyModal);
  });
  const buyForm=document.getElementById('framecfg-buy-form');
  buyForm?.addEventListener('submit',async e=>{
    e.preventDefault();
    if(!buyForm.reportValidity())return;
    const s=eurSnapshot(),fd=Object.fromEntries(new FormData(buyForm).entries());
    saveIdentity(buyForm);
    const ok=await postSales({...fd,intent:'buy',product,configuration:configText(s.sel),shipping_region:s.region,subtotal_eur:formatEUR(s.sub),shipping_eur:formatEUR(s.ship),total_eur:formatEUR(s.total),lead_time:s.lead,display_currency:currency,page:location.href},buyForm.querySelector('button[type=submit]'),document.getElementById('framecfg-buy-status'));
    if(ok)buyForm.querySelectorAll('input,textarea,select,button').forEach(x=>x.disabled=true);
  });

  infoBtn?.addEventListener('click',()=>{
    const form=document.getElementById('framecfg-sales-question-form');if(form){form.reset();prefill(form);form.hidden=true}
    const answer=document.getElementById('framecfg-instant-answer');if(answer){answer.hidden=true;answer.innerHTML=''}
    document.getElementById('framecfg-info-status').innerHTML='';
    document.getElementById('framecfg-question').value='';
    openModal(infoModal);
  });
  const askBtn=document.getElementById('framecfg-ask-question');
  const questionEl=document.getElementById('framecfg-question');
  const answerEl=document.getElementById('framecfg-instant-answer');
  const salesQuestionForm=document.getElementById('framecfg-sales-question-form');
  askBtn?.addEventListener('click',()=>{
    const q=questionEl.value.trim();if(!q){questionEl.focus();return}
    const a=approvedAnswer(q);
    answerEl.hidden=false;
    if(a){answerEl.innerHTML=`<b>Instant answer</b>${a}<div class="framecfg-question-actions"><button type="button" data-resolved>That answers it</button><button class="primary" type="button" data-ask-sales>Still ask sales</button></div>`;salesQuestionForm.hidden=true}
    else{answerEl.innerHTML='<b>I need sales to confirm that.</b>This question needs a product-specific human answer, so I can send it to the SIMWORX sales team now.';salesQuestionForm.hidden=false;prefill(salesQuestionForm)}
  });
  answerEl?.addEventListener('click',e=>{
    if(e.target.closest('[data-resolved]'))closeModal(infoModal);
    if(e.target.closest('[data-ask-sales]')){salesQuestionForm.hidden=false;prefill(salesQuestionForm);salesQuestionForm.scrollIntoView({behavior:'smooth',block:'nearest'})}
  });
  salesQuestionForm?.addEventListener('submit',async e=>{
    e.preventDefault();if(!salesQuestionForm.reportValidity())return;
    const s=eurSnapshot(),fd=Object.fromEntries(new FormData(salesQuestionForm).entries());
    const answer=approvedAnswer(questionEl.value.trim())||'';saveIdentity(salesQuestionForm);
    await postSales({...fd,intent:'question',product,question:questionEl.value.trim(),assistant_answer:answer,configuration:configText(s.sel),shipping_region:s.region,subtotal_eur:formatEUR(s.sub),shipping_eur:formatEUR(s.ship),total_eur:formatEUR(s.total),lead_time:s.lead,display_currency:currency,page:location.href},salesQuestionForm.querySelector('button[type=submit]'),document.getElementById('framecfg-info-status'));
  });

})();
