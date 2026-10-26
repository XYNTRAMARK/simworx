from pathlib import Path
from urllib.request import Request,urlopen
import re,subprocess

BASE="https://www.sim-worx.com"
SOURCE="projection-screen-configurator-v60.html"
TARGET=Path("projection-screen-configurator-v61.html")

req=Request(f"{BASE}/{SOURCE}",headers={"Cache-Control":"no-cache","User-Agent":"Simworx-V61-builder"})
with urlopen(req,timeout=60) as r:
    html=r.read().decode("utf-8","replace")

required=[
    "projection-v60-throw-scale",
    "projection-v59-hide-material-choice",
    "projection-v58-compact-price-bar",
    "compactProposalHtmlForEmail",
    "compactProposalImage",
]
missing=[x for x in required if x not in html]
if missing: raise SystemExit("V61 refused: V60 inheritance/email anchors missing "+repr(missing))

# Replace V57 fixed compression with adaptive hard-cap compression.
pattern=re.compile(r"""  async function compactProposalImage\(dataUrl\)\{.*?  async function compactProposalHtmlForEmail\(html\)\{.*?    return out;\n  \}""",re.S)
replacement=r'''  async function compactProposalImage(dataUrl,maxW=640,maxH=400,quality=0.50){
    if(!dataUrl||!dataUrl.startsWith('data:image/'))return dataUrl;
    return await new Promise(resolve=>{
      const img=new Image();
      img.onload=()=>{
        const scale=Math.min(1,maxW/img.naturalWidth,maxH/img.naturalHeight);
        const canvas=document.createElement('canvas');
        canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));
        canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
        const ctx=canvas.getContext('2d',{alpha:false});
        ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.drawImage(img,0,0,canvas.width,canvas.height);
        resolve(canvas.toDataURL('image/jpeg',quality));
      };
      img.onerror=()=>resolve(dataUrl);
      img.src=dataUrl;
    });
  }

  async function compactProposalHtmlForEmail(html){
    if(!proposalViews.length)return html;
    const limit=650000;
    const tiers=[
      [640,400,0.50],
      [520,325,0.42],
      [440,275,0.34],
      [360,225,0.28],
      [300,188,0.24]
    ];
    for(const [w,h,qv] of tiers){
      const compact=await Promise.all(proposalViews.map(v=>compactProposalImage(v.data,w,h,qv)));
      let out=html;
      proposalViews.forEach((v,i)=>{
        if(v.data&&compact[i])out=out.split(v.data).join(compact[i]);
      });
      if(new TextEncoder().encode(out).length<=limit)return out;
    }
    /* Last-resort email-only fallback: preserve the proposal but omit embedded
       renderer images rather than fail the customer's email submission. */
    return html.replace(/<img[^>]+src=["']data:image\/[^"']+["'][^>]*>/gi,'<div style="padding:18px;background:#f5f6f8;text-align:center">Configured view available in the saved proposal.</div>');
  }'''
html,count=pattern.subn(replacement,html,count=1)
if count!=1: raise SystemExit("V61 adaptive email compaction replacement failed: "+str(count))

checks=[
    "const limit=650000",
    "[300,188,0.24]",
    "Configured view available in the saved proposal.",
    "projection-v60-throw-scale",
]
missing=[x for x in checks if x not in html]
if missing: raise SystemExit("V61 checks failed "+repr(missing))

m=re.search(r'<script id="projection-v37-proposal-js">(.*?)</script>',html,re.S)
if not m: raise SystemExit("V61 proposal script missing")
Path("/tmp/v61-proposal.js").write_text(m.group(1))
subprocess.run(["node","--check","/tmp/v61-proposal.js"],check=True)

TARGET.write_text(html)
print("V61 built from V60: adaptive email-only image compression with hard payload cap")
