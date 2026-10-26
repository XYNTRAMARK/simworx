"""Checksum-guarded update of four attribution files; retains encrypted originals."""
import sys, pathlib, json, hashlib, io, os
BASE=pathlib.Path(__file__).resolve().parent
sys.path.insert(0,str(BASE.parent/'tracking-activation'/'deploy'))
import ftp_common as ftp
WORK=pathlib.Path('/tmp/openai-attribution-backup')
ALLOWED={'reports/analytics.js','reports/app.js','assets/js/simworx-intelligence-tracker-v1.js','assets/js/simworx-intelligence-tracker-v2.js'}
def digest(b):return hashlib.sha256(b).hexdigest()
def retrieve(conn,path):
 out=io.BytesIO();conn.retrbinary('RETR '+path,out.write);return out.getvalue()
def plan():
 rows=json.loads((BASE/'plan.json').read_text());assert {r['path'] for r in rows}==ALLOWED and len(rows)==4
 for r in rows:assert digest((BASE/r['path']).read_bytes())==r['after']
 return rows
def backup():
 WORK.mkdir(mode=0o700,exist_ok=False)
 with ftp.connect() as conn:
  for r in plan():
   data=retrieve(conn,'/htdocs/'+r['path']);assert digest(data)==r['before'],'Live source changed: '+r['path']
   p=WORK/r['path'];p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data)
 (WORK/'plan.json').write_bytes((BASE/'plan.json').read_bytes())
 print('Verified originals backed up for all four attribution files.')
def publish():
 assert os.environ.get('RETAINED_BACKUP_ARTIFACT_ID','').isdigit(),'Retained backup required'
 rows=plan();assert (WORK/'plan.json').read_bytes()==(BASE/'plan.json').read_bytes()
 changed=[]
 with ftp.connect() as conn:
  for r in rows:assert digest(retrieve(conn,'/htdocs/'+r['path']))==r['before'],'Concurrent change; no writes'
  try:
   for r in rows:
    target='/htdocs/'+r['path'];temp=target+'.openai-'+r['after'][:12]+'.tmp'
    assert digest(retrieve(conn,target))==r['before']
    conn.storbinary('STOR '+temp,io.BytesIO((BASE/r['path']).read_bytes()))
    assert digest(retrieve(conn,temp))==r['after']
    changed.append(r);conn.rename(temp,target)
    assert digest(retrieve(conn,target))==r['after']
  except Exception:
   for r in reversed(changed):
    target='/htdocs/'+r['path'];current=digest(retrieve(conn,target))
    if current==r['after']:
     data=(WORK/r['path']).read_bytes();assert digest(data)==r['before']
     temp=target+'.openai-rollback.tmp';conn.storbinary('STOR '+temp,io.BytesIO(data));conn.rename(temp,target)
     assert digest(retrieve(conn,target))==r['before']
   raise
 print('All four attribution files installed and verified; no page, database or other source changes.')
if __name__=='__main__':
 try:{'backup':backup,'publish':publish,'validate':plan}[sys.argv[1]]()
 except Exception as e:
  print('Attribution update stopped:',type(e).__name__,str(e)[:180]);sys.exit(1)
