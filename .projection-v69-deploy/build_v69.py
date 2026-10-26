from pathlib import Path
from urllib.request import Request,urlopen
import re,subprocess

BASE="https://www.sim-worx.com"
SOURCE="projection-screen-configurator-v68.html"
TARGET=Path("projection-screen-configurator-v69.html")

req=Request(f"{BASE}/{SOURCE}",headers={"Cache-Control":"no-cache","User-Agent":"Simworx-V69-builder"})
with urlopen(req,timeout=60) as r:
    html=r.read().decode("utf-8","replace")

required=[
    "installOfflineAPI",
    "payload.set('quote_action','projection-email')",
    'action="led-quote-submit.php"',
    "projection-v65-real-pdf-js",
]
missing=[x for x in required if x not in html]
if missing: raise SystemExit("V69 refused: V68 inheritance/fetch anchors missing "+repr(missing))

early=r'''<script id="projection-v69-native-fetch-capture">
window.__simworxProjectionNativeFetch = window.fetch.bind(window);
</script>'''
if "<head>" not in html: raise SystemExit("V69 head missing")
html=html.replace("<head>","<head>\n"+early,1)

late=r'''<script id="projection-v69-fetch-router">
(function(){
  const nativeFetch=window.__simworxProjectionNativeFetch;
  if(typeof nativeFetch!=='function')return;
  let attempts=0;
  const install=()=>{
    attempts++;
    const current=window.fetch;
    const currentText=String(current);
    if(currentText.includes('INVALID_JSON')||currentText.includes('OFFLINE_RESOURCE_UNAVAILABLE')){
      const offlineFetch=current.bind(window);
      window.__simworxProjectionOfflineFetch=offlineFetch;
      window.fetch=function(input,init){
        try{
          const raw=typeof input==='string'?input:input?.url;
          const url=new URL(raw,location.href);
          if(url.origin===location.origin &&
             (url.pathname.endsWith('/led-quote-submit.php') ||
              url.pathname.includes('/led-quote-submit-') ||
              url.pathname.endsWith('/projection-quote-submit.php'))){
            return nativeFetch(input,init);
          }
        }catch(_){}
        return offlineFetch(input,init);
      };
      window.__simworxProjectionFetchRouterReady=true;
      return;
    }
    if(attempts<500)setTimeout(install,20);
  };
  install();
})();
</script>'''
body_close=html.rfind("</body>")
if body_close<0: raise SystemExit("V69 body close missing")
html=html[:body_close]+late+"\n"+html[body_close:]

checks=[
    "projection-v69-native-fetch-capture",
    "projection-v69-fetch-router",
    "__simworxProjectionNativeFetch",
    "__simworxProjectionOfflineFetch",
    "led-quote-submit.php",
    "installOfflineAPI",
]
missing=[x for x in checks if x not in html]
if missing: raise SystemExit("V69 checks failed "+repr(missing))

for sid in ["projection-v69-native-fetch-capture","projection-v69-fetch-router"]:
    m=re.search(r'<script id="'+sid+r'">(.*?)</script>',html,re.S)
    if not m: raise SystemExit("V69 script missing "+sid)
    p=Path("/tmp/"+sid+".js");p.write_text(m.group(1))
    subprocess.run(["node","--check",str(p)],check=True)

TARGET.write_text(html)
print("V69 built from V68: native fetch restored only for live email endpoints")
