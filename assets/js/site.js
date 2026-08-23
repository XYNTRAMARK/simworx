const header=document.querySelector('.site-header');
const toggle=document.querySelector('.nav-toggle');
if(toggle) toggle.addEventListener('click',()=>header.classList.toggle('open'));

/*
  Keep mobile and desktop on one source of truth.
  The parity stylesheet is loaded after site.css so responsive rules can reflow
  the current desktop content without hiding or substituting sections.
*/
const parityCss=document.createElement('link');
parityCss.rel='stylesheet';
parityCss.href='assets/css/mobile-sync.css?v=20260823';
document.head.appendChild(parityCss);

/*
  Refresh image URLs to prevent mobile browsers/CDNs holding older revisions of
  assets that retain the same filename. This does not change the selected image;
  it makes every viewport request the current repository asset.
*/
const assetVersion='20260823';
document.querySelectorAll('img[src]').forEach(img=>{
  const src=img.getAttribute('src');
  if(!src || src.startsWith('data:') || src.startsWith('blob:')) return;
  const separator=src.includes('?')?'&':'?';
  if(!src.includes('v=20260823')) img.setAttribute('src',`${src}${separator}v=${assetVersion}`);

  img.addEventListener('error',()=>{
    if(img.dataset.retry==='1') return;
    img.dataset.retry='1';
    const clean=img.getAttribute('src').replace(/([?&])retry=1(&|$)/,'$1').replace(/[?&]$/,'');
    const joiner=clean.includes('?')?'&':'?';
    img.setAttribute('src',`${clean}${joiner}retry=1`);
  });
});

document.querySelectorAll('[data-static-form]').forEach(form=>{
  form.addEventListener('submit',e=>{
    e.preventDefault();
    const data=new FormData(form);
    const lines=[];
    for(const [k,v] of data.entries()) if(String(v).trim()) lines.push(`${k}: ${v}`);
    const subject=encodeURIComponent(form.dataset.subject||'Simworx website enquiry');
    const body=encodeURIComponent(lines.join('\n'));
    window.location.href=`mailto:sales@sim-worx.com?subject=${subject}&body=${body}`;
  });
});
