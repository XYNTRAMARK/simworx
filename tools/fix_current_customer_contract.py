from pathlib import Path

portal_path = Path('portal/portal.js')
portal_index_path = Path('portal/index.html')
admin_path = Path('admin/admin.js')
admin_index_path = Path('admin/index.html')

portal = portal_path.read_text(encoding='utf-8')
portal_index = portal_index_path.read_text(encoding='utf-8')
admin = admin_path.read_text(encoding='utf-8')
admin_index = admin_index_path.read_text(encoding='utf-8')

replacements = [
    (
        "? sb.from('support_contracts').select('id,title,tier_name,response_priority,status,starts_on,ends_on').in('company_id', companyIds).eq('status', 'active')",
        "? sb.from('support_contracts').select('id,company_id,title,tier_name,response_priority,status,starts_on,ends_on,created_at').in('company_id', companyIds).eq('status', 'active').is('deleted_at', null).order('starts_on', { ascending: false }).order('created_at', { ascending: false })",
    ),
    (
        """    const contracts = (contractsResult.data || []).filter((contract) => contract.starts_on <= today && (!contract.ends_on || contract.ends_on >= today));
    const usageMap = await loadUsageMap(contracts.map((contract) => contract.id));""",
        """    const activeContracts = (contractsResult.data || []).filter((contract) => contract.starts_on <= today && (!contract.ends_on || contract.ends_on >= today));
    const currentContracts = [];
    const seenCompanies = new Set();
    activeContracts.forEach((contract) => {
      if (!seenCompanies.has(contract.company_id)) {
        seenCompanies.add(contract.company_id);
        currentContracts.push(contract);
      }
    });
    const usageMap = await loadUsageMap(currentContracts.map((contract) => contract.id));""",
    ),
    (
        "${contracts.map((contract) => `<div class=\"panel\"><div style=\"display:flex;justify-content:space-between;gap:12px\"><div><h3 style=\"margin:0\">${esc(contract.tier_name)} — ${esc(contract.title)}</h3><p class=\"muted\">Response priority: ${esc(contract.response_priority || 'Not specified')}</p></div></div>${usageCardHtml(usageMap.get(contract.id))}</div>`).join('')}",
        "${currentContracts.map((contract) => `<div class=\"panel\"><div style=\"display:flex;justify-content:space-between;gap:12px\"><div><h3 style=\"margin:0\">${esc(contract.tier_name)} — ${esc(contract.title)}</h3><p class=\"muted\">Your current customer support contract · Response priority: ${esc(contract.response_priority || 'Not specified')}</p></div></div>${usageCardHtml(usageMap.get(contract.id))}</div>`).join('')}",
    ),
    (
        "sb.from('support_contracts').select('*').in('company_id', companyIds).eq('status', 'active').is('deleted_at', null),",
        "sb.from('support_contracts').select('*').in('company_id', companyIds).eq('status', 'active').is('deleted_at', null).order('starts_on', { ascending: false }).order('created_at', { ascending: false }),",
    ),
    (
        """    const contractsByCompany = new Map();
    activeContracts.forEach((contract) => {
      if (!contractsByCompany.has(contract.company_id)) contractsByCompany.set(contract.company_id, []);
      contractsByCompany.get(contract.company_id).push(contract);
    });""",
        """    const contractsByCompany = new Map();
    activeContracts.forEach((contract) => {
      if (!contractsByCompany.has(contract.company_id)) contractsByCompany.set(contract.company_id, [contract]);
    });""",
    ),
]

for old, new in replacements:
    if old not in portal:
        raise SystemExit(f'Portal replacement not found: {old[:100]}')
    portal = portal.replace(old, new, 1)

old_notice = 'Choose a reusable contract template for this customer. The assigned contract applies to the customer account and therefore covers all of its current and future simulators. It is not linked to an individual simulator.'
new_notice = old_notice + ' Assigning an Active contract replaces the customer’s current active contract; the previous contract remains in the customer’s contract history.'
if old_notice not in admin:
    raise SystemExit('Admin assignment notice not found')
admin = admin.replace(old_notice, new_notice, 1)

if 'ASSIGN CONTRACT TO CUSTOMER' not in admin:
    raise SystemExit('Assign contract button not found')
admin = admin.replace('ASSIGN CONTRACT TO CUSTOMER', 'ASSIGN / REPLACE CUSTOMER CONTRACT', 1)
admin = admin.replace("toast('Contract assigned to customer');", "toast('Current customer contract updated');", 1)

portal_index = portal_index.replace('./portal.js?v=20261010-company-contracts', './portal.js?v=20261010-current-contract')
admin_index = admin_index.replace('build 2026.10.10.2', 'build 2026.10.10.3')
admin_index = admin_index.replace('./admin.js?v=20261010-templates', './admin.js?v=20261010-current-contract')

portal_path.write_text(portal, encoding='utf-8')
portal_index_path.write_text(portal_index, encoding='utf-8')
admin_path.write_text(admin, encoding='utf-8')
admin_index_path.write_text(admin_index, encoding='utf-8')
