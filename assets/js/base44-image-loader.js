(() => {
  const url = String(window.SIMWORX_BASE44_MANIFEST_URL || '').trim();
  const state = window.SIMWORX_IMAGE_MANIFEST_STATE = {configured:!!url,url,loaded:false,applied:0,fallback:0,missing:0,error:null};

  const normaliseAssets = payload => {
    let raw = payload?.assets ?? payload?.data?.assets ?? payload?.manifest?.assets ?? payload?.data ?? payload;
    if(Array.isArray(raw)){
      const out={}; raw.forEach(item=>{const key=item?.key??item?.assetKey??item?.asset_key??item?.id;if(key)out[key]=item}); return out;
    }
    return raw && typeof raw==='object' ? raw : {};
  };
  const urlFromRecord = record => {
    if(!record) return '';
    if(typeof record==='string') return record;
    return record.url||record.publishedImageUrl||record.published_image_url||record.publishedUrl||record.published_url||record.imageUrl||record.image_url||record.fileUrl||record.file_url||'';
  };
  const ready = el => { if(el.tagName==='IMG') el.classList.add('simworx-image-ready'); };
  const fallbackFor = el => el.dataset.fallbackSrc || el.getAttribute('src') || '';

  function apply(el, primary){
    const fallback=fallbackFor(el);
    const target=el.dataset.assetTarget || (el.tagName==='IMG'?'src':'');
    if(target==='backgroundImage'){
      const chosen=primary||fallback;
      if(chosen) el.style.backgroundImage=`url("${chosen.replace(/"/g,'\\"')}")`;
      return Promise.resolve(primary?'applied':(chosen?'fallback':'missing'));
    }
    if(target && target!=='src'){
      const chosen=primary||fallback;
      if(chosen) el.setAttribute(target,chosen);
      return Promise.resolve(primary?'applied':(chosen?'fallback':'missing'));
    }
    if(el.tagName!=='IMG') return Promise.resolve('missing');
    if(!primary){ ready(el); return Promise.resolve(fallback?'fallback':'missing'); }
    return new Promise(resolve=>{
      const pre=new Image();
      pre.onload=()=>{el.src=primary;ready(el);resolve('applied')};
      pre.onerror=()=>{if(fallback&&!el.getAttribute('src'))el.src=fallback;ready(el);resolve(fallback?'fallback':'missing')};
      pre.src=primary;
    });
  }

  const manifestPromise = url ? fetch(url,{method:'GET',mode:'cors',cache:'no-store',headers:{Accept:'application/json'}})
    .then(r=>{if(!r.ok)throw new Error(`Manifest HTTP ${r.status}`);return r.json()}) : Promise.resolve(null);

  async function run(){
    const els=[...document.querySelectorAll('[data-asset-key]')];
    try{
      if(!url) throw new Error('Manifest URL not configured');
      const assets=normaliseAssets(await manifestPromise);
      const results=await Promise.all(els.map(el=>apply(el,urlFromRecord(assets[el.dataset.assetKey]))));
      results.forEach(x=>{if(x==='applied')state.applied++;else if(x==='fallback')state.fallback++;else state.missing++});
      state.loaded=true;
      document.dispatchEvent(new CustomEvent('simworx:images-updated',{detail:{assets,applied:state.applied,fallback:state.fallback,missing:state.missing}}));
    }catch(err){
      state.error=String(err?.message||err);
      els.forEach(el=>{if(el.tagName==='IMG'){if(!el.getAttribute('src')&&fallbackFor(el))el.src=fallbackFor(el);ready(el)}else if(el.dataset.assetTarget==='backgroundImage'&&!el.style.backgroundImage&&fallbackFor(el)){el.style.backgroundImage=`url("${fallbackFor(el)}")`}});
      console.warn('[Simworx] Base44 manifest unavailable; local fallback images retained.',err);
    }
  }
  // Absolute failsafe: reveal valid local src images even if a network request stalls.
  setTimeout(()=>document.querySelectorAll('img[data-asset-key]').forEach(ready),1200);
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',run,{once:true}); else run();
})();
