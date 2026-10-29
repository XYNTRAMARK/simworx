from __future__ import annotations

import hashlib
import io
import re
from pathlib import Path
import importlib.util

ROOT = Path(__file__).resolve().parents[1]
publisher_path = ROOT / ".navigation-deploy" / "publish.py"
spec = importlib.util.spec_from_file_location("simworx_navigation_publisher", publisher_path)
publisher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(publisher)

TARGET = "/htdocs/led-screen-configurator.html"
MARKER = "sw-led-price-gate-v2"

ADDON = """<style id="sw-led-mobile-pc-notice-v1">
.sw-led-mobile-pc-notice{display:none}
@media(max-width:780px){
  .sw-led-mobile-pc-notice{
    display:block;
    margin:0 0 14px;
    padding:10px 12px;
    border:1px solid #d4ae42;
    border-radius:4px;
    background:#fffaf0;
    color:#665b3a;
    font-size:12px;
    font-weight:700;
    line-height:1.4;
    text-align:center;
  }
}
</style>
<script id="sw-led-price-gate-v2">
(function(){
  let priceActivated=false;
  let observer=null;

  function topPriceTargets(){
    return ['led-running-total','led-estimate']
      .map(function(id){ return document.getElementById(id); })
      .filter(Boolean);
  }

  function pitchPriceTargets(){
    return Array.from(document.querySelectorAll('#led-pixelPitch .led-option-price'));
  }

  function forceZero(){
    if(priceActivated) return;
    topPriceTargets().forEach(function(el){
      if(el.textContent!=='0') el.textContent='0';
    });
    pitchPriceTargets().forEach(function(el){
      if(el.textContent!=='0') el.textContent='0';
    });
  }

  function activateFromSlider(event){
    var target=event.target;
    if(!target || !target.matches || !target.matches('.led-workbench input[type="range"], #led-controls input[type="range"]')) return;
    priceActivated=true;
    if(observer){ observer.disconnect(); observer=null; }
    document.removeEventListener('input',activateFromSlider,true);
    document.removeEventListener('change',activateFromSlider,true);
  }

  function addMobileNotice(){
    if(document.querySelector('.sw-led-mobile-pc-notice')) return;
    var notice=document.createElement('div');
    notice.className='sw-led-mobile-pc-notice';
    notice.textContent='This configurator works best on a PC.';
    var anchor=document.querySelector('.led-estimate-bar');
    if(anchor && anchor.parentNode){
      anchor.parentNode.insertBefore(notice,anchor);
    }
  }

  function init(){
    addMobileNotice();
    forceZero();

    observer=new MutationObserver(forceZero);
    topPriceTargets().forEach(function(el){
      observer.observe(el,{childList:true,subtree:true,characterData:true});
    });
    var pitch=document.getElementById('led-pitch-options');
    if(pitch){
      observer.observe(pitch,{childList:true,subtree:true,characterData:true});
    }

    document.addEventListener('input',activateFromSlider,true);
    document.addEventListener('change',activateFromSlider,true);
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',init,{once:true});
  }else{
    init();
  }
})();
</script>"""


def patch(source: bytes) -> bytes:
    text = source.decode("utf-8")
    if MARKER in text:
        return source
    if 'id="led-running-total"' not in text:
        raise RuntimeError("Live LED running price target not found")
    if 'id="led-pitch-options"' not in text:
        raise RuntimeError("Live LED pitch container not found")
    if 'class="led-estimate-bar"' not in text:
        raise RuntimeError("Live LED estimate bar not found")

    # Replace only our earlier price-gate script if present.
    text = re.sub(
        r'<script id="sw-led-price-gate-v1">[\s\S]*?</script>',
        '',
        text,
        count=1,
        flags=re.I,
    )

    text, count = re.subn(r"</body>", ADDON + "</body>", text, count=1, flags=re.I)
    if count != 1:
        raise RuntimeError("Could not insert LED price gate V2 / mobile notice")
    if text.count(MARKER) != 1:
        raise RuntimeError("Unexpected price-gate V2 marker count")
    return text.encode("utf-8")


def main():
    with publisher.connect() as ftp:
        before = publisher.remote_bytes(ftp, TARGET)
        after = patch(before)
        if after == before:
            print("LED price gate V2 and mobile notice already present.")
            return

        staged = "/htdocs/.led-price-gate-v2-mobile-notice-upload.html"
        if publisher.exists(ftp, staged):
            raise RuntimeError("Staging file already exists; refusing overwrite.")

        ftp.storbinary("STOR " + staged, io.BytesIO(after))
        if hashlib.sha256(publisher.remote_bytes(ftp, staged)).digest() != hashlib.sha256(after).digest():
            raise RuntimeError("Staged LED page failed checksum verification.")

        ftp.rename(staged, TARGET)
        live = publisher.remote_bytes(ftp, TARGET)
        if hashlib.sha256(live).digest() != hashlib.sha256(after).digest():
            raise RuntimeError("Live LED page failed checksum verification.")

        print("Published LED pitch-price gate and mobile-only PC notice.")


if __name__ == "__main__":
    main()
