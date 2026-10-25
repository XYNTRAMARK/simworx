from pathlib import Path
from urllib.request import Request,urlopen
import re, subprocess

BASE="https://www.sim-worx.com"
SOURCE="projection-screen-configurator-v42.html"
LED="led-screen-configurator.html"
TARGET=Path("projection-screen-configurator-v45.html")

def fetch(name,agent):
    req=Request(f"{BASE}/{name}",headers={"Cache-Control":"no-cache","User-Agent":agent})
    with urlopen(req,timeout=60) as r:
        return r.read().decode("utf-8")

html=fetch(SOURCE,"Simworx-V45-builder")
led=fetch(LED,"Simworx-V45-shell-reference")

required=[
    "projection-v42-proposal-delivery",
    "projection-v42-turnstile-js",
    "projection-v41-projector-priority",
    "projection-v40-fixed-wizard",
]
missing=[x for x in required if x not in html]
if missing: raise SystemExit("V45 refused: V42 inheritance missing "+repr(missing))

def one(pattern,text,label,flags=re.I|re.S):
    m=re.search(pattern,text,flags)
    if not m: raise SystemExit("V45 missing live LED "+label)
    return m.group(0)

header=one(r'<header\b[^>]*class=["\'][^"\']*global-header[^"\']*["\'][^>]*>[\s\S]*?</header>',led,"header")
footer=one(r'<footer\b[^>]*(?:id=["\']sw-global-footer["\']|class=["\'][^"\']*sw-global-footer[^"\']*["\'])[^>]*>[\s\S]*?</footer>',led,"footer")
header_css=one(r'<link[^>]+href=["\'][^"\']*global-header\.css[^"\']*["\'][^>]*>',led,"global header stylesheet")
header_js=one(r'<script[^>]+src=["\'][^"\']*global-header\.js[^"\']*["\'][^>]*></script>',led,"global header script")
footer_js='<script src="/assets/js/global-footer.js"></script>'

footer_style=None
for m in re.finditer(r'<style[^>]*>[\s\S]*?</style>',led,re.I):
    if ".sw-global-footer" in m.group(0) and ".sw-footer-shell" in m.group(0):
        footer_style=m.group(0); break
if not footer_style: raise SystemExit("V45 missing live LED footer styles")

# Replace the placeholder configurator header with the actual live website header.
html,n=re.subn(r'<header\b[^>]*class=["\'][^"\']*global-header[^"\']*["\'][^>]*>[\s\S]*?</header>',header,html,count=1,flags=re.I)
if n!=1: raise SystemExit("V45 placeholder header replacement failed")

# Load the exact shared site assets used by the live LED configurator.
if "global-header.css" not in html:
    html=html.replace("</head>",header_css+"\n"+footer_style+"\n</head>",1)
else:
    if ".sw-global-footer" not in html: html=html.replace("</head>",footer_style+"\n</head>",1)

# Add the normal site footer placeholder after the configurator.
if 'id="sw-global-footer"' not in html:
    pos=html.rfind("</body>")
    html=html[:pos]+footer+"\n"+html[pos:]

# Shared header/footer scripts must execute after the page DOM exists.
pos=html.rfind("</body>")
shell_scripts=""
if "global-header.js" not in html: shell_scripts+=header_js+"\n"
if "global-footer.js" not in html: shell_scripts+=footer_js+"\n"
html=html[:pos]+shell_scripts+html[pos:]

# V40's internal wizard is overridden below to use normal sticky page flow.
# configurator chrome below the live sticky header without changing its workflow.
layout_css=r"""<style id="projection-v45-site-shell">
/* Use the normal website flow like the working LED configurator. */
body{margin:0;padding:0 14px 14px}
.global-header{z-index:12000!important}
.led-shell{
  width:min(1180px,calc(100% - 54px))!important;
  margin:auto!important;
  padding-bottom:64px!important;
}
#projection-app{
  position:relative;
  padding-top:0!important;
}
.led-estimate-bar{
  position:sticky!important;
  top:var(--sw-header-h)!important;
  z-index:50!important;
  margin:0 0 24px!important;
}
#v40-guided-header{
  position:sticky!important;
  top:calc(var(--sw-header-h,84px) + var(--v40-estimate-h))!important;
  z-index:9990!important;
}
#sw-global-footer{
  position:relative;
  z-index:10;
  margin-top:44px;
}
</style>"""
html=html.replace("</head>",layout_css+"\n</head>",1)

checks=[
    'projection-v45-site-shell',
    'href="index.html"',
    'href="simulators.html"',
    'href="visual-systems.html"',
    'href="contact.html"',
    'id="sw-global-footer"',
    'global-header.css',
    'global-header.js',
    'global-footer.js',
    'position:sticky!important',
    'body{margin:0;padding:0 14px 14px}',
    'width:min(1180px,calc(100% - 54px))',
    'top:var(--sw-header-h)!important',
    'top:calc(var(--sw-header-h,84px) + var(--v40-estimate-h))!important',
    'projection-v42-proposal-delivery',
]
missing=[x for x in checks if x not in html]
if missing: raise SystemExit("V45 shell checks failed "+repr(missing))
if 'href="#" data-reference-link' in header:
    raise SystemExit("V45 inherited placeholder header instead of live header")

# Existing critical scripts must remain syntactically valid.
for sid,out in [
    ("projection-v37-proposal-js","/tmp/v45-proposal.js"),
    ("projection-v42-turnstile-js","/tmp/v45-turnstile.js"),
    ("projection-v40-fixed-wizard-js","/tmp/v45-wizard.js"),
]:
    m=re.search(r'<script id="'+re.escape(sid)+r'">(.*?)</script>',html,re.S)
    if not m: raise SystemExit("V45 missing script "+sid)
    Path(out).write_text(m.group(1))
    subprocess.run(["node","--check",out],check=True)

TARGET.write_text(html)
print("V45 built with live Simworx header/footer shell and corrected fixed-bar offsets")
