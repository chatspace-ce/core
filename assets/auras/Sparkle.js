module.exports = {
    name: "Sparkle",
    render: function(container) {
        // Generates a sparkling star every 150ms
        const interval = setInterval(() => {
            const star = document.createElement('div');
            star.textContent = '✨';
            star.style.position = 'absolute';
            star.style.fontSize = (Math.random() * 10 + 10) + 'px'; // Random size
            star.style.left = (Math.random() * 100) + '%';
            star.style.top = (Math.random() * 100) + '%';
            star.style.filter = 'drop-shadow(0 0 5px #fff)';
            star.style.pointerEvents = 'none';

            container.appendChild(star);

            // Using the Web Animations API for smooth, CSS-free animation
            const anim = star.animate([
                { transform: 'scale(0) rotate(0deg)', opacity: 0 },
                { transform: 'scale(1.2) rotate(45deg)', opacity: 1, offset: 0.5 },
                { transform: 'scale(0) rotate(90deg)', opacity: 0 }
            ], {
                duration: 1000 + (Math.random() * 500),
                easing: 'ease-in-out'
            });

            // Remove the element from the DOM when the animation finishes
            anim.onfinish = () => star.remove();

        }, 150);

        return interval; // We return the interval so ChatSpace can clear it if they change auras
    }
};