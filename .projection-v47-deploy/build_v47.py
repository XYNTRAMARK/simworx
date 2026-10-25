from pathlib import Path
from urllib.request import Request,urlopen
import re, subprocess

BASE="https://www.sim-worx.com"
SOURCE="projection-screen-configurator-v42.html"
LED="led-screen-configurator.html"
TARGET=Path("projection-screen-configurator-v47.html")

def fetch(name,agent):
    req=Request(f"{BASE}/{name}",headers={"Cache-Control":"no-cache","User-Agent":agent})
    with urlopen(req,timeout=60) as r:
        return r.read().decode("utf-8")

html=fetch(SOURCE,"Simworx-V47-builder")
led=fetch(LED,"Simworx-V47-shell-reference")

required=[
    "projection-v42-proposal-delivery",
    "projection-v42-turnstile-js",
    "projection-v41-projector-priority",
    "projection-v40-fixed-wizard",
]
missing=[x for x in required if x not in html]
if missing: raise SystemExit("V47 refused: V42 inheritance missing "+repr(missing))

def one(pattern,text,label,flags=re.I|re.S):
    m=re.search(pattern,text,flags)
    if not m: raise SystemExit("V47 missing live LED "+label)
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
if not footer_style: raise SystemExit("V47 missing live LED footer styles")

# Make the standalone Projection document use the same body scrolling context as LED.
html,n_body=re.subn(r'<body(?:\s[^>]*)?>','<body class="led-page">',html,count=1,flags=re.I)
if n_body!=1: raise SystemExit("V47 body class replacement failed")

# Remove the development/preview banner that otherwise sits above the website header.
html,n_banner=re.subn(r'<div\s+id=["\']projection-offline-banner["\'][^>]*>[\s\S]*?</div>','',html,count=1,flags=re.I)
if n_banner not in {0,1}: raise SystemExit("V47 preview banner removal was ambiguous")

# Replace the placeholder configurator header with the actual live website header.
html,n=re.subn(r'<header\b[^>]*class=["\'][^"\']*global-header[^"\']*["\'][^>]*>[\s\S]*?</header>',header,html,count=1,flags=re.I)
if n!=1: raise SystemExit("V47 placeholder header replacement failed")

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
layout_css=r"""<style id="projection-v47-site-shell">
/* V47: exact outer behaviour of the live LED configurator. */
body.led-page{margin:0!important;padding:0!important}
#projection-app.led-shell{
  box-sizing:border-box!important;
  width:min(1180px,calc(100% - 54px))!important;
  max-width:none!important;
  margin-left:auto!important;
  margin-right:auto!important;
  padding:0 0 64px!important;
}
.led-estimate-bar{
  position:sticky!important;
  top:var(--sw-header-h)!important;
  left:auto!important;
  right:auto!important;
  width:auto!important;
  max-width:none!important;
  z-index:50!important;
  display:grid!important;
  grid-template-columns:160px minmax(0,1fr)!important;
  align-items:center!important;
  gap:16px!important;
  margin:0 0 24px!important;
  padding:16px 20px!important;
  border:1px solid #d8dfe5!important;
  border-left:1px solid #d8dfe5!important;
  border-bottom:3px solid #d2a000!important;
  border-radius:6px!important;
  background:#fff!important;
  box-shadow:0 5px 14px #17202a09!important;
}
#v40-guided-header{
  position:sticky!important;
  top:calc(var(--sw-header-h) + var(--v40-estimate-h))!important;
  left:auto!important;
  right:auto!important;
  width:auto!important;
  z-index:49!important;
  margin:0!important;
}
#sw-global-footer{position:relative;z-index:10;margin-top:44px}
@media(max-width:720px){
  #projection-app.led-shell{width:calc(100% - 30px)!important;padding-bottom:38px!important}
  .led-estimate-bar{
    grid-template-columns:minmax(0,1fr)!important;
    gap:10px 12px!important;
    padding:12px 14px!important;
    margin-bottom:20px!important;
  }
}
</style>"""
html=html.replace("</head>",layout_css+"\n</head>",1)

checks=[
    'projection-v47-site-shell',
    'href="index.html"',
    'href="simulators.html"',
    'href="visual-systems.html"',
    'href="contact.html"',
    'id="sw-global-footer"',
    'global-header.css',
    'global-header.js',
    'global-footer.js',
    'body.led-page{margin:0!important;padding:0!important}',
    '#projection-app.led-shell',
    'width:min(1180px,calc(100% - 54px))',
    'top:var(--sw-header-h)!important',
    'left:auto!important',
    'right:auto!important',
    'top:calc(var(--sw-header-h) + var(--v40-estimate-h))!important',
    'projection-v42-proposal-delivery',
]
missing=[x for x in checks if x not in html]
if missing: raise SystemExit("V47 shell checks failed "+repr(missing))
if re.search(r'<[^>]+class=["\'][^"\']*projection-preview-banner[^"\']*["\']',html,re.I): raise SystemExit("V47 preview banner element still present")
body_pos=html.lower().find('<body')
header_pos=html.find('<header class="global-header">',body_pos)
between=html[html.find('>',body_pos)+1:header_pos]
if re.search(r'<(?:style|link)\\b',between,re.I): raise SystemExit("V47 presentation assets still precede header in body")
if 'href="#" data-reference-link' in header:
    raise SystemExit("V47 inherited placeholder header instead of live header")

# The inherited standalone file accumulated later-version style/link nodes at
# the start of <body>. The live LED page keeps presentation assets in <head>,
# with the visible body beginning at the website header. Restore that structure.
body_header=re.search(r'(<body[^>]*>)([\s\S]*?)(<header\b[^>]*class=["\'][^"\']*global-header[^"\']*["\'][^>]*>)',html,re.I)
if not body_header: raise SystemExit("V47 could not locate pre-header body assets")
preamble=body_header.group(2)
remainder=re.sub(r'<style\b[^>]*>[\s\S]*?</style>','',preamble,flags=re.I)
remainder=re.sub(r'<link\b[^>]*>','',remainder,flags=re.I)
if remainder.strip():
    raise SystemExit("V47 found unexpected visible content before website header: "+repr(remainder.strip()[:160]))
html=html[:body_header.start(2)]+html[body_header.end(2):]
head_close=html.lower().find('</head>')
body_start=html.lower().find('<body')
if head_close<0 or body_start<0 or head_close>body_start:
    raise SystemExit("V47 could not resolve the real document head")
html=html[:head_close]+preamble+"\n"+html[head_close:]

# Remove standalone-only content between the live website header and the
# configurator main. Runtime inspection proved the only visible inherited node
# in this gap is the standalone preview strip.
html,n_preview=re.subn(r'(</header>)[\s\S]*?(?=<main\b)',r'\1\n',html,count=1,flags=re.I)
if n_preview!=1: raise SystemExit("V47 could not normalise header-to-main structure")

# Existing critical scripts must remain syntactically valid.
for sid,out in [
    ("projection-v37-proposal-js","/tmp/v47-proposal.js"),
    ("projection-v42-turnstile-js","/tmp/v47-turnstile.js"),
    ("projection-v40-fixed-wizard-js","/tmp/v47-wizard.js"),
]:
    m=re.search(r'<script id="'+re.escape(sid)+r'">(.*?)</script>',html,re.S)
    if not m: raise SystemExit("V47 missing script "+sid)
    Path(out).write_text(m.group(1))
    subprocess.run(["node","--check",out],check=True)

TARGET.write_text(html)
print("V47 built with live Simworx header/footer shell and corrected fixed-bar offsets")
