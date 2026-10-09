(() => {
  'use strict';

  const URL = 'https://euttubfvsrgkeiescsdm.supabase.co';
  const KEY = 'sb_publishable_PEfCOwn6Xkwtl7RhWPAPVA_Ppgq08Wl';
  const BUCKET = 'support-attachments';
  const MAX_FILE_BYTES = 100 * 1024 * 1024;
  const sb = supabase.createClient(URL, KEY);

  const login = document.getElementById('login');
  const app = document.getElementById('app');
  const box = document.getElementById('loginBox');
  const content = document.getElementById('content');

  let me = null;
  let companyLinks = [];
  let view = 'dashboard';

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

  const safeFileName = (name) => name
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9._,'!&$@=;:+?() -]/g, '_')
    .replace(/\s+/g, '_')
    .slice(-140) || 'file';

  const currentCompanyIds = (supportOnly = false) => companyLinks
    .filter((link) => link.active && (!supportOnly || link.can_support))
    .map((link) => link.company_id);

  function setup(profile) {
    app.classList.add('hidden');
    login.classList.remove('hidden');
    box.innerHTML = `
      <div class="brand">SIMWOR<b>X</b></div>
      <h1>Create your account</h1>
      <p class="muted">Choose the username and password you will use for future visits.</p>
      <form id="setupForm" class="stack">
        <input id="suName" placeholder="Your name" value="${esc(profile?.full_name || '')}">
        <input id="suUser" autocomplete="username" placeholder="Choose a username" value="${esc(profile?.username || '')}" required minlength="3" maxlength="40">
        <input id="suPass" type="password" autocomplete="new-password" placeholder="Choose a password" required minlength="8">
        <input id="suPass2" type="password" autocomplete="new-password" placeholder="Confirm password" required minlength="8">
        <button class="btn primary">CREATE ACCOUNT</button>
      </form>
      <p id="suMsg" class="muted"></p>`;

    document.getElementById('setupForm').onsubmit = async (event) => {
      event.preventDefault();
      const message = document.getElementById('suMsg');
      const username = document.getElementById('suUser').value.trim();
      const fullName = document.getElementById('suName').value.trim();
      const password = document.getElementById('suPass').value;
      const confirm = document.getElementById('suPass2').value;

      if (password !== confirm) {
        message.textContent = 'Passwords do not match.';
        return;
      }
      if (!/^[A-Za-z0-9._-]{3,40}$/.test(username)) {
        message.textContent = 'Username must be 3–40 characters using letters, numbers, dot, dash or underscore.';
        return;
      }

      message.textContent = 'Creating account…';
      const { error: passwordError } = await sb.auth.updateUser({ password });
      if (passwordError) {
        message.textContent = passwordError.message;
        return;
      }

      const { error: profileError } = await sb
        .from('profiles')
        .update({ username, full_name: fullName, account_setup_complete: true })
        .eq('id', me.id);
      if (profileError) {
        message.textContent = profileError.message;
        return;
      }

      sessionStorage.setItem('simworx-account-created', '1');
      await sb.auth.signOut();
      location.href = '/portal/?created=1';
    };
  }

  async function boot() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) {
      login.classList.remove('hidden');
      app.classList.add('hidden');
      return;
    }

    me = session.user;
    const { data: profile, error: profileError } = await sb
      .from('profiles')
      .select('id,email,full_name,username,account_setup_complete')
      .eq('id', me.id)
      .maybeSingle();
    if (profileError) {
      toast(profileError.message, true);
      return;
    }

    const recovery = location.hash.includes('type=recovery') || location.search.includes('recovery=1');
    if (recovery || !profile?.account_setup_complete) {
      setup(profile);
      return;
    }

    const { data: links, error: linkError } = await sb
      .from('company_users')
      .select('*,companies(id,legal_name,trading_name)')
      .eq('user_id', me.id)
      .eq('active', true);
    if (linkError) {
      toast(linkError.message, true);
      return;
    }
    if (!links?.length) {
      await sb.auth.signOut();
      alert('No active Simworx client access is assigned to this account.');
      return;
    }

    companyLinks = links;
    login.classList.add('hidden');
    app.classList.remove('hidden');
    document.getElementById('who').textContent = profile.username || me.email;
    await render();
  }

  document.getElementById('loginForm').onsubmit = async (event) => {
    event.preventDefault();
    const identifier = document.getElementById('identifier').value.trim();
    const password = document.getElementById('password').value;
    const message = document.getElementById('loginMsg');
    message.textContent = 'Signing in…';

    try {
      const invoke = sb.functions.invoke('client-password-login', { body: { identifier, password } });
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Login service timed out. Please try again.')), 12000));
      const { data, error } = await Promise.race([invoke, timeout]);
      if (error) throw error;
      if (!data?.access_token || !data?.refresh_token) throw new Error(data?.error || 'Login failed');
      const { error: sessionError } = await sb.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });
      if (sessionError) throw sessionError;
      message.textContent = '';
      await boot();
    } catch (error) {
      message.textContent = error?.message || 'Login failed';
    }
  };

  document.getElementById('forgotPassword').onclick = async () => {
    const email = prompt('Enter your registered email address:');
    if (!email) return;
    const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: 'https://sim-worx.com/portal/' });
    document.getElementById('loginMsg').textContent = error ? error.message : 'Password reset email sent.';
  };

  document.getElementById('signout').onclick = async () => {
    await sb.auth.signOut();
    location.reload();
  };

  if (new URLSearchParams(location.search).get('created') === '1' || sessionStorage.getItem('simworx-account-created') === '1') {
    sessionStorage.removeItem('simworx-account-created');
    const message = document.getElementById('loginMsg');
    if (message) message.innerHTML = '<strong>Account created successfully.</strong><br>You can now sign in with your username and password.';
  }

  document.querySelectorAll('#nav button').forEach((button) => {
    button.onclick = () => {
      document.querySelectorAll('#nav button').forEach((item) => item.classList.remove('active'));
      button.classList.add('active');
      view = button.dataset.view;
      render();
    };
  });

  function linkSupport() {
    return companyLinks.some((link) => link.active && link.can_support);
  }

  function linkBuild() {
    return companyLinks.some((link) => link.active && link.can_build_updates);
  }

  async function render() {
    content.innerHTML = '<div class="panel">Loading…</div>';
    try {
      if (view === 'dashboard') return await dashboard();
      if (view === 'support') return await support();
      if (view === 'new-ticket') return await newTicket();
      if (view === 'builds') return await builds();
    } catch (error) {
      content.innerHTML = `<div class="panel"><strong>Something went wrong.</strong><p>${esc(error?.message || error)}</p></div>`;
    }
  }

  async function dashboard() {
    const [ticketsResult, buildsResult] = await Promise.all([
      linkSupport()
        ? sb.from('tickets').select('id,status,reference,subject').order('created_at', { ascending: false }).limit(5)
        : Promise.resolve({ data: [] }),
      linkBuild()
        ? sb.from('builds').select('id,title,status,progress_percent,current_stage').order('created_at', { ascending: false })
        : Promise.resolve({ data: [] }),
    ]);

    const tickets = ticketsResult.data || [];
    const activeBuilds = (buildsResult.data || []).filter((item) => item.status !== 'complete');
    content.innerHTML = `
      <h1>Welcome</h1>
      <div class="cards">
        <div class="card">Open support requests<strong class="big">${tickets.filter((item) => !['resolved', 'closed'].includes(item.status)).length}</strong></div>
        <div class="card">Active builds<strong class="big">${activeBuilds.length}</strong></div>
        <div class="card">Account<strong class="big" style="font-size:18px">${esc(companyLinks[0]?.companies?.trading_name || companyLinks[0]?.companies?.legal_name)}</strong></div>
      </div>
      ${activeBuilds[0] ? `<div class="panel"><h3>Latest build</h3><strong>${esc(activeBuilds[0].title)}</strong><p>${activeBuilds[0].progress_percent}% complete · ${esc(activeBuilds[0].current_stage || activeBuilds[0].status)}</p></div>` : ''}`;
  }

  async function loadTicketAttachments(ticketId) {
    const { data, error } = await sb
      .from('ticket_attachments')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at');
    if (error) throw error;

    return await Promise.all((data || []).map(async (attachment) => {
      const { data: signed, error: signError } = await sb.storage.from(BUCKET).createSignedUrl(attachment.storage_path, 3600);
      return { ...attachment, url: signError ? null : signed?.signedUrl };
    }));
  }

  function attachmentHtml(attachment) {
    const mime = attachment.mime_type || '';
    const label = `${esc(attachment.file_name)} · ${formatBytes(attachment.size_bytes)}`;
    if (!attachment.url) return `<div class="file-card"><span>${label}</span><small>File unavailable</small></div>`;
    if (mime.startsWith('image/')) {
      return `<a class="media-card" href="${attachment.url}" target="_blank" rel="noopener"><img src="${attachment.url}" alt="${esc(attachment.file_name)}"><span>${label}</span></a>`;
    }
    if (mime.startsWith('video/')) {
      return `<div class="media-card"><video controls preload="metadata" src="${attachment.url}"></video><span>${label}</span></div>`;
    }
    return `<a class="file-card" href="${attachment.url}" target="_blank" rel="noopener"><strong>${esc(attachment.file_name)}</strong><small>${formatBytes(attachment.size_bytes)}</small></a>`;
  }

  async function uploadTicketFiles(ticket, files, messageId = null, statusElement = null) {
    const selected = Array.from(files || []);
    if (!selected.length) return;

    for (let index = 0; index < selected.length; index += 1) {
      const file = selected[index];
      if (file.size > MAX_FILE_BYTES) throw new Error(`${file.name} exceeds the 100 MB upload limit.`);
      if (statusElement) statusElement.textContent = `Uploading ${index + 1} of ${selected.length}: ${file.name}`;

      const path = `${ticket.company_id}/${ticket.id}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
      const { error: uploadError } = await sb.storage.from(BUCKET).upload(path, file, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });
      if (uploadError) throw uploadError;

      const { error: recordError } = await sb.from('ticket_attachments').insert({
        ticket_id: ticket.id,
        message_id: messageId,
        company_id: ticket.company_id,
        storage_path: path,
        file_name: file.name,
        mime_type: file.type || 'application/octet-stream',
        size_bytes: file.size,
        customer_visible: true,
      });
      if (recordError) {
        await sb.storage.from(BUCKET).remove([path]);
        throw recordError;
      }
    }
  }

  async function support() {
    if (!linkSupport()) {
      content.innerHTML = '<div class="panel">Support access is not enabled for this account.</div>';
      return;
    }
    const { data, error } = await sb
      .from('tickets')
      .select('id,reference,subject,priority,status,created_at,companies(trading_name,legal_name),projects(name)')
      .order('created_at', { ascending: false });
    if (error) throw error;

    content.innerHTML = `
      <h1>Support</h1>
      <div class="panel">
        <table class="table">
          <thead><tr><th>Reference</th><th>Simulator</th><th>Subject</th><th>Priority</th><th>Status</th><th></th></tr></thead>
          <tbody>${(data || []).map((ticketItem) => `
            <tr>
              <td>${esc(ticketItem.reference)}</td>
              <td>${esc(ticketItem.projects?.name || '')}</td>
              <td>${esc(ticketItem.subject)}</td>
              <td>${esc(ticketItem.priority)}</td>
              <td><span class="tag">${esc(ticketItem.status)}</span></td>
              <td><button class="btn ghost" data-open="${ticketItem.id}">Open</button></td>
            </tr>`).join('')}</tbody>
        </table>
      </div>`;
    document.querySelectorAll('[data-open]').forEach((button) => button.onclick = () => ticket(button.dataset.open));
  }

  async function ticket(id) {
    const [ticketResult, messagesResult, attachments] = await Promise.all([
      sb.from('tickets').select('*,projects(name),support_contracts(title,tier_name)').eq('id', id).single(),
      sb.from('ticket_messages').select('*,profiles(full_name,is_simworx)').eq('ticket_id', id).order('created_at'),
      loadTicketAttachments(id),
    ]);
    if (ticketResult.error) throw ticketResult.error;
    if (messagesResult.error) throw messagesResult.error;

    const ticketData = ticketResult.data;
    const messages = messagesResult.data || [];
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
        <div class="panel">
          <h3>Request details</h3>
          <p><strong>Status:</strong> ${esc(ticketData.status)}</p>
          <p><strong>Priority:</strong> ${esc(ticketData.priority)}</p>
          <p><strong>Support contract:</strong><br>${esc(ticketData.support_contracts?.tier_name || ticketData.support_contracts?.title || 'Not assigned')}</p>
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
        .insert({
          ticket_id: ticketData.id,
          company_id: ticketData.company_id,
          author_id: me.id,
          body: body || null,
          visibility: 'customer',
        })
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

  async function newTicket() {
    if (!linkSupport()) {
      content.innerHTML = '<div class="panel">Support access is not enabled for this account.</div>';
      return;
    }

    const companyIds = currentCompanyIds(true);
    const [projectsResult, contractsResult, linksResult, categoriesResult] = await Promise.all([
      sb.from('projects').select('id,name,company_id,simulator_model,serial_number').in('company_id', companyIds).eq('active', true).order('name'),
      sb.from('support_contracts').select('id,company_id,title,tier_name,status,starts_on,ends_on').in('company_id', companyIds).eq('status', 'active'),
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
    const coverage = new Map();
    links.forEach((link) => {
      const contract = activeContracts.find((item) => item.id === link.contract_id);
      if (contract) (coverage.get(link.project_id) || coverage.set(link.project_id, []).get(link.project_id)).push(contract);
    });

    content.innerHTML = `
      <h1>Log a Fault</h1>
      <div class="panel">
        <form id="fault" class="stack">
          <label>Simulator
            <select id="project" required>
              <option value="">Select simulator…</option>
              ${projects.map((project) => `<option value="${project.id}">${esc(project.name)}${project.serial_number ? ` · S/N ${esc(project.serial_number)}` : ''}</option>`).join('')}
            </select>
          </label>
          <div id="contractPanel" class="contract-status muted">Select a simulator to see its support contract.</div>
          <label id="contractField" class="hidden">Support contract<select id="contract"></select></label>
          <label>Priority
            <select id="priority">
              <option value="P3">P3 — Normal</option>
              <option value="P2">P2 — High</option>
              <option value="P1">P1 — Critical</option>
              <option value="P4">P4 — Low</option>
            </select>
          </label>
          <label>Category
            <select id="category"><option value="">General / Other</option>${(categoriesResult.data || []).map((category) => `<option value="${category.id}">${esc(category.name)}</option>`).join('')}</select>
          </label>
          <input id="subject" placeholder="Short fault description" required>
          <textarea id="overview" placeholder="Describe what happened, when it started, and any troubleshooting already attempted." required></textarea>
          <label class="upload-box">Attach images, video clips, PDFs or ZIP files
            <input id="faultFiles" type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,video/mp4,video/webm,video/quicktime,application/pdf,text/plain,application/zip">
          </label>
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

    projectSelect.onchange = () => {
      const contractsForProject = coverage.get(projectSelect.value) || [];
      contractSelect.innerHTML = contractsForProject.map((contract) => `<option value="${contract.id}">${esc(contract.tier_name)} — ${esc(contract.title)}</option>`).join('');
      if (!projectSelect.value) {
        contractField.classList.add('hidden');
        contractPanel.textContent = 'Select a simulator to see its support contract.';
        contractPanel.className = 'contract-status muted';
        submitButton.disabled = true;
      } else if (!contractsForProject.length) {
        contractField.classList.add('hidden');
        contractPanel.textContent = 'No active support contract is allocated to this simulator. Simworx Admin must assign one before a fault can be submitted.';
        contractPanel.className = 'contract-status error';
        submitButton.disabled = true;
      } else {
        contractField.classList.toggle('hidden', contractsForProject.length === 1);
        contractPanel.innerHTML = `<strong>${esc(contractsForProject[0].tier_name)}</strong><br>${esc(contractsForProject[0].title)}`;
        contractPanel.className = 'contract-status ok';
        submitButton.disabled = false;
      }
    };

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
  }

  async function builds() {
    if (!linkBuild()) {
      content.innerHTML = '<div class="panel">Build Update access is not enabled for this account.</div>';
      return;
    }
    const { data, error } = await sb
      .from('builds')
      .select('id,title,build_number,status,progress_percent,current_stage,target_delivery_date,companies(trading_name,legal_name)')
      .order('created_at', { ascending: false });
    if (error) throw error;

    content.innerHTML = `<h1>Build Update</h1><div class="grid">${(data || []).map((buildItem) => `
      <div class="card">
        <span class="muted">${esc(buildItem.build_number || 'SIMWORX BUILD')}</span>
        <h2>${esc(buildItem.title)}</h2>
        <strong class="big">${buildItem.progress_percent}%</strong>
        <p>${esc(buildItem.current_stage || buildItem.status)}</p>
        <button class="btn primary" data-build="${buildItem.id}">VIEW BUILD</button>
      </div>`).join('')}</div>`;
    document.querySelectorAll('[data-build]').forEach((button) => button.onclick = () => build(button.dataset.build));
  }

  async function build(id) {
    const [buildResult, milestonesResult, updatesResult, issuesResult, commentsResult] = await Promise.all([
      sb.from('builds').select('*').eq('id', id).single(),
      sb.from('build_milestones').select('*').eq('build_id', id).order('sort_order'),
      sb.from('build_updates').select('*,profiles(full_name)').eq('build_id', id).order('created_at', { ascending: false }),
      sb.from('build_issues').select('*').eq('build_id', id).order('created_at', { ascending: false }),
      sb.from('build_comments').select('*,profiles(full_name,is_simworx)').eq('build_id', id).order('created_at'),
    ]);
    const error = buildResult.error || milestonesResult.error || updatesResult.error || issuesResult.error || commentsResult.error;
    if (error) throw error;

    const buildData = buildResult.data;
    content.innerHTML = `
      <button id="backBuild" class="btn ghost">← All builds</button>
      <h1>${esc(buildData.title)}</h1>
      <div class="cards">
        <div class="card">Progress<strong class="big">${buildData.progress_percent}%</strong></div>
        <div class="card">Current stage<strong class="big" style="font-size:18px">${esc(buildData.current_stage || '—')}</strong></div>
        <div class="card">Status<strong class="big" style="font-size:18px">${esc(buildData.status)}</strong></div>
      </div>
      <div class="grid">
        <div>
          <div class="panel"><h2>Updates</h2><div class="timeline">${(updatesResult.data || []).map((item) => `<div class="update"><strong>${esc(item.title)}</strong><p>${esc(item.body)}</p><span class="muted">${new Date(item.created_at).toLocaleDateString()}</span></div>`).join('') || '<p class="muted">No updates published yet.</p>'}</div></div>
          <div class="panel"><h2>Build conversation</h2>${(commentsResult.data || []).map((item) => `<div class="comment" style="${item.profiles?.is_simworx ? 'background:#fff4d7' : ''}"><strong>${item.profiles?.is_simworx ? 'Simworx' : esc(item.profiles?.full_name || 'Client')}</strong><div>${esc(item.body)}</div></div>`).join('')}<form id="commentForm" class="stack"><textarea id="commentBody" placeholder="Ask a question or comment on the build…" required></textarea><button class="btn primary">POST COMMENT</button></form></div>
        </div>
        <div>
          <div class="panel"><h2>Milestones</h2>${(milestonesResult.data || []).map((item) => `<p><span class="tag">${esc(item.status)}</span> <strong>${esc(item.title)}</strong><br><span class="muted">${item.target_date || ''}</span></p>`).join('')}</div>
          <div class="panel"><h2>Issues</h2>${(issuesResult.data || []).map((item) => `<p><strong>${esc(item.title)}</strong> <span class="tag">${esc(item.status)}</span><br><span class="muted">${esc(item.description || '')}</span></p>`).join('') || '<p class="muted">No client-visible build issues.</p>'}</div>
        </div>
      </div>`;

    document.getElementById('backBuild').onclick = builds;
    document.getElementById('commentForm').onsubmit = async (event) => {
      event.preventDefault();
      const { error: commentError } = await sb.from('build_comments').insert({
        build_id: id,
        company_id: buildData.company_id,
        author_id: me.id,
        body: document.getElementById('commentBody').value,
      });
      if (commentError) return toast(commentError.message, true);
      toast('Comment posted');
      await build(id);
    };
  }

  sb.auth.onAuthStateChange(() => setTimeout(boot, 0));
  boot();
})();
