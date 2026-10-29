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
MARKER = "sw-led-pitch-compact-v1"

CSS = """<style id="sw-led-pitch-compact-v1">
/* Scope: LED Pixel pitch selector only */
.sw-led-pitch-compact-v1{padding-top:8px!important;padding-bottom:8px!important}
.sw-led-pitch-compact-v1 p{margin-top:4px!important;margin-bottom:4px!important;line-height:1.25!important}
.sw-led-pitch-compact-v1 label{min-height:150px!important;padding-top:8px!important;padding-bottom:8px!important}
.sw-led-pitch-compact-v1 label>*{margin-top:2px!important;margin-bottom:2px!important}
</style>"""


def patch(source: bytes) -> bytes:
    text = source.decode("utf-8")
    if MARKER in text:
        return source

    heading = list(re.finditer(
        r"<(?:legend|h[1-6])\b[^>]*>\s*Pixel pitch\s*</(?:legend|h[1-6])>",
        text,
        re.I,
    ))
    if len(heading) != 1:
        raise RuntimeError(f"Expected one Pixel pitch heading, found {len(heading)}")

    pos = heading[0].start()
    starts = list(re.finditer(r"<fieldset\b[^>]*>", text[:pos], re.I))
    if not starts:
        raise RuntimeError("Pixel pitch fieldset not found")
    fieldset = starts[-1]
    opening = fieldset.group(0)

    if re.search(r"\bclass\s*=", opening, re.I):
        revised = re.sub(
            r"(\bclass\s*=\s*[\"'])",
            r"\1sw-led-pitch-compact-v1 ",
            opening,
            count=1,
            flags=re.I,
        )
    else:
        revised = opening[:-1] + ' class="sw-led-pitch-compact-v1">'

    text = text[:fieldset.start()] + revised + text[fieldset.end():]
    text, count = re.subn(r"</head>", CSS + "</head>", text, count=1, flags=re.I)
    if count != 1:
        raise RuntimeError("Could not insert scoped Pixel pitch CSS")

    if text.count(MARKER) != 1:
        raise RuntimeError("Unexpected marker count after patch")

    return text.encode("utf-8")


def main():
    with publisher.connect() as ftp:
        before = publisher.remote_bytes(ftp, TARGET)
        after = patch(before)
        if after == before:
            print("Pixel pitch compact patch already present.")
            return

        staged = "/htdocs/.led-pitch-compact-v1-upload.html"
        if publisher.exists(ftp, staged):
            raise RuntimeError("Staging file already exists; refusing overwrite.")

        ftp.storbinary("STOR " + staged, io.BytesIO(after))
        if hashlib.sha256(publisher.remote_bytes(ftp, staged)).digest() != hashlib.sha256(after).digest():
            raise RuntimeError("Staged Pixel pitch page failed checksum verification.")

        ftp.rename(staged, TARGET)
        live = publisher.remote_bytes(ftp, TARGET)
        if hashlib.sha256(live).digest() != hashlib.sha256(after).digest():
            raise RuntimeError("Live Pixel pitch page failed checksum verification.")

        print("Published compact Pixel pitch selector only.")


if __name__ == "__main__":
    main()
