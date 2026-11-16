/* Offline staff access screens. No fake cloud account claims. */
const h=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;','"':'&quot;','"':'&#39;'}[c]));
export function renderStaffAccess(status){
 const loading=!status.ready;
 const warning=status.error?'<p class="v43-auth-error" role="alert">'+h(status.error)+'</p>':'';
 const form=loading?'<p>Checking this device for an existing encrypted workspace…</p>':
 status.exists?'<form data-form="v43-staff-login" class="v43-auth-form">'+
  '<label>Staff username<input type="text" name="username" autocomplete="username" required minlength="3" placeholder="simworx-admin"></label>'+
  '<label>Password<input type="password" name="password" autocomplete="current-password" required></label>'+
  '<button class="btn primary" type="submit">Sign in to Project Hub</button></form>':
 '<form data-form="v43-staff-register" class="v43-auth-form">'+
  '<label>Choose staff username<input name="username" type="text" autocomplete="username" minlength="3" maxlength="50" required placeholder="simworx-admin"></label>'+
  '<label>Create password (12+ characters)<input name="password" type="password" autocomplete="new-password" minlength="12" required></label>'+
  '<label>Confirm password<input name="confirmation" type="password" autocomplete="new-password" minlength="12" required></label>'+
  (status.legacyFound?'<label class="v43-auth-choice"><input type="checkbox" name="importLegacy" value="yes"> Import older Project Hub records (leave unchecked to start clean)</label>':'')+
  '<button class="btn primary" type="submit">Create local staff workspace</button></form>';
 return '<div class="v43-auth-screen"><div class="v43-auth-brand"><b>SIM-WORX</b><span>PROJECT HUB · V0.4.3</span></div>'+
  '<div class="v43-auth-card"><div class="v43-auth-symbol">SW</div>'+
  '<h1>'+(status.exists?'Staff sign in':'Set up your staff workspace')+'</h1>'+
  '<p class="v43-auth-description">'+(status.exists?
   'Sign in to unlock your encrypted project records saved on this computer.':
   'Create a password to keep this computer’s project workspace encrypted. No customer logins or live websites are involved.')+
  '</p>'+warning+form+
  (status.legacyFound&&!status.exists?'<div class="v43-auth-legacy">Existing browser data were found, but will NOT be imported unless you select the checkbox above. Leave it unchecked to start with no sample projects. Older unencrypted data are retained separately until you choose to remove them.</div>':'')+
  '<div class="v43-auth-recovery"><p>Have an encrypted workspace backup from another browser or PC?</p>'+
  '<button class="btn small" type="button" data-action="workspace-import-trigger">Open encrypted workspace file</button>'+
  '<input id="v43-encrypted-import" type="file" accept=".swphub,application/json" hidden></div>'+
  '<p class="v43-auth-small">This is a password-protected, single-browser workspace—not shared online authentication. There is no password-recovery service. Keep your password and an encrypted backup separately.</p></div></div>';
}
export function renderStaffSettings(status){
 return '<div class="card v43-staff-card"><div class="card-head"><h2>Staff access & automatic data saving</h2></div>'+
 '<p>Signed in locally as <b>'+h(status.username)+'</b>. New records automatically save into encrypted browser storage after each change. '+
 'You can also connect a workspace file to mirror future saves to a location you choose.</p>'+
 '<div class="v43-staff-status"><b id="v43-settings-save-status">'+h(status.error?status.error:status.saving?'Saving…':status.lastSaved?'Saved locally':'Not yet saved')+'</b>'+
 '<small>Last browser save: '+h(status.lastSaved?.replace('T',' ').slice(0,19)||'Not yet')+'</small>'+
 '<small>File mirror: '+h(status.fileConnected?status.fileError||'Connected':'Not connected')+'</small></div>'+
 '<div class="v43-staff-actions">'+
 '<button type="button" data-action="workspace-connect-file" class="btn primary">Choose auto-save workspace file</button>'+
 (status.fileConnected?'<button type="button" data-action="workspace-reconnect-file" class="btn">Reconnect selected file</button>':'')+
 '<button type="button" data-action="workspace-export-encrypted" class="btn">Download encrypted backup</button>'+ '<button type="button" data-action="workspace-emergency-backup" class="btn">Emergency encrypted backup of current edits</button>'+
 '<button type="button" data-action="workspace-lock" class="btn">Sign out / lock workspace</button></div>'+
 (status.legacyFound?'<div class="v43-auth-legacy"><b>Older unencrypted records are still stored in this browser.</b> '+
 'After verifying your encrypted backup and newly saved records, you may remove that older copy. '+
 '<button type="button" data-action="workspace-delete-legacy" class="btn small danger">Remove old unprotected copy</button></div>':'')+
 '<p class="v43-auth-small">Only this computer/browser is connected. This is not a real staff-account server or a multi-employee shared database; employees on other PCs cannot safely edit the same data simultaneously. Never upload your encrypted workspace file, passwords or real supplier documents to the public GitHub repository.</p></div>';
}
