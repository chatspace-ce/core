module.exports = {
    name: "Explosions",
    render: function(container) {
        const interval = setInterval(() => {
            // Create a burst of 4 to 7 particles all at once
            const burstCount = Math.floor(Math.random() * 4) + 4;

            // Pick a random center point on the avatar for this specific explosion
            const originX = 50 + (Math.random() * 40 - 20);
            const originY = 50 + (Math.random() * 40 - 20);

            for (let i = 0; i < burstCount; i++) {
                const particle = document.createElement('div');
                const isFire = Math.random() > 0.5;
                particle.textContent = isFire ? '🔥' : '💥';
                particle.style.position = 'absolute';
                particle.style.fontSize = (Math.random() * 15 + 10) + 'px';
                particle.style.left = originX + '%';
                particle.style.top = originY + '%';
                particle.style.pointerEvents = 'none';

                container.appendChild(particle);

                // Calculate random outward trajectory using trigonometry
                const angle = Math.random() * Math.PI * 2;
                const distance = Math.random() * 60 + 40; // How far the explosion shoots
                const destX = Math.cos(angle) * distance;
                const destY = Math.sin(angle) * distance;

                const anim = particle.animate([
                    { transform: 'translate(0px, 0px) scale(0.5)', opacity: 1 },
                    { transform: `translate(${destX}px, ${destY}px) scale(1.5)`, opacity: 0 }
                ], {
                    duration: 500 + Math.random() * 300,
                    // This specific bezier curve makes it start fast and slow down (like an explosion)
                    easing: 'cubic-bezier(0.15, 0.9, 0.3, 1)'
                });

                anim.onfinish = () => particle.remove();
            }
        }, 800); // Erupts a new explosion cluster every 800ms

        return interval;
    }
};