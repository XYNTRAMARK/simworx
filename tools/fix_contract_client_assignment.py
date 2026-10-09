from pathlib import Path

admin_path = Path('admin/admin.js')
portal_path = Path('portal/portal.js')
portal_index_path = Path('portal/index.html')

admin = admin_path.read_text(encoding='utf-8')
portal = portal_path.read_text(encoding='utf-8')
portal_index = portal_index_path.read_text(encoding='utf-8')

old_selected = "    const selectedProjects = new Set(editing ? links.filter((link) => link.contract_id === editing.id).map((link) => link.project_id) : []);"
new_selected = """    const selectedProjects = new Set(
      editing
        ? links.filter((link) => link.contract_id === editing.id).map((link) => link.project_id)
        : projects.filter((project) => project.company_id === selectedCompany).map((project) => project.id)
    );"""
if old_selected not in admin:
    raise SystemExit('Could not find selectedProjects assignment')
admin = admin.replace(old_selected, new_selected, 1)

old_label = '          <label>Covered simulators<div id="projectChecks" class="check-list"></div></label>'
new_label = '          <label>Covered simulators <span class="muted">All active simulators for the selected customer are chosen automatically. Untick any that are not covered.</span><div id="projectChecks" class="check-list"></div><div id="coveredProjectStatus" class="muted"></div></label>'
if old_label not in admin:
    raise SystemExit('Could not find covered simulators label')
admin = admin.replace(old_label, new_label, 1)

old_render = """    const renderProjectChecks = () => {
      const companyProjects = projects.filter((project) => project.company_id === companySelect.value);
      document.getElementById('projectChecks').innerHTML = companyProjects.length ? companyProjects.map((project) => `<label><input type=\"checkbox\" name=\"coveredProject\" value=\"${project.id}\" ${selectedProjects.has(project.id) ? 'checked' : ''}> ${esc(project.name)}${project.serial_number ? ` · S/N ${esc(project.serial_number)}` : ''}</label>`).join('') : '<span class=\"muted\">This customer has no active simulators. Add a simulator first.</span>';
    };
    renderProjectChecks();
    companySelect.onchange = () => {
      selectedProjects.clear();
      renderProjectChecks();
    };"""
new_render = """    const updateCoveredProjectStatus = () => {
      const selected = Array.from(document.querySelectorAll('input[name=\"coveredProject\"]:checked'));
      const status = document.getElementById('coveredProjectStatus');
      status.textContent = selected.length
        ? `${selected.length} simulator${selected.length === 1 ? '' : 's'} will be covered by this contract.`
        : 'Select at least one simulator before saving the contract.';
      status.style.color = selected.length ? '#245f39' : '#9f2d2d';
    };

    const renderProjectChecks = () => {
      const companyProjects = projects.filter((project) => project.company_id === companySelect.value);
      const container = document.getElementById('projectChecks');
      container.innerHTML = companyProjects.length ? companyProjects.map((project) => `<label><input type=\"checkbox\" name=\"coveredProject\" value=\"${project.id}\" ${selectedProjects.has(project.id) ? 'checked' : ''}> ${esc(project.name)}${project.serial_number ? ` · S/N ${esc(project.serial_number)}` : ''}</label>`).join('') : '<span class=\"muted\">This customer has no active simulators. Add a simulator first.</span>';
      container.querySelectorAll('input[name=\"coveredProject\"]').forEach((input) => {
        input.onchange = () => {
          if (input.checked) selectedProjects.add(input.value);
          else selectedProjects.delete(input.value);
          updateCoveredProjectStatus();
        };
      });
      updateCoveredProjectStatus();
    };
    renderProjectChecks();
    companySelect.onchange = () => {
      selectedProjects.clear();
      projects.filter((project) => project.company_id === companySelect.value).forEach((project) => selectedProjects.add(project.id));
      renderProjectChecks();
    };"""
if old_render not in admin:
    raise SystemExit('Could not find project checkbox renderer')
admin = admin.replace(old_render, new_render, 1)

old_submit = """      const projectIds = Array.from(document.querySelectorAll('input[name=\"coveredProject\"]:checked')).map((input) => input.value);
      try {"""
new_submit = """      const projectIds = Array.from(document.querySelectorAll('input[name=\"coveredProject\"]:checked')).map((input) => input.value);
      if (!projectIds.length) {
        const projectBox = document.getElementById('projectChecks');
        projectBox.style.borderColor = '#b83b3b';
        projectBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
        toast('Select at least one simulator covered by this contract.', true);
        return;
      }
      document.getElementById('projectChecks').style.borderColor = '';
      try {"""
if old_submit not in admin:
    raise SystemExit('Could not find contract submit project IDs')
admin = admin.replace(old_submit, new_submit, 1)

old_toast = "        toast(editing ? 'Contract updated' : 'Contract created');"
new_toast = """        const savedCustomer = companies.find((company) => company.id === companySelect.value);
        const savedProjectNames = projects.filter((project) => projectIds.includes(project.id)).map((project) => project.name);
        toast(`${editing ? 'Contract updated' : 'Contract created'} for ${savedCustomer?.trading_name || savedCustomer?.legal_name || 'customer'} — ${savedProjectNames.join(', ')}`);"""
if old_toast not in admin:
    raise SystemExit('Could not find contract success toast')
admin = admin.replace(old_toast, new_toast, 1)

portal_anchor = """    faultFiles.onchange = () => {
      document.getElementById('faultFileList').textContent = Array.from(faultFiles.files || []).map((file) => `${file.name} (${formatBytes(file.size)})`).join(' · ') || 'Maximum 100 MB per file.';
    };"""
portal_insert = """    const firstCoveredProject = projects.find((project) => (coverage.get(project.id) || []).length > 0);
    if (firstCoveredProject) {
      projectSelect.value = firstCoveredProject.id;
      projectSelect.onchange();
    }

    faultFiles.onchange = () => {
      document.getElementById('faultFileList').textContent = Array.from(faultFiles.files || []).map((file) => `${file.name} (${formatBytes(file.size)})`).join(' · ') || 'Maximum 100 MB per file.';
    };"""
if portal_anchor not in portal:
    raise SystemExit('Could not find client fault-file anchor')
portal = portal.replace(portal_anchor, portal_insert, 1)

if '<meta http-equiv="Cache-Control"' not in portal_index:
    portal_index = portal_index.replace(
        '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
        '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate"><meta http-equiv="Pragma" content="no-cache"><meta http-equiv="Expires" content="0">',
        1,
    )
portal_index = portal_index.replace('<script src="./portal.js"></script>', '<script src="./portal.js?v=20261009-0935"></script>', 1)

admin_path.write_text(admin, encoding='utf-8')
portal_path.write_text(portal, encoding='utf-8')
portal_index_path.write_text(portal_index, encoding='utf-8')
