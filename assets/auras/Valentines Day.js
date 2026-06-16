module.exports = {
    name: "Valentine",
    render: function(container) {
        // Soft romantic backlight
        const glow = document.createElement('div');
        glow.style.position = 'absolute';
        glow.style.inset = '-20px'; // Bleeds out
        glow.style.background = 'radial-gradient(circle at center, rgba(255, 105, 180, 0.4) 0%, transparent 70%)';
        glow.style.pointerEvents = 'none';
        glow.style.zIndex = '90'; // Behind avatar
        glow.style.mixBlendMode = 'screen';
        container.appendChild(glow);

        // Pulse the backlight
        glow.animate([
            { transform: 'scale(0.9)', opacity: 0.5 },
            { transform: 'scale(1.1)', opacity: 1 },
            { transform: 'scale(0.9)', opacity: 0.5 }
        ], { duration: 3000, iterations: Infinity, easing: 'ease-in-out' });

        const hearts = ['❤️', '💖', '💕', '💘', '🤍'];

        const interval = setInterval(() => {
            const heart = document.createElement('div');
            heart.style.position = 'absolute';
            heart.style.pointerEvents = 'none';
            heart.style.zIndex = '110';
            heart.innerText = hearts[Math.floor(Math.random() * hearts.length)];

            // Random size and depth-of-field blur
            const size = Math.random() * 20 + 10;
            heart.style.fontSize = size + 'px';
            heart.style.filter = `drop-shadow(0 0 5px rgba(255,20,147,0.8)) ${Math.random() > 0.8 ? 'blur(3px)' : ''}`; // 20% chance to be "out of focus"

            // Spawn at the bottom, random horizontal
            const startX = (Math.random() * 120) - 10;
            heart.style.left = startX + '%';
            heart.style.top = '100%';

            container.appendChild(heart);

            // Float upwards while swaying left and right
            const sway = (Math.random() * 40 - 20) + 'px';
            const rotate = (Math.random() * 60 - 30) + 'deg';

            const anim = heart.animate([
                { transform: 'translate(0, 0) scale(0) rotate(0deg)', opacity: 0 },
                { transform: `translate(${sway}, -80px) scale(1.2) rotate(${rotate})`, opacity: 0.9, offset: 0.3 },
                { transform: `translate(0px, -150px) scale(1) rotate(0deg)`, opacity: 0.8, offset: 0.7 },
                { transform: `translate(${-sway}, -250px) scale(0.5) rotate(${-rotate})`, opacity: 0 }
            ], {
                duration: 3000 + Math.random() * 2000,
                easing: 'ease-in-out'
            });

            anim.onfinish = () => heart.remove();
        }, 150);

        return interval;
    }
};