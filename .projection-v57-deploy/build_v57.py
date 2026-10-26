from pathlib import Path
from urllib.request import Request,urlopen
import re,subprocess

BASE="https://www.sim-worx.com"
SOURCE="projection-screen-configurator-v56.html"
TARGET=Path("projection-screen-configurator-v57.html")

req=Request(f"{BASE}/{SOURCE}",headers={"Cache-Control":"no-cache","User-Agent":"Simworx-V57-builder"})
with urlopen(req,timeout=60) as r:
    html=r.read().decode("utf-8","replace")

required=[
    "projection-v56-restore-projector-controls",
    "projection-v55-vat-selection",
    "projection-v54-step3-reversible-js",
    "projection-v52-proposal-views",
    "async function emailProposal(event){",
    "proposalHtml=documentHtml();",
]
missing=[x for x in required if x not in html]
if missing: raise SystemExit("V57 refused: V56 inheritance/email anchors missing "+repr(missing))

helper=r'''
  async function compactProposalImage(dataUrl){
    if(!dataUrl||!dataUrl.startsWith('data:image/'))return dataUrl;
    return await new Promise(resolve=>{
      const img=new Image();
      img.onload=()=>{
        const maxW=640,maxH=400;
        const scale=Math.min(1,maxW/img.naturalWidth,maxH/img.naturalHeight);
        const canvas=document.createElement('canvas');
        canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));
        canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
        const ctx=canvas.getContext('2d',{alpha:false});
        ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.drawImage(img,0,0,canvas.width,canvas.height);
        resolve(canvas.toDataURL('image/jpeg',0.50));
      };
      img.onerror=()=>resolve(dataUrl);
      img.src=dataUrl;
    });
  }

  async function compactProposalHtmlForEmail(html){
    if(!proposalViews.length)return html;
    const compact=await Promise.all(proposalViews.map(v=>compactProposalImage(v.data)));
    let out=html;
    proposalViews.forEach((v,i)=>{
      if(v.data&&compact[i])out=out.split(v.data).join(compact[i]);
    });
    return out;
  }
'''
anchor="  async function emailProposal(event){"
if anchor not in html: raise SystemExit("V57 email function anchor missing")
html=html.replace(anchor,helper+"\n"+anchor,1)

old="      proposalHtml=documentHtml();\n      proposalText=plainText();"
new="      proposalHtml=documentHtml();\n      proposalHtml=await compactProposalHtmlForEmail(proposalHtml);\n      proposalText=plainText();"
if old not in html: raise SystemExit("V57 proposal assembly anchor missing")
html=html.replace(old,new,1)

checks=[
    "compactProposalImage",
    "compactProposalHtmlForEmail",
    "toDataURL('image/jpeg',0.50)",
    "maxW=640,maxH=400",
    "projection-v56-restore-projector-controls",
]
missing=[x for x in checks if x not in html]
if missing: raise SystemExit("V57 checks failed "+repr(missing))

m=re.search(r'<script id="projection-v37-proposal-js">(.*?)</script>',html,re.S)
if not m: raise SystemExit("V57 proposal script missing")
Path("/tmp/v57-proposal.js").write_text(m.group(1))
subprocess.run(["node","--check","/tmp/v57-proposal.js"],check=True)

TARGET.write_text(html)
print("V57 built from V56: email-only image compaction keeps proposal POST below 1 MB without changing layout/PDF")
