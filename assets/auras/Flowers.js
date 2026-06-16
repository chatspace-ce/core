module.exports = {
    name: "Spring Bloom",
    render: function(container) {
        let tickCount = 0;

        const interval = setInterval(() => {
            tickCount++;

            // --- 1. FALLING SAKURA PETALS ---
            const petal = document.createElement('div');
            petal.style.position = 'absolute';
            petal.style.pointerEvents = 'none';
            petal.style.zIndex = '110';

            // THE CSS PETAL TRICK: Using asymmetrical border-radius to shape a square into a petal
            const size = Math.random() * 6 + 6; // 6px to 12px
            petal.style.width = size + 'px';
            petal.style.height = size + 'px';
            petal.style.borderRadius = '15px 0px 15px 0px'; // Creates the teardrop/petal shape

            const colors = ['#ffb7c5', '#ff9eaa', '#ffc1cc', '#ffffff'];
            petal.style.background = colors[Math.floor(Math.random() * colors.length)];
            petal.style.boxShadow = '0 2px 5px rgba(255, 105, 180, 0.3)';

            // Spawn anywhere across the top
            petal.style.left = (Math.random() * 140 - 20) + '%';
            petal.style.top = '-20%';
            container.appendChild(petal);

            // Swaying falling animation
            const endY = 250 + Math.random() * 50;
            const swayX = (Math.random() * 100 - 50); // Drifts left or right
            const rotations = Math.random() * 720; // Spins as it falls

            const petalAnim = petal.animate([
                { transform: 'translate(0px, 0px) rotate(0deg) scale(0)', opacity: 0 },
                { transform: `translate(${swayX * 0.3}px, ${endY * 0.3}px) rotate(${rotations * 0.3}deg) scale(1)`, opacity: 1, offset: 0.2 },
                { transform: `translate(${swayX}px, ${endY}px) rotate(${rotations}deg) scale(0.8)`, opacity: 0 }
            ], {
                duration: 3000 + Math.random() * 2000,
                easing: 'ease-in-out'
            });
            petalAnim.onfinish = () => petal.remove();

            // --- 2. OCCASIONAL BLOOMING FLOWERS ---
            if (tickCount % 25 === 0) {
                const flower = document.createElement('div');
                flower.style.position = 'absolute';
                flower.style.pointerEvents = 'none';
                flower.style.zIndex = '95'; // Behind avatar

                const flowers = ['🌸', '🌺', '🌼', '💮'];
                flower.innerText = flowers[Math.floor(Math.random() * flowers.length)];
                flower.style.fontSize = (Math.random() * 15 + 15) + 'px';
                flower.style.filter = 'drop-shadow(0 0 10px rgba(255, 255, 255, 0.8))';

                flower.style.left = (Math.random() * 100) + '%';
                flower.style.top = (Math.random() * 80 + 10) + '%';
                container.appendChild(flower);

                // Blooms from size 0, rotates slightly, then shrinks away
                const rot = (Math.random() * 60 - 30) + 'deg';
                const flowerAnim = flower.animate([
                    { transform: 'scale(0) rotate(0deg)', opacity: 0 },
                    { transform: `scale(1.2) rotate(${rot})`, opacity: 1, offset: 0.2 },
                    { transform: `scale(1) rotate(${rot})`, opacity: 0.9, offset: 0.8 },
                    { transform: `scale(0) rotate(0deg)`, opacity: 0 }
                ], { duration: 4000 });
                flowerAnim.onfinish = () => flower.remove();
            }

        }, 50);

        return interval;
    }
};