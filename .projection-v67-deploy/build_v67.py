from pathlib import Path
from urllib.request import Request,urlopen
import re,subprocess

BASE="https://www.sim-worx.com"
SOURCE="projection-screen-configurator-v66.html"
TARGET=Path("projection-screen-configurator-v67.html")

req=Request(f"{BASE}/{SOURCE}",headers={"Cache-Control":"no-cache","User-Agent":"Simworx-V67-builder"})
with urlopen(req,timeout=60) as r:
    html=r.read().decode("utf-8","replace")

required=[
    "projection_images",
    "cid:projection-view-",
    "projection-v65-real-pdf-js",
    "compactProposalImage",
    "async function emailProposal(event){",
]
missing=[x for x in required if x not in html]
if missing: raise SystemExit("V67 refused: V66 inheritance/email anchors missing "+repr(missing))

old="""    const images=(proposalViews||[]).slice(0,4).map((v,i)=>({
      label:v.label||['3D perspective','Front elevation','Top plan','Side elevation'][i]||('View '+(i+1)),
      data:v.data
    }));
    images.forEach((image,i)=>{
      if(image.data)proposalHtml=proposalHtml.split(image.data).join('cid:projection-view-'+(i+1)+'@sim-worx.com');
    });
"""

new="""    const sourceViews=(proposalViews||[]).slice(0,4);
    const tiers=[
      [640,400,0.50],
      [520,325,0.42],
      [440,275,0.34],
      [360,225,0.28],
      [300,188,0.24]
    ];
    let images=[];
    for(const [w,h,qv] of tiers){
      images=await Promise.all(sourceViews.map(async(v,i)=>({
        label:v.label||['3D perspective','Front elevation','Top plan','Side elevation'][i]||('View '+(i+1)),
        data:await compactProposalImage(v.data,w,h,qv)
      })));
      if(new TextEncoder().encode(JSON.stringify(images)).length<=650000)break;
    }
    if(new TextEncoder().encode(JSON.stringify(images)).length>650000){
      images=[];
    }
    sourceViews.forEach((view,i)=>{
      if(view.data)proposalHtml=proposalHtml.split(view.data).join('cid:projection-view-'+(i+1)+'@sim-worx.com');
    });
"""

if old not in html: raise SystemExit("V67 V66 image payload block missing")
html=html.replace(old,new,1)

checks=[
    "const tiers=[",
    "JSON.stringify(images)).length<=650000",
    "data:await compactProposalImage",
    "projection_images",
    "projection-v65-real-pdf-js",
]
missing=[x for x in checks if x not in html]
if missing: raise SystemExit("V67 checks failed "+repr(missing))

m=re.search(r'<script id="projection-v37-proposal-js">(.*?)</script>',html,re.S)
if not m: raise SystemExit("V67 proposal script missing")
Path("/tmp/v67-proposal.js").write_text(m.group(1))
subprocess.run(["node","--check","/tmp/v67-proposal.js"],check=True)

TARGET.write_text(html)
print("V67 built from V66: LED-style separate images now adaptively compressed below 650KB")
