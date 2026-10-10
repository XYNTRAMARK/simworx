from pathlib import Path
import re

admin_path = Path('admin/admin.js')
admin_index_path = Path('admin/index.html')
portal_path = Path('portal/portal.js')
portal_index_path = Path('portal/index.html')

admin = admin_path.read_text(encoding='utf-8')
admin_index = admin_index_path.read_text(encoding='utf-8')
portal = portal_path.read_text(encoding='utf-8')
portal_index = portal_index_path.read_text(encoding='utf-8')

# Route reusable templates and customer assignments through their own server-side manager.
admin = admin.replace(
    "  const SUPPORT_URL = 'https://euttubfvsrgkeiescsdm.supabase.co/functions/v1/support-portal-admin';\n",
    "  const SUPPORT_URL = 'https://euttubfvsrgkeiescsdm.supabase.co/functions/v1/support-portal-admin';\n"
    "  const CONTRACT_MANAGER_URL = 'https://euttubfvsrgkeiescsdm.supabase.co/functions/v1/support-contract-manager';\n",
    1,
)
admin = admin.replace("  const DELETE_CONTRACT_URL = 'https://euttubfvsrgkeiescsdm.supabase.co/functions/v1/support-contract-delete';\n", "")
admin = admin.replace(
    "  const supportApi = (action, payload = {}) => request(SUPPORT_URL, action, payload);\n  const deleteContractApi = (action, payload = {}) => request(DELETE_CONTRACT_URL, action, payload);\n",
    "  const supportApi = (action, payload = {}) => request(SUPPORT_URL, action, payload);\n"
    "  const contractManagerApi = (action, payload = {}) => request(CONTRACT_MANAGER_URL, action, payload);\n",
    1,
)

# Contracts are assigned from Edit Customer, so remove the old per-row shortcut.
admin = admin.replace('                <button class="btn ghost" data-contracts-company="${company.id}">Contracts</button>\n', '')
handler_start = admin.find("    document.querySelectorAll('[data-contracts-company]')")
if handler_start != -1:
    handler_end = admin.find("  }\n\n  async function editCustomer", handler_start)
    if handler_end == -1:
        raise SystemExit('Could not locate customer contract shortcut handler end')
    admin = admin[:handler_start] + admin[handler_end:]

new_edit_customer = r'''  async function editCustomer(company) {
    if (!company) return;

    const contractData = await contractManagerApi('customer_contracts', { company_id: company.id });
    const templates = contractData.templates || [];
    const assignments = contractData.assignments || [];
    const today = new Date().toISOString().slice(0, 10);

    const termEndDate = (startDate, months) => {
      if (!startDate) return '';
      const date = new Date(`${startDate}T00:00:00Z`);
      date.setUTCMonth(date.getUTCMonth() + Math.max(1, Number(months || 12)));
      date.setUTCDate(date.getUTCDate() - 1);
      return date.toISOString().slice(0, 10);
    };

    content.innerHTML = `
      <button id="backCustomers" class="btn ghost">← Back</button><h1>Edit Customer — ${esc(company.trading_name || company.legal_name)}</h1>
      <div class="grid">
        <div class="panel"><h3>Customer details</h3><form id="editCustomerForm" class="stack">
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
          <button class="btn primary">SAVE CUSTOMER DETAILS</button>
        </form></div>

        <div class="panel"><h3>Assign a support contract</h3>
          <div class="notice">Choose a reusable contract template for this customer. The assigned contract applies to the customer account and therefore covers all of its current and future simulators. It is not linked to an individual simulator.</div>
          ${templates.length ? `<form id="assignContractForm" class="stack" style="margin-top:12px">
            <label>Contract template<select id="assignTemplate" required>${templates.map((template) => `<option value="${template.id}">${esc(template.name)} — ${esc(template.tier_name)}</option>`).join('')}</select></label>
            <div id="assignTemplateSummary" class="card"></div>
            <label>Contract title for this customer<input id="assignTitle" required></label>
            <div class="row"><label style="flex:1">Starts on<input id="assignStart" type="date" value="${today}" required></label><label style="flex:1">Ends on<input id="assignEnd" type="date"></label></div>
            <label>Status<select id="assignStatus"><option value="active">Active</option><option value="draft">Draft</option></select></label>
            <label>Customer-specific notes<textarea id="assignNotes" placeholder="Optional notes for this customer assignment"></textarea></label>
            <button class="btn primary">ASSIGN CONTRACT TO CUSTOMER</button>
          </form>` : '<p class="muted">No active contract templates are available. Create one in Contract Templates first.</p>'}
        </div>
      </div>

      <div class="panel"><h3>Contracts currently assigned to this customer</h3>
        <div class="stack">${assignments.length ? assignments.map((assignment) => `
          <div class="card" data-assignment-card="${assignment.id}">
            <div class="row" style="justify-content:space-between"><strong>${esc(assignment.title)}</strong><span class="tag">${esc(assignment.status)}</span></div>
            <div class="muted">Template: ${esc(assignment.support_contract_templates?.name || 'Legacy / custom assignment')} · ${esc(assignment.tier_name)}</div>
            <div class="muted">This contract covers the customer account, not a specific simulator.</div>
            <div style="margin-top:8px"><strong>${formatMoney(assignment.monthly_fee, assignment.currency)}</strong> per month · ${formatMinutes(assignment.included_minutes)} included · ${formatMoney(assignment.first_line_rate, assignment.currency)}/hour excess</div>
            <div class="grid" style="margin-top:10px">
              <label>Customer contract title<input data-assignment-title value="${esc(assignment.title)}"></label>
              <label>Status<select data-assignment-status>${['draft','active','expired','cancelled'].map((status) => `<option value="${status}" ${assignment.status === status ? 'selected' : ''}>${status}</option>`).join('')}</select></label>
              <label>Starts on<input data-assignment-start type="date" value="${assignment.starts_on || ''}"></label>
              <label>Ends on<input data-assignment-end type="date" value="${assignment.ends_on || ''}"></label>
            </div>
            <label style="margin-top:8px">Assignment notes<textarea data-assignment-notes>${esc(assignment.notes || '')}</textarea></label>
            <div class="row" style="margin-top:10px"><button class="btn ghost" data-save-assignment="${assignment.id}">SAVE ASSIGNMENT</button><button class="btn danger" data-remove-assignment="${assignment.id}">REMOVE CONTRACT</button></div>
          </div>`).join('') : '<p class="muted">No support contract is assigned to this customer.</p>'}</div>
      </div>`;

    document.getElementById('backCustomers').onclick = customers;

    document.getElementById('editCustomerForm').onsubmit = async (event) => {
      event.preventDefault();
      const updatedCompany = {
        ...company,
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
      };
      try {
        await api('update_customer', { id: company.id, ...updatedCompany });
        toast('Customer updated');
        await editCustomer(updatedCompany);
      } catch (error) {
        toast(error.message, true);
      }
    };

    if (templates.length) {
      const templateSelect = document.getElementById('assignTemplate');
      const startInput = document.getElementById('assignStart');
      const endInput = document.getElementById('assignEnd');
      const titleInput = document.getElementById('assignTitle');
      const summary = document.getElementById('assignTemplateSummary');

      const updateTemplatePreview = (resetValues = false) => {
        const template = templates.find((item) => item.id === templateSelect.value) || templates[0];
        if (!template) return;
        summary.innerHTML = `<strong>${esc(template.title)}</strong><div class="muted">${esc(template.response_priority || 'Priority not specified')}</div><div style="margin-top:6px">${formatMoney(template.monthly_fee, template.currency)} per month · ${formatMinutes(template.included_minutes)} included · ${formatMoney(template.first_line_rate, template.currency)}/hour excess</div>`;
        if (resetValues || !titleInput.value) titleInput.value = template.title;
        if (resetValues || !endInput.value) endInput.value = termEndDate(startInput.value, template.default_term_months);
      };

      templateSelect.onchange = () => updateTemplatePreview(true);
      startInput.onchange = () => {
        const template = templates.find((item) => item.id === templateSelect.value) || templates[0];
        if (template) endInput.value = termEndDate(startInput.value, template.default_term_months);
      };
      updateTemplatePreview(true);

      document.getElementById('assignContractForm').onsubmit = async (event) => {
        event.preventDefault();
        try {
          await contractManagerApi('assign_template', {
            company_id: company.id,
            template_id: templateSelect.value,
            title: titleInput.value.trim(),
            starts_on: startInput.value,
            ends_on: endInput.value || null,
            status: document.getElementById('assignStatus').value,
            notes: document.getElementById('assignNotes').value.trim(),
          });
          toast('Contract assigned to customer');
          await editCustomer(company);
        } catch (error) {
          toast(error.message, true);
        }
      };
    }

    document.querySelectorAll('[data-save-assignment]').forEach((button) => {
      button.onclick = async () => {
        const card = button.closest('[data-assignment-card]');
        try {
          await contractManagerApi('update_assignment', {
            id: button.dataset.saveAssignment,
            title: card.querySelector('[data-assignment-title]').value.trim(),
            starts_on: card.querySelector('[data-assignment-start]').value,
            ends_on: card.querySelector('[data-assignment-end]').value || null,
            status: card.querySelector('[data-assignment-status]').value,
            notes: card.querySelector('[data-assignment-notes]').value.trim(),
          });
          toast('Customer contract updated');
          await editCustomer(company);
        } catch (error) {
          toast(error.message, true);
        }
      };
    });

    document.querySelectorAll('[data-remove-assignment]').forEach((button) => {
      button.onclick = async () => {
        const assignment = assignments.find((item) => item.id === button.dataset.removeAssignment);
        if (!assignment || !window.confirm(`Remove "${assignment.title}" from this customer? Historical support tickets will be preserved.`)) return;
        button.disabled = true;
        try {
          const result = await contractManagerApi('remove_assignment', { id: assignment.id });
          toast(result.mode === 'archived' ? 'Contract removed; historical support requests were preserved.' : 'Contract removed from customer.');
          await editCustomer(company);
        } catch (error) {
          button.disabled = false;
          toast(error.message, true);
        }
      };
    });
  }

'''

edit_start = admin.index('  async function editCustomer(company) {')
edit_end = admin.index('  async function manageSimulators(company) {', edit_start)
admin = admin[:edit_start] + new_edit_customer + admin[edit_end:]

new_contract_templates = r'''  async function contracts(editId = null) {
    const data = await contractManagerApi('list_templates');
    const templates = data.templates || [];
    const assignmentCounts = data.assignment_counts || {};
    const editing = editId ? templates.find((template) => template.id === editId) : null;
    const preset = editing ? null : TIER_PRESETS.Basic;
    const selectedPreset = editing && TIER_PRESETS[editing.tier_name] ? editing.tier_name : (editing ? '' : 'Basic');

    content.innerHTML = `
      <h1>Contract Templates</h1>
      <div class="notice"><strong>Create reusable contract templates here, then assign one from Customers & Access → Edit.</strong><br>A template is not attached to a simulator. When assigned, it applies to that customer account and can cover one or many simulators.</div>
      <div class="grid">
        <div class="panel"><h3>${editing ? 'Edit contract template' : 'Create contract template'}</h3><form id="templateForm" class="stack">
          <input id="templateId" type="hidden" value="${editing?.id || ''}">
          <label>Start from default<select id="templatePreset"><option value="">Blank / custom</option>${Object.keys(TIER_PRESETS).map((name) => `<option value="${esc(name)}" ${selectedPreset === name ? 'selected' : ''}>${esc(name)}</option>`).join('')}</select></label>
          <button id="applyTemplateDefaults" type="button" class="btn ghost">APPLY DEFAULT VALUES</button>
          <label>Template name<input id="templateName" value="${esc(editing?.name || preset?.tier || '')}" placeholder="e.g. Multi-Simulator Premium Agreement" required></label>
          <label>Contract title<input id="templateTitle" value="${esc(editing?.title || preset?.title || '')}" required></label>
          <label>Support level name<input id="templateTier" value="${esc(editing?.tier_name || preset?.tier || '')}" required></label>
          <label>Response priority<input id="templateResponse" value="${esc(editing?.response_priority || preset?.responsePriority || '')}"></label>
          <div class="row"><label style="flex:1">Currency<input id="templateCurrency" value="${esc(editing?.currency || 'EUR')}"></label><label style="flex:1">Monthly fee<input id="templateFee" type="number" min="0" step="0.01" value="${editing?.monthly_fee ?? preset?.monthlyFee ?? 0}"></label></div>
          <div class="row"><label style="flex:1">Included hours/month<input id="templateHours" type="number" min="0" step="0.25" value="${editing ? Number(editing.included_minutes || 0) / 60 : preset?.includedHours ?? 0}"></label><label style="flex:1">Excess rate/hour<input id="templateFirstRate" type="number" min="0" step="0.01" value="${editing?.first_line_rate ?? preset?.excessRate ?? 0}"></label></div>
          <div class="row"><label style="flex:1">Second-line excess rate/hour<input id="templateSecondRate" type="number" min="0" step="0.01" value="${editing?.second_line_rate ?? preset?.excessRate ?? 0}"></label><label style="flex:1">Billing increment (minutes)<input id="templateIncrement" type="number" min="1" max="240" value="${editing?.billing_increment_minutes || preset?.billingIncrement || 15}"></label></div>
          <div class="row"><label style="flex:1">Default contract term (months)<input id="templateTerm" type="number" min="1" max="120" value="${editing?.default_term_months || 12}"></label><label style="flex:1">Default billing day<input id="templateBillingDay" type="number" min="1" max="28" value="${editing?.default_billing_anchor_day || 1}"></label></div>
          <label>Support operating hours<input id="templateSupportHours" value="${esc(editing?.support_hours || '')}" placeholder="Enter agreed support hours, if applicable"></label>
          <label>Included services<textarea id="templateServices">${esc(editing?.included_services || preset?.includedServices || '')}</textarea></label>
          <label>Warranty notes<textarea id="templateWarranty">${esc(editing?.warranty_notes || DEFAULT_WARRANTY_NOTES)}</textarea></label>
          <label>Internal template notes<textarea id="templateNotes">${esc(editing?.notes || '')}</textarea></label>
          <label><input id="templateRollover" type="checkbox" ${editing?.rollover_enabled ? 'checked' : ''} style="width:auto"> Allow unused support hours to roll over</label>
          <label><input id="templateApproval" type="checkbox" ${editing?.overage_requires_approval ? 'checked' : ''} style="width:auto"> Overage requires customer approval</label>
          <label><input id="templateActive" type="checkbox" ${editing ? (editing.active ? 'checked' : '') : 'checked'} style="width:auto"> Template available for assignment</label>
          <button class="btn primary">${editing ? 'SAVE TEMPLATE' : 'CREATE TEMPLATE'}</button>
          ${editing ? '<button id="cancelTemplateEdit" type="button" class="btn ghost">CANCEL EDITING</button>' : ''}
        </form></div>

        <div class="panel"><h3>Available templates</h3><div class="stack">${templates.length ? templates.map((template) => `
          <div class="card">
            <div class="row" style="justify-content:space-between"><strong>${esc(template.name)}</strong><span class="tag">${template.active ? 'available' : 'inactive'}</span></div>
            <div class="muted">${esc(template.title)} · ${esc(template.tier_name)} · ${esc(template.response_priority || 'Priority not specified')}</div>
            <div style="margin-top:8px">${formatMoney(template.monthly_fee, template.currency)} per month · ${formatMinutes(template.included_minutes)} included · ${formatMoney(template.first_line_rate, template.currency)}/hour excess</div>
            <div class="muted" style="margin-top:5px">Assigned to ${assignmentCounts[template.id] || 0} customer contract${Number(assignmentCounts[template.id] || 0) === 1 ? '' : 's'}</div>
            <div class="row" style="margin-top:10px"><button class="btn ghost" data-edit-template="${template.id}">Edit</button><button class="btn danger" data-delete-template="${template.id}">Delete</button></div>
          </div>`).join('') : '<p class="muted">No contract templates have been created.</p>'}</div></div>
      </div>`;

    const applyPreset = () => {
      const selected = document.getElementById('templatePreset').value;
      const values = TIER_PRESETS[selected];
      if (!values) {
        toast('Choose Basic, Standard, Premium or Pay As You Go first.', true);
        return;
      }
      document.getElementById('templateName').value = values.tier;
      document.getElementById('templateTitle').value = values.title;
      document.getElementById('templateTier').value = values.tier;
      document.getElementById('templateResponse').value = values.responsePriority;
      document.getElementById('templateFee').value = values.monthlyFee;
      document.getElementById('templateHours').value = values.includedHours;
      document.getElementById('templateFirstRate').value = values.excessRate;
      document.getElementById('templateSecondRate').value = values.excessRate;
      document.getElementById('templateIncrement').value = values.billingIncrement;
      document.getElementById('templateServices').value = values.includedServices;
      document.getElementById('templateWarranty').value = DEFAULT_WARRANTY_NOTES;
      document.getElementById('templateRollover').checked = false;
      document.getElementById('templateApproval').checked = false;
      toast(`${values.tier} defaults applied. Every field can still be edited.`);
    };
    document.getElementById('applyTemplateDefaults').onclick = applyPreset;

    document.getElementById('templateForm').onsubmit = async (event) => {
      event.preventDefault();
      try {
        await contractManagerApi('save_template', {
          id: document.getElementById('templateId').value || null,
          name: document.getElementById('templateName').value.trim(),
          title: document.getElementById('templateTitle').value.trim(),
          tier_name: document.getElementById('templateTier').value.trim(),
          response_priority: document.getElementById('templateResponse').value.trim(),
          monthly_fee: document.getElementById('templateFee').value,
          included_minutes: Math.round(Number(document.getElementById('templateHours').value || 0) * 60),
          first_line_rate: document.getElementById('templateFirstRate').value,
          second_line_rate: document.getElementById('templateSecondRate').value,
          currency: document.getElementById('templateCurrency').value,
          billing_increment_minutes: document.getElementById('templateIncrement').value,
          default_term_months: document.getElementById('templateTerm').value,
          default_billing_anchor_day: document.getElementById('templateBillingDay').value,
          support_hours: document.getElementById('templateSupportHours').value.trim(),
          included_services: document.getElementById('templateServices').value.trim(),
          warranty_notes: document.getElementById('templateWarranty').value.trim(),
          notes: document.getElementById('templateNotes').value.trim(),
          rollover_enabled: document.getElementById('templateRollover').checked,
          overage_requires_approval: document.getElementById('templateApproval').checked,
          active: document.getElementById('templateActive').checked,
        });
        toast(editing ? 'Contract template updated' : 'Contract template created');
        await contracts();
      } catch (error) {
        toast(error.message, true);
      }
    };

    if (editing) document.getElementById('cancelTemplateEdit').onclick = () => contracts();
    document.querySelectorAll('[data-edit-template]').forEach((button) => button.onclick = () => contracts(button.dataset.editTemplate));
    document.querySelectorAll('[data-delete-template]').forEach((button) => {
      button.onclick = async () => {
        const template = templates.find((item) => item.id === button.dataset.deleteTemplate);
        if (!template || !window.confirm(`Delete the template "${template.name}"? Existing customer contracts created from it will remain unchanged.`)) return;
        button.disabled = true;
        try {
          const result = await contractManagerApi('delete_template', { id: template.id });
          toast(result.mode === 'archived' ? 'Template removed from future assignment; existing customer contracts were preserved.' : 'Template deleted.');
          await contracts();
        } catch (error) {
          button.disabled = false;
          toast(error.message, true);
        }
      };
    });
  }


'''

contracts_start = admin.index('  async function contracts(editId = null) {')
contracts_end = admin.index('  async function builds() {', contracts_start)
admin = admin[:contracts_start] + new_contract_templates + admin[contracts_end:]

new_ticket_function = r'''  async function newTicket() {
    if (!linkSupport()) {
      content.innerHTML = '<div class="panel">Support access is not enabled for this account.</div>';
      return;
    }

    const companyIds = currentCompanyIds(true);
    const [projectsResult, contractsResult, categoriesResult] = await Promise.all([
      sb.from('projects').select('id,name,company_id,simulator_model,serial_number').in('company_id', companyIds).eq('active', true).order('name'),
      sb.from('support_contracts').select('*').in('company_id', companyIds).eq('status', 'active').is('deleted_at', null),
      sb.from('support_categories').select('id,name,company_id').eq('active', true).order('sort_order'),
    ]);
    const error = projectsResult.error || contractsResult.error || categoriesResult.error;
    if (error) throw error;

    const projects = projectsResult.data || [];
    const contracts = contractsResult.data || [];
    const today = new Date().toISOString().slice(0, 10);
    const activeContracts = contracts.filter((contract) => contract.starts_on <= today && (!contract.ends_on || contract.ends_on >= today));
    const usageMap = await loadUsageMap(activeContracts.map((contract) => contract.id));
    const contractsByCompany = new Map();
    activeContracts.forEach((contract) => {
      if (!contractsByCompany.has(contract.company_id)) contractsByCompany.set(contract.company_id, []);
      contractsByCompany.get(contract.company_id).push(contract);
    });

    content.innerHTML = `
      <h1>Log a Fault</h1>
      <div class="panel">
        <form id="fault" class="stack">
          <label>Simulator<select id="project" required><option value="">Select simulator…</option>${projects.map((project) => `<option value="${project.id}">${esc(project.name)}${project.serial_number ? ` · S/N ${esc(project.serial_number)}` : ''}</option>`).join('')}</select></label>
          <div id="contractPanel" class="contract-status muted">Select a simulator to see the support contract assigned to your company.</div>
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

    const contractsForSelectedCustomer = () => {
      const project = projects.find((item) => item.id === projectSelect.value);
      return project ? (contractsByCompany.get(project.company_id) || []) : [];
    };

    const renderContract = () => {
      const customerContracts = contractsForSelectedCustomer();
      const selected = customerContracts.find((contract) => contract.id === contractSelect.value) || customerContracts[0];
      if (!projectSelect.value) {
        contractField.classList.add('hidden');
        contractPanel.textContent = 'Select a simulator to see the support contract assigned to your company.';
        contractPanel.className = 'contract-status muted';
        submitButton.disabled = true;
      } else if (!selected) {
        contractField.classList.add('hidden');
        contractPanel.textContent = 'No active support contract is assigned to this customer account. Simworx Admin must assign one from Customers & Access before a fault can be submitted.';
        contractPanel.className = 'contract-status error';
        submitButton.disabled = true;
      } else {
        contractField.classList.toggle('hidden', customerContracts.length === 1);
        contractPanel.innerHTML = `<strong>${esc(selected.tier_name)} — ${esc(selected.title)}</strong><br><span class="muted">This contract applies to your customer account and all registered simulators. Response priority: ${esc(selected.response_priority || 'Not specified')} · Billing in ${selected.billing_increment_minutes || 15}-minute increments</span><div style="margin-top:10px">${usageCardHtml(usageMap.get(selected.id))}</div>`;
        contractPanel.className = 'contract-status ok';
        submitButton.disabled = false;
      }
    };

    projectSelect.onchange = () => {
      const customerContracts = contractsForSelectedCustomer();
      contractSelect.innerHTML = customerContracts.map((contract) => `<option value="${contract.id}">${esc(contract.tier_name)} — ${esc(contract.title)}</option>`).join('');
      renderContract();
    };
    contractSelect.onchange = renderContract;

    const firstCoveredProject = projects.find((project) => (contractsByCompany.get(project.company_id) || []).length > 0);
    if (firstCoveredProject) {
      projectSelect.value = firstCoveredProject.id;
      projectSelect.onchange();
    }

    faultFiles.onchange = () => {
      document.getElementById('faultFileList').textContent = Array.from(faultFiles.files || []).map((file) => `${file.name} (${formatBytes(file.size)})`).join(' · ') || 'Maximum 100 MB per file.';
    };

    document.getElementById('fault').onsubmit = async (event) => {
      event.preventDefault();
      const projectId = projectSelect.value;
      const project = projects.find((item) => item.id === projectId);
      const customerContracts = contractsForSelectedCustomer();
      const contractId = contractSelect.value || customerContracts[0]?.id;
      const status = document.getElementById('faultStatus');
      if (!project || !contractId) {
        status.textContent = 'An active support contract must be assigned to this customer account.';
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
  }


'''

new_ticket_start = portal.index('  async function newTicket() {')
new_ticket_end = portal.index('  async function builds() {', new_ticket_start)
portal = portal[:new_ticket_start] + new_ticket_function + portal[new_ticket_end:]

admin_index = admin_index.replace('>Support Contracts</button>', '>Contract Templates</button>')
admin_index = re.sub(r'build 2026\.10\.\d+\.\d+', 'build 2026.10.10.2', admin_index, count=1)
admin_index = re.sub(r'admin\.js\?v=[^\"]+', 'admin.js?v=20261010-templates', admin_index, count=1)
portal_index = re.sub(r'portal\.js\?v=[^\"]+', 'portal.js?v=20261010-company-contracts', portal_index, count=1)

admin_path.write_text(admin, encoding='utf-8')
admin_index_path.write_text(admin_index, encoding='utf-8')
portal_path.write_text(portal, encoding='utf-8')
portal_index_path.write_text(portal_index, encoding='utf-8')
