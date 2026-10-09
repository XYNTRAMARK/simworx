from pathlib import Path
import re

ADMIN = Path('admin/admin.js')
PORTAL = Path('portal/portal.js')


def replace_between(text: str, start_pattern: str, next_pattern: str, replacement: str, label: str) -> str:
    pattern = re.compile(start_pattern + r'.*?(?=' + next_pattern + r')', re.S)
    updated, count = pattern.subn(replacement.rstrip() + '\n\n', text, count=1)
    if count != 1:
        raise RuntimeError(f'Could not replace {label}; matches={count}')
    return updated


admin = ADMIN.read_text(encoding='utf-8')
portal = PORTAL.read_text(encoding='utf-8')

admin_marker = "  let contractCompanyFilter = '';\n"
admin_helpers = r'''

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
'''
if 'const TIER_PRESETS = Object.freeze' not in admin:
    if admin_marker not in admin:
        raise RuntimeError('Admin helper insertion marker not found')
    admin = admin.replace(admin_marker, admin_marker + admin_helpers, 1)

admin_ticket_detail = r'''  async function ticketDetail(id) {
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
  }'''
admin = replace_between(
    admin,
    r'  async function ticketDetail\(id\) \{',
    r'\n  async function customers\(\)',
    admin_ticket_detail,
    'admin ticketDetail',
)

admin_contracts = r'''  async function contracts(editId = null) {
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

    content.innerHTML = `
      <h1>Support Contracts</h1>
      <div class="notice"><strong>Choose Basic, Standard, Premium or Pay As You Go to fill the published DA62 support values.</strong><br>Every populated field remains editable before saving. Published support time is calculated in 15-minute increments and unused hours do not roll over.</div>
      <div class="grid">
        <div class="panel"><h3>${editing ? 'Edit contract' : 'Create support contract'}</h3><form id="contractForm" class="stack">
          <input id="contractId" type="hidden" value="${editing?.id || ''}">
          <label>Customer<select id="contractCompany" required>${companies.map((company) => `<option value="${company.id}" ${company.id === selectedCompany ? 'selected' : ''}>${esc(company.trading_name || company.legal_name)}</option>`).join('')}</select></label>
          <label>Support level<input id="contractTier" list="supportTierOptions" value="${esc(editing?.tier_name || initialPreset?.tier || 'Basic')}" required><datalist id="supportTierOptions"><option value="Basic"><option value="Standard"><option value="Premium"><option value="Pay As You Go"></datalist></label>
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
  }'''
admin = replace_between(
    admin,
    r'  async function contracts\(editId = null\) \{',
    r'\n  async function builds\(\)',
    admin_contracts,
    'admin contracts',
)

portal_marker = "  const currentCompanyIds = (supportOnly = false) => companyLinks\n"
portal_helpers = r'''  const formatMinutes = (minutes) => {
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

  async function loadUsageMap(contractIds) {
    const entries = await Promise.all([...new Set(contractIds.filter(Boolean))].map(async (contractId) => {
      const { data, error } = await sb.rpc('support_contract_usage', { p_contract: contractId, p_when: new Date().toISOString() });
      if (error) return [contractId, null];
      return [contractId, Array.isArray(data) ? data[0] || null : data];
    }));
    return new Map(entries);
  }

  const usageCardHtml = (usage) => {
    if (!usage) return '<p class="muted">Usage is not available yet.</p>';
    const included = Number(usage.included_minutes || 0);
    const used = Number(usage.used_minutes || 0);
    const progress = included > 0 ? Math.min(100, Math.round((used / included) * 100)) : (used > 0 ? 100 : 0);
    return `
      <div>
        <div style="display:flex;justify-content:space-between;gap:12px"><strong>${formatMinutes(used)} used</strong><span>${included ? `${formatMinutes(included)} included` : 'Pay as you go'}</span></div>
        <div style="height:8px;background:#e8ecef;border-radius:9px;overflow:hidden;margin:8px 0"><div style="height:100%;width:${progress}%;background:${Number(usage.overage_minutes || 0) > 0 ? '#b83b3b' : '#f2a900'}"></div></div>
        <div class="muted">Remaining ${formatMinutes(usage.remaining_minutes)} · Overage ${formatMinutes(usage.overage_minutes)}</div>
        <p><strong>Estimated bill if the period ended now: ${formatMoney(usage.estimated_total, usage.currency)}</strong><br><span class="muted">Monthly fee ${formatMoney(usage.monthly_fee, usage.currency)} + overage ${formatMoney(usage.overage_amount, usage.currency)}</span></p>
      </div>`;
  };

'''
if 'async function loadUsageMap' not in portal:
    if portal_marker not in portal:
        raise RuntimeError('Portal helper insertion marker not found')
    portal = portal.replace(portal_marker, portal_helpers + portal_marker, 1)

portal_dashboard = r'''  async function dashboard() {
    const companyIds = currentCompanyIds(true);
    const [ticketsResult, buildsResult, contractsResult] = await Promise.all([
      linkSupport()
        ? sb.from('tickets').select('id,status,reference,subject').order('created_at', { ascending: false }).limit(5)
        : Promise.resolve({ data: [] }),
      linkBuild()
        ? sb.from('builds').select('id,title,status,progress_percent,current_stage').order('created_at', { ascending: false })
        : Promise.resolve({ data: [] }),
      linkSupport()
        ? sb.from('support_contracts').select('id,title,tier_name,response_priority,status,starts_on,ends_on').in('company_id', companyIds).eq('status', 'active')
        : Promise.resolve({ data: [] }),
    ]);
    const error = ticketsResult.error || buildsResult.error || contractsResult.error;
    if (error) throw error;

    const tickets = ticketsResult.data || [];
    const activeBuilds = (buildsResult.data || []).filter((item) => item.status !== 'complete');
    const today = new Date().toISOString().slice(0, 10);
    const contracts = (contractsResult.data || []).filter((contract) => contract.starts_on <= today && (!contract.ends_on || contract.ends_on >= today));
    const usageMap = await loadUsageMap(contracts.map((contract) => contract.id));

    content.innerHTML = `
      <h1>Welcome</h1>
      <div class="cards">
        <div class="card">Open support requests<strong class="big">${tickets.filter((item) => !['resolved', 'closed'].includes(item.status)).length}</strong></div>
        <div class="card">Active builds<strong class="big">${activeBuilds.length}</strong></div>
        <div class="card">Account<strong class="big" style="font-size:18px">${esc(companyLinks[0]?.companies?.trading_name || companyLinks[0]?.companies?.legal_name)}</strong></div>
      </div>
      ${contracts.map((contract) => `<div class="panel"><div style="display:flex;justify-content:space-between;gap:12px"><div><h3 style="margin:0">${esc(contract.tier_name)} — ${esc(contract.title)}</h3><p class="muted">Response priority: ${esc(contract.response_priority || 'Not specified')}</p></div></div>${usageCardHtml(usageMap.get(contract.id))}</div>`).join('')}
      ${activeBuilds[0] ? `<div class="panel"><h3>Latest build</h3><strong>${esc(activeBuilds[0].title)}</strong><p>${activeBuilds[0].progress_percent}% complete · ${esc(activeBuilds[0].current_stage || activeBuilds[0].status)}</p></div>` : ''}`;
  }'''
portal = replace_between(
    portal,
    r'  async function dashboard\(\) \{',
    r'\n  async function loadTicketAttachments\(',
    portal_dashboard,
    'portal dashboard',
)

portal_ticket = r'''  async function ticket(id) {
    const [ticketResult, messagesResult, attachments] = await Promise.all([
      sb.from('tickets').select('*,projects(name),support_contracts(*)').eq('id', id).single(),
      sb.from('ticket_messages').select('*,profiles(full_name,is_simworx)').eq('ticket_id', id).order('created_at'),
      loadTicketAttachments(id),
    ]);
    if (ticketResult.error) throw ticketResult.error;
    if (messagesResult.error) throw messagesResult.error;

    const ticketData = ticketResult.data;
    const messages = messagesResult.data || [];
    const usageMap = await loadUsageMap([ticketData.contract_id]);
    const usage = usageMap.get(ticketData.contract_id);
    const initialAttachments = attachments.filter((item) => !item.message_id);
    const attachmentsByMessage = attachments.reduce((map, item) => {
      if (!item.message_id) return map;
      (map[item.message_id] ||= []).push(item);
      return map;
    }, {});

    content.innerHTML = `
      <button id="back" class="btn ghost">← Back</button>
      <h1>${esc(ticketData.reference)} — ${esc(ticketData.subject)}</h1>
      <div class="grid">
        <div class="panel">
          <div class="comment">
            <strong>${esc(ticketData.projects?.name || 'Simulator fault')}</strong>
            <p>${esc(ticketData.overview)}</p>
            ${initialAttachments.length ? `<div class="attachment-grid">${initialAttachments.map(attachmentHtml).join('')}</div>` : ''}
          </div>
          ${messages.map((message) => `
            <div class="comment" style="${message.from_staff || message.profiles?.is_simworx ? 'background:#fff4d7' : ''}">
              <strong>${message.from_staff || message.profiles?.is_simworx ? 'Simworx Support' : esc(message.profiles?.full_name || 'Client')}</strong>
              ${message.body ? `<div>${esc(message.body)}</div>` : ''}
              ${(attachmentsByMessage[message.id] || []).length ? `<div class="attachment-grid">${attachmentsByMessage[message.id].map(attachmentHtml).join('')}</div>` : ''}
              <div class="muted">${new Date(message.created_at).toLocaleString()}</div>
            </div>`).join('')}
          <form id="reply" class="stack" style="margin-top:12px">
            <textarea id="replyBody" placeholder="Reply to Simworx…"></textarea>
            <label class="upload-box">Attach images, videos or documents
              <input id="replyFiles" type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,video/mp4,video/webm,video/quicktime,application/pdf,text/plain,application/zip">
            </label>
            <div id="replyFileList" class="muted"></div>
            <button class="btn primary">SEND MESSAGE</button>
            <div id="replyStatus" class="muted"></div>
          </form>
        </div>
        <div>
          <div class="panel">
            <h3>Request details</h3>
            <p><strong>Status:</strong> ${esc(ticketData.status)}</p>
            <p><strong>Priority:</strong> ${esc(ticketData.priority)}</p>
            <p><strong>Support contract:</strong><br>${esc(ticketData.support_contracts?.tier_name || ticketData.support_contracts?.title || 'Not assigned')}</p>
            <p><strong>Response priority:</strong><br>${esc(ticketData.support_contracts?.response_priority || 'Not specified')}</p>
          </div>
          <div class="panel"><h3>Support usage this period</h3>${usageCardHtml(usage)}</div>
        </div>
      </div>`;

    document.getElementById('back').onclick = support;
    const replyFiles = document.getElementById('replyFiles');
    replyFiles.onchange = () => {
      document.getElementById('replyFileList').textContent = Array.from(replyFiles.files || []).map((file) => `${file.name} (${formatBytes(file.size)})`).join(' · ');
    };
    document.getElementById('reply').onsubmit = async (event) => {
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
  }'''
portal = replace_between(
    portal,
    r'  async function ticket\(id\) \{',
    r'\n  async function newTicket\(\)',
    portal_ticket,
    'portal ticket',
)

portal_new_ticket = r'''  async function newTicket() {
    if (!linkSupport()) {
      content.innerHTML = '<div class="panel">Support access is not enabled for this account.</div>';
      return;
    }

    const companyIds = currentCompanyIds(true);
    const [projectsResult, contractsResult, linksResult, categoriesResult] = await Promise.all([
      sb.from('projects').select('id,name,company_id,simulator_model,serial_number').in('company_id', companyIds).eq('active', true).order('name'),
      sb.from('support_contracts').select('*').in('company_id', companyIds).eq('status', 'active'),
      sb.from('support_contract_projects').select('contract_id,project_id'),
      sb.from('support_categories').select('id,name,company_id').eq('active', true).order('sort_order'),
    ]);
    const error = projectsResult.error || contractsResult.error || linksResult.error || categoriesResult.error;
    if (error) throw error;

    const projects = projectsResult.data || [];
    const contracts = contractsResult.data || [];
    const links = linksResult.data || [];
    const today = new Date().toISOString().slice(0, 10);
    const activeContracts = contracts.filter((contract) => contract.starts_on <= today && (!contract.ends_on || contract.ends_on >= today));
    const usageMap = await loadUsageMap(activeContracts.map((contract) => contract.id));
    const coverage = new Map();
    links.forEach((link) => {
      const contract = activeContracts.find((item) => item.id === link.contract_id);
      if (contract) (coverage.get(link.project_id) || coverage.set(link.project_id, []).get(link.project_id)).push(contract);
    });

    content.innerHTML = `
      <h1>Log a Fault</h1>
      <div class="panel">
        <form id="fault" class="stack">
          <label>Simulator<select id="project" required><option value="">Select simulator…</option>${projects.map((project) => `<option value="${project.id}">${esc(project.name)}${project.serial_number ? ` · S/N ${esc(project.serial_number)}` : ''}</option>`).join('')}</select></label>
          <div id="contractPanel" class="contract-status muted">Select a simulator to see its support contract and current usage.</div>
          <label id="contractField" class="hidden">Support contract<select id="contract"></select></label>
          <label>Priority<select id="priority"><option value="P3">P3 — Normal</option><option value="P2">P2 — High</option><option value="P1">P1 — Critical</option><option value="P4">P4 — Low</option></select></label>
          <label>Category<select id="category"><option value="">General / Other</option>${(categoriesResult.data || []).map((category) => `<option value="${category.id}">${esc(category.name)}</option>`).join('')}</select></label>
          <input id="subject" placeholder="Short fault description" required>
          <textarea id="overview" placeholder="Describe what happened, when it started, and any troubleshooting already attempted." required></textarea>
          <label class="upload-box">Attach images, video clips, PDFs or ZIP files<input id="faultFiles" type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,video/mp4,video/webm,video/quicktime,application/pdf,text/plain,application/zip"></label>
          <div id="faultFileList" class="muted">Maximum 100 MB per file.</div>
          <button id="submitFault" class="btn primary" disabled>SUBMIT SUPPORT REQUEST</button>
          <div id="faultStatus" class="muted"></div>
        </form>
      </div>`;

    const projectSelect = document.getElementById('project');
    const contractSelect = document.getElementById('contract');
    const contractField = document.getElementById('contractField');
    const contractPanel = document.getElementById('contractPanel');
    const submitButton = document.getElementById('submitFault');
    const faultFiles = document.getElementById('faultFiles');

    const renderContract = () => {
      const contractsForProject = coverage.get(projectSelect.value) || [];
      const selected = contractsForProject.find((contract) => contract.id === contractSelect.value) || contractsForProject[0];
      if (!projectSelect.value) {
        contractField.classList.add('hidden');
        contractPanel.textContent = 'Select a simulator to see its support contract and current usage.';
        contractPanel.className = 'contract-status muted';
        submitButton.disabled = true;
      } else if (!selected) {
        contractField.classList.add('hidden');
        contractPanel.textContent = 'No active support contract is allocated to this simulator. Simworx Admin must assign one before a fault can be submitted.';
        contractPanel.className = 'contract-status error';
        submitButton.disabled = true;
      } else {
        contractField.classList.toggle('hidden', contractsForProject.length === 1);
        contractPanel.innerHTML = `<strong>${esc(selected.tier_name)} — ${esc(selected.title)}</strong><br><span class="muted">Response priority: ${esc(selected.response_priority || 'Not specified')} · Billing in ${selected.billing_increment_minutes || 15}-minute increments</span><div style="margin-top:10px">${usageCardHtml(usageMap.get(selected.id))}</div>`;
        contractPanel.className = 'contract-status ok';
        submitButton.disabled = false;
      }
    };

    projectSelect.onchange = () => {
      const contractsForProject = coverage.get(projectSelect.value) || [];
      contractSelect.innerHTML = contractsForProject.map((contract) => `<option value="${contract.id}">${esc(contract.tier_name)} — ${esc(contract.title)}</option>`).join('');
      renderContract();
    };
    contractSelect.onchange = renderContract;

    faultFiles.onchange = () => {
      document.getElementById('faultFileList').textContent = Array.from(faultFiles.files || []).map((file) => `${file.name} (${formatBytes(file.size)})`).join(' · ') || 'Maximum 100 MB per file.';
    };

    document.getElementById('fault').onsubmit = async (event) => {
      event.preventDefault();
      const projectId = projectSelect.value;
      const project = projects.find((item) => item.id === projectId);
      const contractId = contractSelect.value || (coverage.get(projectId) || [])[0]?.id;
      const status = document.getElementById('faultStatus');
      if (!project || !contractId) {
        status.textContent = 'An active support contract must be allocated to this simulator.';
        return;
      }

      submitButton.disabled = true;
      status.textContent = 'Creating support request…';
      const { data: ticketData, error: ticketError } = await sb.from('tickets').insert({
        company_id: project.company_id,
        project_id: projectId,
        contract_id: contractId,
        requester_id: me.id,
        priority: document.getElementById('priority').value,
        category_id: document.getElementById('category').value || null,
        subject: document.getElementById('subject').value.trim(),
        overview: document.getElementById('overview').value.trim(),
      }).select('*').single();

      if (ticketError) {
        status.textContent = ticketError.message;
        submitButton.disabled = false;
        return;
      }

      try {
        await uploadTicketFiles(ticketData, faultFiles.files, null, status);
        toast(`Support request ${ticketData.reference} created`);
        await ticket(ticketData.id);
      } catch (error) {
        status.textContent = `Support request ${ticketData.reference} was created, but an attachment failed: ${error.message}`;
        submitButton.disabled = false;
      }
    };
  }'''
portal = replace_between(
    portal,
    r'  async function newTicket\(\) \{',
    r'\n  async function builds\(\)',
    portal_new_ticket,
    'portal newTicket',
)

ADMIN.write_text(admin, encoding='utf-8')
PORTAL.write_text(portal, encoding='utf-8')
print('Support tier defaults and usage billing UI patch applied.')
