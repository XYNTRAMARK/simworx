from pathlib import Path

path = Path("admin/admin.js")
source = path.read_text(encoding="utf-8")

marker = "    const initialPreset = editing ? null : TIER_PRESETS.Basic;\n"
replacement_marker = (
    "    const initialPreset = editing ? null : TIER_PRESETS.Basic;\n"
    "    const selectedTier = editing?.tier_name || initialPreset?.tier || 'Basic';\n"
    "    const tierOptions = Object.keys(TIER_PRESETS);\n"
    "    if (selectedTier && !tierOptions.includes(selectedTier)) tierOptions.push(selectedTier);\n"
)
if marker not in source:
    raise SystemExit("Could not find contract preset marker")
source = source.replace(marker, replacement_marker, 1)

old = "          <label>Support level<input id=\"contractTier\" list=\"supportTierOptions\" value=\"${esc(editing?.tier_name || initialPreset?.tier || 'Basic')}\" required><datalist id=\"supportTierOptions\"><option value=\"Basic\"><option value=\"Standard\"><option value=\"Premium\"><option value=\"Pay As You Go\"></datalist></label>"
new = "          <label>Support level<select id=\"contractTier\" required>${tierOptions.map((tier) => `<option value=\"${esc(tier)}\" ${tier === selectedTier ? 'selected' : ''}>${esc(tier)}</option>`).join('')}</select></label>"
if old not in source:
    raise SystemExit("Could not find support level datalist")
source = source.replace(old, new, 1)

path.write_text(source, encoding="utf-8")
