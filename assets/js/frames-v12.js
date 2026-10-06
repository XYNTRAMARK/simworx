/* SIMWORX FRAMES V12 — VAT-aware unified sales + resilient ECB FX */
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
  const customerTypeInputs=[...document.querySelectorAll('input[name="framecfg-customer-type"]')];
  const euCountryControl=document.getElementById('framecfg-eu-country-control');
  const euCountry=document.getElementById('framecfg-eu-country');
  const vatNumberControl=document.getElementById('framecfg-vat-number-control');
  const vatNumber=document.getElementById('framecfg-vat-number');
  const taxNote=document.getElementById('framecfg-tax-note');
  const vatLabel=document.getElementById('framecfg-vat-label');
  const vatAmount=document.getElementById('framecfg-vat-amount');
  const vatRow=document.getElementById('framecfg-vat-row');
  const grandLabel=document.getElementById('framecfg-grand-label');

  let currency='EUR';
  let rates={EUR:1,USD:1.1605,GBP:0.85608};
  let rateDate='2026-08-19';
  let rateMode='stored';
  const selected=()=>inputs.filter(i=>i.checked);
  const customerType=()=>customerTypeInputs.find(i=>i.checked)?.value||'personal';
  const formatEUR=n=>new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(n);
  const money=n=>{
    const rate=rates[currency]||1;
    const value=n*rate;
    return new Intl.NumberFormat(currency==='USD'?'en-US':currency==='GBP'?'en-GB':'en-IE',{style:'currency',currency,maximumFractionDigits:0}).format(value);
  };

  function shippingEUR(sel){
    if(!sel.length) return 0;
    if(region?.value==='rest-world') return null;
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

  function updateTaxControls(){
    const r=region?.value||'spain';
    const type=customerType();
    if(euCountryControl) euCountryControl.hidden=!(r==='eu'&&type==='personal');
    if(vatNumberControl) vatNumberControl.hidden=!(r==='eu'&&type==='business');
  }

  function vatInfo(sub,ship){
    const r=region?.value||'spain';
    const type=customerType();
    const taxable=sub+(typeof ship==='number'?ship:0);
    if(r==='spain') return {pending:false,rate:21,amount:taxable*.21,label:'VAT (Spain 21%)',status:'Spanish VAT applies to both personal and business customers.'};
    if(r==='eu'){
      if(type==='business'){
        const vat=(vatNumber?.value||'').trim();
        if(!vat) return {pending:true,rate:null,amount:null,label:'VAT',status:'EU business sale: enter a valid EU VAT number. Final 0% treatment is subject to validation before payment.'};
        return {pending:false,rate:0,amount:0,label:'VAT (EU business — provisional 0%)',status:`No Spanish VAT estimated. EU VAT number ${vat.toUpperCase()} must be validated before payment.`};
      }
      const opt=euCountry?.selectedOptions?.[0];
      const rate=Number(opt?.dataset?.vat);
      if(!opt?.value||!Number.isFinite(rate)) return {pending:true,rate:null,amount:null,label:'VAT',status:'Select the EU delivery country to calculate the destination-country VAT rate.'};
      return {pending:false,rate,amount:taxable*(rate/100),label:`VAT (${opt.text.split(' — ')[0]} ${rate}%)`,status:`EU consumer VAT estimated at the standard destination-country rate of ${rate}%.`};
    }
    return {pending:false,rate:0,amount:0,label:'VAT (0% Spanish VAT)',status:'No Spanish VAT is charged on exports outside the EU. Import VAT, duties and tariffs are the customer’s responsibility.'};
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
    updateTaxControls();
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
    const tax=vatInfo(sub,ship);
    count.textContent=`${sel.length} selected`;
    lead.textContent=sel.length?longestLead(sel):'—';
    shipping.textContent=!sel.length?'—':ship===null?'Quote required':money(ship);
    shipping.classList.toggle('framecfg-shipping-quote',ship===null);
    subtotal.textContent=money(sub);
    vatLabel.textContent=tax.label;
    vatAmount.textContent=tax.pending?'Pending':money(tax.amount||0);
    vatRow?.classList.toggle('pending',tax.pending);
    if(taxNote) taxNote.innerHTML=`<strong>VAT:</strong> ${tax.status}<br><span>EU consumer rates use the current European Commission standard-rate table. Final tax treatment is confirmed before payment.</span>`;
    const grandRow=grand?.closest('.framecfg-total-row');
    const pendingTotal=tax.pending;
    grandRow?.classList.toggle('pending',pendingTotal||ship===null);
    if(!sel.length){grand.textContent=money(0);}
    else if(pendingTotal){grand.textContent='Pending VAT confirmation';}
    else if(ship===null){grand.textContent=`${money(sub+(tax.amount||0))} + shipping quote`;}
    else{grand.textContent=money(sub+ship+(tax.amount||0));}
    if(grandLabel) grandLabel.textContent=ship===null?'Estimated total before shipping':'Estimated total incl. shipping & VAT';
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
  customerTypeInputs.forEach(i=>i.addEventListener('change',()=>refresh()));
  euCountry?.addEventListener('change',()=>refresh());
  vatNumber?.addEventListener('input',()=>refresh());
  currencyButtons.forEach(btn=>btn.addEventListener('click',()=>{
    const next=btn.dataset.currency;
    if(next!=='EUR'&&!rates[next]) return;
    currency=next;
    currencyButtons.forEach(b=>b.classList.toggle('active',b===btn));
    refresh();
  }));

  function submit(formal){
    const sel=selected(); if(!sel.length){alert('Select at least one component first.');return;}
    const sub=sel.reduce((s,i)=>s+Number(i.dataset.price||0),0); const ship=shippingEUR(sel); const tax=vatInfo(sub,ship);
    const config=sel.map(i=>`${i.dataset.item} (${Number(i.dataset.price||0)===0?'No extra cost':formatEUR(Number(i.dataset.price))})`).join('; ');
    const total=(tax.pending||ship===null)?'To be confirmed':formatEUR(sub+ship+(tax.amount||0));
    const qs=new URLSearchParams({interest:'Cockpit Shells & Frames',platform:product,configuration:config,customer_type:customerType(),eu_vat_number:(vatNumber?.value||''),vat_treatment:tax.status,vat_estimate:tax.pending?'Pending':formatEUR(tax.amount||0),shipping_region:region?.options[region.selectedIndex].text||'Spain',shipping_estimate_eur:ship===null?'Quote required':formatEUR(ship),subtotal_eur:formatEUR(sub),estimated_total_eur:total,lead_time:longestLead(sel),display_currency:currency,quote:formal?'Formal quote':'Configuration review'});
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
    const tax=vatInfo(sub,ship);
    const total=(!tax.pending&&ship!==null)?sub+ship+(tax.amount||0):null;
    return {sel,sub,ship,tax,total,lead:longestLead(sel),region:region?.options[region.selectedIndex].text||'Spain',customerType:customerType(),vatNumber:(vatNumber?.value||'').trim()};
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
    const shipText=s.ship===null?'Shipping quote required':formatEUR(s.ship);
    const vatText=s.tax.pending?'VAT pending confirmation':formatEUR(s.tax.amount||0);
    const totalText=s.total===null?(s.ship===null?`${formatEUR(s.sub+(s.tax.amount||0))} + shipping quote`:'Pending VAT confirmation'):formatEUR(s.total);
    return `<b>${product}</b><p>${s.sel.length?configText(s.sel):'No components selected.'}</p><p>Customer: ${s.customerType==='business'?'Business':'Personal'} · Shipping: ${s.region} · ${shipText} · Lead time: ${s.lead}</p><p>${s.tax.status}</p><div class="sum"><span>VAT</span><strong>${vatText}</strong></div><div class="sum"><span>Estimated order total</span><strong>${totalText}</strong></div><p>EUR is the base order currency. Display conversions are indicative only.</p>`;
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
    if(/shipping|delivery|freight|pallet/.test(t)){const s=eurSnapshot();return s.ship===null?`Shipping to ${s.region} requires a specific freight quotation. Send the configuration and destination to sales and we will confirm the cost before payment.`:`For the configuration currently selected, estimated shipping to ${s.region} is ${formatEUR(s.ship)}. Final delivery details are confirmed before payment.`}
    if(/tax|vat|duty|duties|tariff|import/.test(t)){const s=eurSnapshot();return `VAT currently shows: ${s.tax.status} Import duties, tariffs and local import taxes remain the customer’s responsibility outside the EU.`;}
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
    const ok=await postSales({...fd,intent:'buy',product,configuration:configText(s.sel),customer_type:s.customerType,eu_vat_number:s.vatNumber,vat_treatment:s.tax.status,vat_eur:s.tax.pending?'Pending':formatEUR(s.tax.amount||0),shipping_region:s.region,subtotal_eur:formatEUR(s.sub),shipping_eur:s.ship===null?'Quote required':formatEUR(s.ship),total_eur:s.total===null?'To be confirmed':formatEUR(s.total),lead_time:s.lead,display_currency:currency,page:location.href},buyForm.querySelector('button[type=submit]'),document.getElementById('framecfg-buy-status'));
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
    await postSales({...fd,intent:'question',product,question:questionEl.value.trim(),assistant_answer:answer,configuration:configText(s.sel),customer_type:s.customerType,eu_vat_number:s.vatNumber,vat_treatment:s.tax.status,vat_eur:s.tax.pending?'Pending':formatEUR(s.tax.amount||0),shipping_region:s.region,subtotal_eur:formatEUR(s.sub),shipping_eur:s.ship===null?'Quote required':formatEUR(s.ship),total_eur:s.total===null?'To be confirmed':formatEUR(s.total),lead_time:s.lead,display_currency:currency,page:location.href},salesQuestionForm.querySelector('button[type=submit]'),document.getElementById('framecfg-info-status'));
  });

})();
