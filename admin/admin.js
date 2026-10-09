(() => {
  'use strict';

  const ADMIN_URL = 'https://euttubfvsrgkeiescsdm.supabase.co/functions/v1/staff-pin-admin';
  const SUPPORT_URL = 'https://euttubfvsrgkeiescsdm.supabase.co/functions/v1/support-portal-admin';
  const PROJECT_URL = 'https://euttubfvsrgkeiescsdm.supabase.co';
  const KEY = 'sb_publishable_PEfCOwn6Xkwtl7RhWPAPVA_Ppgq08Wl';
  const BUCKET = 'support-attachments';
  const MAX_FILE_BYTES = 100 * 1024 * 1024;
  const adminSb = supabase.createClient(PROJECT_URL, KEY);

  const login = document.getElementById('login');
  const app = document.getElementById('app');
  const content = document.getElementById('content');

  let pin = sessionStorage.getItem('simworx-admin-pin') || '';
  let view = 'dashboard';
  let contractCompanyFilter = '';


  const TIER_PRESETS = Object.freeze({
    Basic: {
      title: 'Basic Support', tier: 'Basic', monthlyFee: 150, includedHours: 2,
      excessRate: 90, responsePriority: 'Best effort', billingIncrement: 15,
      includedServices: 'Up to 2 hours of remote support per month. Additional support is billed at €90 per hour.',
    },
    Standard: {
      title: 'Standard Support', tier: 'Standard', monthlyFee: 300, includedHours: 5,
      excessRate: 75, responsePriority: 'Priority', billingIncrement: 15,
      includedServices: 'Up to 5 hours of remote support per month. Additional support is billed at €75 per hour.',
    },
    Premium: {
      title: 'Premium Support', tier: 'Premium', monthlyFee: 500, includedHours: 10,
      excessRate: 60, responsePriority: 'Highest priority', billingIncrement: 15,
      includedServices: 'Up to 10 hours of remote support per month. Additional support is billed at the discounted rate of €60 per hour.',
    },
    'Pay As You Go': {
      title: 'Pay As You Go Support', tier: 'Pay As You Go', monthlyFee: 0, includedHours: 0,
      excessRate: 100, responsePriority: 'Best effort (subject to availability)', billingIncrement: 15,
      includedServices: 'No monthly remote-time allocation. All support is billed at €100 per hour, subject to availability.',
    },
  });

  const DEFAULT_WARRANTY_NOTES = '12-month initial warranty included. The standard warranty begins on final acceptance and continues for 1 year. An extended warranty may be purchased for up to 3 additional years.';

  const formatMinutes = (minutes) => {
    const value = Math.max(0, Math.round(Number(minutes || 0)));
    const hours = Math.floor(value / 60);
    const remainder = value % 60;
    if (!hours) return `${remainder}m`;
    return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
  };

  const formatMoney = (value, currency = 'EUR') => {
    try {
      return new Intl.NumberFormat('en-GB', { style: 'currency', currency: currency || 'EUR' }).format(Number(value || 0));
    } catch {
      return `${currency || 'EUR'} ${Number(value || 0).toFixed(2)}`;
    }
  };

  const usageSummaryHtml = (usage, compact = false) => {
    if (!usage) return '<div class="muted">Usage will appear when the contract is active.</div>';
    const included = Number(usage.included_minutes || 0);
    const used = Number(usage.used_minutes || 0);
    const progress = included > 0 ? Math.min(100, Math.round((used / included) * 100)) : (used > 0 ? 100 : 0);
    return `
      <div class="usage-summary">
        <div class="row" style="justify-content:space-between"><strong>${formatMinutes(used)} used</strong><span>${included ? `${formatMinutes(included)} included` : 'No included allowance'}</span></div>
        <div style="height:8px;background:#e8ecef;border-radius:9px;overflow:hidden;margin:8px 0"><div style="height:100%;width:${progress}%;background:${Number(usage.overage_minutes || 0) > 0 ? '#b83b3b' : '#f2a900'}"></div></div>
        <div class="muted">Remaining: ${formatMinutes(usage.remaining_minutes)} · Overage: ${formatMinutes(usage.overage_minutes)}</div>
        ${compact ? '' : `<div style="margin-top:9px"><strong>Estimated bill if this period ended now: ${formatMoney(usage.estimated_total, usage.currency)}</strong><div class="muted">Monthly fee ${formatMoney(usage.monthly_fee, usage.currency)} + overage ${formatMoney(usage.overage_amount, usage.currency)}</div></div>`}
      </div>`;
  };

  const esc = (value) => String(value ?? '').replace(/[&<>"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'
  })[char]);

  const toast = (message, isError = false) => {
    const element = document.getElementById('toast');
    element.textContent = message;
    element.style.background = isError ? '#9f2d2d' : '#111';
    element.classList.add('show');
    setTimeout(() => element.classList.remove('show'), 3500);
  };

  const formatBytes = (bytes) => {
    const value = Number(bytes || 0);
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  };

  async function request(url, action, payload = {}) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: KEY },
      body: JSON.stringify({ pin, action, payload }),
    });
    const result = await response.json().catch(() => ({ error: 'Invalid server response' }));
    if (!response.ok) throw new Error(result.error || 'Request failed');
    return result;
  }

  const api = (action, payload = {}) => request(ADMIN_URL, action, payload);
  const supportApi = (action, payload = {}) => request(SUPPORT_URL, action, payload);

  async function unlock() {
    try {
      await api('verify');
      sessionStorage.setItem('simworx-admin-pin', pin);
      login.classList.add('hidden');
      app.classList.remove('hidden');
      await render();
    } catch (error) {
      document.getElementById('pin-msg').textContent = error.message;
      pin = '';
      sessionStorage.removeItem('simworx-admin-pin');
    }
  }

  document.getElementById('pin-form').onsubmit = (event) => {
    event.preventDefault();
    pin = document.getElementById('pin').value;
    unlock();
  };

  document.getElementById('signout').onclick = () => {
    sessionStorage.removeItem('simworx-admin-pin');
    location.reload();
  };

  document.querySelectorAll('#nav button').forEach((button) => {
    button.onclick = () => {
      document.querySelectorAll('#nav button').forEach((item) => item.classList.remove('active'));
      button.classList.add('active');
      view = button.dataset.view;
      render();
    };
  });

  async function render() {
    content.innerHTML = '<div class="panel">Loading…</div>';
    try {
      if (view === 'dashboard') return await dashboard();
      if (view === 'tickets') return await tickets();
      if (view === 'customers') return await customers();
      if (view === 'contracts') return await contracts();
      if (view === 'builds') return await builds();
    } catch (error) {
      content.innerHTML = `<div class="panel"><strong>Something went wrong.</strong><p>${esc(error.message || error)}</p></div>`;
    }
  }

  async function dashboard() {
    const data = await api('dashboard');
    content.innerHTML = `
      <h1>Dashboard</h1>
      <div class="cards">
        <div class="card">Open requests<strong class="big">${data.open}</strong></div>
        <div class="card">Customers<strong class="big">${data.customers}</strong></div>
        <div class="card">Active builds<strong class="big">${data.active_builds}</strong></div>
        <div class="card">Portal status<strong class="big">LIVE</strong></div>
      </div>
      <div class="panel"><strong>Admin is connected to live client support, contracts and build data.</strong></div>`;
  }

  function attachmentHtml(attachment) {
    const label = `${esc(attachment.file_name)} · ${formatBytes(attachment.size_bytes)}`;
    if (!attachment.url) return `<div class="file-card"><span>${label}</span><small>File unavailable</small></div>`;
    if ((attachment.mime_type || '').startsWith('image/')) {
      return `<a class="media-card" href="${attachment.url}" target="_blank" rel="noopener"><img src="${attachment.url}" alt="${esc(attachment.file_name)}"><span>${label}</span></a>`;
    }
    if ((attachment.mime_type || '').startsWith('video/')) {
      return `<div class="media-card"><video controls preload="metadata" src="${attachment.url}"></video><span>${label}</span></div>`;
    }
    return `<a class="file-card" href="${attachment.url}" target="_blank" rel="noopener"><strong>${esc(attachment.file_name)}</strong><small>${formatBytes(attachment.size_bytes)}</small></a>`;
  }

  async function tickets() {
    const { data = [] } = await api('tickets');
    content.innerHTML = `
      <h1>Support Requests</h1>
      <div class="panel">
        <table class="table">
          <thead><tr><th>Reference</th><th>Customer</th><th>Subject</th><th>Priority</th><th>Status</th><th></th></tr></thead>
          <tbody>${data.map((ticket) => `
            <tr>
              <td>${esc(ticket.reference)}</td>
              <td>${esc(ticket.companies?.trading_name || ticket.companies?.legal_name || '')}</td>
              <td>${esc(ticket.subject)}</td>
              <td>${esc(ticket.priority)}</td>
              <td><span class="tag">${esc(ticket.status)}</span></td>
              <td><button class="btn ghost" data-ticket="${ticket.id}">Open</button></td>
            </tr>`).join('')}</tbody>
        </table>
      </div>`;
    document.querySelectorAll('[data-ticket]').forEach((button) => button.onclick = () => ticketDetail(button.dataset.ticket));
  }

  async function uploadStaffFiles(ticket, files, messageId, statusElement) {
    const selected = Array.from(files || []);
    for (let index = 0; index < selected.length; index += 1) {
      const file = selected[index];
      if (file.size > MAX_FILE_BYTES) throw new Error(`${file.name} exceeds the 100 MB upload limit.`);
      statusElement.textContent = `Uploading ${index + 1} of ${selected.length}: ${file.name}`;
      const upload = await supportApi('create_upload', {
        ticket_id: ticket.id,
        message_id: messageId,
        file_name: file.name,
        mime_type: file.type,
      });
      const { error: uploadError } = await adminSb.storage.from(BUCKET).uploadToSignedUrl(upload.path, upload.token, file, {
        contentType: file.type || 'application/octet-stream',
      });
      if (uploadError) throw uploadError;
      await supportApi('record_attachment', {
        ticket_id: ticket.id,
        message_id: messageId,
        storage_path: upload.path,
        file_name: file.name,
        mime_type: file.type || 'application/octet-stream',
        size_bytes: file.size,
        customer_visible: true,
      });
    }
  }

  async function ticketDetail(id) {
    const data = await supportApi('ticket_detail', { id });
    const ticket = data.ticket;
    const messages = data.messages || [];
    const attachments = data.attachments || [];
    const timeEntries = data.time_entries || [];
    const usage = data.usage;
    const initialAttachments = attachments.filter((item) => !item.message_id);
    const attachmentsByMessage = attachments.reduce((map, item) => {
      if (!item.message_id) return map;
      (map[item.message_id] ||= []).push(item);
      return map;
    }, {});
    const now = new Date();
    const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

    content.innerHTML = `
      <button class="btn ghost" id="backTickets">← Back</button>
      <h1>${esc(ticket.reference)} — ${esc(ticket.subject)}</h1>
      <div class="grid">
        <div>
          <div class="panel">
            <div class="bubble">
              <strong>Original fault report</strong>
              <p>${esc(ticket.overview)}</p>
              ${initialAttachments.length ? `<div class="attachment-grid">${initialAttachments.map(attachmentHtml).join('')}</div>` : ''}
            </div>
            <div class="chat" style="margin-top:12px">${messages.map((message) => `
              <div class="bubble ${message.from_staff || message.profiles?.is_simworx ? 'staff' : ''}">
                <strong>${message.from_staff || message.profiles?.is_simworx ? 'Simworx Support' : esc(message.profiles?.full_name || 'Client')}</strong>
                ${message.body ? `<div>${esc(message.body)}</div>` : ''}
                ${(attachmentsByMessage[message.id] || []).length ? `<div class="attachment-grid">${attachmentsByMessage[message.id].map(attachmentHtml).join('')}</div>` : ''}
                <div class="muted">${new Date(message.created_at).toLocaleString()}</div>
              </div>`).join('')}</div>
            <form id="reply" class="stack" style="margin-top:14px">
              <textarea id="replyBody" placeholder="Reply to client…"></textarea>
              <label class="upload-box">Attach images, videos or documents
                <input id="replyFiles" type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,video/mp4,video/webm,video/quicktime,application/pdf,text/plain,application/zip">
              </label>
              <div id="replyFilesLabel" class="muted"></div>
              <button class="btn primary">SEND REPLY</button>
              <div id="replyStatus" class="muted"></div>
            </form>
          </div>
          <div class="panel">
            <h3>Recorded support time</h3>
            ${timeEntries.length ? timeEntries.map((entry) => `
              <div class="card" style="margin-top:8px">
                <div class="row" style="justify-content:space-between"><strong>${esc(entry.description)}</strong><span class="tag">${esc(entry.support_line.replace('_',' '))}</span></div>
                <div class="muted">${new Date(entry.occurred_at).toLocaleString()} · ${esc(entry.recorded_by_name || 'Simworx Support')}</div>
                <div style="margin-top:6px">Worked ${formatMinutes(entry.actual_minutes)} · Contract usage ${formatMinutes(entry.allowance_minutes_charged)}${Number(entry.charge_amount || 0) > 0 ? ` · Overage charge ${formatMoney(entry.charge_amount, ticket.support_contracts?.currency)}` : ''}</div>
              </div>`).join('') : '<p class="muted">No support time has been recorded yet.</p>'}
          </div>
        </div>
        <div>
          <div class="panel">
            <h3>Request details</h3>
            <label>Status<select id="ticketStatus">
              ${['open','acknowledged','diagnosing','waiting_customer','remote_session_required','awaiting_approval','escalated','in_progress','resolved','closed'].map((status) => `<option value="${status}" ${ticket.status === status ? 'selected' : ''}>${status.replaceAll('_',' ')}</option>`).join('')}
            </select></label>
            <p><strong>Customer:</strong><br>${esc(ticket.companies?.trading_name || ticket.companies?.legal_name)}</p>
            <p><strong>Simulator:</strong><br>${esc(ticket.projects?.name || '')}</p>
            <p><strong>Contract:</strong><br>${esc(ticket.support_contracts?.tier_name || ticket.support_contracts?.title || 'Not assigned')}</p>
            <p><strong>Response priority:</strong><br>${esc(ticket.support_contracts?.response_priority || 'Not specified')}</p>
            <p><strong>Priority:</strong> ${esc(ticket.priority)}</p>
          </div>
          <div class="panel"><h3>Current billing period</h3>${usageSummaryHtml(usage)}</div>
          <div class="panel">
            <h3>Log support time</h3>
            <p class="muted">Time is rounded up to ${usage?.billing_increment_minutes || ticket.support_contracts?.billing_increment_minutes || 15}-minute increments for contract usage and billing.</p>
            <form id="timeForm" class="stack">
              <div class="row"><label style="flex:1">Minutes worked<input id="timeMinutes" type="number" min="1" step="1" value="15" required></label><label style="flex:1">Support line<select id="timeLine"><option value="first_line">First line</option><option value="second_line">Second line</option></select></label></div>
              <label>Activity<select id="timeActivity"><option value="diagnosis">Diagnosis</option><option value="remote_session">Remote session</option><option value="telephone">Telephone</option><option value="email">Email / messages</option><option value="software_update">Software update</option><option value="other">Other</option></select></label>
              <label>Date and time<input id="timeOccurred" type="datetime-local" value="${localNow}" required></label>
              <label>Recorded by<input id="timeStaff" value="Simworx Support" required></label>
              <label>Description<textarea id="timeDescription" required>Support work</textarea></label>
              <button class="btn primary">LOG TIME</button>
              <div id="timeStatus" class="muted"></div>
            </form>
          </div>
        </div>
      </div>`;

    document.getElementById('backTickets').onclick = tickets;
    document.getElementById('ticketStatus').onchange = async (event) => {
      try {
        await api('ticket_status', { id, status: event.target.value });
        toast('Status updated');
      } catch (error) {
        toast(error.message, true);
      }
    };

    const filesInput = document.getElementById('replyFiles');
    filesInput.onchange = () => {
      document.getElementById('replyFilesLabel').textContent = Array.from(filesInput.files || []).map((file) => `${file.name} (${formatBytes(file.size)})`).join(' · ');
    };

    document.getElementById('reply').onsubmit = async (event) => {
      event.preventDefault();
      const body = document.getElementById('replyBody').value.trim();
      const files = Array.from(filesInput.files || []);
      const statusElement = document.getElementById('replyStatus');
      if (!body && !files.length) {
        statusElement.textContent = 'Enter a message or attach a file.';
        return;
      }
      try {
        statusElement.textContent = 'Sending…';
        const message = await supportApi('staff_reply', { ticket_id: ticket.id, body, allow_empty: files.length > 0 });
        await uploadStaffFiles(ticket, files, message.id, statusElement);
        toast('Reply sent');
        await ticketDetail(id);
      } catch (error) {
        statusElement.textContent = error.message;
      }
    };

    document.getElementById('timeForm').onsubmit = async (event) => {
      event.preventDefault();
      const statusElement = document.getElementById('timeStatus');
      try {
        statusElement.textContent = 'Recording time…';
        const occurredLocal = document.getElementById('timeOccurred').value;
        await supportApi('log_time', {
          ticket_id: ticket.id,
          actual_minutes: Number(document.getElementById('timeMinutes').value),
          support_line: document.getElementById('timeLine').value,
          activity_type: document.getElementById('timeActivity').value,
          occurred_at: occurredLocal ? new Date(occurredLocal).toISOString() : new Date().toISOString(),
          recorded_by_name: document.getElementById('timeStaff').value.trim(),
          description: document.getElementById('timeDescription').value.trim(),
          customer_visible: true,
        });
        toast('Support time recorded');
        await ticketDetail(id);
      } catch (error) {
        statusElement.textContent = error.message;
      }
    };
  }


  async function customers() {
    const { data: companies = [] } = await api('customers');
    content.innerHTML = `
      <h1>Customers & Access</h1>
      <div class="grid">
        <div class="panel">
          <h3>Create customer</h3>
          <form id="companyForm" class="stack">
            <input id="coName" placeholder="Company name" required>
            <input id="coCode" placeholder="Code e.g. JETPRO" required>
            <input id="coCountry" placeholder="Country">
            <button class="btn primary">CREATE CUSTOMER</button>
          </form>
        </div>
        <div class="panel">
          <h3>Invite client</h3>
          <form id="inviteForm" class="stack">
            <select id="inviteCompany" required><option value="">Select customer…</option>${companies.map((company) => `<option value="${company.id}">${esc(company.trading_name || company.legal_name)}</option>`).join('')}</select>
            <input id="inviteName" placeholder="Contact name">
            <input id="inviteEmail" type="email" placeholder="Email" required>
            <label><input id="canSupport" type="checkbox" checked style="width:auto"> Support access</label>
            <label><input id="canBuild" type="checkbox" checked style="width:auto"> Build Update access</label>
            <button class="btn primary">SEND INVITE</button>
          </form>
        </div>
      </div>
      <div class="panel">
        <table class="table">
          <thead><tr><th>Company</th><th>Country</th><th>Email</th><th>Active</th><th></th></tr></thead>
          <tbody>${companies.map((company) => `
            <tr>
              <td>${esc(company.trading_name || company.legal_name)}</td>
              <td>${esc(company.country || '')}</td>
              <td>${esc(company.general_email || '')}</td>
              <td>${company.active ? 'Yes' : 'No'}</td>
              <td><div class="row">
                <button class="btn ghost" data-edit-company="${company.id}">Edit</button>
                <button class="btn ghost" data-sims-company="${company.id}">Simulators</button>
                <button class="btn ghost" data-contracts-company="${company.id}">Contracts</button>
              </div></td>
            </tr>`).join('')}</tbody>
        </table>
      </div>`;

    document.getElementById('companyForm').onsubmit = async (event) => {
      event.preventDefault();
      try {
        await api('create_customer', {
          name: document.getElementById('coName').value.trim(),
          code: document.getElementById('coCode').value.trim().toUpperCase(),
          country: document.getElementById('coCountry').value.trim(),
        });
        toast('Customer created');
        await customers();
      } catch (error) {
        toast(error.message, true);
      }
    };

    document.getElementById('inviteForm').onsubmit = async (event) => {
      event.preventDefault();
      try {
        const result = await api('invite_client', {
          company_id: document.getElementById('inviteCompany').value,
          email: document.getElementById('inviteEmail').value.trim(),
          full_name: document.getElementById('inviteName').value.trim(),
          can_support: document.getElementById('canSupport').checked,
          can_build_updates: document.getElementById('canBuild').checked,
        });
        toast(result.kind === 'existing_account' ? 'Existing client access updated — no new email sent' : 'Client invitation sent');
      } catch (error) {
        toast(error.message, true);
      }
    };

    document.querySelectorAll('[data-edit-company]').forEach((button) => button.onclick = () => editCustomer(companies.find((company) => company.id === button.dataset.editCompany)));
    document.querySelectorAll('[data-sims-company]').forEach((button) => button.onclick = () => manageSimulators(companies.find((company) => company.id === button.dataset.simsCompany)));
    document.querySelectorAll('[data-contracts-company]').forEach((button) => button.onclick = () => {
      contractCompanyFilter = button.dataset.contractsCompany;
      document.querySelectorAll('#nav button').forEach((item) => item.classList.toggle('active', item.dataset.view === 'contracts'));
      view = 'contracts';
      contracts();
    });
  }

  async function editCustomer(company) {
    if (!company) return;
    content.innerHTML = `
      <button id="backCustomers" class="btn ghost">← Back</button><h1>Edit Customer</h1>
      <div class="panel"><form id="editCustomerForm" class="stack">
        <label>Legal name<input id="ecLegal" value="${esc(company.legal_name || '')}" required></label>
        <label>Trading name<input id="ecTrading" value="${esc(company.trading_name || '')}"></label>
        <label>Customer code<input id="ecCode" value="${esc(company.code || '')}" required></label>
        <label>Country<input id="ecCountry" value="${esc(company.country || '')}"></label>
        <label>General email<input id="ecEmail" type="email" value="${esc(company.general_email || '')}"></label>
        <label>Phone<input id="ecPhone" value="${esc(company.phone || '')}"></label>
        <label>Commercial contact<input id="ecCommercialName" value="${esc(company.commercial_contact_name || '')}"></label>
        <label>Commercial contact email<input id="ecCommercialEmail" type="email" value="${esc(company.commercial_contact_email || '')}"></label>
        <label>Technical contact<input id="ecTechnicalName" value="${esc(company.technical_contact_name || '')}"></label>
        <label>Technical contact email<input id="ecTechnicalEmail" type="email" value="${esc(company.technical_contact_email || '')}"></label>
        <label>Notes<textarea id="ecNotes">${esc(company.notes || '')}</textarea></label>
        <label><input id="ecActive" type="checkbox" ${company.active ? 'checked' : ''} style="width:auto"> Active customer</label>
        <button class="btn primary">SAVE CHANGES</button>
      </form></div>`;

    document.getElementById('backCustomers').onclick = customers;
    document.getElementById('editCustomerForm').onsubmit = async (event) => {
      event.preventDefault();
      try {
        await api('update_customer', {
          id: company.id,
          legal_name: document.getElementById('ecLegal').value.trim(),
          trading_name: document.getElementById('ecTrading').value.trim(),
          code: document.getElementById('ecCode').value.trim().toUpperCase(),
          country: document.getElementById('ecCountry').value.trim(),
          general_email: document.getElementById('ecEmail').value.trim(),
          phone: document.getElementById('ecPhone').value.trim(),
          commercial_contact_name: document.getElementById('ecCommercialName').value.trim(),
          commercial_contact_email: document.getElementById('ecCommercialEmail').value.trim(),
          technical_contact_name: document.getElementById('ecTechnicalName').value.trim(),
          technical_contact_email: document.getElementById('ecTechnicalEmail').value.trim(),
          notes: document.getElementById('ecNotes').value.trim(),
          active: document.getElementById('ecActive').checked,
        });
        toast('Customer updated');
        await customers();
      } catch (error) {
        toast(error.message, true);
      }
    };
  }

  async function manageSimulators(company) {
    if (!company) return;
    const result = await api('projects_by_company', { company_id: company.id });
    const simulators = result.data || [];
    content.innerHTML = `
      <button id="backCustomers" class="btn ghost">← Back</button><h1>Simulators — ${esc(company.trading_name || company.legal_name)}</h1>
      <div class="grid">
        <div class="panel"><h3>Add simulator</h3><form id="simForm" class="stack">
          <label>Simulator / project name<input id="simName" placeholder="e.g. Diamond DA62 Simulator" required></label>
          <label>Project code<input id="simCode" placeholder="e.g. DA62-001" required></label>
          <label>Simulator model<input id="simModel" placeholder="e.g. Diamond DA62"></label>
          <label>Serial number<input id="simSerial"></label>
          <label>Location<input id="simLocation"></label>
          <label>Warranty status<input id="simWarranty"></label>
          <label>Notes<textarea id="simNotes"></textarea></label>
          <button class="btn primary">ADD SIMULATOR</button>
        </form></div>
        <div class="panel"><h3>Assigned simulators</h3><div class="stack">${simulators.length ? simulators.map((simulator) => `
          <div class="card"><strong>${esc(simulator.name)}</strong><div class="muted">${esc(simulator.simulator_model || '')}${simulator.serial_number ? ` · S/N ${esc(simulator.serial_number)}` : ''}</div><div class="muted">${esc(simulator.location || '')}</div><div class="row" style="margin-top:10px"><span class="tag">${simulator.active ? 'Active' : 'Inactive'}</span><button class="btn ghost" data-edit-sim="${simulator.id}">Edit</button></div></div>`).join('') : '<p class="muted">No simulators assigned to this customer yet.</p>'}</div></div>
      </div>`;

    document.getElementById('backCustomers').onclick = customers;
    document.getElementById('simForm').onsubmit = async (event) => {
      event.preventDefault();
      try {
        await api('create_project', {
          company_id: company.id,
          name: document.getElementById('simName').value.trim(),
          code: document.getElementById('simCode').value.trim().toUpperCase(),
          simulator_model: document.getElementById('simModel').value.trim(),
          serial_number: document.getElementById('simSerial').value.trim(),
          location: document.getElementById('simLocation').value.trim(),
          warranty_status: document.getElementById('simWarranty').value.trim(),
          notes: document.getElementById('simNotes').value.trim(),
          active: true,
        });
        toast('Simulator added');
        await manageSimulators(company);
      } catch (error) {
        toast(error.message, true);
      }
    };
    document.querySelectorAll('[data-edit-sim]').forEach((button) => button.onclick = () => editSimulator(company, simulators.find((simulator) => simulator.id === button.dataset.editSim)));
  }

  async function editSimulator(company, simulator) {
    if (!simulator) return;
    content.innerHTML = `
      <button id="backSims" class="btn ghost">← Back</button><h1>Edit Simulator</h1>
      <div class="panel"><form id="editSimForm" class="stack">
        <label>Simulator / project name<input id="esName" value="${esc(simulator.name || '')}" required></label>
        <label>Project code<input id="esCode" value="${esc(simulator.code || '')}" required></label>
        <label>Simulator model<input id="esModel" value="${esc(simulator.simulator_model || '')}"></label>
        <label>Serial number<input id="esSerial" value="${esc(simulator.serial_number || '')}"></label>
        <label>Location<input id="esLocation" value="${esc(simulator.location || '')}"></label>
        <label>Warranty status<input id="esWarranty" value="${esc(simulator.warranty_status || '')}"></label>
        <label>Notes<textarea id="esNotes">${esc(simulator.notes || '')}</textarea></label>
        <label><input id="esActive" type="checkbox" ${simulator.active ? 'checked' : ''} style="width:auto"> Active simulator</label>
        <button class="btn primary">SAVE SIMULATOR</button>
      </form></div>`;
    document.getElementById('backSims').onclick = () => manageSimulators(company);
    document.getElementById('editSimForm').onsubmit = async (event) => {
      event.preventDefault();
      try {
        await api('update_project', {
          id: simulator.id,
          name: document.getElementById('esName').value.trim(),
          code: document.getElementById('esCode').value.trim().toUpperCase(),
          simulator_model: document.getElementById('esModel').value.trim(),
          serial_number: document.getElementById('esSerial').value.trim(),
          location: document.getElementById('esLocation').value.trim(),
          warranty_status: document.getElementById('esWarranty').value.trim(),
          notes: document.getElementById('esNotes').value.trim(),
          active: document.getElementById('esActive').checked,
        });
        toast('Simulator updated');
        await manageSimulators(company);
      } catch (error) {
        toast(error.message, true);
      }
    };
  }

  async function contracts(editId = null) {
    const data = await supportApi('list_contracts');
    const companies = (data.companies || []).filter((company) => company.active);
    const projects = (data.projects || []).filter((project) => project.active);
    const contractList = data.contracts || [];
    const links = data.links || [];
    const usageByContract = new Map((data.usage || []).filter(Boolean).map((item) => [item.contract_id, item]));
    const editing = editId ? contractList.find((contract) => contract.id === editId) : null;
    const selectedCompany = editing?.company_id || contractCompanyFilter || companies[0]?.id || '';
    const selectedProjects = new Set(editing ? links.filter((link) => link.contract_id === editing.id).map((link) => link.project_id) : []);
    const initialPreset = editing ? null : TIER_PRESETS.Basic;
    const selectedTier = editing?.tier_name || initialPreset?.tier || 'Basic';
    const tierOptions = Object.keys(TIER_PRESETS);
    if (selectedTier && !tierOptions.includes(selectedTier)) tierOptions.push(selectedTier);

    content.innerHTML = `
      <h1>Support Contracts</h1>
      <div class="notice"><strong>Choose Basic, Standard, Premium or Pay As You Go to fill the published DA62 support values.</strong><br>Every populated field remains editable before saving. Published support time is calculated in 15-minute increments and unused hours do not roll over.</div>
      <div class="grid">
        <div class="panel"><h3>${editing ? 'Edit contract' : 'Create support contract'}</h3><form id="contractForm" class="stack">
          <input id="contractId" type="hidden" value="${editing?.id || ''}">
          <label>Customer<select id="contractCompany" required>${companies.map((company) => `<option value="${company.id}" ${company.id === selectedCompany ? 'selected' : ''}>${esc(company.trading_name || company.legal_name)}</option>`).join('')}</select></label>
          <label>Support level<select id="contractTier" required>${tierOptions.map((tier) => `<option value="${esc(tier)}" ${tier === selectedTier ? 'selected' : ''}>${esc(tier)}</option>`).join('')}</select></label>
          <button id="applyTierDefaults" type="button" class="btn ghost">APPLY LEVEL DEFAULTS</button>
          <label>Contract title<input id="contractTitle" value="${esc(editing?.title || initialPreset?.title || '')}" required></label>
          <label>Response priority<input id="contractResponse" value="${esc(editing?.response_priority || initialPreset?.responsePriority || '')}"></label>
          <div class="row"><label style="flex:1">Status<select id="contractStatus"><option value="draft" ${editing?.status === 'draft' ? 'selected' : ''}>Draft</option><option value="active" ${!editing || editing.status === 'active' ? 'selected' : ''}>Active</option><option value="expired" ${editing?.status === 'expired' ? 'selected' : ''}>Expired</option><option value="cancelled" ${editing?.status === 'cancelled' ? 'selected' : ''}>Cancelled</option></select></label><label style="flex:1">Currency<input id="contractCurrency" value="${esc(editing?.currency || 'EUR')}"></label></div>
          <div class="row"><label style="flex:1">Starts on<input id="contractStart" type="date" value="${editing?.starts_on || new Date().toISOString().slice(0,10)}" required></label><label style="flex:1">Ends on<input id="contractEnd" type="date" value="${editing?.ends_on || ''}"></label></div>
          <div class="row"><label style="flex:1">Included hours/month<input id="contractHours" type="number" min="0" step="0.25" value="${editing ? Number(editing.included_minutes || 0) / 60 : initialPreset.includedHours}"></label><label style="flex:1">Monthly fee<input id="contractFee" type="number" min="0" step="0.01" value="${editing?.monthly_fee ?? initialPreset.monthlyFee}"></label></div>
          <div class="row"><label style="flex:1">Excess rate/hour<input id="contractFirstRate" type="number" min="0" step="0.01" value="${editing?.first_line_rate ?? initialPreset.excessRate}"></label><label style="flex:1">Second-line excess rate/hour<input id="contractSecondRate" type="number" min="0" step="0.01" value="${editing?.second_line_rate ?? initialPreset.excessRate}"></label></div>
          <div class="row"><label style="flex:1">Billing increment (minutes)<input id="contractIncrement" type="number" min="1" max="240" step="1" value="${editing?.billing_increment_minutes || initialPreset.billingIncrement}"></label><label style="flex:1">Billing day<input id="contractBillingDay" type="number" min="1" max="28" step="1" value="${editing?.billing_anchor_day || 1}"></label></div>
          <label>Support operating hours<input id="contractSupportHours" value="${esc(editing?.support_hours || '')}" placeholder="Not defined in the tier summary — enter the agreed hours"></label>
          <label>Included services<textarea id="contractServices">${esc(editing?.included_services || initialPreset.includedServices)}</textarea></label>
          <label>Warranty notes<textarea id="contractWarranty">${esc(editing?.warranty_notes || DEFAULT_WARRANTY_NOTES)}</textarea></label>
          <label>Notes<textarea id="contractNotes">${esc(editing?.notes || '')}</textarea></label>
          <label>Covered simulators<div id="projectChecks" class="check-list"></div></label>
          <label><input id="contractRollover" type="checkbox" ${editing?.rollover_enabled ? 'checked' : ''} style="width:auto"> Allow unused support hours to roll over</label>
          <label><input id="contractApproval" type="checkbox" ${editing?.overage_requires_approval ? 'checked' : ''} style="width:auto"> Overage requires customer approval before time is logged</label>
          <button class="btn primary">${editing ? 'SAVE CONTRACT' : 'CREATE CONTRACT'}</button>
          ${editing ? '<button id="cancelContractEdit" type="button" class="btn ghost">CANCEL EDITING</button>' : ''}
        </form></div>
        <div class="panel"><h3>Existing contracts</h3><div class="stack">${contractList.length ? contractList.map((contract) => {
          const company = companies.find((item) => item.id === contract.company_id);
          const coveredNames = links.filter((link) => link.contract_id === contract.id).map((link) => projects.find((project) => project.id === link.project_id)?.name).filter(Boolean);
          const usage = usageByContract.get(contract.id);
          return `<div class="card"><div class="row" style="justify-content:space-between"><strong>${esc(contract.title)}</strong><span class="tag">${esc(contract.status)}</span></div><div class="muted">${esc(company?.trading_name || company?.legal_name || '')} · ${esc(contract.tier_name)} · ${esc(contract.response_priority || 'Priority not specified')}</div><div class="muted">${coveredNames.map(esc).join(', ') || 'No simulators assigned'}</div><div style="margin-top:12px">${usageSummaryHtml(usage)}</div><div class="row" style="margin-top:10px"><button class="btn ghost" data-edit-contract="${contract.id}">Edit</button></div></div>`;
        }).join('') : '<p class="muted">No support contracts have been created.</p>'}</div></div>
      </div>`;

    const companySelect = document.getElementById('contractCompany');
    const renderProjectChecks = () => {
      const companyProjects = projects.filter((project) => project.company_id === companySelect.value);
      document.getElementById('projectChecks').innerHTML = companyProjects.length ? companyProjects.map((project) => `<label><input type="checkbox" name="coveredProject" value="${project.id}" ${selectedProjects.has(project.id) ? 'checked' : ''}> ${esc(project.name)}${project.serial_number ? ` · S/N ${esc(project.serial_number)}` : ''}</label>`).join('') : '<span class="muted">This customer has no active simulators. Add a simulator first.</span>';
    };
    renderProjectChecks();
    companySelect.onchange = () => {
      selectedProjects.clear();
      renderProjectChecks();
    };

    const applyPreset = () => {
      const preset = TIER_PRESETS[document.getElementById('contractTier').value.trim()];
      if (!preset) {
        toast('Type Basic, Standard, Premium or Pay As You Go to apply published defaults.', true);
        return;
      }
      document.getElementById('contractTitle').value = preset.title;
      document.getElementById('contractResponse').value = preset.responsePriority;
      document.getElementById('contractHours').value = preset.includedHours;
      document.getElementById('contractFee').value = preset.monthlyFee;
      document.getElementById('contractFirstRate').value = preset.excessRate;
      document.getElementById('contractSecondRate').value = preset.excessRate;
      document.getElementById('contractIncrement').value = preset.billingIncrement;
      document.getElementById('contractServices').value = preset.includedServices;
      document.getElementById('contractRollover').checked = false;
      document.getElementById('contractApproval').checked = false;
      toast(`${preset.tier} defaults applied — every field can still be edited.`);
    };
    document.getElementById('applyTierDefaults').onclick = applyPreset;
    document.getElementById('contractTier').onchange = () => {
      if (TIER_PRESETS[document.getElementById('contractTier').value.trim()]) applyPreset();
    };

    document.getElementById('contractForm').onsubmit = async (event) => {
      event.preventDefault();
      const projectIds = Array.from(document.querySelectorAll('input[name="coveredProject"]:checked')).map((input) => input.value);
      try {
        await supportApi('save_contract', {
          id: document.getElementById('contractId').value || null,
          company_id: companySelect.value,
          project_ids: projectIds,
          title: document.getElementById('contractTitle').value.trim(),
          tier_name: document.getElementById('contractTier').value.trim(),
          response_priority: document.getElementById('contractResponse').value.trim(),
          status: document.getElementById('contractStatus').value,
          starts_on: document.getElementById('contractStart').value,
          ends_on: document.getElementById('contractEnd').value || null,
          monthly_fee: document.getElementById('contractFee').value,
          included_minutes: Math.round(Number(document.getElementById('contractHours').value || 0) * 60),
          first_line_rate: document.getElementById('contractFirstRate').value,
          second_line_rate: document.getElementById('contractSecondRate').value,
          currency: document.getElementById('contractCurrency').value,
          billing_increment_minutes: document.getElementById('contractIncrement').value,
          billing_anchor_day: document.getElementById('contractBillingDay').value,
          support_hours: document.getElementById('contractSupportHours').value.trim(),
          included_services: document.getElementById('contractServices').value.trim(),
          warranty_notes: document.getElementById('contractWarranty').value.trim(),
          notes: document.getElementById('contractNotes').value.trim(),
          rollover_enabled: document.getElementById('contractRollover').checked,
          overage_requires_approval: document.getElementById('contractApproval').checked,
        });
        toast(editing ? 'Contract updated' : 'Contract created');
        contractCompanyFilter = companySelect.value;
        await contracts();
      } catch (error) {
        toast(error.message, true);
      }
    };

    if (editing) document.getElementById('cancelContractEdit').onclick = () => contracts();
    document.querySelectorAll('[data-edit-contract]').forEach((button) => button.onclick = () => contracts(button.dataset.editContract));
  }


  async function builds() {
    const data = await api('builds');
    const companies = data.companies || [];
    const buildList = data.builds || [];
    content.innerHTML = `
      <h1>Build Updates</h1>
      <div class="grid">
        <div class="panel"><h3>Create build</h3><form id="buildForm" class="stack">
          <select id="buildCompany" required><option value="">Customer…</option>${companies.map((company) => `<option value="${company.id}">${esc(company.trading_name || company.legal_name)}</option>`).join('')}</select>
          <input id="buildTitle" placeholder="Build title e.g. DA62 Simulator #2" required>
          <input id="buildNo" placeholder="Build number">
          <input id="buildStage" placeholder="Current stage">
          <input id="buildProgress" type="number" min="0" max="100" value="0">
          <button class="btn primary">CREATE BUILD</button>
        </form></div>
        <div class="panel"><h3>Existing builds</h3><div class="stack">${buildList.map((buildItem) => `<button class="btn ghost" data-build="${buildItem.id}" style="text-align:left"><strong>${esc(buildItem.title)}</strong><br><span class="muted">${esc(buildItem.companies?.trading_name || buildItem.companies?.legal_name)} · ${buildItem.progress_percent}% · ${esc(buildItem.status)}</span></button>`).join('')}</div></div>
      </div>`;

    document.getElementById('buildForm').onsubmit = async (event) => {
      event.preventDefault();
      try {
        await api('create_build', {
          company_id: document.getElementById('buildCompany').value,
          title: document.getElementById('buildTitle').value,
          build_number: document.getElementById('buildNo').value,
          current_stage: document.getElementById('buildStage').value,
          progress_percent: Number(document.getElementById('buildProgress').value),
        });
        toast('Build created');
        await builds();
      } catch (error) {
        toast(error.message, true);
      }
    };
    document.querySelectorAll('[data-build]').forEach((button) => button.onclick = () => buildDetail(button.dataset.build));
  }

  async function buildDetail(id) {
    const data = await api('build_detail', { id });
    const buildData = data.build;
    const milestones = data.milestones || [];
    const updates = data.updates || [];
    const issues = data.issues || [];
    content.innerHTML = `
      <button id="backBuilds" class="btn ghost">← Back</button><h1>${esc(buildData.title)}</h1>
      <div class="cards"><div class="card">Progress<strong class="big">${buildData.progress_percent}%</strong></div><div class="card">Stage<strong class="big" style="font-size:18px">${esc(buildData.current_stage || '—')}</strong></div><div class="card">Status<strong class="big" style="font-size:18px">${esc(buildData.status)}</strong></div><div class="card">Customer<strong class="big" style="font-size:18px">${esc(buildData.companies?.trading_name || buildData.companies?.legal_name)}</strong></div></div>
      <div class="grid"><div><div class="panel"><h3>Publish update</h3><form id="updateForm" class="stack"><input id="upTitle" placeholder="Update title" required><textarea id="upBody" placeholder="What changed this week?" required></textarea><input id="upProgress" type="number" min="0" max="100" placeholder="New progress %"><button class="btn primary">PUBLISH UPDATE</button></form></div><div class="panel"><h3>Updates</h3>${updates.map((update) => `<div style="margin-bottom:14px"><strong>${esc(update.title)}</strong><p>${esc(update.body)}</p><span class="muted">${new Date(update.created_at).toLocaleString()}</span></div>`).join('')}</div></div><div><div class="panel"><h3>Add milestone</h3><form id="mileForm" class="stack"><input id="mileTitle" placeholder="Milestone" required><input id="mileDate" type="date"><button class="btn dark">ADD MILESTONE</button></form><div style="margin-top:12px">${milestones.map((milestone) => `<div class="row" style="justify-content:space-between;margin:7px 0"><span>${esc(milestone.title)}</span><span class="tag">${esc(milestone.status)}</span></div>`).join('')}</div></div><div class="panel"><h3>Build issue</h3><form id="issueForm" class="stack"><input id="issueTitle" placeholder="Issue title" required><textarea id="issueDesc" placeholder="Describe issue"></textarea><select id="issueSeverity"><option>normal</option><option>low</option><option>high</option><option>critical</option></select><button class="btn dark">LOG ISSUE</button></form><div style="margin-top:12px">${issues.map((issue) => `<div style="margin:9px 0"><strong>${esc(issue.title)}</strong> <span class="tag gold">${esc(issue.status)}</span><div class="muted">${esc(issue.description || '')}</div></div>`).join('')}</div></div></div></div>`;

    document.getElementById('backBuilds').onclick = builds;
    document.getElementById('updateForm').onsubmit = async (event) => {
      event.preventDefault();
      try {
        const progress = document.getElementById('upProgress').value;
        await api('create_update', { build_id: id, company_id: buildData.company_id, title: document.getElementById('upTitle').value, body: document.getElementById('upBody').value, progress_percent: progress === '' ? null : Number(progress) });
        toast('Build update published');
        await buildDetail(id);
      } catch (error) { toast(error.message, true); }
    };
    document.getElementById('mileForm').onsubmit = async (event) => {
      event.preventDefault();
      try {
        await api('create_milestone', { build_id: id, company_id: buildData.company_id, title: document.getElementById('mileTitle').value, target_date: document.getElementById('mileDate').value || null });
        toast('Milestone added');
        await buildDetail(id);
      } catch (error) { toast(error.message, true); }
    };
    document.getElementById('issueForm').onsubmit = async (event) => {
      event.preventDefault();
      try {
        await api('create_issue', { build_id: id, company_id: buildData.company_id, title: document.getElementById('issueTitle').value, description: document.getElementById('issueDesc').value, severity: document.getElementById('issueSeverity').value });
        toast('Issue logged');
        await buildDetail(id);
      } catch (error) { toast(error.message, true); }
    };
  }

  if (pin) unlock();
})();
