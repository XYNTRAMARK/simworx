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
  let rates={EUR:1,USD:null,GBP:null};
  let rateDate='';
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
    try{
      const r=await fetch('https://api.frankfurter.app/latest?from=EUR&to=USD,GBP',{cache:'no-store'});
      if(!r.ok) throw new Error('FX HTTP '+r.status);
      const data=await r.json();
      rates.USD=Number(data.rates?.USD); rates.GBP=Number(data.rates?.GBP); rateDate=data.date||'';
      if(!rates.USD||!rates.GBP) throw new Error('FX data incomplete');
      fxSource.textContent=`Indicative conversions using ECB reference rates via Frankfurter${rateDate?' · '+rateDate:''}. EUR remains the base quote currency.`;
    }catch(e){
      fxSource.textContent='Live currency conversion is temporarily unavailable. EUR remains the base quote currency.';
      currencyButtons.filter(b=>b.dataset.currency!=='EUR').forEach(b=>b.disabled=true);
    }
    refresh();
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
})();
