module.exports = {
    name: "Void Vortex",
    render: function(container) {
        const interval = setInterval(() => {
            const spark = document.createElement('div');
            spark.style.position = 'absolute';
            spark.style.pointerEvents = 'none';

            // Pin to absolute center for rotational math
            spark.style.left = '50%';
            spark.style.top = '50%';
            spark.style.transformOrigin = 'center center';

            // Randomize cosmic colors
            const colors = ['#8a2be2', '#9370db', '#4b0082', '#ff00ff', '#00d2ff'];
            const color = colors[Math.floor(Math.random() * colors.length)];

            const size = Math.random() * 6 + 2;
            spark.style.width = size + 'px';
            spark.style.height = size + 'px';
            spark.style.borderRadius = '50%';
            spark.style.background = color;
            spark.style.boxShadow = `0 0 10px ${color}, 0 0 20px ${color}`;
            spark.style.mixBlendMode = 'screen';

            container.appendChild(spark);

            // Calculate a random starting angle and a wide radius outside the avatar
            const angle = Math.random() * 360;
            const radius = 120 + Math.random() * 60;

            // Orbital Suction Animation using CSS Transforms
            const anim = spark.animate([
                // Start far out, fully transparent
                { transform: `translate(-50%, -50%) rotate(${angle}deg) translateX(${radius}px) scale(0)`, opacity: 0 },
                // Fade in and get larger as it gets pulled halfway in
                { transform: `translate(-50%, -50%) rotate(${angle + 90}deg) translateX(${radius * 0.5}px) scale(1.5)`, opacity: 1, offset: 0.4 },
                // Get sucked into the singularity (center) and vanish
                { transform: `translate(-50%, -50%) rotate(${angle + 180}deg) translateX(0px) scale(0.1)`, opacity: 0 }
            ], {
                duration: 900 + Math.random() * 600,
                easing: 'cubic-bezier(0.5, 0, 0.2, 1)' // Starts slow, accelerates rapidly inward
            });

            anim.onfinish = () => spark.remove();
        }, 30); // Very dense particle generation

        return interval;
    }
};