module.exports = {
    name: "Devil",
    render: function(container) {

        // === PERSISTENT ELEMENTS ===

        // Dark vignette — shadow creeping in from the edges (multiply darkens the avatar edges)
        const vignette = document.createElement('div');
        vignette.style.cssText = `
            position: absolute; pointer-events: none;
            left: 50%; top: 50%;
            width: 170%; height: 170%;
            margin-left: -85%; margin-top: -85%;
            border-radius: 50%;
            background: radial-gradient(ellipse, transparent 28%, rgba(80,0,0,0.28) 62%, rgba(20,0,0,0.5) 100%);
            filter: blur(8px);
            mix-blend-mode: multiply;
        `;
        container.appendChild(vignette);
        vignette.animate([
            { opacity: 0.75 },
            { opacity: 1 },
            { opacity: 0.75 }
        ], { duration: 2000, iterations: Infinity, easing: 'ease-in-out' });

        // Hellfire ambient glow — red screen-mode light from beneath
        const fireGlow = document.createElement('div');
        fireGlow.style.cssText = `
            position: absolute; pointer-events: none;
            left: 50%; top: 50%;
            width: 140%; height: 140%;
            margin-left: -70%; margin-top: -70%;
            border-radius: 50%;
            background: radial-gradient(ellipse, rgba(200,20,0,0.18) 0%, rgba(140,8,0,0.08) 55%, transparent 75%);
            filter: blur(14px);
            mix-blend-mode: screen;
        `;
        container.appendChild(fireGlow);
        fireGlow.animate([
            { opacity: 0.6 },
            { opacity: 1 },
            { opacity: 0.6 }
        ], { duration: 1700, iterations: Infinity, easing: 'ease-in-out' });

        // === DEMON BAT WINGS ===
        // Bat-style: sharp arm bone, 4 claw-tipped finger spikes, membrane between them
        const wingPath = [
            'M 5,70',
            'L 18,18',           // arm bone sweeping up to first knuckle
            'L 48,-2',           // finger 1 — topmost spike
            'L 42,22',           // membrane retreat
            'L 74,8',            // finger 2 spike
            'L 66,36',           // membrane retreat
            'L 104,28',          // finger 3 spike — longest, outermost
            'L 88,52',           // membrane retreat
            'L 106,60',          // finger 4 spike — lower claw
            'L 92,72',           // outer lower edge
            'Q 75,92 55,98',     // lower membrane curve
            'Q 35,102 16,90',    // sweep back toward body
            'L 5,70 Z'
        ].join(' ');

        function createWing(mirrored) {
            const wrapper = document.createElement('div');
            wrapper.style.cssText = `
                position: absolute; pointer-events: none;
                width: 100px; height: 120px;
                top: 5%;
                ${mirrored ? 'right: 86%;' : 'left: 86%;'}
                filter: drop-shadow(0 0 8px rgba(200,20,0,0.8)) drop-shadow(0 0 20px rgba(120,0,0,0.5));
            `;

            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('viewBox', '0 0 115 108');
            svg.style.cssText = 'width: 100%; height: 100%; overflow: visible;';

            const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');

            // Gradient: dark smoky root → deep crimson body → near-black at claw tips
            const gradId = mirrored ? 'devil-grad-l' : 'devil-grad-r';
            const grad = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
            grad.setAttribute('id', gradId);
            grad.setAttribute('x1', '0%'); grad.setAttribute('y1', '70%');
            grad.setAttribute('x2', '100%'); grad.setAttribute('y2', '0%');
            [
                ['0%',   'rgba(90,5,5,0.97)'],
                ['30%',  'rgba(185,15,15,0.92)'],
                ['65%',  'rgba(130,8,8,0.85)'],
                ['100%', 'rgba(25,2,2,0.75)'],
            ].forEach(([offset, color]) => {
                const stop = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
                stop.setAttribute('offset', offset);
                stop.setAttribute('stop-color', color);
                grad.appendChild(stop);
            });
            defs.appendChild(grad);
            svg.appendChild(defs);

            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', wingPath);
            path.setAttribute('fill', `url(#${gradId})`);
            path.setAttribute('stroke', 'rgba(210,25,8,0.5)');
            path.setAttribute('stroke-width', '1');
            path.setAttribute('stroke-linejoin', 'miter');
            svg.appendChild(path);

            wrapper.appendChild(svg);

            // Snappier than angel — quick downbeat, slower rise, like a bat
            // scaleY(-1) flips wings to point downward (demon style)
            const base = mirrored ? 'scaleX(-1) scaleY(-1)' : 'scaleY(-1)';
            wrapper.animate([
                { transform: `${base} translateY(-5px) rotate(-5deg)` },
                { transform: `${base} translateY(7px)  rotate(6deg)`,  offset: 0.62 },
                { transform: `${base} translateY(-5px) rotate(-5deg)` }
            ], {
                duration: 2100 + Math.random() * 500,
                iterations: Infinity,
                easing: 'ease-in-out'
            });

            return wrapper;
        }

        container.appendChild(createWing(false)); // right wing
        container.appendChild(createWing(true));  // left wing (mirrored)

        // === HORNS ===
        // Snapchat-style: compact upright horns, thick convex outer edge,
        // tip leaning slightly outward — NOT a sweeping C-curve, just a lean.
        // Separate explicit paths per side to avoid mirroring positioning issues.
        function createHorn(side) {
            const wrapper = document.createElement('div');
            // Positioned at the top corners: 10% in from each edge, partially overlapping
            // the top of the avatar so they look grown-in rather than floating.
            wrapper.style.cssText = `
                position: absolute; pointer-events: none;
                width: 26px; height: 38px;
                top: -14%;
                ${side === 'right' ? 'right: 10%;' : 'left: 10%;'}
            `;

            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('viewBox', '0 0 26 38');
            svg.style.cssText = 'width: 100%; height: 100%; overflow: visible;';

            const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
            const gradId = `horn-grad-${side}`;
            const grad = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
            grad.setAttribute('id', gradId);
            // Gradient runs bottom (base) to top (tip)
            grad.setAttribute('x1', '50%'); grad.setAttribute('y1', '100%');
            grad.setAttribute('x2', '60%'); grad.setAttribute('y2', '0%');
            [
                ['0%',   'rgba(255,100,5,0.99)'],   // hot orange at base
                ['40%',  'rgba(210,16,6,0.97)'],    // rich red body
                ['100%', 'rgba(38,2,2,0.92)'],      // near-black tip
            ].forEach(([offset, color]) => {
                const stop = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
                stop.setAttribute('offset', offset);
                stop.setAttribute('stop-color', color);
                grad.appendChild(stop);
            });
            defs.appendChild(grad);
            svg.appendChild(defs);

            // Each horn is an upright spike with a slight outward lean and a defined
            // convex outer curve — the inner edge has a subtle concave pull toward center.
            //
            // RIGHT horn: base spans x=2..20, tip at x=18 (leans right ~15°)
            //   Inner (left) edge: starts at (2,36), control pts pull slightly left then
            //     sweep to tip — creates a gentle inward concave
            //   Outer (right) edge: strong convex bulge rightward before descending
            //
            // LEFT horn: exact horizontal mirror with its own explicit coordinates
            const hornPath = side === 'right'
                ? 'M 2,36 C 1,22 10,7 18,1 C 26,9 25,24 20,36 Z'
                : 'M 24,36 C 25,22 16,7 8,1 C 0,9 1,24 6,36 Z';

            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', hornPath);
            path.setAttribute('fill', `url(#${gradId})`);
            path.setAttribute('stroke', 'rgba(255,50,0,0.25)');
            path.setAttribute('stroke-width', '0.6');
            path.setAttribute('stroke-linejoin', 'round');
            svg.appendChild(path);

            wrapper.appendChild(svg);

            // Pulse glow — like molten heat radiating from the horn base
            wrapper.animate([
                { filter: 'drop-shadow(0 0 4px rgba(255,65,0,0.85))  drop-shadow(0 0 10px rgba(170,12,0,0.5))'  },
                { filter: 'drop-shadow(0 0 9px rgba(255,120,0,1.0))  drop-shadow(0 0 20px rgba(210,30,0,0.85))' },
                { filter: 'drop-shadow(0 0 4px rgba(255,65,0,0.85))  drop-shadow(0 0 10px rgba(170,12,0,0.5))'  },
            ], { duration: 1600 + Math.random() * 600, iterations: Infinity, easing: 'ease-in-out' });

            return wrapper;
        }

        container.appendChild(createHorn('left'));
        container.appendChild(createHorn('right'));

        // === INTERVAL: Particle effects ===
        let tickCount = 0;

        const interval = setInterval(() => {
            tickCount++;

            // Hellfire embers rising from the base — red, orange, near-black
            const size = Math.random() * 18 + 8;
            const r = Math.random();
            const emberColor = r < 0.3  ? 'rgba(255,80,0,0.75)'
                             : r < 0.6  ? 'rgba(200,20,0,0.8)'
                             : r < 0.85 ? 'rgba(255,140,0,0.6)'
                             :             'rgba(70,0,0,0.75)';

            const ember = document.createElement('div');
            ember.style.cssText = `
                position: absolute; pointer-events: none;
                width: ${size}px; height: ${size}px;
                border-radius: 50%;
                background: ${emberColor};
                filter: blur(6px);
                mix-blend-mode: screen;
                left: ${20 + Math.random() * 60}%;
                top: 92%;
            `;
            container.appendChild(ember);

            const ex = (Math.random() * 30 - 15) + 'px';
            const ey = -(Math.random() * 75 + 55) + 'px';
            ember.animate([
                { transform: 'translate(0,0) scale(1)', opacity: 0.85 },
                { transform: `translate(${ex}, ${ey}) scale(0.1)`, opacity: 0 }
            ], { duration: 450 + Math.random() * 400, easing: 'ease-in' })
            .onfinish = () => ember.remove();

            // Dark smoke wisps — creep up the sides, multiply-blended for a shadowy look
            if (tickCount % 4 === 0) {
                const smoke = document.createElement('div');
                const smokeSize = Math.random() * 32 + 22;
                const spawnLeft = Math.random() > 0.5 ? (Math.random() * 28) : (72 + Math.random() * 28);
                smoke.style.cssText = `
                    position: absolute; pointer-events: none;
                    width: ${smokeSize}px; height: ${smokeSize}px;
                    border-radius: 50%;
                    background: rgba(15, 0, 0, 0.6);
                    filter: blur(14px);
                    mix-blend-mode: multiply;
                    left: ${spawnLeft}%;
                    top: ${58 + Math.random() * 35}%;
                `;
                container.appendChild(smoke);

                const sdx = (Math.random() * 18 - 9) + 'px';
                const sdy = -(Math.random() * 55 + 30) + 'px';
                smoke.animate([
                    { transform: 'translate(0,0) scale(0.5)', opacity: 0 },
                    { transform: `translate(${sdx}, ${sdy}) scale(1)`,   opacity: 0.75, offset: 0.3 },
                    { transform: `translate(${sdx}, ${sdy}) scale(1.4)`, opacity: 0 }
                ], { duration: 1100 + Math.random() * 900, easing: 'ease-out' })
                .onfinish = () => smoke.remove();
            }

            // Shadow tendrils — short dark fingers reaching up at the edges
            if (tickCount % 25 === 0) {
                const tendril = document.createElement('div');
                const tSide = Math.random() > 0.5 ? (Math.random() * 18) : (82 + Math.random() * 18);
                const tH = Math.random() * 22 + 14;
                tendril.style.cssText = `
                    position: absolute; pointer-events: none;
                    width: ${tH * 0.38}px; height: ${tH}px;
                    border-radius: 40% 40% 0 0;
                    background: rgba(25, 0, 0, 0.75);
                    filter: blur(5px);
                    mix-blend-mode: multiply;
                    left: ${tSide}%;
                    top: ${68 + Math.random() * 25}%;
                    transform-origin: bottom center;
                `;
                container.appendChild(tendril);

                const rot = (Math.random() * 40 - 20) + 'deg';
                tendril.animate([
                    { transform: `rotate(${rot}) scaleY(0)`, opacity: 0 },
                    { transform: `rotate(${rot}) scaleY(1)`, opacity: 0.85, offset: 0.4 },
                    { transform: `rotate(${rot}) scaleY(1.4) translateY(-8px)`, opacity: 0 }
                ], { duration: 700 + Math.random() * 600, easing: 'ease-out' })
                .onfinish = () => tendril.remove();
            }

            // Hellfire pulse ring — crimson shockwave radiating outward (~every 2s)
            if (tickCount % 50 === 0) {
                const ring = document.createElement('div');
                ring.style.cssText = `
                    position: absolute; pointer-events: none;
                    left: 50%; top: 50%;
                    width: 90px; height: 90px;
                    margin-left: -45px; margin-top: -45px;
                    border-radius: 50%;
                    border: 2px solid rgba(220, 30, 0, 0.9);
                    box-shadow: 0 0 14px rgba(200,20,0,0.7), inset 0 0 8px rgba(255,60,0,0.3);
                    mix-blend-mode: screen;
                `;
                container.appendChild(ring);
                ring.animate([
                    { transform: 'scale(0.4)', opacity: 0.9 },
                    { transform: 'scale(3.0)', opacity: 0 }
                ], { duration: 1500, easing: 'ease-out' })
                .onfinish = () => ring.remove();
            }

        }, 40);

        return interval;
    }
};
