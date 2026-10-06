const money=v=>new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR'}).format(v);

function activeConfigSelects(){
  const details=[];
  document.querySelectorAll('.option-with-detail:checked').forEach(opt=>{
    const wrap=document.querySelector(`.option-detail[data-for="${opt.id}"]`);
    if(wrap){wrap.classList.add('visible');wrap.querySelectorAll('.config-select').forEach(s=>details.push({name:s.dataset.summaryPrefix||'Option',value:s.value}))}
  });
  document.querySelectorAll('.option-with-detail:not(:checked)').forEach(opt=>{const wrap=document.querySelector(`.option-detail[data-for="${opt.id}"]`);if(wrap)wrap.classList.remove('visible')});
  return details;
}

function updateProduct(){
  const base=Number(document.body.dataset.basePrice||0);
  let extras=0,selected=[],hasQuote=false;
  document.querySelectorAll('.product-option:checked').forEach(x=>{
    const price=Number(x.dataset.price||0),quote=x.dataset.quote==='true';
    if(!quote)extras+=price; else hasQuote=true;
    if(!/^No /.test(x.dataset.name||''))selected.push({name:x.dataset.name,price,quote});
  });
  const detailSelections=activeConfigSelects();
  const subtotal=base+extras;
  const subtotalEl=document.getElementById('subtotal');if(subtotalEl)subtotalEl.textContent=money(subtotal);
  const vatEl=document.getElementById('vat');if(vatEl)vatEl.textContent='Calculated after customer details';
  const totalEl=document.getElementById('total');if(totalEl)totalEl.textContent=money(subtotal);
  const count=document.getElementById('selected-count');if(count)count.textContent=selected.length+' item'+(selected.length===1?'':'s')+' selected';
  const details=document.getElementById('selected-details');
  if(details){details.innerHTML=selected.map(i=>`<div class="selected-detail-row"><span>${i.name}</span><span class="${i.quote?'quote-text':''}">${i.quote?'BY QUOTATION':money(i.price)}</span></div>`).join('')+detailSelections.map(i=>`<div class="selected-detail-row"><span>${i.name}</span><span>${i.value}</span></div>`).join('')}
  const warning=document.getElementById('quote-warning');if(warning)warning.hidden=!hasQuote;
  window.currentConfig={sku:document.body.dataset.sku,name:document.body.dataset.productName,base,extras,subtotal,selected,details:detailSelections,hasQuote};
}

document.querySelectorAll('.product-option').forEach(x=>x.addEventListener('change',updateProduct));
document.querySelectorAll('.config-select').forEach(x=>x.addEventListener('change',updateProduct));
const toggle=document.getElementById('summary-toggle');if(toggle)toggle.addEventListener('click',()=>{const d=document.getElementById('selected-details');if(d){d.classList.toggle('open');toggle.textContent=d.classList.contains('open')?'Hide details':'View details'}});
updateProduct();

function addConfiguredProduct(){
  try{sessionStorage.setItem('simworxConfiguration',JSON.stringify(window.currentConfig,null,2))}catch(e){}
  location.href='contact.html?interest=Cockpit%20Shells%20%26%20Frames&intent=Configuration%20Review';
}
function buyConfiguredProduct(){addConfiguredProduct()}

document.querySelectorAll('.thumb').forEach(t=>t.addEventListener('click',()=>{
  document.querySelectorAll('.thumb').forEach(x=>x.classList.remove('active'));t.classList.add('active');
  const img=t.querySelector('img'),target=document.getElementById('main-product-image');if(target&&img)target.src=img.dataset.full||img.src;
}));
