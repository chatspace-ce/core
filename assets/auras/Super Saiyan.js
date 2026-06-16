module.exports = {
    name: "Super Saiyan",
    render: function(container) {
        let tickCount = 0;

        const interval = setInterval(() => {
            tickCount++;

            // EFFECT 1: Rising golden aura flames (continuous, dense)
            const flame = document.createElement('div');
            flame.style.position = 'absolute';
            flame.style.pointerEvents = 'none';

            const size = Math.random() * 35 + 20; // 20px to 55px
            flame.style.width = size + 'px';
            flame.style.height = size + 'px';
            flame.style.borderRadius = '50%';
            flame.style.filter = 'blur(7px)';
            flame.style.mixBlendMode = 'screen';

            // Golden SSJ color palette: bright yellow core, gold body, white-hot peaks
            const r = Math.random();
            if (r < 0.2) {
                flame.style.background = 'rgba(255, 255, 200, 0.95)'; // White-hot core
            } else if (r < 0.6) {
                flame.style.background = 'rgba(255, 230, 0, 0.85)';   // Pure gold
            } else if (r < 0.85) {
                flame.style.background = 'rgba(255, 180, 0, 0.75)';   // Amber gold
            } else {
                flame.style.background = 'rgba(255, 255, 100, 0.6)';  // Yellow fringe
            }

            // Spawn along bottom and slightly up the sides of the avatar
            const edge = Math.random();
            let startX, startY;
            if (edge < 0.6) {
                // Bottom cluster (most flames rise from base)
                startX = 30 + Math.random() * 40;
                startY = 85 + Math.random() * 15;
            } else if (edge < 0.8) {
                // Left side
                startX = Math.random() * 25;
                startY = 40 + Math.random() * 50;
            } else {
                // Right side
                startX = 75 + Math.random() * 25;
                startY = 40 + Math.random() * 50;
            }
            flame.style.left = startX + '%';
            flame.style.top = startY + '%';

            container.appendChild(flame);

            // Flames rise up and slightly outward with a spiky, electric flicker
            const flickerX = (Math.random() * 40 - 20) + 'px';
            const riseY = -(Math.random() * 100 + 80) + 'px';

            const flameAnim = flame.animate([
                { transform: 'translate(0, 0) scale(1)', opacity: 0.9 },
                { transform: `translate(${flickerX}, ${riseY}) scale(0.15)`, opacity: 0 }
            ], {
                duration: 400 + Math.random() * 350, // Fast and punchy
                easing: 'ease-in'
            });

            flameAnim.onfinish = () => flame.remove();

            // EFFECT 2: Electric sparks crackling around the aura edges (every ~120ms)
            if (tickCount % 3 === 0) {
                const spark = document.createElement('div');
                spark.style.position = 'absolute';
                spark.style.pointerEvents = 'none';
                spark.style.mixBlendMode = 'screen';

                // Thin electric tendril shape
                const sparkW = Math.random() * 3 + 1;
                const sparkH = Math.random() * 18 + 8;
                spark.style.width = sparkW + 'px';
                spark.style.height = sparkH + 'px';
                spark.style.borderRadius = '2px';

                // Electric blue-white with gold tints — classic SSJ electricity
                const sparkColors = [
                    'rgba(200, 230, 255, 0.95)', // Ice blue-white
                    'rgba(255, 255, 255, 1)',     // Pure white
                    'rgba(255, 240, 100, 0.9)',   // Gold-yellow
                    'rgba(180, 220, 255, 0.9)',   // Light blue
                ];
                const sc = sparkColors[Math.floor(Math.random() * sparkColors.length)];
                spark.style.background = sc;
                spark.style.boxShadow = `0 0 6px ${sc}, 0 0 12px rgba(255, 240, 100, 0.8)`;

                // Sparks appear around the border of the avatar
                spark.style.left = (Math.random() * 110 - 5) + '%';
                spark.style.top = (Math.random() * 110 - 5) + '%';

                const rotation = (Math.random() * 360) + 'deg';
                container.appendChild(spark);

                const sparkAnim = spark.animate([
                    { opacity: 0, transform: `rotate(${rotation}) scaleY(0.2)` },
                    { opacity: 1, transform: `rotate(${rotation}) scaleY(1)`, offset: 0.15 },
                    { opacity: 0.8, transform: `rotate(${rotation}) scaleY(0.6)`, offset: 0.5 },
                    { opacity: 0, transform: `rotate(${rotation}) scaleY(0)` }
                ], {
                    duration: 150 + Math.random() * 150,
                    easing: 'linear'
                });

                sparkAnim.onfinish = () => spark.remove();
            }

            // EFFECT 3: Pulsing power rings erupting outward (every ~1000ms)
            if (tickCount % 25 === 0) {
                const ring = document.createElement('div');
                ring.style.position = 'absolute';
                ring.style.pointerEvents = 'none';
                ring.style.left = '50%';
                ring.style.top = '50%';
                ring.style.width = '100px';
                ring.style.height = '100px';
                ring.style.marginLeft = '-50px';
                ring.style.marginTop = '-50px';
                ring.style.borderRadius = '50%';
                ring.style.border = '2px solid rgba(255, 230, 0, 0.9)';
                ring.style.boxShadow = '0 0 15px rgba(255, 220, 0, 0.9), inset 0 0 10px rgba(255, 255, 150, 0.4)';
                ring.style.mixBlendMode = 'screen';
                container.appendChild(ring);

                const ringAnim = ring.animate([
                    { transform: 'scale(0.6)', opacity: 0.9 },
                    { transform: 'scale(2.5)', opacity: 0 }
                ], {
                    duration: 700 + Math.random() * 300,
                    easing: 'ease-out'
                });

                ringAnim.onfinish = () => ring.remove();
            }

            // EFFECT 4: Floating golden energy motes (slow rising embers)
            if (tickCount % 2 === 0) {
                const mote = document.createElement('div');
                mote.style.position = 'absolute';
                mote.style.pointerEvents = 'none';

                const moteSize = Math.random() * 4 + 2;
                mote.style.width = moteSize + 'px';
                mote.style.height = moteSize + 'px';
                mote.style.borderRadius = '50%';
                mote.style.background = '#FFFFFF';
                mote.style.boxShadow = '0 0 8px #FFD700, 0 0 16px #FFA500';
                mote.style.mixBlendMode = 'screen';

                mote.style.left = (10 + Math.random() * 80) + '%';
                mote.style.top = (70 + Math.random() * 30) + '%';

                container.appendChild(mote);

                const driftX = (Math.random() * 50 - 25) + 'px';
                const driftY = -(Math.random() * 90 + 60) + 'px';

                const moteAnim = mote.animate([
                    { transform: 'translate(0, 0) scale(0)', opacity: 0 },
                    { transform: `translate(${driftX}, ${driftY}) scale(1)`, opacity: 1, offset: 0.35 },
                    { transform: `translate(${driftX}, ${driftY}) scale(0)`, opacity: 0 }
                ], {
                    duration: 1500 + Math.random() * 1000,
                    easing: 'ease-in-out'
                });

                moteAnim.onfinish = () => mote.remove();
            }

        }, 40); // 40ms — dense and energetic like SSJ power output

        return interval;
    }
};
