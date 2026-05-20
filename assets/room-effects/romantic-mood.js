// @effect-key romantic_mood
// @effect-label Romantic Mood
// @effect-description Pink stage glow, soft tint, and floating hearts.
(function registerRomanticMood() {
  window.ChatSpaceRoomEffects = window.ChatSpaceRoomEffects || {};

  window.ChatSpaceRoomEffects.romantic_mood = {
    mount(context) {
      const stage = context.roomStage;
      if (!stage) return null;

      stage.classList.add('effect-romantic-mood');

      const layer = document.createElement('div');
      layer.className = 'room-effect-layer romantic-mood-layer';
      layer.setAttribute('aria-hidden', 'true');

      const heartCount = 22;
      for (let i = 0; i < heartCount; i += 1) {
        const heart = document.createElement('span');
        heart.className = 'romantic-heart';
        heart.textContent = '♥';
        heart.style.left = `${Math.random() * 96}%`;
        heart.style.setProperty('--heart-size', `${16 + Math.random() * 18}px`);
        heart.style.setProperty('--heart-drift', `${Math.round((Math.random() * 80) - 40)}px`);
        heart.style.setProperty('--heart-duration', `${6.5 + Math.random() * 5}s`);
        heart.style.animationDelay = `${Math.random() * -10}s`;
        layer.appendChild(heart);
      }

      stage.appendChild(layer);

      return {
        destroy() {
          layer.remove();
          stage.classList.remove('effect-romantic-mood');
        },
      };
    },
  };
}());
