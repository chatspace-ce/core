module.exports = {
    name: "Aurora Borealis",
    render: function(container) {

        // === LAYER 1: Background atmosphere — wide, very blurred color washes ===
        const bgLayers = [
            {
                left: '-15%', width: '75%',
                gradient: 'linear-gradient(to bottom, transparent 0%, rgba(120,40,210,0.22) 25%, rgba(40,190,160,0.13) 60%, transparent 100%)',
                blur: 28, dur: 9000, delay: 0, sway: 22
            },
            {
                left: '40%', width: '75%',
                gradient: 'linear-gradient(to bottom, transparent 0%, rgba(210,50,180,0.19) 20%, rgba(100,40,210,0.22) 55%, transparent 100%)',
                blur: 28, dur: 11000, delay: -4000, sway: 18
            }
        ];

        bgLayers.forEach(b => {
            const el = document.createElement('div');
            el.style.cssText = `
                position: absolute; pointer-events: none;
                left: ${b.left}; top: -18%;
                width: ${b.width}; height: 128%;
                background: ${b.gradient};
                filter: blur(${b.blur}px);
                mix-blend-mode: screen;
            `;
            container.appendChild(el);
            el.animate([
                { transform: `translateX(0px)`,           opacity: 0.55 },
                { transform: `translateX(${b.sway}px)`,   opacity: 0.72, offset: 0.3 },
                { transform: `translateX(-${b.sway}px)`,  opacity: 0.60, offset: 0.7 },
                { transform: `translateX(0px)`,           opacity: 0.55 }
            ], { duration: b.dur, iterations: Infinity, easing: 'ease-in-out' });
        });

        // === LAYER 2: Curtain columns — vertical aurora striations ===
        const curtains = [
            {
                left: '2%',  width: '22%',
                colors: ['transparent', 'rgba(130,45,230,0.50)', 'rgba(30,180,150,0.30)', 'rgba(100,35,200,0.20)', 'transparent'],
                blur: 14, dur: 6200, delay: 0,     sway: 14, skew: 3
            },
            {
                left: '18%', width: '28%',
                colors: ['transparent', 'rgba(200,55,195,0.40)', 'rgba(110,35,220,0.53)', 'rgba(35,170,145,0.23)', 'transparent'],
                blur: 16, dur: 8400, delay: -2100, sway: 20, skew: 2.5
            },
            {
                left: '38%', width: '24%',
                colors: ['transparent', 'rgba(160,55,245,0.56)', 'rgba(40,200,170,0.33)', 'rgba(140,45,220,0.20)', 'transparent'],
                blur: 13, dur: 5700, delay: -800,  sway: 16, skew: 4
            },
            {
                left: '55%', width: '26%',
                colors: ['transparent', 'rgba(35,195,165,0.37)', 'rgba(110,40,215,0.47)', 'rgba(180,65,190,0.23)', 'transparent'],
                blur: 15, dur: 7600, delay: -3800, sway: 18, skew: 2
            },
            {
                left: '70%', width: '22%',
                colors: ['transparent', 'rgba(225,60,185,0.43)', 'rgba(120,40,225,0.50)', 'rgba(40,175,155,0.20)', 'transparent'],
                blur: 14, dur: 6900, delay: -1500, sway: 15, skew: 3.5
            },
            {
                left: '82%', width: '22%',
                colors: ['transparent', 'rgba(65,75,230,0.37)', 'rgba(130,45,215,0.43)', 'rgba(35,165,160,0.20)', 'transparent'],
                blur: 15, dur: 9200, delay: -5000, sway: 12, skew: 2
            }
        ];

        curtains.forEach(c => {
            const el = document.createElement('div');
            el.style.cssText = `
                position: absolute; pointer-events: none;
                left: ${c.left}; top: -22%;
                width: ${c.width}; height: 132%;
                background: linear-gradient(to bottom, ${c.colors.join(', ')});
                filter: blur(${c.blur}px);
                mix-blend-mode: screen;
            `;
            container.appendChild(el);

            el.animate([
                { transform: `translateX(0px)              skewX(0deg)`,              opacity: 0.60 },
                { transform: `translateX(${c.sway}px)      skewX(${c.skew}deg)`,      opacity: 0.72, offset: 0.25 },
                { transform: `translateX(${c.sway*0.2}px)  skewX(-${c.skew*0.4}deg)`, opacity: 0.62, offset: 0.5  },
                { transform: `translateX(-${c.sway*0.7}px) skewX(-${c.skew}deg)`,     opacity: 0.72, offset: 0.75 },
                { transform: `translateX(0px)              skewX(0deg)`,              opacity: 0.60 }
            ], {
                duration: c.dur,
                delay: c.delay,
                iterations: Infinity,
                easing: 'ease-in-out'
            });
        });

        // === LAYER 3: Interval-driven particles & shimmer ===
        let tickCount = 0;

        const moteColors = [
            '180, 100, 255',
            '40, 210, 175',
            '230, 80, 200',
            '100, 80, 240',
            '220, 170, 255',
        ];

        const interval = setInterval(() => {
            tickCount++;

            // Drifting aurora motes
            if (tickCount % 2 === 0) {
                const mote = document.createElement('div');
                const rgb = moteColors[Math.floor(Math.random() * moteColors.length)];
                const size = Math.random() * 4 + 1.5;
                mote.style.cssText = `
                    position: absolute; pointer-events: none;
                    width: ${size}px; height: ${size}px;
                    border-radius: 50%;
                    background: rgba(255,255,255,0.9);
                    box-shadow: 0 0 6px rgba(${rgb},0.9), 0 0 14px rgba(${rgb},0.6);
                    mix-blend-mode: screen;
                    left: ${Math.random() * 100}%;
                    top: ${15 + Math.random() * 75}%;
                `;
                container.appendChild(mote);

                const dx = (Math.random() * 24 - 12) + 'px';
                const dy = -(Math.random() * 55 + 25) + 'px';
                mote.animate([
                    { transform: 'translate(0,0) scale(0)', opacity: 0 },
                    { transform: `translate(${dx}, ${dy}) scale(1)`, opacity: 0.7, offset: 0.4 },
                    { transform: `translate(${dx}, ${dy}) scale(0)`, opacity: 0 }
                ], { duration: 2500 + Math.random() * 2000, easing: 'ease-in-out' })
                .onfinish = () => mote.remove();
            }

            // Bright shimmer streaks
            if (tickCount % 70 === 0) {
                const streak = document.createElement('div');
                const rgb = moteColors[Math.floor(Math.random() * moteColors.length)];
                const leftPos = 5 + Math.random() * 75;
                streak.style.cssText = `
                    position: absolute; pointer-events: none;
                    left: ${leftPos}%; top: -18%;
                    width: ${8 + Math.random() * 10}%; height: 128%;
                    background: linear-gradient(to bottom,
                        transparent,
                        rgba(${rgb}, 0.38) 30%,
                        rgba(${rgb}, 0.24) 65%,
                        transparent);
                    filter: blur(8px);
                    mix-blend-mode: screen;
                `;
                container.appendChild(streak);
                streak.animate([
                    { opacity: 0,    transform: 'skewX(0deg)' },
                    { opacity: 0.70, transform: `skewX(${(Math.random()*6)-3}deg)`, offset: 0.2 },
                    { opacity: 0.50, transform: `skewX(${(Math.random()*4)-2}deg)`, offset: 0.6 },
                    { opacity: 0,    transform: 'skewX(0deg)' }
                ], { duration: 1400 + Math.random() * 800, easing: 'ease-in-out' })
                .onfinish = () => streak.remove();
            }

            // Horizontal luminosity wave sweeping downward
            if (tickCount % 110 === 0) {
                const wave = document.createElement('div');
                const startTop = -10 + Math.random() * 20;
                wave.style.cssText = `
                    position: absolute; pointer-events: none;
                    left: -10%; top: ${startTop}%;
                    width: 120%; height: 18%;
                    background: linear-gradient(to bottom,
                        transparent,
                        rgba(200, 140, 255, 0.12),
                        transparent);
                    filter: blur(16px);
                    mix-blend-mode: screen;
                `;
                container.appendChild(wave);
                wave.animate([
                    { transform: 'translateY(0px)', opacity: 0 },
                    { opacity: 0.60, offset: 0.3 },
                    { opacity: 0.45, offset: 0.7 },
                    { transform: 'translateY(80px)', opacity: 0 }
                ], { duration: 3500 + Math.random() * 1500, easing: 'ease-in-out' })
                .onfinish = () => wave.remove();
            }

        }, 40);

        return interval;
    }
};
