(()=>{
  const root=document.querySelector('[data-frame-configurator]'); if(!root) return;
  const product=root.dataset.product||'Cockpit Structure';
  const inputs=[...root.querySelectorAll('input[data-item]')];
  const lines=document.getElementById('framecfg-lines');
  const total=document.getElementById('framecfg-total');
  const count=document.getElementById('framecfg-count');
  const warning=document.getElementById('framecfg-warning');
  const compTitle=document.getElementById('framecfg-component-title');
  const compCopy=document.getElementById('framecfg-component-copy');

  const euro=n=>new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR'}).format(n);
  const selected=()=>inputs.filter(i=>i.checked);
  function refresh(last){
    const sel=selected(); let subtotal=0,pending=0;
    lines.innerHTML='';
    if(!sel.length){lines.innerHTML='<div class="framecfg-empty">No components selected yet.</div>';}
    sel.forEach(i=>{
      const raw=i.dataset.price; const priced=raw!==undefined && raw!=='' && !Number.isNaN(Number(raw));
      const price=priced?Number(raw):null;
      if(price!==null) subtotal+=price; else pending++;
      const row=document.createElement('div'); row.className='framecfg-line';
      row.innerHTML='<span>'+i.dataset.item+'</span><strong>'+(price===null?'PRICE PENDING':price===0?'NO EXTRA COST':euro(price))+'</strong>';
      lines.appendChild(row);
    });
    total.textContent=euro(subtotal);
    count.textContent=sel.length+' selected';
    warning.hidden=!pending;
    if(pending) warning.textContent=pending+' selected item'+(pending===1?' has':'s have')+' pricing still to be confirmed and '+(pending===1?'is':'are')+' not included in the displayed subtotal.';
    if(last){compTitle.textContent=last.dataset.item;compCopy.textContent=last.dataset.description||'Component image and detailed description will be added when supplied.';}
  }
  inputs.forEach(i=>i.addEventListener('change',()=>refresh(i)));
  const go=(formal)=>{
    const sel=selected();
    if(!sel.length){alert('Select at least one component first.');return;}
    const cfg=sel.map(i=>i.dataset.item+(i.dataset.price!==undefined&&i.dataset.price!==''?' ('+(Number(i.dataset.price)===0?'No extra cost':euro(Number(i.dataset.price)))+')':' (Price pending)')).join('; ');
    const qs=new URLSearchParams({interest:'Cockpit Shells & Frames',platform:product,configuration:cfg,quote:formal?'Formal quote':'Configuration review'});
    location.href='contact.html?'+qs.toString();
  };
  document.getElementById('framecfg-review')?.addEventListener('click',()=>go(false));
  document.getElementById('framecfg-quote')?.addEventListener('click',()=>go(true));
  refresh();
})();