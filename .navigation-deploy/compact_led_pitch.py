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
MARKER = "sw-led-pitch-compact-v3"

CSS = """<style id="sw-led-pitch-compact-v3">
/* Scope: live LED Pixel pitch selector only */
#led-pixelPitch{
  padding-top:10px!important;
  padding-bottom:10px!important;
}
#led-pixelPitch .led-pitch-scale{
  margin-bottom:7px!important;
}
#led-pixelPitch .led-pitch-choice{
  min-height:156px!important;
  height:auto!important;
  padding:9px 10px 8px!important;
  gap:2px 6px!important;
}
#led-pixelPitch .led-pitch-choice .led-pitch-detail{
  min-height:22px!important;
  margin-top:3px!important;
  line-height:1.35!important;
}
#led-pixelPitch .led-pitch-price-label{
  margin-top:5px!important;
}
#led-pixelPitch .led-pitch-badge{
  min-height:13px!important;
  margin-top:2px!important;
  line-height:1.25!important;
}
#led-pixelPitch .led-pitch-price-scope{
  margin:7px 0!important;
  line-height:1.4!important;
}
#led-pixelPitch .led-pitch-recommendation{
  margin:7px 0 2px!important;
}
</style>"""


def patch(source: bytes) -> bytes:
    text = source.decode("utf-8")
    if MARKER in text:
        return source
    if 'id="led-pitch-options"' not in text or '#led-pixelPitch .led-pitch-choice' not in text:
        raise RuntimeError("Expected live LED Pixel pitch structure not found")

    # Remove our ineffective V2 patch only; leave all original page CSS untouched.
    text = re.sub(
        r'<style id="sw-led-pitch-compact-v2">[\s\S]*?</style>',
        '',
        text,
        count=1,
        flags=re.I,
    )

    text, count = re.subn(r"</head>", CSS + "</head>", text, count=1, flags=re.I)
    if count != 1:
        raise RuntimeError("Could not insert scoped Pixel pitch V3 CSS")
    if text.count(MARKER) != 1:
        raise RuntimeError("Unexpected V3 marker count")
    return text.encode("utf-8")


def main():
    with publisher.connect() as ftp:
        before = publisher.remote_bytes(ftp, TARGET)
        after = patch(before)
        if after == before:
            print("Pixel pitch compact V3 already present.")
            return

        staged = "/htdocs/.led-pitch-compact-v3-upload.html"
        if publisher.exists(ftp, staged):
            raise RuntimeError("Staging file already exists; refusing overwrite.")

        ftp.storbinary("STOR " + staged, io.BytesIO(after))
        if hashlib.sha256(publisher.remote_bytes(ftp, staged)).digest() != hashlib.sha256(after).digest():
            raise RuntimeError("Staged LED page failed checksum verification.")

        ftp.rename(staged, TARGET)
        live = publisher.remote_bytes(ftp, TARGET)
        if hashlib.sha256(live).digest() != hashlib.sha256(after).digest():
            raise RuntimeError("Live LED page failed checksum verification.")

        print("Published compact Pixel pitch selector V3 only.")


if __name__ == "__main__":
    main()
