module.exports = {
    name: "JOI Hologram",
    render: function(container) {

        // === PERSISTENT LAYERS ===
        // These sit over the avatar itself to make it read as a holographic projection.

        // Spotlight — soft cyan glow radiating outward from the projection field
        const edgeGlow = document.createElement('div');
        edgeGlow.style.cssText = `
            position: absolute; pointer-events: none;
            left: 50%; top: 50%;
            width: 135%; height: 135%;
            margin-left: -67.5%; margin-top: -67.5%;
            border-radius: 50%;
            background: radial-gradient(ellipse, transparent 32%, rgba(70,175,255,0.12) 65%, rgba(30,110,220,0.2) 100%);
            filter: blur(10px);
            mix-blend-mode: screen;
        `;
        container.appendChild(edgeGlow);
        edgeGlow.animate([
            { opacity: 0.7 }, { opacity: 1 }, { opacity: 0.7 }
        ], { duration: 3000, iterations: Infinity, easing: 'ease-in-out' });

        // Scanlines — the single most defining hologram visual
        // Height 200% + translateY(-50%) loop creates a seamless downward scroll
        const scanlines = document.createElement('div');
        scanlines.style.cssText = `
            position: absolute; pointer-events: none;
            left: 0; top: 0; width: 100%; height: 200%;
            background: repeating-linear-gradient(
                to bottom,
                transparent    0px,
                transparent    2px,
                rgba(0,20,50,0.14) 2px,
                rgba(0,20,50,0.14) 4px
            );
            mix-blend-mode: multiply;
        `;
        container.appendChild(scanlines);
        scanlines.animate([
            { transform: 'translateY(0%)' },
            { transform: 'translateY(-50%)' }
        ], { duration: 7000, iterations: Infinity, easing: 'linear' });

        // Chromatic fringe — cyan bleeds in from the left, warm pink from the right
        // This is the hallmark of real holographic projection optics
        const fringeL = document.createElement('div');
        fringeL.style.cssText = `
            position: absolute; pointer-events: none;
            left: 0; top: 0; width: 28%; height: 100%;
            background: linear-gradient(to right, rgba(60,190,255,0.13), transparent);
            mix-blend-mode: screen;
        `;
        container.appendChild(fringeL);

        const fringeR = document.createElement('div');
        fringeR.style.cssText = `
            position: absolute; pointer-events: none;
            right: 0; top: 0; width: 28%; height: 100%;
            background: linear-gradient(to left, rgba(255,80,140,0.08), transparent);
            mix-blend-mode: screen;
        `;
        container.appendChild(fringeR);

        // Projector base light — the cone of light the hologram is "cast" from below
        const projector = document.createElement('div');
        projector.style.cssText = `
            position: absolute; pointer-events: none;
            left: 50%; bottom: -4%;
            width: 70%; height: 20%;
            margin-left: -35%;
            background: radial-gradient(ellipse at center bottom, rgba(80,190,255,0.18) 0%, transparent 70%);
            filter: blur(8px);
            mix-blend-mode: screen;
        `;
        container.appendChild(projector);
        projector.animate([
            { opacity: 0.6 }, { opacity: 1 }, { opacity: 0.6 }
        ], { duration: 4000, iterations: Infinity, easing: 'ease-in-out' });

        // === INTERVAL: Signal artifacts & particles ===
        let tickCount = 0;
        let flickerBusy = false;

        const interval = setInterval(() => {
            tickCount++;

            // --- HOLOGRAPHIC MOTES ---
            // Fine blue-white dust floating in the projection beam, always present
            if (tickCount % 3 === 0) {
                const mote = document.createElement('div');
                const sz = Math.random() * 2.5 + 0.8;
                mote.style.cssText = `
                    position: absolute; pointer-events: none;
                    width: ${sz}px; height: ${sz}px;
                    border-radius: 50%;
                    background: rgba(210, 240, 255, 0.95);
                    box-shadow: 0 0 4px rgba(100,200,255,0.9), 0 0 9px rgba(60,160,255,0.5);
                    mix-blend-mode: screen;
                    left: ${Math.random() * 100}%;
                    top: ${15 + Math.random() * 78}%;
                `;
                container.appendChild(mote);
                const dx = (Math.random() * 18 - 9) + 'px';
                const dy = -(Math.random() * 45 + 25) + 'px';
                mote.animate([
                    { transform: 'translate(0,0) scale(0)', opacity: 0 },
                    { transform: `translate(${dx},${dy}) scale(1)`, opacity: 0.85, offset: 0.35 },
                    { transform: `translate(${dx},${dy}) scale(0)`, opacity: 0 }
                ], { duration: 2200 + Math.random() * 2000, easing: 'ease-in-out' })
                .onfinish = () => mote.remove();
            }

            // --- INTERFERENCE LINES ---
            // Thin horizontal bands of cyan light that flash across the image
            // Occasional thicker bright ones for that "signal surge" look
            if (tickCount % 14 === 0) {
                const line = document.createElement('div');
                const thick = Math.random() > 0.75;
                line.style.cssText = `
                    position: absolute; pointer-events: none;
                    left: 0; top: ${Math.random() * 100}%;
                    width: 100%; height: ${thick ? Math.random() * 3 + 2 : 1}px;
                    background: rgba(${thick ? '180,235,255,0.75' : '120,200,255,0.45'});
                    mix-blend-mode: screen;
                `;
                container.appendChild(line);
                line.animate([
                    { opacity: 0, transform: 'scaleX(0.2)' },
                    { opacity: 1, transform: 'scaleX(1)', offset: 0.08 },
                    { opacity: 0.9, offset: 0.6 },
                    { opacity: 0 }
                ], { duration: 180 + Math.random() * 280, easing: 'linear' })
                .onfinish = () => line.remove();
            }

            // --- SIGNAL FLICKER ---
            // Rapid opacity dropout bursts, irregularly timed — unstable signal
            if (tickCount % 35 === 0 && !flickerBusy) {
                flickerBusy = true;
                const bursts = Math.floor(Math.random() * 4) + 1;
                let t = 0;
                for (let i = 0; i < bursts; i++) {
                    t += Math.random() * 100 + 20;
                    const idx = i;
                    setTimeout(() => {
                        const drop = document.createElement('div');
                        drop.style.cssText = `
                            position: absolute; pointer-events: none;
                            left: 0; top: 0; width: 100%; height: 100%;
                            background: rgba(0, 5, 20, ${0.35 + Math.random() * 0.45});
                            mix-blend-mode: multiply;
                        `;
                        container.appendChild(drop);
                        drop.animate([
                            { opacity: 1 }, { opacity: 0 }
                        ], { duration: 35 + Math.random() * 55 })
                        .onfinish = () => {
                            drop.remove();
                            if (idx === bursts - 1) flickerBusy = false;
                        };
                    }, t);
                }
            }

            // --- HORIZONTAL DISPLACEMENT ---
            // A strip of the image shifts sideways — corrupted scan region
            if (tickCount % 52 === 0) {
                const strip = document.createElement('div');
                const shift = (Math.random() * 10 - 5) + 'px';
                strip.style.cssText = `
                    position: absolute; pointer-events: none;
                    left: 0; top: ${8 + Math.random() * 82}%;
                    width: 100%; height: ${Math.random() * 7 + 2}px;
                    background: rgba(90, 200, 255, 0.22);
                    mix-blend-mode: screen;
                `;
                container.appendChild(strip);
                strip.animate([
                    { transform: 'translateX(0)', opacity: 0 },
                    { transform: `translateX(${shift})`, opacity: 1, offset: 0.12 },
                    { transform: `translateX(${shift})`, opacity: 0.85, offset: 0.75 },
                    { transform: 'translateX(0)', opacity: 0 }
                ], { duration: 140 + Math.random() * 140, easing: 'linear' })
                .onfinish = () => strip.remove();
            }

            // --- SIGNAL DROPOUT BLOCKS ---
            // Rectangular darkout patches — portions of the hologram momentarily lost
            if (tickCount % 75 === 0) {
                const block = document.createElement('div');
                block.style.cssText = `
                    position: absolute; pointer-events: none;
                    left: ${Math.random() * 60}%;
                    top: ${Math.random() * 80}%;
                    width: ${20 + Math.random() * 45}%;
                    height: ${4 + Math.random() * 14}px;
                    background: rgba(0, 8, 25, 0.75);
                    mix-blend-mode: multiply;
                `;
                container.appendChild(block);
                block.animate([
                    { opacity: 0 },
                    { opacity: 1, offset: 0.1 },
                    { opacity: 1, offset: 0.85 },
                    { opacity: 0 }
                ], { duration: 70 + Math.random() * 100 })
                .onfinish = () => block.remove();
            }

            // --- CHROMATIC ABERRATION FLASH ---
            // Full-image RGB channel split — fires during higher-energy moments
            if (tickCount % 42 === 0) {
                const aber = document.createElement('div');
                const o = (Math.random() * 5 + 2) + 'px';
                aber.style.cssText = `
                    position: absolute; pointer-events: none;
                    left: 0; top: 0; width: 100%; height: 100%;
                    box-shadow:
                        inset  ${o} 0 0 rgba(255,50,100,0.22),
                        inset -${o} 0 0 rgba(40,200,255,0.22);
                    mix-blend-mode: screen;
                `;
                container.appendChild(aber);
                aber.animate([
                    { opacity: 0 },
                    { opacity: 1, offset: 0.1 },
                    { opacity: 0 }
                ], { duration: 110 + Math.random() * 130 })
                .onfinish = () => aber.remove();
            }

            // --- VERTICAL SCAN FLASH ---
            // A thin vertical bar of bright cyan sweeps across occasionally
            // Mimics the projector re-rendering or focus adjustment
            if (tickCount % 95 === 0) {
                const vbar = document.createElement('div');
                const vx = Math.random() * 90;
                vbar.style.cssText = `
                    position: absolute; pointer-events: none;
                    left: ${vx}%; top: 0;
                    width: 2px; height: 100%;
                    background: linear-gradient(to bottom, transparent, rgba(160,230,255,0.6) 30%, rgba(160,230,255,0.6) 70%, transparent);
                    mix-blend-mode: screen;
                `;
                container.appendChild(vbar);
                vbar.animate([
                    { opacity: 0, transform: 'scaleY(0.1)' },
                    { opacity: 1, transform: 'scaleY(1)', offset: 0.15 },
                    { opacity: 0.6, offset: 0.6 },
                    { opacity: 0 }
                ], { duration: 300 + Math.random() * 200, easing: 'ease-in-out' })
                .onfinish = () => vbar.remove();
            }

        }, 40);

        return interval;
    }
};
