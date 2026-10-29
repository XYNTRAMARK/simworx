from __future__ import annotations
import ftplib,ssl,os,io,re,hashlib,posixpath,subprocess
from urllib.parse import urlsplit
from urllib.request import Request,urlopen
from pathlib import Path
ROOT="/htdocs";BASE="https://www.sim-worx.com"
def sha(b):return hashlib.sha256(b).hexdigest()
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
            if str(e).startswith("425") and not self.prefer_epsv:self.prefer_epsv=True;return super().ntransfercmd(c,rest)
            raise
def connect():
    raw=os.environ["FTP_HOST"].strip();p=urlsplit(raw if "://" in raw else "ftp://"+raw)
    f=F(context=ssl.create_default_context(),timeout=45);f.connect(p.hostname,p.port or 21);f.login(os.environ["FTP_USERNAME"],os.environ["FTP_PASSWORD"]);f.prot_p();return f
def read(f,p):a=[];f.retrbinary("RETR "+p,a.append);return b"".join(a)
def put(f,p,b,label):
    st=posixpath.dirname(p)+"/."+label+"-"+posixpath.basename(p)
    try:f.delete(st)
    except:pass
    f.storbinary("STOR "+st,io.BytesIO(b))
    if sha(read(f,st))!=sha(b):raise RuntimeError("stage mismatch "+p)
    f.rename(st,p)
    if sha(read(f,p))!=sha(b):raise RuntimeError("live mismatch "+p)

with connect() as f:
    app_path=ROOT+"/reports/app.js"
    app=read(f,app_path).decode("utf-8","replace")
    if "SIMWORX Reporting V3" not in app:raise RuntimeError("Unexpected reports app baseline")

    # Cache-bust the analytics module after this reporting release.
    app=app.replace("import { buildReport, defaultSettings } from './analytics.js';","import { buildReport, defaultSettings } from './analytics.js?v=reporting-v4';",1)

    # Replace raw-event aircraft grouping with final session-state grouping, with fallback.
    start=app.find("function wiModels(type){")
    end=app.find("\nfunction wiFunnel(type){",start)
    if start<0 or end<0:raise RuntimeError("wiModels boundary missing")
    replacement=r'''function wiConfigSessions(type){
 var allowed=new Set(wiEvents().filter(e=>wiCT(e)===type).map(e=>e.session_id));
 return (state.snapshot?.configuratorSessions||[]).filter(s=>String(s.configurator_type||'').toLowerCase()===type&&allowed.has(s.session_id));
}
function wiModels(type){
 var events=wiEvents().filter(e=>wiCT(e)===type),bySession=new Map();
 events.forEach(e=>{var a=bySession.get(e.session_id)||[];a.push(e);bySession.set(e.session_id,a)});
 var stored=wiConfigSessions(type);
 if(!stored.length){
  var groups=new Map();
  events.forEach(e=>{var p=wiP(e),cat=String(p.simulator_category||'Not Selected'),model=String(p.simulator_model||'Not Selected');if(cat==='Not Selected'&&model==='Not Selected')return;var key=cat+'|'+model,arr=groups.get(key)||[];arr.push(e);groups.set(key,arr)});
  return [...groups].map(([key,rows])=>{var parts=key.split('|'),cat=parts[0],model=parts.slice(1).join('|');return {category:cat,model:model,visitors:wiD(rows,e=>e.visitor_id),starts:wiD(rows.filter(e=>/configurator_started$/.test(wiName(e))||wiName(e)==='product_configurator_started'),e=>e.session_id),completed:wiD(rows.filter(e=>/configuration_completed$/.test(wiName(e))),e=>wiP(e).configuration_id||e.session_id),pdfs:wiD(rows.filter(e=>wiName(e)==='configuration_downloaded'),e=>e.session_id),emailed:wiD(rows.filter(e=>wiName(e)==='configuration_emailed'),e=>e.session_id),quote:wiD(rows.filter(e=>['product_quote_started','product_purchase_started'].includes(wiName(e))),e=>e.session_id),enquiries:wiD(rows.filter(e=>['product_enquiry_started','enquiry_submitted'].includes(wiName(e))),e=>e.session_id)}}).sort((a,b)=>b.visitors-a.visitors||b.starts-a.starts||a.model.localeCompare(b.model));
 }
 var groups=new Map();
 stored.forEach(s=>{
  var cat=String(s.simulator_category||'Not Selected'),model=String(s.simulator_model||'Not Selected');
  if(cat==='Not Selected'&&model==='Not Selected')return;
  var key=cat+'|'+model,g=groups.get(key);
  if(!g){g={category:cat,model:model,visitorIds:new Set(),sessionIds:new Set(),starts:new Set(),completed:new Set(),pdfs:new Set(),emailed:new Set(),quote:new Set(),enquiries:new Set()};groups.set(key,g)}
  var evs=bySession.get(s.session_id)||[];
  g.sessionIds.add(s.session_id);if(s.visitor_id)g.visitorIds.add(s.visitor_id);
  if(evs.some(e=>/configurator_started$/.test(wiName(e))||wiName(e)==='product_configurator_started'))g.starts.add(s.session_id);
  if(s.completed_at||evs.some(e=>/configuration_completed$/.test(wiName(e))))g.completed.add(s.session_id);
  if(evs.some(e=>wiName(e)==='configuration_downloaded'))g.pdfs.add(s.session_id);
  if(evs.some(e=>wiName(e)==='configuration_emailed'))g.emailed.add(s.session_id);
  if(evs.some(e=>['product_quote_started','product_purchase_started'].includes(wiName(e))))g.quote.add(s.session_id);
  if(evs.some(e=>['product_enquiry_started','enquiry_submitted','contact_form_submitted'].includes(wiName(e))))g.enquiries.add(s.session_id);
 });
 return [...groups.values()].map(g=>({category:g.category,model:g.model,visitors:g.visitorIds.size,starts:g.starts.size,completed:g.completed.size,pdfs:g.pdfs.size,emailed:g.emailed.size,quote:g.quote.size,enquiries:g.enquiries.size})).sort((a,b)=>b.visitors-a.visitors||b.starts-a.starts||a.model.localeCompare(b.model));
}
function wiLastSteps(type){
 var rows=wiConfigSessions(type),groups=new Map();
 rows.forEach(s=>{var step=String(s.last_step||'activity');var g=groups.get(step)||{step:step,sessions:0,visitors:new Set()};g.sessions++;if(s.visitor_id)g.visitors.add(s.visitor_id);groups.set(step,g)});
 var total=rows.length;
 return [...groups.values()].map(g=>({stage:human(g.step),sessions:g.sessions,visitors:g.visitors.size,share:total?100*g.sessions/total:null})).sort((a,b)=>b.sessions-a.sessions||a.stage.localeCompare(b.stage));
}
'''
    app=app[:start]+replacement+app[end:]

    # Add OpenAI landing-to-configurator reconciliation helper before renderTraffic.
    marker="function renderTraffic(){"
    idx=app.find(marker)
    if idx<0:raise RuntimeError("renderTraffic marker missing")
    helper=r'''function wiOpenAITraffic(){
 var events=wiEvents(),bySession=new Map();events.forEach(e=>{var a=bySession.get(e.session_id)||[];a.push(e);bySession.set(e.session_id,a)});
 var groups=new Map();
 events.filter(e=>wiName(e)==='session_started').forEach(e=>{
  var p=wiP(e),source=String(p.utm_source||p.source||''),medium=String(p.utm_medium||'');
  if(!(/openai|chatgpt/i.test(source)||/openai ads/i.test(String(p.source||'')))||!(/paid|cpc|ppc|ads?/i.test(medium)||/openai ads/i.test(String(p.source||''))))return;
  var campaign=String(p.utm_campaign||p.campaign||'(not tagged)'),g=groups.get(campaign);
  if(!g){g={campaign:campaign,visitors:new Set(),sessions:new Set(),pageViews:0,opens:new Set(),starts:new Set()};groups.set(campaign,g)}
  g.visitors.add(e.visitor_id);g.sessions.add(e.session_id);
  var evs=bySession.get(e.session_id)||[];
  g.pageViews+=evs.filter(x=>wiName(x)==='page_view').length;
  if(evs.some(x=>/configurator_opened$/.test(wiName(x))||wiName(x)==='product_configurator_opened'))g.opens.add(e.session_id);
  if(evs.some(x=>/configurator_started$/.test(wiName(x))||wiName(x)==='product_configurator_started'))g.starts.add(e.session_id);
 });
 var rows=[...groups.values()].map(g=>({campaign:g.campaign,visitors:g.visitors.size,sessions:g.sessions.size,pageViews:g.pageViews,opens:g.opens.size,starts:g.starts.size,startRate:g.sessions.size?100*g.starts.size/g.sessions.size:null})).sort((a,b)=>b.visitors-a.visitors||b.sessions-a.sessions);
 return {rows:rows,visitors:rows.reduce((a,r)=>a+r.visitors,0),sessions:rows.reduce((a,r)=>a+r.sessions,0),starts:rows.reduce((a,r)=>a+r.starts,0)};
}
'''
    app=app[:idx]+helper+app[idx:]

    # Inject last-stage panel into Configurators.
    old=""" var core=panel(type==='led'?'LED core progress':type==='projection'?'Projection core progress':'Cockpit core progress',funnel(f,type,true),{description:'Required steps only. Optional aircraft, PDF and email actions cannot suppress later-stage counts.'});
 var aircraft=panel('Aircraft & simulator choices',table([{label:'Aircraft / simulator',render:x=>escape(x.model)+'<span class="row-secondary">'+escape(x.category)+'</span>'},{label:'Visitors',num:true,render:x=>num(x.visitors)},{label:'Starts',num:true,render:x=>num(x.starts)},{label:'Completed/final',num:true,render:x=>num(x.completed)},{label:'PDFs',num:true,render:x=>num(x.pdfs)},{label:'Emailed',num:true,render:x=>num(x.emailed)},{label:'Enquiries',num:true,render:x=>num(x.enquiries)}],rows,{emptyTitle:'No aircraft selections recorded'}),{table:true,description:'Aircraft selection is optional and reported separately from the core funnel.'});
 if(type==='cockpit'){var products=panel('Cockpit product journey',table([{label:'Product',key:'name'},{label:'Page visitors',num:true,render:x=>num(x.pageVisitors)},{label:'Opened',num:true,render:x=>num(x.opened)},{label:'Starts',num:true,render:x=>num(x.starts)},{label:'Options',num:true,render:x=>num(x.optionChanged)},{label:'Quote',num:true,render:x=>num(x.quote)},{label:'Buy',num:true,render:x=>num(x.buy)},{label:'Enquiries',num:true,render:x=>num(x.enquiries)}],wiProducts()),{table:true,description:'Product-page visitors → active cockpit configuration → commercial intent.'});return tabs+top+'<div class="grid two">'+core+aircraft+'</div>'+products;}"""
    new=""" var core=panel(type==='led'?'LED core progress':type==='projection'?'Projection core progress':'Cockpit core progress',funnel(f,type,true),{description:'Required steps only. Optional aircraft, PDF and email actions cannot suppress later-stage counts.'});
 var stages=panel('Where sessions stopped',table([{label:'Last recorded stage',key:'stage'},{label:'Sessions',num:true,render:x=>num(x.sessions)},{label:'Visitors',num:true,render:x=>num(x.visitors)},{label:'Share',render:x=>pct(x.share)}],wiLastSteps(type),{emptyTitle:'No configurator sessions recorded'}),{table:true,description:'One final meaningful milestone per configurator session. Passive activity never replaces a milestone.'});
 var aircraft=panel('Aircraft & simulator choices',table([{label:'Aircraft / simulator',render:x=>escape(x.model)+'<span class="row-secondary">'+escape(x.category)+'</span>'},{label:'Visitors',num:true,render:x=>num(x.visitors)},{label:'Starts',num:true,render:x=>num(x.starts)},{label:'Completed/final',num:true,render:x=>num(x.completed)},{label:'PDFs',num:true,render:x=>num(x.pdfs)},{label:'Emailed',num:true,render:x=>num(x.emailed)},{label:'Enquiries',num:true,render:x=>num(x.enquiries)}],rows,{emptyTitle:'No aircraft selections recorded'}),{table:true,description:'Final recorded aircraft choice per configurator session; changing aircraft no longer double-counts one session.'});
 if(type==='cockpit'){var products=panel('Cockpit product journey',table([{label:'Product',key:'name'},{label:'Page visitors',num:true,render:x=>num(x.pageVisitors)},{label:'Opened',num:true,render:x=>num(x.opened)},{label:'Starts',num:true,render:x=>num(x.starts)},{label:'Options',num:true,render:x=>num(x.optionChanged)},{label:'Quote',num:true,render:x=>num(x.quote)},{label:'Buy',num:true,render:x=>num(x.buy)},{label:'Enquiries',num:true,render:x=>num(x.enquiries)}],wiProducts()),{table:true,description:'Product-page visitors → active cockpit configuration → commercial intent.'});return tabs+top+'<div class="grid two">'+core+stages+'</div>'+aircraft+products;}"""
    if old not in app:raise RuntimeError("Configurator panel anchor missing")
    app=app.replace(old,new,1)
    old2="""tabs+top+contacts+'<div class="grid two">'+core+aircraft+'</div>'+panel"""
    new2="""tabs+top+contacts+'<div class="grid two">'+core+stages+'</div>'+aircraft+panel"""
    if old2 not in app:raise RuntimeError("Visual configurator return anchor missing")
    app=app.replace(old2,new2,1)

    # Add OpenAI reconciliation to Traffic.
    old3="""function renderTraffic(){
 var base=renderTrafficLegacy(),products=wiProducts(),software=wiSoftware();
 var productsPanel=panel('Cockpit product journey'"""
    new3="""function renderTraffic(){
 var base=renderTrafficLegacy(),products=wiProducts(),software=wiSoftware(),openai=wiOpenAITraffic();
 var openaiPanel=panel('OpenAI Ads traffic reconciliation',table([
  {label:'Campaign',key:'campaign'},{label:'Visitors',num:true,render:x=>num(x.visitors)},{label:'Sessions',num:true,render:x=>num(x.sessions)},{label:'Page views',num:true,render:x=>num(x.pageViews)},{label:'Config opens',num:true,render:x=>num(x.opens)},{label:'Config starts',num:true,render:x=>num(x.starts)},{label:'Session → start',render:x=>pct(x.startRate)}
 ],openai.rows,{emptyTitle:'No OpenAI Ads traffic recorded',caption:'OpenAI Ads landing traffic: '+num(openai.visitors)+' visitors · '+num(openai.sessions)+' sessions · '+num(openai.starts)+' configurator starts'}),{table:true,description:'Landing traffic and configurator engagement are different populations. This shows the full OpenAI-attributed arrival count before the smaller configurator subset.'});
 var productsPanel=panel('Cockpit product journey'"""
    if old3 not in app:raise RuntimeError("Traffic start anchor missing")
    app=app.replace(old3,new3,1)
    old4=""" return base+'<div class="grid">'+productsPanel+softwarePanel+'</div>';"""
    new4=""" return base+openaiPanel+'<div class="grid">'+productsPanel+softwarePanel+'</div>';"""
    if old4 not in app:raise RuntimeError("Traffic return anchor missing")
    app=app.replace(old4,new4,1)

    # Syntax validation before publication.
    Path("/tmp/reporting-app-v4.mjs").write_text(app)
    subprocess.run(["node","--check","/tmp/reporting-app-v4.mjs"],check=True)
    put(f,app_path,app.encode(),"reporting-v4")

    index_path=ROOT+"/reports/index.html"
    index=read(f,index_path).decode("utf-8","replace")
    index=re.sub(r'<script type="module" src="\./app\.js(?:\?[^"]*)?"></script>','<script type="module" src="./app.js?v=reporting-v4"></script>',index,count=1)
    if 'app.js?v=reporting-v4' not in index:raise RuntimeError("reports cache-bust missing")
    put(f,index_path,index.encode(),"reporting-v4")
    f.quit()

# Public source verification.
for rel,need in [("/reports/app.js","OpenAI Ads traffic reconciliation"),("/reports/app.js","Where sessions stopped"),("/reports/index.html","app.js?v=reporting-v4")]:
    with urlopen(Request(BASE+rel+"?verify=reporting-v4",headers={"Cache-Control":"no-cache"}),timeout=45) as r:s=r.read().decode("utf-8","replace")
    if need not in s:raise RuntimeError("public reports verification failed "+rel)
print("REPORTS_V4_UI_PATCH_PASS")
