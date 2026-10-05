(function(){
  'use strict';
  var cfg=window.SIMWORX_SUPPORT_CONFIG;
  if(!cfg||!window.supabase){throw new Error('Support portal configuration failed to load.');}
  var db=window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey,{
    auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
  });
  var SP=window.SupportPortal={
    db:db,cfg:cfg,user:null,profile:null,memberships:[],companies:[],projects:[],contracts:[],
    categories:[],tickets:[],periods:[],usage:[],staff:[],selectedTicket:null,currentView:'dashboard',
    channel:null,isStaff:false,isAdmin:false,isApprover:false
  };

  SP.q=function(sel,root){return (root||document).querySelector(sel);};
  SP.qa=function(sel,root){return Array.prototype.slice.call((root||document).querySelectorAll(sel));};
  SP.esc=function(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c];});};
  SP.fmtDate=function(v,withTime){
    if(!v)return '—'; var d=new Date(v); if(Number.isNaN(d.getTime()))return '—';
    return new Intl.DateTimeFormat('en-GB',withTime?{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}:{day:'2-digit',month:'short',year:'numeric'}).format(d);
  };
  SP.minutes=function(n){n=Math.max(0,Number(n)||0);var h=Math.floor(n/60),m=n%60;return h?h+'h '+(m?m+'m':''):m+'m';};
  SP.money=function(n,c){return new Intl.NumberFormat('en-GB',{style:'currency',currency:c||'EUR'}).format(Number(n)||0);};
  SP.initials=function(name){return String(name||'SW').split(/\s+/).filter(Boolean).slice(0,2).map(function(x){return x[0];}).join('').toUpperCase();};
  SP.statusLabel=function(v){return String(v||'').replace(/_/g,' ').replace(/\b\w/g,function(m){return m.toUpperCase();});};
  SP.toast=function(msg,error){
    var el=SP.q('#portal-toast');el.textContent=msg;el.className='portal-toast show'+(error?' error':'');
    clearTimeout(SP._toastTimer);SP._toastTimer=setTimeout(function(){el.className='portal-toast';},3500);
  };
  SP.errorMessage=function(err){return err&&err.message?err.message:String(err||'Unknown error');};
  SP.setLoading=function(){
    SP.q('#portal-main').innerHTML='<div class="spinner" aria-label="Loading"></div>';
  };
  SP.setTopbar=function(title,crumb){
    SP.q('#topbar-title').textContent=title||'Support Portal';
    SP.q('#topbar-breadcrumb').textContent=(crumb||'SUPPORT PORTAL').toUpperCase();
  };
  SP.roleLabel=function(){
    if(SP.profile&&SP.profile.is_simworx)return SP.profile.staff_role==='admin'?'Simworx Administrator':SP.profile.staff_role==='second_line_engineer'?'Second-Line Engineer':'Support Engineer';
    if(SP.memberships.some(function(m){return m.designated_support_approver||m.role==='approver'||m.role==='company_admin';}))return 'Customer Approver';
    return 'Customer User';
  };
  SP.primaryCompany=function(){
    if(SP.profile&&SP.profile.is_simworx)return SP.companies[0]||null;
    var id=SP.memberships.length?SP.memberships[0].company_id:null;
    return SP.companies.find(function(c){return c.id===id;})||null;
  };
  SP.activeContract=function(companyId){
    return SP.contracts.find(function(c){return c.company_id===companyId&&c.status==='active';})||null;
  };
  SP.companyById=function(id){return SP.companies.find(function(x){return x.id===id;})||null;};
  SP.projectById=function(id){return SP.projects.find(function(x){return x.id===id;})||null;};
  SP.contractById=function(id){return SP.contracts.find(function(x){return x.id===id;})||null;};
  SP.usageByContract=function(contractId){return SP.usage.find(function(x){return x.contract_id===contractId;})||null;};

  SP.showAuth=function(){
    SP.q('#auth-shell').classList.remove('hidden');SP.q('#pin-shell').classList.add('hidden');SP.q('#portal-app').classList.add('hidden');
  };
  SP.showPin=function(needsSet){
    SP.q('#auth-shell').classList.add('hidden');SP.q('#pin-shell').classList.remove('hidden');SP.q('#portal-app').classList.add('hidden');
    SP.q('#pin-title').textContent=needsSet?'Create portal PIN':'Enter portal PIN';
    SP.q('#pin-copy').textContent=needsSet?'Choose a 4–8 digit PIN. It will be required after sign-in on a new browser session.':'Your support records are protected by an additional PIN.';
    SP.q('#pin-form').dataset.mode=needsSet?'set':'verify';
    SP.q('#pin-input').value='';SP.q('#pin-input').focus();
  };
  SP.showApp=function(){
    SP.q('#auth-shell').classList.add('hidden');SP.q('#pin-shell').classList.add('hidden');SP.q('#portal-app').classList.remove('hidden');
  };

  SP.loadIdentity=async function(){
    var res=await db.auth.getUser(); if(res.error)throw res.error; SP.user=res.data.user;
    if(!SP.user)throw new Error('No authenticated user.');
    var p=await db.from('profiles').select('*').eq('id',SP.user.id).single();
    if(p.error)throw p.error;SP.profile=p.data;
    var m=await db.from('company_users').select('*').eq('user_id',SP.user.id).eq('active',true);
    if(m.error)throw m.error;SP.memberships=m.data||[];
    SP.isStaff=!!SP.profile.is_simworx;SP.isAdmin=SP.profile.staff_role==='admin';
    SP.isApprover=SP.isStaff||SP.memberships.some(function(x){return x.designated_support_approver||x.role==='approver'||x.role==='company_admin';});
  };

  SP.loadBaseData=async function(){
    var results=await Promise.all([
      db.from('companies').select('*').eq('active',true).order('legal_name'),
      db.from('projects').select('*').eq('active',true).order('name'),
      db.from('support_contracts').select('*').order('starts_on',{ascending:false}),
      db.from('support_categories').select('*').eq('active',true).order('sort_order'),
      db.from('tickets').select('*').order('created_at',{ascending:false}),
      db.from('profiles').select('id,email,full_name,is_simworx,staff_role,active').eq('is_simworx',true).eq('active',true)
    ]);
    results.forEach(function(r){if(r.error)throw r.error;});
    SP.companies=results[0].data||[];SP.projects=results[1].data||[];SP.contracts=results[2].data||[];
    SP.categories=results[3].data||[];SP.tickets=results[4].data||[];SP.staff=results[5].data||[];
    await SP.refreshUsage();
    SP.updateShell();
  };

  SP.refreshUsage=async function(){
    var active=SP.contracts.filter(function(c){return c.status==='active';});
    for(var i=0;i<active.length;i++){
      var er=await db.rpc('ensure_support_period',{p_contract:active[i].id,p_when:new Date().toISOString()});
      if(er.error&&SP.isStaff)console.warn(er.error);
    }
    var u=await db.from('contract_usage_summary').select('*').order('period_start',{ascending:false});
    if(u.error)throw u.error;SP.usage=u.data||[];
  };

  SP.reloadTickets=async function(){
    var r=await db.from('tickets').select('*').order('created_at',{ascending:false});if(r.error)throw r.error;SP.tickets=r.data||[];
  };

  SP.updateShell=function(){
    var company=SP.primaryCompany(),contract=company?SP.activeContract(company.id):null;
    SP.q('#sidebar-company').textContent=SP.isStaff?'Simworx Engineering':(company?(company.trading_name||company.legal_name):'No company assigned');
    SP.q('#sidebar-contract').textContent=SP.isStaff?'Staff administration':(contract?contract.tier_name:'No active contract');
    SP.q('#sidebar-user-name').textContent=SP.profile.full_name||SP.profile.email||'Portal User';
    SP.q('#sidebar-user-role').textContent=SP.roleLabel();
    SP.q('#user-avatar').textContent=SP.initials(SP.profile.full_name||SP.profile.email);
    SP.q('#admin-nav').classList.toggle('hidden',!SP.isAdmin);
  };

  SP.subscribe=function(){
    if(SP.channel)db.removeChannel(SP.channel);
    SP.channel=db.channel('support-portal-live')
      .on('postgres_changes',{event:'*',schema:'public',table:'ticket_messages'},function(){if(SP.selectedTicket)SP.openTicket(SP.selectedTicket.id,true);})
      .on('postgres_changes',{event:'*',schema:'public',table:'tickets'},async function(){await SP.reloadTickets();if(SP.currentView==='dashboard'||SP.currentView==='requests'||SP.currentView==='history')SP.renderView(SP.currentView);})
      .on('postgres_changes',{event:'*',schema:'public',table:'time_entries'},async function(){await SP.refreshUsage();if(SP.selectedTicket)SP.openTicket(SP.selectedTicket.id,true);})
      .on('postgres_changes',{event:'*',schema:'public',table:'approval_requests'},function(){if(SP.selectedTicket)SP.openTicket(SP.selectedTicket.id,true);})
      .subscribe();
  };

  SP.signedUrl=async function(path){
    if(!path)return null;var r=await db.storage.from(cfg.attachmentBucket).createSignedUrl(path,3600);
    return r.error?null:r.data.signedUrl;
  };

  SP.uploadAttachment=async function(file,companyId,ticketId,messageId){
    var safe=file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
    var path=companyId+'/'+ticketId+'/'+crypto.randomUUID()+'-'+safe;
    var up=await db.storage.from(cfg.attachmentBucket).upload(path,file,{contentType:file.type||'application/octet-stream',upsert:false});
    if(up.error)throw up.error;
    var row=await db.from('ticket_attachments').insert({
      ticket_id:ticketId,message_id:messageId||null,company_id:companyId,storage_path:path,file_name:file.name,
      mime_type:file.type||'application/octet-stream',size_bytes:file.size,customer_visible:true
    }).select().single();
    if(row.error)throw row.error;return row.data;
  };

  SP.openTicket=async function(id,quiet){
    if(!quiet)SP.setLoading();
    var t=await db.from('tickets').select('*').eq('id',id).single();if(t.error)throw t.error;SP.selectedTicket=t.data;
    var results=await Promise.all([
      db.from('ticket_messages').select('*').eq('ticket_id',id).order('created_at'),
      db.from('ticket_attachments').select('*').eq('ticket_id',id).order('created_at'),
      db.from('ticket_events').select('*').eq('ticket_id',id).order('created_at',{ascending:false}),
      db.from('time_entries').select('*').eq('ticket_id',id).order('occurred_at'),
      db.from('approval_requests').select('*').eq('ticket_id',id).order('requested_at',{ascending:false}),
      db.from('remote_sessions').select('*').eq('ticket_id',id).order('created_at',{ascending:false})
    ]);
    results.forEach(function(r){if(r.error)throw r.error;});
    SP.selectedTicket.messages=results[0].data||[];SP.selectedTicket.attachments=results[1].data||[];
    SP.selectedTicket.events=results[2].data||[];SP.selectedTicket.timeEntries=results[3].data||[];
    SP.selectedTicket.approvals=results[4].data||[];SP.selectedTicket.sessions=results[5].data||[];
    var urls={};
    for(var i=0;i<SP.selectedTicket.attachments.length;i++){
      var a=SP.selectedTicket.attachments[i];urls[a.id]=await SP.signedUrl(a.storage_path);
    }
    SP.selectedTicket.attachmentUrls=urls;
    SP.currentView='ticket';SP.renderTicket();SP.activateNav('requests');
  };

  SP.activateNav=function(view){
    SP.qa('#portal-nav button[data-view]').forEach(function(b){b.classList.toggle('active',b.dataset.view===view);});
  };

  SP.renderView=function(view){
    SP.currentView=view;SP.selectedTicket=null;SP.activateNav(view);
    if(view==='dashboard')return SP.renderDashboard();
    if(view==='requests')return SP.renderRequests(false);
    if(view==='history')return SP.renderRequests(true);
    if(view==='new-request')return SP.renderNewRequest();
    if(view==='usage')return SP.renderUsage();
    if(view==='company')return SP.renderCompany();
    if(view==='contract')return SP.renderContract();
    if(view==='downloads')return SP.renderDownloads();
    if(view==='contact')return SP.renderContact();
    if(view==='admin'&&SP.isAdmin)return SP.renderAdmin();
    return SP.renderDashboard();
  };

  SP.bootstrap=async function(){
    var session=await db.auth.getSession();
    if(session.error){SP.showAuth();return;}
    if(!session.data.session){SP.showAuth();return;}
    try{
      await SP.loadIdentity();
      var pin=await db.rpc('has_portal_pin');if(pin.error)throw pin.error;
      if(sessionStorage.getItem('simworx-support-unlocked')===SP.user.id){await SP.enterPortal();return;}
      SP.showPin(!pin.data);
    }catch(err){SP.showAuth();SP.q('#auth-error').textContent=SP.errorMessage(err);SP.q('#auth-error').classList.remove('hidden');}
  };

  SP.enterPortal=async function(){
    SP.showApp();SP.setLoading();
    await SP.loadBaseData();
    if(!SP.isStaff&&!SP.memberships.length){
      SP.renderNoAccess();return;
    }
    SP.subscribe();SP.renderView('dashboard');
  };

  SP.renderNoAccess=function(){
    SP.setTopbar('Account awaiting assignment');
    var setup=new URLSearchParams(location.search).get('setup')==='1';
    SP.q('#portal-main').innerHTML='<div class="card" style="max-width:680px"><div class="card-body"><div class="notice danger"><strong>This account is authenticated but is not attached to a customer company or Simworx staff role.</strong><br><br>Ask a Simworx administrator to invite this email address before signing in.</div>'+(setup?'<div style="margin-top:14px"><button id="claim-admin" class="sp-btn dark">INITIALISE FIRST SIMWORX ADMIN</button><p class="micro-copy">This one-time control works only while no Simworx administrator exists.</p></div>':'')+'</div></div>';
    if(setup){SP.q('#claim-admin').onclick=async function(){var r=await db.rpc('claim_initial_admin');if(r.error)return SP.toast(SP.errorMessage(r.error),true);if(!r.data)return SP.toast('An administrator already exists.',true);SP.toast('Initial administrator created.');await SP.loadIdentity();await SP.loadBaseData();SP.renderView('dashboard');};}
  };

  window.addEventListener('unhandledrejection',function(e){console.error(e.reason);SP.toast(SP.errorMessage(e.reason),true);});
})();