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
MARKER = "sw-led-pitch-compact-v2"

CSS = """<style id="sw-led-pitch-compact-v2">
/* Scope: live LED Pixel pitch selector only */
#led-pitch-options fieldset{
  padding-top:10px!important;
  padding-bottom:10px!important;
}
#led-pitch-options fieldset>p{
  margin-top:5px!important;
  margin-bottom:5px!important;
  line-height:1.3!important;
}
#led-pitch-options fieldset label{
  min-height:152px!important;
  height:auto!important;
  padding-top:9px!important;
  padding-bottom:9px!important;
}
#led-pitch-options fieldset label>span,
#led-pitch-options fieldset label>div,
#led-pitch-options fieldset label>small,
#led-pitch-options fieldset label>p{
  margin-top:2px!important;
  margin-bottom:2px!important;
}
#led-pitch-options .led-pitch-scale{
  margin-top:6px!important;
  margin-bottom:6px!important;
}
</style>"""


def patch(source: bytes) -> bytes:
    text = source.decode("utf-8")
    if MARKER in text:
        return source
    if 'id="led-pitch-options"' not in text:
        raise RuntimeError("Live LED pitch container not found")
    text, count = re.subn(r"</head>", CSS + "</head>", text, count=1, flags=re.I)
    if count != 1:
        raise RuntimeError("Could not insert scoped Pixel pitch CSS")
    if text.count(MARKER) != 1:
        raise RuntimeError("Unexpected compact marker count")
    return text.encode("utf-8")


def main():
    with publisher.connect() as ftp:
        before = publisher.remote_bytes(ftp, TARGET)
        text = before.decode("utf-8","replace")
        for needle in ["data-pitch-distance","data-pitch-price-label","led-pitch-scale","pixelPitch"]:
            print("\n###",needle)
            start=0
            hits=0
            while True:
                i=text.find(needle,start)
                if i<0 or hits>=6: break
                print(text[max(0,i-1800):min(len(text),i+2600)])
                print("\n---")
                start=i+len(needle);hits+=1
        raise SystemExit("INSPECT_ONLY")
        after = patch(before)
        if after == before:
            print("Pixel pitch compact V2 already present.")
            return

        staged = "/htdocs/.led-pitch-compact-v2-upload.html"
        if publisher.exists(ftp, staged):
            raise RuntimeError("Staging file already exists; refusing overwrite.")

        ftp.storbinary("STOR " + staged, io.BytesIO(after))
        if hashlib.sha256(publisher.remote_bytes(ftp, staged)).digest() != hashlib.sha256(after).digest():
            raise RuntimeError("Staged LED page failed checksum verification.")

        ftp.rename(staged, TARGET)
        live = publisher.remote_bytes(ftp, TARGET)
        if hashlib.sha256(live).digest() != hashlib.sha256(after).digest():
            raise RuntimeError("Live LED page failed checksum verification.")

        print("Published compact Pixel pitch selector V2 only.")


if __name__ == "__main__":
    main()
