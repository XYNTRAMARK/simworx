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
MARKER = "sw-led-price-gate-v1"

SCRIPT = """<script id="sw-led-price-gate-v1">
(function(){
  let priceActivated=false;
  let observer=null;

  function priceTargets(){
    return ['led-running-total','led-estimate']
      .map(function(id){ return document.getElementById(id); })
      .filter(Boolean);
  }

  function forceZero(){
    if(priceActivated) return;
    priceTargets().forEach(function(el){
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

  function initPriceGate(){
    forceZero();
    observer=new MutationObserver(forceZero);
    priceTargets().forEach(function(el){
      observer.observe(el,{childList:true,subtree:true,characterData:true});
    });
    document.addEventListener('input',activateFromSlider,true);
    document.addEventListener('change',activateFromSlider,true);
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',initPriceGate,{once:true});
  }else{
    initPriceGate();
  }
})();
</script>"""


def patch(source: bytes) -> bytes:
    text = source.decode("utf-8")
    if MARKER in text:
        return source
    if 'id="led-running-total"' not in text:
        raise RuntimeError("Live LED running price target not found")
    if 'class="led-workbench"' not in text:
        raise RuntimeError("Live LED configurator workbench not found")

    text, count = re.subn(r"</body>", SCRIPT + "</body>", text, count=1, flags=re.I)
    if count != 1:
        raise RuntimeError("Could not insert LED initial-price gate")
    if text.count(MARKER) != 1:
        raise RuntimeError("Unexpected price-gate marker count")
    return text.encode("utf-8")


def main():
    with publisher.connect() as ftp:
        before = publisher.remote_bytes(ftp, TARGET)
        after = patch(before)
        if after == before:
            print("Initial LED price gate already present.")
            return

        staged = "/htdocs/.led-initial-price-gate-v1-upload.html"
        if publisher.exists(ftp, staged):
            raise RuntimeError("Staging file already exists; refusing overwrite.")

        ftp.storbinary("STOR " + staged, io.BytesIO(after))
        if hashlib.sha256(publisher.remote_bytes(ftp, staged)).digest() != hashlib.sha256(after).digest():
            raise RuntimeError("Staged LED page failed checksum verification.")

        ftp.rename(staged, TARGET)
        live = publisher.remote_bytes(ftp, TARGET)
        if hashlib.sha256(live).digest() != hashlib.sha256(after).digest():
            raise RuntimeError("Live LED page failed checksum verification.")

        print("Published LED initial price gate only.")


if __name__ == "__main__":
    main()
