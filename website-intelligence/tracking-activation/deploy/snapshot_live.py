# Read-only live-source inspection retriggered 2026-10-26.
"""Read-only inventory and selected public source snapshot for tracking review."""
from __future__ import annotations
import json
import re
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote
import ftp_common as common

OUT = Path('/tmp/simworx-tracking-snapshot')
EXCLUDED = {'admin', 'portal', 'reports', 'stripe'}

def public_html(path):
    parts = path.removeprefix(common.ROOT+'/').split('/')
    return path.startswith(common.ROOT+'/') and path.lower().endswith('.html') and not any(p.startswith('.') for p in parts) and parts[0].lower() not in EXCLUDED

class References(HTMLParser):
    def __init__(self): super().__init__(); self.links=[]; self.scripts=[]
    def handle_starttag(self, tag, attrs):
        data=dict(attrs)
        if tag.lower()=='a' and data.get('href'): self.links.append(data['href'])
        if tag.lower()=='script' and data.get('src'): self.scripts.append(data['src'])

def reference_path(page, link):
    parsed=urlsplit(link)
    if parsed.scheme not in {'','http','https'} or parsed.netloc and parsed.hostname not in {'sim-worx.com','www.sim-worx.com'}: return None
    raw=unquote(parsed.path)
    if not raw:return None
    if raw.startswith('/'): path=common.ROOT+raw
    else: path=str(Path(page).parent/raw)
    if any(p in {'.','..',''} for p in path.removeprefix('/').split('/')):return None
    return path

def main():
    OUT.mkdir(mode=0o700)
    with common.connect() as ftp:
        state=common.inventory(ftp)
        html=sorted(path for path in state if public_html(path) and state[path]['type']=='file')
        common.canonical({'public_html':{p:state[p] for p in html}})
        (OUT/'inventory.json').write_bytes(common.canonical({'public_html':{p:state[p] for p in html},'public_js':{p:f for p,f in state.items() if p.startswith('/htdocs/assets/js/') and p.endswith('.js')}}))
        # Non-versioned content plus the latest published LED/projection page.
        selected={p for p in html if not re.search(r'(?:-v\d+|version[-_]?\d+|preview)',Path(p).name,re.I)}
        for kind in ('projection','led'):
            candidates=[p for p in html if kind in Path(p).name.lower() and 'configur' in Path(p).name.lower()]
            if candidates:
                selected.add(max(candidates,key=lambda p:(int((re.search(r'-v(\d+)',p,re.I)or ['','0'])[1]),p)))
        selected.update(p for p in ('/htdocs/assets/js/cookie-consent.js','/htdocs/assets/js/global-header.js','/htdocs/assets/js/main.js') if p in state)
        manifest={}
        for path in sorted(selected):
            local=OUT/'public'/path.removeprefix(common.ROOT+'/')
            local.parent.mkdir(parents=True,exist_ok=True)
            with local.open('wb') as handle: sha,count=common.remote_hash(ftp,path,handle)
            if count!=int(state[path].get('size',count)):raise RuntimeError('A selected source changed while downloading')
            item={'sha256':sha,'bytes':count,'facts':state[path]}
            if path.endswith('.html'):
                parser=References();parser.feed(local.read_text(errors='replace'))
                item['scripts']=parser.scripts;item['links']=parser.links
            manifest[path]=item
        (OUT/'sources.json').write_bytes(common.canonical(manifest))
    print('Read-only snapshot:',len(html),'public HTML paths;',len(manifest),'selected public source files. No FTP writes.',flush=True)

if __name__=='__main__':main()
