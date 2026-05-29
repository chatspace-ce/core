'use strict';

const APP_BASE = document.body?.dataset.appBase || '';
const CSRF_TOKEN = document.body?.dataset.csrf || '';

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
const roomGrid = document.getElementById('room-grid');
const lobbyRoomIds = new Set([...document.querySelectorAll('.room-card[data-room-id]')].map(card => card.dataset.roomId));
let lobbyPollTimer = null;

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
const lobbyRoomDeleteModal = document.getElementById('lobby-room-delete-modal');
const lobbyToast = document.getElementById('lobby-toast');
const passwordModal = document.getElementById('password-modal');
const passwordForm = document.getElementById('password-form');
const passwordStatus = document.getElementById('password-status');
const recoveryModal = document.getElementById('recovery-modal');
const recoveryCard = document.getElementById('recovery-card');
const recoveryStatus = document.getElementById('recovery-status');
const recoveryGenerate = document.getElementById('recovery-generate');

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}

function redirectToLogin() {
  window.location.href = appUrl('/login.php');
}

function roomCardSelector(id) {
  if (window.CSS?.escape) return `.room-card[data-room-id="${CSS.escape(id)}"]`;
  return `.room-card[data-room-id="${String(id).replace(/"/g, '\\"')}"]`;
}

function roomVideoPlaceholder(room) {
  return room?.video_without_thumb ? '<div class="room-video-placeholder">Video Room</div>' : '';
}

function roomCardHtml(room) {
  const bg = room.tile_background_url ? ` style="background-image:url('${esc(room.tile_background_url)}')"` : '';
  const edit = room.can_edit
    ? `<button class="btn btn-primary room-edit-open" type="button" data-room-id="${esc(room.public_id)}" data-room-name="${esc(room.name)}" data-room-bg="${esc(room.background_url || '')}" data-room-thumb="${esc(room.thumb_url || '')}" data-room-mime="${esc(room.background_mime || '')}">Edit</button>`
    : '';
  return `<div class="room-card-media"${bg}>${roomVideoPlaceholder(room)}</div>
    <div class="room-card-body">
      <h2 class="room-card-name">${esc(room.name)}</h2>
      <div class="minor room-card-meta"><span class="room-card-count">${Number(room.online_count || 0)}</span> online · made by <span class="room-card-owner">${esc(room.owner_name)}</span></div>
      <p class="room-card-actions">
        <a class="btn btn-primary" href="${esc(room.enter_url)}">Enter</a>
        ${edit}
      </p>
    </div>`;
}

function roomCardFor(room, animate = false) {
  const card = document.createElement('article');
  card.className = `room-card${animate ? ' room-card-entering' : ''}`;
  card.dataset.roomId = room.public_id;
  card.innerHTML = roomCardHtml(room);
  if (animate) {
    requestAnimationFrame(() => card.classList.add('show'));
    window.setTimeout(() => card.classList.remove('room-card-entering', 'show'), 520);
  }
  return card;
}

function updateRoomCard(card, room) {
  if (!card) return;
  const name = card.querySelector('.room-card-name');
  const count = card.querySelector('.room-card-count');
  const owner = card.querySelector('.room-card-owner');
  const enter = card.querySelector('.room-card-actions a');
  const edit = card.querySelector('.room-edit-open');
  if (name && name.textContent !== room.name) name.textContent = room.name;
  if (count && count.textContent !== String(Number(room.online_count || 0))) count.textContent = String(Number(room.online_count || 0));
  if (owner && owner.textContent !== room.owner_name) owner.textContent = room.owner_name;
  if (enter) enter.href = room.enter_url;
  if (edit) {
    edit.dataset.roomId = room.public_id;
    edit.dataset.roomName = room.name;
    edit.dataset.roomBg = room.background_url || '';
    edit.dataset.roomThumb = room.thumb_url || '';
    edit.dataset.roomMime = room.background_mime || '';
  }
}

function insertRoomCard(room, animate = true) {
  if (!roomGrid || !room?.public_id || lobbyRoomIds.has(room.public_id)) return null;
  const card = roomCardFor(room, animate);
  const firstRoom = roomGrid.querySelector('.room-card[data-room-id]');
  roomGrid.insertBefore(card, firstRoom || null);
  lobbyRoomIds.add(room.public_id);
  return card;
}

function removeMissingRoomCards(activeIds) {
  document.querySelectorAll('.room-card[data-room-id]').forEach(card => {
    const id = card.dataset.roomId;
    if (activeIds.has(id)) return;
    lobbyRoomIds.delete(id);
    card.classList.add('room-card-leaving');
    window.setTimeout(() => card.remove(), 260);
  });
}

function applyLobbyRooms(rooms = []) {
  const activeIds = new Set();
  rooms.forEach(room => {
    activeIds.add(room.public_id);
    const existing = document.querySelector(roomCardSelector(room.public_id));
    if (existing) updateRoomCard(existing, room);
    else insertRoomCard(room, true);
  });
  removeMissingRoomCards(activeIds);
}

async function pollLobbyRooms() {
  clearTimeout(lobbyPollTimer);
  try {
    const resp = await fetch(appUrl('/api/lobby_rooms.php'), { cache: 'no-store' });
    if (resp.status === 401) {
      redirectToLogin();
      return;
    }
    const data = await resp.json().catch(() => ({}));
    if (data.redirect_url) {
      window.location.href = data.redirect_url;
      return;
    }
    if (!resp.ok || data.error) throw new Error(data.error || 'Could not refresh lobby.');
    applyLobbyRooms(data.rooms || []);
  } catch (err) {
    console.warn(err);
  }
  lobbyPollTimer = window.setTimeout(pollLobbyRooms, 7000);
}

function parseServerDate(value) {
  if (!value) return null;
  const date = new Date(String(value).replace(' ', 'T') + 'Z');
  return Number.isNaN(date.getTime()) ? null : date;
}

function relativeTimeLabel(date) {
  if (!date) return '';
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const units = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];
  const formatter = new Intl.RelativeTimeFormat([], { numeric: 'auto' });
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return formatter.format(Math.round(seconds / size), unit);
  }
  return formatter.format(seconds, 'second');
}

function adminCreatedOn(value) {
  const date = parseServerDate(value);
  if (!date) return 'Unknown';
  const absolute = date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  return `${absolute} <span>${esc(relativeTimeLabel(date))}</span>`;
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
  const payload = Object.assign({}, body || {}, { _csrf: CSRF_TOKEN });
  const resp = await fetch(appUrl(url), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': CSRF_TOKEN },
    body: JSON.stringify(payload),
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

function videoThumbnailBlob(file) {
  return new Promise((resolve) => {
    if (!file || !String(file.type || '').startsWith('video/')) {
      resolve(null);
      return;
    }
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    const cleanup = () => URL.revokeObjectURL(url);
    video.muted = true;
    video.preload = 'metadata';
    video.playsInline = true;
    video.addEventListener('loadeddata', () => {
      try {
        video.currentTime = Math.min(1, Math.max(0, (video.duration || 1) / 4));
      } catch (err) {
        cleanup();
        resolve(null);
      }
    }, { once: true });
    video.addEventListener('seeked', () => {
      try {
        const canvas = document.createElement('canvas');
        const width = 720;
        const ratio = video.videoWidth ? video.videoHeight / video.videoWidth : 9 / 16;
        canvas.width = width;
        canvas.height = Math.max(1, Math.round(width * ratio));
        canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(blob => {
          cleanup();
          resolve(blob);
        }, 'image/jpeg', 0.82);
      } catch (err) {
        cleanup();
        resolve(null);
      }
    }, { once: true });
    video.addEventListener('error', () => {
      cleanup();
      resolve(null);
    }, { once: true });
    video.src = url;
  });
}

async function roomBackgroundFormData(form) {
  const fd = new FormData(form);
  if (!fd.has('_csrf')) fd.append('_csrf', CSRF_TOKEN);
  const file = fd.get('background');
  const thumb = await videoThumbnailBlob(file);
  if (thumb) fd.append('background_thumb', thumb, 'background-thumb.jpg');
  return fd;
}

function uploadFormWithProgress(form, url, progressEl) {
  return new Promise(async (resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const submitBtn = form.querySelector('button[type="submit"]');
    const previousDisabled = submitBtn ? submitBtn.disabled : false;
    if (submitBtn) submitBtn.disabled = true;
    setUploadProgress(progressEl, 0, 'Uploading...');
    let formData;
    try {
      formData = await roomBackgroundFormData(form);
    } catch (err) {
      if (submitBtn) submitBtn.disabled = previousDisabled;
      reject(err);
      return;
    }

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
    xhr.setRequestHeader('X-CSRF-Token', CSRF_TOKEN);
    xhr.send(formData);
  });
}

function uploadPlainFormWithProgress(form, url, progressEl) {
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
      setUploadProgress(progressEl, pct, pct >= 100 ? 'Processing import...' : 'Uploading import...');
    });

    xhr.addEventListener('load', () => {
      setUploadProgress(progressEl, 100, 'Processing import...');
      if (submitBtn) submitBtn.disabled = previousDisabled;
      if (xhr.status >= 200 && xhr.status < 400) {
        resolve(xhr);
        return;
      }
      reject(new Error(xhr.responseText || 'Import failed'));
    });

    xhr.addEventListener('error', () => {
      if (submitBtn) submitBtn.disabled = previousDisabled;
      reject(new Error('Import failed. The file may be too large or the connection may have dropped.'));
    });

    xhr.addEventListener('abort', () => {
      if (submitBtn) submitBtn.disabled = previousDisabled;
      reject(new Error('Import canceled.'));
    });

    const formData = new FormData(form);
    if (!formData.has('_csrf')) formData.append('_csrf', CSRF_TOKEN);
    xhr.open('POST', url);
    xhr.setRequestHeader('X-CSRF-Token', CSRF_TOKEN);
    xhr.send(formData);
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
  e.preventDefault();
  try {
    const resp = await uploadFormWithProgress(createRoomForm, appUrl('/api/lobby_rooms.php'), createRoomProgress);
    const data = JSON.parse(resp.responseText || '{}');
    if (data.error) throw new Error(data.error);
    if (data.room) insertRoomCard(data.room, true);
    else applyLobbyRooms(data.rooms || []);
    createRoomForm.reset();
    if (backgroundName) backgroundName.textContent = 'No file selected';
    window.setTimeout(() => resetUploadProgress(createRoomProgress), 650);
  } catch (err) {
    alert(err.message || err);
    resetUploadProgress(createRoomProgress);
  }
});

roomGrid?.addEventListener('click', e => {
  const btn = e.target.closest('.room-edit-open');
  if (!btn) return;
  lobbyRoomEditId.value = btn.dataset.roomId || '';
  lobbyRoomEditName.value = btn.dataset.roomName || '';
  lobbyRoomEditBackground.value = '';
  lobbyRoomEditBackgroundName.textContent = 'No file selected';
  resetUploadProgress(lobbyRoomEditProgress);
  setLobbyRoomPreview(btn.dataset.roomBg || '', btn.dataset.roomMime || '');
  if (String(btn.dataset.roomMime || '').startsWith('video/') && btn.dataset.roomThumb) {
    lobbyRoomEditPreview.innerHTML = `<img src="${esc(btn.dataset.roomThumb)}" alt="Current room background thumbnail">`;
  }
  lobbyRoomEditModal.classList.add('open');
  loadLobbyRoomEjections(lobbyRoomEditId.value);
});

document.getElementById('lobby-room-edit-close')?.addEventListener('click', () => {
  lobbyRoomEditModal.classList.remove('open');
});

document.getElementById('lobby-room-delete-open')?.addEventListener('click', () => {
  lobbyRoomDeleteModal?.classList.add('open');
});

function closeLobbyRoomDeleteModal() {
  lobbyRoomDeleteModal?.classList.remove('open');
}

document.getElementById('lobby-room-delete-close')?.addEventListener('click', closeLobbyRoomDeleteModal);
document.getElementById('lobby-room-delete-cancel')?.addEventListener('click', closeLobbyRoomDeleteModal);

document.getElementById('lobby-room-delete-confirm')?.addEventListener('click', async e => {
  const btn = e.currentTarget;
  btn.disabled = true;
  try {
    const fd = new FormData();
    fd.append('room_public_id', lobbyRoomEditId.value);
    fd.append('_csrf', CSRF_TOKEN);
    const resp = await fetch(appUrl('/api/room_delete.php'), { method: 'POST', headers: { 'X-CSRF-Token': CSRF_TOKEN }, body: fd });
    const data = await resp.json();
    if (!resp.ok || data.error) throw new Error(data.error || 'Room delete failed');
    window.location.href = appUrl('/lobby.php?room_deleted=1');
  } catch (err) {
    alert(err.message || err);
    btn.disabled = false;
  }
});

document.getElementById('lobby-ejection-understand')?.addEventListener('click', () => {
  document.getElementById('lobby-ejection-modal')?.classList.remove('open');
});

if (new URLSearchParams(window.location.search).get('room_deleted') === '1' && lobbyToast) {
  lobbyToast.hidden = false;
  lobbyToast.classList.add('show');
  const clean = new URL(window.location.href);
  clean.searchParams.delete('room_deleted');
  window.history.replaceState({}, document.title, clean.toString());
}

pollLobbyRooms();

document.getElementById('lobby-toast-close')?.addEventListener('click', () => {
  lobbyToast?.classList.remove('show');
  if (lobbyToast) lobbyToast.hidden = true;
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

function setRecoveryStatus(message = '', type = '') {
  if (!recoveryStatus) return;
  recoveryStatus.textContent = message;
  recoveryStatus.className = `password-status ${type}`.trim();
}

function renderRecoveryStatus(data) {
  if (!recoveryCard) return;
  const code = data.recovery_code || data.masked_code || '';
  recoveryCard.innerHTML = data.has_code
    ? `<div class="recovery-code">${esc(code)}</div><div class="minor">${data.recovery_code ? 'Copy this code to a safe place. It will not be shown again after you close this window.' : 'A recovery code already exists. Only the last segment can be shown.'}</div>`
    : '<div class="minor">No Lost Access recovery code has been generated for this account.</div>';
  if (recoveryGenerate) recoveryGenerate.textContent = data.has_code ? 'Recreate Recovery Code' : 'Create Recovery Code';
}

async function loadRecoveryStatus() {
  setRecoveryStatus('');
  if (recoveryCard) recoveryCard.innerHTML = '<div class="minor">Checking recovery status...</div>';
  const data = await lobbyApiPost('/api/recovery.php', { action: 'status' });
  renderRecoveryStatus(data);
}

function closeRecoveryModal() {
  recoveryModal?.classList.remove('open');
  setRecoveryStatus('');
}

document.getElementById('recovery-open')?.addEventListener('click', async () => {
  lobbyMenu?.classList.remove('visible');
  recoveryModal?.classList.add('open');
  try {
    await loadRecoveryStatus();
  } catch (err) {
    setRecoveryStatus(err.message || 'Could not load recovery status.', 'error-text');
  }
});

document.getElementById('recovery-close')?.addEventListener('click', closeRecoveryModal);
document.getElementById('recovery-cancel')?.addEventListener('click', closeRecoveryModal);

recoveryGenerate?.addEventListener('click', async () => {
  const recreate = recoveryGenerate.textContent.includes('Recreate');
  if (recreate && !confirm('Recreate your recovery code? The old code will stop working.')) return;
  recoveryGenerate.disabled = true;
  setRecoveryStatus('Generating...', 'working');
  try {
    const data = await lobbyApiPost('/api/recovery.php', { action: 'generate' });
    renderRecoveryStatus(data);
    setRecoveryStatus('Recovery code generated. Copy it now and keep it somewhere safe.', 'ok');
  } catch (err) {
    setRecoveryStatus(err.message || 'Could not generate recovery code.', 'error-text');
  } finally {
    recoveryGenerate.disabled = false;
  }
});

const adminModal = document.getElementById('admin-modal');
const adminUsers = document.getElementById('admin-users');
const adminToolLogs = document.getElementById('admin-tool-logs');
const adminBlocks = document.getElementById('admin-blocks');
const adminRoomEjections = document.getElementById('admin-room-ejections');
const adminCommunityEjections = document.getElementById('admin-community-ejections');
const adminSettings = document.getElementById('admin-settings');
const adminDbExport = document.getElementById('admin-db-export');
const adminUserExportLabel = document.getElementById('admin-user-export-label');
const adminDbRestore = document.getElementById('admin-db-restore');
const adminDbImportProgress = document.getElementById('admin-db-import-progress');
const adminLinkIcons = document.getElementById('admin-link-icons');
const adminLinkIconCreate = document.getElementById('admin-link-icon-create');
const adminCounts = {
  users: document.getElementById('admin-user-count'),
  logs: document.getElementById('admin-log-count'),
  moderation: document.getElementById('admin-moderation-count'),
  linkIcons: document.getElementById('admin-link-icon-count'),
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
  const payload = Object.assign({}, body || {}, { _csrf: CSRF_TOKEN });
  const resp = await fetch(appUrl('/api/admin_users.php'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': CSRF_TOKEN },
    body: JSON.stringify(payload),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || data.error) throw new Error(data.error || 'Admin request failed');
  return data;
}

async function adminSystemRequest(body) {
  const payload = Object.assign({}, body || {}, { _csrf: CSRF_TOKEN });
  const resp = await fetch(appUrl('/api/admin_system.php'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': CSRF_TOKEN },
    body: JSON.stringify(payload),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || data.error) throw new Error(data.error || 'Admin request failed');
  return data;
}

async function adminLinkIconRequest(formData) {
  if (formData && !formData.has('_csrf')) formData.append('_csrf', CSRF_TOKEN);
  const resp = await fetch(appUrl('/api/admin_link_icons.php'), { method: 'POST', headers: { 'X-CSRF-Token': CSRF_TOKEN }, body: formData });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || data.error) throw new Error(data.error || 'Link icon request failed');
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
    row.innerHTML = `<div><strong>${esc(user.display_name)}</strong><div class="minor">${esc(user.email)}</div><div class="admin-created-meta"><span>Created On</span><strong>${adminCreatedOn(user.created_at)}</strong></div></div>
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
    if (!adminSettings.elements[key]) return;
    if (adminSettings.elements[key].type === 'checkbox') adminSettings.elements[key].checked = value === '1';
    else adminSettings.elements[key].value = value;
  });
}

async function loadAdminLinkIcons() {
  if (!adminLinkIcons) return;
  const data = await fetch(appUrl('/api/admin_link_icons.php')).then(r => r.json());
  adminLinkIcons.innerHTML = '';
  setAdminCount(adminCounts.linkIcons, (data.icons || []).length);
  if (!(data.icons || []).length) {
    adminLinkIcons.innerHTML = '<div class="minor">No link icons available.</div>';
    return;
  }
  (data.icons || []).forEach(icon => {
    const row = document.createElement('form');
    row.className = 'admin-link-icon-row';
    row.innerHTML = `<img src="${esc(appUrl(icon.file_path))}" alt="">
      <div><strong>${esc(icon.icon_name)}</strong><div class="minor">${icon.built_in ? 'Built-in' : 'Custom'}</div></div>
      <input name="label" value="${esc(icon.label)}" required>
      <button class="btn btn-primary" type="submit">Save</button>
      <button class="btn btn-danger" type="button"${icon.built_in ? ' disabled' : ''}>Delete</button>
      <div class="admin-row-status" aria-live="polite"></div>`;
    row.addEventListener('submit', async e => {
      e.preventDefault();
      const fd = new FormData();
      fd.append('action', 'update');
      fd.append('icon_name', icon.icon_name);
      fd.append('label', row.elements.label.value);
      setAdminFormStatus(row, 'Saving...', 'working');
      try {
        await adminLinkIconRequest(fd);
        setAdminFormStatus(row, 'Saved.', 'ok');
        await loadAdminLogs();
      } catch (err) {
        setAdminFormStatus(row, err.message || 'Save failed.', 'error');
      }
    });
    row.querySelector('.btn-danger')?.addEventListener('click', async () => {
      if (!confirm(`Delete ${icon.label}? Existing pairs using it will switch to Plus.`)) return;
      const fd = new FormData();
      fd.append('action', 'delete');
      fd.append('icon_name', icon.icon_name);
      try {
        await adminLinkIconRequest(fd);
        await loadAdminLinkIcons();
        await loadAdminLogs();
      } catch (err) {
        setAdminFormStatus(row, err.message || 'Delete failed.', 'error');
      }
    });
    adminLinkIcons.appendChild(row);
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
    loadAdminLinkIcons(),
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
      room_chat_history_limit: form.elements.room_chat_history_limit.value,
      avatar_movements_per_second: form.elements.avatar_movements_per_second.value,
      avatar_max_size_mb: form.elements.avatar_max_size_mb.value,
      gesture_upload_limit: form.elements.gesture_upload_limit.value,
      room_image_max_size_mb: form.elements.room_image_max_size_mb.value,
      room_video_max_size_mb: form.elements.room_video_max_size_mb.value,
      participant_idle_timeout_minutes: form.elements.participant_idle_timeout_minutes.value,
      gif_giphy_api_key: form.elements.gif_giphy_api_key.value,
      gif_tenor_api_key: form.elements.gif_tenor_api_key.value,
      gif_default_provider: form.elements.gif_default_provider.value,
      age_gate_enabled: form.elements.age_gate_enabled.checked ? 1 : 0,
      age_gate_min_age: form.elements.age_gate_min_age.value,
    });
    setAdminFormStatus(form, 'Settings saved.', 'ok');
    await loadAdminLogs();
  } catch (err) {
    setAdminFormStatus(form, err.message || 'Settings failed to save.', 'error');
  } finally {
    submit.disabled = false;
  }
});

function syncAdminExportUserMode() {
  if (!adminDbExport?.users || !adminDbExport?.gestures) return;
  if (!adminDbExport.users.checked) adminDbExport.gestures.checked = false;
  adminDbExport.gestures.disabled = !adminDbExport.users.checked;
  if (adminUserExportLabel) adminUserExportLabel.textContent = adminDbExport.gestures.checked ? 'User Data + Gestures' : 'User Data';
}

adminDbExport?.gestures?.addEventListener('change', () => {
  if (adminDbExport.gestures.checked) adminDbExport.users.checked = true;
  syncAdminExportUserMode();
});

adminDbExport?.users?.addEventListener('change', syncAdminExportUserMode);
syncAdminExportUserMode();

adminDbExport?.addEventListener('submit', e => {
  e.preventDefault();
  const users = adminDbExport.users.checked;
  const gestures = users && adminDbExport.gestures.checked;
  const rooms = adminDbExport.rooms.checked;
  const settings = adminDbExport.settings.checked;
  if (!users && !rooms && !settings) {
    alert('Select at least one export section.');
    return;
  }
  const qs = new URLSearchParams({
    action: 'export_bundle',
    users: users ? '1' : '0',
    gestures: gestures ? '1' : '0',
    rooms: rooms ? '1' : '0',
    settings: settings ? '1' : '0',
  });
  window.location.href = appUrl(`/api/admin_database.php?${qs}`);
});

adminDbRestore?.database?.addEventListener('change', () => {
  const file = adminDbRestore.database.files && adminDbRestore.database.files[0];
  document.getElementById('admin-db-restore-name').textContent = file ? file.name : 'No file selected';
  resetUploadProgress(adminDbImportProgress);
});

adminDbRestore?.addEventListener('submit', async e => {
  e.preventDefault();
  try {
    const xhr = await uploadPlainFormWithProgress(adminDbRestore, appUrl('/api/admin_database.php'), adminDbImportProgress);
    const data = JSON.parse(xhr.responseText || '{}');
    if (data.error) throw new Error(data.error);
    setUploadProgress(adminDbImportProgress, 100, 'Import complete. Reloading...');
    window.location.reload();
  } catch (err) {
    let message = err.message || 'Database import failed';
    try {
      const parsed = JSON.parse(message);
      if (parsed.error) message = parsed.error;
    } catch (_err) {}
    setUploadProgress(adminDbImportProgress, 100, 'Import failed.');
    alert(message);
  }
});

adminLinkIconCreate?.icon?.addEventListener('change', () => {
  const file = adminLinkIconCreate.icon.files && adminLinkIconCreate.icon.files[0];
  document.getElementById('admin-link-icon-file-name').textContent = file ? file.name : 'No file selected';
});

adminLinkIconCreate?.addEventListener('submit', async e => {
  e.preventDefault();
  const form = e.currentTarget;
  const submit = form.querySelector('button[type="submit"]');
  submit.disabled = true;
  setAdminFormStatus(form, 'Adding icon...', 'working');
  try {
    const fd = new FormData(form);
    fd.append('action', 'create');
    await adminLinkIconRequest(fd);
    form.reset();
    document.getElementById('admin-link-icon-file-name').textContent = 'No file selected';
    setAdminFormStatus(form, 'Icon added.', 'ok');
    await loadAdminLinkIcons();
    await loadAdminLogs();
  } catch (err) {
    setAdminFormStatus(form, err.message || 'Could not add icon.', 'error');
  } finally {
    submit.disabled = false;
  }
});
