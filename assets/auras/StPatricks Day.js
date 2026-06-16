module.exports = {
    name: "St Patricks",
    render: function(container) {
        // Glowing green base (The Pot / Meadow)
        const base = document.createElement('div');
        base.style.position = 'absolute';
        base.style.bottom = '-10px';
        base.style.left = '0';
        base.style.width = '100%';
        base.style.height = '40px';
        base.style.background = 'radial-gradient(ellipse at center, rgba(0, 255, 0, 0.4) 0%, transparent 70%)';
        base.style.filter = 'blur(10px)';
        base.style.pointerEvents = 'none';
        container.appendChild(base);

        let tickCount = 0;

        const interval = setInterval(() => {
            tickCount++;

            // --- 1. FALLING CLOVERS ---
            if (tickCount % 3 === 0) {
                const clover = document.createElement('div');
                clover.style.position = 'absolute';
                clover.style.pointerEvents = 'none';
                clover.innerText = Math.random() > 0.5 ? '🍀' : '☘️';
                clover.style.fontSize = (Math.random() * 15 + 10) + 'px';
                clover.style.filter = 'drop-shadow(0 0 5px #00ff00)';
                clover.style.left = (Math.random() * 120 - 10) + '%';
                clover.style.top = '-20%';
                clover.style.zIndex = '110';
                container.appendChild(clover);

                const rot = (Math.random() * 360 - 180) + 'deg';
                const cloverAnim = clover.animate([
                    { transform: 'translateY(0) rotate(0deg)', opacity: 0 },
                    { transform: 'translateY(50px) rotate(45deg)', opacity: 1, offset: 0.2 },
                    { transform: `translateY(280px) rotate(${rot})`, opacity: 0 }
                ], { duration: 2000 + Math.random() * 1500, easing: 'linear' });

                cloverAnim.onfinish = () => clover.remove();
            }

            // --- 2. RISING GOLD DUST / COINS ---
            const gold = document.createElement('div');
            gold.style.position = 'absolute';
            gold.style.pointerEvents = 'none';
            gold.style.width = (Math.random() * 4 + 2) + 'px';
            gold.style.height = gold.style.width;
            gold.style.borderRadius = '50%';
            gold.style.background = '#FFDF00';
            gold.style.boxShadow = '0 0 8px #FFD700, 0 0 15px #FFA500';
            gold.style.zIndex = '115';

            // Spawn clustered at the bottom center
            gold.style.left = (40 + Math.random() * 20) + '%';
            gold.style.bottom = '0px';
            container.appendChild(gold);

            const spreadX = (Math.random() * 100 - 50) + 'px';
            const heightY = -(Math.random() * 150 + 50) + 'px';

            const goldAnim = gold.animate([
                { transform: 'translate(0, 0) scale(0)', opacity: 1 },
                { transform: `translate(${spreadX}, ${heightY}) scale(1.5)`, opacity: 0.8, offset: 0.7 },
                { transform: `translate(${spreadX}, ${heightY}) scale(0)`, opacity: 0 }
            ], { duration: 800 + Math.random() * 600, easing: 'ease-out' });

            goldAnim.onfinish = () => gold.remove();

        }, 30);

        return interval;
    }
};