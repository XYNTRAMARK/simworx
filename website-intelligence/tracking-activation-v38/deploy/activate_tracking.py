"""Add only reviewed invisible analytics hooks to exact live public files.

backup: take a complete stable /htdocs snapshot, build byte-preserving patches,
verify every archive member, and write a review manifest. No remote writes.
publish: requires the retained encrypted backup artifact, compares live SHA-256
before each atomic replacement, and conditionally rolls back only its own edits.
"""
from __future__ import annotations
import html
import io
import json
import os
import posixpath
import re
import sys
import tarfile
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import URLError
import ftp_common as common

ROOT = common.ROOT
WORK = common.WORK
SOURCE = Path(__file__).resolve().parents[1]
PLAN = SOURCE / 'activation.json'
MARKER = 'simworx-intelligence-tracking'
PRIVATE = {'admin','portal','reports','stripe'}
ASSET_RE = re.compile(r'^/htdocs/assets/js/simworx-intelligence-[a-z0-9-]+\.js$')
REPORT_ANALYTICS = ROOT+'/reports/analytics.js'
REPORT_APP = ROOT+'/reports/app.js'
REPORT_LOGIC_PATHS = frozenset({REPORT_ANALYTICS, REPORT_APP})
PUBLIC = 'https://sim-worx.com'
CSP_TRACKING_PATH = ROOT+'/projection-screen-configurator-v38.html'
CSP_ENDPOINT = 'https://euttubfvsrgkeiescsdm.supabase.co/functions/v1/simworx-intelligence'
CSP_ASSET_NAMES = ('simworx-intelligence-bootstrap-v2.js','simworx-intelligence-tracker-v2.js','simworx-intelligence-configurator-v2.js','simworx-intelligence-contact-v2.js')
CSP_ASSET_URLS = tuple(origin+'/assets/js/'+name for origin in ('https://sim-worx.com','https://www.sim-worx.com') for name in CSP_ASSET_NAMES)
CSP_BEFORE = "default-src 'none'; script-src 'unsafe-inline' blob:; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; worker-src blob:; object-src 'none'; base-uri 'none'; form-action 'none'"
CSP_AFTER = CSP_BEFORE.replace("script-src 'unsafe-inline' blob:","script-src 'unsafe-inline' blob: "+' '.join(CSP_ASSET_URLS),1).replace("connect-src 'none'",'connect-src '+CSP_ENDPOINT,1)
CSP_META_BEFORE = ('<meta http-equiv="Content-Security-Policy" content="'+CSP_BEFORE+'">').encode()
CSP_META_AFTER = ('<meta http-equiv="Content-Security-Policy" content="'+CSP_AFTER+'">').encode()

def public_html(path):
    if not path.startswith(ROOT+'/') or not path.lower().endswith('.html'):return False
    parts=path[len(ROOT)+1:].split('/')
    return parts[0].lower() not in PRIVATE and not any(p in {'','.','..'} or p.startswith('.') or any(c in p for c in '\\\r\n\x00') for p in parts)

def asset_path(path):
    if not ASSET_RE.fullmatch(path):raise RuntimeError('Asset destination is outside the fixed tracking namespace')
    return path

def report_items(value):
    """At most two explicit reporting-data JavaScript updates, never UI assets."""
    items=value.get('report_updates',[])
    if not isinstance(items,list):raise RuntimeError('Reporting updates must be a bounded list')
    items=list(items)
    legacy=value.get('report_analytics_update')
    if legacy is not None:
        if not isinstance(legacy,dict) or legacy.get('path')!=REPORT_ANALYTICS:raise RuntimeError('Legacy reporting update only permits analytics.js')
        items.append(legacy)
    if len(items)>2:raise RuntimeError('Only two exact reporting logic paths may be updated')
    seen=set()
    for item in items:
        if not isinstance(item,dict) or item.get('path') not in REPORT_LOGIC_PATHS or item['path'] in seen or not re.fullmatch(r'[a-f0-9]{64}',item.get('expected_before','')):
            raise RuntimeError('Reporting updates need unique exact JS paths and reviewed before SHA values')
        seen.add(item['path'])
    return items

def plan():
    value=json.loads(PLAN.read_text())
    if not isinstance(value,dict):raise RuntimeError('Activation plan must be an object')
    loader=value.get('loader_url','')
    asset_path(ROOT+loader)
    assets={}
    for item in value.get('assets',[]):
        target=asset_path(item['path'])
        relative=Path(item['source'])
        if relative.is_absolute() or '..' in relative.parts:raise RuntimeError('Unsafe tracking source path')
        local=SOURCE/relative
        if local.is_symlink() or not local.is_file() or SOURCE not in local.resolve().parents:raise RuntimeError('Tracking source must be a regular local file')
        data=local.read_bytes()
        if not data or len(data)>250000:raise RuntimeError('Tracking assets must be small nonempty JavaScript files')
        if target in assets:raise RuntimeError('Duplicate tracking asset destination')
        assets[target]=data
    if not assets or ROOT+loader not in assets:raise RuntimeError('The loader must be one of the reviewed tracking assets')
    targets=value.get('html_paths')
    if targets is not None and (not isinstance(targets,list) or not targets or any(not public_html(p) for p in targets) or len(set(targets))!=len(targets)):
        raise RuntimeError('HTML allowlist must contain exact public HTML paths')
    csp_paths=value.get('csp_tracking_paths',[])
    if not isinstance(csp_paths,list) or len(csp_paths)>1 or any(p!=CSP_TRACKING_PATH for p in csp_paths):
        raise RuntimeError('CSP tracking extensions are limited to the reviewed current projection page')
    for remote in csp_paths:
        if targets is not None and remote not in targets or not re.fullmatch(r'[a-f0-9]{64}',value.get('expected_before',{}).get(remote,'')):
            raise RuntimeError('The CSP tracking page needs its exact HTML allowlist entry and reviewed before SHA')
    if any('tracking_csp' in properties for properties in value.get('page_properties',{}).values()):
        raise RuntimeError('CSP installation must be declared through the exact csp_tracking_paths allowlist')
    for report in report_items(value):
        relative=Path(report.get('source',''))
        local=SOURCE/relative
        if relative.is_absolute() or '..' in relative.parts or local.is_symlink() or not local.is_file() or SOURCE not in local.resolve().parents:
            raise RuntimeError('Reporting calculation source must be a regular reviewed local file')
    return value,assets

class HeadEnd(HTMLParser):
    def __init__(self):super().__init__(convert_charrefs=False);self.position=None;self.ours=[]
    def handle_endtag(self,tag):
        if tag.lower()=='head':self.position=self.getpos()
    def handle_starttag(self,tag,attrs):
        if tag.lower()=='script' and dict(attrs).get('id')==MARKER:self.ours.append(dict(attrs))

def tracking_block(loader_url,properties=None):
    asset_path(ROOT+loader_url)
    attributes=''
    for key in ('configurator','configurator_version'):
        value=(properties or {}).get(key)
        if value is not None:
            if not isinstance(value,str) or len(value)>80:raise RuntimeError('Invalid configurator attribute')
            attributes+=' data-'+key.replace('_','-')+'="'+html.escape(value,quote=True)+'"'
    return ('\n<script id="'+MARKER+'" defer src="'+loader_url+'"'+attributes+'></script>\n').encode()

def restore_original(data,loader_url,properties=None):
    """Undo only the exact known tracking additions to prove source preservation."""
    block=tracking_block(loader_url,properties)
    if data.count(block)!=1:raise RuntimeError('The reviewed tracking block is missing or duplicated')
    result=data.replace(block,b'',1)
    if (properties or {}).get('tracking_csp'):
        if result.count(CSP_META_AFTER)!=1 or CSP_META_BEFORE in result:raise RuntimeError('The deterministic tracking-only CSP extension differs from its reviewed policy')
        result=result.replace(CSP_META_AFTER,CSP_META_BEFORE,1)
    return result

def transform(data,loader_url,properties=None):
    block=tracking_block(loader_url,properties)
    if block in data:
        if data.count(block)!=1:raise RuntimeError('Duplicate existing tracking block')
        if (properties or {}).get('tracking_csp'):restore_original(data,loader_url,properties)
        return data,False
    original=data
    if (properties or {}).get('tracking_csp'):
        if data.count(CSP_META_BEFORE)!=1 or CSP_META_AFTER in data:raise RuntimeError('The current CSP policy is not the exact reviewed projection policy')
        data=data.replace(CSP_META_BEFORE,CSP_META_AFTER,1)
    parser=HeadEnd()
    # Latin-1 provides a byte-for-character mapping for safe splice coordinates.
    parser.feed(data.decode('latin1'))
    if parser.ours:raise RuntimeError('An existing tracking installation differs from this reviewed plan')
    if parser.position is None:raise RuntimeError('A public HTML target has no explicit closing head tag')
    line,column=parser.position
    starts=[0]+[match.end() for match in re.finditer(b'\n',data)]
    offset=starts[line-1]+column
    if not re.match(br'</head\s*>',data[offset:],re.I):raise RuntimeError('Unable to locate the exact HTML head splice')
    after=data[:offset]+block+data[offset:]
    if restore_original(after,loader_url,properties)!=original:raise RuntimeError('Tracking-only byte preservation failed')
    return after,True

def page_properties(path,value):
    explicit=value.get('page_properties',{}).get(path)
    if explicit is not None:properties=dict(explicit)
    else:
        name=Path(path).name.lower()
        kind='projection' if 'projection' in name and 'configur' in name else 'led' if 'led' in name and 'configur' in name else None
        version=re.search(r'-v(\d+)',name)
        properties={'configurator':kind,'configurator_version':kind+('_v'+version[1] if version else '_live')} if kind else {}
    properties.pop('tracking_csp',None)
    if path in value.get('csp_tracking_paths',[]):properties['tracking_csp']=True
    return properties

def make_archive(site,before,checksums):
    manifest={'inventory':before,'sha256':checksums}
    (site/'backup-manifest.json').write_bytes(common.canonical(manifest))
    archive=WORK/'live-htdocs.tar.gz'
    with tarfile.open(archive,'w:gz') as output:
        output.add(site/'htdocs',arcname='htdocs',recursive=True)
        output.add(site/'backup-manifest.json',arcname='backup-manifest.json')
    seen=set()
    with tarfile.open(archive,'r|gz') as verify:
        for member in verify:
            if not member.isfile():continue
            handle=verify.extractfile(member)
            if member.name=='backup-manifest.json':
                if handle is None or handle.read()!=common.canonical(manifest):raise RuntimeError('Backup manifest failed verification')
                continue
            remote='/'+member.name
            if remote not in checksums or member.name in seen or handle is None or common.stream_hash(handle)!=checksums[remote]:raise RuntimeError('Complete backup archive checksum mismatch')
            seen.add(member.name)
    if seen!={p.lstrip('/') for p in checksums}:raise RuntimeError('Complete backup archive file list mismatch')
    return archive

def backup():
    value,assets=plan()
    if WORK.exists():raise RuntimeError('Prior activation work exists; preserve its evidence before retrying')
    WORK.mkdir(mode=0o700)
    site=WORK/'site';site.mkdir(mode=0o700)
    before,checksums,total=common.stable_copy_site(site,common.fresh_inventory())
    targets=value.get('html_paths') or sorted(p for p,f in before.items() if f['type'].lower()=='file' and public_html(p))
    if not targets:raise RuntimeError('The reviewed plan selected no public HTML pages')
    patches={};unchanged=[]
    for remote in targets:
        if before.get(remote,{}).get('type','').lower()!='file':raise RuntimeError('An exact public HTML target is missing: '+remote)
        original=common.backup_local_path(site,remote).read_bytes()
        expected=value.get('expected_before',{}).get(remote)
        if expected and common.digest(original)!=expected:raise RuntimeError('A reviewed live source changed: '+remote)
        after,changed=transform(original,value['loader_url'],page_properties(remote,value))
        if not changed:unchanged.append(remote);continue
        block=tracking_block(value['loader_url'],page_properties(remote,value))
        patched=WORK/'payload'/remote.removeprefix(ROOT+'/');patched.parent.mkdir(parents=True,exist_ok=True);patched.write_bytes(after)
        properties=page_properties(remote,value)
        patches[remote]={'before_sha256':common.digest(original),'after_sha256':common.digest(after),'before_bytes':len(original),'after_bytes':len(after),'added_bytes':len(after)-len(original),'head_only':True,'restores_exact_original':restore_original(after,value['loader_url'],properties)==original}
        if properties.get('tracking_csp'):patches[remote].update({'csp_before':CSP_BEFORE,'csp_after':CSP_AFTER,'csp_tracking_only':True})
    report_updates={}
    for report in report_items(value):
        remote=report['path']
        if before.get(remote,{}).get('type','').lower()!='file' or checksums[remote]!=report['expected_before']:
            raise RuntimeError('The reviewed reporting calculation source changed before backup')
        original=common.backup_local_path(site,remote).read_bytes()
        after=(SOURCE/report['source']).read_bytes()
        if not after or len(after)>250000:raise RuntimeError('Invalid reporting calculation update size')
        if after!=original:
            patched=WORK/'payload'/remote.removeprefix(ROOT+'/');patched.parent.mkdir(parents=True,exist_ok=True);patched.write_bytes(after)
            report_updates[remote]={'before_sha256':common.digest(original),'after_sha256':common.digest(after),'before_bytes':len(original),'after_bytes':len(after),'kind':'report_logic','invisible_reporting_logic_update':True}
    new_assets={};reused_assets=[]
    for remote,data in assets.items():
        if remote in before:
            if before[remote]['type'].lower()!='file' or checksums[remote]!=common.digest(data):raise RuntimeError('An immutable tracking asset already exists with different content: '+remote)
            reused_assets.append(remote)
        else:new_assets[remote]=common.digest(data)
    if before.get(ROOT+'/assets/js',{}).get('type','').lower()!='dir':raise RuntimeError('The existing public JavaScript directory is unavailable')
    archive=make_archive(site,before,checksums)
    review={'loader_url':value['loader_url'],'html':patches,'report_updates':report_updates,'already_installed':unchanged,'new_assets':new_assets,'reused_assets':reused_assets,'asset_sha256':{p:common.digest(d) for p,d in assets.items()},'total_backup_files':len(checksums),'total_backup_bytes':total,'content_and_layout_source_preserved':all(p['restores_exact_original'] for p in patches.values()),'archive_sha256':common.file_hash(archive),'created_at':datetime.now(timezone.utc).isoformat()}
    (WORK/'patch-manifest.json').write_bytes(common.canonical(review))
    (WORK/'verified-backup.json').write_bytes(common.canonical({'inventory':before,'sha256':checksums,'review':review}))
    print('Complete backup archive verified:',len(checksums),'files;',total,'bytes. Planned tracking-only head additions:',len(patches),'; no remote writes.',flush=True)

def remote_bytes(ftp,path):
    chunks=[];ftp.retrbinary('RETR '+path,chunks.append);return b''.join(chunks)

def temporary_path(remote,token,rollback=False):
    if not public_html(remote) and remote not in REPORT_LOGIC_PATHS:raise RuntimeError('Temporary write is outside an exact public HTML or reporting-calculation target')
    folder,name=posixpath.split(remote)
    return folder+'/.simworx-tracking-'+token+'-'+name+('.rollback' if rollback else '.upload')

def verify_assets(ftp,assets):
    for remote,data in assets.items():
        if common.remote_hash(ftp,remote)[0]!=common.digest(data):raise RuntimeError('A tracking asset does not match its reviewed checksum')

def install(ftp,before,review,assets,token,transaction):
    if common.inventory(ftp)!=before:raise RuntimeError('Live inventory changed after backup; no writes attempted')
    for remote,data in assets.items():
        asset_path(remote)
        if remote in before:continue
        parent=posixpath.dirname(remote)
        if posixpath.basename(remote) in {name for name,_ in common.entries(ftp,parent)}:raise RuntimeError('A new immutable asset path appeared before upload')
        ftp.storbinary('STOR '+remote,io.BytesIO(data),blocksize=65536)
        transaction['assets'].add(remote)
        if common.remote_hash(ftp,remote)[0]!=common.digest(data):raise RuntimeError('A new tracking asset failed checksum verification')
    verify_assets(ftp,assets)
    updates={**review['html'],**review.get('report_updates',{})}
    for remote,item in updates.items():
        if not public_html(remote) and not (remote in REPORT_LOGIC_PATHS and item.get('kind')=='report_logic'):raise RuntimeError('Update target escaped the reviewed public or calculation allowlist')
        if common.remote_hash(ftp,remote)[0]!=item['before_sha256']:raise RuntimeError('A public page changed before tracking installation: '+remote)
        data=(WORK/'payload'/remote.removeprefix(ROOT+'/')).read_bytes()
        if common.digest(data)!=item['after_sha256']:raise RuntimeError('A prepared HTML tracking patch changed')
        temp=temporary_path(remote,token)
        if posixpath.basename(temp) in {name for name,_ in common.entries(ftp,posixpath.dirname(temp))}:raise RuntimeError('A temporary tracking path already exists')
        transaction['temps'].add(temp)
        ftp.storbinary('STOR '+temp,io.BytesIO(data),blocksize=65536)
        if common.remote_hash(ftp,temp)[0]!=item['after_sha256']:raise RuntimeError('A staged HTML tracking patch failed verification')
        if common.remote_hash(ftp,remote)[0]!=item['before_sha256']:raise RuntimeError('A public page changed before its atomic tracking replacement')
        # RNTO may succeed while its reply is lost. Record intent first so a
        # recovery connection checks both possible outcomes by exact checksum.
        transaction['changed'].add(remote)
        ftp.rename(temp,remote)
        transaction['temps'].discard(temp)
        if common.remote_hash(ftp,remote)[0]!=item['after_sha256']:raise RuntimeError('An installed tracking patch failed checksum verification')
        print('Installed '+('reporting calculation update:' if remote in REPORT_LOGIC_PATHS else 'tracking head hook:'),remote.removeprefix(ROOT+'/'),flush=True)

def rollback(ftp,review,token,transaction):
    failures=[]
    updates={**review['html'],**review.get('report_updates',{})}
    for remote in reversed(list(transaction['changed'])):
        item=updates[remote]
        current=common.remote_hash(ftp,remote)[0]
        if current==item['before_sha256']:continue
        if current!=item['after_sha256']:
            failures.append(remote);continue
        original=(WORK/'site'/remote.lstrip('/')).read_bytes()
        if common.digest(original)!=item['before_sha256']:raise RuntimeError('The backed-up original failed rollback validation')
        temp=temporary_path(remote,token,True)
        ftp.storbinary('STOR '+temp,io.BytesIO(original),blocksize=65536)
        if common.remote_hash(ftp,temp)[0]!=item['before_sha256']:raise RuntimeError('Rollback staging failed checksum verification')
        if common.remote_hash(ftp,remote)[0]!=item['after_sha256']:
            failures.append(remote);continue
        ftp.rename(temp,remote)
        if common.remote_hash(ftp,remote)[0]!=item['before_sha256']:failures.append(remote)
    # Delete only this transaction's owned temporary files, never an existing page.
    for remote in transaction['temps']:
        if '/.simworx-tracking-'+token+'-' not in remote:raise RuntimeError('Unsafe temporary cleanup path')
        try:ftp.delete(remote)
        except common.ftplib.error_perm as error:
            if not str(error).startswith('550'):failures.append(remote)
        except Exception:failures.append(remote)
    if failures:raise RuntimeError('Rollback preserved independently changed files; review required: '+', '.join(failures))
    print('Restored this transaction\'s public HTML changes only. New immutable tracking assets may remain unused.',flush=True)

def verify_scope(ftp,before,review,assets):
    after=common.inventory(ftp)
    targets=set(review['html'])|set(review.get('report_updates',{}))
    parents=set()
    for remote in targets|set(assets):
        parent=posixpath.dirname(remote)
        while parent.startswith(ROOT+'/'):
            parents.add(parent);parent=posixpath.dirname(parent)
    for remote,facts in before.items():
        if remote not in after or after[remote].get('type')!=facts.get('type'):raise RuntimeError('A pre-existing live path disappeared or changed type')
        if remote not in targets|parents and after[remote]!=facts:raise RuntimeError('An unrelated live path changed during tracking deployment: '+remote)
    expected_new=set(review['new_assets'])
    extra=set(after)-set(before)-expected_new
    if extra:raise RuntimeError('Unexpected new live paths appeared during tracking deployment')
    for remote,item in review['html'].items():
        current=remote_bytes(ftp,remote)
        original=(WORK/'site'/remote.lstrip('/')).read_bytes()
        properties=page_properties(remote,plan()[0])
        if common.digest(current)!=item['after_sha256'] or restore_original(current,review['loader_url'],properties)!=original:raise RuntimeError('The live HTML does not preserve exact existing source outside tracking')
    for remote,item in review.get('report_updates',{}).items():
        if remote not in REPORT_LOGIC_PATHS or item.get('kind')!='report_logic' or common.remote_hash(ftp,remote)[0]!=item['after_sha256']:
            raise RuntimeError('The exact reporting calculation update failed verification')
    verify_assets(ftp,assets)

def public_check(review,assets):
    # Apex is the observed working host. No DNS or redirect setting is changed.
    paths={}
    for remote in assets:paths[remote.removeprefix(ROOT)]=common.digest(assets[remote])
    html_paths=review['html']
    representatives={remote for remote in html_paths if Path(remote).name in {'index.html','contact.html','visual-systems.html'}}
    for kind in ('led','projection'):
        candidates=[p for p in html_paths if kind in Path(p).name.lower() and 'configur' in Path(p).name.lower()]
        if candidates:representatives.add(max(candidates,key=lambda p:(int((re.search(r'-v(\d+)',p,re.I)or ['','0'])[1]),p)))
    for remote in representatives:paths[remote.removeprefix(ROOT)]=html_paths[remote]['after_sha256']
    for remote,item in review.get('report_updates',{}).items():paths[remote.removeprefix(ROOT)]=item['after_sha256']
    for path,expected in paths.items():
        if expected is None:continue
        error=None
        for attempt in range(3):
            try:
                request=Request(PUBLIC+path+'?sw-tracking='+expected[:12],headers={'Cache-Control':'no-cache','User-Agent':'Simworx-tracking-verification'})
                with urlopen(request,timeout=20) as response:data=response.read()
                if common.digest(data)!=expected:raise RuntimeError('Public HTTPS content differs from the reviewed tracking patch: '+path)
                error=None;break
            except (URLError,TimeoutError,ConnectionError) as caught:error=caught
        if error:raise error
    print('Representative tracked pages and every tracking asset verified through HTTPS; every modified HTML source was verified through FTP.',flush=True)

def publish():
    value,assets=plan()
    if not re.fullmatch(r'[1-9][0-9]*',os.environ.get('RETAINED_BACKUP_ARTIFACT_ID','')):raise RuntimeError('A retained encrypted backup artifact ID is required before writes')
    evidence=json.loads((WORK/'verified-backup.json').read_text());review=evidence['review']
    archive=WORK/'live-htdocs.tar.gz';encrypted=WORK/'live-htdocs.tar.gz.enc'
    if not encrypted.is_file() or not encrypted.stat().st_size or common.file_hash(archive)!=review['archive_sha256']:raise RuntimeError('The verified and retained complete backup is unavailable')
    if {p:common.digest(d) for p,d in assets.items()}!=review['asset_sha256']:raise RuntimeError('Tracking assets changed after backup review')
    if review['loader_url']!=value['loader_url'] or not review['content_and_layout_source_preserved']:raise RuntimeError('Tracking-only source preservation proof is missing')
    token=common.digest(common.canonical(review))[:12]
    transaction={'changed':set(),'assets':set(),'temps':set()}
    try:
        with common.connect() as ftp:
            install(ftp,evidence['inventory'],review,assets,token,transaction)
            verify_scope(ftp,evidence['inventory'],review,assets)
    except Exception:
        if transaction['changed'] or transaction['temps']:
            with common.connect() as ftp:rollback(ftp,review,token,transaction)
        raise
    (WORK/'tracking-ftp-verified.json').write_bytes(common.canonical({'pages':review['html'],'report_updates':review.get('report_updates',{}),'assets':review['asset_sha256'],'content_and_layout_source_preserved':True,'ftp_verified_at':datetime.now(timezone.utc).isoformat()}))
    # A web verifier outage must not roll back correctly verified FTP pages.
    # Existing content/layout has already been proved byte-for-byte unchanged.
    public_check(review,assets)
    (WORK/'tracking-deployed.json').write_bytes(common.canonical({'pages':review['html'],'report_updates':review.get('report_updates',{}),'assets':review['asset_sha256'],'before_backup_files':review['total_backup_files'],'content_and_layout_source_preserved':True,'completed_at':datetime.now(timezone.utc).isoformat()}))
    print('Tracking installed without content or layout changes on',len(review['html']),'public HTML pages.',flush=True)

if __name__=='__main__':
    try:
        if len(sys.argv)!=2 or sys.argv[1] not in {'backup','publish','validate'}:raise RuntimeError('Use backup, publish or validate')
        {'backup':backup,'publish':publish,'validate':plan}[sys.argv[1]]()
    except Exception as error:
        message=str(error)
        for key in ('FTP_HOST','FTP_USERNAME','FTP_PASSWORD'):
            if os.environ.get(key):message=message.replace(os.environ[key],'[redacted]')
        print('::error::Tracking activation stopped ('+type(error).__name__+'): '+message[:1000].replace('\n',' '),file=sys.stderr)
        raise SystemExit(1)
