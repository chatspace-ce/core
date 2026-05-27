'use strict';

const dbRadios = document.querySelectorAll('.setup-db-radio');
const mysqlFields = document.getElementById('setup-mysql-fields');

function updateSetupDbChoice() {
  const selected = document.querySelector('.setup-db-radio:checked')?.value || 'sqlite';
  if (mysqlFields) mysqlFields.hidden = selected !== 'mysql';
  document.querySelectorAll('.setup-choice-card').forEach(card => {
    const input = card.closest('.setup-choice')?.querySelector('.setup-db-radio');
    card.classList.toggle('active', input?.checked);
  });
}

dbRadios.forEach(radio => radio.addEventListener('change', updateSetupDbChoice));
updateSetupDbChoice();

const setupAvatar = document.getElementById('setup-avatar');
const setupAvatarName = document.getElementById('setup-avatar-name');
setupAvatar?.addEventListener('change', () => {
  const file = setupAvatar.files && setupAvatar.files[0];
  if (setupAvatarName) setupAvatarName.textContent = file ? file.name : 'No file selected';
});

const setupCommunityLogo = document.getElementById('setup-community-logo');
const setupCommunityLogoName = document.getElementById('setup-community-logo-name');
setupCommunityLogo?.addEventListener('change', () => {
  const file = setupCommunityLogo.files && setupCommunityLogo.files[0];
  if (setupCommunityLogoName) setupCommunityLogoName.textContent = file ? file.name : 'No file selected';
});

const setupAdminForm = setupAvatar?.closest('form');
setupAdminForm?.addEventListener('submit', async event => {
  const file = setupAvatar?.files?.[0];
  if (!file || !window.ChatSpaceAvatar) return;
  event.preventDefault();
  const submit = setupAdminForm.querySelector('button[type="submit"]');
  const originalText = submit?.textContent || '';
  if (submit) {
    submit.disabled = true;
    submit.textContent = 'Optimizing...';
  }
  try {
    const prepared = await window.ChatSpaceAvatar.prepareAvatarFile(file);
    window.ChatSpaceAvatar.replaceInputFile(setupAvatar, prepared);
    if (setupAvatarName) setupAvatarName.textContent = prepared.name;
    HTMLFormElement.prototype.submit.call(setupAdminForm);
  } catch (err) {
    let box = document.querySelector('.setup-alert-error');
    if (!box) {
      box = document.createElement('div');
      box.className = 'setup-alert setup-alert-error';
      document.querySelector('.setup-steps')?.after(box);
    }
    box.textContent = err.message || 'Could not prepare avatar.';
    if (submit) {
      submit.disabled = false;
      submit.textContent = originalText;
    }
  }
});
