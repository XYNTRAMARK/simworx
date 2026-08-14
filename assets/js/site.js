const header=document.querySelector('.site-header');
const toggle=document.querySelector('.nav-toggle');
if(toggle) toggle.addEventListener('click',()=>header.classList.toggle('open'));

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
