"""Publish only the approved shared menu, preserving each page outside its header references."""
import ftplib, hashlib, io, json, os, re, sys, tarfile
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request, urlopen

WORK = Path(os.environ.get('RUNNER_TEMP', '/tmp')) / 'simworx-approved-menu'
SOURCE = Path('.menu-release')
CSS = 'assets/css/global-header-approved.css'
JS = 'assets/js/global-header-approved.js'
VERSION = 'approved-menu-20261111'
REQUIRED = {'index.html', 'software.html', 'visual-systems.html', 'mission-systems.html', 'led-screen-configurator.html', 'projection-screen-configurator.html'}

def digest(data): return hashlib.sha256(data).hexdigest()
def connect():
    host = os.environ['FTP_HOST']
    parsed = urlparse(host if '://' in host else 'ftp://' + host)
    ftp = ftplib.FTP_TLS(timeout=60)
    ftp.connect(parsed.hostname, parsed.port or 21)
    ftp.login(os.environ['FTP_USERNAME'], os.environ['FTP_PASSWORD'])
    ftp.prot_p()
    return ftp

def read(ftp, path):
    result = io.BytesIO()
    ftp.retrbinary('RETR /htdocs/' + path, result.write)
    return result.getvalue()

def patch(source):
    from html.parser import HTMLParser
    text = source.decode('latin1')  # One character per byte keeps original offsets exact.
    line_starts = [0]
    for match in re.finditer('\n', text): line_starts.append(match.end())
    class HeaderParser(HTMLParser):
        def __init__(self):
            super().__init__(convert_charrefs=False)
            self.headers = []; self.removals = []; self.active_header = None
            self.active_script = None; self.head_end = None; self.body_end = None
        def byte_offset(self):
            line, col = self.getpos()
            return line_starts[line-1] + col
        def handle_starttag(self, tag, attrs):
            values = dict(attrs); start = self.byte_offset(); end = start + len(self.get_starttag_text())
            if tag == 'header' and 'global-header' in values.get('class', '').split():
                self.active_header = start
            if tag == 'link' and re.search(r'(?:^|/)assets/css/global-header(?:-approved)?\.css(?:[?#]|$)', values.get('href', '')):
                self.removals.append((start, end, b''))
            if tag == 'script' and re.search(r'(?:^|/)assets/js/global-header(?:-approved)?\.js(?:[?#]|$)', values.get('src', '')):
                self.active_script = start
        def handle_startendtag(self, tag, attrs): self.handle_starttag(tag, attrs)
        def handle_endtag(self, tag):
            start = self.byte_offset(); end = text.index('>', start) + 1
            if tag == 'header' and self.active_header is not None:
                self.headers.append((self.active_header, end)); self.active_header = None
            if tag == 'script' and self.active_script is not None:
                self.removals.append((self.active_script, end, b'')); self.active_script = None
            if tag == 'head': self.head_end = start
            if tag == 'body': self.body_end = start
    parser = HeaderParser(); parser.feed(text)
    if not parser.headers: return None
    if len(parser.headers) != 1 or parser.head_end is None or parser.body_end is None:
        raise RuntimeError('Unexpected document/header structure')
    css = ('<link rel="stylesheet" href="/' + CSS + '?v=' + VERSION + '">').encode()
    js = ('<script src="/' + JS + '?v=' + VERSION + '"></script>').encode()
    start, end = parser.headers[0]
    replacements = parser.removals + [
        (start, end, (SOURCE / 'header.html').read_bytes().strip()),
        (parser.head_end, parser.head_end, css), (parser.body_end, parser.body_end, js)]
    result = source
    for start, end, value in sorted(replacements, reverse=True): result = result[:start] + value + result[end:]
    assert b'Software &amp; Downloads' in result
    return result

def plan():
    WORK.mkdir(parents=True, exist_ok=True)
    before_dir = WORK / 'before'
    after_dir = WORK / 'after'
    before_dir.mkdir(exist_ok=True); after_dir.mkdir(exist_ok=True)
    originals = {}; prepared = {}
    with connect() as ftp:
        names = sorted(n.rsplit('/', 1)[-1] for n in ftp.nlst('/htdocs'))
        # Current public root pages. Retired version builds, previews and diagnostics are excluded.
        candidates = [n for n in names if re.fullmatch(r'[A-Za-z0-9_-]+\.html', n) and not re.search(r'(?:preview|backup|diagnostic|(?:^|[-_])test(?:[-_.]|$)|[-_]v\d+)', n, re.I)]
        for name in candidates:
            source = read(ftp, name)
            result = patch(source)
            if result is None:
                print('No website global header; preserved: ' + name, flush=True)
                continue
            originals[name] = source; prepared[name] = result
            print('Prepared header-only update: ' + name, flush=True)
        if not REQUIRED <= prepared.keys(): raise RuntimeError('Required public pages missing: ' + str(REQUIRED - prepared.keys()))
        for path, filename in [(CSS, 'header.css'), (JS, 'header.js')]:
            siblings = ftp.nlst('/htdocs/' + path.rsplit('/', 1)[0])
            if path.rsplit('/', 1)[-1] in [n.rsplit('/', 1)[-1] for n in siblings]:
                raise RuntimeError('Approved asset already exists; refusing to overwrite')
            prepared[path] = (SOURCE / filename).read_bytes()
    manifest = {}
    for path, data in prepared.items():
        target = after_dir / path; target.parent.mkdir(parents=True, exist_ok=True); target.write_bytes(data)
        original = originals.get(path)
        if original is not None:
            target = before_dir / path; target.parent.mkdir(parents=True, exist_ok=True); target.write_bytes(original)
        manifest[path] = {'before': digest(original) if original is not None else None, 'after': digest(data)}
    (WORK / 'manifest.json').write_text(json.dumps(manifest, indent=2))
    with tarfile.open(WORK / 'before.tar.gz', 'w:gz') as archive:
        archive.add(before_dir, arcname='before')
        archive.add(WORK / 'manifest.json', arcname='manifest.json')
    with tarfile.open(WORK / 'before.tar.gz', 'r:gz') as archive:
        for path, data in originals.items():
            assert archive.extractfile('before/' + path).read() == data
    print('Prepared and verified backup for ' + str(len(originals)) + ' public pages; no writes.', flush=True)

def publish():
    if not os.environ.get('BACKUP_ARTIFACT_ID'): raise RuntimeError('Retained backup required')
    manifest = json.loads((WORK / 'manifest.json').read_text())
    order = [CSS, JS] + [p for p in manifest if p not in {CSS, JS}]
    changed = []
    with connect() as ftp:
        for path in order:
            entry = manifest[path]
            assert digest((WORK / 'after' / path).read_bytes()) == entry['after']
            if entry['before'] is not None and digest(read(ftp, path)) != entry['before']:
                raise RuntimeError('Concurrent change detected before writes: ' + path)
        try:
            for path in order:
                entry = manifest[path]
                if entry['before'] is not None and digest(read(ftp, path)) != entry['before']:
                    raise RuntimeError('Concurrent change detected: ' + path)
                payload = (WORK / 'after' / path).read_bytes()
                changed.append(path)
                ftp.storbinary('STOR /htdocs/' + path, io.BytesIO(payload))
                assert digest(read(ftp, path)) == entry['after'], 'FTP verification failed: ' + path
            for path in order:
                url = 'https://sim-worx.com/' + path + '?menu-verification=' + VERSION
                with urlopen(Request(url, headers={'Cache-Control': 'no-cache'}), timeout=60) as response:
                    assert digest(response.read()) == manifest[path]['after'], 'HTTPS mismatch: ' + path
                print('Verified live: ' + path, flush=True)
        except Exception:
            for path in reversed(changed):
                entry = manifest[path]
                if entry['before'] is None:
                    # New assets are retained if rollback is needed; original pages do not reference them.
                    continue
                current = digest(read(ftp, path))
                if current == entry['before']: continue
                if current != entry['after']: raise RuntimeError('Concurrent modification prevents rollback: ' + path)
                original = (WORK / 'before' / path).read_bytes()
                ftp.storbinary('STOR /htdocs/' + path, io.BytesIO(original))
                assert digest(read(ftp, path)) == entry['before']
            raise
    print('Approved menu deployed and verified on ' + str(len(manifest)-2) + ' public pages.', flush=True)

if __name__ == '__main__':
    {'plan': plan, 'publish': publish}[sys.argv[1]]()
