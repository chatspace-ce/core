'use strict';

const registerForm = document.querySelector('form.form-grid');
const registerAvatarInput = registerForm?.querySelector('input[name="avatar"]');

function showRegisterAvatarError(message) {
  let box = document.querySelector('.error');
  if (!box) {
    box = document.createElement('div');
    box.className = 'error';
    registerForm?.before(box);
  }
  box.textContent = message;
}

registerForm?.addEventListener('submit', async event => {
  const file = registerAvatarInput?.files?.[0];
  if (!file || !window.ChatSpaceAvatar) return;
  event.preventDefault();
  const submit = registerForm.querySelector('button[type="submit"]');
  const originalText = submit?.textContent || '';
  if (submit) {
    submit.disabled = true;
    submit.textContent = 'Optimizing...';
  }
  try {
    const prepared = await window.ChatSpaceAvatar.prepareAvatarFile(file);
    window.ChatSpaceAvatar.replaceInputFile(registerAvatarInput, prepared);
    HTMLFormElement.prototype.submit.call(registerForm);
  } catch (err) {
    showRegisterAvatarError(err.message || 'Could not prepare avatar.');
    if (submit) {
      submit.disabled = false;
      submit.textContent = originalText;
    }
  }
});
