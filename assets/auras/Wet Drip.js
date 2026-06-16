module.exports = {
    name: "Wet Drip",
    render: function(container) {
        // Generates a falling water drop every 200ms
        const interval = setInterval(() => {
            const drop = document.createElement('div');
            drop.style.position = 'absolute';
            drop.style.width = '4px';
            drop.style.height = '12px';
            drop.style.background = 'linear-gradient(to bottom, rgba(6, 182, 212, 0.2), rgba(6, 182, 212, 0.8))';
            drop.style.borderRadius = '50%';

            // Randomly position horizontally across the avatar
            drop.style.left = (Math.random() * 80 + 10) + '%';
            // Start at the bottom half of the avatar
            drop.style.top = '70%';

            container.appendChild(drop);

            // Animate it falling down and fading out
            const anim = drop.animate([
                { transform: 'translateY(0) scaleY(1)', opacity: 0.8 },
                { transform: 'translateY(60px) scaleY(1.5)', opacity: 0 }
            ], {
                duration: 600 + (Math.random() * 300),
                easing: 'ease-in'
            });

            anim.onfinish = () => drop.remove();

        }, 200);

        return interval;
    }
};