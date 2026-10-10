from pathlib import Path
import re

admin_path = Path('admin/admin.js')
index_path = Path('admin/index.html')
admin = admin_path.read_text(encoding='utf-8')
index = index_path.read_text(encoding='utf-8')

old = "  const SUPPORT_URL = 'https://euttubfvsrgkeiescsdm.supabase.co/functions/v1/support-portal-admin';\n"
new = old + "  const DELETE_CONTRACT_URL = 'https://euttubfvsrgkeiescsdm.supabase.co/functions/v1/support-contract-delete';\n"
if 'DELETE_CONTRACT_URL' not in admin:
    if old not in admin:
        raise SystemExit('Could not find SUPPORT_URL')
    admin = admin.replace(old, new, 1)

old = "  const supportApi = (action, payload = {}) => request(SUPPORT_URL, action, payload);\n"
new = old + "  const deleteContractApi = (action, payload = {}) => request(DELETE_CONTRACT_URL, action, payload);\n"
if 'deleteContractApi' not in admin:
    if old not in admin:
        raise SystemExit('Could not find supportApi helper')
    admin = admin.replace(old, new, 1)

old = "    const contractList = data.contracts || [];"
new = "    const contractList = (data.contracts || []).filter((contract) => !contract.deleted_at);"
if old in admin:
    admin = admin.replace(old, new, 1)
elif new not in admin:
    raise SystemExit('Could not find contractList declaration')

old = '<div class="row" style="margin-top:10px"><button class="btn ghost" data-edit-contract="${contract.id}">Edit</button></div>'
new = '<div class="row" style="margin-top:10px"><button class="btn ghost" data-edit-contract="${contract.id}">Edit</button><button class="btn danger" data-delete-contract="${contract.id}">Delete</button></div>'
if old in admin:
    admin = admin.replace(old, new, 1)
elif new not in admin:
    raise SystemExit('Could not find contract action buttons')

old = "    document.querySelectorAll('[data-edit-contract]').forEach((button) => button.onclick = () => contracts(button.dataset.editContract));\n  }"
new = """    document.querySelectorAll('[data-edit-contract]').forEach((button) => button.onclick = () => contracts(button.dataset.editContract));
    document.querySelectorAll('[data-delete-contract]').forEach((button) => {
      button.onclick = async () => {
        const contract = contractList.find((item) => item.id === button.dataset.deleteContract);
        if (!contract) return;
        const confirmed = window.confirm(
          `Delete \"${contract.title}\"?\n\nUnused contracts will be permanently deleted. If the contract has support-ticket history, it will be archived and removed from this list while the historical tickets remain available.`
        );
        if (!confirmed) return;
        button.disabled = true;
        try {
          const result = await deleteContractApi('delete_contract', { id: contract.id });
          toast(result.mode === 'archived'
            ? `Contract removed from the active list. ${result.ticket_count} historical support request${result.ticket_count === 1 ? '' : 's'} preserved.`
            : 'Contract deleted.');
          await contracts();
        } catch (error) {
          button.disabled = false;
          toast(error.message, true);
        }
      };
    });
  }"""
if "data-delete-contract" not in admin.split("document.querySelectorAll('[data-edit-contract]')", 1)[-1]:
    if old not in admin:
        raise SystemExit('Could not find edit-contract handler')
    admin = admin.replace(old, new, 1)

index = re.sub(r'build 2026\.10\.\d+\.\d+', 'build 2026.10.10.1', index, count=1)
index = re.sub(r'admin\.js\?v=[^\"]+', 'admin.js?v=20261010-0800', index, count=1)

admin_path.write_text(admin, encoding='utf-8')
index_path.write_text(index, encoding='utf-8')
