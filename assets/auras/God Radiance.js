module.exports = {
    name: "Radiance",
    render: function(container) {
        let tickCount = 0;

        const interval = setInterval(() => {
            tickCount++;

            // EFFECT 1: Expanding Holy Shockwaves (Every ~800ms)
            if (tickCount % 20 === 0) {
                const ring = document.createElement('div');
                ring.style.position = 'absolute';
                ring.style.pointerEvents = 'none';
                ring.style.left = '50%';
                ring.style.top = '50%';
                ring.style.width = '120px';
                ring.style.height = '120px';
                ring.style.marginLeft = '-60px'; // Center it
                ring.style.marginTop = '-60px';
                ring.style.borderRadius = '50%';
                ring.style.border = '3px solid rgba(255, 215, 0, 0.8)';
                ring.style.boxShadow = '0 0 20px rgba(255, 255, 255, 0.8), inset 0 0 15px rgba(255, 215, 0, 0.5)';
                ring.style.mixBlendMode = 'screen';
                container.appendChild(ring);

                const ringAnim = ring.animate([
                    { transform: 'scale(0.8)', opacity: 0.8 },
                    { transform: 'scale(2.2)', opacity: 0 }
                ], {
                    duration: 2000,
                    easing: 'ease-out'
                });
                ringAnim.onfinish = () => ring.remove();
            }

            // EFFECT 2: Floating Golden Light Motes (Continuous)
            const mote = document.createElement('div');
            mote.style.position = 'absolute';
            mote.style.pointerEvents = 'none';

            const size = Math.random() * 5 + 3;
            mote.style.width = size + 'px';
            mote.style.height = size + 'px';
            mote.style.borderRadius = '50%';
            mote.style.background = '#FFFFFF';
            mote.style.boxShadow = '0 0 10px #FFD700, 0 0 20px #FF8C00';
            mote.style.mixBlendMode = 'screen';

            // Spawn near the bottom
            const startX = (Math.random() * 100);
            const startY = 85 + (Math.random() * 20);
            mote.style.left = startX + '%';
            mote.style.top = startY + '%';

            container.appendChild(mote);

            // Motes drift slowly upwards and slightly sideways
            const driftX = (Math.random() * 60 - 30) + 'px';
            const driftY = -(Math.random() * 120 + 80) + 'px';

            const moteAnim = mote.animate([
                { transform: 'translate(0, 0) scale(0)', opacity: 0 },
                { transform: `translate(${driftX}, ${driftY}) scale(1)`, opacity: 1, offset: 0.4 },
                { transform: `translate(${driftX}, ${driftY}) scale(0)`, opacity: 0 }
            ], {
                duration: 2500 + Math.random() * 1500, // Slow, elegant float
                easing: 'ease-in-out'
            });

            moteAnim.onfinish = () => mote.remove();

        }, 40); // 40ms interval

        return interval;
    }
};