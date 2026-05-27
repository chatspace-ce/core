'use strict';

const APP_BASE = document.body?.dataset.appBase || '';

function appUrl(path) {
  if (!path) return APP_BASE || '/';
  if (/^(?:https?:)?\/\//.test(path) || path.startsWith('data:') || path.startsWith('blob:')) return path;
  if (!path.startsWith('/')) return path;
  if (APP_BASE && path.startsWith(`${APP_BASE}/`)) return path;
  return `${APP_BASE}${path}`;
}

function mediaUrl(path) {
  return appUrl(path);
}

function cacheBust(url) {
  if (!url || /^(?:data|blob):/.test(url)) return url;
  return `${url}${url.includes('?') ? '&' : '?'}v=${Date.now()}`;
}

let cfg = null;
const participants = new Map();
const dmUsers = new Map();
const messages = new Map();
const roomLayout = document.querySelector('.room-layout');
const mainEl = document.querySelector('.main');
const roomStage = document.getElementById('room-stage');
const messagesEl = document.getElementById('messages');
const userListEl = document.getElementById('user-list');
const friendListEl = document.getElementById('friend-results');
const gameListEl = document.getElementById('active-games');
const gameStartMenu = document.getElementById('game-start-menu');
const voiceSideSection = document.getElementById('voice-side-section');
const voiceTitleEl = document.getElementById('voice-title');
const voiceListEl = document.getElementById('voice-list');
const voiceCountLabel = document.getElementById('voice-count-label');
const ctxMenu = document.getElementById('ctx-menu');
const textCtxMenu = document.getElementById('text-ctx-menu');
const msgActionMenu = document.getElementById('msg-action-menu');
const tabCtxMenu = document.getElementById('tab-ctx-menu');
const roomMenu = document.getElementById('room-menu');
const roomActionMenu = document.getElementById('room-action-menu');
const gameStage = document.getElementById('game-stage');
const gameFrame = document.getElementById('game-frame');
const mediaPicker = document.getElementById('media-picker');
const mediaSearchInput = document.getElementById('media-search-input');
const gifResults = document.getElementById('gif-results');
const gestureGrid = document.getElementById('gesture-grid');
const gestureFileInput = document.getElementById('gesture-file-input');
const gestureTray = document.getElementById('gesture-tray');
const gesturePageLabel = document.getElementById('gesture-page-label');
const gesturePrev = document.getElementById('gesture-prev');
const gestureNext = document.getElementById('gesture-next');
const emojiGrid = document.getElementById('emoji-grid');
const attachMenu = document.getElementById('attach-menu');
const chatFileInput = document.getElementById('chat-file-input');
const voiceNoteModal = document.getElementById('voice-note-modal');
const appVersionEl = document.getElementById('app-version');
const latencyMonitorEl = document.getElementById('latency-monitor');
const versionBanner = document.getElementById('version-banner');
const versionBannerText = document.getElementById('version-banner-text');
const versionRefreshBtn = document.getElementById('version-refresh');
const linkIconModal = document.getElementById('link-icon-modal');
const linkIconGrid = document.getElementById('link-icon-grid');
const avatarFileInput = document.getElementById('avatar-file-input');
const ctxToggleWebcam = document.getElementById('ctx-toggle-webcam');
const sessionLockEl = document.getElementById('session-lock');
const sessionLockForm = document.getElementById('session-lock-form');
const sessionLockPassword = document.getElementById('session-lock-password');
const sessionLockError = document.getElementById('session-lock-error');
let textMenuMode = 'copy';
let lastEventId = 0;
let lastCommunityEventId = 0;
let lastLatencyMs = null;
let activeChat = 'room';
let ctxMenuParticipantId = null;
let hostModalTargetParticipantId = null;
let msgActionTargetId = null;
let msgActionTargetChat = null;
let tabCtxTargetChat = null;
let pendingDeleteMessageId = null;
let pendingDeleteChatKey = null;
let webcamStream = null;
let webcamTimer = null;
const AVATAR_STAGE_SIZE = 150;
let voiceStream = null;
let voiceJoined = false;
let voicePollTimer = null;
let voiceMuted = false;
let voiceDeafened = false;
let voiceSpeaking = false;
let voiceAnalyserTimer = null;
let voiceAudioContext = null;
let voiceAnalyser = null;
let voiceMicSource = null;
let latestVoiceParticipants = [];
let lastVoiceStatusSignature = '';
let lastVoiceSignalId = 0;
const peers = new Map();
const typingTimers = new Map();
const speechTimers = new Map();
const channelMessages = {
  room: new Map(),
  community: new Map(),
  links: new Map(),
  dms: new Map(),
  games: new Map(),
};
const unreadCounts = new Map();
const closedDmUserIds = new Set();
const linkIcons = new Map();
const stageLinkEls = new Map();
const blockedUserIds = new Set();
let typingActive = false;
let typingStopTimer = null;
let voiceNoteRecorder = null;
let voiceNoteChunks = [];
let voiceNoteStream = null;
let voiceNoteCancelled = false;
let latestAppVersion = '';
const APP_VERSION_CACHE_KEY = 'chatspace_seen_version';
const SESSION_LOCK_PREFIX = 'chatspace_session_locked_';
let memorySeenVersion = '';
let pendingLinkIconTargetId = null;
const animatedDmMessageIds = new Set();
let activeAvatarEffects = 0;
let roomExitInProgress = false;
let roomDeleteInProgress = false;
let activeGame = null;
const activeGames = new Map();
const gameChatLastIds = new Map();
const gameTypingIds = new Set();
const seenRoomHistoryClears = new Set();
let gameChatPollTimer = null;
let gameTypingActive = false;
let gameTypingStopTimer = null;

const GAME_CATALOG = {
  chess: { name: 'Chess', path: 'chess', entry: 'index.html', icon: 'chess', gameId: 2, seats: ['White', 'Black'] },
  checkers: { name: 'Checkers', path: 'checkers', entry: 'index.html', icon: 'checkers', gameId: 3, seats: ['Red', 'White'] },
  backgammon: { name: 'Backgammon', path: 'backgammon', entry: 'backgammon.html', icon: 'backgammon', gameId: 5, seats: ['White', 'Black'] },
  spaceinvasion: { name: 'Space Invasion', path: 'spaceinvasion', entry: 'spaceinvasion.html', icon: 'spaceinvasion', gameId: 6, seats: ['Player 1', 'Player 2'] },
  tetris: { name: 'Tetris Versus', path: 'tetris-versus', entry: 'tetris-versus.html', icon: 'tetris', gameId: 7, seats: ['Player 1', 'Player 2'] },
};
let gifSearchTimer = null;
const gifDurationCache = new Map();
let messagesPinnedToBottom = true;
const loadedRoomEffectModules = new Map();
let activeRoomEffectController = null;
let activeRoomEffect = null;
let activeMediaTab = 'gifs';
let gesturePage = 1;
let gestureHasMore = false;
let gesturePaletteLoaded = false;
let gestureOwnedCount = 0;
let gestureOwnedLimit = 50;
let gestureSearchTimer = null;
let activeGestureAudio = null;
const mediaSearchValues = { gifs: '', gestures: '' };
const EMOJI_OPTIONS = [
  '😀','😃','😄','😁','😂','🤣','😊','😌','😉','😏','😈','😍','🥰','😘','😇','🙂','🙃','😋','😜','🤭',
  '😭','🥺','😤','😡','😱','😳','🤔','🙄','😴','🤯','😎','🥳','🖤','🤍','❤️','🧡','💛','💚','💙','💜',
  '💕','💞','💋','✨','🔥','🌙','⭐','🌸','🌹','🍒','🍓','☕','🍷','🎉','🎵','🎧','🎮','♟️','✅','👀',
  '👍','👎','👏','🙏','💅','👑','💬','🌐','✉️','➕','🔒','🔓','⚠️','💀','🫶','🫦','😌','😏','😉','😈'
];

function apiPost(url, body) {
  return fetch(appUrl(url), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    .then(async r => {
      const data = await r.json().catch(() => ({}));
      if (!r.ok || data.error) throw new Error(data.error || 'Request failed');
      return data;
    });
}

function apiUpload(url, formData) {
  return fetch(appUrl(url), { method: 'POST', body: formData })
    .then(async r => {
      const data = await r.json().catch(() => ({}));
      if (!r.ok || data.error) throw new Error(data.error || 'Upload failed');
      return data;
    });
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

function apiUploadWithProgress(url, formData, progressEl, submitBtn = null) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
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
      let data = {};
      try {
        data = JSON.parse(xhr.responseText || '{}');
      } catch (err) {
        reject(new Error('Upload response was not readable.'));
        return;
      }
      if (xhr.status >= 200 && xhr.status < 400 && !data.error) {
        resolve(data);
        return;
      }
      reject(new Error(data.error || 'Upload failed'));
    });

    xhr.addEventListener('error', () => {
      if (submitBtn) submitBtn.disabled = previousDisabled;
      reject(new Error('Upload failed. The file may be too large or the connection may have dropped.'));
    });

    xhr.addEventListener('abort', () => {
      if (submitBtn) submitBtn.disabled = previousDisabled;
      reject(new Error('Upload canceled.'));
    });

    xhr.open('POST', appUrl(url));
    xhr.send(formData);
  });
}

function sessionLockKey() {
  return `${SESSION_LOCK_PREFIX}${document.body.dataset.roomId || 'room'}`;
}

function setSessionLocked(locked) {
  if (!sessionLockEl) return;
  if (locked) localStorage.setItem(sessionLockKey(), '1');
  else localStorage.removeItem(sessionLockKey());
  sessionLockEl.classList.toggle('open', locked);
  sessionLockEl.setAttribute('aria-hidden', locked ? 'false' : 'true');
  if (sessionLockError) sessionLockError.textContent = '';
  if (sessionLockPassword) sessionLockPassword.value = '';
  if (locked) requestAnimationFrame(() => sessionLockPassword?.focus());
}

function lockSession() {
  closeContextMenu();
  closeTextContextMenu();
  closeMessageActionMenu();
  closeTabContextMenu();
  closeRoomMenu();
  closeEmojiPicker();
  closeAttachMenu();
  setSessionLocked(true);
}

async function unlockSession() {
  const password = sessionLockPassword?.value || '';
  if (!password) {
    if (sessionLockError) sessionLockError.textContent = 'Enter your account password.';
    sessionLockPassword?.focus();
    return;
  }
  try {
    await apiPost('/api/session_lock.php', { password });
    setSessionLocked(false);
  } catch (err) {
    if (sessionLockError) sessionLockError.textContent = err.message || 'Could not unlock session.';
    sessionLockPassword?.select();
  }
}

function restoreSessionLock() {
  if (localStorage.getItem(sessionLockKey()) === '1') setSessionLocked(true);
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || ''));
}

function linkifiedTextHtml(text) {
  const raw = String(text || '');
  const parts = raw.split(/(https?:\/\/[^\s<>"']+)/gi);
  return parts.map(part => {
    if (!/^https?:\/\//i.test(part)) return esc(part).replace(/\n/g, '<br>');
    const clean = part.replace(/[.,!?)]}]+$/g, '');
    const suffix = part.slice(clean.length);
    return `<a class="chat-text-link" href="${esc(clean)}" target="_blank" rel="noopener noreferrer">${esc(clean)}</a>${esc(suffix)}`;
  }).join('');
}

function urlPreviewHtml(preview) {
  if (!preview || typeof preview !== 'object' || !isHttpUrl(preview.url)) return '';
  const title = esc(preview.title || preview.provider || preview.host || preview.url);
  const description = esc(preview.description || '');
  const host = esc(preview.provider || preview.host || '');
  const image = isHttpUrl(preview.image_url) ? esc(preview.image_url) : '';
  if (preview.type === 'player' && isHttpUrl(preview.embed_url)) {
    const providerClass = String(preview.provider || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return `<div class="url-preview url-preview-player ${providerClass}">
      <div class="url-preview-host">${host}</div>
      <iframe src="${esc(preview.embed_url)}" loading="lazy" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin"></iframe>
      ${title ? `<a class="url-preview-title" href="${esc(preview.url)}" target="_blank" rel="noopener noreferrer">${title}</a>` : ''}
    </div>`;
  }
  return `<a class="url-preview url-preview-summary" href="${esc(preview.url)}" target="_blank" rel="noopener noreferrer">
    ${image ? `<span class="url-preview-thumb"><img src="${image}" alt=""></span>` : ''}
    <span class="url-preview-copy">
      <span class="url-preview-host">${host}</span>
      ${title ? `<span class="url-preview-title">${title}</span>` : ''}
      ${description ? `<span class="url-preview-description">${description}</span>` : ''}
    </span>
  </a>`;
}

function avatarUrl(p) {
  if (!p) return cfg.avatarPresets.Default;
  if (isUserBlocked(p.user_id)) return appUrl('/assets/images/baghead.png');
  if (p.webcam_path) return `${mediaUrl(p.webcam_path)}?v=${Date.now()}`;
  if (p.avatar_url && !p.avatar_url.startsWith('data:')) {
    const url = mediaUrl(p.avatar_url);
    return `${url}${url.includes('?') ? '&' : '?'}v=${p.avatar_version || 0}`;
  }
  if (p.avatar_url) return p.avatar_url;
  if (p.avatar_path?.startsWith('preset:')) return cfg.avatarPresets[p.avatar_path.slice(7)] || cfg.avatarPresets.Default;
  return mediaUrl(p.avatar_path || cfg.avatarPresets.Default);
}

function isWebcamAssetUrl(url) {
  return String(url || '').includes('/assets/uploads/webcam/');
}

function setAvatarImageSource(img, nextSrc, flip = false) {
  if (!img || !nextSrc) return;
  if (!flip) {
    img.src = nextSrc;
    return;
  }
  img.classList.remove('avatar-flipping');
  void img.offsetWidth;
  img.classList.add('avatar-flipping');
  window.setTimeout(() => {
    img.src = nextSrc;
  }, 145);
  window.setTimeout(() => {
    img.classList.remove('avatar-flipping');
  }, 330);
}

function applyWebcamPath(participantId, webcamPath) {
  const person = participants.get(Number(participantId));
  if (!person) return;
  const next = Object.assign({}, person, { webcam_path: webcamPath || null });
  if (!next.webcam_path && isWebcamAssetUrl(next.avatar_url)) next.avatar_url = null;
  renderParticipant(next);
}

function messageAvatarUrl(msg, participant = null) {
  if (participant) return avatarUrl(participant);
  if (isUserBlocked(msg?.user_id)) return appUrl('/assets/images/baghead.png');
  if (msg?.avatar_url) return mediaUrl(msg.avatar_url);
  if (msg?.avatar_path?.startsWith('preset:')) return cfg.avatarPresets[msg.avatar_path.slice(7)] || cfg.avatarPresets.Default;
  if (msg?.avatar_path) return mediaUrl(msg.avatar_path);
  return cfg.avatarPresets.Default;
}

function isUserBlocked(userId) {
  return blockedUserIds.has(Number(userId));
}

function displayNameFor(p) {
  return isUserBlocked(p?.user_id) ? 'Blocked' : (p?.display_name || 'Someone');
}

function participantRoleKey(p) {
  const role = String(p?.role || 'user').replace(/[^a-z]/g, '') || 'user';
  if (['admin', 'developer', 'guide'].includes(role)) return role;
  if (p?.is_owner) return 'owner';
  return role;
}

function participantRoleLabel(p) {
  const key = participantRoleKey(p);
  if (key === 'owner') return 'Room Owner';
  if (key === 'developer') return 'Developer';
  if (key === 'admin') return 'Admin';
  if (key === 'guide') return 'Guide';
  return 'User';
}

function participantRoleClass(p) {
  return `role-${participantRoleKey(p)}`;
}

function setPermissionUI() {
  const actionBtn = document.getElementById('room-action-btn');
  if (actionBtn) actionBtn.hidden = !(cfg?.canEditRoom || cfg?.canUseHostTools);
  const editAction = document.getElementById('room-action-edit');
  if (editAction) editAction.hidden = !cfg?.canEditRoom;
  const effectsAction = document.getElementById('room-action-effects');
  if (effectsAction) effectsAction.hidden = !cfg?.canUseHostTools;
  const clearHistoryAction = document.getElementById('room-action-clear-history');
  if (clearHistoryAction) clearHistoryAction.hidden = !cfg?.canUseHostTools;
}

function allChannelMaps() {
  const maps = [channelMessages.room, channelMessages.community];
  channelMessages.links.forEach(map => maps.push(map));
  channelMessages.dms.forEach(map => maps.push(map));
  channelMessages.games.forEach(map => maps.push(map));
  return maps;
}

function applyUserRoleUpdate(update) {
  const userId = Number(update.user_id);
  const participantId = Number(update.participant_id);
  if (!userId && !participantId) return;
  const nextRole = update.role || 'user';
  let changedParticipants = false;
  participants.forEach(person => {
    const matches = Number(person.user_id) === userId || Number(person.id) === participantId;
    if (!matches) return;
    person.role = nextRole;
    if ('is_owner' in update) person.is_owner = Boolean(update.is_owner);
    renderParticipant(person);
    changedParticipants = true;
  });
  allChannelMaps().forEach(map => {
    map.forEach(msg => {
      const msgUserId = Number(msg.user_id || participants.get(msg.participant_id)?.user_id || 0);
      if (msgUserId !== userId && Number(msg.participant_id) !== participantId) return;
      msg.role = nextRole;
      if ('is_owner' in update) msg.is_owner = Boolean(update.is_owner);
    });
  });
  if (userId === Number(cfg.myUserId) || participantId === Number(cfg.myParticipantId)) {
    cfg.myRole = nextRole;
    if ('can_edit_room' in update) cfg.canEditRoom = Boolean(update.can_edit_room);
    if ('can_use_host_tools' in update) cfg.canUseHostTools = Boolean(update.can_use_host_tools);
    if ('can_moderate_messages' in update) cfg.canModerateMessages = Boolean(update.can_moderate_messages);
    if ('can_community_eject' in update) cfg.canCommunityEject = Boolean(update.can_community_eject);
    setPermissionUI();
    closeContextMenu();
  }
  if (changedParticipants) renderPeople();
  renderActiveChat();
}

function participantByUserId(userId) {
  const id = Number(userId);
  if (!id) return null;
  for (const person of participants.values()) {
    if (Number(person.user_id) === id) return person;
  }
  return null;
}

function messageUserId(msg) {
  return Number(msg.user_id || participants.get(msg.participant_id)?.user_id || 0);
}

function messageVisible(msg) {
  if (msg?.is_deleted && !cfg?.canModerateMessages) return false;
  const uid = messageUserId(msg);
  return !uid || uid === cfg.myUserId || !isUserBlocked(uid);
}

function showWarning(message) {
  document.getElementById('warning-message').textContent = message;
  document.getElementById('warning-modal').classList.add('open');
}

function showHostNotice(title, message, redirectToLobby = false) {
  document.getElementById('host-notice-title').textContent = title;
  document.getElementById('host-notice-message').textContent = message;
  const btn = document.getElementById('host-notice-understand');
  btn.dataset.redirect = redirectToLobby ? '1' : '';
  btn.dataset.redirectUrl = '';
  document.getElementById('host-notice-modal').classList.add('open');
}

function activeLinkPartnerId() {
  if (!activeChat.startsWith('link:')) return null;
  return Number(activeChat.slice(5));
}

function activeDmUserId() {
  if (!activeChat.startsWith('dm:')) return null;
  return Number(activeChat.slice(3));
}

function linkKeyFor(a, b) {
  return [Number(a), Number(b)].sort((x, y) => x - y).join(':');
}

function linkIconUrl(iconName = 'plus') {
  const clean = String(iconName || 'plus').replace(/[^a-z0-9-]/g, '') || 'plus';
  const catalog = Array.isArray(cfg?.linkIconCatalog) ? cfg.linkIconCatalog : [];
  const item = catalog.find(icon => icon.icon_name === clean);
  if (item?.file_path) return appUrl(item.file_path);
  return appUrl(`/assets/images/cs-icons/${clean}.png`);
}

function linkIconNameForStage(key) {
  const iconName = linkIcons.get(key) || 'plus';
  return iconName === 'none' ? '' : iconName;
}

function linkIconNameForList(key) {
  const iconName = linkIcons.get(key) || 'plus';
  return iconName === 'none' ? 'plus' : iconName;
}

function linkPairGap(key) {
  return linkIconNameForStage(key) ? 12 : 2;
}

function channelMapFor(chatKey = activeChat) {
  if (chatKey === 'room') return channelMessages.room;
  if (chatKey === 'community') return channelMessages.community;
  if (chatKey.startsWith('link:')) {
    if (!channelMessages.links.has(chatKey)) channelMessages.links.set(chatKey, new Map());
    return channelMessages.links.get(chatKey);
  }
  if (chatKey.startsWith('dm:')) {
    if (!channelMessages.dms.has(chatKey)) channelMessages.dms.set(chatKey, new Map());
    return channelMessages.dms.get(chatKey);
  }
  if (chatKey.startsWith('game:')) {
    if (!channelMessages.games.has(chatKey)) channelMessages.games.set(chatKey, new Map());
    return channelMessages.games.get(chatKey);
  }
  return channelMessages.room;
}

function channelForApi(chatKey = activeChat) {
  if (chatKey === 'room' || chatKey === 'community') return chatKey;
  if (chatKey.startsWith('link:')) return 'link';
  if (chatKey.startsWith('dm:')) return 'dm';
  if (chatKey.startsWith('game:')) return 'game';
  return 'room';
}

function linkPartnerIdFromKey(key) {
  const ids = String(key || '').split(':').map(Number).filter(Boolean);
  return ids.find(id => id !== cfg.myParticipantId) || activeLinkPartnerId();
}

function dmPartnerIdFromPayload(payload) {
  if (payload.partner_user_id) return Number(payload.partner_user_id);
  if (payload.target_user_id && Number(payload.user_id) === cfg.myUserId) return Number(payload.target_user_id);
  const ids = String(payload.dm_key || payload.link_key || '').split(':').slice(1).map(Number).filter(Boolean);
  return ids.find(id => id !== cfg.myUserId) || null;
}

function chatKeyForMessagePayload(payload) {
  const channel = payload.channel || (payload.dm_key ? 'dm' : payload.link_key ? 'link' : 'community');
  if (channel === 'community') return 'community';
  if (channel === 'link') {
    const partnerId = linkPartnerIdFromKey(payload.link_key);
    return partnerId ? `link:${partnerId}` : activeChat;
  }
  if (channel === 'dm') {
    const partnerUserId = dmPartnerIdFromPayload(payload);
    return partnerUserId ? `dm:${partnerUserId}` : activeChat;
  }
  return 'room';
}

function chatLabel(chatKey = activeChat) {
  if (chatKey === 'room') return 'Chat Room';
  if (chatKey === 'community') return 'Community Chat';
  if (chatKey.startsWith('dm:')) {
    const userId = Number(chatKey.slice(3));
    const user = dmUsers.get(userId);
    if (isUserBlocked(userId)) return 'DM> Blocked';
    return `DM> ${user ? user.display_name : 'Friend'}`;
  }
  if (chatKey.startsWith('game:')) {
    return activeGame ? `${gameName(activeGame.game_type)} Game` : 'Game';
  }
  const partner = participants.get(Number(chatKey.slice(5)));
  return `Link> ${partner ? partner.display_name : 'Friend'}`;
}

function rememberDmUser(user) {
  const id = Number(user.id || user.user_id);
  if (!id) return null;
  const existing = dmUsers.get(id) || {};
  const merged = Object.assign(existing, {
    id,
    display_name: user.display_name || existing.display_name || 'Friend',
    avatar_url: user.avatar_url || existing.avatar_url || null,
  });
  dmUsers.set(id, merged);
  return merged;
}

function openDmWithUser(user) {
  const dmUser = rememberDmUser(user);
  if (!dmUser) return;
  if (isUserBlocked(dmUser.id)) {
    showWarning('You cannot DM this user.');
    return;
  }
  closedDmUserIds.delete(Number(dmUser.id));
  renderLinkTabs();
  switchChat(`dm:${dmUser.id}`);
  document.getElementById('chat-input')?.focus();
}

function updateComposerPlaceholder() {
  const input = document.getElementById('chat-input');
  if (!input) return;
  if (activeChat === 'room') input.placeholder = `Message ${cfg.roomName || 'room'}`;
  else input.placeholder = `Message ${chatLabel(activeChat)}`;
}

function isLinkedWithMe(p) {
  const me = participants.get(cfg.myParticipantId);
  if (!me || !p) return false;
  return me.linked_to === p.id || p.linked_to === cfg.myParticipantId;
}

function preloadImage(src) {
  return new Promise(resolve => {
    if (!src) {
      resolve(false);
      return;
    }
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = src;
    if (img.complete) resolve(true);
  });
}

function avatarEffectParticleData(img, cols, rows) {
  const fallback = ['#7c6af7', '#27d3c3', '#f04f8b', '#f5c46b'];
  if (!img?.complete || !img.naturalWidth || !img.naturalHeight) return null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = cols;
    canvas.height = rows;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, cols, rows);
    const pixels = ctx.getImageData(0, 0, cols, rows).data;
    return index => {
      const offset = index * 4;
      const alpha = pixels[offset + 3];
      if (alpha < 24) return fallback[index % fallback.length];
      return `rgba(${pixels[offset]}, ${pixels[offset + 1]}, ${pixels[offset + 2]}, ${Math.max(0.45, alpha / 255)})`;
    };
  } catch {
    return index => fallback[index % fallback.length];
  }
}

function runAvatarPixelEffect(person, mode = 'in') {
  if (!person?.avatarEl || !roomStage) return Promise.resolve();
  const img = person.avatarEl;
  const rect = {
    left: img.offsetLeft,
    top: img.offsetTop,
    width: img.offsetWidth || 150,
    height: img.offsetHeight || 150,
  };
  const cols = activeAvatarEffects > 8 ? 6 : 8;
  const rows = activeAvatarEffects > 8 ? 6 : 8;
  const pixelSize = Math.max(5, Math.ceil(rect.width / cols));
  const colorAt = avatarEffectParticleData(img, cols, rows) || (index => ['#7c6af7', '#27d3c3', '#f04f8b', '#f5c46b'][index % 4]);
  const overlay = document.createElement('div');
  overlay.className = `avatar-pixel-layer ${mode === 'out' ? 'dust-out' : 'build-in'}`;
  overlay.style.left = `${rect.left}px`;
  overlay.style.top = `${rect.top}px`;
  overlay.style.width = `${rect.width}px`;
  overlay.style.height = `${rect.height}px`;
  roomStage.appendChild(overlay);

  activeAvatarEffects++;
  const duration = mode === 'out' ? 780 : 880;
  const maxDelay = mode === 'out' ? 300 : 360;
  let index = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const particle = document.createElement('span');
      const x = (col / cols) * rect.width;
      const y = (row / rows) * rect.height;
      const fromBottom = rows - row - 1;
      const delay = mode === 'out'
        ? row * (maxDelay / Math.max(1, rows - 1))
        : fromBottom * (maxDelay / Math.max(1, rows - 1));
      const sideways = (mode === 'out' ? 1 : -1) * (36 + Math.random() * 76) * (Math.random() > 0.42 ? 1 : -0.65);
      const driftY = mode === 'out'
        ? -18 + Math.random() * 54
        : 40 + Math.random() * 60;
      particle.style.left = `${x}px`;
      particle.style.top = `${y}px`;
      particle.style.width = `${pixelSize}px`;
      particle.style.height = `${pixelSize}px`;
      particle.style.background = colorAt(index);
      particle.style.setProperty('--delay', `${delay}ms`);
      particle.style.setProperty('--dx', `${sideways.toFixed(1)}px`);
      particle.style.setProperty('--dy', `${driftY.toFixed(1)}px`);
      overlay.appendChild(particle);
      index++;
    }
  }
  img.classList.remove('avatar-materialize', 'avatar-dusting');
  void img.offsetWidth;
  img.classList.add(mode === 'out' ? 'avatar-dusting' : 'avatar-materialize');
  if (person.labelEl) person.labelEl.classList.toggle('avatar-name-hidden', mode === 'out');
  return new Promise(resolve => {
    window.setTimeout(() => {
      overlay.remove();
      img.classList.remove('avatar-materialize', 'avatar-dusting');
      if (person.labelEl) person.labelEl.classList.remove('avatar-name-hidden');
      activeAvatarEffects = Math.max(0, activeAvatarEffects - 1);
      resolve();
    }, duration + maxDelay + 90);
  });
}

async function renderParticipantWhenReady(p, options = {}) {
  const prepared = Object.assign({}, p);
  await preloadImage(avatarUrl(prepared));
  renderParticipant(prepared, options);
}

function renderParticipant(p, options = {}) {
  if (roomExitInProgress && Number(p.id) === Number(cfg?.myParticipantId)) return;
  const existing = participants.get(p.id) || {};
  const hadImage = Boolean(existing.avatarEl);
  const wasWebcam = Boolean(existing.webcam_path);
  const merged = Object.assign(existing, p);
  if (!merged.webcam_path && isWebcamAssetUrl(merged.avatar_url)) merged.avatar_url = null;
  participants.set(p.id, merged);

  let img = merged.avatarEl;
  let label = merged.labelEl;
  if (!img) {
    img = document.createElement('img');
    img.className = 'avatar';
    img.draggable = false;
    img.dataset.participantId = p.id;
    label = document.createElement('div');
    label.className = 'avatar-name';
    roomStage.appendChild(img);
    roomStage.appendChild(label);
    merged.avatarEl = img;
    merged.labelEl = label;
    if (p.id === cfg.myParticipantId) makeDraggable(img);
    img.addEventListener('contextmenu', e => {
      e.preventDefault();
      e.stopPropagation();
      const current = participants.get(Number(img.dataset.participantId));
      if (!current) return;
      openAvatarContextMenu(e.clientX, e.clientY, current);
    });
  }
  const nowWebcam = Boolean(merged.webcam_path);
  setAvatarImageSource(img, avatarUrl(merged), hadImage && wasWebcam !== nowWebcam);
  refreshLinkClasses();
  img.classList.toggle('webcam', Boolean(merged.webcam_path));
  label.textContent = displayNameFor(merged);
  positionAvatar(merged);
  if (options.animateJoin) runAvatarPixelEffect(merged, 'in');
  renderPeople();
  renderLinkTabs();
}

function removeStagePresence(person) {
  person.avatarEl?.remove();
  person.labelEl?.remove();
  person.typingEl?.remove();
  person.speechEl?.remove();
  person.avatarEl = null;
  person.labelEl = null;
  person.typingEl = null;
  person.speechEl = null;
}

function removeParticipant(participantId, options = {}) {
  const id = Number(participantId);
  const person = participants.get(id);
  if (!person) return Promise.resolve();
  clearTimeout(typingTimers.get(id));
  typingTimers.delete(id);
  clearTimeout(speechTimers.get(id));
  speechTimers.delete(id);
  const finish = () => {
    removeStagePresence(person);
    if (options.keepRecord) {
      person.online = false;
      person.webcam_path = null;
      person.linked_to = null;
    } else {
      participants.delete(id);
    }
    participants.forEach(p => {
      if (p.linked_to === id) p.linked_to = null;
    });
    refreshLinkClasses();
    renderPeople();
    renderLinkTabs();
  };
  if (person.avatarEl && options.animate !== false) {
    return runAvatarPixelEffect(person, 'out').then(finish);
  } else {
    finish();
    return Promise.resolve();
  }
}

async function handleRoomDeleted(payload = {}) {
  if (roomDeleteInProgress) return;
  roomDeleteInProgress = true;
  roomExitInProgress = true;
  try {
    [ctxMenu, textCtxMenu, msgActionMenu, tabCtxMenu, roomMenu, roomActionMenu].forEach(menu => menu?.classList.remove('visible'));
    document.querySelectorAll('.modal.open').forEach(modal => modal.classList.remove('open'));
    addSystemMessage('Aw snap, this room was deleted.');
    const others = [...participants.values()]
      .filter(person => Number(person.id) !== Number(cfg.myParticipantId) && person.avatarEl)
      .sort((a, b) => String(a.display_name || '').localeCompare(String(b.display_name || '')));
    for (const person of others) {
      await removeParticipant(person.id, { keepRecord: true });
    }
    const me = participants.get(Number(cfg.myParticipantId));
    if (me) await removeParticipant(me.id, { keepRecord: true });
  } finally {
    window.location.href = appUrl('/lobby.php?room_deleted=1');
  }
}

function positionAvatar(p) {
  const img = p.avatarEl;
  const label = p.labelEl;
  if (!img || !label) return;
  const w = roomStage.clientWidth;
  const h = roomStage.clientHeight;
  const aw = AVATAR_STAGE_SIZE;
  const ah = AVATAR_STAGE_SIZE;
  const x = Math.max(0, Math.min(w - aw, p.position_x * w));
  const y = Math.max(0, Math.min(h - ah, p.position_y * h));
  img.style.left = `${x}px`;
  img.style.top = `${y}px`;
  label.style.left = `${x + aw / 2}px`;
  label.style.top = `${y + ah + 7}px`;
  if (p.typingEl) {
    p.typingEl.style.left = `${x + aw - 42}px`;
    p.typingEl.style.top = `${y - 10}px`;
  }
  if (p.speechEl) {
    const roomW = roomStage.clientWidth;
    const roomH = roomStage.clientHeight;
    const bubbleW = p.speechEl.offsetWidth || 200;
    const bubbleH = p.speechEl.offsetHeight || 52;
    const placeRight = x + aw + bubbleW + 16 < roomW;
    const placeBelow = y + ah + bubbleH + 18 < roomH;
    const clampX = value => Math.max(8, Math.min(value, roomW - bubbleW - 8));
    const clampY = value => Math.max(8, Math.min(value, roomH - bubbleH - 8));
    p.speechEl.classList.remove('br', 'bl', 'tr', 'tl');
    if (placeBelow) {
      p.speechEl.style.top = `${clampY(y + ah + 10)}px`;
      if (placeRight) {
        p.speechEl.style.left = `${clampX(x + aw - 28)}px`;
        p.speechEl.classList.add('br');
      } else {
        p.speechEl.style.left = `${clampX(x - bubbleW + 28)}px`;
        p.speechEl.classList.add('bl');
      }
    } else {
      p.speechEl.style.top = `${clampY(y - bubbleH - 10)}px`;
      if (placeRight) {
        p.speechEl.style.left = `${clampX(x + aw - 28)}px`;
        p.speechEl.classList.add('tr');
      } else {
        p.speechEl.style.left = `${clampX(x - bubbleW + 28)}px`;
        p.speechEl.classList.add('tl');
      }
    }
  }
  updateStageLinkIcons();
}

function refreshLinkClasses() {
  participants.forEach(p => {
    if (!p.avatarEl) return;
    p.avatarEl.classList.toggle('linked', Boolean(p.linked_to) || [...participants.values()].some(other => other.linked_to === p.id));
  });
  updateStageLinkIcons();
}

function pulseParticipantAvatar(participantId) {
  const person = participants.get(Number(participantId));
  if (!person?.avatarEl) return;
  person.avatarEl.classList.remove('avatar-pulse');
  void person.avatarEl.offsetWidth;
  person.avatarEl.classList.add('avatar-pulse');
  window.setTimeout(() => {
    person.avatarEl?.classList.remove('avatar-pulse');
  }, 1500);
}

function linkedPairs() {
  const pairs = [];
  const seen = new Set();
  participants.forEach(p => {
    let partner = null;
    if (p.linked_to && participants.has(p.linked_to)) partner = participants.get(p.linked_to);
    else {
      for (const other of participants.values()) {
        if (other.linked_to === p.id) {
          partner = other;
          break;
        }
      }
    }
    if (!partner) return;
    const key = linkKeyFor(p.id, partner.id);
    if (seen.has(key)) return;
    seen.add(key);
    pairs.push([key, p, partner]);
  });
  return pairs;
}

function updateStageLinkIcons() {
  if (!cfg) return;
  const active = new Set();
  linkedPairs().forEach(([key, a, b]) => {
    if (!a.avatarEl || !b.avatarEl) return;
    const iconName = linkIconNameForStage(key);
    if (!iconName) return;
    active.add(key);
    let el = stageLinkEls.get(key);
    if (!el) {
      el = document.createElement('div');
      el.className = 'stage-link-icon';
      el.innerHTML = '<img alt="">';
      roomStage.appendChild(el);
      stageLinkEls.set(key, el);
    }
    el.classList.remove('removing');
    const img = el.querySelector('img');
    if (img.getAttribute('src') !== linkIconUrl(iconName)) img.src = linkIconUrl(iconName);
    const ax = a.avatarEl.offsetLeft + a.avatarEl.offsetWidth / 2;
    const ay = a.avatarEl.offsetTop + a.avatarEl.offsetHeight / 2;
    const bx = b.avatarEl.offsetLeft + b.avatarEl.offsetWidth / 2;
    const by = b.avatarEl.offsetTop + b.avatarEl.offsetHeight / 2;
    const size = el.offsetWidth || 44;
    el.style.left = `${(ax + bx) / 2 - size / 2}px`;
    el.style.top = `${(ay + by) / 2 - size / 2}px`;
  });
  stageLinkEls.forEach((el, key) => {
    if (active.has(key)) return;
    stageLinkEls.delete(key);
    el.classList.add('removing');
    setTimeout(() => el.remove(), 240);
  });
}

function stagePointFromElement(el) {
  if (!el || !roomStage || !el.isConnected) return null;
  const stageRect = roomStage.getBoundingClientRect();
  const rect = el.getBoundingClientRect();
  return {
    x: rect.left - stageRect.left + rect.width / 2,
    y: rect.top - stageRect.top + rect.height / 2,
  };
}

function dmFlightPointForUser(userId) {
  const person = participantByUserId(userId);
  const elementPoint = stagePointFromElement(person?.avatarEl)
    || stagePointFromElement([...roomStage.querySelectorAll('.avatar')].find(el => Number(el.dataset.participantId) === Number(person?.id)));
  if (elementPoint) return elementPoint;
  if (person && Number.isFinite(Number(person.position_x)) && Number.isFinite(Number(person.position_y))) {
    const avatarWidth = AVATAR_STAGE_SIZE;
    const avatarHeight = AVATAR_STAGE_SIZE;
    return {
      x: Math.max(0, Math.min(roomStage.clientWidth, Number(person.position_x) * roomStage.clientWidth + avatarWidth / 2)),
      y: Math.max(0, Math.min(roomStage.clientHeight, Number(person.position_y) * roomStage.clientHeight + avatarHeight / 2)),
    };
  }
  return null;
}

function dmFlightPointForCurrentUser() {
  return dmFlightPointForUser(cfg.myUserId);
}

function dmFlightResolvedPoints(fromUserId, toUserId) {
  const corner = dmFlightCornerPoint();
  const fromPoint = dmFlightPointForUser(fromUserId);
  const toPoint = dmFlightPointForUser(toUserId);
  if (fromUserId === cfg.myUserId) {
    return {
      start: fromPoint || dmFlightPointForCurrentUser() || corner,
      end: toPoint || corner,
    };
  }
  if (toUserId === cfg.myUserId) {
    return {
      start: fromPoint || corner,
      end: toPoint || dmFlightPointForCurrentUser() || corner,
    };
  }
  return {
    start: fromPoint || corner,
    end: toPoint || corner,
  };
}

function dmFlightCornerPoint() {
  return {
    x: Math.max(42, roomStage.clientWidth - 46),
    y: 42,
  };
}

function dmFlightTransform(angle, flip, scale = 1) {
  return `translate(-50%, -50%) rotate(${angle}rad) scaleX(${flip}) scale(${scale})`;
}

function showDmFlight(payload) {
  if (!cfg || !roomStage || !payload) return;
  const messageId = payload.id || payload.message_id;
  if (messageId && animatedDmMessageIds.has(Number(messageId))) return;
  const fromUserId = Number(payload.user_id);
  const toUserId = Number(payload.target_user_id);
  if (!fromUserId || !toUserId) return;
  if (fromUserId !== cfg.myUserId && toUserId !== cfg.myUserId) return;
  if (isUserBlocked(fromUserId) || isUserBlocked(toUserId)) return;
  if (messageId) animatedDmMessageIds.add(Number(messageId));

  const { start, end } = dmFlightResolvedPoints(fromUserId, toUserId);
  if (Math.abs(start.x - end.x) < 2 && Math.abs(start.y - end.y) < 2) return;

  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const travelAngle = Math.atan2(dy, dx);
  const flip = dx < 0 ? -1 : 1;
  const visualAngle = dx < 0 ? Math.PI - travelAngle : travelAngle;
  const distance = Math.hypot(dx, dy);
  const duration = Math.max(700, Math.min(1250, distance * 1.25));

  const img = document.createElement('img');
  img.className = 'dm-flight';
  img.src = appUrl('/assets/images/flying-dm.png');
  img.alt = '';
  img.style.left = `${start.x}px`;
  img.style.top = `${start.y}px`;
  img.style.transform = dmFlightTransform(visualAngle, flip, .88);
  roomStage.appendChild(img);

  const keyframes = [
    { left: `${start.x}px`, top: `${start.y}px`, opacity: 0, transform: dmFlightTransform(visualAngle, flip, .72) },
    { opacity: 1, offset: .14, transform: dmFlightTransform(visualAngle, flip, 1.05) },
    { left: `${end.x}px`, top: `${end.y}px`, opacity: 1, transform: dmFlightTransform(visualAngle, flip, .95), offset: .86 },
    { left: `${end.x}px`, top: `${end.y}px`, opacity: 0, transform: dmFlightTransform(visualAngle, flip, .52) },
  ];
  const timing = { duration, easing: 'cubic-bezier(.2,.78,.2,1)', fill: 'forwards' };
  if (typeof img.animate === 'function') {
    img.animate(keyframes, timing).addEventListener('finish', () => img.remove(), { once: true });
  } else {
    setTimeout(() => img.remove(), duration);
  }
}

function saveParticipantPositions(list) {
  apiPost('/api/users.php', {
    action: 'position_pair',
    session_id: cfg.sessionId,
    join_token: cfg.myJoinToken,
    positions: list.map(p => ({ participant_id: p.id, x: p.position_x, y: p.position_y })),
  }).catch(console.warn);
}

function adjustLinkedPairForIcon(linkKey, animate = true, persist = false) {
  const pair = linkedPairs().find(([key]) => key === linkKey);
  if (!pair) return;
  const [, a, b] = pair;
  const initiator = a.linked_to === b.id ? a : b;
  const target = initiator === a ? b : a;
  snapLinkedPair(initiator, target, animate);
  if (persist) saveParticipantPositions([initiator, target]);
}

function snapLinkedPair(initiator, target, animate = true) {
  if (!initiator?.avatarEl || !target?.avatarEl) return;
  const avatarPx = initiator.avatarEl.offsetWidth || 150;
  const gap = linkPairGap(linkKeyFor(initiator.id, target.id));
  const rW = roomStage.clientWidth;
  const rH = roomStage.clientHeight;
  const initX = Math.max(avatarPx + gap, Math.min(initiator.position_x * rW, rW - avatarPx));
  const targetX = initX - avatarPx - gap;
  const y = Math.max(0, Math.min(initiator.position_y * rH, rH - avatarPx));
  target.position_x = targetX / rW;
  target.position_y = y / rH;
  initiator.position_x = initX / rW;
  initiator.position_y = y / rH;
  positionAvatar(target);
  positionAvatar(initiator);
  if (animate) {
    target.avatarEl.style.transition = 'left .35s ease, top .35s ease';
    initiator.avatarEl.style.transition = 'left .35s ease, top .35s ease';
    setTimeout(() => {
      target.avatarEl.style.transition = '';
      initiator.avatarEl.style.transition = '';
    }, 380);
  }
}

function makeDraggable(img) {
  let dragging = false;
  let linkBrokenThisDrag = false;
  let offX = 0;
  let offY = 0;
  function move(clientX, clientY) {
    const rect = roomStage.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width - img.offsetWidth, clientX - rect.left - offX));
    const y = Math.max(0, Math.min(rect.height - img.offsetHeight, clientY - rect.top - offY));
    const p = participants.get(cfg.myParticipantId);
    if (!linkBrokenThisDrag && p?.linked_to) {
      linkBrokenThisDrag = true;
      p.linked_to = null;
      apiPost('/api/users.php', { action: 'unlink', session_id: cfg.sessionId, join_token: cfg.myJoinToken }).catch(console.warn);
      renderParticipant(p);
      renderLinkTabs();
    }
    if (!linkBrokenThisDrag) {
      participants.forEach(other => {
        if (other.id === p.id || other.linked_to !== p.id || !other.avatarEl) return;
        const offsetX = (other.position_x - p.position_x) * rect.width;
        const offsetY = (other.position_y - p.position_y) * rect.height;
        other.position_x = Math.max(0, Math.min(rect.width - other.avatarEl.offsetWidth, x + offsetX)) / rect.width;
        other.position_y = Math.max(0, Math.min(rect.height - other.avatarEl.offsetHeight, y + offsetY)) / rect.height;
        positionAvatar(other);
      });
    }
    p.position_x = x / rect.width;
    p.position_y = y / rect.height;
    positionAvatar(p);
  }
  img.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    dragging = true;
    linkBrokenThisDrag = false;
    offX = e.clientX - img.getBoundingClientRect().left;
    offY = e.clientY - img.getBoundingClientRect().top;
    img.setPointerCapture(e.pointerId);
    img.style.cursor = 'grabbing';
  });
  img.addEventListener('pointermove', e => { if (dragging) move(e.clientX, e.clientY); });
  img.addEventListener('pointerup', e => {
    dragging = false;
    img.style.cursor = 'grab';
    const p = participants.get(cfg.myParticipantId);
    if (!linkBrokenThisDrag && !p.linked_to) {
      const myRect = img.getBoundingClientRect();
      const myCenter = { x: myRect.left + myRect.width / 2, y: myRect.top + myRect.height / 2 };
      let target = null;
      participants.forEach(other => {
        if (other.id === p.id || !other.avatarEl) return;
        const r = other.avatarEl.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const dist = Math.hypot(myCenter.x - cx, myCenter.y - cy);
        if (dist < 120 && !isUserBlocked(other.user_id)) target = other;
      });
      if (target) {
        const avatarPx = img.offsetWidth || 150;
        const gap = 12;
        const rW = roomStage.clientWidth;
        const rH = roomStage.clientHeight;
        const initX = Math.max(avatarPx + gap, Math.min(p.position_x * rW, rW - avatarPx));
        const targetX = initX - avatarPx - gap;
        const snapY = Math.max(0, Math.min(p.position_y * rH, rH - avatarPx));
        p.position_x = initX / rW;
        p.position_y = snapY / rH;
        target.position_x = targetX / rW;
        target.position_y = snapY / rH;
        p.linked_to = target.id;
        apiPost('/api/users.php', {
          action: 'link',
          session_id: cfg.sessionId,
          join_token: cfg.myJoinToken,
          target_participant_id: target.id,
          initiator_x: p.position_x,
          initiator_y: p.position_y,
          target_x: target.position_x,
          target_y: target.position_y,
        }).catch(err => {
          p.linked_to = null;
          target.linked_to = null;
          renderParticipant(p);
          renderParticipant(target);
          renderPeople();
          renderLinkTabs();
          showWarning(err.message || 'You cannot link with this user.');
        });
        snapLinkedPair(p, target, true);
        renderParticipant(p);
        renderParticipant(target);
        renderPeople();
        renderLinkTabs();
      }
    }
    const linkedFollowers = [...participants.values()].filter(other => other.linked_to === p.id);
    if (linkedFollowers.length) saveParticipantPositions([p, ...linkedFollowers]);
    else apiPost('/api/users.php', { action: 'position', session_id: cfg.sessionId, join_token: cfg.myJoinToken, x: p.position_x, y: p.position_y }).catch(console.warn);
  });
}

function renderPeople() {
  userListEl.innerHTML = '';
  const people = [...participants.values()].sort((a,b) => a.display_name.localeCompare(b.display_name));
  document.getElementById('participant-count-label').textContent = `(${people.length})`;
  const rendered = new Set();
  const roleClass = participantRoleClass;
  const gameForParticipant = p => [...activeGames.values()].find(game => (game.players || []).some(player => Number(player.participant_id) === Number(p.id)));
  const makePersonBits = p => {
    const game = gameForParticipant(p);
    const gameBadge = game ? `<span class="user-game-badge" title="${esc(gameName(game.game_type))}"><img src="${esc(gameIconUrl(game.game_type))}" alt=""></span>` : '';
    const nameIcon = game ? `<img class="person-game-name-icon" src="${esc(gameIconUrl(game.game_type))}" alt="" title="${esc(gameName(game.game_type))}">` : '';
    return `<span class="user-avatar-wrap"><img src="${esc(avatarUrl(p))}" alt=""><span class="status-dot ${p.online ? 'on' : ''}"></span>${gameBadge}</span><div><strong class="person-name-line">${nameIcon}<span>${esc(displayNameFor(p))}</span></strong><div class="minor">${p.id === cfg.myParticipantId ? 'You' : (p.online ? 'Online' : 'Away')}</div></div>`;
  };
  people.forEach(p => {
    if (rendered.has(p.id)) return;
    let partner = null;
    if (p.linked_to && participants.has(p.linked_to) && !rendered.has(p.linked_to)) {
      partner = participants.get(p.linked_to);
    } else {
      for (const other of people) {
        if (other.linked_to === p.id && !rendered.has(other.id)) {
          partner = other;
          break;
        }
      }
    }
    if (partner) {
      rendered.add(p.id);
      rendered.add(partner.id);
      const row = document.createElement('div');
      row.className = 'person-row linked-row';
      const left = p.linked_to ? partner : p;
      const right = p.linked_to ? p : partner;
      const linkKey = linkKeyFor(left.id, right.id);
      const iconName = linkIconNameForList(linkKey);
      const targetId = cfg.myParticipantId === right.id ? left.id : right.id;
      const canEditIcon = cfg.myParticipantId === left.id || cfg.myParticipantId === right.id;
      row.innerHTML = `<div class="linked-half ${roleClass(left)}" data-participant-id="${left.id}">${makePersonBits(left)}</div><button class="link-mark" type="button" data-link-target="${targetId}" data-link-key="${esc(linkKey)}" aria-label="Change link icon"${canEditIcon ? '' : ' disabled'}><img src="${esc(linkIconUrl(iconName))}" alt=""></button><div class="linked-half ${roleClass(right)}" data-participant-id="${right.id}">${makePersonBits(right)}</div>`;
      if (canEditIcon) row.querySelector('.link-mark').addEventListener('click', () => openLinkIconModal(targetId));
      row.querySelectorAll('.linked-half').forEach(half => {
        half.addEventListener('click', () => pulseParticipantAvatar(half.dataset.participantId));
        half.addEventListener('contextmenu', e => {
          e.preventDefault();
          e.stopPropagation();
          const person = participants.get(Number(half.dataset.participantId));
          if (person) openAvatarContextMenu(e.clientX, e.clientY, person);
        });
      });
      userListEl.appendChild(row);
      return;
    }
    rendered.add(p.id);
    const row = document.createElement('div');
    row.className = `person-row ${roleClass(p)}`;
    row.dataset.participantId = p.id;
    row.innerHTML = makePersonBits(p);
    row.addEventListener('click', () => pulseParticipantAvatar(p.id));
    row.addEventListener('contextmenu', e => {
      e.preventDefault();
      e.stopPropagation();
      openAvatarContextMenu(e.clientX, e.clientY, p);
    });
    userListEl.appendChild(row);
  });
}

function openLinkIconModal(targetId) {
  pendingLinkIconTargetId = Number(targetId);
  if (!pendingLinkIconTargetId) return;
  const linkKey = linkKeyFor(cfg.myParticipantId, pendingLinkIconTargetId);
  const current = linkIcons.get(linkKey) || 'plus';
  linkIconGrid.querySelectorAll('[data-link-icon]').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.linkIcon === current);
  });
  linkIconModal.classList.add('open');
}

function closeLinkIconModal() {
  linkIconModal.classList.remove('open');
  pendingLinkIconTargetId = null;
}

function linkedPartner() {
  const me = participants.get(cfg.myParticipantId);
  if (!me) return null;
  if (me.linked_to && participants.has(me.linked_to)) return participants.get(me.linked_to);
  for (const other of participants.values()) {
    if (other.linked_to === cfg.myParticipantId) return other;
  }
  return null;
}

function renderLinkTabs() {
  const holder = document.getElementById('link-tabs');
  if (!holder || !cfg) return;
  holder.innerHTML = '';
  renderGameTab(holder);
  const partner = linkedPartner();
  if (!partner) {
    if (activeChat.startsWith('link:')) switchChat('room');
    renderDmTabs();
    updateTabBadges();
    return;
  }
  const tab = document.createElement('button');
  tab.className = 'chat-tab';
  tab.type = 'button';
  tab.dataset.chatTab = `link:${partner.id}`;
  tab.innerHTML = `<span class="link-tab-heart">🤍</span><span>Link&gt; ${esc(partner.display_name)}</span><span class="tab-badge" hidden>0</span>`;
  tab.addEventListener('click', () => switchChat(tab.dataset.chatTab));
  holder.appendChild(tab);
  renderDmTabs();
  updateTabBadges();
  document.querySelectorAll('.chat-tab').forEach(item => {
    item.classList.toggle('active', item.dataset.chatTab === activeChat);
  });
}

function renderGameTab(holder = document.getElementById('link-tabs')) {
  if (!holder || !activeGame) {
    if (activeChat.startsWith('game:')) switchChat('room');
    return;
  }
  const chatKey = `game:${activeGame.lobby_code}`;
  const tab = document.createElement('button');
  tab.className = 'chat-tab';
  tab.type = 'button';
  tab.dataset.chatTab = chatKey;
  tab.innerHTML = `<img src="${esc(appUrl('/assets/images/chat-pane-game.png'))}" alt=""><span>Game</span><span class="tab-badge" hidden>0</span>`;
  tab.addEventListener('click', () => switchChat(chatKey));
  holder.appendChild(tab);
}

function renderDmTabs() {
  const holder = document.getElementById('link-tabs');
  if (!holder || !cfg) return;
  for (const [userId, user] of dmUsers.entries()) {
    if (closedDmUserIds.has(Number(userId))) continue;
    const chatKey = `dm:${userId}`;
    if (holder.querySelector(`[data-chat-tab="${chatKey}"]`)) continue;
    const tab = document.createElement('button');
    tab.className = 'chat-tab';
    tab.type = 'button';
    tab.dataset.chatTab = chatKey;
    tab.innerHTML = `<img src="${esc(appUrl('/assets/images/chat-pane-dm.png'))}" alt=""><span>DM&gt; ${esc(isUserBlocked(userId) ? 'Blocked' : user.display_name)}</span><span class="tab-badge" hidden>0</span>`;
    tab.addEventListener('click', () => switchChat(chatKey));
    holder.appendChild(tab);
  }
}

function updateTabBadges() {
  document.querySelectorAll('.chat-tab[data-chat-tab]').forEach(tab => {
    const count = unreadCounts.get(tab.dataset.chatTab) || 0;
    const badge = tab.querySelector('.tab-badge');
    if (!badge) return;
    badge.hidden = count <= 0;
    badge.textContent = count > 99 ? '99+' : String(count);
  });
}

function clearUnread(chatKey) {
  unreadCounts.delete(chatKey);
  updateTabBadges();
}

function switchChat(chatKey) {
  clearUnread(chatKey);
  if (chatKey === activeChat) return;
  stopTypingNow();
  stopGameTypingNow();
  activeChat = chatKey;
  setGameLayerVisibility();
  renderActiveChat();
}

document.querySelectorAll('.chat-tab[data-chat-tab]').forEach(tab => {
  tab.addEventListener('click', () => switchChat(tab.dataset.chatTab));
});

function messagesNearBottom() {
  return messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight <= 80;
}

function shouldAutoScrollMessages() {
  return messagesPinnedToBottom || messagesNearBottom();
}

function scrollMessagesToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
  messagesPinnedToBottom = true;
}

function bindMessageAutoScroll(row, shouldStick) {
  if (!row || !shouldStick) return;
  row.querySelectorAll('img, video, audio').forEach(media => {
    const keepStuck = () => {
      if (messagesPinnedToBottom || messagesNearBottom()) scrollMessagesToBottom();
    };
    media.addEventListener('load', keepStuck, { once: true });
    media.addEventListener('loadedmetadata', keepStuck, { once: true });
    media.addEventListener('canplay', keepStuck, { once: true });
  });
}

messagesEl.addEventListener('scroll', () => {
  messagesPinnedToBottom = messagesNearBottom();
});

function renderActiveChat() {
  clearUnread(activeChat);
  messagesEl.innerHTML = '';
  const map = channelMapFor();
  [...map.values()]
    .sort(compareMessages)
    .forEach(msg => bindMessageAutoScroll(appendMessageEl(msg), true));
  scrollMessagesToBottom();
  updateComposerPlaceholder();
  document.querySelectorAll('.chat-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.chatTab === activeChat);
  });
}

function addMessageToChannel(msg, chatKey, live = false) {
  if (!messageVisible(msg)) return;
  const map = channelMapFor(chatKey);
  const existing = map.get(msg.id);
  map.set(msg.id, Object.assign(existing || {}, msg));
  if (existing && chatKey === activeChat) {
    renderActiveChat();
    return;
  }
  if (chatKey === activeChat) {
    const shouldStick = shouldAutoScrollMessages();
    const row = appendMessageEl(msg);
    if (shouldStick) {
      scrollMessagesToBottom();
      bindMessageAutoScroll(row, true);
    }
    clearUnread(chatKey);
  } else if (live && msg.user_id !== cfg.myUserId && msg.participant_id !== cfg.myParticipantId) {
    unreadCounts.set(chatKey, (unreadCounts.get(chatKey) || 0) + 1);
    updateTabBadges();
  }
  if (live && chatKey === 'room' && msg.participant_id) {
    showTyping(msg.participant_id, false);
    showAvatarSpeech(msg.participant_id, msg);
  }
  if (live && chatKey.startsWith('dm:')) showDmFlight(msg);
}

function updateMessageInChannels(messageId, changes) {
  const id = Number(messageId);
  const msg = channelMessages.room.get(id);
  if (msg) Object.assign(msg, changes);
  if (messages.has(id)) Object.assign(messages.get(id), changes);
  if (activeChat === 'room') renderActiveChat();
}

function removeMessageFromChannels(messageId) {
  const id = Number(messageId);
  channelMessages.room.delete(id);
  messages.delete(id);
  if (activeChat === 'room') renderActiveChat();
}

function animateRoomHistoryClear() {
  if (activeChat !== 'room') return;
  const rows = [...messagesEl.children].reverse();
  if (!rows.length) {
    renderActiveChat();
    return;
  }
  rows.forEach((row, index) => {
    row.style.maxHeight = `${row.offsetHeight}px`;
    row.style.animationDelay = `${index * 42}ms`;
    row.classList.add('message-wipe-out');
  });
  window.setTimeout(() => {
    if (activeChat === 'room') renderActiveChat();
  }, rows.length * 42 + 520);
}

function handleRoomHistoryClear(payload = {}) {
  const clearId = payload.clear_id || `${payload.cleared_at || Date.now()}`;
  if (seenRoomHistoryClears.has(clearId)) return;
  seenRoomHistoryClears.add(clearId);
  channelMessages.room.clear();
  messages.clear();
  clearUnread('room');
  updateTabBadges();
  if (activeChat === 'room') animateRoomHistoryClear();
}

function updateMessageInChannel(chatKey, messageId, changes) {
  const id = Number(messageId);
  const map = channelMapFor(chatKey);
  const msg = map.get(id);
  if (msg) Object.assign(msg, changes);
  if (chatKey === 'room' && messages.has(id)) Object.assign(messages.get(id), changes);
  if (chatKey === activeChat) renderActiveChat();
}

function removeMessageFromChannel(chatKey, messageId) {
  const id = Number(messageId);
  channelMapFor(chatKey).delete(id);
  if (chatKey === 'room') messages.delete(id);
  if (chatKey === activeChat) renderActiveChat();
}

function formatBytes(bytes) {
  const size = Number(bytes || 0);
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function messageSpeechText(msg) {
  if (msg.message_type === 'voice_note') return 'sent a voice note';
  if (msg.message_type === 'file') return msg.original_name ? `sent ${msg.original_name}` : 'sent a file';
  if (msg.message_type === 'gif') return 'sent a GIF';
  if (msg.message_type === 'gesture') return gestureFromMessage(msg)?.text || msg.original_name || 'sent a gesture';
  return msg.content;
}

function gestureFromMessage(msg) {
  if (!msg || msg.message_type !== 'gesture') return null;
  if (msg.gesture && typeof msg.gesture === 'object') return msg.gesture;
  try {
    const parsed = JSON.parse(msg.content || '{}');
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function messageBodyHtml(msg) {
  const url = esc(mediaUrl(msg.content));
  const name = esc(msg.original_name || 'Attachment');
  const mime = String(msg.mime_type || '');
  if (msg.message_type === 'gif') {
    return `<a class="chat-attachment-image chat-gif" href="${url}" target="_blank" rel="noopener"><img src="${url}" alt="${name}"></a>`;
  }
  if (msg.message_type === 'gesture') {
    const gesture = gestureFromMessage(msg);
    if (!gesture) return esc(msg.original_name || 'Gesture');
    const gif = esc(mediaUrl(gesture.gif_path || gesture.gif_url || ''));
    const text = esc(gesture.text || gesture.name || msg.original_name || 'Gesture');
    return `<div class="chat-gesture"><a class="chat-attachment-image chat-gif chat-gesture-gif" href="${gif}" target="_blank" rel="noopener"><img src="${gif}" alt="${text}"></a><div class="chat-gesture-text">${text}</div></div>`;
  }
  if (msg.message_type === 'voice_note') {
    return `<div class="voice-note-player"><audio controls src="${url}"></audio></div>`;
  }
  if (msg.message_type === 'file') {
    if (mime.startsWith('image/')) {
      return `<a class="chat-attachment-image" href="${url}" target="_blank" rel="noopener"><img src="${url}" alt="${name}"></a>`;
    }
    const ext = (msg.original_name || 'file').split('.').pop().slice(0, 4).toUpperCase();
    return `<a class="chat-file" href="${url}" target="_blank" rel="noopener" download><span class="chat-file-icon">${esc(ext || 'FILE')}</span><span><span class="chat-file-name">${name}</span><span class="chat-file-meta">${esc(msg.mime_type || 'Document')} · ${formatBytes(msg.file_size)}</span></span></a>`;
  }
  return `<div class="chat-text">${linkifiedTextHtml(msg.content)}</div>${urlPreviewHtml(msg.url_preview)}`;
}

function gifDelayCentiseconds(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

async function gifLoopDurationMs(url) {
  const safeUrl = mediaUrl(url);
  if (gifDurationCache.has(safeUrl)) return gifDurationCache.get(safeUrl);
  let duration = 3200;
  try {
    const buffer = await fetch(safeUrl, { cache: 'force-cache' }).then(r => r.arrayBuffer());
    const bytes = new Uint8Array(buffer);
    let total = 0;
    for (let i = 0; i < bytes.length - 9; i += 1) {
      if (bytes[i] === 0x21 && bytes[i + 1] === 0xf9 && bytes[i + 2] === 0x04) {
        const delay = gifDelayCentiseconds(bytes, i + 4);
        total += Math.max(delay, 2) * 10;
        i += 7;
      }
    }
    if (total > 0) duration = Math.max(900, Math.min(total, 7000));
  } catch (err) {
    duration = 3200;
  }
  gifDurationCache.set(safeUrl, duration);
  return duration;
}

function parseServerDate(value) {
  if (!value) return null;
  return new Date(String(value).replace(' ', 'T') + (String(value).includes('Z') ? '' : 'Z'));
}

function messageSortMs(msg) {
  const date = parseServerDate(msg?.sent_at || msg?.created_at || '');
  return date && !Number.isNaN(date.getTime()) ? date.getTime() : 0;
}

function compareMessages(a, b) {
  return messageSortMs(a) - messageSortMs(b) || String(a.id).localeCompare(String(b.id));
}

function fullTimestamp(value) {
  const date = parseServerDate(value);
  if (!date || Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const local = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((today - local) / 86400000);
  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 0) return `Today, at ${time}`;
  if (diffDays === 1) return `Yesterday, at ${time}`;
  return `${date.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}, at ${time}`;
}

function updateVisibleTimestamps() {
  document.querySelectorAll('[data-ts]').forEach(el => {
    el.textContent = `${el.dataset.prefix || ''}${fullTimestamp(el.dataset.ts)}`;
  });
}

function renderReactions(msg) {
  const reactions = Array.isArray(msg.reactions) ? msg.reactions : [];
  if (!reactions.length) return '';
  const groups = new Map();
  reactions.forEach(r => {
    if (!groups.has(r.emoji)) groups.set(r.emoji, []);
    groups.get(r.emoji).push(r);
  });
  return `<div class="msg-reactions">${[...groups.entries()].map(([emoji, items]) => {
    const own = items.some(item => Number(item.participant_id) === cfg.myParticipantId);
    const avatars = items.map(item => `<img src="${esc(mediaUrl(item.avatar_url || cfg.avatarPresets.Default))}" alt="${esc(item.display_name || 'User')}" title="${esc(item.display_name || 'User')}">`).join('');
    return `<button class="reaction-chip${own ? ' own' : ''}" type="button" data-msg-reaction="${esc(emoji)}"><span class="reaction-emoji">${esc(emoji)}</span><span class="reaction-avatars">${avatars}</span></button>`;
  }).join('')}</div>`;
}

function roomEffectByKey(key) {
  return (cfg.roomEffects || []).find(effect => effect.key === key) || null;
}

async function loadRoomEffectModule(effect) {
  if (!effect?.script) throw new Error('Room effect script missing.');
  const src = appUrl(effect.script);
  if (loadedRoomEffectModules.has(src)) return loadedRoomEffectModules.get(src);
  await new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-room-effect-src="${CSS.escape(src)}"]`);
    if (existing) {
      if (existing.dataset.loaded === '1') resolve();
      else existing.addEventListener('load', resolve, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = cacheBust(src);
    script.async = true;
    script.dataset.roomEffectSrc = src;
    script.addEventListener('load', () => {
      script.dataset.loaded = '1';
      resolve();
    }, { once: true });
    script.addEventListener('error', () => reject(new Error(`Could not load ${effect.label || effect.key}.`)), { once: true });
    document.head.appendChild(script);
  });
  const module = window.ChatSpaceRoomEffects?.[effect.key];
  if (!module) throw new Error(`${effect.label || effect.key} did not register itself.`);
  loadedRoomEffectModules.set(src, module);
  return module;
}

function roomEffectContext(effect) {
  const disposers = [];
  return {
    appUrl,
    mediaUrl,
    roomStage,
    participants,
    getParticipant: id => participants.get(Number(id)),
    getAvatars: () => [...participants.values()].filter(p => p.avatarEl).map(p => ({ participant: p, element: p.avatarEl })),
    addStageListener: (type, handler, options) => {
      roomStage.addEventListener(type, handler, options);
      disposers.push(() => roomStage.removeEventListener(type, handler, options));
    },
    addWindowListener: (type, handler, options) => {
      window.addEventListener(type, handler, options);
      disposers.push(() => window.removeEventListener(type, handler, options));
    },
    onSystemMessage: text => addSystemMessage(text),
    effect,
    cleanup: () => disposers.splice(0).forEach(dispose => dispose()),
  };
}

function cleanupRoomEffectVisuals() {
  activeRoomEffectController?.destroy?.();
  activeRoomEffectController = null;
  document.body.classList.remove('has-room-effect');
  roomStage?.querySelectorAll('.room-effect-layer').forEach(layer => layer.remove());
  if (roomStage) {
    [...roomStage.classList].forEach(className => {
      if (className.startsWith('effect-')) roomStage.classList.remove(className);
    });
  }
}

async function applyRoomEffect(effectPayload, announce = false) {
  cleanupRoomEffectVisuals();
  activeRoomEffect = effectPayload?.active ? effectPayload : null;
  if (!activeRoomEffect) {
    if (announce) {
      if (effectPayload?.expired) addSystemMessage(`${effectPayload?.label || 'Room effect'} ended.`);
      else addSystemMessage(`${effectPayload?.stopped_by_name || 'Someone'} stopped ${effectPayload?.label || 'Room Effect'}.`);
    }
    return;
  }
  const effect = Object.assign({}, roomEffectByKey(activeRoomEffect.effect_key) || {}, activeRoomEffect);
  try {
    const module = await loadRoomEffectModule(effect);
    if (!activeRoomEffect || activeRoomEffect.effect_key !== effect.effect_key) return;
    document.body.classList.add('has-room-effect');
    const context = roomEffectContext(effect);
    const controller = module.mount(context) || {};
    activeRoomEffectController = {
      destroy() {
        controller.destroy?.();
        context.cleanup?.();
      },
    };
    if (announce) {
      const by = effect.changed_by_name || effect.started_by_name || 'Someone';
      addSystemMessage(`${by} started ${effect.label}.`);
    }
  } catch (err) {
    cleanupRoomEffectVisuals();
    addSystemMessage(err.message || 'Room effect could not start.');
  }
}

async function loadRoomEffectsState() {
  const qs = new URLSearchParams({ session_id: cfg.sessionId, join_token: cfg.myJoinToken });
  const data = await fetch(appUrl('/api/room_effects.php?' + qs)).then(r => r.json());
  if (data.error) throw new Error(data.error);
  cfg.roomEffects = data.effects || [];
  cfg.activeRoomEffect = data.current || null;
  return data;
}

function renderRoomEffectsModal() {
  const select = document.getElementById('room-effect-select');
  const current = document.getElementById('room-effect-current');
  const stop = document.getElementById('room-effect-stop');
  if (!select || !current) return;
  const effects = cfg.roomEffects || [];
  select.innerHTML = effects.length
    ? effects.map(effect => `<option value="${esc(effect.key)}">${esc(effect.label)}</option>`).join('')
    : '<option value="">No effects installed</option>';
  select.disabled = effects.length === 0;
  if (cfg.activeRoomEffect?.active) {
    current.innerHTML = `<strong>Current:</strong> ${esc(cfg.activeRoomEffect.label)}${cfg.activeRoomEffect.expires_at ? `<div class="minor">Ends ${esc(fullTimestamp(cfg.activeRoomEffect.expires_at))}</div>` : '<div class="minor">Runs until disabled.</div>'}`;
    if (select.querySelector(`option[value="${CSS.escape(cfg.activeRoomEffect.effect_key)}"]`)) select.value = cfg.activeRoomEffect.effect_key;
    if (stop) stop.hidden = false;
  } else {
    current.innerHTML = '<span class="minor">No room effect is active.</span>';
    if (stop) stop.hidden = true;
  }
}

function backgroundMarkup(path, mime) {
  const safePath = esc(mediaUrl(path || ''));
  const safeMime = esc(mime || '');
  if (!safePath) return '';
  if (String(mime || '').startsWith('video/')) {
    return `<video autoplay loop muted playsinline><source src="${safePath}" type="${safeMime}"></video>`;
  }
  return '';
}

function roomPreviewMarkup(path, mime, thumbPath = '') {
  const safePath = esc(mediaUrl(path || ''));
  const safeThumb = esc(mediaUrl(thumbPath || ''));
  const safeMime = esc(mime || '');
  if (!safePath) return '<div class="room-edit-preview-empty">No background selected</div>';
  if (String(mime || '').startsWith('video/') && safeThumb) {
    return `<img src="${safeThumb}" alt="Current room background thumbnail">`;
  }
  if (String(mime || '').startsWith('video/')) {
    return `<video muted loop playsinline preload="metadata"><source src="${safePath}" type="${safeMime}"></video>`;
  }
  return `<img src="${safePath}" alt="Current room background">`;
}

function setRoomEditPreview(path, mime, thumbPath = '') {
  const preview = document.getElementById('room-edit-preview');
  if (preview) preview.innerHTML = roomPreviewMarkup(path, mime, thumbPath);
}

function applyRoomBackground(path, mime) {
  const current = roomStage.querySelector('.room-bg');
  const next = document.createElement('div');
  next.className = 'room-bg room-bg-next';
  if (path && !String(mime || '').startsWith('video/')) next.style.backgroundImage = `url("${mediaUrl(path)}")`;
  next.innerHTML = backgroundMarkup(path, mime);
  roomStage.appendChild(next);
  requestAnimationFrame(() => next.classList.add('show'));
  setTimeout(() => {
    if (current) current.remove();
    next.classList.remove('room-bg-next', 'show');
  }, 520);
}

function applyRoomUpdate(update) {
  if (update.room_name) {
    cfg.roomName = update.room_name;
    document.getElementById('room-title-text').textContent = update.room_name;
    document.title = `${update.room_name} - ChatSpace CE`;
    updateComposerPlaceholder();
  }
  if ('background_path' in update) {
    cfg.backgroundPath = update.background_path;
    cfg.backgroundMime = update.background_mime;
    cfg.backgroundThumbPath = update.background_thumb_path || null;
    applyRoomBackground(update.background_path, update.background_mime);
    setRoomEditPreview(update.background_path, update.background_mime, update.background_thumb_path || '');
  }
}

function appendMessageEl(msg) {
  if (!messageVisible(msg)) return null;
  if (msg.system) {
    const div = document.createElement('div');
    div.className = 'chat-system';
    div.innerHTML = `<span class="system-badge">${esc(msg.content)}</span>`;
    messagesEl.appendChild(div);
    return div;
  }
  const mine = msg.participant_id === cfg.myParticipantId;
  const p = participants.get(msg.participant_id);
  const author = p || msg;
  const row = document.createElement('div');
  row.className = 'message' + (mine ? ' me' : '') + (msg.is_deleted ? ' deleted' : '');
  row.dataset.messageId = msg.id;
  const canShowOriginal = cfg.canModerateMessages && msg.original_content && msg.original_content !== msg.content;
  const timeValue = !msg.is_deleted && msg.edited_at ? msg.edited_at : msg.sent_at;
  const timePrefix = !msg.is_deleted && msg.edited_at ? 'Edited at ' : '';
  const flagTime = timeValue ? `<span class="msg-name-time" data-ts="${esc(timeValue)}" data-prefix="${esc(timePrefix)}">${esc(timePrefix)}${esc(fullTimestamp(timeValue))}</span>` : '';
  const deletedMeta = msg.is_deleted && msg.deleted_at ? `<div class="msg-audit deleted-audit">Deleted at ${esc(fullTimestamp(msg.deleted_at))}</div>` : '';
  const original = canShowOriginal ? `<details class="msg-original"><summary>Show original</summary><div>${esc(msg.original_content)}</div></details>` : '';
  const body = msg.is_deleted && cfg.canModerateMessages ? `<div class="msg-deleted-body">${messageBodyHtml(msg)}</div>` : messageBodyHtml(msg);
  const optionsButton = msg.channel === 'game' ? '' : '<button class="msg-options" type="button" aria-label="Message options">⋯</button>';
  row.innerHTML = `<div class="bubble"><div class="msg-head"><div class="msg-name ${participantRoleClass(author)}" title="${esc(participantRoleLabel(author))}"><img src="${esc(messageAvatarUrl(msg, p))}" alt=""><span class="msg-name-copy"><span class="msg-name-text">${esc(p ? displayNameFor(p) : msg.display_name)}</span>${flagTime}</span></div>${optionsButton}</div><div class="msg-content">${body}</div>${deletedMeta}${original}<div class="msg-meta-line">${renderReactions(msg)}</div></div>`;
  row.querySelector('.msg-options')?.addEventListener('click', e => {
    e.stopPropagation();
    openMessageActionMenu(e.clientX, e.clientY, msg);
  });
  if (msg.channel !== 'game') {
    row.addEventListener('contextmenu', e => {
      e.preventDefault();
      e.stopPropagation();
      openMessageActionMenu(e.clientX, e.clientY, msg);
    });
  }
  row.querySelectorAll('.reaction-chip').forEach(btn => {
    btn.addEventListener('click', () => applyReaction(msg.id, btn.dataset.msgReaction, activeChat));
  });
  messagesEl.appendChild(row);
  return row;
}

function renderMessage(msg, live = false) {
  messages.set(msg.id, msg);
  addMessageToChannel(msg, 'room', live);
}

function addSystemMessage(text) {
  addMessageToChannel({
    id: `system-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    system: true,
    content: text,
    sent_at: new Date().toISOString(),
  }, 'room', false);
}

function updateComposerState() {
  const input = document.getElementById('chat-input');
  const counter = document.getElementById('char-counter');
  if (!input || !counter) return;
  input.style.height = 'auto';
  input.style.height = `${Math.min(input.scrollHeight, 132)}px`;
  const count = input.value.length;
  const ratio = Math.min(1, count / 1000);
  counter.textContent = `${count}/1000`;
  const heat = Math.max(0, (ratio - 0.72) / 0.28);
  counter.style.color = heat <= 0 ? '#ffffff' : `hsl(${Math.round(8 - (8 * Math.min(1, heat)))} 86% ${Math.round(72 - (22 * Math.min(1, heat)))}%)`;
}

document.getElementById('composer').addEventListener('submit', e => {
  e.preventDefault();
  const input = document.getElementById('chat-input');
  const content = input.value.trim();
  if (!content) return;
  input.value = '';
  updateComposerState();
  if (activeChat.startsWith('game:')) {
    stopGameTypingNow();
    sendGameMessage(content).catch(err => alert(err.message || err));
    return;
  }
  stopTypingNow();
  const payload = { session_id: cfg.sessionId, join_token: cfg.myJoinToken, content, channel: activeChat };
  const partnerId = activeLinkPartnerId();
  const dmUserId = activeDmUserId();
  if (partnerId) {
    payload.channel = 'link';
    payload.target_participant_id = partnerId;
  } else if (dmUserId) {
    payload.channel = 'dm';
    payload.target_user_id = dmUserId;
  }
  apiPost('/api/messages.php', payload).then(msg => {
    if (msg.channel === 'community') addMessageToChannel(msg, 'community', false);
    else if (msg.channel === 'link') addMessageToChannel(msg, `link:${partnerId}`, false);
    else if (msg.channel === 'dm') {
      addMessageToChannel(msg, `dm:${dmUserId}`, false);
      showDmFlight(msg);
    }
    else renderMessage(msg, true);
  }).catch(alert);
});

function renderLatency(ms) {
  if (!latencyMonitorEl) return;
  latencyMonitorEl.classList.remove('latency-good', 'latency-warn', 'latency-bad');
  if (!Number.isFinite(ms)) {
    latencyMonitorEl.textContent = 'Latency failed';
    latencyMonitorEl.classList.add('latency-bad');
    return;
  }
  const rounded = Math.max(1, Math.round(ms));
  latencyMonitorEl.textContent = `${rounded}ms`;
  latencyMonitorEl.classList.add(rounded < 180 ? 'latency-good' : (rounded < 500 ? 'latency-warn' : 'latency-bad'));
}

async function checkLatency() {
  if (!latencyMonitorEl || !cfg || roomExitInProgress) return;
  try {
    const qs = new URLSearchParams({
      session_id: cfg.sessionId,
      join_token: cfg.myJoinToken,
      t: String(Date.now()),
    });
    const startedAt = performance.now();
    const response = await fetch(appUrl('/api/latency.php?' + qs), { cache: 'no-store' });
    if (!response.ok) throw new Error('Latency check failed.');
    await response.json();
    const elapsed = performance.now() - startedAt;
    lastLatencyMs = lastLatencyMs === null ? elapsed : (lastLatencyMs * .65) + (elapsed * .35);
    renderLatency(lastLatencyMs);
  } catch (err) {
    console.warn(err);
    renderLatency(Number.POSITIVE_INFINITY);
  }
}

async function poll() {
  if (roomExitInProgress) return;
  try {
    const qs = new URLSearchParams({ session_id: cfg.sessionId, last_event_id: lastEventId, last_community_event_id: lastCommunityEventId, join_token: cfg.myJoinToken });
    const data = await fetch(appUrl('/api/poll.php?' + qs)).then(r => r.json());
    (data.events || []).forEach(ev => {
      lastEventId = Math.max(lastEventId, ev.id);
      const p = ev.payload || {};
      if (ev.type === 'message') renderMessage(p, true);
      if (ev.type === 'message_edit') {
        const msg = messages.get(Number(p.message_id));
        const changes = { content: p.content, url_preview: p.url_preview || null, edited_at: p.edited_at || new Date().toISOString() };
        if (cfg.canModerateMessages && msg && !msg.original_content && msg.content !== p.content) changes.original_content = msg.content;
        updateMessageInChannels(p.message_id, changes);
      }
      if (ev.type === 'message_delete') {
        if (cfg.canModerateMessages) updateMessageInChannels(p.message_id, { is_deleted: true, deleted_at: p.deleted_at || new Date().toISOString() });
        else removeMessageFromChannels(p.message_id);
      }
      if (ev.type === 'room_history_clear') handleRoomHistoryClear(p);
      if (ev.type === 'reaction') {
        const msg = messages.get(Number(p.message_id)) || channelMessages.room.get(Number(p.message_id));
        if (msg) {
          msg.reactions = Array.isArray(msg.reactions) ? msg.reactions.filter(r => Number(r.participant_id) !== Number(p.participant_id)) : [];
          if (!p.removed) msg.reactions.push({ participant_id: p.participant_id, user_id: p.user_id, emoji: p.emoji, display_name: p.display_name, avatar_url: p.avatar_url });
          updateMessageInChannels(p.message_id, { reactions: msg.reactions });
        }
      }
      if (ev.type === 'participant_join') {
        const alreadyKnown = participants.has(p.id);
        const hadStageAvatar = Boolean(participants.get(p.id)?.avatarEl);
        renderParticipantWhenReady(Object.assign({ online: true }, p), { animateJoin: !hadStageAvatar }).catch(() => {
          renderParticipant(Object.assign({ online: true }, p), { animateJoin: !hadStageAvatar });
        });
        if (!alreadyKnown && p.id !== cfg.myParticipantId) addSystemMessage(`${p.display_name} joined the room.`);
      }
      if (ev.type === 'participant_leave') {
        const leavingId = p.participant_id || p.id;
        const person = participants.get(Number(leavingId));
        if (person && person.id !== cfg.myParticipantId) addSystemMessage(`${person.display_name} left the room.`);
        removeParticipant(leavingId);
      }
      if (ev.type === 'position') {
        const person = participants.get(p.participant_id);
        if (person) {
          person.position_x = p.position_x;
          person.position_y = p.position_y;
          positionAvatar(person);
        }
      }
      if (ev.type === 'webcam') {
        applyWebcamPath(p.participant_id, p.webcam_path || null);
      }
      if (ev.type === 'avatar') {
        const person = participants.get(p.participant_id);
        if (person) {
          person.avatar_path = p.avatar_path;
          person.avatar_url = p.avatar_url;
          person.avatar_version = Date.now();
          person.webcam_path = p.webcam_path || null;
          renderParticipant(person);
        }
      }
      if (ev.type === 'user_role_update') applyUserRoleUpdate(p);
      if (ev.type === 'typing') showTyping(p.participant_id, p.active);
      if (ev.type === 'presence_leave') {
        const person = participants.get(p.participant_id);
        if (person) {
          person.online = false;
          person.webcam_path = null;
          person.linked_to = null;
          removeParticipant(person.id);
          if (person.id !== cfg.myParticipantId) addSystemMessage(`${person.display_name} left the room.`);
        }
      }
      if (ev.type === 'link') {
        const person = participants.get(p.participant_id);
        if (person) {
          person.linked_to = p.linked_to;
          if (p.initiator_position) {
            person.position_x = p.initiator_position.x;
            person.position_y = p.initiator_position.y;
          }
          if (p.linked_to) {
            const target = participants.get(p.linked_to);
            if (target) {
              if (p.target_position) {
                target.position_x = p.target_position.x;
                target.position_y = p.target_position.y;
              }
              snapLinkedPair(person, target, true);
            }
          }
          renderParticipant(person);
          if (!p.linked_to && activeChat === `link:${person.id}`) switchChat('room');
        }
        refreshLinkClasses();
        renderPeople();
        renderLinkTabs();
      }
      if (ev.type === 'link_icon') {
        if (p.link_key && p.icon_name) {
          linkIcons.set(p.link_key, p.icon_name);
          adjustLinkedPairForIcon(p.link_key, true, false);
          renderPeople();
          updateStageLinkIcons();
        }
      }
      if (ev.type === 'block' && Number(p.blocker_user_id) === cfg.myUserId) {
        blockedUserIds.add(Number(p.blocked_user_id));
        participants.forEach(person => {
          if (Number(person.user_id) === Number(p.blocked_user_id) || person.linked_to && Number(participants.get(person.linked_to)?.user_id) === Number(p.blocked_user_id)) {
            person.linked_to = null;
            renderParticipant(person);
          }
        });
        renderActiveChat();
      }
      if (ev.type === 'unblock' && Number(p.blocker_user_id) === cfg.myUserId) {
        blockedUserIds.delete(Number(p.blocked_user_id));
        participants.forEach(renderParticipant);
        renderActiveChat();
      }
      if (ev.type === 'game_start' || ev.type === 'game_end' || ev.type === 'game_update') loadGames();
      if (ev.type === 'room_update') applyRoomUpdate(p);
      if (ev.type === 'room_deleted') handleRoomDeleted(p);
      if (ev.type === 'room_effect') {
        cfg.activeRoomEffect = p.active ? p : null;
        applyRoomEffect(p, true);
        renderRoomEffectsModal();
      }
      if (ev.type === 'host_warning' && Number(p.target_user_id) === cfg.myUserId) {
        showHostNotice('Warning', p.message || 'You have received a warning.');
      }
      if (ev.type === 'host_ejection') {
        if (Number(p.target_user_id) === cfg.myUserId) {
          const msg = p.permanent
            ? 'You have been permanently ejected from the room.'
            : `You have been ejected from the room for ${p.duration_minutes} minutes.`;
          showHostNotice('Room Ejection', msg, true);
        }
        removeParticipant(p.target_participant_id);
      }
      if (ev.type === 'community_ejection') {
        if (Number(p.target_user_id) === cfg.myUserId) {
          const msg = p.permanent
            ? 'You have been permanently ejected from the community.'
            : `You have been ejected from the community until ${new Date(String(p.expires_at).replace(' ', 'T') + 'Z').toLocaleString()}.`;
          showHostNotice('Community Ejection', msg, true);
          document.getElementById('host-notice-understand').dataset.redirectUrl = appUrl('/community_ejected.php');
        }
        removeParticipant(p.target_participant_id);
      }
    });
    (data.community_events || []).forEach(ev => {
      lastCommunityEventId = Math.max(lastCommunityEventId, ev.id);
      const p = ev.payload || {};
      if (ev.type === 'community_message') addMessageToChannel(p, 'community', true);
      if (ev.type === 'link_message') {
        const partnerId = linkPartnerIdFromKey(p.link_key) || (p.participant_id === cfg.myParticipantId ? activeLinkPartnerId() : p.participant_id);
        addMessageToChannel(p, `link:${partnerId}`, true);
      }
      if (ev.type === 'dm_message') {
        const partnerUserId = p.user_id === cfg.myUserId ? p.target_user_id : p.user_id;
        if (partnerUserId) {
          closedDmUserIds.delete(Number(partnerUserId));
          if (!dmUsers.has(partnerUserId)) {
            dmUsers.set(partnerUserId, {
              id: partnerUserId,
              display_name: p.user_id === cfg.myUserId ? 'Friend' : p.display_name,
              avatar_url: p.avatar_url,
            });
          }
          renderLinkTabs();
          addMessageToChannel(Object.assign({}, p, { partner_user_id: partnerUserId }), `dm:${partnerUserId}`, true);
        }
      }
      if (ev.type === 'community_message_edit' || ev.type === 'link_message_edit' || ev.type === 'dm_message_edit') {
        const chatKey = chatKeyForMessagePayload(p);
        updateMessageInChannel(chatKey, p.message_id, { content: p.content, url_preview: p.url_preview || null, edited_at: p.edited_at || new Date().toISOString() });
      }
      if (ev.type === 'community_message_delete' || ev.type === 'link_message_delete' || ev.type === 'dm_message_delete') {
        removeMessageFromChannel(chatKeyForMessagePayload(p), p.message_id);
      }
      if (ev.type === 'message_reaction') {
        const chatKey = chatKeyForMessagePayload(p);
        const msg = channelMapFor(chatKey).get(Number(p.message_id));
        if (msg) {
          msg.reactions = Array.isArray(msg.reactions) ? msg.reactions.filter(r => Number(r.participant_id) !== Number(p.participant_id)) : [];
          if (!p.removed) msg.reactions.push({ participant_id: p.participant_id, user_id: p.user_id, emoji: p.emoji, display_name: p.display_name, avatar_url: p.avatar_url });
          updateMessageInChannel(chatKey, p.message_id, { reactions: msg.reactions });
        }
      }
      if (ev.type === 'link_typing') {
        const partnerId = p.participant_id;
        if (activeChat === `link:${partnerId}` || partnerId === cfg.myParticipantId) showTyping(p.participant_id, p.active);
      }
    });
  } catch (err) {
    console.warn(err);
  } finally {
    if (!roomExitInProgress) setTimeout(poll, 25);
  }
}

function showTyping(participantId, active) {
  const p = participants.get(participantId);
  if (!p) return;
  if (isUserBlocked(p.user_id)) return;
  if (!active) {
    if (p.typingEl) p.typingEl.remove();
    p.typingEl = null;
    clearTimeout(typingTimers.get(participantId));
    typingTimers.delete(participantId);
    return;
  }
  if (!p.typingEl) {
    const el = document.createElement('div');
    el.className = 'typing-bubble';
    el.innerHTML = '<span></span><span></span><span></span>';
    roomStage.appendChild(el);
    p.typingEl = el;
  }
  positionAvatar(p);
  clearTimeout(typingTimers.get(participantId));
  typingTimers.set(participantId, setTimeout(() => showTyping(participantId, false), 3500));
}

function clearAvatarSpeech(participantId, person) {
  const p = person || participants.get(participantId);
  if (!p?.speechEl) return;
  p.speechAudio?.pause?.();
  p.speechAudio = null;
  clearInterval(p.speechGifLoopTimer);
  p.speechGifLoopTimer = null;
  p.speechEl.classList.remove('show');
  setTimeout(() => {
    if (p.speechEl) p.speechEl.remove();
    p.speechEl = null;
  }, 220);
}

function showAvatarSpeech(participantId, msg) {
  const p = participants.get(participantId);
  if (!p) return;
  if (isUserBlocked(p.user_id)) return;
  const isGif = msg?.message_type === 'gif';
  const isGesture = msg?.message_type === 'gesture';
  const text = (isGif || isGesture) ? '' : messageSpeechText(msg || {});
  const gesture = gestureFromMessage(msg);
  const token = (p.speechToken || 0) + 1;
  p.speechToken = token;
  if (!p.speechEl) {
    const el = document.createElement('div');
    el.className = 'chat-bubble';
    roomStage.appendChild(el);
    p.speechEl = el;
  }
  clearTimeout(speechTimers.get(participantId));
  p.speechEl.classList.remove('show');
  p.speechEl.classList.toggle('chat-bubble-gif', isGif || isGesture);
  p.speechEl.classList.toggle('chat-bubble-gesture', isGesture);
  p.speechEl.onclick = null;
  let timerStarted = false;
  const scheduleHide = () => {
    if (timerStarted || p.speechToken !== token) return;
    timerStarted = true;
    if (isGesture && gesture && gesture.audio_path && !gesture.audio_is_silent) {
      const audio = new Audio(mediaUrl(gesture.audio_path));
      gifLoopDurationMs(gesture.gif_path).then(duration => {
        if (p.speechToken !== token || !p.speechEl?.classList.contains('chat-bubble-gesture')) return;
        const img = p.speechEl.querySelector('img');
        if (!img || !Number.isFinite(duration) || duration < 250) return;
        clearInterval(p.speechGifLoopTimer);
        p.speechGifLoopTimer = setInterval(() => {
          if (p.speechToken !== token || audio.ended || audio.paused || !p.speechEl?.isConnected) {
            clearInterval(p.speechGifLoopTimer);
            p.speechGifLoopTimer = null;
            return;
          }
          img.src = cacheBust(mediaUrl(gesture.gif_path));
        }, duration);
      });
      audio.addEventListener('ended', () => {
        clearInterval(p.speechGifLoopTimer);
        p.speechGifLoopTimer = null;
        if (p.speechToken === token) clearAvatarSpeech(participantId, p);
      }, { once: true });
      audio.addEventListener('error', () => {
        if (p.speechToken === token) {
          clearInterval(p.speechGifLoopTimer);
          p.speechGifLoopTimer = null;
          speechTimers.set(participantId, setTimeout(() => clearAvatarSpeech(participantId, p), 4200));
        }
      }, { once: true });
      p.speechAudio = audio;
      audio.play().catch(() => {
        if (p.speechToken === token) speechTimers.set(participantId, setTimeout(() => clearAvatarSpeech(participantId, p), 4200));
      });
    } else if (isGif || isGesture) {
      speechTimers.set(participantId, setTimeout(() => clearAvatarSpeech(participantId, p), 3200));
      gifLoopDurationMs(isGesture ? gesture?.gif_path : msg.content).then(duration => {
        if (p.speechToken === token && p.speechEl?.classList.contains('chat-bubble-gif')) {
          clearTimeout(speechTimers.get(participantId));
          speechTimers.set(participantId, setTimeout(() => clearAvatarSpeech(participantId, p), duration));
        }
      });
    } else {
      speechTimers.set(participantId, setTimeout(() => clearAvatarSpeech(participantId, p), 5200));
    }
  };
  const reveal = () => {
    if (p.speechToken !== token || !p.speechEl) return;
    positionAvatar(p);
    requestAnimationFrame(() => {
      if (p.speechToken !== token || !p.speechEl) return;
      positionAvatar(p);
      p.speechEl.classList.add('show');
      scheduleHide();
    });
  };
  if (isGif || isGesture) {
    const img = document.createElement('img');
    img.src = mediaUrl(isGesture ? gesture?.gif_path : msg.content);
    img.alt = isGesture ? (gesture?.text || gesture?.name || 'Gesture') : (msg.original_name || 'GIF');
    if (isGesture) {
      const caption = document.createElement('div');
      caption.className = 'chat-bubble-gesture-text';
      caption.textContent = gesture?.text || gesture?.name || msg.original_name || '';
      p.speechEl.replaceChildren(img, caption);
      p.speechEl.onclick = () => {
        p.speechAudio?.pause?.();
        p.speechAudio = null;
        clearAvatarSpeech(participantId, p);
      };
    } else {
      p.speechEl.replaceChildren(img);
    }
    let revealed = false;
    const revealOnce = () => {
      if (revealed) return;
      revealed = true;
      reveal();
    };
    img.addEventListener('load', revealOnce, { once: true });
    img.addEventListener('error', revealOnce, { once: true });
    if (img.decode) img.decode().then(revealOnce).catch(() => { if (img.complete) revealOnce(); });
    if (img.complete) revealOnce();
    setTimeout(revealOnce, 900);
  } else {
    p.speechEl.textContent = text.length > 180 ? `${text.slice(0, 177)}...` : text;
    reveal();
  }
}

function sendTyping(active) {
  if (activeChat === 'community') return Promise.resolve();
  const payload = { session_id: cfg.sessionId, join_token: cfg.myJoinToken, active, channel: activeChat };
  const partnerId = activeLinkPartnerId();
  if (partnerId) {
    payload.channel = 'link';
    payload.target_participant_id = partnerId;
  }
  return apiPost('/api/typing.php', payload).catch(() => {});
}

function markLeavingRoom() {
  if (!cfg) return;
  const params = new URLSearchParams();
  params.set('session_id', cfg.sessionId);
  params.set('join_token', cfg.myJoinToken);
  const blob = new Blob([params.toString()], { type: 'application/x-www-form-urlencoded' });
  if (!navigator.sendBeacon || !navigator.sendBeacon(appUrl('/api/leave_room.php'), blob)) {
    fetch(appUrl('/api/leave_room.php'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
      keepalive: true,
    }).catch(() => {});
  }
}

function stopTypingNow() {
  clearTimeout(typingStopTimer);
  if (typingActive) {
    typingActive = false;
    showTyping(cfg.myParticipantId, false);
    sendTyping(false);
  }
}

document.getElementById('chat-input').addEventListener('input', () => {
  updateComposerState();
  if (activeChat.startsWith('game:')) {
    handleGameTypingInput();
    return;
  }
  if (activeChat === 'community' || activeChat.startsWith('dm:')) {
    stopTypingNow();
    return;
  }
  if (!typingActive) {
    typingActive = true;
    showTyping(cfg.myParticipantId, true);
    sendTyping(true);
  }
  clearTimeout(typingStopTimer);
  typingStopTimer = setTimeout(stopTypingNow, 1400);
});

document.getElementById('chat-input').addEventListener('keydown', e => {
  if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
  e.preventDefault();
  document.getElementById('composer').requestSubmit();
});

function addUploadedChatMessage(msg) {
  if (msg.channel === 'community') {
    addMessageToChannel(msg, 'community', false);
    return;
  }
  if (msg.channel === 'link') {
    const partnerId = activeLinkPartnerId();
    addMessageToChannel(msg, partnerId ? `link:${partnerId}` : activeChat, false);
    return;
  }
  if (msg.channel === 'dm') {
    const dmUserId = Number(msg.partner_user_id || msg.target_user_id || activeDmUserId());
    addMessageToChannel(msg, dmUserId ? `dm:${dmUserId}` : activeChat, false);
    showDmFlight(msg);
    return;
  }
  if (msg.channel === 'game') {
    addMessageToChannel(msg, gameChatKey(msg.lobby_code), false);
    return;
  }
  renderMessage(msg, true);
}

function uploadChatFile(file) {
  const formData = new FormData();
  formData.append('session_id', cfg.sessionId);
  formData.append('join_token', cfg.myJoinToken);
  formData.append('channel', channelForApi(activeChat));
  const partnerId = activeLinkPartnerId();
  const dmUserId = activeDmUserId();
  if (partnerId) formData.append('target_participant_id', String(partnerId));
  if (dmUserId) formData.append('target_user_id', String(dmUserId));
  if (activeChat.startsWith('game:')) formData.append('lobby_code', activeChat.slice(5));
  formData.append('file', file);
  return apiUpload('/api/files.php', formData).then(addUploadedChatMessage);
}

chatFileInput.addEventListener('change', () => {
  const file = chatFileInput.files && chatFileInput.files[0];
  chatFileInput.value = '';
  if (!file) return;
  uploadChatFile(file).catch(err => alert(err.message || err));
});

function pastedImageFile(event) {
  const clipboard = event.clipboardData;
  if (!clipboard) return null;
  const items = Array.from(clipboard.items || []);
  for (const item of items) {
    if (item.kind === 'file' && String(item.type || '').startsWith('image/')) {
      const file = item.getAsFile();
      if (!file) continue;
      const ext = (file.type.split('/')[1] || 'png').replace('jpeg', 'jpg').split(';')[0];
      return new File([file], file.name || `pasted-image-${Date.now()}.${ext}`, { type: file.type || 'image/png' });
    }
  }
  const files = Array.from(clipboard.files || []);
  return files.find(file => String(file.type || '').startsWith('image/')) || null;
}

document.getElementById('chat-input').addEventListener('paste', e => {
  const file = pastedImageFile(e);
  if (!file) return;
  e.preventDefault();
  uploadChatFile(file).catch(err => alert(err.message || err));
});

function closeVoiceNoteModal() {
  voiceNoteModal.classList.remove('open');
}

function stopVoiceNoteTracks() {
  if (!voiceNoteStream) return;
  voiceNoteStream.getTracks().forEach(track => track.stop());
  voiceNoteStream = null;
}

async function startVoiceNote() {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
    throw new Error('Voice notes are not supported in this browser.');
  }
  voiceNoteChunks = [];
  voiceNoteCancelled = false;
  voiceNoteStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  voiceNoteRecorder = new MediaRecorder(voiceNoteStream);
  document.getElementById('voice-note-status').textContent = 'Recording...';
  voiceNoteModal.classList.add('open');
  voiceNoteRecorder.addEventListener('dataavailable', e => {
    if (e.data && e.data.size) voiceNoteChunks.push(e.data);
  });
  voiceNoteRecorder.addEventListener('stop', () => {
    const chunks = voiceNoteChunks.slice();
    stopVoiceNoteTracks();
    closeVoiceNoteModal();
    voiceNoteRecorder = null;
    voiceNoteChunks = [];
    if (voiceNoteCancelled || !chunks.length) return;
    const type = chunks[0].type || 'audio/webm';
    const blob = new Blob(chunks, { type });
    const formData = new FormData();
    formData.append('session_id', cfg.sessionId);
    formData.append('join_token', cfg.myJoinToken);
    formData.append('audio', blob, 'voice-note.webm');
    apiUpload('/api/voice_notes.php', formData)
      .then(addUploadedRoomMessage)
      .catch(err => alert(err.message || err));
  });
  voiceNoteRecorder.start();
}

function cancelVoiceNote() {
  if (!voiceNoteRecorder) return;
  voiceNoteCancelled = true;
  if (voiceNoteRecorder.state !== 'inactive') voiceNoteRecorder.stop();
  else {
    stopVoiceNoteTracks();
    closeVoiceNoteModal();
  }
}

document.getElementById('voice-note-stop').addEventListener('click', () => {
  if (!voiceNoteRecorder) return;
  document.getElementById('voice-note-status').textContent = 'Sending voice note...';
  voiceNoteCancelled = false;
  if (voiceNoteRecorder.state !== 'inactive') voiceNoteRecorder.stop();
});

document.getElementById('voice-note-cancel').addEventListener('click', cancelVoiceNote);

document.getElementById('link-icon-close')?.addEventListener('click', closeLinkIconModal);
document.getElementById('warning-close')?.addEventListener('click', () => {
  document.getElementById('warning-modal')?.classList.remove('open');
});
linkIconGrid?.querySelectorAll('[data-link-icon]').forEach(btn => {
  btn.addEventListener('click', async () => {
    if (!pendingLinkIconTargetId) return;
    const targetId = pendingLinkIconTargetId;
    const iconName = btn.dataset.linkIcon || 'plus';
    const linkKey = linkKeyFor(cfg.myParticipantId, targetId);
    linkIcons.set(linkKey, iconName);
    adjustLinkedPairForIcon(linkKey, true, true);
    renderPeople();
    updateStageLinkIcons();
    closeLinkIconModal();
    try {
      await apiPost('/api/users.php', {
        action: 'link_icon',
        session_id: cfg.sessionId,
        join_token: cfg.myJoinToken,
        target_participant_id: targetId,
        icon_name: iconName,
      });
    } catch (err) {
      alert(err.message || err);
    }
  });
});

function leaveRoomNow() {
  if (!cfg) return Promise.resolve();
  return fetch(appUrl('/api/leave_room.php'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ session_id: cfg.sessionId, join_token: cfg.myJoinToken }),
    keepalive: true,
  }).catch(() => {});
}

async function leaveRoomWithLocalExit(href) {
  if (roomExitInProgress) return;
  roomExitInProgress = true;
  closeRoomMenu();
  closeContextMenu();
  closeTextContextMenu();
  closeEmojiPicker();
  stopTypingNow();
  const me = participants.get(cfg?.myParticipantId);
  if (me) {
    me.exiting = true;
    await removeParticipant(me.id, { keepRecord: true });
  }
  await leaveRoomNow();
  window.location.href = href;
}

document.getElementById('rooms-link')?.addEventListener('click', async e => {
  e.preventDefault();
  const href = e.currentTarget.href;
  await leaveRoomWithLocalExit(href);
});
document.getElementById('logout-link')?.addEventListener('click', async e => {
  e.preventDefault();
  await leaveRoomWithLocalExit(e.currentTarget.href);
});

async function refreshPresence() {
  if (roomExitInProgress) return;
  try {
    const qs = new URLSearchParams({ session_id: cfg.sessionId, join_token: cfg.myJoinToken });
    const data = await fetch(appUrl('/api/presence.php?' + qs)).then(r => r.json());
    (data.participants || []).forEach(p => {
      const existing = participants.get(p.id);
      if (existing) {
        existing.online = p.online;
        if (p.online) applyWebcamPath(existing.id, p.webcam_path || null);
        else if (existing.avatarEl) removeParticipant(existing.id, { keepRecord: true });
      }
    });
  } catch {}
  setTimeout(refreshPresence, 5000);
}

function openAvatarContextMenu(x, y, participant) {
  closeTextContextMenu();
  closeRoomMenu();
  closeEmojiPicker();
  ctxMenuParticipantId = participant.id;
  const isOwn = participant.id === cfg.myParticipantId;
  const isLinked = Boolean(participant.linked_to) || [...participants.values()].some(other => other.linked_to === participant.id);
  const isBlocked = isUserBlocked(participant.user_id);
  const showHostTools = Boolean(cfg.canUseHostTools && !isOwn);
  document.getElementById('ctx-change-avatar').style.display = isOwn ? 'block' : 'none';
  ctxToggleWebcam.style.display = isOwn ? 'block' : 'none';
  document.getElementById('ctx-dm').style.display = !isOwn && !isBlocked ? 'block' : 'none';
  document.getElementById('ctx-tools-wrap').style.display = showHostTools ? 'block' : 'none';
  document.getElementById('ctx-tools-divider').style.display = showHostTools ? 'block' : 'none';
  document.getElementById('ctx-community-eject').style.display = showHostTools && Boolean(cfg.canCommunityEject) ? 'block' : 'none';
  document.getElementById('ctx-tools-wrap').classList.remove('open');
  document.getElementById('ctx-block').style.display = !isOwn && !isBlocked ? 'block' : 'none';
  document.getElementById('ctx-unblock').style.display = !isOwn && isBlocked ? 'block' : 'none';
  document.getElementById('ctx-unlink').style.display = isLinked && !isBlocked ? 'block' : 'none';
  ctxToggleWebcam.textContent = webcamStream ? 'Disable Webcam' : 'Enable Webcam';
  ctxMenu.style.left = `${x}px`;
  ctxMenu.style.top = `${y}px`;
  ctxMenu.classList.add('visible');
}

function closeContextMenu() {
  ctxMenu.classList.remove('visible');
  document.getElementById('ctx-tools-wrap')?.classList.remove('open');
  ctxMenuParticipantId = null;
}

function openTextContextMenu(x, y, mode) {
  closeContextMenu();
  textMenuMode = mode;
  document.getElementById('text-cut').style.display = mode === 'input' ? 'block' : 'none';
  document.getElementById('text-paste').style.display = mode === 'input' ? 'block' : 'none';
  textCtxMenu.classList.add('visible');
  const rect = textCtxMenu.getBoundingClientRect();
  const left = Math.max(8, Math.min(x, window.innerWidth - rect.width - 8));
  const top = Math.max(8, Math.min(y, window.innerHeight - rect.height - 8));
  textCtxMenu.style.left = `${left}px`;
  textCtxMenu.style.top = `${top}px`;
}

function closeTextContextMenu() {
  textCtxMenu.classList.remove('visible');
}

function closeMessageActionMenu() {
  msgActionMenu?.classList.remove('visible');
  msgActionTargetId = null;
  msgActionTargetChat = null;
}

function closeTabContextMenu() {
  tabCtxMenu?.classList.remove('visible');
  tabCtxTargetChat = null;
}

function openTabContextMenu(x, y, chatKey) {
  if (!tabCtxMenu || (!chatKey.startsWith('dm:') && !chatKey.startsWith('link:'))) return;
  closeContextMenu();
  closeTextContextMenu();
  closeMessageActionMenu();
  closeRoomMenu();
  closeRoomActionMenu();
  closeEmojiPicker();
  closeAttachMenu();
  tabCtxTargetChat = chatKey;
  document.getElementById('tab-close-dm').style.display = chatKey.startsWith('dm:') ? 'block' : 'none';
  document.getElementById('tab-unlink').style.display = chatKey.startsWith('link:') ? 'block' : 'none';
  tabCtxMenu.classList.add('visible');
  const rect = tabCtxMenu.getBoundingClientRect();
  tabCtxMenu.style.left = `${Math.max(8, Math.min(x, window.innerWidth - rect.width - 8))}px`;
  tabCtxMenu.style.top = `${Math.max(8, Math.min(y, window.innerHeight - rect.height - 8))}px`;
}

function openMessageActionMenu(x, y, msg) {
  if (!msgActionMenu || msg.system || msg.is_deleted) return;
  closeContextMenu();
  closeTextContextMenu();
  closeTabContextMenu();
  closeRoomMenu();
  closeRoomActionMenu();
  msgActionTargetId = Number(msg.id);
  msgActionTargetChat = activeChat;
  const mine = Number(msg.participant_id) === cfg.myParticipantId;
  const editable = mine && (msg.message_type || 'text') === 'text';
  document.getElementById('msg-edit-action').style.display = editable ? 'block' : 'none';
  document.getElementById('msg-delete-action').style.display = mine ? 'block' : 'none';
  msgActionMenu.classList.add('visible');
  const rect = msgActionMenu.getBoundingClientRect();
  msgActionMenu.style.left = `${Math.max(8, Math.min(x, window.innerWidth - rect.width - 8))}px`;
  msgActionMenu.style.top = `${Math.max(8, Math.min(y, window.innerHeight - rect.height - 8))}px`;
}

function closeRoomMenu() {
  roomMenu.classList.remove('visible');
}

function closeRoomActionMenu() {
  roomActionMenu?.classList.remove('visible');
}

function closeMediaPicker() {
  if (mediaPicker) mediaPicker.hidden = true;
}

function closeEmojiPicker() {
  closeMediaPicker();
}

function closeAttachMenu() {
  attachMenu.hidden = true;
}

function closeGameStartMenu() {
  if (gameStartMenu) gameStartMenu.hidden = true;
}

function openEmojiPicker() {
  closeContextMenu();
  closeTextContextMenu();
  closeTabContextMenu();
  closeRoomMenu();
  closeRoomActionMenu();
  closeGameStartMenu();
  closeAttachMenu();
  closeMediaPicker();
  gesturePaletteLoaded = false;
  const btn = document.getElementById('emoji-btn');
  const r = btn.getBoundingClientRect();
  mediaPicker.hidden = false;
  const er = mediaPicker.getBoundingClientRect();
  mediaPicker.style.left = `${Math.max(8, Math.min(r.right - er.width, window.innerWidth - er.width - 8))}px`;
  mediaPicker.style.top = `${Math.max(8, r.top - er.height - 8)}px`;
  mediaSearchInput?.focus();
  if (activeMediaTab === 'gestures') loadGestures();
  if (activeMediaTab === 'emojis') renderEmojiGrid();
}

function openRoomMenu() {
  closeContextMenu();
  closeTextContextMenu();
  closeTabContextMenu();
  closeRoomActionMenu();
  closeGameStartMenu();
  closeAttachMenu();
  closeMediaPicker();
  const btn = document.getElementById('room-menu-btn');
  const r = btn.getBoundingClientRect();
  roomMenu.classList.add('visible');
  const mr = roomMenu.getBoundingClientRect();
  roomMenu.style.left = `${Math.max(8, Math.min(r.right - mr.width, window.innerWidth - mr.width - 8))}px`;
  roomMenu.style.top = `${Math.min(r.bottom + 6, window.innerHeight - mr.height - 8)}px`;
}

function openRoomActionMenu() {
  if (!roomActionMenu) return;
  closeContextMenu();
  closeTextContextMenu();
  closeTabContextMenu();
  closeRoomMenu();
  closeGameStartMenu();
  closeAttachMenu();
  closeMediaPicker();
  const btn = document.getElementById('room-action-btn');
  const r = btn.getBoundingClientRect();
  document.getElementById('room-action-edit').style.display = cfg.canEditRoom ? 'block' : 'none';
  document.getElementById('room-action-effects').style.display = cfg.canUseHostTools ? 'block' : 'none';
  document.getElementById('room-action-clear-history').style.display = cfg.canUseHostTools ? 'block' : 'none';
  roomActionMenu.classList.add('visible');
  const mr = roomActionMenu.getBoundingClientRect();
  roomActionMenu.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - mr.width - 8))}px`;
  roomActionMenu.style.top = `${Math.min(r.bottom + 6, window.innerHeight - mr.height - 8)}px`;
}

document.getElementById('room-menu-btn').addEventListener('click', e => {
  e.stopPropagation();
  if (roomMenu.classList.contains('visible')) closeRoomMenu();
  else openRoomMenu();
});

document.getElementById('room-action-btn')?.addEventListener('click', e => {
  e.stopPropagation();
  if (roomActionMenu?.classList.contains('visible')) closeRoomActionMenu();
  else openRoomActionMenu();
});

document.getElementById('lock-session-btn')?.addEventListener('click', lockSession);

sessionLockForm?.addEventListener('submit', e => {
  e.preventDefault();
  unlockSession();
});

document.getElementById('emoji-btn').addEventListener('click', e => {
  e.stopPropagation();
  if (!mediaPicker.hidden) closeMediaPicker();
  else openEmojiPicker();
});

document.getElementById('attach-btn').addEventListener('click', e => {
  e.stopPropagation();
  closeContextMenu();
  closeTextContextMenu();
  closeTabContextMenu();
  closeRoomMenu();
  closeRoomActionMenu();
  closeGameStartMenu();
  closeEmojiPicker();
  closeMediaPicker();
  attachMenu.hidden = !attachMenu.hidden;
});

document.getElementById('game-start-btn')?.addEventListener('click', e => {
  e.stopPropagation();
  closeContextMenu();
  closeTextContextMenu();
  closeTabContextMenu();
  closeRoomMenu();
  closeRoomActionMenu();
  closeMediaPicker();
  closeAttachMenu();
  if (gameStartMenu) gameStartMenu.hidden = !gameStartMenu.hidden;
});

document.getElementById('attach-file-btn').addEventListener('click', () => {
  closeAttachMenu();
  chatFileInput.click();
});

document.getElementById('attach-voice-btn').addEventListener('click', () => {
  closeAttachMenu();
  startVoiceNote().catch(err => alert(err.message || err));
});

function insertEmoji(emoji) {
  const input = document.getElementById('chat-input');
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? input.value.length;
  input.value = (input.value.slice(0, start) + emoji + input.value.slice(end)).slice(0, input.maxLength);
  const next = start + emoji.length;
  input.setSelectionRange(Math.min(next, input.value.length), Math.min(next, input.value.length));
  input.focus();
  updateComposerState();
}

function renderEmojiGrid() {
  if (!emojiGrid || emojiGrid.dataset.rendered === '1') return;
  emojiGrid.innerHTML = '';
  EMOJI_OPTIONS.forEach(emoji => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = emoji;
    btn.addEventListener('click', () => insertEmoji(emoji));
    emojiGrid.appendChild(btn);
  });
  emojiGrid.dataset.rendered = '1';
}

function setMediaTab(tab) {
  if (mediaSearchInput && activeMediaTab !== 'emojis') {
    mediaSearchValues[activeMediaTab] = mediaSearchInput.value;
  }
  activeMediaTab = tab;
  mediaPicker?.classList.remove('media-tab-gifs', 'media-tab-gestures', 'media-tab-emojis');
  mediaPicker?.classList.add(`media-tab-${tab}`);
  mediaPicker?.querySelectorAll('[data-media-tab]').forEach(btn => btn.classList.toggle('active', btn.dataset.mediaTab === tab));
  mediaPicker?.querySelectorAll('.media-panel').forEach(panel => panel.classList.toggle('active', panel.id === `media-panel-${tab}`));
  if (mediaSearchInput) {
    mediaSearchInput.placeholder = tab === 'gifs' ? 'Search GIFs' : (tab === 'gestures' ? 'Search gesture text' : 'Search emojis');
    mediaSearchInput.value = tab === 'emojis' ? '' : (mediaSearchValues[tab] || '');
    mediaSearchInput.style.display = tab === 'emojis' ? 'none' : '';
  }
  if (tab === 'gifs' && gifResults && !cfg?.gifPicker?.enabled) {
    gifResults.innerHTML = '<div class="minor">GIFs are not configured.</div>';
  }
  if (tab === 'gestures') {
    if (!gesturePaletteLoaded) {
      gesturePage = 1;
      loadGestures();
    }
  }
  if (tab === 'emojis') renderEmojiGrid();
}

mediaPicker?.querySelectorAll('[data-media-tab]').forEach(btn => {
  btn.addEventListener('click', () => setMediaTab(btn.dataset.mediaTab || 'gifs'));
});

async function searchGifs(query) {
  if (!gifResults || !cfg?.gifPicker?.enabled) return;
  const q = query.trim();
  if (!q) {
    gifResults.innerHTML = '<div class="minor">Search for a GIF.</div>';
    return;
  }
  gifResults.innerHTML = '<div class="gif-loading">Searching...</div>';
  try {
    const qs = new URLSearchParams({
      session_id: cfg.sessionId,
      join_token: cfg.myJoinToken,
      q,
      provider: cfg.gifPicker.defaultProvider || 'giphy',
    });
    const data = await fetch(appUrl(`/api/gif_search.php?${qs}`)).then(r => r.json());
    if (data.error) throw new Error(data.error);
    const results = data.results || [];
    if (!results.length) {
      gifResults.innerHTML = '<div class="minor">No GIFs found.</div>';
      return;
    }
    gifResults.innerHTML = '';
    results.forEach(result => {
      const btn = document.createElement('button');
      btn.className = 'gif-result';
      btn.type = 'button';
      btn.innerHTML = `<img src="${esc(result.preview || result.url)}" alt="${esc(result.title || 'GIF')}">`;
      btn.addEventListener('click', () => sendGif(result));
      gifResults.appendChild(btn);
    });
  } catch (err) {
    gifResults.innerHTML = `<div class="minor">${esc(err.message || 'GIF search failed.')}</div>`;
  }
}

mediaSearchInput?.addEventListener('input', e => {
  if (activeMediaTab === 'gifs') {
    mediaSearchValues.gifs = e.target.value;
    clearTimeout(gifSearchTimer);
    gifSearchTimer = setTimeout(() => searchGifs(e.target.value), 250);
  }
  if (activeMediaTab === 'gestures') {
    mediaSearchValues.gestures = e.target.value;
    clearTimeout(gestureSearchTimer);
    gestureSearchTimer = setTimeout(() => {
      gesturePage = 1;
      loadGestures();
    }, 250);
  }
});

async function sendGif(result) {
  closeMediaPicker();
  const payload = { session_id: cfg.sessionId, join_token: cfg.myJoinToken, action: 'gif', gif_url: result.url, title: result.title || 'GIF', channel: activeChat };
  const partnerId = activeLinkPartnerId();
  const dmUserId = activeDmUserId();
  if (partnerId) {
    payload.channel = 'link';
    payload.target_participant_id = partnerId;
  } else if (dmUserId) {
    payload.channel = 'dm';
    payload.target_user_id = dmUserId;
  }
  try {
    const msg = await apiPost('/api/messages.php', payload);
    if (msg.channel === 'community') addMessageToChannel(msg, 'community', false);
    else if (msg.channel === 'link') addMessageToChannel(msg, `link:${partnerId}`, false);
    else if (msg.channel === 'dm') {
      addMessageToChannel(msg, `dm:${dmUserId}`, false);
      showDmFlight(msg);
    } else renderMessage(msg, true);
  } catch (err) {
    alert(err.message || err);
  }
}

function currentGestureQuery() {
  return activeMediaTab === 'gestures' ? (mediaSearchInput?.value || '') : '';
}

async function loadGestures() {
  if (!gestureGrid) return;
  gestureGrid.innerHTML = '<div class="gif-loading">Loading gestures...</div>';
  try {
    const qs = new URLSearchParams({
      session_id: cfg.sessionId,
      join_token: cfg.myJoinToken,
      page: String(gesturePage),
      q: currentGestureQuery(),
    });
    const data = await fetch(appUrl(`/api/gestures.php?${qs}`)).then(r => r.json());
    if (data.error) throw new Error(data.error);
    gestureHasMore = Boolean(data.has_more);
    gestureOwnedCount = Number(data.owned_count || 0);
    gestureOwnedLimit = Number(data.owned_limit ?? 50);
    if (gesturePageLabel) gesturePageLabel.textContent = `Page ${data.page || gesturePage}`;
    if (gesturePrev) gesturePrev.disabled = gesturePage <= 1;
    if (gestureNext) gestureNext.disabled = !gestureHasMore;
    renderGestureGrid(data.gestures || []);
    gesturePaletteLoaded = true;
  } catch (err) {
    gestureGrid.innerHTML = `<div class="minor">${esc(err.message || 'Gestures could not load.')}</div>`;
  }
}

function gestureTileLabel(gesture) {
  return gesture.text || gesture.name || 'Gesture';
}

function renderGestureGrid(gestures) {
  gestureGrid.innerHTML = '';
  const uploadTile = document.createElement('button');
  uploadTile.className = 'gesture-upload-tile';
  uploadTile.type = 'button';
  const limitReached = gestureOwnedCount >= gestureOwnedLimit;
  uploadTile.disabled = limitReached;
  uploadTile.title = limitReached ? 'Remove some gestures to make room.' : 'Upload .agst';
  uploadTile.innerHTML = `<span>+</span><small>Upload .agst</small><em>${gestureOwnedCount}/${gestureOwnedLimit}</em><div class="gesture-upload-progress"><i></i></div>`;
  uploadTile.addEventListener('click', () => {
    if (limitReached) return;
    gestureFileInput?.click();
  });
  gestureGrid.appendChild(uploadTile);

  if (!gestures.length) {
    const empty = document.createElement('div');
    empty.className = 'gesture-empty';
    empty.textContent = 'No gestures found.';
    gestureGrid.appendChild(empty);
    return;
  }

  gestures.forEach(gesture => {
    const tile = document.createElement('div');
    tile.className = `gesture-tile${gesture.mine ? ' mine' : ''}${gesture.is_public ? ' public' : ''}`;
    tile.dataset.gestureId = gesture.id;
    tile.innerHTML = `
      <button class="gesture-play" type="button" aria-label="Send ${esc(gestureTileLabel(gesture))}">
        <img src="${esc(mediaUrl(gesture.gif_path || gesture.gif_url))}" alt="${esc(gestureTileLabel(gesture))}">
      </button>
      ${gesture.mine ? '<button class="gesture-star" type="button" title="My gesture">★</button>' : ''}
      <button class="gesture-global" type="button" title="${gesture.is_public ? 'Community gesture' : 'Private gesture'}"${gesture.mine ? '' : ' disabled'}>🌐</button>
      ${gesture.audio_is_silent ? '' : '<button class="gesture-audio" type="button" title="Play gesture audio"><span>🎧</span></button>'}
    `;
    tile.addEventListener('click', e => {
      if (e.target.closest('.gesture-star, .gesture-global, .gesture-audio')) return;
      sendGesture(gesture);
    });
    tile.addEventListener('mouseenter', () => {
      if (gestureTray) gestureTray.textContent = gestureTileLabel(gesture);
    });
    tile.addEventListener('mouseleave', () => {
      if (gestureTray) gestureTray.textContent = '';
    });
    tile.querySelector('.gesture-star')?.addEventListener('click', e => {
      e.stopPropagation();
      deleteGesture(gesture);
    });
    tile.querySelector('.gesture-global')?.addEventListener('click', e => {
      e.stopPropagation();
      if (gesture.mine) toggleGesturePublic(gesture, !gesture.is_public);
    });
    tile.querySelector('.gesture-audio')?.addEventListener('click', e => {
      e.stopPropagation();
      toggleGestureAudio(gesture, e.currentTarget);
    });
    gestureGrid.appendChild(tile);
  });
}

async function uploadGesture(file) {
  if (gestureOwnedCount >= gestureOwnedLimit) {
    alert('Gesture limit reached. Remove some gestures to make room.');
    return;
  }
  const uploadTile = gestureGrid?.querySelector('.gesture-upload-tile');
  const bar = uploadTile?.querySelector('.gesture-upload-progress i');
  if (uploadTile) uploadTile.classList.add('uploading');
  if (bar) bar.style.width = '0%';
  const formData = new FormData();
  formData.append('session_id', cfg.sessionId);
  formData.append('join_token', cfg.myJoinToken);
  formData.append('gesture', file);
  await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener('progress', event => {
      if (bar && event.lengthComputable) bar.style.width = `${Math.max(4, Math.round((event.loaded / event.total) * 100))}%`;
    });
    xhr.addEventListener('load', () => {
      let data = {};
      try { data = JSON.parse(xhr.responseText || '{}'); } catch { reject(new Error('Gesture response was not readable.')); return; }
      if (xhr.status >= 200 && xhr.status < 400 && !data.error) resolve(data);
      else reject(new Error(data.error || 'Gesture upload failed.'));
    });
    xhr.addEventListener('error', () => reject(new Error('Gesture upload failed.')));
    xhr.open('POST', appUrl('/api/gestures.php'));
    xhr.send(formData);
  });
  if (bar) bar.style.width = '100%';
  await loadGestures();
}

gestureFileInput?.addEventListener('change', () => {
  const file = gestureFileInput.files && gestureFileInput.files[0];
  gestureFileInput.value = '';
  if (!file) return;
  uploadGesture(file).catch(err => alert(err.message || err));
});

gesturePrev?.addEventListener('click', () => {
  if (gesturePage <= 1) return;
  gesturePage -= 1;
  loadGestures();
});

gestureNext?.addEventListener('click', () => {
  if (!gestureHasMore) return;
  gesturePage += 1;
  loadGestures();
});

async function toggleGesturePublic(gesture, isPublic) {
  try {
    await apiPost('/api/gestures.php', { session_id: cfg.sessionId, join_token: cfg.myJoinToken, action: 'toggle_public', gesture_id: gesture.id, is_public: isPublic });
    await loadGestures();
  } catch (err) {
    alert(err.message || err);
  }
}

async function deleteGesture(gesture) {
  const msg = gesture.is_public
    ? 'Delete this gesture? It is public, so this removes it from everyone.'
    : 'Delete this gesture?';
  if (!confirm(msg)) return;
  try {
    await apiPost('/api/gestures.php', { session_id: cfg.sessionId, join_token: cfg.myJoinToken, action: 'delete', gesture_id: gesture.id });
    await loadGestures();
  } catch (err) {
    alert(err.message || err);
  }
}

function toggleGestureAudio(gesture, btn) {
  if (!gesture.audio_path) return;
  if (activeGestureAudio?.btn === btn) {
    activeGestureAudio.audio.pause();
    activeGestureAudio = null;
    btn.classList.remove('playing');
    btn.style.setProperty('--progress', '0deg');
    return;
  }
  if (activeGestureAudio) {
    activeGestureAudio.audio.pause();
    activeGestureAudio.btn.classList.remove('playing');
    activeGestureAudio.btn.style.setProperty('--progress', '0deg');
  }
  const audio = new Audio(mediaUrl(gesture.audio_path));
  activeGestureAudio = { audio, btn };
  btn.classList.add('playing');
  const update = () => {
    if (activeGestureAudio?.audio !== audio) return;
    const ratio = audio.duration ? audio.currentTime / audio.duration : 0;
    btn.style.setProperty('--progress', `${Math.round(ratio * 360)}deg`);
    if (!audio.paused && !audio.ended) requestAnimationFrame(update);
  };
  audio.addEventListener('ended', () => {
    btn.classList.remove('playing');
    btn.style.setProperty('--progress', '0deg');
    if (activeGestureAudio?.audio === audio) activeGestureAudio = null;
  }, { once: true });
  audio.play().then(update).catch(err => alert(err.message || 'Could not play audio.'));
}

async function sendGesture(gesture) {
  closeMediaPicker();
  const payload = { session_id: cfg.sessionId, join_token: cfg.myJoinToken, action: 'gesture', gesture_id: gesture.id, channel: 'room' };
  try {
    const msg = await apiPost('/api/messages.php', payload);
    switchChat('room');
    renderMessage(msg, true);
  } catch (err) {
    alert(err.message || err);
  }
}

document.addEventListener('click', e => {
  if (!ctxMenu.contains(e.target)) closeContextMenu();
  if (!textCtxMenu.contains(e.target)) closeTextContextMenu();
  if (msgActionMenu && !msgActionMenu.contains(e.target) && !e.target.closest('.msg-options')) closeMessageActionMenu();
  if (tabCtxMenu && !tabCtxMenu.contains(e.target)) closeTabContextMenu();
  if (!roomMenu.contains(e.target) && !e.target.closest('#room-menu-btn')) closeRoomMenu();
  if (roomActionMenu && !roomActionMenu.contains(e.target) && !e.target.closest('#room-action-btn')) closeRoomActionMenu();
  if (gameStartMenu && !gameStartMenu.contains(e.target) && !e.target.closest('#game-start-btn')) closeGameStartMenu();
  if (mediaPicker && !mediaPicker.contains(e.target) && !e.target.closest('#emoji-btn')) closeMediaPicker();
  if (!attachMenu.contains(e.target) && !e.target.closest('#attach-btn')) closeAttachMenu();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeContextMenu();
    closeTextContextMenu();
    closeMessageActionMenu();
    closeTabContextMenu();
    closeRoomMenu();
    closeRoomActionMenu();
    closeMediaPicker();
    closeAttachMenu();
    closeLinkIconModal();
    document.getElementById('host-warn-modal')?.classList.remove('open');
    document.getElementById('host-kick-modal')?.classList.remove('open');
    document.getElementById('warning-modal')?.classList.remove('open');
    closeDeleteMessageModal();
    cancelVoiceNote();
  }
});

document.addEventListener('contextmenu', e => {
  const tab = e.target.closest('.chat-tab[data-chat-tab]');
  if (tab) {
    const chatKey = tab.dataset.chatTab || '';
    if (chatKey.startsWith('dm:') || chatKey.startsWith('link:')) {
      e.preventDefault();
      e.stopPropagation();
      openTabContextMenu(e.clientX, e.clientY, chatKey);
      return;
    }
  }

  if (e.target.closest('.avatar')) return;

  const input = e.target.closest('#chat-input');
  if (input) {
    e.preventDefault();
    openTextContextMenu(e.clientX, e.clientY, 'input');
    return;
  }

  if (e.target.closest('.sidebar')) {
    e.preventDefault();
    closeContextMenu();
    closeTextContextMenu();
    return;
  }

  if (e.target.closest('.room-stage')) {
    e.preventDefault();
    closeContextMenu();
    closeTextContextMenu();
    return;
  }

  if (e.target.closest('.chat-pane')) {
    e.preventDefault();
    if (e.target.closest('.message')) return;
    const selection = window.getSelection();
    const selectedText = selection ? selection.toString() : '';
    if (selectedText.trim()) openTextContextMenu(e.clientX, e.clientY, 'copy');
    else closeTextContextMenu();
  }
});

roomStage.addEventListener('contextmenu', e => {
  if (e.target.closest('.avatar')) return;
  e.preventDefault();
  e.stopPropagation();
  closeContextMenu();
  closeTextContextMenu();
}, true);

document.querySelector('.sidebar').addEventListener('contextmenu', e => {
  if (e.target.closest('.person-row')) return;
  e.preventDefault();
  e.stopPropagation();
  closeContextMenu();
  closeTextContextMenu();
}, true);

async function copySelectedText() {
  const input = document.activeElement && document.activeElement.id === 'chat-input' ? document.activeElement : null;
  let text = '';
  if (input) text = input.value.slice(input.selectionStart, input.selectionEnd);
  if (!text) text = window.getSelection()?.toString() || '';
  if (text) await navigator.clipboard.writeText(text);
}

async function cutSelectedInputText() {
  const input = document.getElementById('chat-input');
  const start = input.selectionStart;
  const end = input.selectionEnd;
  if (start === end) return;
  const text = input.value.slice(start, end);
  await navigator.clipboard.writeText(text);
  input.value = input.value.slice(0, start) + input.value.slice(end);
  input.setSelectionRange(start, start);
  input.focus();
  updateComposerState();
}

async function pasteIntoInput() {
  const input = document.getElementById('chat-input');
  const text = await navigator.clipboard.readText();
  const start = input.selectionStart;
  const end = input.selectionEnd;
  input.value = (input.value.slice(0, start) + text + input.value.slice(end)).slice(0, input.maxLength);
  const pos = start + text.length;
  input.setSelectionRange(Math.min(pos, input.value.length), Math.min(pos, input.value.length));
  input.focus();
  updateComposerState();
}

document.getElementById('text-copy').addEventListener('click', async () => {
  try { await copySelectedText(); } finally { closeTextContextMenu(); }
});
document.getElementById('text-cut').addEventListener('click', async () => {
  try { if (textMenuMode === 'input') await cutSelectedInputText(); } finally { closeTextContextMenu(); }
});
document.getElementById('text-paste').addEventListener('click', async () => {
  try { if (textMenuMode === 'input') await pasteIntoInput(); } finally { closeTextContextMenu(); }
});

async function applyReaction(messageId, emoji, chatKey = activeChat) {
  if (!messageId || !emoji) return;
  await apiPost('/api/reactions.php', {
    session_id: cfg.sessionId,
    join_token: cfg.myJoinToken,
    message_id: Number(messageId),
    channel: channelForApi(chatKey),
    emoji,
  }).catch(err => showWarning(err.message || 'Reaction failed.'));
}

function currentActiveMessage(messageId = msgActionTargetId, chatKey = msgActionTargetChat || activeChat) {
  return channelMapFor(chatKey).get(Number(messageId)) || (chatKey === 'room' ? messages.get(Number(messageId)) : null);
}

document.querySelectorAll('[data-msg-reaction]').forEach(btn => {
  btn.addEventListener('click', async () => {
    const messageId = msgActionTargetId;
    const chatKey = msgActionTargetChat || activeChat;
    closeMessageActionMenu();
    await applyReaction(messageId, btn.dataset.msgReaction, chatKey);
  });
});

document.getElementById('msg-edit-action')?.addEventListener('click', async () => {
  const chatKey = msgActionTargetChat || activeChat;
  const msg = currentActiveMessage(msgActionTargetId, chatKey);
  closeMessageActionMenu();
  if (!msg) return;
  startInlineEdit(msg, chatKey);
});

function startInlineEdit(msg, chatKey = activeChat) {
  const row = messagesEl.querySelector(`[data-message-id="${CSS.escape(String(msg.id))}"]`);
  const contentEl = row?.querySelector('.msg-content');
  if (!row || !contentEl) return;
  contentEl.innerHTML = `<textarea class="edit-msg-input" maxlength="1000" rows="3"></textarea><div class="edit-msg-actions"><button class="btn btn-primary edit-msg-save" type="button">Edit</button><button class="btn edit-msg-cancel" type="button">Cancel</button></div>`;
  const input = contentEl.querySelector('textarea');
  input.value = msg.content || '';
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);
  contentEl.querySelector('.edit-msg-cancel').addEventListener('click', () => renderActiveChat());
  contentEl.querySelector('.edit-msg-save').addEventListener('click', () => saveInlineEdit(msg, input, chatKey));
  input.addEventListener('keydown', e => {
    if (e.key === 'Escape') renderActiveChat();
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      saveInlineEdit(msg, input, chatKey);
    }
  });
}

async function saveInlineEdit(msg, input, chatKey = activeChat) {
  const content = input.value.trim();
  if (!content) return;
  try {
    const updated = await apiPost('/api/messages.php', {
      action: 'edit',
      session_id: cfg.sessionId,
      join_token: cfg.myJoinToken,
      message_id: msg.id,
      channel: channelForApi(chatKey),
      content,
    });
    updateMessageInChannel(chatKey, msg.id, { content, url_preview: updated.url_preview || null, edited_at: updated.edited_at || new Date().toISOString() });
  } catch (err) {
    showWarning(err.message || 'Could not edit message.');
  }
}

document.getElementById('msg-delete-action')?.addEventListener('click', async () => {
  const chatKey = msgActionTargetChat || activeChat;
  const msg = currentActiveMessage(msgActionTargetId, chatKey);
  closeMessageActionMenu();
  if (!msg) return;
  pendingDeleteMessageId = msg.id;
  pendingDeleteChatKey = chatKey;
  document.getElementById('delete-message-modal')?.classList.add('open');
});

function closeDeleteMessageModal() {
  pendingDeleteMessageId = null;
  pendingDeleteChatKey = null;
  document.getElementById('delete-message-modal')?.classList.remove('open');
}

document.getElementById('delete-message-close')?.addEventListener('click', closeDeleteMessageModal);
document.getElementById('delete-message-cancel')?.addEventListener('click', closeDeleteMessageModal);

document.getElementById('delete-message-confirm')?.addEventListener('click', async () => {
  const chatKey = pendingDeleteChatKey || activeChat;
  const msg = currentActiveMessage(pendingDeleteMessageId, chatKey);
  if (!msg) {
    closeDeleteMessageModal();
    return;
  }
  closeDeleteMessageModal();
  try {
    const deleted = await apiPost('/api/messages.php', {
      action: 'delete',
      session_id: cfg.sessionId,
      join_token: cfg.myJoinToken,
      message_id: msg.id,
      channel: channelForApi(chatKey),
    });
    if (chatKey === 'room' && cfg.canModerateMessages) {
      updateMessageInChannels(msg.id, { is_deleted: true, deleted_at: deleted.deleted_at || new Date().toISOString() });
    } else {
      removeMessageFromChannel(chatKey, msg.id);
    }
  } catch (err) {
    showWarning(err.message || 'Could not delete message.');
  }
});

function unlinkCurrentPartner() {
  const partnerId = activeLinkPartnerId() || linkedPartner()?.id;
  const target = partnerId ? participants.get(partnerId) : null;
  const me = participants.get(cfg.myParticipantId);
  if (!me) return;
  if (me.linked_to) me.linked_to = null;
  if (target && target.linked_to === cfg.myParticipantId) target.linked_to = null;
  participants.forEach(p => {
    if (p.linked_to === cfg.myParticipantId || p.id === cfg.myParticipantId) p.linked_to = null;
    renderParticipant(p);
  });
  if (activeChat.startsWith('link:')) switchChat('room');
  apiPost('/api/users.php', { action: 'unlink', session_id: cfg.sessionId, join_token: cfg.myJoinToken }).catch(console.warn);
  renderPeople();
  renderLinkTabs();
}

async function clearPrivateHistory(chatKey) {
  if (!chatKey || (!chatKey.startsWith('dm:') && !chatKey.startsWith('link:'))) return;
  const payload = {
    action: 'clear',
    session_id: cfg.sessionId,
    join_token: cfg.myJoinToken,
    channel: channelForApi(chatKey),
  };
  if (chatKey.startsWith('dm:')) payload.target_user_id = Number(chatKey.slice(3));
  if (chatKey.startsWith('link:')) payload.target_participant_id = Number(chatKey.slice(5));
  await apiPost('/api/private_history.php', payload);
  channelMapFor(chatKey).clear();
  clearUnread(chatKey);
  if (activeChat === chatKey) renderActiveChat();
}

function closeDmTab(chatKey) {
  if (!chatKey?.startsWith('dm:')) return;
  const userId = Number(chatKey.slice(3));
  closedDmUserIds.add(userId);
  clearUnread(chatKey);
  document.querySelector(`.chat-tab[data-chat-tab="${CSS.escape(chatKey)}"]`)?.remove();
  if (activeChat === chatKey) switchChat('room');
}

document.getElementById('tab-clear-history')?.addEventListener('click', async () => {
  const chatKey = tabCtxTargetChat;
  closeTabContextMenu();
  if (!chatKey) return;
  try {
    await clearPrivateHistory(chatKey);
  } catch (err) {
    showWarning(err.message || 'Could not clear history.');
  }
});

document.getElementById('tab-close-dm')?.addEventListener('click', () => {
  const chatKey = tabCtxTargetChat;
  closeTabContextMenu();
  closeDmTab(chatKey);
});

document.getElementById('tab-unlink')?.addEventListener('click', () => {
  closeTabContextMenu();
  unlinkCurrentPartner();
});

document.getElementById('ctx-change-avatar').addEventListener('click', () => {
  closeContextMenu();
  avatarFileInput.click();
});

document.getElementById('ctx-unlink').addEventListener('click', () => {
  closeContextMenu();
  unlinkCurrentPartner();
});

document.getElementById('ctx-dm').addEventListener('click', () => {
  const p = participants.get(ctxMenuParticipantId);
  closeContextMenu();
  if (p) openDmWithUser({ id: p.user_id, display_name: p.display_name, avatar_url: avatarUrl(p) });
});

document.getElementById('ctx-tools')?.addEventListener('click', e => {
  e.stopPropagation();
  document.getElementById('ctx-tools-wrap')?.classList.toggle('open');
});

async function setBlockState(participant, blocked) {
  if (!participant || participant.id === cfg.myParticipantId) return;
  const action = blocked ? 'block_user' : 'unblock_user';
  if (blocked) {
    blockedUserIds.add(Number(participant.user_id));
    participants.forEach(p => {
      if (p.id === participant.id || p.linked_to === participant.id || (p.id === cfg.myParticipantId && p.linked_to === participant.id)) p.linked_to = null;
    });
  } else {
    blockedUserIds.delete(Number(participant.user_id));
  }
  renderParticipant(participant);
  renderPeople();
  renderLinkTabs();
  renderActiveChat();
  await apiPost('/api/users.php', {
    action,
    session_id: cfg.sessionId,
    join_token: cfg.myJoinToken,
    target_participant_id: participant.id,
  });
}

document.getElementById('ctx-block').addEventListener('click', () => {
  const p = participants.get(ctxMenuParticipantId);
  closeContextMenu();
  setBlockState(p, true).catch(err => showWarning(err.message || 'Could not block user.'));
});

document.getElementById('ctx-unblock').addEventListener('click', () => {
  const p = participants.get(ctxMenuParticipantId);
  closeContextMenu();
  setBlockState(p, false).catch(err => showWarning(err.message || 'Could not unblock user.'));
});

avatarFileInput.addEventListener('change', async () => {
  const file = avatarFileInput.files && avatarFileInput.files[0];
  if (!file) return;
  let preparedFile = file;
  let previewUrl = '';
  const fd = new FormData();
  fd.append('session_id', cfg.sessionId);
  fd.append('join_token', cfg.myJoinToken);
  try {
    if (window.ChatSpaceAvatar) preparedFile = await window.ChatSpaceAvatar.prepareAvatarFile(file);
    previewUrl = URL.createObjectURL(preparedFile);
    const me = participants.get(cfg.myParticipantId);
    if (me) {
      me.webcam_path = null;
      me.avatar_path = previewUrl;
      me.avatar_url = previewUrl;
      me.avatar_version = Date.now();
      renderParticipant(me);
    }
    fd.append('avatar', preparedFile);
    const resp = await fetch(appUrl('/api/avatar.php'), { method: 'POST', body: fd });
    const data = await resp.json();
    if (!resp.ok || data.error) throw new Error(data.error || 'Avatar upload failed');
    const updated = participants.get(cfg.myParticipantId);
    updated.avatar_path = data.avatar_path;
    updated.avatar_url = data.avatar_url;
    updated.avatar_version = Date.now();
    updated.webcam_path = null;
    renderParticipant(updated);
  } catch (err) {
    alert(err.message);
  } finally {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    avatarFileInput.value = '';
  }
});

ctxToggleWebcam.addEventListener('click', async () => {
  closeContextMenu();
  if (webcamStream) {
    webcamStream.getTracks().forEach(t => t.stop());
    webcamStream = null;
    clearInterval(webcamTimer);
    await apiPost('/api/webcam_frame.php', { action: 'off', session_id: cfg.sessionId, join_token: cfg.myJoinToken });
    applyWebcamPath(cfg.myParticipantId, null);
    return;
  }
  webcamStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  const video = document.createElement('video');
  video.srcObject = webcamStream;
  video.muted = true;
  await video.play();
  const canvas = document.createElement('canvas');
  canvas.width = 250;
  canvas.height = 250;
  const ctx = canvas.getContext('2d');
  function drawWebcamCover() {
    const vw = video.videoWidth || canvas.width;
    const vh = video.videoHeight || canvas.height;
    const scale = Math.max(canvas.width / vw, canvas.height / vh);
    const sw = canvas.width / scale;
    const sh = canvas.height / scale;
    const sx = Math.max(0, (vw - sw) / 2);
    const sy = Math.max(0, (vh - sh) / 2);
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  }
  async function sendFrame() {
    drawWebcamCover();
    const image = canvas.toDataURL('image/jpeg', .72);
    const data = await apiPost('/api/webcam_frame.php', { action: 'frame', session_id: cfg.sessionId, join_token: cfg.myJoinToken, image }).catch(() => null);
    if (data?.webcam_path) applyWebcamPath(cfg.myParticipantId, data.webcam_path);
  }
  await sendFrame();
  webcamTimer = setInterval(sendFrame, 2600);
});

function setRoomHeight(pct) {
  document.documentElement.style.setProperty('--room-height', `${pct}%`);
}

function applyDividerDrag(clientY) {
  const rect = mainEl.getBoundingClientRect();
  let pct = ((clientY - rect.top) / rect.height) * 100;
  pct = Math.max(18, Math.min(78, pct));
  setRoomHeight(pct);
  participants.forEach(positionAvatar);
}

function setSidebarWidth(px) {
  document.documentElement.style.setProperty('--sidebar-width', `${Math.round(px)}px`);
}

function applyVerticalDividerDrag(clientX) {
  const layoutRect = roomLayout.getBoundingClientRect();
  const dividerEl = document.getElementById('vertical-divider');
  const dividerWidth = dividerEl?.getBoundingClientRect().width || 6;
  const dividerMarginRight = dividerEl ? parseFloat(getComputedStyle(dividerEl).marginRight) || 0 : 0;
  const rightGutter = 10;
  const minMainWidth = 620;
  const minSidebarWidth = 300;
  const maxSidebarWidth = Math.max(minSidebarWidth, Math.min(560, layoutRect.width - dividerWidth - dividerMarginRight - rightGutter - minMainWidth));
  let width = layoutRect.right - clientX - (dividerWidth / 2) - dividerMarginRight - rightGutter;
  width = Math.max(minSidebarWidth, Math.min(maxSidebarWidth, width));
  setSidebarWidth(width);
  participants.forEach(positionAvatar);
}

document.getElementById('horizontal-divider')?.addEventListener('pointerdown', e => {
  e.preventDefault();
  const onMove = ev => applyDividerDrag(ev.clientY);
  const onUp = () => {
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
  };
  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
});

document.getElementById('vertical-divider')?.addEventListener('pointerdown', e => {
  e.preventDefault();
  const onMove = ev => applyVerticalDividerDrag(ev.clientX);
  const onUp = () => {
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
  };
  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
});

async function loadGames() {
  const qs = new URLSearchParams({ session_id: cfg.sessionId, participant_id: cfg.myParticipantId, join_token: cfg.myJoinToken });
  const data = await fetch(appUrl('/api/games.php?' + qs)).then(r => r.json()).catch(() => ({ games: [] }));
  gameListEl.innerHTML = '';
  activeGames.clear();
  gameListEl.hidden = !(data.games || []).length;
  (data.games || []).forEach(a => {
    activeGames.set(a.lobby_code, a);
    const row = document.createElement('div');
    row.className = `game-row${activeGame?.lobby_code === a.lobby_code ? ' active' : ''}`;
    const inGame = (a.players || []).some(player => Number(player.participant_id) === Number(cfg.myParticipantId));
    const players = (a.players || []).map(player => `<img src="${esc(mediaUrl(player.avatar_url))}" alt="${esc(player.display_name)}" title="${esc(player.display_name)}">`).join('');
    const action = inGame ? '<span class="game-row-state">In-game</span>' : '<button class="btn">Open</button>';
    row.innerHTML = `<div class="game-row-main"><strong class="game-row-title"><img src="${esc(gameIconUrl(a.game_type))}" alt="">${esc(gameName(a.game_type))}</strong><div class="minor">Started by ${esc(a.started_by_name)}</div><div class="game-row-players">${players || '<span class="minor">Waiting for players</span>'}</div></div>${action}`;
    row.querySelector('button')?.addEventListener('click', () => openGame(a));
    if (inGame) row.addEventListener('click', () => openGame(a));
    gameListEl.appendChild(row);
  });
  if (activeGame && activeGames.has(activeGame.lobby_code)) {
    activeGame = Object.assign(activeGame, activeGames.get(activeGame.lobby_code));
    updateGameStagePlayers();
    setGameLayerVisibility();
  } else if (activeGame) {
    hideGameOverlay();
  }
  renderPeople();
  renderLinkTabs();
}

function gameName(type) {
  return GAME_CATALOG[type]?.name || type;
}

function gamePath(type) {
  return GAME_CATALOG[type]?.path || type;
}

function gameIconUrl(type) {
  return appUrl(`/assets/images/${GAME_CATALOG[type]?.icon || gamePath(type)}-icon.png`);
}

function gameFrameUrl(game) {
  const meta = GAME_CATALOG[game.game_type] || { path: game.game_type, entry: 'index.html', gameId: 0 };
  const qs = new URLSearchParams({
    lobby: game.lobby_code,
    user: String(cfg.myParticipantId),
    game: String(meta.gameId || 0),
    embedded: '1',
  });
  return appUrl(`/games/${meta.path}/${meta.entry}?${qs}`);
}

function gameSeatRole(type, seat) {
  const labels = GAME_CATALOG[type]?.seats || [];
  return labels[Number(seat) - 1] || `Player ${seat}`;
}

function setGameLayerVisibility() {
  if (!gameStage) return;
  gameStage.hidden = !(activeGame && activeChat === gameChatKey(activeGame.lobby_code));
}

async function openGame(a) {
  activeGame = Object.assign({}, a);
  try {
    await apiPost('/api/games.php', {
      action: 'join',
      session_id: cfg.sessionId,
      participant_id: cfg.myParticipantId,
      join_token: cfg.myJoinToken,
      lobby_code: a.lobby_code,
    });
    await loadGames();
    activeGame = Object.assign(activeGame || {}, activeGames.get(a.lobby_code) || a);
  } catch (err) {
    console.warn(err);
  }
  document.getElementById('game-stage-title').textContent = gameName(activeGame.game_type);
  const stageIcon = document.getElementById('game-stage-icon');
  if (stageIcon) {
    stageIcon.src = gameIconUrl(activeGame.game_type);
    stageIcon.hidden = false;
  }
  gameFrame.src = gameFrameUrl(activeGame);
  updateGameStagePlayers();
  renderLinkTabs();
  switchChat(`game:${activeGame.lobby_code}`);
  startGameChatPolling();
}

function hideGameOverlay() {
  stopGameChatPolling();
  stopGameTypingNow();
  activeGame = null;
  if (gameFrame) gameFrame.src = 'about:blank';
  if (gameStage) gameStage.hidden = true;
  if (activeChat.startsWith('game:')) switchChat('room');
  renderLinkTabs();
}

async function closeGame(lobbyCode = activeGame?.lobby_code, notifyServer = true) {
  if (lobbyCode) {
    if (notifyServer) {
      await apiPost('/api/games.php', {
        action: 'close',
        session_id: cfg.sessionId,
        participant_id: cfg.myParticipantId,
        join_token: cfg.myJoinToken,
        lobby_code: lobbyCode,
      }).catch(console.warn);
    }
  }
  hideGameOverlay();
  await loadGames();
}

function gameChatKey(lobbyCode = activeGame?.lobby_code) {
  return lobbyCode ? `game:${lobbyCode}` : 'game:';
}

function updateGameStagePlayers() {
  if (!activeGame) return;
  const bySeat = new Map((activeGame.players || []).map(player => [Number(player.seat), player]));
  [
    [document.getElementById('game-player-one'), bySeat.get(1), 'Player 1'],
    [document.getElementById('game-player-two'), bySeat.get(2), 'Player 2'],
  ].forEach(([card, player, label]) => {
    if (!card) return;
    const img = card.querySelector('img');
    const name = card.querySelector('strong');
    const sub = card.querySelector('.minor');
    if (img) img.src = mediaUrl(player?.avatar_url || appUrl('/assets/images/baghead.png'));
    if (name) name.textContent = player?.display_name || 'Waiting';
    if (sub) {
      sub.className = `minor game-player-role${player && Number(player.participant_id) === Number(cfg.myParticipantId) ? ' is-you' : ''}`;
      sub.textContent = player ? gameSeatRole(activeGame.game_type, player.seat || (label === 'Player 1' ? 1 : 2)) : `${label} open`;
    }
    card.dataset.participantId = player?.participant_id || '';
    card.classList.toggle('typing', player && gameTypingIds.has(Number(player.participant_id)));
  });
}

function addGameMessageToChannel(msg, live = false) {
  if (!activeGame || msg.lobby_code !== activeGame.lobby_code) return;
  addMessageToChannel(msg, gameChatKey(msg.lobby_code), live);
}

async function sendGameMessage(content) {
  if (!activeGame) return;
  const msg = await apiPost('/api/game_chat.php', {
    action: 'message',
    session_id: cfg.sessionId,
    join_token: cfg.myJoinToken,
    lobby_code: activeGame.lobby_code,
    content,
  });
  addGameMessageToChannel(msg, false);
}

function stopGameChatPolling() {
  clearTimeout(gameChatPollTimer);
  gameChatPollTimer = null;
  gameTypingIds.clear();
  updateGameStagePlayers();
}

async function pollGameChat() {
  if (!activeGame) return;
  const lobby = activeGame.lobby_code;
  const last = gameChatLastIds.get(lobby) || 0;
  try {
    const qs = new URLSearchParams({
      session_id: cfg.sessionId,
      join_token: cfg.myJoinToken,
      lobby_code: lobby,
      since_id: String(last),
    });
    const data = await fetch(appUrl('/api/game_chat.php?' + qs)).then(r => r.json());
    if (data.error) throw new Error(data.error);
    (data.messages || []).forEach(msg => {
      gameChatLastIds.set(lobby, Math.max(gameChatLastIds.get(lobby) || 0, Number(msg.id)));
      addGameMessageToChannel(msg, true);
    });
    gameTypingIds.clear();
    (data.typing || []).forEach(id => gameTypingIds.add(Number(id)));
    updateGameStagePlayers();
  } catch (err) {
    console.warn(err);
  } finally {
    if (activeGame?.lobby_code === lobby) gameChatPollTimer = setTimeout(pollGameChat, 900);
  }
}

function startGameChatPolling() {
  stopGameChatPolling();
  pollGameChat();
}

function sendGameTyping(active) {
  if (!activeGame) return Promise.resolve();
  return apiPost('/api/game_chat.php', {
    action: 'typing',
    session_id: cfg.sessionId,
    join_token: cfg.myJoinToken,
    lobby_code: activeGame.lobby_code,
    active,
  }).catch(() => {});
}

function stopGameTypingNow() {
  clearTimeout(gameTypingStopTimer);
  if (gameTypingActive) {
    gameTypingActive = false;
    sendGameTyping(false);
  }
}

function handleGameTypingInput() {
  if (!activeGame) return;
  if (!gameTypingActive) {
    gameTypingActive = true;
    sendGameTyping(true);
  }
  clearTimeout(gameTypingStopTimer);
  gameTypingStopTimer = setTimeout(stopGameTypingNow, 1200);
}

document.getElementById('game-close').addEventListener('click', () => {
  closeGame();
});

document.getElementById('game-rematch')?.addEventListener('click', () => {
  gameFrame?.contentWindow?.postMessage({ type: 'game_control', action: 'rematch' }, window.location.origin);
});

document.getElementById('game-resign')?.addEventListener('click', () => {
  gameFrame?.contentWindow?.postMessage({ type: 'game_control', action: 'resign' }, window.location.origin);
});

window.addEventListener('message', e => {
  if (e.origin !== window.location.origin) return;
  if (e.data?.type === 'game_close') closeGame(e.data.lobby);
});

document.getElementById('edit-room-btn')?.addEventListener('click', () => {
  openRoomEditModal();
});

function openRoomEditModal() {
  document.getElementById('room-edit-name').value = cfg.roomName || '';
  setRoomEditPreview(cfg.backgroundPath || '', cfg.backgroundMime || '', cfg.backgroundThumbPath || '');
  resetUploadProgress(document.getElementById('room-edit-upload-progress'));
  document.getElementById('room-edit-modal').classList.add('open');
  loadRoomEjections();
}

document.getElementById('room-action-edit')?.addEventListener('click', () => {
  closeRoomActionMenu();
  openRoomEditModal();
});

document.getElementById('room-action-effects')?.addEventListener('click', async () => {
  closeRoomActionMenu();
  try {
    await loadRoomEffectsState();
    renderRoomEffectsModal();
    document.getElementById('room-effects-modal').classList.add('open');
  } catch (err) {
    alert(err.message || err);
  }
});

function closeClearRoomHistoryModal() {
  document.getElementById('clear-room-history-modal')?.classList.remove('open');
}

document.getElementById('room-action-clear-history')?.addEventListener('click', () => {
  closeRoomActionMenu();
  document.getElementById('clear-room-history-modal')?.classList.add('open');
});

document.getElementById('clear-room-history-close')?.addEventListener('click', closeClearRoomHistoryModal);
document.getElementById('clear-room-history-cancel')?.addEventListener('click', closeClearRoomHistoryModal);

document.getElementById('clear-room-history-confirm')?.addEventListener('click', async e => {
  const btn = e.currentTarget;
  btn.disabled = true;
  try {
    const data = await apiPost('/api/host_tools.php', {
      action: 'clear_room_history',
      session_id: cfg.sessionId,
      join_token: cfg.myJoinToken,
    });
    closeClearRoomHistoryModal();
    handleRoomHistoryClear(data);
  } catch (err) {
    showWarning(err.message || 'Could not clear room history.');
  } finally {
    btn.disabled = false;
  }
});

document.getElementById('room-effects-close')?.addEventListener('click', () => {
  document.getElementById('room-effects-modal').classList.remove('open');
});

document.getElementById('room-effects-form')?.addEventListener('submit', async e => {
  e.preventDefault();
  const select = document.getElementById('room-effect-select');
  if (!select.value) return;
  try {
    const data = await apiPost('/api/room_effects.php', {
      session_id: cfg.sessionId,
      join_token: cfg.myJoinToken,
      action: 'start',
      effect_key: select.value,
      duration_minutes: document.getElementById('room-effect-duration').value,
    });
    cfg.activeRoomEffect = data.current || null;
    await applyRoomEffect(cfg.activeRoomEffect, false);
    renderRoomEffectsModal();
    document.getElementById('room-effects-modal').classList.remove('open');
  } catch (err) {
    alert(err.message || err);
  }
});

document.getElementById('room-effect-stop')?.addEventListener('click', async () => {
  try {
    await apiPost('/api/room_effects.php', {
      session_id: cfg.sessionId,
      join_token: cfg.myJoinToken,
      action: 'stop',
    });
    cfg.activeRoomEffect = null;
    await applyRoomEffect(null, false);
    renderRoomEffectsModal();
  } catch (err) {
    alert(err.message || err);
  }
});

document.getElementById('room-edit-close')?.addEventListener('click', () => {
  document.getElementById('room-edit-modal').classList.remove('open');
});

function closeRoomDeleteModal() {
  document.getElementById('room-delete-modal')?.classList.remove('open');
}

document.getElementById('room-delete-open')?.addEventListener('click', () => {
  document.getElementById('room-delete-modal')?.classList.add('open');
});

document.getElementById('room-delete-close')?.addEventListener('click', closeRoomDeleteModal);
document.getElementById('room-delete-cancel')?.addEventListener('click', closeRoomDeleteModal);

document.getElementById('room-delete-confirm')?.addEventListener('click', async e => {
  const btn = e.currentTarget;
  btn.disabled = true;
  try {
    await apiPost('/api/room_delete.php', {
      session_id: cfg.sessionId,
      join_token: cfg.myJoinToken,
    });
    closeRoomDeleteModal();
    document.getElementById('room-edit-modal')?.classList.remove('open');
    await handleRoomDeleted({ room_name: cfg.roomName });
  } catch (err) {
    alert(err.message || err);
    btn.disabled = false;
  }
});

document.getElementById('room-edit-background')?.addEventListener('change', e => {
  const file = e.target.files && e.target.files[0];
  document.getElementById('room-edit-background-name').textContent = file ? file.name : 'No file selected';
  if (file) setRoomEditPreview(URL.createObjectURL(file), file.type);
});

document.getElementById('room-edit-form')?.addEventListener('submit', async e => {
  e.preventDefault();
  const form = e.currentTarget;
  const fd = new FormData(form);
  fd.append('session_id', cfg.sessionId);
  fd.append('join_token', cfg.myJoinToken);
  const bgFile = fd.get('background');
  const thumb = await videoThumbnailBlob(bgFile);
  if (thumb) fd.append('background_thumb', thumb, 'background-thumb.jpg');
  const progressEl = document.getElementById('room-edit-upload-progress');
  const submitBtn = form.querySelector('button[type="submit"]');
  try {
    const update = await apiUploadWithProgress('/api/room_update.php', fd, progressEl, submitBtn);
    applyRoomUpdate(update);
    resetUploadProgress(progressEl);
    document.getElementById('room-edit-modal').classList.remove('open');
  } catch (err) {
    alert(err.message || err);
    resetUploadProgress(progressEl);
  }
});

async function loadRoomEjections() {
  const list = document.getElementById('room-ejection-list');
  if (!list) return;
  list.innerHTML = '<div class="minor">Loading...</div>';
  try {
    const qs = new URLSearchParams({ session_id: cfg.sessionId });
    const data = await fetch(appUrl('/api/room_ejections.php?' + qs)).then(r => r.json());
    list.innerHTML = '';
    if (!(data.ejections || []).length) {
      list.innerHTML = '<div class="minor">No active kicks.</div>';
      return;
    }
    (data.ejections || []).forEach(ejection => {
      const row = document.createElement('div');
      row.className = 'ejection-row';
      const duration = ejection.permanent ? 'Permanent' : `${ejection.duration_minutes} minutes`;
      row.innerHTML = `<div><strong>${esc(ejection.display_name)}</strong><div class="minor">${esc(duration)} · by ${esc(ejection.ejected_by_name)}</div></div><button class="btn btn-danger" type="button">Delete</button>`;
      row.querySelector('button').addEventListener('click', async () => {
        await apiPost('/api/room_ejections.php', { action: 'delete', session_id: cfg.sessionId, id: ejection.id });
        await loadRoomEjections();
      });
      list.appendChild(row);
    });
  } catch (err) {
    list.innerHTML = `<div class="minor">${esc(err.message || 'Could not load kicked users.')}</div>`;
  }
}

document.getElementById('ctx-host-warn')?.addEventListener('click', () => {
  const target = participants.get(ctxMenuParticipantId);
  if (!target) return;
  hostModalTargetParticipantId = target.id;
  closeContextMenu();
  document.getElementById('host-warn-target').textContent = `Warning ${displayNameFor(target)}`;
  document.getElementById('host-warn-message').value = '';
  document.getElementById('host-warn-modal').classList.add('open');
  document.getElementById('host-warn-message').focus();
});

document.getElementById('host-warn-close')?.addEventListener('click', () => {
  hostModalTargetParticipantId = null;
  document.getElementById('host-warn-modal').classList.remove('open');
});

document.getElementById('host-warn-form')?.addEventListener('submit', async e => {
  e.preventDefault();
  const target = participants.get(hostModalTargetParticipantId);
  if (!target) return;
  await apiPost('/api/host_tools.php', {
    action: 'warn',
    session_id: cfg.sessionId,
    join_token: cfg.myJoinToken,
    target_participant_id: target.id,
    message: document.getElementById('host-warn-message').value,
  });
  hostModalTargetParticipantId = null;
  document.getElementById('host-warn-modal').classList.remove('open');
});

document.getElementById('ctx-host-kick')?.addEventListener('click', () => {
  const target = participants.get(ctxMenuParticipantId);
  if (!target) return;
  hostModalTargetParticipantId = target.id;
  closeContextMenu();
  document.getElementById('host-kick-target').textContent = `Kick ${displayNameFor(target)} from this room`;
  document.getElementById('host-kick-duration').value = '5';
  document.getElementById('host-kick-modal').classList.add('open');
});

document.getElementById('host-kick-close')?.addEventListener('click', () => {
  hostModalTargetParticipantId = null;
  document.getElementById('host-kick-modal').classList.remove('open');
});

document.getElementById('host-kick-form')?.addEventListener('submit', async e => {
  e.preventDefault();
  const target = participants.get(hostModalTargetParticipantId);
  if (!target) return;
  const value = document.getElementById('host-kick-duration').value;
  await apiPost('/api/host_tools.php', {
    action: 'kick',
    session_id: cfg.sessionId,
    join_token: cfg.myJoinToken,
    target_participant_id: target.id,
    permanent: value === 'permanent',
    duration_minutes: value === 'permanent' ? null : Number(value),
  });
  hostModalTargetParticipantId = null;
  document.getElementById('host-kick-modal').classList.remove('open');
  await loadRoomEjections();
});

document.getElementById('ctx-community-eject')?.addEventListener('click', () => {
  const target = participants.get(ctxMenuParticipantId);
  if (!target) return;
  hostModalTargetParticipantId = target.id;
  closeContextMenu();
  document.getElementById('community-eject-target').textContent = `Eject ${displayNameFor(target)} from the community`;
  document.getElementById('community-eject-duration').value = '5';
  document.getElementById('community-eject-reason').value = '';
  document.getElementById('community-eject-modal').classList.add('open');
});

document.getElementById('community-eject-close')?.addEventListener('click', () => {
  hostModalTargetParticipantId = null;
  document.getElementById('community-eject-modal').classList.remove('open');
});

document.getElementById('community-eject-form')?.addEventListener('submit', async e => {
  e.preventDefault();
  const target = participants.get(hostModalTargetParticipantId);
  if (!target) return;
  const value = document.getElementById('community-eject-duration').value;
  await apiPost('/api/host_tools.php', {
    action: 'community_eject',
    session_id: cfg.sessionId,
    join_token: cfg.myJoinToken,
    target_participant_id: target.id,
    permanent: value === 'permanent',
    duration_minutes: value === 'permanent' ? null : Number(value),
    reason: document.getElementById('community-eject-reason').value,
  });
  hostModalTargetParticipantId = null;
  document.getElementById('community-eject-modal').classList.remove('open');
});

document.getElementById('host-notice-understand')?.addEventListener('click', e => {
  document.getElementById('host-notice-modal').classList.remove('open');
  if (e.currentTarget.dataset.redirect === '1') window.location.href = e.currentTarget.dataset.redirectUrl || appUrl('/lobby.php');
});

document.querySelectorAll('[data-game]').forEach(btn => {
  btn.addEventListener('click', async () => {
    closeGameStartMenu();
    const data = await apiPost('/api/games.php', { action: 'start', session_id: cfg.sessionId, participant_id: cfg.myParticipantId, join_token: cfg.myJoinToken, game_type: btn.dataset.game });
    await loadGames();
    openGame({ game_type: btn.dataset.game, lobby_code: data.lobby_code, started_by_name: 'You' });
  });
});

async function loadFriends() {
  const q = document.getElementById('friend-search')?.value || '';
  const loadingEl = document.getElementById('friend-loading');
  if (q.length === 0) {
    loadingEl.style.display = 'none';
    friendListEl.innerHTML = '';
    return;
  }
  loadingEl.style.display = 'flex';
  friendListEl.innerHTML = '';
  try {
    const data = await fetch(appUrl('/api/locate.php?q=' + encodeURIComponent(q))).then(r => r.json());
    if (document.getElementById('friend-search').value !== q) return;
    (data.friends || []).forEach(f => {
      const knownParticipant = [...participants.values()].find(p => Number(p.user_id) === Number(f.id));
      const locateAvatar = knownParticipant
        ? (knownParticipant.avatarEl?.currentSrc || knownParticipant.avatarEl?.src || avatarUrl(knownParticipant))
        : mediaUrl(f.avatar_url);
      const dmTarget = knownParticipant
        ? { ...f, avatar_url: locateAvatar, avatar_path: knownParticipant.avatar_path }
        : f;
      const row = document.createElement('div');
      row.className = 'person-row';
      const go = f.room_id
        ? (f.room_ejected
          ? `<button class="btn locate-action-btn" type="button" disabled aria-label="Room unavailable" title="Room unavailable"><img src="${esc(appUrl('/assets/images/lobby.png'))}" alt=""></button>`
          : `<a class="btn locate-action-btn" href="${esc(appUrl('/chatroom.php?id=' + encodeURIComponent(f.room_id)))}" aria-label="Go to room" title="Go"><img src="${esc(appUrl('/assets/images/lobby.png'))}" alt=""></a>`)
        : '<span class="minor locate-away">Away</span>';
      row.innerHTML = `<img src="${esc(locateAvatar)}" alt=""><div><strong>${esc(f.display_name)}</strong><div class="minor">${f.room_name ? esc(f.room_name) : 'Not in a room'}</div></div><button class="btn locate-action-btn dm-locate-btn" type="button" aria-label="Send DM" title="DM"><img src="${esc(appUrl('/assets/images/chat-pane-dm.png'))}" alt=""></button>${go}`;
      row.querySelector('.dm-locate-btn').addEventListener('click', () => {
        document.getElementById('locate-modal').classList.remove('open');
        openDmWithUser(dmTarget);
      });
      friendListEl.appendChild(row);
    });
  } finally {
    if (document.getElementById('friend-search').value === q) loadingEl.style.display = 'none';
  }
}

document.getElementById('locate-btn').addEventListener('click', async () => {
  document.getElementById('locate-modal').classList.add('open');
  document.getElementById('friend-search').value = '';
  document.getElementById('friend-loading').style.display = 'none';
  friendListEl.innerHTML = '';
  document.getElementById('friend-search').focus();
});

document.getElementById('locate-close').addEventListener('click', () => {
  document.getElementById('locate-modal').classList.remove('open');
});

function getSeenAppVersion() {
  try {
    if (globalThis.localStorage) return localStorage.getItem(APP_VERSION_CACHE_KEY) || '';
  } catch {}
  const match = document.cookie.match(new RegExp(`(?:^|; )${APP_VERSION_CACHE_KEY}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : memorySeenVersion;
}

function setSeenAppVersion(version) {
  memorySeenVersion = version;
  try {
    if (globalThis.localStorage) {
      localStorage.setItem(APP_VERSION_CACHE_KEY, version);
      return;
    }
  } catch {}
  document.cookie = `${APP_VERSION_CACHE_KEY}=${encodeURIComponent(version)}; path=/; max-age=31536000; SameSite=Lax`;
}

async function pollAppVersion() {
  try {
    const data = await fetch(appUrl('/api/version.php'), { cache: 'no-store' }).then(r => r.json());
    const version = String(data.version || '').trim();
    if (!version) return;
    latestAppVersion = version;
    if (appVersionEl) appVersionEl.textContent = version;
    const cachedVersion = getSeenAppVersion();
    if (!cachedVersion) {
      setSeenAppVersion(version);
      return;
    }
    if (cachedVersion !== version && versionBanner) {
      versionBannerText.textContent = `${version} is available.`;
      versionBanner.hidden = false;
    }
  } catch {
    if (appVersionEl && !latestAppVersion) appVersionEl.textContent = 'Version unavailable';
  }
}

versionRefreshBtn?.addEventListener('click', () => {
  if (latestAppVersion) setSeenAppVersion(latestAppVersion);
  const url = new URL(window.location.href);
  url.searchParams.set('refresh', Date.now().toString());
  window.location.replace(url.toString());
});

document.getElementById('friend-search').addEventListener('input', () => {
  clearTimeout(window.friendSearchTimer);
  window.friendSearchTimer = setTimeout(loadFriends, 120);
});

function updateVoiceToggleButton() {
  const btn = document.getElementById('voice-toggle');
  if (!btn) return;
  btn.textContent = voiceJoined ? 'Leave Voice' : 'Join Voice';
  btn.classList.toggle('active', voiceJoined);
}

function restartVoicePoll(delay = 0) {
  clearTimeout(voicePollTimer);
  voicePollTimer = setTimeout(pollVoice, delay);
}

function setRemoteAudioDeafened() {
  document.querySelectorAll('audio[id^="voice-audio-"]').forEach(audio => {
    audio.muted = voiceDeafened;
  });
}

function syncVoiceStatus(force = false) {
  if (!voiceJoined) return Promise.resolve();
  const signature = `${voiceMuted ? 1 : 0}:${voiceDeafened ? 1 : 0}:${voiceSpeaking ? 1 : 0}`;
  if (!force && signature === lastVoiceStatusSignature) return Promise.resolve();
  lastVoiceStatusSignature = signature;
  return apiPost('/api/voice_signal.php', {
    action: 'status',
    session_id: cfg.sessionId,
    participant_id: cfg.myParticipantId,
    join_token: cfg.myJoinToken,
    muted: voiceMuted,
    deafened: voiceDeafened,
    speaking: voiceSpeaking,
  }).catch(() => {});
}

function renderCurrentVoiceList() {
  renderVoiceList(latestVoiceParticipants);
}

function setVoiceMuted(muted) {
  voiceMuted = Boolean(muted);
  if (voiceStream) voiceStream.getAudioTracks().forEach(track => { track.enabled = !voiceMuted; });
  if (voiceMuted && voiceSpeaking) voiceSpeaking = false;
  renderCurrentVoiceList();
  syncVoiceStatus(true);
}

function setVoiceDeafened(deafened) {
  voiceDeafened = Boolean(deafened);
  setRemoteAudioDeafened();
  renderCurrentVoiceList();
  syncVoiceStatus(true);
}

function stopVoiceAnalyser() {
  clearInterval(voiceAnalyserTimer);
  voiceAnalyserTimer = null;
  try { voiceMicSource?.disconnect(); } catch {}
  voiceMicSource = null;
  voiceAnalyser = null;
  if (voiceAudioContext) {
    voiceAudioContext.close().catch(() => {});
    voiceAudioContext = null;
  }
}

function startVoiceAnalyser() {
  stopVoiceAnalyser();
  if (!voiceStream) return;
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    voiceAudioContext = new AudioContextClass();
    voiceAnalyser = voiceAudioContext.createAnalyser();
    voiceAnalyser.fftSize = 512;
    voiceMicSource = voiceAudioContext.createMediaStreamSource(voiceStream);
    voiceMicSource.connect(voiceAnalyser);
    const samples = new Uint8Array(voiceAnalyser.fftSize);
    voiceAnalyserTimer = setInterval(() => {
      if (!voiceAnalyser) return;
      voiceAnalyser.getByteTimeDomainData(samples);
      let sum = 0;
      for (let i = 0; i < samples.length; i++) {
        const v = (samples[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / samples.length);
      const speaking = Boolean(!voiceMuted && rms > 0.045);
      if (speaking !== voiceSpeaking) {
        voiceSpeaking = speaking;
        renderCurrentVoiceList();
        syncVoiceStatus();
      }
    }, 140);
  } catch {}
}

document.getElementById('voice-toggle').addEventListener('click', async () => {
  if (voiceJoined) await leaveVoice();
  else await joinVoice();
});

async function joinVoice() {
  if (voiceJoined) return;
  try {
    voiceStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    voiceMuted = false;
    voiceDeafened = false;
    voiceSpeaking = false;
    voiceJoined = true;
    updateVoiceToggleButton();
    await apiPost('/api/voice_signal.php', { action: 'join', session_id: cfg.sessionId, participant_id: cfg.myParticipantId, join_token: cfg.myJoinToken });
    await syncVoiceStatus(true);
    startVoiceAnalyser();
    restartVoicePoll(0);
  } catch (err) {
    voiceJoined = false;
    updateVoiceToggleButton();
    if (voiceStream) voiceStream.getTracks().forEach(t => t.stop());
    voiceStream = null;
    alert(err.message || 'Could not join voice chat.');
  }
}

async function leaveVoice() {
  if (!voiceJoined) return;
  voiceJoined = false;
  voiceMuted = false;
  voiceDeafened = false;
  voiceSpeaking = false;
  lastVoiceStatusSignature = '';
  stopVoiceAnalyser();
  updateVoiceToggleButton();
  for (const pc of peers.values()) pc.close();
  peers.clear();
  document.querySelectorAll('audio[id^="voice-audio-"]').forEach(audio => audio.remove());
  if (voiceStream) voiceStream.getTracks().forEach(t => t.stop());
  voiceStream = null;
  await apiPost('/api/voice_signal.php', { action: 'leave', session_id: cfg.sessionId, participant_id: cfg.myParticipantId, join_token: cfg.myJoinToken }).catch(() => {});
  latestVoiceParticipants = latestVoiceParticipants.filter(v => Number(v.id) !== Number(cfg.myParticipantId));
  renderVoiceList(latestVoiceParticipants);
  restartVoicePoll(0);
}

async function getPeer(id, polite = false) {
  if (peers.has(id)) return peers.get(id);
  const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
  peers.set(id, pc);
  if (voiceStream) voiceStream.getTracks().forEach(track => pc.addTrack(track, voiceStream));
  pc.ontrack = e => {
    let audio = document.getElementById(`voice-audio-${id}`);
    if (!audio) {
      audio = document.createElement('audio');
      audio.id = `voice-audio-${id}`;
      audio.autoplay = true;
      document.body.appendChild(audio);
    }
    audio.muted = voiceDeafened;
    audio.srcObject = e.streams[0];
  };
  pc.onicecandidate = e => {
    if (e.candidate) sendSignal(id, 'ice', e.candidate);
  };
  pc.onnegotiationneeded = async () => {
    if (polite) return;
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await sendSignal(id, 'offer', pc.localDescription);
  };
  return pc;
}

function sendSignal(toId, type, data) {
  return apiPost('/api/voice_signal.php', { action: 'signal', session_id: cfg.sessionId, from_id: cfg.myParticipantId, to_id: toId, join_token: cfg.myJoinToken, type, data });
}

async function pollVoice() {
  try {
    const qs = new URLSearchParams({ session_id: cfg.sessionId, participant_id: cfg.myParticipantId, after: lastVoiceSignalId, join_token: cfg.myJoinToken });
    const data = await fetch(appUrl('/api/voice_signal.php?' + qs)).then(r => r.json());
    renderVoiceList(data.voice_participants || []);
    for (const sig of data.signals || []) {
      lastVoiceSignalId = Math.max(lastVoiceSignalId, sig.id);
      if (!voiceJoined) continue;
      const from = sig.from_participant_id;
      if (!from || from === cfg.myParticipantId) continue;
      const pc = await getPeer(from, sig.type === 'offer');
      if (sig.type === 'join') {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await sendSignal(from, 'offer', pc.localDescription);
      }
      if (sig.type === 'offer') {
        await pc.setRemoteDescription(sig.data);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await sendSignal(from, 'answer', pc.localDescription);
      }
      if (sig.type === 'answer') await pc.setRemoteDescription(sig.data);
      if (sig.type === 'ice') await pc.addIceCandidate(sig.data).catch(() => {});
      if (sig.type === 'leave' && peers.has(from)) {
        peers.get(from).close();
        peers.delete(from);
      }
    }
  } catch (err) {
    console.warn(err);
  }
  restartVoicePoll(voiceJoined ? 1000 : 2000);
}

function renderVoiceList(list) {
  latestVoiceParticipants = Array.isArray(list) ? list : [];
  if (voiceSideSection) voiceSideSection.classList.toggle('has-voice', latestVoiceParticipants.length > 0);
  if (voiceTitleEl) voiceTitleEl.hidden = latestVoiceParticipants.length === 0;
  if (voiceListEl) voiceListEl.hidden = latestVoiceParticipants.length === 0;
  if (voiceCountLabel) voiceCountLabel.textContent = latestVoiceParticipants.length ? `(${latestVoiceParticipants.length})` : '';
  voiceListEl.innerHTML = '';
  latestVoiceParticipants.forEach(v => {
    const known = participants.get(Number(v.id));
    const person = Object.assign({}, known || {}, v);
    const own = Number(person.id) === Number(cfg.myParticipantId);
    const muted = own ? voiceMuted : Boolean(person.muted);
    const deafened = own ? voiceDeafened : Boolean(person.deafened);
    const speaking = own ? voiceSpeaking : Boolean(person.speaking);
    const row = document.createElement('div');
    row.className = `voice-card person-row ${participantRoleClass(person)}${speaking ? ' speaking' : ''}`;
    row.dataset.participantId = person.id;
    const statusText = speaking ? 'Speaking' : 'In voice';
    const controls = own
      ? `<button class="voice-control${muted ? ' active' : ''}" data-voice-mute type="button" title="${muted ? 'Unmute mic' : 'Mute mic'}" aria-label="${muted ? 'Unmute mic' : 'Mute mic'}"><span class="voice-icon voice-icon-mic"></span></button>
         <button class="voice-control${deafened ? ' active' : ''}" data-voice-deafen type="button" title="${deafened ? 'Undeafen' : 'Deafen'}" aria-label="${deafened ? 'Undeafen' : 'Deafen'}"><span class="voice-icon voice-icon-volume"></span></button>`
      : `${muted ? '<span class="voice-status-icon active" title="Mic muted"><span class="voice-icon voice-icon-mic"></span></span>' : ''}
         ${deafened ? '<span class="voice-status-icon active" title="Deafened"><span class="voice-icon voice-icon-volume"></span></span>' : ''}`;
    row.innerHTML = `<span class="user-avatar-wrap"><img src="${esc(avatarUrl(person))}" alt=""><span class="voice-speaking-dot${speaking ? ' speaking' : ''}"></span></span><div><strong class="person-name-line"><span>${esc(displayNameFor(person))}</span></strong><div class="minor">${own ? 'You' : statusText}</div></div><div class="voice-card-actions">${controls}</div>`;
    row.querySelector('[data-voice-mute]')?.addEventListener('click', () => setVoiceMuted(!voiceMuted));
    row.querySelector('[data-voice-deafen]')?.addEventListener('click', () => setVoiceDeafened(!voiceDeafened));
    voiceListEl.appendChild(row);
  });
}

async function bootRoom() {
  const roomId = document.body.dataset.roomId;
  cfg = await fetch(appUrl(`/api/room_config.php?id=${encodeURIComponent(roomId)}`)).then(r => r.json());
  if (cfg.error) throw new Error(cfg.error);
  lastEventId = cfg.lastEventId || 0;
  lastCommunityEventId = cfg.lastCommunityEventId || 0;
  restoreSessionLock();
  (cfg.blockedUserIds || []).forEach(id => blockedUserIds.add(Number(id)));
  Object.entries(cfg.linkIcons || {}).forEach(([key, icon]) => linkIcons.set(key, icon || 'plus'));
  await Promise.all((cfg.participants || []).map(p => renderParticipantWhenReady(p, { animateJoin: true }).catch(() => {
    renderParticipant(p, { animateJoin: true });
  })));
  (cfg.dmUsers || []).forEach(rememberDmUser);
  (cfg.messages || []).forEach(msg => addMessageToChannel(msg, 'room', false));
  (cfg.communityMessages || []).forEach(msg => addMessageToChannel(msg, 'community', false));
  (cfg.linkMessages || []).forEach(msg => {
    const partnerId = msg.participant_id === cfg.myParticipantId ? linkedPartner()?.id : msg.participant_id;
    if (partnerId) addMessageToChannel(msg, `link:${partnerId}`, false);
  });
  (cfg.dmMessages || []).forEach(msg => {
    if (msg.partner_user_id) addMessageToChannel(msg, `dm:${msg.partner_user_id}`, false);
  });
  renderLinkTabs();
  renderActiveChat();
  setPermissionUI();
  renderRoomEffectsModal();
  if (cfg.activeRoomEffect?.active) {
    await applyRoomEffect(cfg.activeRoomEffect, false);
    addSystemMessage(`${cfg.activeRoomEffect.label || 'Room effect'} is currently active.`);
  }
  updateComposerState();
  updateVoiceToggleButton();
  checkLatency();
  poll();
  pollVoice();
  pollAppVersion();
  setInterval(checkLatency, 5000);
  setInterval(pollAppVersion, 60000);
  setInterval(updateVisibleTimestamps, 30000);
  refreshPresence();
  loadGames();
}

window.addEventListener('resize', () => {
  participants.forEach(positionAvatar);
  participants.forEach(p => {
    if (!p.linked_to) return;
    const target = participants.get(p.linked_to);
    if (target) snapLinkedPair(p, target, false);
  });
});
bootRoom().catch(err => {
  console.error(err);
  messagesEl.innerHTML = `<div class="error">${esc(err.message || 'Room failed to load.')}</div>`;
});
