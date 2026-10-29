from __future__ import annotations
import ftplib, hashlib, io, json, os, posixpath, ssl, sys
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

ROOT=Path(__file__).resolve().parents[1]
V2=ROOT/'.reporting-audit/live-source'
V1=ROOT/'.reporting-audit/live-source-v1'

def read(base,name):
    return (base/name).read_text()

def must(src,old,new,label):
    if old not in src:
        raise RuntimeError('Missing patch anchor: '+label)
    return src.replace(old,new,1)

def between(src,start,end,new,label):
    a=src.find(start); b=src.find(end,a+len(start))
    if a<0 or b<0:
        raise RuntimeError('Missing patch range: '+label)
    return src[:a]+new+'\n'+src[b:]

def patch_analytics(src):
    src=src.replace('Europe/Paris','Europe/Madrid')
    src=must(src,
"""const isStart = e => /^(?:(?:led|projection)_)?configurator_started$/.test(name(e));
const isOpen = e => /^(?:(?:led|projection)_)?configurator_opened$/.test(name(e));
const isCompleted = e => /^(?:configuration_completed|led_configuration_completed|projection_configuration_completed)$/.test(name(e));""",
"""const isStart = e => /^(?:(?:led|projection|cockpit|product)_)?configurator_started$/.test(name(e));
const isOpen = e => /^(?:(?:led|projection|cockpit|product)_)?configurator_opened$/.test(name(e));
const isExplicitCompleted = e => /^(?:configuration_completed|led_configuration_completed|projection_configuration_completed)$/.test(name(e));
const isCompleted = e => isExplicitCompleted(e) || (configType(e)==='led' && ['configuration_copy_requested','configuration_emailed','enquiry_submitted','contact_form_submitted'].includes(name(e)));""",'event predicates')
    src=must(src,
"const configuratorMetrics=Object.fromEntries(['led','projection'].map(type=>[type,measures(events.filter(e=>configType(e)===type),facts,snapshot,visitorEvents)]));",
"const configuratorMetrics=Object.fromEntries(['led','projection','cockpit'].map(type=>[type,measures(events.filter(e=>configType(e)===type),facts,snapshot,visitorEvents)]));",
'config metrics')
    src=must(src,"if (!['led','projection'].includes(type)) continue;","if (!['led','projection','cockpit'].includes(type)) continue;",'contact types')
    return "/* SIMWORX Reporting V3 — canonical event definitions. */\n"+src

def patch_app(src):
    src=src.replace('Europe/Paris','Europe/Madrid')
    # Core funnel must contain required steps only. Aircraft/PDF/email are optional outcomes.
    start="function wiFunnel(type){"; end="function wiProducts(){"
    new="""function wiFunnel(type){
 var rows=wiEvents().filter(e=>wiCT(e)===type),sessions=new Map();
 rows.forEach(e=>{var a=sessions.get(e.session_id)||[];a.push(e);sessions.set(e.session_id,a)});
 function finalLed(e){var n=wiName(e);return /configuration_completed$/.test(n)||['configuration_copy_requested','configuration_emailed','enquiry_submitted','contact_form_submitted'].includes(n)}
 var tests=type==='led'?[
  ['visitors','Opened configurator',e=>/configurator_opened$/.test(wiName(e))],
  ['starts','Started configuration',e=>/configurator_started$/.test(wiName(e))],
  ['screen','Configured screen',e=>['screen_configuration_completed','screen_type_selected'].includes(wiName(e))],
  ['final','Reached review / quote action',finalLed]
 ]:type==='projection'?[
  ['visitors','Opened configurator',e=>/configurator_opened$/.test(wiName(e))],
  ['starts','Started configuration',e=>/configurator_started$/.test(wiName(e))],
  ['room','Confirmed room',e=>wiName(e)==='room_dimensions_entered'],
  ['screen','Configured screen',e=>['screen_configuration_completed','screen_geometry_selected'].includes(wiName(e))],
  ['spec','Generated projector specification',e=>['projector_spec_generated','price_or_spec_viewed'].includes(wiName(e))],
  ['final','Reached proposal',e=>/configuration_completed$/.test(wiName(e))]
 ]:[
  ['visitors','Opened cockpit configurator',e=>/configurator_opened$/.test(wiName(e))||wiName(e)==='product_configurator_opened'],
  ['starts','Started cockpit configuration',e=>/configurator_started$/.test(wiName(e))||wiName(e)==='product_configurator_started']
 ];
 var reached=tests.map(()=>new Set());
 for(const [sid,events] of sessions){events.sort((a,b)=>Date.parse(a.timestamp)-Date.parse(b.timestamp));var cursor=-1;for(var i=0;i<tests.length;i++){if(cursor<0&&i>0)break;var found=events.findIndex((e,n)=>n>cursor&&tests[i][2](e));if(found<0)break;reached[i].add(sid);cursor=found}}
 return tests.map((t,i)=>({key:t[0],label:t[1],count:reached[i].size,totalPct:reached[0].size?100*reached[i].size/reached[0].size:null,previousPct:i&&reached[i-1].size?100*reached[i].size/reached[i-1].size:i?null:(reached[i].size?100:null),lost:i?reached[i-1].size-reached[i].size:0,dropPct:i&&reached[i-1].size?100*(reached[i-1].size-reached[i].size)/reached[i-1].size:null,sessionIds:[...reached[i]],lostSessionIds:i?[...reached[i-1]].filter(id=>!reached[i].has(id)):[]}));
}
"""
    src=between(src,start,end,new,'core funnels')
    # Product page to cockpit journey: expose opens and option use, not just starts.
    src=must(src,
"return {name,category,pageVisitors:wiD(views,e=>e.visitor_id),pageViews:views.length,selected:wiD(selected,e=>e.session_id),starts:wiD(related.filter(e=>/configurator_started$/.test(wiName(e))||wiName(e)==='product_configurator_started'),e=>e.session_id),quote:wiD(related.filter(e=>wiName(e)==='product_quote_started'),e=>e.session_id),buy:wiD(related.filter(e=>wiName(e)==='product_purchase_started'),e=>e.session_id),enquiries:wiD(related.filter(e=>['product_enquiry_started','enquiry_submitted'].includes(wiName(e))),e=>e.session_id)}",
"return {name,category,pageVisitors:wiD(views,e=>e.visitor_id),pageViews:views.length,selected:wiD(selected,e=>e.session_id),opened:wiD(related.filter(e=>/configurator_opened$/.test(wiName(e))||wiName(e)==='product_configurator_opened'),e=>e.session_id),starts:wiD(related.filter(e=>/configurator_started$/.test(wiName(e))||wiName(e)==='product_configurator_started'),e=>e.session_id),optionChanged:wiD(related.filter(e=>wiName(e)==='product_option_selected'),e=>e.session_id),quote:wiD(related.filter(e=>wiName(e)==='product_quote_started'),e=>e.session_id),buy:wiD(related.filter(e=>wiName(e)==='product_purchase_started'),e=>e.session_id),enquiries:wiD(related.filter(e=>['product_enquiry_started','enquiry_submitted'].includes(wiName(e))),e=>e.session_id)}",
'product journey')
    # Software section clicks.
    src=must(src,
"return {pageVisitors:wiD(views,e=>e.visitor_id),pageViews:views.length,products:",
"return {pageVisitors:wiD(views,e=>e.visitor_id),pageViews:views.length,sectionClicks:events.filter(e=>wiName(e)==='software_section_clicked').length,products:",
'software section clicks')
    # OpenAI observed click IDs and starts.
    old="""function wiOpenAI(){
 var events=wiEvents().filter(e=>String(wiP(e).source||wiP(e).attribution?.last_touch?.source||'').toLowerCase()==='openai ads');
 return {sessions:wiD(events,e=>e.session_id),visitors:wiD(events,e=>e.visitor_id),pageViews:events.filter(e=>wiName(e)==='page_view').length,landingSessions:wiD(events.filter(e=>wiName(e)==='page_view'),e=>e.session_id)};
}"""
    new="""function wiOpenAI(){
 var events=wiEvents().filter(e=>{var p=wiP(e),source=String(p.source||p.last_touch?.source||p.attribution?.last_touch?.source||'').toLowerCase(),us=String(p.utm_source||p.last_touch?.utm_source||p.attribution?.last_touch?.utm_source||'').toLowerCase(),um=String(p.utm_medium||p.last_touch?.utm_medium||p.attribution?.last_touch?.utm_medium||'').toLowerCase();return source==='openai ads'||(/openai|chatgpt/.test(us)&&/paid|cpc|ppc|ads?/.test(um))});
 function clickId(e){var p=wiP(e),touch=p.last_touch||p.attribution?.last_touch||{};if(p.click_id||touch.click_id)return String(p.click_id||touch.click_id);try{return new URL(p.landing_page||touch.landing_page||e.page_url||location.origin,location.origin).searchParams.get('click_id')||''}catch(_){return ''}}
 return {sessions:wiD(events,e=>e.session_id),visitors:wiD(events,e=>e.visitor_id),pageViews:events.filter(e=>wiName(e)==='page_view').length,landingSessions:wiD(events.filter(e=>wiName(e)==='page_view'),e=>e.session_id),clickIds:wiD(events.map(e=>({id:clickId(e)})).filter(x=>x.id),x=>x.id),starts:wiD(events.filter(e=>/configurator_started$/.test(wiName(e))||wiName(e)==='product_configurator_started'),e=>e.session_id),softwareClicks:events.filter(e=>['software_section_clicked','software_product_clicked'].includes(wiName(e))).length};
}"""
    src=must(src,old,new,'OpenAI reconciliation')
    # Traffic tables: add actual cockpit open and option steps, software section click count.
    src=must(src,
"{label:'Selected',num:true,render:x=>num(x.selected)},{label:'Config starts',num:true,render:x=>num(x.starts)},{label:'Quote intent',num:true,render:x=>num(x.quote)},",
"{label:'Selected',num:true,render:x=>num(x.selected)},{label:'Opened config',num:true,render:x=>num(x.opened)},{label:'Config starts',num:true,render:x=>num(x.starts)},{label:'Options changed',num:true,render:x=>num(x.optionChanged)},{label:'Quote intent',num:true,render:x=>num(x.quote)},",
'product columns')
    src=must(src,
"caption:'Software page: '+num(software.pageVisitors)+' visitors · '+num(software.pageViews)+' views'",
"caption:'Software page: '+num(software.pageVisitors)+' visitors · '+num(software.pageViews)+' views · '+num(software.sectionClicks)+' clicks into Software'",
'software caption')
    # All three core funnels, no legacy optional-step funnel.
    fstart="function renderFunnels(){"; fend="function largestDropoff(){"
    frepl="""function renderFunnels(){
 return '<div class="grid two">'+panel('LED core progress',funnel(wiFunnel('led'),'led',true),{description:'Required screen journey only; aircraft and copy actions are optional outcomes.'})+panel('Projection core progress',funnel(wiFunnel('projection'),'projection',true),{description:'Room → screen → projector specification → proposal.'})+'</div><div class="grid two">'+panel('Cockpit configurator core progress',funnel(wiFunnel('cockpit'),'cockpit',true),{description:'Product configurator opened → active configuration started.'})+panel('Website funnel',funnel(state.report.funnels.website,'website',true),{description:'Website sessions reaching commercial milestones.'})+'</div>'+panel('Funnel by traffic source',table([{label:'Source',render:s=>makeAction('filter',s.name,escape(s.name),'row-link','data-dimension="source"')},{label:'Visitors',num:true,render:s=>num(s.visitors)},{label:'Starts',num:true,render:s=>num(s.starts)},{label:'Completed/final',num:true,render:s=>num(s.completed)},{label:'Emails',num:true,render:s=>num(s.emails)},{label:'Enquiries',num:true,render:s=>num(s.enquiries)},{label:'Enquiry rate',num:true,render:s=>pct(s.conversion)}],state.report.sources),{table:true,description:'Canonical Reporting V3 definitions.'});
}
"""
    src=between(src,fstart,fend,frepl,'render funnels')
    # Unified configurator tab and KPIs.
    cstart="function renderConfigurators(){"; cend="function preferenceList(rows)"
    crepl="""function renderConfigurators(){
 var requested=state.filters.configurator!=='All'?String(state.filters.configurator).toLowerCase():state.configuratorTab;
 var type=['led','projection','cockpit'].includes(requested)?requested:'led';state.configuratorTab=type;
 var f=wiFunnel(type),events=wiEvents().filter(e=>wiCT(e)===type),rows=wiModels(type),starts=f.find(x=>x.key==='starts')?.count||0,final=f.at(-1)?.count||0;
 var visitors=wiD(events,e=>e.visitor_id),emails=wiD(events.filter(e=>wiName(e)==='email_entered'),e=>e.visitor_id),emailed=wiD(events.filter(e=>wiName(e)==='configuration_emailed'),e=>e.session_id),pdfs=wiD(events.filter(e=>wiName(e)==='configuration_downloaded'),e=>e.session_id),prints=wiD(events.filter(e=>wiName(e)==='configuration_print_ready'||(wiName(e)==='configuration_copy_requested'&&['download','print'].includes(String(wiP(e).copy_action||wiP(e).quote_action||'')))),e=>e.session_id),quotes=wiD(events.filter(e=>wiName(e)==='product_quote_started'),e=>e.session_id),buys=wiD(events.filter(e=>wiName(e)==='product_purchase_started'),e=>e.session_id),enquiries=wiD(events.filter(e=>['product_enquiry_started','enquiry_submitted','contact_form_submitted'].includes(wiName(e))),e=>e.session_id);
 var tabs='<div class="tabbar" role="tablist" aria-label="Configurator type">'+['led','projection','cockpit'].map(t=>'<button role="tab" aria-selected="'+(t===type)+'" class="tab-button '+(t===type?'active':'')+'" data-action="configurator-tab" data-value="'+t+'">'+(t==='led'?'LED configurator':t==='projection'?'Projection configurator':'Cockpit configurators')+'</button>').join('')+'</div>';
 var metrics=type==='led'?[['Visitors',visitors],['Starts',starts],['Reached review / quote',final],['Emails captured',emails],['Emailed',emailed],['Print / PDF requested',prints]]:type==='projection'?[['Visitors',visitors],['Starts',starts],['Reached proposal',final],['Emails captured',emails],['Emailed',emailed],['PDFs saved',pdfs]]:[['Visitors',visitors],['Starts',starts],['Quote intent',quotes],['Buy intent',buys],['Enquiries',enquiries],['Start rate',pct(rate(starts,f[0]?.count||0))]];
 var top='<div class="inline-metrics config-metrics">'+metrics.map(([label,value])=>'<div class="inline-metric"><span>'+escape(label)+'</span><strong>'+(typeof value==='number'?num(value):value)+'</strong></div>').join('')+'</div>';
 var core=panel(type==='led'?'LED core progress':type==='projection'?'Projection core progress':'Cockpit core progress',funnel(f,type,true),{description:'Required steps only. Optional aircraft, PDF and email actions cannot suppress later-stage counts.'});
 var aircraft=panel('Aircraft & simulator choices',table([{label:'Aircraft / simulator',render:x=>escape(x.model)+'<span class="row-secondary">'+escape(x.category)+'</span>'},{label:'Visitors',num:true,render:x=>num(x.visitors)},{label:'Starts',num:true,render:x=>num(x.starts)},{label:'Completed/final',num:true,render:x=>num(x.completed)},{label:'PDFs',num:true,render:x=>num(x.pdfs)},{label:'Emailed',num:true,render:x=>num(x.emailed)},{label:'Enquiries',num:true,render:x=>num(x.enquiries)}],rows,{emptyTitle:'No aircraft selections recorded'}),{table:true,description:'Aircraft selection is optional and reported separately from the core funnel.'});
 if(type==='cockpit'){var products=panel('Cockpit product journey',table([{label:'Product',key:'name'},{label:'Page visitors',num:true,render:x=>num(x.pageVisitors)},{label:'Opened',num:true,render:x=>num(x.opened)},{label:'Starts',num:true,render:x=>num(x.starts)},{label:'Options',num:true,render:x=>num(x.optionChanged)},{label:'Quote',num:true,render:x=>num(x.quote)},{label:'Buy',num:true,render:x=>num(x.buy)},{label:'Enquiries',num:true,render:x=>num(x.enquiries)}],wiProducts()),{table:true,description:'Product-page visitors → active cockpit configuration → commercial intent.'});return tabs+top+'<div class="grid two">'+core+aircraft+'</div>'+products;}
 var contacts=renderConfiguratorContacts(type),configs=state.report.configurations.filter(c=>String(c.configurator_type).toLowerCase()===type),preferences=state.report.preferences||{};
 var pref='<div class="preference-grid" style="margin-bottom:20px">'+(type==='led'?[['Screen shape','screenTypes'],['Pixel pitch','pixelPitches'],['Horizontal field of view','fieldOfView']]:[['Projector type','projectorTypes'],['Mount style','mountStyles'],['Screen geometry','screenTypes']]).map(([title,key])=>panel(title,preferenceList(preferences[key]),{description:'Recorded selections within the current filters.'})).join('')+'</div>';
 return tabs+top+contacts+'<div class="grid two">'+core+aircraft+'</div>'+panel('Saved configurations',configTable(configs),{table:true,description:num(configs.length)+' stored '+type+' configuration records.'})+pref;
}
"""
    src=between(src,cstart,cend,crepl,'render configurators')
    # Better OpenAI reconciliation KPIs.
    src=must(src,
"['Tracked landing sessions',r.landingSessions],['Tracked sessions',r.sessions],['Distinct browsers',r.visitors],['Page views',r.pageViews]",
"['Tracked landing sessions',r.landingSessions],['Tracked sessions',r.sessions],['Distinct browsers',r.visitors],['Unique click IDs',r.clickIds],['Configurator starts',r.starts],['Software clicks',r.softwareClicks]",
'OpenAI metrics')
    return "/* SIMWORX Reporting V3 — unified configurator and traffic reporting. */\n"+src

def patch_configurator(src):
    src=must(src,
"""    var requestId = type + '-' + Date.now() + '-' + (++contactSequence);
    var data = Object.assign(dimensions(), { copy_action: action, copy_request_id: requestId, outcome: 'requested' });
    sdk.identify(contact, data);""",
"""    var requestId = type + '-' + Date.now() + '-' + (++contactSequence);
    var configurationId = completed(snapshot(), 'copy_action_requested');
    var data = Object.assign(dimensions(), { copy_action: action, copy_request_id: requestId, outcome: 'requested', configuration_id: configurationId || undefined });
    if (configurationId) contact.configuration_id = configurationId;
    sdk.identify(contact, data);""",'canonical completion before copy')
    old="""  document.addEventListener('simworx:submission-complete', function (event) {
    var form = event.target;
    if (type !== 'led' || !form || form.id !== 'led-quote-form' || !pendingForm) return;
    var pending = pendingForm; pendingForm = null;
    observe(function () {
      var dialog = node('led-quote-dialog'), result = text('led-action-result');
      if (!dialog || dialog.open !== false || Date.now() - pending.timestamp > 600000) return;
      var expected = pending.action === 'email' ? /^Quote .+ has been sent to / : pending.action === 'contact' ? /^Simworx has received quote .+ and your contact request\.$/ : /^Quote .+ is ready to print\.$/;
      if (!expected.test(result)) return;
      var data = Object.assign(dimensions(), { configuration_id: pending.configuration_id, contact: pending.contact, delivery_confirmed: true, delivery_method: 'led_quote_submit_php', quote_action: pending.action });
      if (pending.action === 'email') sdk.configurationEmailed(data);
      else if (pending.action === 'contact') sdk.enquirySubmitted(data);
      else sdk.identify(Object.assign(pending.contact, { configuration_id: pending.configuration_id }), data);
      sdk.flush();
    });
  }, true);"""
    new="""  function confirmLedSubmission(pending, attempt) {
    if (!pending || Date.now() - pending.timestamp > 600000) return;
    observe(function () {
      var result = text('led-action-result');
      var expected = pending.action === 'email' ? /^Quote .+ has been sent to / : pending.action === 'contact' ? /^Simworx has received quote .+ and your contact request\.$/ : /^Quote .+ is ready to print\.$/;
      if (expected.test(result)) {
        var data = Object.assign(dimensions(), { configuration_id: pending.configuration_id, contact: pending.contact, delivery_confirmed: true, delivery_method: 'led_quote_submit_php', quote_action: pending.action, outcome: 'confirmed' });
        if (pending.action === 'email') sdk.configurationEmailed(data);
        else if (pending.action === 'contact') sdk.enquirySubmitted(data);
        else sdk.trackEvent('configuration_print_ready', data);
        sdk.flush(); return;
      }
      if ((attempt || 0) < 30) setTimeout(function () { confirmLedSubmission(pending, (attempt || 0) + 1); }, 100);
    });
  }
  document.addEventListener('simworx:submission-complete', function (event) {
    var form = event.target;
    if (type !== 'led' || !form || form.id !== 'led-quote-form' || !pendingForm) return;
    var pending = pendingForm; pendingForm = null;
    setTimeout(function () { confirmLedSubmission(pending, 0); }, 0);
  }, true);"""
    src=must(src,old,new,'LED confirmed result')
    return "/* SIMWORX Configurator Reporting V3 — canonical completion and confirmed outcomes. */\n"+src

def build():
    analytics=patch_analytics(read(V2,'reports__analytics.js'))
    app=patch_app(read(V2,'reports__app.js'))
    c1=patch_configurator(read(V1,'assets__js__simworx-intelligence-configurator-v1.js'))
    c2=patch_configurator(read(V2,'assets__js__simworx-intelligence-configurator-v2.js'))
    outputs={
      'reports/analytics.js':analytics,'reports/app.js':app,
      'reports/config.js':read(V2,'reports__config.js'),'reports/index.html':read(V2,'reports__index.html'),
      'assets/js/simworx-intelligence-configurator-v1.js':c1,'assets/js/simworx-intelligence-configurator-v2.js':c2,
      'assets/js/simworx-intelligence-tracker-v1.js':read(V1,'assets__js__simworx-intelligence-tracker-v1.js'),
      'assets/js/simworx-intelligence-tracker-v2.js':read(V2,'assets__js__simworx-intelligence-tracker-v2.js'),
      'assets/js/simworx-intelligence-bootstrap-v1.js':read(V1,'assets__js__simworx-intelligence-bootstrap-v1.js'),
      'assets/js/simworx-intelligence-bootstrap-v2.js':read(V2,'assets__js__simworx-intelligence-bootstrap-v2.js')
    }
    for rel,text in outputs.items():
        path=ROOT/rel; path.parent.mkdir(parents=True,exist_ok=True);path.write_text(text)
    print('REPORTING_V3_BUILD_PASS',len(outputs))

class FTP(ftplib.FTP_TLS):
    prefer_epsv=False
    def makepasv(self):
        if self.prefer_epsv:
            try:return ftplib.parse229(self.sendcmd('EPSV'),self.sock.getpeername())
            except ftplib.error_perm:pass
        return super().makepasv()
    def ntransfercmd(self,c,rest=None):
        try:return super().ntransfercmd(c,rest)
        except ftplib.error_temp as e:
            if str(e).startswith('425') and not self.prefer_epsv:
                self.prefer_epsv=True;return super().ntransfercmd(c,rest)
            raise

def conn():
    raw=os.environ['FTP_HOST'].strip();p=urlsplit(raw if '://' in raw else 'ftp://'+raw)
    f=FTP(context=ssl.create_default_context(),timeout=45);f.connect(p.hostname,p.port or 21);f.login(os.environ['FTP_USERNAME'],os.environ['FTP_PASSWORD']);f.prot_p();return f
def remote(f,path):
    a=[];f.retrbinary('RETR '+path,a.append);return b''.join(a)
def digest(b):return hashlib.sha256(b).hexdigest()

def publish():
    m2=json.loads((V2/'manifest.json').read_text());m1=json.loads((V1/'manifest.json').read_text())
    expected={
      'reports/analytics.js':m2['/htdocs/reports/analytics.js']['sha256'],
      'reports/app.js':m2['/htdocs/reports/app.js']['sha256'],
      'assets/js/simworx-intelligence-configurator-v1.js':m1['/htdocs/assets/js/simworx-intelligence-configurator-v1.js']['sha256'],
      'assets/js/simworx-intelligence-configurator-v2.js':m2['/htdocs/assets/js/simworx-intelligence-configurator-v2.js']['sha256']
    }
    payload={k:(ROOT/k).read_bytes() for k in expected}
    with conn() as f:
        for rel,old in expected.items():
            if digest(remote(f,'/htdocs/'+rel))!=old: raise RuntimeError('Live file changed since audit: '+rel)
        for rel,body in payload.items():
            folder=posixpath.dirname(rel);stage='/htdocs/'+folder+'/.reporting-v3-'+posixpath.basename(rel)
            try:f.delete(stage)
            except Exception:pass
            f.storbinary('STOR '+stage,io.BytesIO(body))
            if digest(remote(f,stage))!=digest(body):raise RuntimeError('Stage mismatch '+rel)
        for rel,body in payload.items():
            folder=posixpath.dirname(rel);stage='/htdocs/'+folder+'/.reporting-v3-'+posixpath.basename(rel)
            f.rename(stage,'/htdocs/'+rel)
            if digest(remote(f,'/htdocs/'+rel))!=digest(body):raise RuntimeError('Publish mismatch '+rel)
        f.quit()
    for rel,body in payload.items():
        req=Request('https://www.sim-worx.com/'+rel+'?reporting-v3=1',headers={'Cache-Control':'no-cache','User-Agent':'Reporting-V3'})
        with urlopen(req,timeout=45) as r:
            if digest(r.read())!=digest(body):raise RuntimeError('Public mismatch '+rel)
    print('REPORTING_V3_PUBLISH_PASS')

if __name__=='__main__':
    build()
    if len(sys.argv)>1 and sys.argv[1]=='publish':publish()
