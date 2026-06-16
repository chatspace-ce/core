module.exports = {
    name: "Angel",
    render: function(container) {

        // === PERSISTENT ELEMENTS (created once) ===

        // Soft holy glow radiating from behind the avatar
        const glow = document.createElement('div');
        glow.style.cssText = `
            position: absolute; pointer-events: none;
            left: 50%; top: 50%;
            width: 160%; height: 160%;
            margin-left: -80%; margin-top: -80%;
            border-radius: 50%;
            background: radial-gradient(ellipse, rgba(255,255,220,0.22) 0%, rgba(255,230,130,0.1) 45%, transparent 70%);
            filter: blur(10px);
            mix-blend-mode: screen;
        `;
        container.appendChild(glow);
        glow.animate([
            { opacity: 0.65 },
            { opacity: 1 },
            { opacity: 0.65 }
        ], { duration: 2500, iterations: Infinity, easing: 'ease-in-out' });

        // Wing SVG path: right-facing wing, attaches at the left side of the SVG
        // Leading edge curves up-right, trailing edge has feather scallops
        const wingPath = [
            'M 8,58',
            'Q 18,28 48,8',
            'Q 76,-6 106,14',   // sweep to outer tip
            'Q 90,20 74,30',    // first primary feather fold-back
            'Q 94,24 110,42',   // second primary tip
            'Q 90,47 72,54',    // second feather fold-back
            'Q 92,60 96,74',    // third primary tip
            'Q 76,68 58,78',    // third feather fold-back
            'Q 70,88 65,100',   // fourth primary tip
            'Q 48,95 38,104',   // fourth feather fold-back
            'Q 44,114 36,124',  // fifth (lowest) primary tip
            'Q 22,118 12,104',  // sweep back to base
            'Q 4,84 8,58 Z'
        ].join(' ');

        function createWing(mirrored) {
            const wrapper = document.createElement('div');
            wrapper.style.cssText = `
                position: absolute; pointer-events: none;
                width: 95px; height: 115px;
                top: 6%;
                ${mirrored ? 'right: 86%;' : 'left: 86%;'}
            `;

            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('viewBox', '0 0 115 132');
            svg.style.cssText = 'width: 100%; height: 100%; overflow: visible;';

            const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');

            // Gradient: bright white at the body root, warm gold toward feather tips
            const gradId = mirrored ? 'angel-grad-l' : 'angel-grad-r';
            const grad = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
            grad.setAttribute('id', gradId);
            grad.setAttribute('x1', '0%'); grad.setAttribute('y1', '20%');
            grad.setAttribute('x2', '100%'); grad.setAttribute('y2', '80%');
            [
                ['0%',   'rgba(255,255,248,0.98)'],
                ['45%',  'rgba(255,245,210,0.85)'],
                ['100%', 'rgba(255,220,150,0.3)']
            ].forEach(([offset, color]) => {
                const stop = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
                stop.setAttribute('offset', offset);
                stop.setAttribute('stop-color', color);
                grad.appendChild(stop);
            });
            defs.appendChild(grad);
            svg.appendChild(defs);

            // Wing body
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', wingPath);
            path.setAttribute('fill', `url(#${gradId})`);
            path.setAttribute('stroke', 'rgba(255,248,210,0.7)');
            path.setAttribute('stroke-width', '1.2');
            path.setAttribute('stroke-linejoin', 'round');
            svg.appendChild(path);

            wrapper.appendChild(svg);

            // Gentle flap: the wing pivots from its inner edge (attachment to body)
            // Simulated by a subtle translateY bob and slight rotation
            const base = mirrored ? 'scaleX(-1)' : '';
            wrapper.animate([
                { transform: `${base} translateY(-4px) rotate(-4deg)` },
                { transform: `${base} translateY(4px)  rotate(4deg)` },
                { transform: `${base} translateY(-4px) rotate(-4deg)` }
            ], {
                duration: 2800 + Math.random() * 600,
                iterations: Infinity,
                easing: 'ease-in-out'
            });

            return wrapper;
        }

        container.appendChild(createWing(false)); // right wing
        container.appendChild(createWing(true));  // left wing (mirrored)

        // Halo: glowing golden oval ring floating above the avatar's head
        const halo = document.createElement('div');
        halo.style.cssText = `
            position: absolute; pointer-events: none;
            left: 50%; top: -14%;
            width: 58px; height: 20px;
            margin-left: -29px;
            border-radius: 50%;
            border: 3px solid rgba(255, 218, 40, 0.95);
            box-shadow:
                0 0 8px  rgba(255, 215, 0, 1),
                0 0 20px rgba(255, 200, 0, 0.7),
                0 0 40px rgba(255, 200, 50, 0.3),
                inset 0 0 8px rgba(255, 250, 180, 0.4);
            mix-blend-mode: screen;
        `;
        container.appendChild(halo);

        // Halo bobs gently up and down, with a subtle tilt — like it's floating
        halo.animate([
            { transform: 'translateY(0px)   rotateX(20deg) rotateZ(-2deg)' },
            { transform: 'translateY(-5px)  rotateX(20deg) rotateZ(2deg)'  },
            { transform: 'translateY(0px)   rotateX(20deg) rotateZ(-2deg)' }
        ], { duration: 3200, iterations: Infinity, easing: 'ease-in-out' });

        // === INTERVAL: Particle effects ===
        let tickCount = 0;

        const interval = setInterval(() => {
            tickCount++;

            // Floating holy light motes rising up from the avatar (always)
            const mote = document.createElement('div');
            const ms = Math.random() * 4 + 2;
            mote.style.cssText = `
                position: absolute; pointer-events: none;
                width: ${ms}px; height: ${ms}px;
                border-radius: 50%;
                background: #FFFFFF;
                box-shadow: 0 0 7px #FFD700, 0 0 14px rgba(255,250,200,0.8);
                mix-blend-mode: screen;
                left: ${10 + Math.random() * 80}%;
                top:  ${55 + Math.random() * 40}%;
            `;
            container.appendChild(mote);

            const mdx = (Math.random() * 36 - 18) + 'px';
            const mdy = -(Math.random() * 70 + 40) + 'px';
            mote.animate([
                { transform: 'translate(0,0) scale(0)', opacity: 0 },
                { transform: `translate(${mdx}, ${mdy}) scale(1)`, opacity: 1, offset: 0.35 },
                { transform: `translate(${mdx}, ${mdy}) scale(0)`, opacity: 0 }
            ], { duration: 2000 + Math.random() * 1500, easing: 'ease-in-out' })
            .onfinish = () => mote.remove();

            // Falling feathers drifting down through the scene (~every 1.5s)
            if (tickCount % 36 === 0) {
                const feather = document.createElement('div');
                feather.textContent = '🪶';
                feather.style.cssText = `
                    position: absolute; pointer-events: none;
                    font-size: ${11 + Math.random() * 10}px;
                    left: ${5 + Math.random() * 90}%;
                    top: -8%;
                    filter: drop-shadow(0 0 5px rgba(255,255,210,0.9)) brightness(1.3);
                    opacity: 0.9;
                `;
                container.appendChild(feather);

                const fdx = (Math.random() * 50 - 25) + 'px';
                const rot = (Math.random() * 300 - 150) + 'deg';
                feather.animate([
                    { transform: `translate(0,0) rotate(0deg)`, opacity: 0.9 },
                    { transform: `translate(${fdx}, 70px) rotate(${rot})`, opacity: 0.6, offset: 0.55 },
                    { transform: `translate(${fdx}, 140px) rotate(${rot})`, opacity: 0 }
                ], { duration: 2500 + Math.random() * 1500, easing: 'ease-in' })
                .onfinish = () => feather.remove();
            }

            // Expanding holy ring pulse radiating outward (~every 2s)
            if (tickCount % 50 === 0) {
                const ring = document.createElement('div');
                ring.style.cssText = `
                    position: absolute; pointer-events: none;
                    left: 50%; top: 50%;
                    width: 90px; height: 90px;
                    margin-left: -45px; margin-top: -45px;
                    border-radius: 50%;
                    border: 2px solid rgba(255, 225, 100, 0.85);
                    box-shadow: 0 0 14px rgba(255, 215, 0, 0.6);
                    mix-blend-mode: screen;
                `;
                container.appendChild(ring);
                ring.animate([
                    { transform: 'scale(0.4)', opacity: 0.9 },
                    { transform: 'scale(3.0)', opacity: 0 }
                ], { duration: 2000, easing: 'ease-out' })
                .onfinish = () => ring.remove();
            }

        }, 40);

        return interval;
    }
};
