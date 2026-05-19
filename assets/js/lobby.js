'use strict';

const APP_BASE = document.body?.dataset.appBase || '';

function appUrl(path) {
  if (!path) return APP_BASE || '/';
  if (/^(?:https?:)?\/\//.test(path) || path.startsWith('data:') || path.startsWith('blob:')) return path;
  if (!path.startsWith('/')) return path;
  if (APP_BASE && path.startsWith(`${APP_BASE}/`)) return path;
  return `${APP_BASE}${path}`;
}

const backgroundInput = document.getElementById('room-background-input');
const backgroundName = document.getElementById('room-background-name');
const createRoomForm = document.getElementById('create-room-form');
const createRoomProgress = document.getElementById('room-upload-progress');

if (backgroundInput && backgroundName) {
  backgroundInput.addEventListener('change', () => {
    const file = backgroundInput.files && backgroundInput.files[0];
    backgroundName.textContent = file ? file.name : 'No file selected';
  });
}

const lobbyMenu = document.getElementById('lobby-menu');
const lobbyMenuBtn = document.getElementById('lobby-menu-btn');

lobbyMenuBtn?.addEventListener('click', e => {
  e.stopPropagation();
  lobbyMenu.classList.toggle('visible');
});

document.addEventListener('click', e => {
  if (!lobbyMenu || lobbyMenu.contains(e.target) || e.target === lobbyMenuBtn) return;
  lobbyMenu.classList.remove('visible');
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') lobbyMenu?.classList.remove('visible');
});

const lobbyRoomEditModal = document.getElementById('lobby-room-edit-modal');
const lobbyRoomEditForm = document.getElementById('lobby-room-edit-form');
const lobbyRoomEditName = document.getElementById('lobby-room-edit-name');
const lobbyRoomEditId = document.getElementById('lobby-room-edit-id');
const lobbyRoomEditBackground = document.getElementById('lobby-room-edit-background');
const lobbyRoomEditBackgroundName = document.getElementById('lobby-room-edit-background-name');
const lobbyRoomEditProgress = document.getElementById('lobby-room-edit-upload-progress');
const lobbyRoomEjectionList = document.getElementById('lobby-room-ejection-list');
const lobbyRoomEditPreview = document.getElementById('lobby-room-edit-preview');
const passwordModal = document.getElementById('password-modal');
const passwordForm = document.getElementById('password-form');
const passwordStatus = document.getElementById('password-status');

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}

function setLobbyRoomPreview(path, mime = '') {
  if (!lobbyRoomEditPreview) return;
  const safePath = path ? esc(path) : '';
  const safeMime = esc(mime || '');
  if (!safePath) {
    lobbyRoomEditPreview.innerHTML = '<div class="room-edit-preview-empty">No background selected</div>';
    return;
  }
  if (String(mime || '').startsWith('video/')) {
    lobbyRoomEditPreview.innerHTML = `<video muted loop playsinline preload="metadata"><source src="${safePath}" type="${safeMime}"></video>`;
    return;
  }
  lobbyRoomEditPreview.innerHTML = `<img src="${safePath}" alt="Current room background">`;
}

async function lobbyApiPost(url, body) {
  const resp = await fetch(appUrl(url), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || data.error) throw new Error(data.error || 'Request failed');
  return data;
}

function setUploadProgress(progressEl, pct, message) {
  if (!progressEl) return;
  const bounded = Math.max(0, Math.min(100, Math.round(pct)));
  progressEl.classList.add('open');
  const bar = progressEl.querySelector('.upload-progress-bar');
  const pctEl = progressEl.querySelector('.upload-progress-pct');
  const msgEl = progressEl.querySelector('.upload-progress-msg');
  if (bar) bar.style.width = `${bounded}%`;
  if (pctEl) pctEl.textContent = `${bounded}%`;
  if (msgEl) msgEl.textContent = message || (bounded >= 100 ? 'Processing...' : 'Uploading...');
}

function resetUploadProgress(progressEl) {
  if (!progressEl) return;
  progressEl.classList.remove('open');
  setUploadProgress(progressEl, 0, 'Waiting...');
  progressEl.classList.remove('open');
}

function uploadFormWithProgress(form, url, progressEl) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const submitBtn = form.querySelector('button[type="submit"]');
    const previousDisabled = submitBtn ? submitBtn.disabled : false;
    if (submitBtn) submitBtn.disabled = true;
    setUploadProgress(progressEl, 0, 'Uploading...');

    xhr.upload.addEventListener('progress', event => {
      if (!event.lengthComputable) {
        setUploadProgress(progressEl, 5, 'Uploading...');
        return;
      }
      const pct = (event.loaded / event.total) * 100;
      setUploadProgress(progressEl, pct, pct >= 100 ? 'Processing...' : 'Uploading...');
    });

    xhr.addEventListener('load', () => {
      setUploadProgress(progressEl, 100, 'Processing...');
      if (submitBtn) submitBtn.disabled = previousDisabled;
      if (xhr.status >= 200 && xhr.status < 400) {
        resolve(xhr);
        return;
      }
      reject(new Error(xhr.responseText || 'Upload failed'));
    });

    xhr.addEventListener('error', () => {
      if (submitBtn) submitBtn.disabled = previousDisabled;
      reject(new Error('Upload failed. The file may be too large or the connection may have dropped.'));
    });

    xhr.addEventListener('abort', () => {
      if (submitBtn) submitBtn.disabled = previousDisabled;
      reject(new Error('Upload canceled.'));
    });

    xhr.open('POST', url);
    xhr.send(new FormData(form));
  });
}

async function loadLobbyRoomEjections(roomPublicId) {
  if (!lobbyRoomEjectionList || !roomPublicId) return;
  lobbyRoomEjectionList.innerHTML = '<div class="minor">Loading...</div>';
  try {
    const data = await fetch(appUrl('/api/room_ejections.php?room_public_id=' + encodeURIComponent(roomPublicId))).then(r => r.json());
    lobbyRoomEjectionList.innerHTML = '';
    if (!(data.ejections || []).length) {
      lobbyRoomEjectionList.innerHTML = '<div class="minor">No active kicks.</div>';
      return;
    }
    (data.ejections || []).forEach(ejection => {
      const row = document.createElement('div');
      row.className = 'ejection-row';
      const duration = ejection.permanent ? 'Permanent' : `${ejection.duration_minutes} minutes`;
      row.innerHTML = `<div><strong>${esc(ejection.display_name)}</strong><div class="minor">${esc(duration)} · by ${esc(ejection.ejected_by_name)}</div></div><button class="btn btn-danger" type="button">Delete</button>`;
      row.querySelector('button').addEventListener('click', async () => {
        await lobbyApiPost('/api/room_ejections.php', { action: 'delete', room_public_id: roomPublicId, id: ejection.id });
        await loadLobbyRoomEjections(roomPublicId);
      });
      lobbyRoomEjectionList.appendChild(row);
    });
  } catch (err) {
    lobbyRoomEjectionList.innerHTML = `<div class="minor">${esc(err.message || 'Could not load kicked users.')}</div>`;
  }
}

createRoomForm?.addEventListener('submit', async e => {
  if (!backgroundInput?.files?.length) return;
  e.preventDefault();
  try {
    await uploadFormWithProgress(createRoomForm, createRoomForm.action || window.location.href, createRoomProgress);
    window.location.reload();
  } catch (err) {
    alert(err.message || err);
    resetUploadProgress(createRoomProgress);
  }
});

document.querySelectorAll('.room-edit-open').forEach(btn => {
  btn.addEventListener('click', () => {
    lobbyRoomEditId.value = btn.dataset.roomId || '';
    lobbyRoomEditName.value = btn.dataset.roomName || '';
    lobbyRoomEditBackground.value = '';
    lobbyRoomEditBackgroundName.textContent = 'No file selected';
    resetUploadProgress(lobbyRoomEditProgress);
    setLobbyRoomPreview(btn.dataset.roomBg || '', btn.dataset.roomMime || '');
    lobbyRoomEditModal.classList.add('open');
    loadLobbyRoomEjections(lobbyRoomEditId.value);
  });
});

document.getElementById('lobby-room-edit-close')?.addEventListener('click', () => {
  lobbyRoomEditModal.classList.remove('open');
});

document.getElementById('lobby-ejection-understand')?.addEventListener('click', () => {
  document.getElementById('lobby-ejection-modal')?.classList.remove('open');
});

lobbyRoomEditBackground?.addEventListener('change', () => {
  const file = lobbyRoomEditBackground.files && lobbyRoomEditBackground.files[0];
  lobbyRoomEditBackgroundName.textContent = file ? file.name : 'No file selected';
  if (file) setLobbyRoomPreview(URL.createObjectURL(file), file.type);
});

lobbyRoomEditForm?.addEventListener('submit', async e => {
  e.preventDefault();
  try {
    const resp = await uploadFormWithProgress(lobbyRoomEditForm, appUrl('/api/room_update.php'), lobbyRoomEditProgress);
    const data = JSON.parse(resp.responseText || '{}');
    if (data.error) throw new Error(data.error);
    window.location.reload();
  } catch (err) {
    alert(err.message || 'Room update failed');
    resetUploadProgress(lobbyRoomEditProgress);
  }
});

function closePasswordModal() {
  passwordModal?.classList.remove('open');
  passwordForm?.reset();
  if (passwordStatus) {
    passwordStatus.textContent = '';
    passwordStatus.className = 'password-status';
  }
}

document.getElementById('password-open')?.addEventListener('click', () => {
  lobbyMenu?.classList.remove('visible');
  passwordModal?.classList.add('open');
  document.getElementById('password-old')?.focus();
});

document.getElementById('password-close')?.addEventListener('click', closePasswordModal);
document.getElementById('password-cancel')?.addEventListener('click', closePasswordModal);

passwordForm?.addEventListener('submit', async e => {
  e.preventDefault();
  if (passwordStatus) {
    passwordStatus.textContent = '';
    passwordStatus.className = 'password-status';
  }
  const form = e.currentTarget;
  try {
    await lobbyApiPost('/api/account.php', {
      action: 'update_password',
      old_password: form.old_password.value,
      new_password: form.new_password.value,
      confirm_password: form.confirm_password.value,
    });
    if (passwordStatus) {
      passwordStatus.textContent = 'Password updated.';
      passwordStatus.classList.add('ok');
    }
    form.reset();
  } catch (err) {
    if (passwordStatus) {
      passwordStatus.textContent = err.message || 'Could not update password.';
      passwordStatus.classList.add('error-text');
    }
  }
});

const adminModal = document.getElementById('admin-modal');
const adminUsers = document.getElementById('admin-users');
const adminToolLogs = document.getElementById('admin-tool-logs');
const adminBlocks = document.getElementById('admin-blocks');
const adminRoomEjections = document.getElementById('admin-room-ejections');
const adminCommunityEjections = document.getElementById('admin-community-ejections');
const adminSettings = document.getElementById('admin-settings');
const adminDbRestore = document.getElementById('admin-db-restore');
const adminCounts = {
  users: document.getElementById('admin-user-count'),
  logs: document.getElementById('admin-log-count'),
  moderation: document.getElementById('admin-moderation-count'),
  summaryUsers: document.getElementById('admin-summary-users'),
  summaryModeration: document.getElementById('admin-summary-moderation'),
};
const adminModerationTotals = { blocks: 0, roomEjections: 0, communityEjections: 0 };

function setAdminCount(el, value) {
  if (el) el.textContent = String(value);
}

function refreshAdminModerationCount() {
  const total = adminModerationTotals.blocks + adminModerationTotals.roomEjections + adminModerationTotals.communityEjections;
  setAdminCount(adminCounts.moderation, total);
  setAdminCount(adminCounts.summaryModeration, total);
}

function setAdminFormStatus(form, message, type = '') {
  const status = form?.querySelector?.('.admin-row-status, .admin-form-status');
  if (!status) return;
  status.textContent = message || '';
  status.className = `${status.classList.contains('admin-form-status') ? 'admin-form-status' : 'admin-row-status'} ${type}`.trim();
}

function showAdminSection(id) {
  document.querySelectorAll('.admin-section').forEach(section => {
    section.classList.toggle('active', section.id === `admin-section-${id}`);
  });
  document.querySelectorAll('.admin-nav-item[data-admin-section]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.adminSection === id);
  });
}

document.addEventListener('click', e => {
  const nav = e.target.closest('.admin-nav-item[data-admin-section]');
  if (nav) {
    showAdminSection(nav.dataset.adminSection);
    return;
  }
  const jump = e.target.closest('[data-admin-jump]');
  if (jump) showAdminSection(jump.dataset.adminJump);
});

async function adminRequest(body) {
  const resp = await fetch(appUrl('/api/admin_users.php'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || data.error) throw new Error(data.error || 'Admin request failed');
  return data;
}

async function adminSystemRequest(body) {
  const resp = await fetch(appUrl('/api/admin_system.php'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || data.error) throw new Error(data.error || 'Admin request failed');
  return data;
}

async function loadAdminUsers() {
  if (!adminUsers) return;
  const data = await fetch(appUrl('/api/admin_users.php')).then(r => r.json());
  adminUsers.innerHTML = '';
  setAdminCount(adminCounts.users, (data.users || []).length);
  setAdminCount(adminCounts.summaryUsers, (data.users || []).length);
  (data.users || []).forEach(user => {
    const row = document.createElement('form');
    row.className = 'admin-user-row';
    row.innerHTML = `<div><strong>${user.display_name}</strong><div class="minor">${user.email}</div></div>
      <select name="role">
        <option value="user">User</option>
        <option value="guide">Guide</option>
        <option value="developer">Developer</option>
        <option value="admin">Admin</option>
      </select>
      <input name="password" type="password" placeholder="New password">
      <button class="btn btn-primary" type="submit">Save</button>
      <button class="btn btn-danger" type="button">Delete</button>
      <div class="admin-row-status" aria-live="polite"></div>`;
    row.querySelector('select').value = user.role || 'user';
    row.addEventListener('submit', async e => {
      e.preventDefault();
      const saveBtn = row.querySelector('button[type="submit"]');
      saveBtn.disabled = true;
      setAdminFormStatus(row, 'Saving...', 'working');
      try {
        await adminRequest({ action: 'update', id: user.id, role: row.elements.role.value, password: row.elements.password.value });
        row.elements.password.value = '';
        setAdminFormStatus(row, 'Saved.', 'ok');
        await loadAdminLogs();
      } catch (err) {
        setAdminFormStatus(row, err.message || 'Save failed.', 'error');
      } finally {
        saveBtn.disabled = false;
      }
    });
    row.querySelector('.btn-danger').addEventListener('click', async () => {
      if (!confirm(`Delete ${user.display_name}?`)) return;
      await adminRequest({ action: 'delete', id: user.id });
      await loadAdminUsers();
    });
    adminUsers.appendChild(row);
  });
}

async function loadAdminSettings() {
  if (!adminSettings) return;
  const data = await fetch(appUrl('/api/admin_system.php?action=settings')).then(r => r.json());
  Object.entries(data.settings || {}).forEach(([key, value]) => {
    if (adminSettings.elements[key]) adminSettings.elements[key].value = value;
  });
}

function adminRow(main, detail, buttonText, onClick) {
  const row = document.createElement('div');
  row.className = 'admin-list-row';
  row.innerHTML = `<div><strong>${esc(main)}</strong><div class="minor">${esc(detail || '')}</div></div>${buttonText ? `<button class="btn btn-danger" type="button">${esc(buttonText)}</button>` : ''}`;
  if (buttonText) row.querySelector('button').addEventListener('click', onClick);
  return row;
}

async function loadAdminLogs() {
  if (!adminToolLogs) return;
  const data = await fetch(appUrl('/api/admin_system.php?action=logs')).then(r => r.json());
  adminToolLogs.innerHTML = '';
  setAdminCount(adminCounts.logs, (data.logs || []).length);
  if (!(data.logs || []).length) {
    adminToolLogs.innerHTML = '<div class="minor">No tool logs yet.</div>';
    return;
  }
  (data.logs || []).forEach(log => {
    adminToolLogs.appendChild(adminRow(`${log.action} · ${log.actor_name}`, `${log.target_name || 'No target'} ${log.room_name ? '· ' + log.room_name : ''} · ${log.created_at}${log.detail ? ' · ' + log.detail : ''}`));
  });
}

async function loadAdminBlocks() {
  if (!adminBlocks) return;
  const data = await fetch(appUrl('/api/admin_system.php?action=blocks')).then(r => r.json());
  adminBlocks.innerHTML = '';
  adminModerationTotals.blocks = (data.blocks || []).length;
  refreshAdminModerationCount();
  if (!(data.blocks || []).length) {
    adminBlocks.innerHTML = '<div class="minor">No active user blocks.</div>';
    return;
  }
  (data.blocks || []).forEach(block => {
    adminBlocks.appendChild(adminRow(`${block.blocker_name} blocked ${block.blocked_name}`, block.created_at, 'Remove Block', async () => {
      await adminSystemRequest({ action: 'remove_block', blocker_user_id: block.blocker_user_id, blocked_user_id: block.blocked_user_id });
      await loadAdminBlocks();
      await loadAdminLogs();
    }));
  });
}

async function loadAdminCommunityEjections() {
  if (!adminCommunityEjections) return;
  const data = await fetch(appUrl('/api/admin_system.php?action=community_ejections')).then(r => r.json());
  adminCommunityEjections.innerHTML = '';
  adminModerationTotals.communityEjections = (data.ejections || []).length;
  refreshAdminModerationCount();
  if (!(data.ejections || []).length) {
    adminCommunityEjections.innerHTML = '<div class="minor">No active community ejections.</div>';
    return;
  }
  (data.ejections || []).forEach(ejection => {
    const duration = ejection.permanent ? 'Forever' : `Until ${new Date(String(ejection.expires_at).replace(' ', 'T') + 'Z').toLocaleString()}`;
    adminCommunityEjections.appendChild(adminRow(ejection.display_name, `${duration} · by ${ejection.ejected_by_name}${ejection.reason ? ' · ' + ejection.reason : ''}`, 'Undo', async () => {
      await adminSystemRequest({ action: 'undo_community_ejection', id: ejection.id });
      await loadAdminCommunityEjections();
      await loadAdminLogs();
    }));
  });
}

async function loadAdminRoomEjections() {
  if (!adminRoomEjections) return;
  const data = await fetch(appUrl('/api/admin_system.php?action=room_ejections')).then(r => r.json());
  adminRoomEjections.innerHTML = '';
  adminModerationTotals.roomEjections = (data.ejections || []).length;
  refreshAdminModerationCount();
  if (!(data.ejections || []).length) {
    adminRoomEjections.innerHTML = '<div class="minor">No active room kicks.</div>';
    return;
  }
  (data.ejections || []).forEach(ejection => {
    const duration = ejection.permanent ? 'Permanent' : `Until ${new Date(String(ejection.expires_at).replace(' ', 'T') + 'Z').toLocaleString()}`;
    adminRoomEjections.appendChild(adminRow(`${ejection.display_name} · ${ejection.room_name}`, `${duration} · by ${ejection.ejected_by_name}`, 'Undo', async () => {
      await adminSystemRequest({ action: 'undo_room_ejection', id: ejection.id });
      await loadAdminRoomEjections();
      await loadAdminLogs();
    }));
  });
}

async function loadAdminDashboard() {
  await Promise.all([
    loadAdminUsers(),
    loadAdminSettings(),
    loadAdminLogs(),
    loadAdminBlocks(),
    loadAdminRoomEjections(),
    loadAdminCommunityEjections(),
  ]);
}

document.getElementById('admin-open')?.addEventListener('click', async () => {
  lobbyMenu?.classList.remove('visible');
  adminModal.classList.add('open');
  showAdminSection('overview');
  await loadAdminDashboard();
});

document.getElementById('admin-close')?.addEventListener('click', () => {
  adminModal.classList.remove('open');
});

document.getElementById('admin-create')?.addEventListener('submit', async e => {
  e.preventDefault();
  const form = e.currentTarget;
  const submit = form.querySelector('button[type="submit"]');
  submit.disabled = true;
  setAdminFormStatus(form, 'Creating...', 'working');
  try {
    await adminRequest({
      action: 'create',
      display_name: form.elements.display_name.value,
      email: form.elements.email.value,
      password: form.elements.password.value,
      role: form.elements.role.value,
    });
    form.reset();
    setAdminFormStatus(form, 'User created.', 'ok');
    await loadAdminUsers();
    await loadAdminLogs();
  } catch (err) {
    setAdminFormStatus(form, err.message || 'Create failed.', 'error');
  } finally {
    submit.disabled = false;
  }
});

adminSettings?.addEventListener('submit', async e => {
  e.preventDefault();
  const form = e.currentTarget;
  const submit = form.querySelector('button[type="submit"]');
  submit.disabled = true;
  setAdminFormStatus(form, 'Saving settings...', 'working');
  try {
    await adminSystemRequest({
      action: 'save_settings',
      chat_posts_per_second: form.elements.chat_posts_per_second.value,
      avatar_movements_per_second: form.elements.avatar_movements_per_second.value,
      avatar_max_size_mb: form.elements.avatar_max_size_mb.value,
      room_image_max_size_mb: form.elements.room_image_max_size_mb.value,
      room_video_max_size_mb: form.elements.room_video_max_size_mb.value,
      participant_idle_timeout_minutes: form.elements.participant_idle_timeout_minutes.value,
    });
    setAdminFormStatus(form, 'Settings saved.', 'ok');
    await loadAdminLogs();
  } catch (err) {
    setAdminFormStatus(form, err.message || 'Settings failed to save.', 'error');
  } finally {
    submit.disabled = false;
  }
});

adminDbRestore?.database?.addEventListener('change', () => {
  const file = adminDbRestore.database.files && adminDbRestore.database.files[0];
  document.getElementById('admin-db-restore-name').textContent = file ? file.name : 'No file selected';
});

adminDbRestore?.addEventListener('submit', async e => {
  e.preventDefault();
  const resp = await fetch(appUrl('/api/admin_database.php'), { method: 'POST', body: new FormData(adminDbRestore) });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || data.error) {
    alert(data.error || 'Database restore failed');
    return;
  }
  window.location.reload();
});
