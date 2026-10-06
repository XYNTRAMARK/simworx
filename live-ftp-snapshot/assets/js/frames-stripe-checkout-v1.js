/* SIMWORX Stripe Checkout Adapter V1
   EUR is authoritative. Prices, VAT and shipping are recalculated server-side. */
(()=>{
  const root=document.querySelector('[data-frame-configurator]');
  if(!root) return;

  const endpoint='stripe/create-checkout-session.php';
  const productCode=root.dataset.productCode||'';

  const codeMap={
    f16:{
      'Full Cockpit, ACES 2, Glare & HUD':'f16-full-aces-glare-hud',
      'Full Cockpit, Glare & HUD':'f16-full-glare-hud',
      'VR Pro Only':'f16-vr-pro-only',
      'VR Pro with Glare & HUD':'f16-vr-pro-glare-hud',
      'VR Pro with Glare, HUD & ACES 2':'f16-vr-pro-glare-hud-aces',
      'ACES 2 Ejection Seat':'f16-aces-2-seat',
      'F16 Tactical Trainer — VR & MR Model':'f16-tactical-trainer-vr-mr',
      'F16 MIP':'f16-mip',
      'WinCtrl ICP & HUD Box':'f16-winctrl-icp-hud-box'
    },
    'a320-single':{
      'MIP No Monitors':'a320-single-mip-no-monitors',
      'MIP Monitors':'a320-single-mip-monitors',
      'Conversion from Single Seat to Full MIP':'a320-single-full-mip-conversion',
      'Pedestal':'a320-single-pedestal',
      'Side Box CPTN':'a320-single-sidebox-captain',
      'Side Box FO':'a320-single-sidebox-fo'
    },
    'a320-supershort':{
      'Cockpit Shell Only':'a320-supershort-shell',
      'Base':'a320-supershort-base',
      'Liners':'a320-supershort-liners',
      'MIP':'a320-supershort-mip',
      'MIP with Built-in HDMI Monitors':'a320-supershort-mip-hdmi',
      'Pedestal':'a320-supershort-pedestal',
      'Side Box CPTN':'a320-supershort-sidebox-captain',
      'Side Box FO':'a320-supershort-sidebox-fo',
      'Both Sides Side Box':'a320-supershort-sidebox-both',
      'Carpet':'a320-supershort-carpet'
    },
    'a320-full':{
      'Cockpit Shell Only':'a320-full-shell',
      'Base':'a320-full-base',
      'Liners':'a320-full-liners',
      'MIP No Monitors':'a320-full-mip-no-monitors',
      'MIP Monitors':'a320-full-mip-monitors',
      'Pedestal':'a320-full-pedestal',
      'Side Box CPTN':'a320-full-sidebox-captain',
      'Side Box FO':'a320-full-sidebox-fo',
      'Both Sides Side Box':'a320-full-sidebox-both',
      'Aft Boxes':'a320-full-aft-boxes',
      'Carpet':'a320-full-carpet',
      'IOS Box':'a320-full-ios-box'
    }
  };

  const selected=()=>[...root.querySelectorAll('input[data-item]:checked')];
  const customerType=()=>root.querySelector('input[name="framecfg-customer-type"]:checked')?.value||'personal';
  const checkoutCurrency=()=>{
    const value=document.querySelector('.framecfg-currency-btn.active')?.dataset.currency||'EUR';
    return ['EUR','USD','GBP'].includes(value)?value:'EUR';
  };

  function setBusy(btn,busy){
    if(!btn) return;
    if(busy){btn.dataset.oldText=btn.textContent;btn.disabled=true;btn.textContent='OPENING SECURE CHECKOUT…';}
    else{btn.disabled=false;btn.textContent=btn.dataset.oldText||'BUY IT NOW';}
  }

  async function startCheckout(btn){
    const sel=selected();
    if(!sel.length){alert('Select at least one product or component first.');return;}

    const quoteOnly=sel.filter(i=>i.dataset.quoteOnly==='true'||i.dataset.price==='');
    if(quoteOnly.length){
      alert('Your configuration contains an item that requires a quotation. Please use REQUEST A FORMAL QUOTE so SIMWORX can confirm the complete price before payment.');
      return;
    }

    const map=codeMap[productCode]||{};
    const paid=[]; const options=[]; const unknown=[];
    for(const input of sel){
      const price=Number(input.dataset.price||0);
      const item=input.dataset.item||'';
      if(price>0){
        const code=map[item];
        if(code) paid.push(code); else unknown.push(item);
      }else{
        options.push(item);
      }
    }
    if(unknown.length){alert('Checkout is not yet mapped for: '+unknown.join(', ')+'. Please request a formal quote.');return;}
    if(!paid.length){alert('Select at least one priced product or component first.');return;}

    const region=document.getElementById('framecfg-region')?.value||'spain';
    const type=customerType();
    const euCountry=document.getElementById('framecfg-eu-country')?.value||'';
    const vatNumber=(document.getElementById('framecfg-vat-number')?.value||'').trim();

    if(region==='rest-world'){
      alert('Shipping to this destination requires a freight quotation. Please use REQUEST A FORMAL QUOTE.');
      return;
    }
    if(region==='eu'&&type==='business'){
      alert('EU business orders require VAT-number validation before payment. Please use REQUEST A FORMAL QUOTE and we will validate the VAT treatment first.');
      return;
    }
    if(region==='eu'&&type==='personal'&&!euCountry){
      alert('Please select your EU delivery country so VAT can be calculated correctly.');
      return;
    }

    setBusy(btn,true);
    try{
      const r=await fetch(endpoint,{
        method:'POST',
        headers:{'Content-Type':'application/json','Accept':'application/json'},
        body:JSON.stringify({
          product_code:productCode,
          items:paid,
          options,
          customer_type:type,
          region,
          eu_country:euCountry,
          eu_vat_number:vatNumber,
          currency:checkoutCurrency()
        })
      });
      const data=await r.json().catch(()=>({}));
      if(!r.ok||!data.checkout_url) throw new Error(data.error||'Stripe Checkout could not be opened.');
      window.location.assign(data.checkout_url);
    }catch(err){
      alert((err&&err.message)||'Stripe Checkout could not be opened. Please try again or request a formal quote.');
      setBusy(btn,false);
    }
  }

  // If the customer returns from Stripe with the browser Back button, browsers can
  // restore this page from the back/forward cache with BUY IT NOW still disabled.
  // Always return the control to an editable/ready state.
  function restoreCheckoutButton(){
    const btn=document.getElementById('framecfg-buy');
    if(!btn) return;
    btn.disabled=false;
    btn.textContent=btn.dataset.oldText||'BUY IT NOW';
  }
  window.addEventListener('pageshow',restoreCheckoutButton);
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible') restoreCheckoutButton();
  });
  window.addEventListener('focus',restoreCheckoutButton);
  restoreCheckoutButton();

  // Capture phase prevents the older purchase-request popup from opening.
  document.addEventListener('click',e=>{
    const btn=e.target.closest('#framecfg-buy');
    if(!btn) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    startCheckout(btn);
  },true);
})();
