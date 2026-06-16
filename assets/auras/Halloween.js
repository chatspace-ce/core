module.exports = {
    name: "Halloween",
    render: function(container) {
        let tickCount = 0;

        const interval = setInterval(() => {
            tickCount++;

            // --- 1. ROLLING TOXIC FOG (Base Layer) ---
            if (tickCount % 5 === 0) {
                const fog = document.createElement('div');
                fog.style.position = 'absolute';
                fog.style.pointerEvents = 'none';
                fog.style.width = '80px';
                fog.style.height = '30px';
                fog.style.borderRadius = '50%';

                // Mix of creepy purple and toxic green
                const isGreen = Math.random() > 0.5;
                fog.style.background = isGreen ? 'rgba(50, 255, 50, 0.15)' : 'rgba(138, 43, 226, 0.2)';
                fog.style.boxShadow = isGreen ? '0 0 20px rgba(50,255,50,0.3)' : '0 0 20px rgba(138,43,226,0.4)';
                fog.style.filter = 'blur(10px)';
                fog.style.zIndex = '100'; // Covers the bottom

                fog.style.bottom = (Math.random() * -10) + 'px';
                const startSide = Math.random() > 0.5 ? '-20%' : '100%';
                const endSide = startSide === '-20%' ? '120%' : '-40%';
                fog.style.left = startSide;
                container.appendChild(fog);

                const fogAnim = fog.animate([
                    { left: startSide, opacity: 0, transform: 'scale(0.8)' },
                    { opacity: 1, transform: 'scale(1.5)', offset: 0.5 },
                    { left: endSide, opacity: 0, transform: 'scale(1)' }
                ], { duration: 4000 + Math.random() * 2000, easing: 'ease-in-out' });

                fogAnim.onfinish = () => fog.remove();
            }

            // --- 2. SWOOPING BATS ---
            if (tickCount % 20 === 0) {
                const bat = document.createElement('div');
                bat.style.position = 'absolute';
                bat.style.pointerEvents = 'none';
                bat.innerText = '🦇';
                bat.style.fontSize = (Math.random() * 10 + 12) + 'px';
                bat.style.zIndex = '120';
                bat.style.filter = 'drop-shadow(0 0 2px #000)';

                const startLeft = Math.random() > 0.5;
                bat.style.left = startLeft ? '-10%' : '110%';
                bat.style.top = (Math.random() * 50 + 20) + '%';
                container.appendChild(bat);

                // Swooping curved trajectory
                const moveX = startLeft ? '150px' : '-150px';
                const batAnim = bat.animate([
                    { transform: `translate(0, 0) scale(1)`, opacity: 0 },
                    { transform: `translate(${moveX}, -30px) scale(1.5)`, opacity: 1, offset: 0.5 },
                    { transform: `translate(${startLeft ? '300px' : '-300px'}, 50px) scale(0.5)`, opacity: 0 }
                ], { duration: 1500 + Math.random() * 500, easing: 'cubic-bezier(0.25, 0.1, 0.25, 1)' });

                batAnim.onfinish = () => bat.remove();
            }

            // --- 3. BLINKING RED EYES IN THE DARK (Rare) ---
            if (Math.random() < 0.01) { // 1% chance every 30ms = Spooky and unpredictable
                const eyes = document.createElement('div');
                eyes.style.position = 'absolute';
                eyes.style.pointerEvents = 'none';
                eyes.style.zIndex = '95'; // Behind avatar
                eyes.innerText = '👀';
                eyes.style.fontSize = '24px';
                // Use a CSS filter to turn the emoji completely red and glowing
                eyes.style.filter = 'sepia(1) hue-rotate(-50deg) saturate(1000%) drop-shadow(0 0 10px red)';

                eyes.style.left = (Math.random() * 80 + 10) + '%';
                eyes.style.top = (Math.random() * 60 + 10) + '%';
                container.appendChild(eyes);

                // Quick fade in, stay for a second, quick fade out
                const eyeAnim = eyes.animate([
                    { opacity: 0, transform: 'scale(0.5)' },
                    { opacity: 1, transform: 'scale(1)', offset: 0.1 },
                    { opacity: 1, transform: 'scale(1.1)', offset: 0.8 },
                    { opacity: 0, transform: 'scale(0.8)' }
                ], { duration: 1500 });

                eyeAnim.onfinish = () => eyes.remove();
            }

        }, 30);

        return interval;
    }
};