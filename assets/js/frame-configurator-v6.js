(()=>{
  const root=document.querySelector('[data-frame-configurator]'); if(!root) return;
  const product=root.dataset.product||'Cockpit Structure';
  const productCode=root.dataset.productCode||'';
  const inputs=[...root.querySelectorAll('input[data-item]')];
  const lines=document.getElementById('framecfg-lines');
  const total=document.getElementById('framecfg-total');
  const count=document.getElementById('framecfg-count');
  const warning=document.getElementById('framecfg-warning');
  const compTitle=document.getElementById('framecfg-component-title');
  const compCopy=document.getElementById('framecfg-component-copy');
  const compImg=document.getElementById('framecfg-component-image');
  const compPlaceholder=document.getElementById('framecfg-component-placeholder');
  const compBadge=document.getElementById('framecfg-component-placeholder-badge');
  const compPlaceholderTitle=document.getElementById('framecfg-component-placeholder-title');
  const compPlaceholderText=document.getElementById('framecfg-component-placeholder-text');
  const region=document.getElementById('framecfg-region');
  const shippingEl=document.getElementById('framecfg-shipping');
  const leadEl=document.getElementById('framecfg-lead');
  const estEl=document.getElementById('framecfg-estimated-total');
  const fxStatus=document.getElementById('framecfg-fx-status');
  const currencyButtons=[...root.querySelectorAll('[data-currency]')];

  // EUR is always the base/contractual currency. These are only emergency display fallbacks
  // if the live ECB reference-rate request is unavailable.
  let currency='EUR';
  let fx={EUR:1,USD:1.1681,GBP:0.85725};
  let fxDate='20 Aug 2026';
  let fxLive=false;

  const currencyMeta={
    EUR:{locale:'en-IE',symbol:'€'},
    USD:{locale:'en-US',symbol:'$'},
    GBP:{locale:'en-GB',symbol:'£'}
  };
  const numeric=v=>v!==undefined && v!=='' && !Number.isNaN(Number(v));
  const selected=()=>inputs.filter(i=>i.checked);
  const convert=n=>n*(fx[currency]||1);
  const money=n=>new Intl.NumberFormat(currencyMeta[currency].locale,{style:'currency',currency,maximumFractionDigits:0}).format(convert(n));
  const euro=n=>new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(n);

  function fxText(){
    if(!fxStatus) return;
    const usd=fx.USD.toFixed(4), gbp=fx.GBP.toFixed(5);
    fxStatus.innerHTML=`Indicative display conversion only — orders and quotes remain in EUR. Source: <a href="https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html" target="_blank" rel="noopener">European Central Bank reference rates</a>, retrieved via <a href="https://frankfurter.dev/providers/ecb/" target="_blank" rel="noopener">Frankfurter API</a>. €1 = $${usd} / £${gbp}. Rate date: ${fxDate}${fxLive?'':' (fallback)'}.`;
  }

  async function loadFx(){
    try{
      const [usdRes,gbpRes]=await Promise.all([
        fetch('https://api.frankfurter.dev/v2/rate/EUR/USD?providers=ECB',{cache:'no-store'}),
        fetch('https://api.frankfurter.dev/v2/rate/EUR/GBP?providers=ECB',{cache:'no-store'})
      ]);
      if(!usdRes.ok||!gbpRes.ok) throw new Error('FX service unavailable');
      const [usdData,gbpData]=await Promise.all([usdRes.json(),gbpRes.json()]);
      if(!numeric(usdData.rate)||!numeric(gbpData.rate)) throw new Error('Invalid FX response');
      fx.USD=Number(usdData.rate); fx.GBP=Number(gbpData.rate);
      fxDate=usdData.date||gbpData.date||'latest ECB working day'; fxLive=true;
    }catch(err){
      fxLive=false;
      console.warn('[SIMWORX] Live ECB currency conversion unavailable; using the last stored reference rates.',err);
    }
    fxText(); refresh();
  }

  function updateCurrencyButtons(){
    currencyButtons.forEach(btn=>{
      const active=btn.dataset.currency===currency;
      btn.classList.toggle('active',active); btn.setAttribute('aria-pressed',active?'true':'false');
    });
    inputs.forEach(i=>{
      const strong=i.closest('.framecfg-row')?.querySelector('strong'); if(!strong) return;
      if(!numeric(i.dataset.price)){strong.textContent='PRICE PENDING';return;}
      const p=Number(i.dataset.price); strong.textContent=p===0?'NO EXTRA COST':money(p);
    });
  }

  function shippingFor(sel){
    let shipping=250;
    if(productCode==='f16' && sel.some(i=>i.dataset.item==='Full Cockpit')) shipping+=200;
    if(productCode==='a320-full'){
      const onePalletItems=new Set(['Cockpit Shell Only','Base','Liners']);
      const anyOther=sel.some(i=>!onePalletItems.has(i.dataset.item));
      if(anyOther) shipping=450;
    }
    if(region){
      if(region.value==='usa') shipping+=500;
      if(region.value==='arab') shipping+=650;
    }
    return shipping;
  }

  function leadFor(sel){
    const vals=sel.map(i=>numeric(i.dataset.leadweeks)?Number(i.dataset.leadweeks):null).filter(v=>v!==null);
    if(!vals.length) return 'To be confirmed';
    const max=Math.max(...vals); return max+' week'+(max===1?'':'s');
  }

  function renderComponent(last){
    if(!last){
      compTitle.textContent='Select a component';
      compCopy.textContent='Click a component to see its preview and description here.';
      compImg.hidden=true; compImg.removeAttribute('src'); compPlaceholder.hidden=false;
      compBadge.textContent=product.toUpperCase(); compPlaceholderTitle.textContent='Component preview area';
      compPlaceholderText.textContent='When a component is selected, this panel changes to that component. Individual component photography can be dropped in as it is supplied.';
      return;
    }
    compTitle.textContent=last.dataset.item;
    compCopy.textContent=last.dataset.description||'No description supplied yet.';
    const componentImage=last.dataset.image||'';
    if(componentImage){
      compImg.src=componentImage; compImg.alt=last.dataset.item; compImg.hidden=false; compPlaceholder.hidden=true;
    }else{
      compImg.hidden=true; compImg.removeAttribute('src'); compPlaceholder.hidden=false;
      compBadge.textContent=product.toUpperCase(); compPlaceholderTitle.textContent=last.dataset.item;
      compPlaceholderText.textContent=last.dataset.description||'Component image to be supplied.';
    }
  }

  function refresh(last){
    const sel=selected(); let subtotal=0,pending=0;
    lines.innerHTML='';
    if(!sel.length) lines.innerHTML='<div class="framecfg-empty">No components selected yet.</div>';
    sel.forEach(i=>{
      const priced=numeric(i.dataset.price), price=priced?Number(i.dataset.price):null;
      if(price!==null) subtotal+=price; else pending++;
      const row=document.createElement('div'); row.className='framecfg-line';
      row.innerHTML='<span>'+i.dataset.item+'</span><strong>'+(price===null?'PRICE PENDING':price===0?'NO EXTRA COST':money(price))+'</strong>';
      lines.appendChild(row);
    });
    const shipping=sel.length?shippingFor(sel):0;
    total.textContent=money(subtotal); shippingEl.textContent=sel.length?money(shipping):'—';
    estEl.textContent=money(subtotal+shipping); leadEl.textContent=sel.length?leadFor(sel):'—';
    count.textContent=sel.length+' selected';
    warning.hidden=!pending;
    if(pending) warning.textContent=pending+' selected item'+(pending===1?' has':'s have')+' pricing still to be confirmed and '+(pending===1?'is':'are')+' not included in the displayed subtotal.';
    renderComponent(last||sel[sel.length-1]||null); updateCurrencyButtons();
  }

  inputs.forEach(i=>i.addEventListener('change',()=>refresh(i)));
  region?.addEventListener('change',()=>refresh());
  currencyButtons.forEach(btn=>btn.addEventListener('click',()=>{currency=btn.dataset.currency||'EUR';refresh();}));

  const submit=(formal)=>{
    const sel=selected(); if(!sel.length){alert('Select at least one component first.');return;}
    const shipping=shippingFor(sel), lead=leadFor(sel);
    const subtotal=sel.reduce((sum,i)=>sum+(numeric(i.dataset.price)?Number(i.dataset.price):0),0);
    const cfg=sel.map(i=>i.dataset.item+(numeric(i.dataset.price)?' ('+(Number(i.dataset.price)===0?'No extra cost':euro(Number(i.dataset.price)))+')':' (Price pending)')).join('; ');
    const shippingRegion=region?region.options[region.selectedIndex].text:'Mainland Europe';
    const qs=new URLSearchParams({interest:'Cockpit Shells & Frames',platform:product,configuration:cfg,shipping_region:shippingRegion,shipping_estimate_eur:euro(shipping),subtotal_eur:euro(subtotal),estimated_total_eur:euro(subtotal+shipping),display_currency:currency,display_total:money(subtotal+shipping),fx_reference:`ECB via Frankfurter; EUR/USD ${fx.USD}; EUR/GBP ${fx.GBP}; ${fxDate}`,lead_time:lead,quote:formal?'Formal quote':'Configuration review'});
    location.href='contact.html?'+qs.toString();
  };
  document.getElementById('framecfg-review')?.addEventListener('click',()=>submit(false));
  document.getElementById('framecfg-quote')?.addEventListener('click',()=>submit(true));
  fxText(); refresh(); loadFx();
})();
