(function(){
  'use strict';
  var SP=window.SupportPortal,db=SP.db;

  function h(text){return SP.esc(text);}
  function badge(value,extra){return '<span class="badge '+h(String(value||'').toLowerCase())+(extra?' '+extra:'')+'">'+h(SP.statusLabel(value))+'</span>';}
  function ticketRows(rows){
    if(!rows.length)return '<tr><td colspan="7"><div class="empty-state"><strong>No support requests</strong><p>There are no requests matching this view.</p></div></td></tr>';
    return rows.map(function(t){
      var p=SP.projectById(t.project_id),c=SP.companyById(t.company_id);
      return '<tr><td><button class="link-button ticket-link open-ticket" data-ticket="'+h(t.id)+'">'+h(t.reference)+'</button></td>'+
        '<td>'+h(t.subject)+'</td><td>'+h(c?(c.trading_name||c.legal_name):'—')+'</td><td>'+h(p?p.name:'—')+'</td>'+
        '<td>'+badge(t.priority,'p'+String(t.priority).slice(1))+'</td><td>'+badge(t.status)+'</td><td>'+h(SP.fmtDate(t.updated_at,true))+'</td></tr>';
    }).join('');
  }
  function bindTicketLinks(){SP.qa('.open-ticket').forEach(function(b){b.onclick=function(){SP.openTicket(b.dataset.ticket).catch(function(e){SP.toast(SP.errorMessage(e),true);});};});}
  function usagePercent(u){if(!u)return 0;var total=Number(u.base_allowance_minutes)+Number(u.rollover_minutes)+Number(u.approved_extra_minutes);return total?Math.min(100,Math.round((Number(u.used_allowance_minutes)/total)*100)):0;}
  function companyOptions(selected){return SP.companies.map(function(c){return '<option value="'+h(c.id)+'" '+(c.id===selected?'selected':'')+'>'+h(c.trading_name||c.legal_name)+'</option>';}).join('');}
  function projectOptions(companyId,selected){return SP.projects.filter(function(p){return !companyId||p.company_id===companyId;}).map(function(p){return '<option value="'+h(p.id)+'" '+(p.id===selected?'selected':'')+'>'+h(p.name)+'</option>';}).join('');}
  function contractOptions(companyId,selected,projectId){return SP.contracts.filter(function(c){var companyOk=!companyId||c.company_id===companyId;var projectOk=!projectId||SP.contractProjects.some(function(cp){return cp.contract_id===c.id&&cp.project_id===projectId;});return c.status==='active'&&companyOk&&projectOk;}).map(function(c){return '<option value="'+h(c.id)+'" '+(c.id===selected?'selected':'')+'>'+h(c.tier_name+' — '+c.title)+'</option>';}).join('');}
  function staffOptions(selected,secondOnly){
    return SP.staff.filter(function(p){return !secondOnly||p.staff_role==='second_line_engineer'||p.staff_role==='admin';}).map(function(p){
      return '<option value="'+h(p.id)+'" '+(p.id===selected?'selected':'')+'>'+h(p.full_name||p.email||p.id)+'</option>';
    }).join('');
  }
  function categoryOptions(selected){return SP.categories.map(function(c){return '<option value="'+h(c.id)+'" '+(c.id===selected?'selected':'')+'>'+h(c.name)+'</option>';}).join('');}

  SP.renderDashboard=function(){
    SP.setTopbar('Dashboard','Support Portal');
    var open=SP.tickets.filter(function(t){return !['closed','resolved'].includes(t.status);});
    var p1=open.filter(function(t){return t.priority==='P1';}).length;
    var pending=0;var used=0,total=0,remaining=0;
    SP.usage.forEach(function(u){used+=Number(u.used_allowance_minutes)||0;total+=Number(u.base_allowance_minutes)+Number(u.rollover_minutes)+Number(u.approved_extra_minutes);remaining+=Number(u.remaining_minutes)||0;});
    var company=SP.primaryCompany(),contract=company?SP.activeContract(company.id):null,u=contract?SP.usageByContract(contract.id):null;
    var side=SP.isStaff?'<div class="card"><div class="card-head"><h3>Engineering overview</h3></div><div class="card-body request-usage"><strong class="big">'+SP.minutes(used)+'</strong><span class="muted">allowance-equivalent support recorded in current periods</span></div></div>':
      '<div class="card"><div class="card-head"><h3>Current support allowance</h3></div><div class="card-body">'+
      (u?'<div class="request-usage"><strong class="big">'+SP.minutes(u.remaining_minutes)+'</strong><span class="muted">remaining this period</span></div><div style="margin-top:13px" class="progress-track"><div class="progress-bar" style="width:'+usagePercent(u)+'%"></div></div><div class="usage-numbers"><span>'+SP.minutes(u.used_allowance_minutes)+' used</span><strong>'+SP.minutes(Number(u.base_allowance_minutes)+Number(u.rollover_minutes)+Number(u.approved_extra_minutes))+' total</strong></div>':'<div class="empty-state"><strong>No active usage period</strong></div>')+
      '</div>';
    var html='<div class="page-heading"><div><h1>Support dashboard</h1><p>Current requests, contract usage and engineering activity.</p></div></div>'+
      '<div class="metric-grid">'+
      '<div class="metric-card gold"><span>Open requests</span><strong>'+open.length+'</strong><small>Across accessible projects</small></div>'+
      '<div class="metric-card"><span>P1 incidents</span><strong>'+p1+'</strong><small>Simulator down</small></div>'+
      '<div class="metric-card"><span>Support used</span><strong>'+SP.minutes(used)+'</strong><small>Current usage periods</small></div>'+
      '<div class="metric-card"><span>Allowance remaining</span><strong>'+SP.minutes(remaining)+'</strong><small>Including approved overage</small></div></div>'+
      '<div class="dashboard-grid" style="margin-top:18px"><div class="dashboard-main"><div class="card"><div class="card-head"><h2>Recent support requests</h2><button class="link-button" data-view-jump="requests">VIEW ALL</button></div>'+
      '<div class="table-wrap"><table class="data-table"><thead><tr><th>Reference</th><th>Issue</th><th>Company</th><th>Simulator</th><th>Priority</th><th>Status</th><th>Updated</th></tr></thead><tbody>'+ticketRows(SP.tickets.slice(0,8))+'</tbody></table></div></div></div>'+
      '<aside class="dashboard-side">'+side+
      '<div class="card"><div class="card-head"><h3>Quick actions</h3></div><div class="card-body small-actions"><button class="sp-btn primary" data-view-jump="new-request">LOG REQUEST</button><button class="sp-btn outline" data-view-jump="usage">VIEW USAGE</button></div></div>'+
      '</aside></div>';
    SP.q('#portal-main').innerHTML=html;bindTicketLinks();bindViewJumps();
  };

  function bindViewJumps(){SP.qa('[data-view-jump]').forEach(function(b){b.onclick=function(){SP.renderView(b.dataset.viewJump);};});}

  SP.renderRequests=function(history){
    SP.setTopbar(history?'History':'Support Requests','Support Portal');
    var rows=SP.tickets.filter(function(t){return history?['resolved','closed'].includes(t.status):!['resolved','closed'].includes(t.status);});
    SP.q('#portal-main').innerHTML='<div class="page-heading"><div><h1>'+(history?'Support history':'Support requests')+'</h1><p>'+(history?'Resolved and closed support activity.':'Open and active customer support cases.')+'</p></div><div class="page-actions"><input id="ticket-search" placeholder="Search requests…" style="border:1px solid #d7dce0;border-radius:6px;padding:9px 11px;font-size:9px"><button class="sp-btn primary" data-view-jump="new-request">＋ NEW REQUEST</button></div></div>'+
      '<div class="card"><div class="table-wrap"><table class="data-table"><thead><tr><th>Reference</th><th>Issue</th><th>Company</th><th>Simulator</th><th>Priority</th><th>Status</th><th>Updated</th></tr></thead><tbody id="ticket-table-body">'+ticketRows(rows)+'</tbody></table></div></div>';
    bindTicketLinks();bindViewJumps();
    var s=SP.q('#ticket-search');s.oninput=function(){var q=s.value.toLowerCase();var filtered=rows.filter(function(t){var p=SP.projectById(t.project_id),c=SP.companyById(t.company_id);return [t.reference,t.subject,t.status,t.priority,p&&p.name,c&&(c.trading_name||c.legal_name)].join(' ').toLowerCase().includes(q);});SP.q('#ticket-table-body').innerHTML=ticketRows(filtered);bindTicketLinks();};
  };

  SP.renderNewRequest=function(){
    SP.setTopbar('Log a Support Request','Support Portal');
    var company=SP.primaryCompany(),companyId=company?company.id:(SP.companies[0]&&SP.companies[0].id);
    SP.q('#portal-main').innerHTML='<div class="page-heading"><div><h1>Log a support request</h1><p>Create the technical record and attach any photos, video or diagnostic evidence.</p></div></div>'+
      '<form id="new-ticket-form" class="card form-card">'+
      '<div class="form-section"><h3>Request details</h3><div class="form-grid">'+
      (SP.isStaff?'<div class="field"><label>Company</label><select id="new-company" required>'+companyOptions(companyId)+'</select></div>':'<input id="new-company" type="hidden" value="'+h(companyId||'')+'">')+
      '<div class="field"><label>Simulator / Project</label><select id="new-project" required>'+projectOptions(companyId)+'</select></div>'+
      '<div class="field"><label>Support priority</label><select id="new-priority"><option>P1</option><option>P2</option><option selected>P3</option><option>P4</option></select></div>'+
      '<div class="field"><label>Category</label><select id="new-category"><option value="">Select category</option>'+categoryOptions()+'</select></div>'+
      '<div class="field full"><label>Support contract</label><select id="new-contract" required>'+contractOptions(companyId,null,(SP.projects.filter(function(p){return p.company_id===companyId;})[0]||{}).id)+'</select></div>'+
      '<div class="field full"><label>Short title</label><input id="new-subject" maxlength="160" required placeholder="e.g. Right projector image has shifted"></div>'+
      '<div class="field full"><label>Overview of problem</label><textarea id="new-overview" required placeholder="Tell us what happened, what you were doing when it occurred, and anything already tried."></textarea></div>'+
      '</div></div>'+
      '<div class="form-section"><h3>Upload images & film</h3><label class="dropzone"><strong>Add technical evidence</strong><span>JPG, PNG, WEBP, MP4, WEBM, PDF or ZIP — up to 100 MB per file</span><input id="new-files" type="file" multiple accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,application/pdf,application/zip" style="margin-top:12px"></label></div>'+
      '<div class="form-section" style="display:flex;justify-content:flex-end;gap:8px"><button type="button" class="sp-btn outline" data-view-jump="requests">CANCEL</button><button id="new-submit" type="submit" class="sp-btn primary">SUBMIT SUPPORT REQUEST</button></div></form>';
    bindViewJumps();
    var comp=SP.q('#new-company'),proj=SP.q('#new-project'),contract=SP.q('#new-contract');
    if(SP.isStaff&&comp){comp.onchange=function(){proj.innerHTML=projectOptions(comp.value);contract.innerHTML=contractOptions(comp.value,null,proj.value);};}proj.onchange=function(){contract.innerHTML=contractOptions(comp.value,null,proj.value);};
    SP.q('#new-ticket-form').onsubmit=async function(e){
      e.preventDefault();var btn=SP.q('#new-submit');btn.disabled=true;btn.textContent='CREATING…';
      try{
        var companyValue=comp.value,projectValue=proj.value,contractValue=contract.value;
        var ins=await db.from('tickets').insert({
          company_id:companyValue,project_id:projectValue,contract_id:contractValue,requester_id:SP.user.id,
          priority:SP.q('#new-priority').value,category_id:SP.q('#new-category').value||null,
          subject:SP.q('#new-subject').value.trim(),overview:SP.q('#new-overview').value.trim()
        }).select().single();
        if(ins.error)throw ins.error;
        var files=Array.from(SP.q('#new-files').files||[]);
        for(var i=0;i<files.length;i++)await SP.uploadAttachment(files[i],companyValue,ins.data.id,null);
        await SP.reloadTickets();SP.toast('Support request '+ins.data.reference+' created.');await SP.openTicket(ins.data.id);
      }catch(err){SP.toast(SP.errorMessage(err),true);btn.disabled=false;btn.textContent='SUBMIT SUPPORT REQUEST';}
    };
  };

  SP.renderUsage=function(){
    SP.setTopbar('Usage & Upgrades','Support Portal');
    var contracts=SP.contracts.filter(function(c){return c.status==='active';});
    var blocks=contracts.map(function(c){
      var company=SP.companyById(c.company_id),u=SP.usageByContract(c.id),total=u?Number(u.base_allowance_minutes)+Number(u.rollover_minutes)+Number(u.approved_extra_minutes):c.included_minutes;
      return '<div class="card"><div class="card-head"><h2>'+h(company?(company.trading_name||company.legal_name):'Support contract')+'</h2>'+badge(c.status)+'</div><div class="card-body">'+
        '<div class="contract-hero"><div><div class="eyebrow">'+h(c.title)+'</div><h2>'+h(c.tier_name)+'</h2><p>'+h(c.support_hours||'Remote technical support')+'</p></div><div class="contract-price"><strong>'+SP.money(c.monthly_fee,c.currency)+'</strong><span>per month</span></div></div>'+
        '<div style="margin-top:18px"><div class="progress-track"><div class="progress-bar" style="width:'+usagePercent(u)+'%"></div></div><div class="usage-numbers"><span>'+SP.minutes(u?u.used_allowance_minutes:0)+' used</span><strong>'+SP.minutes(u?u.remaining_minutes:total)+' remaining</strong></div></div>'+
        '<div class="info-grid" style="margin-top:16px"><div class="info-card"><span>Base allowance</span><strong>'+SP.minutes(c.included_minutes)+'</strong></div><div class="info-card"><span>Rolled forward</span><strong>'+SP.minutes(u?u.rollover_minutes:0)+'</strong></div><div class="info-card"><span>Support engineer</span><strong>'+SP.money(c.first_line_rate,c.currency)+'/hr</strong></div><div class="info-card"><span>Second line</span><strong>'+SP.money(c.second_line_rate,c.currency)+'/hr</strong></div></div>'+
        '</div></div>';
    }).join('');
    SP.q('#portal-main').innerHTML='<div class="page-heading"><div><h1>Usage & upgrades</h1><p>Live allowance consumption is calculated from approved engineering time entries.</p></div></div>'+blocks+
      '<div class="notice" style="margin-top:14px"><strong>Need more coverage?</strong> Contract changes are project-specific. Contact Simworx and we will quote the correct allowance, rates and response position for your simulator.</div>';
  };

  SP.renderCompany=function(){
    SP.setTopbar('Company Information','Support Portal');
    var blocks=SP.companies.map(function(c){
      return '<div class="card"><div class="card-head"><h2>'+h(c.trading_name||c.legal_name)+'</h2><span class="badge '+(c.active?'resolved':'closed')+'">'+(c.active?'ACTIVE':'INACTIVE')+'</span></div><div class="card-body"><div class="info-grid">'+
        '<div class="info-card"><span>Legal company</span><strong>'+h(c.legal_name)+'</strong></div>'+
        '<div class="info-card"><span>Country</span><strong>'+h(c.country||'—')+'</strong></div>'+
        '<div class="info-card"><span>Commercial contact</span><strong>'+h(c.commercial_contact_name||'—')+'</strong><p>'+h(c.commercial_contact_email||'')+'</p></div>'+
        '<div class="info-card"><span>Technical contact</span><strong>'+h(c.technical_contact_name||'—')+'</strong><p>'+h(c.technical_contact_email||'')+'</p></div>'+
        '<div class="info-card"><span>Telephone</span><strong>'+h(c.phone||'—')+'</strong></div>'+
        '<div class="info-card"><span>General email</span><strong>'+h(c.general_email||'—')+'</strong></div>'+
        '</div></div></div>';
    }).join('');
    SP.q('#portal-main').innerHTML='<div class="page-heading"><div><h1>Company information</h1><p>Account and support-contact information held by Simworx.</p></div></div>'+blocks;
  };

  SP.renderContract=function(){
    SP.setTopbar('Support Contract','Support Portal');
    var blocks=SP.contracts.map(function(c){
      var company=SP.companyById(c.company_id),covered=SP.projects.filter(function(p){return SP.contractProjects.some(function(cp){return cp.contract_id===c.id&&cp.project_id===p.id;});});
      return '<div class="card" style="margin-bottom:15px"><div class="card-body"><div class="contract-hero"><div><div class="eyebrow">'+h(company?(company.trading_name||company.legal_name):'SIMWORX SUPPORT')+'</div><h2>'+h(c.tier_name)+'</h2><p>'+h(c.title)+'</p></div><div class="contract-price"><strong>'+SP.money(c.monthly_fee,c.currency)+'</strong><span>monthly support fee</span></div></div>'+
        '<div class="info-grid" style="margin-top:16px"><div class="info-card"><span>Initial / current term</span><strong>'+SP.fmtDate(c.starts_on)+' → '+SP.fmtDate(c.ends_on||c.renewal_date)+'</strong></div>'+
        '<div class="info-card"><span>Included allowance</span><strong>'+SP.minutes(c.included_minutes)+'</strong></div>'+
        '<div class="info-card"><span>Support Engineer</span><strong>'+SP.money(c.first_line_rate,c.currency)+'/hr</strong></div>'+
        '<div class="info-card"><span>Second-Line Engineer</span><strong>'+SP.money(c.second_line_rate,c.currency)+'/hr</strong><p>'+h(c.second_line_allowance_multiplier)+'× allowance conversion</p></div>'+
        '<div class="info-card"><span>Rollover</span><strong>'+(c.rollover_enabled?'Enabled — cap '+SP.minutes(c.rollover_cap_minutes):'Not enabled')+'</strong></div>'+
        '<div class="info-card"><span>Covered projects</span><strong>'+h(covered.map(function(p){return p.name;}).join(', ')||'—')+'</strong></div></div>'+
        (c.contract_file_path?'<div style="margin-top:14px"><button class="sp-btn outline contract-download" data-path="'+h(c.contract_file_path)+'">DOWNLOAD AGREEMENT</button></div>':'')+
        '</div></div>';
    }).join('');
    SP.q('#portal-main').innerHTML='<div class="page-heading"><div><h1>Support contract</h1><p>Contract terms are configured per customer and per supported project.</p></div></div>'+blocks;
    SP.qa('.contract-download').forEach(function(b){b.onclick=async function(){var url=await SP.signedUrl(b.dataset.path);if(url)window.open(url,'_blank');else SP.toast('Unable to open contract file.',true);};});
  };

  SP.renderDownloads=async function(){
    SP.setTopbar('Downloads','Support Portal');SP.setLoading();
    var r=await db.from('customer_files').select('*').order('created_at',{ascending:false});if(r.error)return SP.toast(SP.errorMessage(r.error),true);
    var files=r.data||[],rows='';
    for(var i=0;i<files.length;i++){
      var f=files[i],c=SP.companyById(f.company_id),url=await SP.signedUrl(f.storage_path);
      rows+='<tr><td><strong>'+h(f.title)+'</strong><br><span style="font-size:8px;color:#7d858d">'+h(f.description||'')+'</span></td><td>'+h(c?(c.trading_name||c.legal_name):'—')+'</td><td>'+h(f.file_name)+'</td><td>'+SP.fmtDate(f.created_at)+'</td><td>'+(url?'<a class="sp-btn outline" target="_blank" href="'+h(url)+'">DOWNLOAD</a>':'—')+'</td></tr>';
    }
    SP.q('#portal-main').innerHTML='<div class="page-heading"><div><h1>Downloads</h1><p>Customer-specific manuals, agreements and support files.</p></div>'+(SP.isStaff?'<div class="page-actions"><button id="upload-customer-file" class="sp-btn primary">＋ UPLOAD FILE</button></div>':'')+'</div>'+
      '<div class="card"><div class="table-wrap"><table class="data-table"><thead><tr><th>Document</th><th>Company</th><th>File</th><th>Added</th><th></th></tr></thead><tbody>'+(rows||'<tr><td colspan="5"><div class="empty-state"><strong>No downloads assigned</strong></div></td></tr>')+'</tbody></table></div></div>';
    if(SP.isStaff)SP.q('#upload-customer-file').onclick=showUploadCustomerFile;
  };

  SP.renderContact=function(){
    SP.setTopbar('Contact Us','Support Portal');
    SP.q('#portal-main').innerHTML='<div class="page-heading"><div><h1>Contact Simworx</h1><p>Technical support requests should always be opened through the portal so the complete simulator history is preserved.</p></div></div>'+
      '<div class="info-grid"><div class="card"><div class="card-body"><div class="eyebrow">SUPPORT REQUESTS</div><h2 style="font-size:20px;margin:8px 0">Use the portal</h2><p style="font-size:10px;line-height:1.6;color:#657079">Open or continue a request here for technical diagnosis, media sharing and time-accounted engineering support.</p><button class="sp-btn primary" data-view-jump="new-request">LOG SUPPORT REQUEST</button></div></div>'+
      '<div class="card"><div class="card-body"><div class="eyebrow">COMMERCIAL / GENERAL</div><h2 style="font-size:20px;margin:8px 0">'+h(SP.cfg.supportPhone)+'</h2><p style="font-size:10px;color:#657079">'+h(SP.cfg.supportEmail)+'</p><a class="sp-btn outline" href="mailto:'+h(SP.cfg.supportEmail)+'">EMAIL SIMWORX</a></div></div></div>';
    bindViewJumps();
  };

  function authorName(id){var p=SP.people.find(function(x){return x.id===id;});if(p)return p.is_simworx?(p.full_name||'Simworx Support'):(p.full_name||'Customer');if(id===SP.user.id)return SP.profile.full_name||SP.profile.email||'You';return SP.isStaff?'Customer':'Simworx Support';}
  function attachmentMarkup(list,urls){
    if(!list.length)return '';
    return '<div class="attachment-grid">'+list.map(function(a){
      var u=urls[a.id],mime=a.mime_type||'',body;
      if(mime.indexOf('image/')===0)body='<img src="'+h(u||'')+'" alt="'+h(a.file_name)+'">';
      else if(mime.indexOf('video/')===0)body='<video controls preload="metadata" src="'+h(u||'')+'"></video>';
      else body='<div class="attachment-file"><strong>'+h(a.file_name)+'</strong><span>Open document</span></div>';
      return '<a class="attachment-card" href="'+h(u||'#')+'" target="_blank">'+body+'<span class="attachment-tag">'+h(mime.split('/')[1]||'FILE')+'</span></a>';
    }).join('')+'</div>';
  }
  function renderConversation(t){
    var items=[];
    items.push({type:'overview',created_at:t.created_at,body:t.overview,author:t.requester_id});
    (t.messages||[]).forEach(function(m){items.push({type:'message',created_at:m.created_at,data:m});});
    (t.events||[]).filter(function(e){return ['time_added','escalation','approval_requested','status_change'].includes(e.event_type);}).forEach(function(e){items.push({type:'event',created_at:e.created_at,data:e});});
    items.sort(function(a,b){return new Date(a.created_at)-new Date(b.created_at);});
    return items.map(function(it){
      if(it.type==='event'){
        var e=it.data,cls=e.event_type==='approval_requested'?'gold':e.event_type==='escalation'?'red':'';
        return '<div class="system-event '+cls+'"><div class="system-icon">'+(e.event_type==='time_added'?'◷':e.event_type==='escalation'?'↑':e.event_type==='approval_requested'?'✓':'•')+'</div><div><strong>'+h(e.summary)+'</strong><p>'+h(SP.fmtDate(e.created_at,true))+'</p></div></div>';
      }
      var m=it.data,author=it.author||(m&&m.author_id),isStaff=SP.staff.some(function(p){return p.id===author;});
      var msgId=m&&m.id,atts=(t.attachments||[]).filter(function(a){return a.message_id===msgId;});
      if(it.type==='overview')atts=(t.attachments||[]).filter(function(a){return !a.message_id;});
      return '<div class="chat-row '+(isStaff?'simworx':'customer')+'"><div class="chat-avatar">'+h(SP.initials(authorName(author)))+'</div><div class="bubble-wrap"><div class="bubble-meta">'+h(authorName(author))+'</div><div class="bubble">'+h(it.type==='overview'?it.body:(m.body||''))+attachmentMarkup(atts,t.attachmentUrls||{})+'</div><div class="bubble-time">'+h(SP.fmtDate(it.created_at,true))+'</div></div></div>';
    }).join('');
  }

  SP.renderTicket=function(){
    var t=SP.selectedTicket;if(!t)return;SP.setTopbar(t.reference,'Support Request');
    var company=SP.companyById(t.company_id),project=SP.projectById(t.project_id),contract=SP.contractById(t.contract_id),u=contract?SP.usageByContract(contract.id):null;
    var requestMinutes=(t.timeEntries||[]).reduce(function(s,x){return s+Number(x.actual_minutes||0);},0);
    var requestAllowance=(t.timeEntries||[]).reduce(function(s,x){return s+Number(x.allowance_minutes_charged||0);},0);
    var recent=(t.attachments||[]).slice(-3),recentHtml=recent.map(function(a){var u0=t.attachmentUrls[a.id];return '<a class="recent-file" href="'+h(u0||'#')+'" target="_blank">'+(a.mime_type.indexOf('image/')===0?'<img src="'+h(u0||'')+'" alt="">':a.mime_type.indexOf('video/')===0?'<video src="'+h(u0||'')+'"></video>':'<div class="attachment-file">'+h(a.file_name)+'</div>')+'</a>';}).join('');
    var pending=(t.approvals||[]).filter(function(a){return a.status==='pending';});
    var approvalHtml=pending.map(function(a){
      return '<div class="notice" style="margin-top:8px"><strong>Approval required: '+SP.minutes(a.requested_extra_minutes)+'</strong><br>'+h(a.reason)+'<br><span style="font-size:8px">Estimated '+SP.money(a.estimated_cost,contract&&contract.currency)+'</span>'+
        (SP.isApprover?'<div class="small-actions" style="margin-top:9px"><button class="sp-btn primary approve-overage" data-id="'+h(a.id)+'">APPROVE</button><button class="sp-btn outline reject-overage" data-id="'+h(a.id)+'">REJECT</button></div>':'')+'</div>';
    }).join('');
    var sessionHtml=SP.isStaff?(t.sessions||[]).filter(function(s){return !s.time_entry_id;}).map(function(s){return '<div class="notice" style="margin-top:8px"><strong>Remote session'+(s.scheduled_for?' — '+h(SP.fmtDate(s.scheduled_for,true)):'')+'</strong><br><span style="font-size:8px">'+h(s.remote_tool||'Remote dial-in')+'</span><div style="margin-top:7px"><button class="sp-btn dark complete-session" data-id="'+h(s.id)+'">RECORD SESSION TIME</button></div></div>';}).join(''):'';
    var controls=SP.isStaff?'<div class="card"><div class="card-head"><h3>Engineering controls</h3></div><div class="card-body small-actions"><button id="edit-ticket" class="sp-btn outline">EDIT</button><button id="add-time" class="sp-btn dark">＋ ADD TIME</button><button id="arrange-remote" class="sp-btn outline">REMOTE SESSION</button><button id="escalate-ticket" class="sp-btn outline">ESCALATE L2</button><button id="request-approval" class="sp-btn outline">REQUEST APPROVAL</button></div></div>':'';
    SP.q('#portal-main').innerHTML='<div class="ticket-layout"><section class="card conversation-card"><div class="ticket-titlebar"><div><span class="ticket-ref">'+h(t.reference)+'</span><h1>'+h(t.subject)+'</h1><p>'+h(project?project.name:'')+' · '+h(company?(company.trading_name||company.legal_name):'')+'</p></div><div class="small-actions">'+badge(t.priority,'p'+String(t.priority).slice(1))+badge(t.status)+'</div></div>'+
      '<div id="conversation" class="conversation">'+renderConversation(t)+'</div><form id="reply-form" class="composer"><textarea id="reply-body" placeholder="Reply to this support request…"></textarea><div class="composer-actions"><div style="display:flex;align-items:center;gap:14px"><label class="file-button">＋ Add images, film or files<input id="reply-files" type="file" multiple accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,application/pdf,application/zip"></label>'+(SP.isStaff?'<label class="file-button"><input id="reply-internal" type="checkbox" style="display:inline-block;margin-right:5px">Internal note</label>':'')+'</div><button id="reply-send" class="sp-btn primary" type="submit">SEND REPLY</button></div></form></section>'+
      '<aside class="detail-stack">'+
      '<div class="card"><div class="card-head"><h3>Request details</h3></div><div class="card-body detail-list">'+
      '<div class="detail-row"><span>Status</span><strong>'+SP.statusLabel(t.status)+'</strong></div><div class="detail-row"><span>Priority</span><strong>'+h(t.priority)+'</strong></div><div class="detail-row"><span>Support level</span><strong>'+h(contract?contract.tier_name:'—')+'</strong></div><div class="detail-row"><span>Simulator</span><strong>'+h(project?project.name:'—')+'</strong></div><div class="detail-row"><span>Created</span><strong>'+h(SP.fmtDate(t.created_at,true))+'</strong></div><div class="detail-row"><span>Assigned</span><strong>'+h(authorName(t.current_support_line==='second_line'?t.assigned_second_line_engineer:t.assigned_engineer))+'</strong></div></div></div>'+
      controls+
      '<div class="card"><div class="card-head"><h3>Usage</h3></div><div class="card-body request-usage"><strong class="big">'+SP.minutes(requestMinutes)+'</strong><span class="muted">actual time on this request · '+SP.minutes(requestAllowance)+' allowance equivalent</span>'+
      (u?'<div style="margin-top:13px" class="progress-track"><div class="progress-bar" style="width:'+usagePercent(u)+'%"></div></div><div class="usage-numbers"><span>'+SP.minutes(u.used_allowance_minutes)+' contract used</span><strong>'+SP.minutes(u.remaining_minutes)+' left</strong></div>':'')+approvalHtml+sessionHtml+'</div></div>'+
      '<div class="card"><div class="card-head"><h3>Recent attachments</h3></div><div class="card-body"><div class="recent-files">'+(recentHtml||'<span style="font-size:8px;color:#7b838a">No attachments</span>')+'</div></div></div>'+
      '<div class="card"><div class="card-head"><h3>Request history</h3></div><div class="card-body timeline">'+(t.events||[]).slice(0,10).map(function(e){return '<div class="timeline-item"><strong>'+h(e.summary)+'</strong><span>'+h(SP.fmtDate(e.created_at,true))+'</span></div>';}).join('')+'</div></div>'+
      '</aside></div>';
    var conv=SP.q('#conversation');conv.scrollTop=conv.scrollHeight;
    SP.q('#reply-form').onsubmit=sendReply;
    SP.qa('.approve-overage').forEach(function(b){b.onclick=function(){respondApproval(b.dataset.id,true);};});
    SP.qa('.reject-overage').forEach(function(b){b.onclick=function(){respondApproval(b.dataset.id,false);};});
    SP.qa('.complete-session').forEach(function(b){b.onclick=function(){showCompleteSession(b.dataset.id);};});
    if(SP.isStaff){SP.q('#add-time').onclick=function(){showAddTime();};SP.qa('.quick-time').forEach(function(b){b.onclick=function(){showAddTime(b.dataset.at,'Time associated with support interaction');};});SP.q('#arrange-remote').onclick=showRemoteSession;SP.q('#escalate-ticket').onclick=showEscalation;SP.q('#request-approval').onclick=showApprovalRequest;SP.q('#edit-ticket').onclick=showEditTicket;}
  };

  async function sendReply(e){
    e.preventDefault();var body=SP.q('#reply-body').value.trim(),files=Array.from(SP.q('#reply-files').files||[]);if(!body&&!files.length)return;
    var btn=SP.q('#reply-send');btn.disabled=true;btn.textContent='SENDING…';
    try{
      var msg=await db.from('ticket_messages').insert({ticket_id:SP.selectedTicket.id,company_id:SP.selectedTicket.company_id,body:body||null,visibility:(SP.isStaff&&SP.q('#reply-internal')&&SP.q('#reply-internal').checked)?'internal':'customer'}).select().single();
      if(msg.error)throw msg.error;
      for(var i=0;i<files.length;i++)await SP.uploadAttachment(files[i],SP.selectedTicket.company_id,SP.selectedTicket.id,msg.data.id);
      await SP.openTicket(SP.selectedTicket.id,true);SP.toast('Reply added.');
    }catch(err){SP.toast(SP.errorMessage(err),true);}finally{btn.disabled=false;btn.textContent='SEND REPLY';}
  }

  SP.modal=function(title,body){
    SP.q('#modal-root').innerHTML='<div class="modal-backdrop"><div class="modal"><div class="modal-head"><h3>'+h(title)+'</h3><button class="modal-close" type="button">×</button></div><div class="modal-body">'+body+'</div></div></div>';
    SP.q('.modal-close').onclick=SP.closeModal;SP.q('.modal-backdrop').onclick=function(e){if(e.target===SP.q('.modal-backdrop'))SP.closeModal();};
  };
  SP.closeModal=function(){SP.q('#modal-root').innerHTML='';};

  function showAddTime(occurredAt,preset){
    var t=SP.selectedTicket,when=occurredAt?new Date(occurredAt).toISOString().slice(0,16):new Date().toISOString().slice(0,16);
    SP.modal('Add engineering time','<form id="time-form" class="inline-form"><select id="time-line"><option value="first_line" '+(t.current_support_line==='first_line'?'selected':'')+'>Support Engineer</option><option value="second_line" '+(t.current_support_line==='second_line'?'selected':'')+'>Second-Line Engineer</option></select><input id="time-minutes" type="number" min="1" step="1" placeholder="Minutes" required><input id="time-occurred" type="datetime-local" value="'+h(when)+'"><input id="time-type" value="remote_diagnosis" placeholder="Activity type" required><textarea id="time-desc" class="full" placeholder="What was done?" required>'+h(preset||'')+'</textarea><button class="sp-btn primary full" type="submit">ADD TIME TO REQUEST</button></form>');
    SP.q('#time-form').onsubmit=async function(e){e.preventDefault();try{var occurred=SP.q('#time-occurred').value;var r=await db.from('time_entries').insert({ticket_id:t.id,engineer_id:SP.user.id,support_line:SP.q('#time-line').value,activity_type:SP.q('#time-type').value,description:SP.q('#time-desc').value.trim(),actual_minutes:Number(SP.q('#time-minutes').value),occurred_at:occurred?new Date(occurred).toISOString():new Date().toISOString()}).select().single();if(r.error)throw r.error;SP.closeModal();await SP.refreshUsage();await SP.openTicket(t.id,true);SP.toast('Engineering time recorded.');}catch(err){SP.toast(SP.errorMessage(err),true);}};
  }
  function showRemoteSession(){
    var t=SP.selectedTicket;
    SP.modal('Arrange remote session','<form id="remote-form" class="inline-form"><input id="remote-when" type="datetime-local"><input id="remote-tool" placeholder="Remote tool (e.g. AnyDesk)"><textarea id="remote-notes" class="full" placeholder="Session notes / access requirements"></textarea><button class="sp-btn primary full" type="submit">ARRANGE SESSION</button></form>');
    SP.q('#remote-form').onsubmit=async function(e){e.preventDefault();try{var when=SP.q('#remote-when').value;var r=await db.from('remote_sessions').insert({ticket_id:t.id,company_id:t.company_id,engineer_id:SP.user.id,scheduled_for:when?new Date(when).toISOString():null,remote_tool:SP.q('#remote-tool').value.trim()||null,notes:SP.q('#remote-notes').value.trim()||null}).select().single();if(r.error)throw r.error;SP.closeModal();await SP.openTicket(t.id,true);SP.toast('Remote session arranged.');}catch(err){SP.toast(SP.errorMessage(err),true);}};
  }
  function showCompleteSession(id){
    SP.modal('Record remote session time','<form id="complete-session-form" class="inline-form"><input id="session-minutes" class="full" type="number" min="1" step="1" placeholder="Minutes dialled in" required><textarea id="session-desc" class="full">Remote dial-in support session</textarea><button class="sp-btn primary full" type="submit">ADD TIME TO USAGE</button></form>');
    SP.q('#complete-session-form').onsubmit=async function(e){e.preventDefault();try{var r=await db.rpc('claim_remote_session_time',{p_session:id,p_minutes:Number(SP.q('#session-minutes').value),p_description:SP.q('#session-desc').value.trim()});if(r.error)throw r.error;SP.closeModal();await SP.refreshUsage();await SP.openTicket(SP.selectedTicket.id,true);SP.toast('Remote-session time added.');}catch(err){SP.toast(SP.errorMessage(err),true);}};
  }
  function showEscalation(){
    SP.modal('Escalate to second-line support','<form id="escalate-form" class="inline-form"><select id="escalate-engineer" class="full"><option value="">Unassigned second line</option>'+staffOptions(null,true)+'</select><textarea id="escalate-reason" class="full" placeholder="Reason for escalation" required></textarea><button class="sp-btn primary full" type="submit">ESCALATE REQUEST</button></form>');
    SP.q('#escalate-form').onsubmit=async function(e){e.preventDefault();try{var r=await db.rpc('escalate_ticket',{p_ticket:SP.selectedTicket.id,p_to_engineer:SP.q('#escalate-engineer').value||null,p_reason:SP.q('#escalate-reason').value.trim()});if(r.error)throw r.error;SP.closeModal();await SP.reloadTickets();await SP.openTicket(SP.selectedTicket.id,true);SP.toast('Request escalated to second line.');}catch(err){SP.toast(SP.errorMessage(err),true);}};
  }
  function showApprovalRequest(){
    SP.modal('Request additional support approval','<form id="approval-form" class="inline-form"><input id="approval-minutes" type="number" min="1" step="15" placeholder="Additional minutes" required><div></div><textarea id="approval-reason" class="full" placeholder="Why is additional support time required?" required></textarea><button class="sp-btn primary full" type="submit">SEND FOR APPROVAL</button></form>');
    SP.q('#approval-form').onsubmit=async function(e){e.preventDefault();try{var r=await db.rpc('create_approval_request',{p_ticket:SP.selectedTicket.id,p_minutes:Number(SP.q('#approval-minutes').value),p_reason:SP.q('#approval-reason').value.trim()});if(r.error)throw r.error;SP.closeModal();await SP.reloadTickets();await SP.openTicket(SP.selectedTicket.id,true);SP.toast('Approval request created.');}catch(err){SP.toast(SP.errorMessage(err),true);}};
  }
  async function respondApproval(id,approve){
    var minutes=null,comment='';
    if(approve){var raw=prompt('Minutes to approve (leave blank for the full request):','');if(raw!==null&&raw.trim()!=='')minutes=Number(raw);}
    else comment=prompt('Reason for rejection (optional):','')||'';
    try{var r=await db.rpc('respond_to_approval',{p_request:id,p_approve:approve,p_minutes:minutes,p_comment:comment||null});if(r.error)throw r.error;await SP.refreshUsage();await SP.openTicket(SP.selectedTicket.id,true);SP.toast(approve?'Additional support approved.':'Approval rejected.');}catch(err){SP.toast(SP.errorMessage(err),true);}
  }
  function showEditTicket(){
    var t=SP.selectedTicket;
    SP.modal('Edit support request','<form id="edit-ticket-form" class="inline-form"><select id="edit-status"><option value="open">Open</option><option value="acknowledged">Acknowledged</option><option value="diagnosing">Diagnosing</option><option value="waiting_customer">Waiting for Customer</option><option value="remote_session_required">Remote Session Required</option><option value="awaiting_approval">Awaiting Approval</option><option value="escalated">Escalated</option><option value="in_progress">In Progress</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select><select id="edit-priority"><option>P1</option><option>P2</option><option>P3</option><option>P4</option></select><select id="edit-engineer"><option value="">Unassigned first line</option>'+staffOptions(t.assigned_engineer,false)+'</select><select id="edit-second"><option value="">Unassigned second line</option>'+staffOptions(t.assigned_second_line_engineer,true)+'</select><button class="sp-btn primary full" type="submit">SAVE REQUEST</button></form>');
    SP.q('#edit-status').value=t.status;SP.q('#edit-priority').value=t.priority;
    SP.q('#edit-ticket-form').onsubmit=async function(e){e.preventDefault();try{var s=SP.q('#edit-status').value;var patch={status:s,priority:SP.q('#edit-priority').value,assigned_engineer:SP.q('#edit-engineer').value||null,assigned_second_line_engineer:SP.q('#edit-second').value||null};if(s==='acknowledged'&&!t.acknowledged_at)patch.acknowledged_at=new Date().toISOString();if(s==='resolved')patch.resolved_at=new Date().toISOString();if(s==='closed')patch.closed_at=new Date().toISOString();var r=await db.from('tickets').update(patch).eq('id',t.id).select().single();if(r.error)throw r.error;SP.closeModal();await SP.reloadTickets();await SP.openTicket(t.id,true);SP.toast('Request updated.');}catch(err){SP.toast(SP.errorMessage(err),true);}};
  }

  async function showUploadCustomerFile(){
    SP.modal('Upload customer file','<form id="customer-file-form" class="inline-form"><select id="file-company" required>'+companyOptions()+'</select><select id="file-project"><option value="">All projects</option>'+projectOptions()+'</select><input id="file-title" class="full" placeholder="Document title" required><textarea id="file-description" class="full" placeholder="Description"></textarea><input id="customer-file" class="full" type="file" required><button class="sp-btn primary full" type="submit">UPLOAD</button></form>');
    SP.q('#file-company').onchange=function(){SP.q('#file-project').innerHTML='<option value="">All projects</option>'+projectOptions(SP.q('#file-company').value);};
    SP.q('#customer-file-form').onsubmit=async function(e){e.preventDefault();try{var file=SP.q('#customer-file').files[0],company=SP.q('#file-company').value,safe=file.name.replace(/[^a-zA-Z0-9._-]/g,'_'),path=company+'/downloads/'+crypto.randomUUID()+'-'+safe;var up=await db.storage.from(SP.cfg.attachmentBucket).upload(path,file,{contentType:file.type||'application/octet-stream'});if(up.error)throw up.error;var r=await db.from('customer_files').insert({company_id:company,project_id:SP.q('#file-project').value||null,title:SP.q('#file-title').value.trim(),description:SP.q('#file-description').value.trim()||null,storage_path:path,file_name:file.name,mime_type:file.type||null,uploaded_by:SP.user.id}).select().single();if(r.error)throw r.error;SP.closeModal();await SP.renderDownloads();SP.toast('Customer file uploaded.');}catch(err){SP.toast(SP.errorMessage(err),true);}};
  }

  SP.renderAdmin=function(){
    SP.setTopbar('Admin','Support Portal');
    SP.q('#portal-main').innerHTML='<div class="page-heading"><div><h1>Support administration</h1><p>Configure companies, simulators, contracts, rates and portal access without code changes.</p></div></div>'+
      '<div class="admin-tabs"><button class="active" data-admin-tab="companies">Companies</button><button data-admin-tab="projects">Projects</button><button data-admin-tab="contracts">Contracts</button><button data-admin-tab="invites">Access & Invites</button></div><div id="admin-content"></div>';
    SP.qa('[data-admin-tab]').forEach(function(b){b.onclick=function(){SP.qa('[data-admin-tab]').forEach(function(x){x.classList.remove('active');});b.classList.add('active');renderAdminTab(b.dataset.adminTab);};});renderAdminTab('companies');
  };
  function renderAdminTab(tab){
    var root=SP.q('#admin-content');
    if(tab==='companies'){
      root.innerHTML='<div class="admin-grid"><div class="card"><div class="card-head"><h3>Companies</h3></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Code</th><th>Company</th><th>Country</th><th>Status</th></tr></thead><tbody>'+SP.companies.map(function(c){return '<tr><td>'+h(c.code)+'</td><td>'+h(c.trading_name||c.legal_name)+'</td><td>'+h(c.country||'—')+'</td><td>'+badge(c.active?'resolved':'closed')+'</td></tr>';}).join('')+'</tbody></table></div></div>'+
        '<div class="card admin-form"><h3>New company</h3><form id="company-form" class="inline-form"><input id="co-code" placeholder="Code" required><input id="co-country" placeholder="Country"><input id="co-legal" class="full" placeholder="Legal company name" required><input id="co-trading" class="full" placeholder="Trading / display name"><input id="co-tech" placeholder="Technical contact name"><input id="co-tech-email" type="email" placeholder="Technical contact email"><button class="sp-btn primary full" type="submit">CREATE COMPANY</button></form></div></div>';
      SP.q('#company-form').onsubmit=async function(e){e.preventDefault();try{var r=await db.from('companies').insert({code:SP.q('#co-code').value.trim().toUpperCase(),legal_name:SP.q('#co-legal').value.trim(),trading_name:SP.q('#co-trading').value.trim()||null,country:SP.q('#co-country').value.trim()||null,technical_contact_name:SP.q('#co-tech').value.trim()||null,technical_contact_email:SP.q('#co-tech-email').value.trim()||null}).select().single();if(r.error)throw r.error;await SP.loadBaseData();renderAdminTab('companies');SP.toast('Company created.');}catch(err){SP.toast(SP.errorMessage(err),true);}};
    }else if(tab==='projects'){
      root.innerHTML='<div class="admin-grid"><div class="card"><div class="card-head"><h3>Projects & simulators</h3></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Code</th><th>Simulator</th><th>Company</th><th>Location</th></tr></thead><tbody>'+SP.projects.map(function(p){var c=SP.companyById(p.company_id);return '<tr><td>'+h(p.code)+'</td><td>'+h(p.name)+'</td><td>'+h(c?(c.trading_name||c.legal_name):'—')+'</td><td>'+h(p.location||'—')+'</td></tr>';}).join('')+'</tbody></table></div></div>'+
        '<div class="card admin-form"><h3>New project</h3><form id="project-form" class="inline-form"><select id="pr-company" class="full" required>'+companyOptions()+'</select><input id="pr-code" placeholder="Project code" required><input id="pr-model" placeholder="Simulator model"><input id="pr-name" class="full" placeholder="Project / simulator name" required><input id="pr-serial" placeholder="Serial number"><input id="pr-location" placeholder="Location"><button class="sp-btn primary full" type="submit">CREATE PROJECT</button></form></div></div>';
      SP.q('#project-form').onsubmit=async function(e){e.preventDefault();try{var r=await db.from('projects').insert({company_id:SP.q('#pr-company').value,code:SP.q('#pr-code').value.trim(),name:SP.q('#pr-name').value.trim(),simulator_model:SP.q('#pr-model').value.trim()||null,serial_number:SP.q('#pr-serial').value.trim()||null,location:SP.q('#pr-location').value.trim()||null}).select().single();if(r.error)throw r.error;await SP.loadBaseData();renderAdminTab('projects');SP.toast('Project created.');}catch(err){SP.toast(SP.errorMessage(err),true);}};
    }else if(tab==='contracts'){
      root.innerHTML='<div class="admin-grid"><div class="card"><div class="card-head"><h3>Support contracts</h3></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Tier</th><th>Company</th><th>Allowance</th><th>First line</th><th>Second line</th></tr></thead><tbody>'+SP.contracts.map(function(c){var co=SP.companyById(c.company_id);return '<tr><td>'+h(c.tier_name)+'</td><td>'+h(co?(co.trading_name||co.legal_name):'—')+'</td><td>'+SP.minutes(c.included_minutes)+'</td><td>'+SP.money(c.first_line_rate,c.currency)+'</td><td>'+SP.money(c.second_line_rate,c.currency)+'</td></tr>';}).join('')+'</tbody></table></div></div>'+
        '<div class="card admin-form"><h3>New contract</h3><form id="contract-form" class="inline-form"><select id="ct-company" class="full" required>'+companyOptions()+'</select><select id="ct-project" class="full" required>'+projectOptions(SP.companies[0]&&SP.companies[0].id)+'</select><input id="ct-title" class="full" placeholder="Contract title" required><input id="ct-tier" placeholder="Tier name" required><input id="ct-fee" type="number" step=".01" placeholder="Monthly fee"><input id="ct-minutes" type="number" min="0" placeholder="Included minutes" required><input id="ct-l1" type="number" step=".01" placeholder="Support Engineer €/hr" required><input id="ct-l2" type="number" step=".01" placeholder="Second Line €/hr" required><input id="ct-mult" type="number" step=".1" value="1" placeholder="L2 allowance multiplier"><input id="ct-start" type="date" required><label style="font-size:9px"><input id="ct-rollover" type="checkbox"> Allow rollover</label><input id="ct-rollcap" type="number" min="0" placeholder="Rollover cap minutes"><button class="sp-btn primary full" type="submit">CREATE CONTRACT</button></form></div></div>';
      SP.q('#ct-company').onchange=function(){SP.q('#ct-project').innerHTML=projectOptions(SP.q('#ct-company').value);};
      SP.q('#contract-form').onsubmit=async function(e){e.preventDefault();try{var c=await db.from('support_contracts').insert({company_id:SP.q('#ct-company').value,title:SP.q('#ct-title').value.trim(),tier_name:SP.q('#ct-tier').value.trim(),starts_on:SP.q('#ct-start').value,monthly_fee:Number(SP.q('#ct-fee').value||0),included_minutes:Number(SP.q('#ct-minutes').value),first_line_rate:Number(SP.q('#ct-l1').value),second_line_rate:Number(SP.q('#ct-l2').value),second_line_allowance_multiplier:Number(SP.q('#ct-mult').value||1),rollover_enabled:SP.q('#ct-rollover').checked,rollover_cap_minutes:Number(SP.q('#ct-rollcap').value||0),currency:'EUR',overage_requires_approval:true}).select().single();if(c.error)throw c.error;var link=await db.from('support_contract_projects').insert({contract_id:c.data.id,project_id:SP.q('#ct-project').value});if(link.error)throw link.error;await SP.loadBaseData();renderAdminTab('contracts');SP.toast('Support contract created.');}catch(err){SP.toast(SP.errorMessage(err),true);}};
    }else{
      root.innerHTML='<div class="admin-grid"><div class="card"><div class="card-head"><h3>Simworx staff</h3></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th></tr></thead><tbody>'+SP.staff.map(function(p){return '<tr><td>'+h(p.full_name||'—')+'</td><td>'+h(p.email||'—')+'</td><td>'+h(SP.statusLabel(p.staff_role))+'</td></tr>';}).join('')+'</tbody></table></div></div>'+
        '<div class="card admin-form"><h3>Create portal invitation</h3><form id="invite-form" class="inline-form"><input id="in-email" class="full" type="email" placeholder="Email address" required><select id="in-kind"><option value="customer">Customer</option><option value="staff">Simworx staff</option></select><select id="in-company">'+companyOptions()+'</select><select id="in-customer-role"><option value="user">Customer User</option><option value="approver">Customer Approver</option><option value="company_admin">Company Admin</option></select><select id="in-staff-role" class="hidden"><option value="support_engineer">Support Engineer</option><option value="second_line_engineer">Second-Line Engineer</option><option value="admin">Administrator</option></select><label style="font-size:9px"><input id="in-approver" type="checkbox"> Designated support approver</label><button class="sp-btn primary full" type="submit">CREATE INVITATION</button></form><p class="micro-copy">After creating the invitation, send the customer this portal URL. Their membership is attached automatically when they create an account using the invited email address.</p></div></div>';
      var kind=SP.q('#in-kind');kind.onchange=function(){var staff=kind.value==='staff';SP.q('#in-company').classList.toggle('hidden',staff);SP.q('#in-customer-role').classList.toggle('hidden',staff);SP.q('#in-approver').parentElement.classList.toggle('hidden',staff);SP.q('#in-staff-role').classList.toggle('hidden',!staff);};
      SP.q('#invite-form').onsubmit=async function(e){e.preventDefault();try{var staff=kind.value==='staff',payload={email:SP.q('#in-email').value.trim().toLowerCase(),invite_kind:kind.value,company_id:staff?null:SP.q('#in-company').value,customer_role:staff?null:SP.q('#in-customer-role').value,staff_role:staff?SP.q('#in-staff-role').value:null,designated_support_approver:staff?false:SP.q('#in-approver').checked,created_by:SP.user.id};var r=await db.from('portal_invites').insert(payload).select().single();if(r.error)throw r.error;SP.q('#in-email').value='';SP.toast('Invitation record created.');}catch(err){SP.toast(SP.errorMessage(err),true);}};
    }
  }

  async function refreshCurrent(){
    try{await SP.loadIdentity();await SP.loadBaseData();if(SP.selectedTicket)await SP.openTicket(SP.selectedTicket.id,true);else SP.renderView(SP.currentView);}catch(err){SP.toast(SP.errorMessage(err),true);}
  }

  function wireGlobalEvents(){
    SP.q('#show-signup').onclick=function(){SP.q('#login-form').classList.add('hidden');SP.q('#signup-form').classList.remove('hidden');SP.q('.auth-actions').classList.add('hidden');};
    SP.q('#show-login').onclick=function(){SP.q('#signup-form').classList.add('hidden');SP.q('#login-form').classList.remove('hidden');SP.q('.auth-actions').classList.remove('hidden');};
    SP.q('#login-form').onsubmit=async function(e){e.preventDefault();SP.q('#auth-error').classList.add('hidden');var r=await db.auth.signInWithPassword({email:SP.q('#login-email').value.trim(),password:SP.q('#login-password').value});if(r.error){SP.q('#auth-error').textContent=SP.errorMessage(r.error);SP.q('#auth-error').classList.remove('hidden');return;}await SP.bootstrap();};
    SP.q('#signup-form').onsubmit=async function(e){e.preventDefault();SP.q('#auth-error').classList.add('hidden');var r=await db.auth.signUp({email:SP.q('#signup-email').value.trim(),password:SP.q('#signup-password').value,options:{data:{full_name:SP.q('#signup-name').value.trim()},emailRedirectTo:location.origin+location.pathname}});if(r.error){SP.q('#auth-error').textContent=SP.errorMessage(r.error);SP.q('#auth-error').classList.remove('hidden');return;}SP.toast('Account created. Check your email if confirmation is required.');if(r.data.session)await SP.bootstrap();};
    SP.q('#forgot-password').onclick=async function(){var email=SP.q('#login-email').value.trim()||prompt('Email address:','');if(!email)return;var r=await db.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});SP.toast(r.error?SP.errorMessage(r.error):'Password reset email sent.',!!r.error);};
    SP.q('#pin-form').onsubmit=async function(e){e.preventDefault();var pin=SP.q('#pin-input').value,mode=e.currentTarget.dataset.mode,r=await db.rpc(mode==='set'?'set_portal_pin':'verify_portal_pin',mode==='set'?{p_pin:pin}:{p_pin:pin});if(r.error||!r.data){SP.q('#pin-error').textContent=r.error?SP.errorMessage(r.error):'Incorrect PIN.';SP.q('#pin-error').classList.remove('hidden');return;}sessionStorage.setItem('simworx-support-unlocked',SP.user.id);SP.q('#pin-error').classList.add('hidden');await SP.enterPortal();};
    SP.q('#signout-pin').onclick=signOut;SP.q('#portal-signout').onclick=signOut;
    SP.q('#portal-nav').onclick=function(e){var b=e.target.closest('button[data-view]');if(!b)return;SP.renderView(b.dataset.view);SP.q('#portal-app').classList.remove('nav-open');};
    SP.q('#global-new-request').onclick=function(){SP.renderView('new-request');};
    SP.q('#refresh-portal').onclick=refreshCurrent;
    SP.q('#mobile-nav-toggle').onclick=function(){SP.q('#portal-app').classList.toggle('nav-open');};
  }
  async function signOut(){sessionStorage.removeItem('simworx-support-unlocked');if(SP.channel)db.removeChannel(SP.channel);await db.auth.signOut();SP.user=null;SP.profile=null;SP.showAuth();}

  document.addEventListener('DOMContentLoaded',function(){wireGlobalEvents();SP.bootstrap().catch(function(err){SP.toast(SP.errorMessage(err),true);SP.showAuth();});});
})();