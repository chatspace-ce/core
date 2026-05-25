'use strict';

(function initAvatarProcessing() {
  const MAX_AVATAR_SIZE = 250;
  const MIN_AVATAR_SIZE = 42;

  function isGif(file) {
    return file?.type === 'image/gif' || /\.gif$/i.test(file?.name || '');
  }

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Could not read avatar image.'));
      };
      img.src = url;
    });
  }

  function scaledSize(width, height) {
    const scale = Math.min(1, MAX_AVATAR_SIZE / Math.max(width, height));
    return {
      width: Math.max(1, Math.round(width * scale)),
      height: Math.max(1, Math.round(height * scale)),
    };
  }

  function canvasToBlob(canvas, type, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error('Could not optimize avatar image.'));
      }, type, quality);
    });
  }

  function webpName(name) {
    const base = String(name || 'avatar').replace(/\.[^.]+$/, '') || 'avatar';
    return `${base}.webp`;
  }

  async function prepareAvatarFile(file) {
    if (!file) return null;
    const img = await loadImage(file);
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    if (width < MIN_AVATAR_SIZE || height < MIN_AVATAR_SIZE) {
      throw new Error(`Avatar images must be at least ${MIN_AVATAR_SIZE}x${MIN_AVATAR_SIZE}.`);
    }
    const size = scaledSize(width, height);

    if (isGif(file)) {
      if (size.width !== width || size.height !== height) {
        throw new Error('Animated GIF avatars must be 250x250 or smaller so the animation stays intact.');
      }
      return file;
    }

    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext('2d', { alpha: true });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.clearRect(0, 0, size.width, size.height);
    ctx.drawImage(img, 0, 0, size.width, size.height);
    const blob = await canvasToBlob(canvas, 'image/webp', 0.88);
    return new File([blob], webpName(file.name), { type: 'image/webp', lastModified: Date.now() });
  }

  function replaceInputFile(input, file) {
    if (!input || !file) return;
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
  }

  window.ChatSpaceAvatar = {
    maxSize: MAX_AVATAR_SIZE,
    minSize: MIN_AVATAR_SIZE,
    prepareAvatarFile,
    replaceInputFile,
  };
})();
