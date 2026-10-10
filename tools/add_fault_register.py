from pathlib import Path
import re

portal_path = Path('portal/portal.js')
portal_index_path = Path('portal/index.html')
admin_path = Path('admin/admin.js')
admin_index_path = Path('admin/index.html')

portal = portal_path.read_text(encoding='utf-8')
portal_index = portal_index_path.read_text(encoding='utf-8')
admin = admin_path.read_text(encoding='utf-8')
admin_index = admin_index_path.read_text(encoding='utf-8')

portal_dashboard = r'''  async function dashboard() {
    const companyIds = currentCompanyIds(true);
    const [ticketsResult, buildsResult, contractsResult] = await Promise.all([
      linkSupport()
        ? sb.from('tickets').select('id,status,reference,subject,updated_at,created_at,projects(name)').order('updated_at', { ascending: false })
        : Promise.resolve({ data: [] }),
      linkBuild()
        ? sb.from('builds').select('id,title,status,progress_percent,current_stage').order('created_at', { ascending: false })
        : Promise.resolve({ data: [] }),
      linkSupport()
        ? sb.from('support_contracts').select('id,company_id,title,tier_name,response_priority,status,starts_on,ends_on,created_at').in('company_id', companyIds).eq('status', 'active').is('deleted_at', null).order('starts_on', { ascending: false }).order('created_at', { ascending: false })
        : Promise.resolve({ data: [] }),
    ]);
    const error = ticketsResult.error || buildsResult.error || contractsResult.error;
    if (error) throw error;

    const tickets = ticketsResult.data || [];
    const openFaults = tickets.filter((item) => item.status !== 'closed');
    const closedFaults = tickets.filter((item) => item.status === 'closed');
    const activeBuilds = (buildsResult.data || []).filter((item) => item.status !== 'complete');
    const today = new Date().toISOString().slice(0, 10);
    const activeContracts = (contractsResult.data || []).filter((contract) => contract.starts_on <= today && (!contract.ends_on || contract.ends_on >= today));
    const currentContracts = [];
    const seenCompanies = new Set();
    activeContracts.forEach((contract) => {
      if (!seenCompanies.has(contract.company_id)) {
        seenCompanies.add(contract.company_id);
        currentContracts.push(contract);
      }
    });
    const usageMap = await loadUsageMap(currentContracts.map((contract) => contract.id));

    content.innerHTML = `
      <h1>Welcome</h1>
      <div class="cards">
        <button id="openFaultsCard" class="card" style="text-align:left;width:100%;cursor:pointer">Open Faults<strong class="big">${openFaults.length}</strong><span class="muted">Click to open the fault register</span></button>
        <button id="closedFaultsCard" class="card" style="text-align:left;width:100%;cursor:pointer">Closed Faults<strong class="big">${closedFaults.length}</strong><span class="muted">View completed fault history</span></button>
        <div class="card">Active builds<strong class="big">${activeBuilds.length}</strong></div>
        <div class="card">Account<strong class="big" style="font-size:18px">${esc(companyLinks[0]?.companies?.trading_name || companyLinks[0]?.companies?.legal_name)}</strong></div>
      </div>
      <div class="panel">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px"><h3 style="margin:0">Open Faults</h3><button id="viewAllFaults" class="btn ghost">VIEW FAULT REGISTER</button></div>
        ${openFaults.length ? `<div class="stack" style="margin-top:12px">${openFaults.slice(0, 5).map((fault) => `<button class="btn ghost" data-dashboard-ticket="${fault.id}" style="text-align:left"><strong>${esc(fault.reference)} — ${esc(fault.subject)}</strong><br><span class="muted">${esc(fault.projects?.name || 'Simulator')} · ${esc(fault.status.replaceAll('_',' '))} · Updated ${new Date(fault.updated_at || fault.created_at).toLocaleString()}</span></button>`).join('')}</div>` : '<p class="muted">There are no open faults.</p>'}
      </div>
      ${currentContracts.map((contract) => `<div class="panel"><div style="display:flex;justify-content:space-between;gap:12px"><div><h3 style="margin:0">${esc(contract.tier_name)} — ${esc(contract.title)}</h3><p class="muted">Your current customer support contract · Response priority: ${esc(contract.response_priority || 'Not specified')}</p></div></div>${usageCardHtml(usageMap.get(contract.id))}</div>`).join('')}
      ${activeBuilds[0] ? `<div class="panel"><h3>Latest build</h3><strong>${esc(activeBuilds[0].title)}</strong><p>${activeBuilds[0].progress_percent}% complete · ${esc(activeBuilds[0].current_stage || activeBuilds[0].status)}</p></div>` : ''}`;

    const openRegister = (focus = 'open') => {
      document.querySelectorAll('#nav button').forEach((item) => item.classList.toggle('active', item.dataset.view === 'support'));
      view = 'support';
      support(focus);
    };
    document.getElementById('openFaultsCard').onclick = () => openRegister('open');
    document.getElementById('closedFaultsCard').onclick = () => openRegister('closed');
    document.getElementById('viewAllFaults').onclick = () => openRegister('open');
    document.querySelectorAll('[data-dashboard-ticket]').forEach((button) => button.onclick = () => ticket(button.dataset.dashboardTicket));
  }'''

portal_support = r'''  async function support(focus = 'open') {
    if (!linkSupport()) {
      content.innerHTML = '<div class="panel">Support access is not enabled for this account.</div>';
      return;
    }
    const { data, error } = await sb
      .from('tickets')
      .select('id,reference,subject,priority,status,created_at,updated_at,closed_at,companies(trading_name,legal_name),projects(name)')
      .order('updated_at', { ascending: false });
    if (error) throw error;

    const faultLog = data || [];
    const openFaults = faultLog.filter((item) => item.status !== 'closed');
    const closedFaults = faultLog.filter((item) => item.status === 'closed');
    const rows = (items, actionLabel) => items.length ? items.map((ticketItem) => `
      <tr>
        <td>${esc(ticketItem.reference)}</td>
        <td>${esc(ticketItem.projects?.name || '')}</td>
        <td>${esc(ticketItem.subject)}</td>
        <td>${esc(ticketItem.priority)}</td>
        <td><span class="tag">${esc(ticketItem.status.replaceAll('_',' '))}</span></td>
        <td>${new Date(ticketItem.updated_at || ticketItem.created_at).toLocaleString()}</td>
        <td><button class="btn ghost" data-open="${ticketItem.id}">${actionLabel}</button></td>
      </tr>`).join('') : `<tr><td colspan="7" class="muted">No ${actionLabel === 'OPEN DISCUSSION' ? 'open' : 'closed'} faults.</td></tr>`;

    content.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px"><div><h1 style="margin-bottom:4px">Fault Log Register</h1><p class="muted">Every submitted fault is retained here with its discussion and current status.</p></div><button id="logNewFault" class="btn primary">LOG A NEW FAULT</button></div>
      <div class="cards">
        <div class="card">Open Faults<strong class="big">${openFaults.length}</strong></div>
        <div class="card">Closed Faults<strong class="big">${closedFaults.length}</strong></div>
      </div>
      <div id="openFaultRegister" class="panel"><h2>Open Faults</h2><div style="overflow-x:auto"><table class="table"><thead><tr><th>Reference</th><th>Simulator</th><th>Subject</th><th>Priority</th><th>Status</th><th>Last activity</th><th></th></tr></thead><tbody>${rows(openFaults, 'OPEN DISCUSSION')}</tbody></table></div></div>
      <div id="closedFaultRegister" class="panel"><h2>Closed Faults</h2><div style="overflow-x:auto"><table class="table"><thead><tr><th>Reference</th><th>Simulator</th><th>Subject</th><th>Priority</th><th>Status</th><th>Last activity</th><th></th></tr></thead><tbody>${rows(closedFaults, 'VIEW HISTORY')}</tbody></table></div></div>`;

    document.getElementById('logNewFault').onclick = () => {
      document.querySelectorAll('#nav button').forEach((item) => item.classList.toggle('active', item.dataset.view === 'new-ticket'));
      view = 'new-ticket';
      newTicket();
    };
    document.querySelectorAll('[data-open]').forEach((button) => button.onclick = () => ticket(button.dataset.open));
    if (focus === 'closed') document.getElementById('closedFaultRegister').scrollIntoView({ block: 'start' });
  }'''

portal_ticket = r'''  async function ticket(id) {
    const [ticketResult, messagesResult, eventsResult, attachments] = await Promise.all([
      sb.from('tickets').select('*,projects(name),support_contracts(*)').eq('id', id).single(),
      sb.from('ticket_messages').select('*,profiles(full_name,is_simworx)').eq('ticket_id', id).order('created_at'),
      sb.from('ticket_events').select('id,event_type,summary,created_at,actor_id,metadata').eq('ticket_id', id).eq('customer_visible', true).order('created_at'),
      loadTicketAttachments(id),
    ]);
    if (ticketResult.error) throw ticketResult.error;
    if (messagesResult.error) throw messagesResult.error;
    if (eventsResult.error) throw eventsResult.error;

    const ticketData = ticketResult.data;
    const messages = messagesResult.data || [];
    const statusEvents = (eventsResult.data || []).filter((item) => item.event_type === 'status_change');
    const timeline = [
      ...messages.map((item) => ({ ...item, timeline_type: 'message' })),
      ...statusEvents.map((item) => ({ ...item, timeline_type: 'event' })),
    ].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const usageMap = await loadUsageMap([ticketData.contract_id]);
    const usage = usageMap.get(ticketData.contract_id);
    const initialAttachments = attachments.filter((item) => !item.message_id);
    const attachmentsByMessage = attachments.reduce((map, item) => {
      if (!item.message_id) return map;
      (map[item.message_id] ||= []).push(item);
      return map;
    }, {});
    const isClosed = ticketData.status === 'closed';

    content.innerHTML = `
      <button id="back" class="btn ghost">← Fault Log Register</button>
      <h1>${esc(ticketData.reference)} — ${esc(ticketData.subject)}</h1>
      ${isClosed ? `<div class="contract-status error"><strong>This fault is closed.</strong> The complete discussion remains available in the fault register.${ticketData.closed_at ? ` Closed ${new Date(ticketData.closed_at).toLocaleString()}.` : ''}</div>` : ''}
      <div class="grid">
        <div class="panel">
          <div class="comment">
            <strong>${esc(ticketData.projects?.name || 'Simulator fault')}</strong>
            <p>${esc(ticketData.overview)}</p>
            ${initialAttachments.length ? `<div class="attachment-grid">${initialAttachments.map(attachmentHtml).join('')}</div>` : ''}
            <div class="muted">Submitted ${new Date(ticketData.created_at).toLocaleString()}</div>
          </div>
          ${timeline.map((item) => item.timeline_type === 'event' ? `
            <div class="comment" style="text-align:center;background:#eef1f3"><strong>${esc(item.summary)}</strong><div class="muted">${new Date(item.created_at).toLocaleString()}</div></div>` : `
            <div class="comment" style="${item.from_staff || item.profiles?.is_simworx ? 'background:#fff4d7' : ''}">
              <strong>${item.from_staff || item.profiles?.is_simworx ? 'Simworx Support' : esc(item.profiles?.full_name || 'Client')}</strong>
              ${item.body ? `<div>${esc(item.body)}</div>` : ''}
              ${(attachmentsByMessage[item.id] || []).length ? `<div class="attachment-grid">${attachmentsByMessage[item.id].map(attachmentHtml).join('')}</div>` : ''}
              <div class="muted">${new Date(item.created_at).toLocaleString()}</div>
            </div>`).join('')}
          ${isClosed ? '<div class="notice"><strong>Discussion closed.</strong> This fault can still be viewed from Closed Faults.</div>' : `<form id="reply" class="stack" style="margin-top:12px">
            <textarea id="replyBody" placeholder="Reply to Simworx…"></textarea>
            <label class="upload-box">Attach images, videos or documents
              <input id="replyFiles" type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,video/mp4,video/webm,video/quicktime,application/pdf,text/plain,application/zip">
            </label>
            <div id="replyFileList" class="muted"></div>
            <button class="btn primary">SEND MESSAGE</button>
            <div id="replyStatus" class="muted"></div>
          </form>`}
        </div>
        <div>
          <div class="panel">
            <h3>Fault details</h3>
            <p><strong>Status:</strong> ${esc(ticketData.status.replaceAll('_',' '))}</p>
            <p><strong>Priority:</strong> ${esc(ticketData.priority)}</p>
            <p><strong>Support contract:</strong><br>${esc(ticketData.support_contracts?.tier_name || ticketData.support_contracts?.title || 'Not assigned')}</p>
            <p><strong>Response priority:</strong><br>${esc(ticketData.support_contracts?.response_priority || 'Not specified')}</p>
            ${isClosed ? `<p><strong>Closed:</strong><br>${ticketData.closed_at ? new Date(ticketData.closed_at).toLocaleString() : 'Closed'}</p>` : '<button id="closeFault" class="btn danger" style="width:100%">CLOSE THIS FAULT</button><p class="muted">Close the fault when no further support discussion is required.</p>'}
          </div>
          <div class="panel"><h3>Support usage this period</h3>${usageCardHtml(usage)}</div>
        </div>
      </div>`;

    document.getElementById('back').onclick = () => support(isClosed ? 'closed' : 'open');

    const closeButton = document.getElementById('closeFault');
    if (closeButton) {
      closeButton.onclick = async () => {
        if (!window.confirm('Close this fault? The discussion will remain available in Closed Faults.')) return;
        closeButton.disabled = true;
        try {
          const { error } = await sb.rpc('close_support_ticket', { p_ticket: ticketData.id });
          if (error) throw error;
          toast('Fault closed');
          await ticket(id);
        } catch (error) {
          closeButton.disabled = false;
          toast(error.message, true);
        }
      };
    }

    const replyForm = document.getElementById('reply');
    if (replyForm) {
      const replyFiles = document.getElementById('replyFiles');
      replyFiles.onchange = () => {
        document.getElementById('replyFileList').textContent = Array.from(replyFiles.files || []).map((file) => `${file.name} (${formatBytes(file.size)})`).join(' · ');
      };
      replyForm.onsubmit = async (event) => {
        event.preventDefault();
        const body = document.getElementById('replyBody').value.trim();
        const files = Array.from(replyFiles.files || []);
        const status = document.getElementById('replyStatus');
        if (!body && !files.length) {
          status.textContent = 'Enter a message or attach a file.';
          return;
        }

        status.textContent = 'Sending…';
        const { data: message, error: messageError } = await sb
          .from('ticket_messages')
          .insert({ ticket_id: ticketData.id, company_id: ticketData.company_id, author_id: me.id, body: body || null, visibility: 'customer' })
          .select('id')
          .single();
        if (messageError) {
          status.textContent = messageError.message;
          return;
        }

        try {
          await uploadTicketFiles(ticketData, files, message.id, status);
          toast('Message sent');
          await ticket(id);
        } catch (error) {
          status.textContent = `Message sent, but an attachment failed: ${error.message}`;
        }
      };
    }
  }'''

patterns = [
    (r"  async function dashboard\(\) \{.*?\n  \}\n\n\n  async function loadTicketAttachments", portal_dashboard + "\n\n\n  async function loadTicketAttachments"),
    (r"  async function support\(\) \{.*?\n  \}\n\n  async function ticket", portal_support + "\n\n  async function ticket"),
    (r"  async function ticket\(id\) \{.*?\n  \}\n\n\n  async function newTicket", portal_ticket + "\n\n\n  async function newTicket"),
]
for pattern, replacement in patterns:
    portal, count = re.subn(pattern, replacement, portal, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f'Portal function replacement failed: {pattern}')

admin_tickets = r'''  async function tickets() {
    const { data = [] } = await api('tickets');
    const openFaults = data.filter((item) => item.status !== 'closed');
    const closedFaults = data.filter((item) => item.status === 'closed');
    const rows = (items, actionLabel) => items.length ? items.map((ticketItem) => `
      <tr>
        <td>${esc(ticketItem.reference)}</td>
        <td>${esc(ticketItem.companies?.trading_name || ticketItem.companies?.legal_name || '')}</td>
        <td>${esc(ticketItem.subject)}</td>
        <td>${esc(ticketItem.priority)}</td>
        <td><span class="tag">${esc(ticketItem.status.replaceAll('_',' '))}</span></td>
        <td>${new Date(ticketItem.created_at).toLocaleString()}</td>
        <td><button class="btn ghost" data-ticket="${ticketItem.id}">${actionLabel}</button></td>
      </tr>`).join('') : `<tr><td colspan="7" class="muted">No ${actionLabel === 'OPEN DISCUSSION' ? 'open' : 'closed'} faults.</td></tr>`;

    content.innerHTML = `
      <h1>Fault Log Register</h1>
      <div class="cards"><div class="card">Open Faults<strong class="big">${openFaults.length}</strong></div><div class="card">Closed Faults<strong class="big">${closedFaults.length}</strong></div></div>
      <div class="panel"><h2>Open Faults</h2><div style="overflow-x:auto"><table class="table"><thead><tr><th>Reference</th><th>Customer</th><th>Subject</th><th>Priority</th><th>Status</th><th>Created</th><th></th></tr></thead><tbody>${rows(openFaults, 'OPEN DISCUSSION')}</tbody></table></div></div>
      <div class="panel"><h2>Closed Faults</h2><div style="overflow-x:auto"><table class="table"><thead><tr><th>Reference</th><th>Customer</th><th>Subject</th><th>Priority</th><th>Status</th><th>Created</th><th></th></tr></thead><tbody>${rows(closedFaults, 'VIEW HISTORY')}</tbody></table></div></div>`;
    document.querySelectorAll('[data-ticket]').forEach((button) => button.onclick = () => ticketDetail(button.dataset.ticket));
  }'''

admin, count = re.subn(r"  async function tickets\(\) \{.*?\n  \}\n\n  async function uploadStaffFiles", admin_tickets + "\n\n  async function uploadStaffFiles", admin, count=1, flags=re.S)
if count != 1:
    raise SystemExit('Admin tickets function replacement failed')

old_heading = '''      <button class="btn ghost" id="backTickets">← Back</button>
      <h1>${esc(ticket.reference)} — ${esc(ticket.subject)}</h1>
      <div class="grid">'''
new_heading = '''      <button class="btn ghost" id="backTickets">← Fault Log Register</button>
      <h1>${esc(ticket.reference)} — ${esc(ticket.subject)}</h1>
      ${ticket.status === 'closed' ? `<div class="notice"><strong>This fault is closed.</strong>${ticket.closed_at ? ` Closed ${new Date(ticket.closed_at).toLocaleString()}.` : ''}</div>` : ''}
      <div class="grid">'''
if old_heading not in admin:
    raise SystemExit('Admin ticket heading anchor not found')
admin = admin.replace(old_heading, new_heading, 1)

old_priority = '''            <p><strong>Priority:</strong> ${esc(ticket.priority)}</p>
          </div>'''
new_priority = '''            <p><strong>Priority:</strong> ${esc(ticket.priority)}</p>
            ${ticket.status === 'closed' ? `<p><strong>Closed:</strong><br>${ticket.closed_at ? new Date(ticket.closed_at).toLocaleString() : 'Closed'}</p>` : '<button id="adminCloseFault" class="btn danger" style="width:100%">CLOSE FAULT</button>'}
          </div>'''
if old_priority not in admin:
    raise SystemExit('Admin priority anchor not found')
admin = admin.replace(old_priority, new_priority, 1)

old_status_handler = '''        await api('ticket_status', { id, status: event.target.value });
        toast('Status updated');'''
new_status_handler = '''        await api('ticket_status', { id, status: event.target.value });
        toast('Status updated');
        await ticketDetail(id);'''
if old_status_handler not in admin:
    raise SystemExit('Admin status handler anchor not found')
admin = admin.replace(old_status_handler, new_status_handler, 1)

close_handler_anchor = '''    const filesInput = document.getElementById('replyFiles');'''
close_handler = '''    const adminCloseButton = document.getElementById('adminCloseFault');
    if (adminCloseButton) {
      adminCloseButton.onclick = async () => {
        if (!window.confirm('Close this fault? It will remain available in Closed Faults.')) return;
        adminCloseButton.disabled = true;
        try {
          await api('ticket_status', { id, status: 'closed' });
          toast('Fault closed');
          await ticketDetail(id);
        } catch (error) {
          adminCloseButton.disabled = false;
          toast(error.message, true);
        }
      };
    }

    const filesInput = document.getElementById('replyFiles');'''
if close_handler_anchor not in admin:
    raise SystemExit('Admin close handler anchor not found')
admin = admin.replace(close_handler_anchor, close_handler, 1)

portal_index = portal_index.replace('.ghost{background:#eef1f3}', '.ghost{background:#eef1f3}.danger{background:#ffeaea;color:#922}')
portal_index = portal_index.replace('./portal.js?v=20261010-current-contract', './portal.js?v=20261010-fault-register')
admin_index = admin_index.replace('build 2026.10.10.3', 'build 2026.10.10.4')
admin_index = admin_index.replace('./admin.js?v=20261010-current-contract', './admin.js?v=20261010-fault-register')

portal_path.write_text(portal, encoding='utf-8')
portal_index_path.write_text(portal_index, encoding='utf-8')
admin_path.write_text(admin, encoding='utf-8')
admin_index_path.write_text(admin_index, encoding='utf-8')
