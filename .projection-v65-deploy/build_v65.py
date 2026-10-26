from pathlib import Path
from urllib.request import Request,urlopen
import re,subprocess

BASE="https://www.sim-worx.com"
SOURCE="projection-screen-configurator-v64.html"
TARGET=Path("projection-screen-configurator-v65.html")

req=Request(f"{BASE}/{SOURCE}",headers={"Cache-Control":"no-cache","User-Agent":"Simworx-V65-builder"})
with urlopen(req,timeout=60) as r:
    html=r.read().decode("utf-8","replace")

required=[
    "projection-v64-hide-recalculate-strip",
    "projection-v63-clear-email-status",
    "HTMLFormElement.prototype.submit.call(form)",
    'id="v37-print-proposal"',
    'id="v37-email-proposal"',
    'id="projection-print-document"',
]
missing=[x for x in required if x not in html]
if missing: raise SystemExit("V65 refused: V64 inheritance/PDF anchors missing "+repr(missing))

# Existing action becomes explicitly Print; add a separate true Save PDF action.
if '>Save proposal as PDF<' in html:
    html=html.replace('>Save proposal as PDF<','>Print proposal<',1)
elif '>Print / save PDF<' in html:
    html=html.replace('>Print / save PDF<','>Print proposal<',1)
elif '>Print proposal<' not in html:
    raise SystemExit("V65 could not identify print button label")

anchor='<button type="button" class="led-button v37-primary" id="v37-print-proposal">Print proposal</button>'
if anchor not in html:
    # account for historical class ordering while retaining the existing element
    m=re.search(r'<button type="button" class="([^"]*)" id="v37-print-proposal">Print proposal</button>',html)
    if not m: raise SystemExit("V65 print button anchor missing")
    anchor=m.group(0)

save_button='<button type="button" class="led-button v37-primary" id="v65-save-pdf">Save PDF</button>'
html=html.replace(anchor,save_button+anchor.replace('class="led-button v37-primary"','class="led-button led-outline"'),1)

dialog=r'''<dialog id="v65-save-pdf-dialog">
<div class="v37-email-body">
<h3>Save proposal as PDF</h3>
<p class="led-help">Enter your email address to download your configured SIMWORX proposal as a PDF.</p>
<div class="v37-email-fields">
<label>Email address<input id="v65-save-email" type="email" required maxlength="254" autocomplete="email" placeholder="name@example.com"></label>
</div>
<div class="v37-proposal-actions">
<button type="button" class="led-button v37-primary" id="v65-save-confirm">Save PDF</button>
<button type="button" class="led-button led-outline" id="v65-save-cancel">Cancel</button>
</div>
<p id="v65-save-status" class="led-help" role="status" aria-live="polite"></p>
</div>
</dialog>'''
if '</main>' not in html: raise SystemExit("V65 main close missing")
html=html.replace('</main>',dialog+'\n</main>',1)

css=r"""<style id="projection-v65-real-pdf">
#v65-save-pdf-dialog{max-width:560px;width:calc(100% - 30px);border:1px solid #cbd5e1;border-radius:10px;padding:0}
#v65-save-pdf-dialog::backdrop{background:rgba(15,23,42,.45)}
#v65-save-status.v65-error{color:#a61b1b;font-weight:700}
#v65-save-status.v65-success{color:#16733a;font-weight:700}
#v65-pdf-render-root{
  position:fixed;
  left:-12000px;
  top:0;
  width:794px;
  background:#fff;
  color:#17202a;
  padding:42px;
  box-sizing:border-box;
  font:14px/1.5 Arial,sans-serif;
  z-index:-1;
}
#v65-pdf-render-root table{width:100%;border-collapse:collapse}
#v65-pdf-render-root th,#v65-pdf-render-root td{padding:8px;border-bottom:1px solid #ddd;text-align:left}
#v65-pdf-render-root img{max-width:100%;height:auto}
</style>"""
html=html.replace("</head>",css+"\n</head>",1)

js=r"""<script id="projection-v65-real-pdf-js">
(function(){
  const q=id=>document.getElementById(id);
  const save=q('v65-save-pdf'),dialog=q('v65-save-pdf-dialog'),email=q('v65-save-email');
  const confirm=q('v65-save-confirm'),cancel=q('v65-save-cancel'),status=q('v65-save-status');
  const print=q('v37-print-proposal'),emailProposal=q('v37-email-address');
  if(!save||!dialog||!email||!confirm||!cancel||!status||!print)return;

  function loadScript(src,test){
    if(test())return Promise.resolve();
    return new Promise((resolve,reject)=>{
      const existing=[...document.scripts].find(s=>s.src===src);
      if(existing){
        existing.addEventListener('load',()=>test()?resolve():reject(new Error('PDF library did not initialise.')),{once:true});
        existing.addEventListener('error',()=>reject(new Error('PDF library could not be loaded.')),{once:true});
        return;
      }
      const s=document.createElement('script');
      s.src=src;s.async=true;
      s.onload=()=>test()?resolve():reject(new Error('PDF library did not initialise.'));
      s.onerror=()=>reject(new Error('PDF library could not be loaded.'));
      document.head.appendChild(s);
    });
  }

  async function ensurePdfLibraries(){
    await loadScript('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js',()=>typeof window.html2canvas==='function');
    await loadScript('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',()=>Boolean(window.jspdf?.jsPDF));
  }

  function openSave(){
    status.textContent='';
    status.classList.remove('v65-error','v65-success');
    const remembered=(emailProposal?.value||localStorage.getItem('simworxProjectionPdfEmail')||'').trim();
    email.value=remembered;
    dialog.showModal();
    setTimeout(()=>email.focus(),50);
  }

  async function preparePrintableDocument(){
    const target=q('projection-print-document');
    if(!target)throw new Error('The proposal document is unavailable.');
    const before=target.getAttribute('data-proposal-reference')||'';
    const originalPrint=window.print;
    window.print=()=>{};
    try{
      print.click();
      for(let i=0;i<50;i++){
        await new Promise(r=>setTimeout(r,100));
        const current=target.getAttribute('data-proposal-reference')||'';
        if(target.innerHTML.includes('System specification')&&target.innerHTML.includes('Commercial proposal')&&(current||before))break;
      }
      await new Promise(r=>setTimeout(r,250));
    }finally{
      window.print=originalPrint;
    }
    if(!target.innerHTML.includes('System specification')||!target.innerHTML.includes('Commercial proposal')){
      throw new Error('The proposal could not be prepared.');
    }
    return target;
  }

  async function makePdf(address){
    await ensurePdfLibraries();
    const source=await preparePrintableDocument();
    const root=document.createElement('div');
    root.id='v65-pdf-render-root';
    root.innerHTML=source.innerHTML;
    const prepared=document.createElement('p');
    prepared.innerHTML='<strong>Prepared for:</strong> '+address.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const firstHeading=root.querySelector('h1');
    if(firstHeading)firstHeading.insertAdjacentElement('afterend',prepared);else root.prepend(prepared);
    document.body.appendChild(root);

    try{
      const images=[...root.querySelectorAll('img')];
      await Promise.all(images.map(img=>img.complete?Promise.resolve():new Promise(resolve=>{
        img.addEventListener('load',resolve,{once:true});img.addEventListener('error',resolve,{once:true});
      })));
      const canvas=await window.html2canvas(root,{scale:1.45,useCORS:true,backgroundColor:'#ffffff',logging:false,width:794,windowWidth:794});
      const img=canvas.toDataURL('image/jpeg',0.88);
      const {jsPDF}=window.jspdf;
      const pdf=new jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true});
      const pageW=210,pageH=297;
      const imgH=canvas.height*pageW/canvas.width;
      let offset=0;
      pdf.addImage(img,'JPEG',0,-offset,pageW,imgH,undefined,'FAST');
      while(offset+pageH<imgH){
        offset+=pageH;
        pdf.addPage();
        pdf.addImage(img,'JPEG',0,-offset,pageW,imgH,undefined,'FAST');
      }
      const ref=source.getAttribute('data-proposal-reference')||'SIMWORX';
      const safe=ref.replace(/[^A-Za-z0-9._-]+/g,'_');
      pdf.save('Simworx_Projection_Proposal_'+safe+'.pdf');
    }finally{
      root.remove();
    }
  }

  save.addEventListener('click',openSave);
  cancel.addEventListener('click',()=>dialog.close());
  confirm.addEventListener('click',async()=>{
    if(!email.reportValidity())return;
    const address=email.value.trim();
    localStorage.setItem('simworxProjectionPdfEmail',address);
    if(emailProposal&&!emailProposal.value)emailProposal.value=address;
    status.classList.remove('v65-error','v65-success');
    status.textContent='Creating PDF…';
    confirm.disabled=true;
    try{
      await makePdf(address);
      status.textContent='PDF saved.';
      status.classList.add('v65-success');
      setTimeout(()=>dialog.close(),650);
    }catch(error){
      status.textContent=error?.message||'The PDF could not be created.';
      status.classList.add('v65-error');
    }finally{
      confirm.disabled=false;
    }
  });
})();
</script>"""
body_close=html.rfind("</body>")
if body_close<0: raise SystemExit("V65 body close missing")
html=html[:body_close]+js+"\n"+html[body_close:]

checks=[
    'id="v65-save-pdf"',
    'id="v65-save-pdf-dialog"',
    'id="v65-save-email"',
    '>Print proposal<',
    'html2canvas@1.4.1',
    'jspdf@2.5.1',
    "pdf.save('Simworx_Projection_Proposal_'",
    "localStorage.setItem('simworxProjectionPdfEmail'",
    "projection-v64-hide-recalculate-strip",
]
missing=[x for x in checks if x not in html]
if missing: raise SystemExit("V65 checks failed "+repr(missing))

m=re.search(r'<script id="projection-v65-real-pdf-js">(.*?)</script>',html,re.S)
if not m: raise SystemExit("V65 script missing")
Path("/tmp/v65.js").write_text(m.group(1))
subprocess.run(["node","--check","/tmp/v65.js"],check=True)

TARGET.write_text(html)
print("V65 built from V64: real Save PDF action gated by email, separate Print action")
