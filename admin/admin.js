(() => {
const URL='https://euttubfvsrgkeiescsdm.supabase.co/functions/v1/staff-pin-admin';
const KEY='sb_publishable_PEfCOwn6Xkwtl7RhWPAPVA_Ppgq08Wl';
const login=document.getElementById('login'),app=document.getElementById('app'),content=document.getElementById('content');
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const toast=m=>{const t=document.getElementById('toast');t.textContent=m;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2600)};
let pin=sessionStorage.getItem('simworx-admin-pin')||'',view='dashboard';

async function api(action,payload={}){
  const r=await fetch(URL,{method:'POST',headers:{'Content-Type':'application/json','apikey':KEY},body:JSON.stringify({pin,action,payload})});
  const out=await r.json().catch(()=>({error:'Invalid server response'}));
  if(!r.ok) throw new Error(out.error||'Request failed');
  return out;
}
async function unlock(){
  try{await api('verify');sessionStorage.setItem('simworx-admin-pin',pin);login.classList.add('hidden');app.classList.remove('hidden');render();}
  catch(e){document.getElementById('pin-msg').textContent=e.message;pin='';sessionStorage.removeItem('simworx-admin-pin');}
}
document.getElementById('pin-form').onsubmit=e=>{e.preventDefault();pin=document.getElementById('pin').value;unlock()};
document.getElementById('signout').onclick=()=>{sessionStorage.removeItem('simworx-admin-pin');location.reload()};
document.querySelectorAll('#nav button').forEach(b=>b.onclick=()=>{document.querySelectorAll('#nav button').forEach(x=>x.classList.remove('active'));b.classList.add('active');view=b.dataset.view;render()});
async function render(){content.innerHTML='<div class="panel">Loading…</div>';try{if(view==='dashboard')return dashboard();if(view==='tickets')return tickets();if(view==='customers')return customers();if(view==='builds')return builds();}catch(e){content.innerHTML='<div class="panel">'+esc(e.message)+'</div>'}}
async function dashboard(){const d=await api('dashboard');content.innerHTML=`<h1>Dashboard</h1><div class="cards"><div class="card">Open requests<strong class="big">${d.open}</strong></div><div class="card">Customers<strong class="big">${d.customers}</strong></div><div class="card">Active builds<strong class="big">${d.active_builds}</strong></div><div class="card">Portal status<strong class="big">LIVE</strong></div></div><div class="panel"><strong>Admin is connected to live client support and build data.</strong></div>`;}
async function tickets(){const {data=[]}=await api('tickets');content.innerHTML=`<h1>Support Requests</h1><div class="panel"><table class="table"><thead><tr><th>Reference</th><th>Customer</th><th>Subject</th><th>Priority</th><th>Status</th><th></th></tr></thead><tbody>${data.map(t=>`<tr><td>${esc(t.reference)}</td><td>${esc(t.companies?.trading_name||t.companies?.legal_name||'')}</td><td>${esc(t.subject)}</td><td>${esc(t.priority)}</td><td><span class="tag">${esc(t.status)}</span></td><td><button class="btn ghost" data-ticket="${t.id}">Open</button></td></tr>`).join('')}</tbody></table></div>`;document.querySelectorAll('[data-ticket]').forEach(b=>b.onclick=()=>ticketDetail(b.dataset.ticket));}
async function ticketDetail(id){const d=await api('ticket_detail',{id}),t=d.ticket,m=d.messages||[];content.innerHTML=`<button class="btn ghost" id="backTickets">← Back</button><h1>${esc(t.reference)} — ${esc(t.subject)}</h1><div class="grid"><div class="panel"><div class="chat">${m.map(x=>`<div class="bubble ${x.profiles?.is_simworx?'staff':''}"><strong>${esc(x.profiles?.full_name|| (x.profiles?.is_simworx?'Simworx':'Client'))}</strong><div>${esc(x.body||'')}</div><div class="muted">${new Date(x.created_at).toLocaleString()}</div></div>`).join('')}</div><form id="reply" class="stack" style="margin-top:14px"><textarea id="replyBody" placeholder="Reply to client…" required></textarea><button class="btn primary">SEND REPLY</button></form></div><div class="panel"><strong>Status</strong><select id="ticketStatus"><option value="${esc(t.status)}">${esc(t.status)}</option><option>open</option><option>acknowledged</option><option>diagnosing</option><option>waiting_customer</option><option>resolved</option><option>closed</option></select><p class="muted">${esc(t.companies?.trading_name||t.companies?.legal_name)} · ${esc(t.projects?.name||'')}</p></div></div>`;document.getElementById('backTickets').onclick=tickets;document.getElementById('reply').onsubmit=async e=>{e.preventDefault();try{await api('ticket_reply',{ticket_id:t.id,company_id:t.company_id,body:document.getElementById('replyBody').value.trim()});toast('Reply sent');ticketDetail(id)}catch(err){toast(err.message)}};document.getElementById('ticketStatus').onchange=async e=>{try{await api('ticket_status',{id,status:e.target.value});toast('Status updated')}catch(err){toast(err.message)}};}
async function customers(){const {data:companies=[]}=await api('customers');content.innerHTML=`<h1>Customers & Access</h1><div class="grid"><div class="panel"><h3>Create customer</h3><form id="companyForm" class="stack"><input id="coName" placeholder="Company name" required><input id="coCode" placeholder="Code e.g. JETPRO" required><input id="coCountry" placeholder="Country"><button class="btn primary">CREATE CUSTOMER</button></form></div><div class="panel"><h3>Invite client</h3><form id="inviteForm" class="stack"><select id="inviteCompany" required><option value="">Select customer…</option>${companies.map(c=>`<option value="${c.id}">${esc(c.trading_name||c.legal_name)}</option>`).join('')}</select><input id="inviteName" placeholder="Contact name"><input id="inviteEmail" type="email" placeholder="Email" required><label><input id="canSupport" type="checkbox" checked style="width:auto"> Support access</label><label><input id="canBuild" type="checkbox" checked style="width:auto"> Build Update access</label><button class="btn primary">SEND INVITE</button></form></div></div><div class="panel"><table class="table"><thead><tr><th>Company</th><th>Country</th><th>Email</th><th>Active</th><th></th></tr></thead><tbody>${companies.map(c=>`<tr><td>${esc(c.trading_name||c.legal_name)}</td><td>${esc(c.country||'')}</td><td>${esc(c.general_email||'')}</td><td>${c.active?'Yes':'No'}</td><td><button class="btn ghost" data-edit-company="${c.id}">Edit</button></td></tr>`).join('')}</tbody></table></div>`;
document.getElementById('companyForm').onsubmit=async e=>{e.preventDefault();try{await api('create_customer',{name:document.getElementById('coName').value.trim(),code:document.getElementById('coCode').value.trim().toUpperCase(),country:document.getElementById('coCountry').value.trim()});toast('Customer created');customers()}catch(err){toast(err.message)}};
document.getElementById('inviteForm').onsubmit=async e=>{e.preventDefault();try{await api('invite_client',{company_id:document.getElementById('inviteCompany').value,email:document.getElementById('inviteEmail').value.trim(),full_name:document.getElementById('inviteName').value.trim(),can_support:document.getElementById('canSupport').checked,can_build_updates:document.getElementById('canBuild').checked});toast('Client invitation sent')}catch(err){toast(err.message)}};
document.querySelectorAll('[data-edit-company]').forEach(b=>b.onclick=()=>editCustomer(companies.find(c=>c.id===b.dataset.editCompany)));}
async function builds(){const d=await api('builds'),companies=d.companies||[],bs=d.builds||[];content.innerHTML=`<h1>Build Updates</h1><div class="grid"><div class="panel"><h3>Create build</h3><form id="buildForm" class="stack"><select id="buildCompany" required><option value="">Customer…</option>${companies.map(c=>`<option value="${c.id}">${esc(c.trading_name||c.legal_name)}</option>`).join('')}</select><input id="buildTitle" placeholder="Build title e.g. DA62 Simulator #2" required><input id="buildNo" placeholder="Build number"><input id="buildStage" placeholder="Current stage"><input id="buildProgress" type="number" min="0" max="100" value="0"><button class="btn primary">CREATE BUILD</button></form></div><div class="panel"><h3>Existing builds</h3><div class="stack">${bs.map(b=>`<button class="btn ghost" data-build="${b.id}" style="text-align:left"><strong>${esc(b.title)}</strong><br><span class="muted">${esc(b.companies?.trading_name||b.companies?.legal_name)} · ${b.progress_percent}% · ${esc(b.status)}</span></button>`).join('')}</div></div></div>`;document.getElementById('buildForm').onsubmit=async e=>{e.preventDefault();try{await api('create_build',{company_id:document.getElementById('buildCompany').value,title:document.getElementById('buildTitle').value,build_number:document.getElementById('buildNo').value,current_stage:document.getElementById('buildStage').value,progress_percent:+document.getElementById('buildProgress').value});toast('Build created');builds()}catch(err){toast(err.message)}};document.querySelectorAll('[data-build]').forEach(b=>b.onclick=()=>buildDetail(b.dataset.build));}
async function buildDetail(id){const d=await api('build_detail',{id}),b=d.build,ms=d.milestones||[],us=d.updates||[],issues=d.issues||[];content.innerHTML=`<button id="backBuilds" class="btn ghost">← Back</button><h1>${esc(b.title)}</h1><div class="cards"><div class="card">Progress<strong class="big">${b.progress_percent}%</strong></div><div class="card">Stage<strong class="big" style="font-size:18px">${esc(b.current_stage||'—')}</strong></div><div class="card">Status<strong class="big" style="font-size:18px">${esc(b.status)}</strong></div><div class="card">Customer<strong class="big" style="font-size:18px">${esc(b.companies?.trading_name||b.companies?.legal_name)}</strong></div></div><div class="grid"><div><div class="panel"><h3>Publish update</h3><form id="updateForm" class="stack"><input id="upTitle" placeholder="Update title" required><textarea id="upBody" placeholder="What changed this week?" required></textarea><input id="upProgress" type="number" min="0" max="100" placeholder="New progress %"><button class="btn primary">PUBLISH UPDATE</button></form></div><div class="panel"><h3>Updates</h3>${us.map(u=>`<div style="margin-bottom:14px"><strong>${esc(u.title)}</strong><p>${esc(u.body)}</p><span class="muted">${new Date(u.created_at).toLocaleString()}</span></div>`).join('')}</div></div><div><div class="panel"><h3>Add milestone</h3><form id="mileForm" class="stack"><input id="mileTitle" placeholder="Milestone" required><input id="mileDate" type="date"><button class="btn dark">ADD MILESTONE</button></form><div style="margin-top:12px">${ms.map(m=>`<div class="row" style="justify-content:space-between;margin:7px 0"><span>${esc(m.title)}</span><span class="tag">${esc(m.status)}</span></div>`).join('')}</div></div><div class="panel"><h3>Build issue</h3><form id="issueForm" class="stack"><input id="issueTitle" placeholder="Issue title" required><textarea id="issueDesc" placeholder="Describe issue"></textarea><select id="issueSeverity"><option>normal</option><option>low</option><option>high</option><option>critical</option></select><button class="btn dark">LOG ISSUE</button></form><div style="margin-top:12px">${issues.map(i=>`<div style="margin:9px 0"><strong>${esc(i.title)}</strong> <span class="tag gold">${esc(i.status)}</span><div class="muted">${esc(i.description||'')}</div></div>`).join('')}</div></div></div></div>`;
document.getElementById('backBuilds').onclick=builds;
document.getElementById('updateForm').onsubmit=async e=>{e.preventDefault();try{const v=document.getElementById('upProgress').value;await api('create_update',{build_id:id,company_id:b.company_id,title:document.getElementById('upTitle').value,body:document.getElementById('upBody').value,progress_percent:v===''?null:+v});toast('Build update published');buildDetail(id)}catch(err){toast(err.message)}};
document.getElementById('mileForm').onsubmit=async e=>{e.preventDefault();try{await api('create_milestone',{build_id:id,company_id:b.company_id,title:document.getElementById('mileTitle').value,target_date:document.getElementById('mileDate').value||null});toast('Milestone added');buildDetail(id)}catch(err){toast(err.message)}};
document.getElementById('issueForm').onsubmit=async e=>{e.preventDefault();try{await api('create_issue',{build_id:id,company_id:b.company_id,title:document.getElementById('issueTitle').value,description:document.getElementById('issueDesc').value,severity:document.getElementById('issueSeverity').value});toast('Issue logged');buildDetail(id)}catch(err){toast(err.message)}};}
if(pin)unlock();
})();
async function editCustomer(c){
  if(!c)return;
  content.innerHTML=`<button id="backCustomers" class="btn ghost">← Back</button><h1>Edit Customer</h1>
  <div class="panel"><form id="editCustomerForm" class="stack">
    <label>Legal name<input id="ecLegal" value="${esc(c.legal_name||'')}" required></label>
    <label>Trading name<input id="ecTrading" value="${esc(c.trading_name||'')}"></label>
    <label>Customer code<input id="ecCode" value="${esc(c.code||'')}" required></label>
    <label>Country<input id="ecCountry" value="${esc(c.country||'')}"></label>
    <label>General email<input id="ecEmail" type="email" value="${esc(c.general_email||'')}"></label>
    <label>Phone<input id="ecPhone" value="${esc(c.phone||'')}"></label>
    <label>Commercial contact<input id="ecCommercialName" value="${esc(c.commercial_contact_name||'')}"></label>
    <label>Commercial contact email<input id="ecCommercialEmail" type="email" value="${esc(c.commercial_contact_email||'')}"></label>
    <label>Technical contact<input id="ecTechnicalName" value="${esc(c.technical_contact_name||'')}"></label>
    <label>Technical contact email<input id="ecTechnicalEmail" type="email" value="${esc(c.technical_contact_email||'')}"></label>
    <label>Notes<textarea id="ecNotes">${esc(c.notes||'')}</textarea></label>
    <label><input id="ecActive" type="checkbox" ${c.active?'checked':''} style="width:auto"> Active customer</label>
    <button class="btn primary">SAVE CHANGES</button>
  </form></div>`;
  document.getElementById('backCustomers').onclick=customers;
  document.getElementById('editCustomerForm').onsubmit=async e=>{
    e.preventDefault();
    try{
      await api('update_customer',{
        id:c.id,
        legal_name:document.getElementById('ecLegal').value.trim(),
        trading_name:document.getElementById('ecTrading').value.trim(),
        code:document.getElementById('ecCode').value.trim().toUpperCase(),
        country:document.getElementById('ecCountry').value.trim(),
        general_email:document.getElementById('ecEmail').value.trim(),
        phone:document.getElementById('ecPhone').value.trim(),
        commercial_contact_name:document.getElementById('ecCommercialName').value.trim(),
        commercial_contact_email:document.getElementById('ecCommercialEmail').value.trim(),
        technical_contact_name:document.getElementById('ecTechnicalName').value.trim(),
        technical_contact_email:document.getElementById('ecTechnicalEmail').value.trim(),
        notes:document.getElementById('ecNotes').value.trim(),
        active:document.getElementById('ecActive').checked
      });
      toast('Customer updated');
      customers();
    }catch(err){toast(err.message)}
  };
}
