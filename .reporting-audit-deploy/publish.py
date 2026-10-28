from __future__ import annotations
import ftplib,hashlib,io,os,ssl,subprocess
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import Request,urlopen

ROOT="/htdocs/reports"; BASE="https://www.sim-worx.com/reports"
BACK=Path("/tmp/reports-audit-backup"); OUT=Path("/tmp/reports-audit-patched")
BACK.mkdir(parents=True,exist_ok=True); OUT.mkdir(parents=True,exist_ok=True)
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
            if str(e).startswith("425") and not self.prefer_epsv:
                self.prefer_epsv=True;return super().ntransfercmd(c,rest)
            raise
def connect():
    raw=os.environ["FTP_HOST"].strip();p=urlsplit(raw if "://" in raw else "ftp://"+raw)
    f=F(context=ssl.create_default_context(),timeout=45);f.connect(p.hostname,p.port or 21);f.login(os.environ["FTP_USERNAME"],os.environ["FTP_PASSWORD"]);f.prot_p();return f
def rb(f,path):a=[];f.retrbinary("RETR "+path,a.append);return b"".join(a)

with connect() as f:
    body=rb(f,ROOT+"/app.js");f.quit()
(BACK/"app.js").write_bytes(body)
app=body.decode("utf-8","replace")

helper=r'''
function wiName(e){return String(e&&e.event_name||'').toLowerCase();}
function wiP(e){return e&&e.properties&&typeof e.properties==='object'?e.properties:{};}
function wiPath(v){try{return new URL(v||'',location.origin).pathname.toLowerCase()}catch(_){return String(v||'').split('?')[0].toLowerCase()}}
function wiCT(e){var p=wiP(e);return String(p.configurator_type||p.configurator||'').toLowerCase();}
function wiD(rows,key){return new Set((rows||[]).map(key).filter(Boolean)).size;}
function wiEvents(){return state.report&&state.report.events||[];}
function wiModels(type){
 var groups=new Map();
 wiEvents().filter(e=>wiCT(e)===type).forEach(e=>{
   var p=wiP(e),cat=String(p.simulator_category||'Not Selected'),model=String(p.simulator_model||'Not Selected');
   if(cat==='Not Selected'&&model==='Not Selected')return;
   var key=cat+'|'+model,arr=groups.get(key)||[];arr.push(e);groups.set(key,arr);
 });
 return [...groups].map(([key,rows])=>{var parts=key.split('|'),cat=parts[0],model=parts.slice(1).join('|');return {
   category:cat,model:model,visitors:wiD(rows,e=>e.visitor_id),starts:wiD(rows.filter(e=>/configurator_started$/.test(wiName(e))||wiName(e)==='product_configurator_started'),e=>e.session_id),
   completed:wiD(rows.filter(e=>/configuration_completed$/.test(wiName(e))),e=>wiP(e).configuration_id||e.session_id),
   pdfs:wiD(rows.filter(e=>wiName(e)==='configuration_downloaded'),e=>e.session_id),emailed:wiD(rows.filter(e=>wiName(e)==='configuration_emailed'),e=>e.session_id),
   quote:wiD(rows.filter(e=>['product_quote_started','product_purchase_started'].includes(wiName(e))),e=>e.session_id),
   enquiries:wiD(rows.filter(e=>['product_enquiry_started','enquiry_submitted'].includes(wiName(e))),e=>e.session_id)
 }}).sort((a,b)=>b.visitors-a.visitors||b.starts-a.starts||a.model.localeCompare(b.model));
}
function wiFunnel(type){
 var rows=wiEvents().filter(e=>wiCT(e)===type),sessions=new Map();
 rows.forEach(e=>{var a=sessions.get(e.session_id)||[];a.push(e);sessions.set(e.session_id,a)});
 var tests=type==='cockpit'?[
  ['visitors','Opened cockpit configurator',e=>/configurator_opened$/.test(wiName(e))||wiName(e)==='product_configurator_opened'],
  ['starts','Started configuration',e=>/configurator_started$/.test(wiName(e))||wiName(e)==='product_configurator_started'],
  ['aircraft','Aircraft / cockpit identified',e=>wiName(e)==='simulator_model_selected'],
  ['options','Changed cockpit options',e=>wiName(e)==='product_option_selected'],
  ['intent','Requested quote / buy',e=>['product_quote_started','product_purchase_started'].includes(wiName(e))],
  ['enquiries','Started enquiry',e=>['product_enquiry_started','enquiry_submitted'].includes(wiName(e))]
 ]:[
  ['visitors','Opened configurator',e=>/configurator_opened$/.test(wiName(e))],
  ['starts','Started configuration',e=>/configurator_started$/.test(wiName(e))],
  ['aircraft','Selected aircraft / simulator',e=>['simulator_category_selected','simulator_model_selected'].includes(wiName(e))],
  ['completed','Completed configuration',e=>/configuration_completed$/.test(wiName(e))],
  ['pdf','Saved PDF',e=>wiName(e)==='configuration_downloaded'],
  ['emailed','Emailed configuration',e=>wiName(e)==='configuration_emailed'],
  ['enquiries','Submitted enquiry',e=>wiName(e)==='enquiry_submitted']
 ];
 var reached=tests.map(()=>new Set());
 for(const [sid,events] of sessions){events.sort((a,b)=>Date.parse(a.timestamp)-Date.parse(b.timestamp));var cursor=-1;for(var i=0;i<tests.length;i++){if(cursor<0&&i>0)break;var found=events.findIndex((e,n)=>n>cursor&&tests[i][2](e));if(found<0)break;reached[i].add(sid);cursor=found}}
 return tests.map((t,i)=>({key:t[0],label:t[1],count:reached[i].size,totalPct:reached[0].size?100*reached[i].size/reached[0].size:null,previousPct:i&&reached[i-1].size?100*reached[i].size/reached[i-1].size:i?null:(reached[i].size?100:null),lost:i?reached[i-1].size-reached[i].size:0,dropPct:i&&reached[i-1].size?100*(reached[i-1].size-reached[i].size)/reached[i-1].size:null,sessionIds:[...reached[i]],lostSessionIds:i?[...reached[i-1]].filter(id=>!reached[i].has(id)):[]}));
}
function wiProducts(){
 var events=wiEvents(),defs=[['/f16-frames.html','F16 Frames','Fighter'],['/a320-single-seat.html','A320 Single Seat','Airliner'],['/a320-full-cockpit.html','A320 Full Cockpit','Airliner'],['/a320-supershort.html','A320 Supershort','Airliner']];
 return defs.map(d=>{var path=d[0],name=d[1],category=d[2],views=events.filter(e=>wiName(e)==='page_view'&&wiPath(e.page_url)===path),selected=events.filter(e=>{var p=wiP(e),target=wiPath(p.target_path||p.target_url);return (wiName(e)==='product_configurator_selected'&&target===path)||(wiName(e)==='cta_clicked'&&wiPath(e.page_url)==='/frames.html'&&target===path)}),related=events.filter(e=>wiCT(e)==='cockpit'&&String(wiP(e).simulator_model||'').toLowerCase()===name.toLowerCase());return {name,category,pageVisitors:wiD(views,e=>e.visitor_id),pageViews:views.length,selected:wiD(selected,e=>e.session_id),starts:wiD(related.filter(e=>/configurator_started$/.test(wiName(e))||wiName(e)==='product_configurator_started'),e=>e.session_id),quote:wiD(related.filter(e=>wiName(e)==='product_quote_started'),e=>e.session_id),buy:wiD(related.filter(e=>wiName(e)==='product_purchase_started'),e=>e.session_id),enquiries:wiD(related.filter(e=>['product_enquiry_started','enquiry_submitted'].includes(wiName(e))),e=>e.session_id)}});
}
function wiSoftware(){
 var events=wiEvents(),views=events.filter(e=>wiName(e)==='page_view'&&wiPath(e.page_url)==='/software.html'),groups=new Map();
 function product(e){var p=wiP(e),hay=(String(p.software_product||'')+' '+String(p.cta||'')+' '+wiPath(p.target_path||p.target_url)).toLowerCase();if(wiName(e)==='software_product_clicked'&&p.software_product)return String(p.software_product);if(/simstarter/.test(hay))return 'SimStarter Pro';if(/certification/.test(hay))return 'Certification Pro';if(/gameboost|free trial/.test(hay))return 'GameBoost';if(/qtg|request a demo/.test(hay))return 'QTG Pro';return null}
 events.forEach(e=>{if(wiName(e)!=='software_product_clicked'&&!(wiName(e)==='cta_clicked'&&['/software.html','/frames.html'].includes(wiPath(e.page_url))))return;var n=product(e);if(!n)return;var a=groups.get(n)||[];a.push(e);groups.set(n,a)});
 return {pageVisitors:wiD(views,e=>e.visitor_id),pageViews:views.length,products:[...groups].map(([name,rows])=>({name,clicks:rows.length,visitors:wiD(rows,e=>e.visitor_id),sessions:wiD(rows,e=>e.session_id)})).sort((a,b)=>b.clicks-a.clicks||a.name.localeCompare(b.name))};
}
function wiOpenAI(){
 var events=wiEvents().filter(e=>String(wiP(e).source||wiP(e).attribution?.last_touch?.source||'').toLowerCase()==='openai ads');
 return {sessions:wiD(events,e=>e.session_id),visitors:wiD(events,e=>e.visitor_id),pageViews:events.filter(e=>wiName(e)==='page_view').length,landingSessions:wiD(events.filter(e=>wiName(e)==='page_view'),e=>e.session_id)};
}
'''
idx=app.find("function renderTraffic()")
if idx<0:raise RuntimeError("renderTraffic anchor missing")
if "function wiModels(" not in app:app=app[:idx]+helper+"\n"+app[idx:]

# Rename existing renderers so all old panels stay available.
for old,new in [
 ("function renderTraffic()","function renderTrafficLegacy()"),
 ("function renderFunnels()","function renderFunnelsLegacy()"),
 ("function renderConfigurators()","function renderConfiguratorsLegacy()"),
 ("function renderOpenAI()","function renderOpenAILegacy()")
]:
    if old not in app:raise RuntimeError("legacy renderer anchor missing: "+old)
    app=app.replace(old,new,1)

# New Traffic wraps the existing page and adds product/software panels.
insert=app.find("function renderFunnelsLegacy()")
traffic=r'''
function renderTraffic(){
 var base=renderTrafficLegacy(),products=wiProducts(),software=wiSoftware();
 var productsPanel=panel('Cockpit product journey',table([
  {label:'Product',key:'name'},{label:'Page visitors',num:true,render:x=>num(x.pageVisitors)},{label:'Views',num:true,render:x=>num(x.pageViews)},
  {label:'Selected',num:true,render:x=>num(x.selected)},{label:'Config starts',num:true,render:x=>num(x.starts)},{label:'Quote intent',num:true,render:x=>num(x.quote)},
  {label:'Buy intent',num:true,render:x=>num(x.buy)},{label:'Enquiries',num:true,render:x=>num(x.enquiries)}
 ],products),{table:true,description:'Product-page traffic and the path into active cockpit configuration. Detailed start and option events are reliable from the current tracker onward.'});
 var softwarePanel=panel('Software interest',table([
  {label:'Software',key:'name'},{label:'Clicks',num:true,render:x=>num(x.clicks)},{label:'Visitors',num:true,render:x=>num(x.visitors)},{label:'Sessions',num:true,render:x=>num(x.sessions)}
 ],software.products,{emptyTitle:'No software product clicks recorded',caption:'Software page: '+num(software.pageVisitors)+' visitors · '+num(software.pageViews)+' views'}),{table:true,description:'QTG Pro, SimStarter Pro, GameBoost and Certification Pro interest. Historical CTA clicks are recovered where the target identifies the product.'});
 return base+'<div class="grid">'+productsPanel+softwarePanel+'</div>';
}
'''
app=app[:insert]+traffic+app[insert:]

# New Funnels wraps existing funnels and adds cockpit funnel.
insert=app.find("function largestDropoff()")
funnels=r'''
function renderFunnels(){
 return renderFunnelsLegacy()+panel('Cockpit configurator funnel',funnel(wiFunnel('cockpit'),'cockpit',true),{description:'Product open → configuration start → aircraft → options → quote/buy intent → enquiry.'});
}
'''
app=app[:insert]+funnels+app[insert:]

# New Configurators preserves legacy LED/Projection and adds richer audit + Cockpit tab.
insert=app.find("function preferenceList")
config=r'''
function renderConfigurators(){
 var requested=state.filters.configurator!=='All'?String(state.filters.configurator).toLowerCase():state.configuratorTab;
 var type=['led','projection','cockpit'].includes(requested)?requested:'led';
 state.configuratorTab=type;
 var rows=wiModels(type),f=wiFunnel(type),events=wiEvents().filter(e=>wiCT(e)===type);
 var pdfs=wiD(events.filter(e=>wiName(e)==='configuration_downloaded'),e=>e.session_id);
 var emailed=wiD(events.filter(e=>wiName(e)==='configuration_emailed'),e=>e.session_id);
 var aircraft=panel('Aircraft & simulator choices',table([
  {label:'Aircraft / simulator',render:x=>escape(x.model)+'<span class="row-secondary">'+escape(x.category)+'</span>'},
  {label:'Visitors',num:true,render:x=>num(x.visitors)},{label:'Starts',num:true,render:x=>num(x.starts)},
  {label:type==='cockpit'?'Quote / buy':'Completed',num:true,render:x=>num(type==='cockpit'?x.quote:x.completed)},
  {label:'PDFs',num:true,render:x=>num(x.pdfs)},{label:'Emailed',num:true,render:x=>num(x.emailed)},{label:'Enquiries',num:true,render:x=>num(x.enquiries)}
 ],rows,{emptyTitle:'No aircraft selections recorded'}),{table:true,description:'Aircraft/model choices attributed to the same configurator session.'});
 var audit=panel('Tracked outcomes',table([
  {label:'Metric',key:'name'},{label:'Sessions',num:true,render:x=>num(x.value)}
 ],[
  {name:'Opened configurator',value:f[0]?.count||0},{name:'Started configuration',value:f.find(x=>x.key==='starts')?.count||0},
  {name:type==='cockpit'?'Quote / buy intent':'Completed configuration',value:type==='cockpit'?(f.find(x=>x.key==='intent')?.count||0):(f.find(x=>x.key==='completed')?.count||0)},
  {name:'Saved PDF',value:pdfs},{name:'Emailed configuration',value:emailed}
 ]),{table:true,description:'These are distinct tracked sessions, not raw click counts.'});
 if(type!=='cockpit')return renderConfiguratorsLegacy()+'<div class="grid two">'+aircraft+audit+'</div>';
 var tabs='<div class="tabbar" role="tablist" aria-label="Configurator type">'+['led','projection','cockpit'].map(t=>'<button role="tab" aria-selected="'+(t===type)+'" class="tab-button '+(t===type?'active':'')+'" data-action="configurator-tab" data-value="'+t+'">'+(t==='led'?'LED configurator':t==='projection'?'Projection configurator':'Cockpit configurators')+'</button>').join('')+'</div>';
 var cockpitJourney=panel('Cockpit product journey',table([
  {label:'Product',key:'name'},{label:'Page visitors',num:true,render:x=>num(x.pageVisitors)},{label:'Selected',num:true,render:x=>num(x.selected)},
  {label:'Starts',num:true,render:x=>num(x.starts)},{label:'Quote intent',num:true,render:x=>num(x.quote)},{label:'Buy intent',num:true,render:x=>num(x.buy)},{label:'Enquiries',num:true,render:x=>num(x.enquiries)}
 ],wiProducts()),{table:true,description:'Which cockpit pages become active configurations and commercial intent.'});
 return tabs+'<div class="grid two">'+panel('Cockpit conversion funnel',funnel(f,'cockpit',true),{description:'Ordered tracked sessions.'})+aircraft+'</div><div class="grid two">'+audit+cockpitJourney+'</div>';
}
'''
app=app[:insert]+config+app[insert:]

# New OpenAI section prepends a reconciliation panel, then keeps the existing campaign tables.
insert=app.find("function renderCampaigns()")
openai=r'''
function renderOpenAI(){
 var r=wiOpenAI();
 var note='<div class="inline-metrics config-metrics">'+[
  ['Tracked landing sessions',r.landingSessions],['Tracked sessions',r.sessions],['Distinct browsers',r.visitors],['Page views',r.pageViews]
 ].map(x=>'<div class="inline-metric"><span>'+escape(x[0])+'</span><strong>'+num(x[1])+'</strong></div>').join('')+'</div>'+
 '<p class="panel-note">Ads Manager clicks and first-party website visitors are different measures. One browser can create several ad clicks; consent refusal, blockers, redirects and failed page loads can also stop a click becoming a tracked website session.</p>';
 return panel('OpenAI Ads — tracking reconciliation',note,{description:'Use these website-side measures when comparing against Ads Manager.'})+renderOpenAILegacy();
}
'''
app=app[:insert]+openai+app[insert:]

for marker in ["function wiModels(","Cockpit product journey","Software interest","Aircraft & simulator choices","OpenAI Ads — tracking reconciliation","Cockpit configurator funnel"]:
    if marker not in app:raise RuntimeError("Reports extension marker missing: "+marker)
(OUT/"app.js").write_text(app)
subprocess.run(["node","--check",str(OUT/"app.js")],check=True)

with connect() as f:
    data=(OUT/"app.js").read_bytes();stage=ROOT+"/.app-reporting-audit.js"
    try:f.delete(stage)
    except Exception:pass
    f.storbinary("STOR "+stage,io.BytesIO(data))
    if sha(rb(f,stage))!=sha(data):raise RuntimeError("stage checksum mismatch")
    f.rename(stage,ROOT+"/app.js")
    if sha(rb(f,ROOT+"/app.js"))!=sha(data):raise RuntimeError("live checksum mismatch")
    f.quit()
req=Request(BASE+"/app.js?reporting-audit=1",headers={"Cache-Control":"no-cache","User-Agent":"Simworx-reporting-audit"})
if sha(urlopen(req,timeout=45).read())!=sha((OUT/"app.js").read_bytes()):raise RuntimeError("public app.js mismatch")
print("REPORTING_AUDIT_EXTENSION_PUBLISHED")
