from __future__ import annotations
import ftplib,hashlib,io,os,posixpath,ssl
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import Request,urlopen

ROOT="/htdocs"; BASE="https://www.sim-worx.com"
SOURCE="projection-screen-configurator-v52.html"
CANONICAL="projection-screen-configurator.html"
OLD="projection-screen-configurator-v50.html"
HEADER="assets/js/global-header.js"

def digest(b): return hashlib.sha256(b).hexdigest()

class F(ftplib.FTP_TLS):
    prefer_epsv=False
    def makepasv(self):
        if self.prefer_epsv:
            try:return ftplib.parse229(self.sendcmd("EPSV"),self.sock.getpeername())
            except ftplib.error_perm:pass
        return super().makepasv()
    def ntransfercmd(self,c,rest=None):
        try:return super().ntransfercmd(c,rest)
        except ftplib.error_temp as e:
            if str(e).startswith("425") and not self.prefer_epsv:
                self.prefer_epsv=True
                return super().ntransfercmd(c,rest)
            raise

def connect():
    raw=os.environ["FTP_HOST"].strip()
    p=urlsplit(raw if "://" in raw else "ftp://"+raw)
    f=F(context=ssl.create_default_context(),timeout=45)
    f.connect(p.hostname,p.port or 21)
    f.login(os.environ["FTP_USERNAME"],os.environ["FTP_PASSWORD"])
    f.prot_p()
    return f

def rb(f,path):
    out=[]
    f.retrbinary("RETR "+path,out.append)
    return b"".join(out)

def exists(f,path):
    folder,name=posixpath.split(path)
    try:return name in {n for n,_ in f.mlsd(folder)}
    except Exception:return False

def public(path):
    req=Request(BASE+"/"+path,headers={"Cache-Control":"no-cache","User-Agent":"Simworx-V52-live-activator"})
    with urlopen(req,timeout=60) as r:
        return r.read(),r.geturl()

def main():
    source,source_url=public(SOURCE+"?activate=1")
    text=source.decode("utf-8","replace")
    for marker in [
        "projection-v52-proposal-views",
        "projection-v51-step3-simplification",
        "projection-v50-consistent-viewer",
        "Include Projector Mounting Frame",
        "Click To Generate Projector Profile",
    ]:
        if marker not in text:
            raise RuntimeError("V52 source missing accepted feature "+marker)

    redirect=(
      '<!doctype html><html lang="en"><head><meta charset="utf-8">'
      '<meta name="robots" content="noindex,follow">'
      '<meta http-equiv="refresh" content="0;url=/'+CANONICAL+'">'
      '<link rel="canonical" href="/'+CANONICAL+'">'
      '<title>Projector Configurator | Simworx</title></head>'
      '<body><p>Opening the current Simworx Projector Configurator… '
      '<a href="/'+CANONICAL+'">Continue</a></p>'
      '<script>location.replace("/'+CANONICAL+'"+location.search+location.hash)</script>'
      '</body></html>'
    ).encode()

    header=Path(HEADER).read_bytes()
    header_text=header.decode("utf-8")
    if "/projection-screen-configurator-v52.html" not in header_text:
        raise RuntimeError("Repository header is not currently pointing at V52")
    live_header=header_text.replace("/projection-screen-configurator-v52.html","/"+CANONICAL).encode()

    with connect() as f:
        # Preserve exact current V50 bytes in the run workspace before replacing the public legacy entry.
        old_path=ROOT+"/"+OLD
        if not exists(f,old_path): raise RuntimeError("Existing V50 public entry is missing")
        Path("/tmp/projector-v50-before-live-switch.html").write_bytes(rb(f,old_path))

        for rel,data in [
            (CANONICAL,source),
            (OLD,redirect),
            (HEADER,live_header),
        ]:
            target=ROOT+"/"+rel
            staged=posixpath.dirname(target)+"/.v52-live-"+posixpath.basename(target)
            if exists(f,staged): f.delete(staged)
            f.storbinary("STOR "+staged,io.BytesIO(data))
            if digest(rb(f,staged))!=digest(data): raise RuntimeError("staged checksum mismatch "+rel)
            if exists(f,target):
                # FTP rename on this host replaces existing files atomically.
                f.rename(staged,target)
            else:
                f.rename(staged,target)
            if digest(rb(f,target))!=digest(data): raise RuntimeError("live checksum mismatch "+rel)
        f.quit()

    canonical,canonical_url=public(CANONICAL+"?verify=v52")
    if digest(canonical)!=digest(source): raise RuntimeError("Canonical projector page is not exact V52")
    if "projection-v52-proposal-views" not in canonical.decode("utf-8","replace"):
        raise RuntimeError("Canonical live page does not contain V52 marker")

    old_body,old_final=public(OLD+"?verify=v52")
    if not old_final.endswith("/"+CANONICAL+"?verify=v52"):
        raise RuntimeError("Old V50 URL did not resolve to canonical live page: "+old_final)
    if digest(old_body)!=digest(source):
        raise RuntimeError("Old V50 URL did not serve canonical V52 content after redirect")

    header_body,_=public(HEADER+"?verify=v52")
    if b"/projection-screen-configurator.html" not in header_body:
        raise RuntimeError("Live shared header does not point to canonical projector page")

    print("V52 is now the canonical live projector page; V50 public URL redirects to it; shared header points to the stable live URL.")

if __name__=="__main__": main()
