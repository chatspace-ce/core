module.exports = {
    name: "Fire",
    render: function(container) {
        // Runs very fast (every 40ms) to create a dense, overlapping flame effect
        const interval = setInterval(() => {
            const flame = document.createElement('div');
            flame.style.position = 'absolute';
            flame.style.pointerEvents = 'none';

            // Fire particle shapes
            const size = Math.random() * 25 + 15; // 15px to 40px
            flame.style.width = size + 'px';
            flame.style.height = size + 'px';
            flame.style.borderRadius = '50%';
            flame.style.filter = 'blur(8px)';

            // This is the magic CSS property that makes overlapping colors turn bright/white like a real fire core
            flame.style.mixBlendMode = 'screen';

            // Randomize flame colors (mostly orange, some yellow, some red)
            const r = Math.random();
            if (r < 0.25) flame.style.background = 'rgba(255, 200, 0, 0.8)';      // Yellow core
            else if (r > 0.8) flame.style.background = 'rgba(255, 50, 0, 0.6)';   // Red edges
            else flame.style.background = 'rgba(255, 120, 0, 0.8)';               // Orange body

            // Start tightly clustered at the very bottom center of the avatar container
            const startX = 50 + (Math.random() * 50 - 25);
            flame.style.left = startX + '%';
            flame.style.top = '95%';

            container.appendChild(flame);

            // Flames rise straight up quickly with very slight left/right flicker
            const flickerX = (Math.random() * 20 - 10) + 'px';
            const riseY = -(Math.random() * 80 + 80) + 'px'; // Rises between 80px and 160px

            const anim = flame.animate([
                { transform: 'translate(0, 0) scale(1)', opacity: 1 },
                { transform: `translate(${flickerX}, ${riseY}) scale(0.2)`, opacity: 0 }
            ], {
                duration: 500 + Math.random() * 400, // Very fast animation (0.5s - 0.9s)
                easing: 'ease-in'
            });

            anim.onfinish = () => flame.remove();

        }, 40);

        return interval;
    }
};