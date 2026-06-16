module.exports = {
    name: "Love Hearts",
    render: function(container) {
        // Array of different heart emojis for variety
        const hearts = ['❤️', '💖', '💕', '💗', '💓'];

        const interval = setInterval(() => {
            const heart = document.createElement('div');
            // Pick a random heart
            heart.textContent = hearts[Math.floor(Math.random() * hearts.length)];
            heart.style.position = 'absolute';
            heart.style.fontSize = (Math.random() * 15 + 15) + 'px'; // Random size
            heart.style.left = (Math.random() * 80 + 10) + '%'; // Spread horizontally
            heart.style.top = '80%'; // Start near the bottom of the avatar
            heart.style.pointerEvents = 'none';
            heart.style.textShadow = '0 0 10px rgba(255, 0, 100, 0.5)'; // Soft pink glow

            container.appendChild(heart);

            // Float upwards and fade out
            const anim = heart.animate([
                { transform: 'translateY(0) scale(0.5)', opacity: 0 },
                { transform: 'translateY(-40px) scale(1.2)', opacity: 1, offset: 0.3 },
                { transform: 'translateY(-100px) scale(1)', opacity: 0 }
            ], {
                duration: 1500 + (Math.random() * 1000), // Random lifespan
                easing: 'ease-out'
            });

            anim.onfinish = () => heart.remove();
        }, 300); // Spawns a new heart every 300ms

        return interval;
    }
};