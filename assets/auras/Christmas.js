module.exports = {
    name: "Christmas",
    render: function(container) {
        let tickCount = 0;

        const interval = setInterval(() => {
            tickCount++;

            // --- 1. PARALLAX SNOWFALL ---
            const snow = document.createElement('div');
            snow.style.position = 'absolute';
            snow.style.pointerEvents = 'none';
            snow.innerText = Math.random() > 0.5 ? '❄️' : '❆';

            // Depth of field logic for snow
            const isForeground = Math.random() > 0.7;
            const size = isForeground ? (Math.random() * 10 + 15) : (Math.random() * 8 + 6);
            snow.style.fontSize = size + 'px';
            snow.style.color = '#fff';
            snow.style.textShadow = '0 0 5px #fff, 0 0 10px #00d2ff';
            snow.style.filter = isForeground ? 'blur(1.5px)' : 'none';
            snow.style.zIndex = isForeground ? '120' : '90';

            snow.style.left = (Math.random() * 140 - 20) + '%';
            snow.style.top = '-20%';
            container.appendChild(snow);

            // Foreground snow falls faster
            const duration = isForeground ? (1500 + Math.random() * 1000) : (3000 + Math.random() * 2000);
            const drift = (Math.random() * 40 - 20) + 'px';

            const snowAnim = snow.animate([
                { transform: `translate(0, 0) rotate(0deg)`, opacity: 0 },
                { transform: `translate(${drift}, 100px) rotate(90deg)`, opacity: 1, offset: 0.2 },
                { transform: `translate(${drift * 2}, 300px) rotate(180deg)`, opacity: 0 }
            ], { duration: duration, easing: 'linear' });

            snowAnim.onfinish = () => snow.remove();

            // --- 2. FAIRY LIGHT SPARKLES (Every ~4th tick) ---
            if (tickCount % 4 === 0) {
                const colors = ['#ff0000', '#00ff00', '#FFD700', '#00d2ff'];
                const color = colors[Math.floor(Math.random() * colors.length)];

                const light = document.createElement('div');
                light.style.position = 'absolute';
                light.style.pointerEvents = 'none';
                light.style.width = '4px';
                light.style.height = '4px';
                light.style.borderRadius = '50%';
                light.style.background = '#fff';
                light.style.boxShadow = `0 0 10px 4px ${color}`;
                light.style.zIndex = '115';

                // Spawn in a ring around the avatar
                light.style.left = (Math.random() * 120 - 10) + '%';
                light.style.top = (Math.random() * 120 - 10) + '%';
                container.appendChild(light);

                const lightAnim = light.animate([
                    { transform: 'scale(0)', opacity: 0 },
                    { transform: 'scale(1.5)', opacity: 1, offset: 0.5 },
                    { transform: 'scale(0)', opacity: 0 }
                ], { duration: 800 + Math.random() * 600, easing: 'ease-in-out' });

                lightAnim.onfinish = () => light.remove();
            }
        }, 40);

        return interval;
    }
};