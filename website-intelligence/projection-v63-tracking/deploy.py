"""Add the existing first-party tracker to the current Projection stable/V63 pages only."""
from __future__ import annotations
import hashlib, io, json, os, pathlib, sys

BASE=pathlib.Path(__file__).resolve().parent
sys.path.insert(0,str(BASE.parent/'tracking-activation-v38'/'deploy'))
import ftp_common as ftp

WORK=pathlib.Path('/tmp/simworx-projection-v63-tracking')
PAGES={
 '/htdocs/projection-screen-configurator.html':'894c79494858a2d6d174001253f6b2936c2e97bbcb1ee3daea984969a530ffce',
 '/htdocs/projection-screen-configurator-v63.html':'894c79494858a2d6d174001253f6b2936c2e97bbcb1ee3daea984969a530ffce',
}
TAG=b'<script id="simworx-intelligence-tracking" defer src="/assets/js/simworx-intelligence-bootstrap-v2.js" data-configurator="projection" data-configurator-version="projection-v63"></script>\n'
REQUIRED=(b'v37-proposal-total',b'guided-model',b'projection-placement-mode',b'guided-next',b'projection-enquiry',b'v37-email-send')

def digest(data): return hashlib.sha256(data).hexdigest()
def retrieve(conn,path):
 out=io.BytesIO(); conn.retrbinary('RETR '+path,out.write); return out.getvalue()
def transform(data):
 if b'simworx-intelligence-tracking' in data: raise RuntimeError('Tracking hook already present')
 pos=data.lower().find(b'</head>')
 if pos<0: raise RuntimeError('Document head not found')
 return data[:pos]+TAG+data[pos:]
def verify_source(data):
 for token in REQUIRED:
  if token not in data: raise RuntimeError('Projection adapter selector missing: '+token.decode())
 patched=transform(data)
 if patched.replace(TAG,b'',1)!=data: raise RuntimeError('Transform changed bytes outside tracking hook')
 return patched
def validate():
 sample=b'<html><head><title>x</title></head><body>'+b''.join(REQUIRED)+b'</body></html>'
 patched=verify_source(sample)
 if patched.count(TAG)!=1 or patched.replace(TAG,b'',1)!=sample: raise RuntimeError('Transform is not reversible')
 print('PASS: Projection tracking transform is additive and reversible.')
def backup():
 if WORK.exists(): raise RuntimeError('Backup work directory already exists')
 (WORK/'originals').mkdir(parents=True,mode=0o700)
 manifest=[]
 with ftp.connect() as conn:
  for remote,expected in PAGES.items():
   data=retrieve(conn,remote)
   if digest(data)!=expected: raise RuntimeError('Live source changed: '+remote)
   patched=verify_source(data)
   name=pathlib.Path(remote).name
   (WORK/'originals'/name).write_bytes(data)
   (WORK/('patched-'+name)).write_bytes(patched)
   manifest.append({'path':remote,'before':expected,'after':digest(patched),'bytes_before':len(data),'bytes_after':len(patched)})
 (WORK/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
 print('Verified and backed up the exact two current Projection pages; no FTP writes.')
def publish():
 if not os.environ.get('RETAINED_BACKUP_ARTIFACT_ID','').isdigit(): raise RuntimeError('Retained backup required')
 manifest=json.loads((WORK/'manifest.json').read_text()); changed=[]
 with ftp.connect() as conn:
  for row in manifest:
   if digest(retrieve(conn,row['path']))!=row['before']: raise RuntimeError('Concurrent page change: '+row['path'])
  try:
   for row in manifest:
    target=row['path']; name=pathlib.Path(target).name
    original=(WORK/'originals'/name).read_bytes(); patched=verify_source(original)
    temp=target+'.tracking-v63-'+row['after'][:12]+'.tmp'
    conn.storbinary('STOR '+temp,io.BytesIO(patched))
    if digest(retrieve(conn,temp))!=row['after']: raise RuntimeError('Temporary upload mismatch: '+target)
    conn.rename(temp,target); changed.append(row)
    live=retrieve(conn,target)
    if digest(live)!=row['after'] or live.count(TAG)!=1 or live.replace(TAG,b'',1)!=original:
     raise RuntimeError('Published page verification failed: '+target)
  except Exception:
   for row in reversed(changed):
    target=row['path']; name=pathlib.Path(target).name
    live=retrieve(conn,target)
    if digest(live)==row['after']:
     original=(WORK/'originals'/name).read_bytes(); temp=target+'.tracking-v63-rollback.tmp'
     conn.storbinary('STOR '+temp,io.BytesIO(original)); conn.rename(temp,target)
     if digest(retrieve(conn,target))!=row['before']: raise RuntimeError('Rollback verification failed: '+target)
   raise
 print('Installed and verified one tracking hook on stable Projection and V63 only.')
def verify():
 with ftp.connect() as conn:
  for remote in PAGES:
   data=retrieve(conn,remote)
   if data.count(TAG)!=1: raise RuntimeError('Live tracking hook missing or duplicated: '+remote)
   if b'simworx-intelligence-bootstrap-v2.js' not in data: raise RuntimeError('Wrong tracker bootstrap: '+remote)
 print('PASS: both live Projection pages contain the V63 first-party tracking hook exactly once.')

if __name__=='__main__':
 try: {'validate':validate,'backup':backup,'publish':publish,'verify':verify}[sys.argv[1]]()
 except Exception as exc:
  print('Projection V63 tracking stopped:',type(exc).__name__,str(exc)[:220]); sys.exit(1)
