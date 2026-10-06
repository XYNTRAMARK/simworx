const eur = value => new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR'}).format(value);
const inputs=[...document.querySelectorAll('.option-row input')];
const stage=document.getElementById('config-stage');
const layerLabels=[...document.querySelectorAll('[data-layer-label]')];
const mipWrap=document.getElementById('mip-format-wrap');
let lastInput=document.querySelector('input[name="shell"]:checked');

function selectedInputs(){return inputs.filter(i=>i.checked && !(/^No /.test(i.dataset.name||'')));}
function currentShell(){return document.querySelector('input[name="shell"]:checked');}

function updateRows(){
  document.querySelectorAll('.option-row').forEach(row=>row.classList.toggle('selected',row.querySelector('input').checked));
  const mip=document.querySelector('input[data-key="mip"]');
  mipWrap.classList.toggle('visible',mip.checked);
}

function updateSummary(){
  const selected=selectedInputs();
  let subtotal=0,priced=0,hasTbc=false;
  const lines=[];
  selected.forEach(input=>{
    const price=Number(input.dataset.price||0),tbc=input.dataset.tbc==='true';
    if(!tbc){subtotal+=price;priced++;} else hasTbc=true;
    let name=input.dataset.name;
    if(input.dataset.key==='mip' && input.checked) name += ` (${document.getElementById('mip-format').value})`;
    lines.push(`<div class="line-item"><span>${name}</span><span class="${tbc?'tbc-price':''}">${tbc?'BY QUOTATION':eur(price)}</span></div>`);
  });
  document.getElementById('line-items').innerHTML=lines.join('');
  document.getElementById('subtotal').textContent=eur(subtotal);
  document.getElementById('count').textContent=`${priced} priced item${priced===1?'':'s'} selected${hasTbc?' + quotation items':''}`;
  document.getElementById('tbc-warning').hidden=!hasTbc;
}

function updateHero(){
  const selected=selectedInputs();
  const keys=new Set(selected.map(i=>i.dataset.key));
  const control=document.querySelector('input[name="controls"]:checked');
  if(control){
    if(control.dataset.key==='both'){keys.add('cpt');keys.add('fo');}
    if(control.dataset.key==='cpt')keys.add('cpt');
    if(control.dataset.key==='fo')keys.add('fo');
  }
  layerLabels.forEach(label=>label.classList.toggle('visible',keys.has(label.dataset.layerLabel)));
  const shell=currentShell();
  document.getElementById('stage-title').textContent=shell.dataset.name;
  const extraCount=selected.filter(i=>i!==shell).length;
  document.getElementById('stage-copy').textContent=extraCount?`${extraCount} additional component${extraCount===1?'':'s'} selected in your configuration.`:'Choose components to build your A320 cockpit configuration.';
}

function showLast(input,removed=false){
  if(!input || /^No /.test(input.dataset.name||''))return;
  document.getElementById('component-title').textContent=input.dataset.name;
  document.getElementById('component-description').textContent=input.dataset.description||'Product description will be added.';
  if(input.dataset.image)document.getElementById('component-image').src=input.dataset.image;
  const tbc=input.dataset.tbc==='true';
  document.getElementById('component-price').textContent=tbc?'BY QUOTATION':eur(Number(input.dataset.price||0));
  document.getElementById('component-status').textContent=removed?'REMOVED':(input.checked?'SELECTED':'VIEWING');
}

function refresh(input,removed=false){updateRows();updateSummary();updateHero();showLast(input,removed);}
inputs.forEach(input=>input.addEventListener('change',()=>{lastInput=input;refresh(input,input.type==='checkbox'&&!input.checked)}));
document.getElementById('mip-format').addEventListener('change',()=>{updateSummary();showLast(document.querySelector('input[data-key="mip"]'))});
document.querySelectorAll('.angle').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.angle').forEach(b=>b.classList.remove('active'));btn.classList.add('active');stage.dataset.angle=btn.dataset.angle;}));
refresh(lastInput);

// Drag/swipe the hero left or right to snap between the three fixed CAD camera angles.
const angleOrder=['front','captain','fo'];
let dragStartX=null;
function setAngle(angle){
  document.querySelectorAll('.angle').forEach(b=>b.classList.toggle('active',b.dataset.angle===angle));
  stage.dataset.angle=angle;
}
stage.addEventListener('pointerdown',e=>{dragStartX=e.clientX;stage.setPointerCapture?.(e.pointerId);stage.classList.add('dragging')});
stage.addEventListener('pointerup',e=>{
  if(dragStartX===null)return;
  const dx=e.clientX-dragStartX; dragStartX=null; stage.classList.remove('dragging');
  if(Math.abs(dx)<45)return;
  const current=stage.dataset.angle||'front',idx=angleOrder.indexOf(current);
  const next=dx<0?Math.min(angleOrder.length-1,idx+1):Math.max(0,idx-1);
  setAngle(angleOrder[next]);
});

document.addEventListener('simworx:images-updated',()=>{ refresh(lastInput); });


function configurationText(intent){
  const selected=selectedInputs();
  const priced=[], quoted=[];
  selected.forEach(input=>{
    let name=input.dataset.name||'Component';
    if(input.dataset.key==='mip' && input.checked) name += ` (${document.getElementById('mip-format').value})`;
    if(input.dataset.tbc==='true') quoted.push(name); else priced.push(`${name}: ${eur(Number(input.dataset.price||0))}`);
  });
  const subtotal=selected.filter(i=>i.dataset.tbc!=='true').reduce((sum,i)=>sum+Number(i.dataset.price||0),0);
  return [`A320 configuration enquiry — ${intent}`, '', 'Priced items:', ...(priced.length?priced:['None']), '', 'Available by quotation:', ...(quoted.length?quoted:['None']), '', `Subtotal excluding VAT: ${eur(subtotal)}`, 'Taxes, shipping and installation are subject to confirmation.'].join('\n');
}
function openEnquiry(intent){
  try{sessionStorage.setItem('simworxConfiguration',configurationText(intent))}catch(e){}
  const params=new URLSearchParams({interest:'Cockpit Shells & Frames',platform:'A320 Cockpit Configurator',intent});
  location.href=`contact.html?${params.toString()}`;
}
document.getElementById('submit-config-review')?.addEventListener('click',()=>openEnquiry('Configuration Review'));
document.getElementById('request-formal-quote')?.addEventListener('click',()=>openEnquiry('Formal Quote'));
document.getElementById('request-custom-quote')?.addEventListener('click',()=>openEnquiry('Custom A320 Structure'));
