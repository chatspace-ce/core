module.exports = {
    name: "Epic Birthday",
    render: function(container) {
        // Allow elements to bleed well outside the avatar frame for huge explosions
        container.style.inset = '-60px';
        container.style.zIndex = '105';
        // Ensure 3D transforms look correct
        container.style.perspective = '800px';

        // --- LAYER 0: FESTIVE AMBIENT GLOW ---
        const backdrop = document.createElement('div');
        backdrop.style.position = 'absolute';
        backdrop.style.inset = '20px';
        backdrop.style.borderRadius = '50%';
        backdrop.style.background = 'radial-gradient(circle at center, rgba(255, 215, 0, 0.15) 0%, rgba(255, 45, 85, 0.1) 50%, rgba(0, 199, 190, 0.05) 100%)';
        backdrop.style.filter = 'blur(15px)';
        backdrop.style.pointerEvents = 'none';
        backdrop.style.zIndex = '90';
        container.appendChild(backdrop);

        backdrop.animate([
            { transform: 'scale(0.8)', opacity: 0.6, filter: 'blur(15px) hue-rotate(0deg)' },
            { transform: 'scale(1.1)', opacity: 1, filter: 'blur(25px) hue-rotate(90deg)' },
            { transform: 'scale(0.8)', opacity: 0.6, filter: 'blur(15px) hue-rotate(0deg)' }
        ], { duration: 6000, iterations: Infinity, easing: 'ease-in-out' });

        const colors = ['#FF2D55', '#5856D6', '#FF9500', '#34C759', '#00C7BE', '#AF52DE', '#FFD700'];

        // --- THE CSS BALLOON GENERATOR ---
        const createBalloon = () => {
            const isForeground = Math.random() > 0.4; // 60% front, 40% back
            const bColor = colors[Math.floor(Math.random() * colors.length)];

            const wrapper = document.createElement('div');
            wrapper.style.position = 'absolute';
            wrapper.style.zIndex = isForeground ? '120' : '95';
            wrapper.style.left = (Math.random() * 80 + 10) + '%';
            wrapper.style.bottom = '-30%';
            wrapper.style.pointerEvents = 'none';

            // The Balloon Body (Realistic Volume via CSS)
            const balloon = document.createElement('div');
            balloon.style.width = (Math.random() * 15 + 35) + 'px';
            balloon.style.height = (parseFloat(balloon.style.width) * 1.3) + 'px';
            balloon.style.backgroundColor = bColor;
            balloon.style.borderRadius = '80% 80% 80% 80% / 100% 100% 40% 40%';
            balloon.style.boxShadow = `inset -5px -5px 15px rgba(0,0,0,0.2), inset 10px 10px 10px rgba(255,255,255,0.4), 0 10px 15px rgba(0,0,0,0.3)`;
            balloon.style.position = 'relative';

            // The little knot at the bottom
            const knot = document.createElement('div');
            knot.style.position = 'absolute';
            knot.style.bottom = '-4px';
            knot.style.left = '50%';
            knot.style.transform = 'translateX(-50%)';
            knot.style.width = '0';
            knot.style.height = '0';
            knot.style.borderLeft = '4px solid transparent';
            knot.style.borderRight = '4px solid transparent';
            knot.style.borderBottom = `6px solid ${bColor}`;
            knot.style.filter = 'brightness(0.8)';
            balloon.appendChild(knot);

            // The string
            const string = document.createElement('div');
            string.style.position = 'absolute';
            string.style.bottom = '-40px';
            string.style.left = '50%';
            string.style.width = '1px';
            string.style.height = '40px';
            string.style.background = 'linear-gradient(to bottom, rgba(255,255,255,0.6), transparent)';
            string.style.transformOrigin = 'top center';
            balloon.appendChild(string);

            wrapper.appendChild(balloon);
            container.appendChild(wrapper);

            // Balloon Physics: Drift up, sway side to side, and tilt
            const endY = -(Math.random() * 100 + 250); // How high it floats
            const swayX = (Math.random() * 100 - 50); // Horizontal drift
            const rot = (Math.random() * 30 - 15); // Tilt angle

            const floatAnim = wrapper.animate([
                { transform: `translate(0px, 0px) rotate(0deg) scale(0.8)`, opacity: 0 },
                { transform: `translate(${swayX * 0.3}px, ${endY * 0.3}px) rotate(${rot}deg) scale(1)`, opacity: 0.9, offset: 0.3 },
                { transform: `translate(${swayX}px, ${endY}px) rotate(${rot * 2}deg) scale(1.1)`, opacity: 0 }
            ], { duration: 4000 + Math.random() * 3000, easing: 'ease-in-out' });

            // Make the string wave independently
            string.animate([
                { transform: 'rotate(-10deg)' },
                { transform: 'rotate(10deg)' },
                { transform: 'rotate(-10deg)' }
            ], { duration: 1500 + Math.random() * 1000, iterations: Infinity, easing: 'ease-in-out' });

            floatAnim.onfinish = () => wrapper.remove();
        };

        // --- THE CONFETTI CANNON ENGINE ---
        const fireConfettiCannon = (isLeft) => {
            const particleCount = 25;
            const originX = isLeft ? 10 : container.offsetWidth - 10;
            const originY = container.offsetHeight - 10;

            for (let i = 0; i < particleCount; i++) {
                const conf = document.createElement('div');
                conf.style.position = 'absolute';
                // Randomly choose rectangles or circles
                const isCircle = Math.random() > 0.5;
                conf.style.width = (Math.random() * 6 + 4) + 'px';
                conf.style.height = isCircle ? conf.style.width : (Math.random() * 8 + 6) + 'px';
                conf.style.borderRadius = isCircle ? '50%' : '2px';
                conf.style.background = colors[Math.floor(Math.random() * colors.length)];
                conf.style.left = originX + 'px';
                conf.style.top = originY + 'px';
                conf.style.zIndex = Math.random() > 0.5 ? '115' : '95';
                conf.style.pointerEvents = 'none';
                container.appendChild(conf);

                // Math for the Cannon Cone (Shooting inward and up)
                // If left cannon, shoot right (angle 20 to 70). If right, shoot left (angle 110 to 160).
                const angleDeg = isLeft ? (Math.random() * 50 + 20) : (Math.random() * 50 + 110);
                const angleRad = angleDeg * (Math.PI / 180);
                const velocity = Math.random() * 120 + 80;

                const tx = Math.cos(angleRad) * velocity;
                const ty = -(Math.sin(angleRad) * velocity); // Negative because Y goes up

                // 3D Flutter physics
                const rotX = Math.random() * 1080;
                const rotY = Math.random() * 1080;
                const rotZ = Math.random() * 360;

                const anim = conf.animate([
                    // Explode out
                    { transform: `translate(0, 0) rotate3d(0,0,0,0deg)`, opacity: 1 },
                    // Hit apex (Slows down)
                    { transform: `translate(${tx}px, ${ty}px) rotate3d(1, 1, 0, ${rotX/2}deg)`, opacity: 1, offset: 0.4 },
                    // Flutter down with gravity (Drift further X, fall down Y)
                    { transform: `translate(${tx + (isLeft ? 30 : -30)}px, ${ty + 150}px) rotate3d(1, 1, 1, ${rotX}deg)`, opacity: 0 }
                ], {
                    duration: 2000 + Math.random() * 1500,
                    easing: 'cubic-bezier(0.1, 1, 0.3, 1)'
                });

                anim.onfinish = () => conf.remove();
            }
        };

        // --- MAIN ENGINE LOOP ---
        let tickCount = 0;
        const interval = setInterval(() => {
            tickCount++;

            // 1. Ambient Sparkles/Glitter falling from top
            if (tickCount % 10 === 0) {
                const glitter = document.createElement('div');
                glitter.style.position = 'absolute';
                glitter.innerText = '✨';
                glitter.style.fontSize = (Math.random() * 10 + 8) + 'px';
                glitter.style.left = (Math.random() * 120 - 10) + '%';
                glitter.style.top = '-20%';
                glitter.style.zIndex = '110';
                glitter.style.pointerEvents = 'none';
                container.appendChild(glitter);

                const driftX = (Math.random() * 60 - 30) + 'px';

                const anim = glitter.animate([
                    { transform: 'translate(0, 0) rotate(0deg) scale(0)', opacity: 0 },
                    { transform: `translate(${driftX}, 150px) rotate(180deg) scale(1)`, opacity: 0.8, offset: 0.5 },
                    { transform: `translate(${driftX}, 300px) rotate(360deg) scale(0)`, opacity: 0 }
                ], { duration: 3000 + Math.random() * 2000, easing: 'linear' });

                anim.onfinish = () => glitter.remove();
            }

            // 2. Spawn Balloons (Every ~1.5 seconds)
            if (tickCount % 50 === 0) {
                createBalloon();
            }

            // 3. Fire Confetti Cannons (Every ~3.6 seconds)
            if (tickCount % 120 === 0) {
                // Fire left, right, or both!
                const r = Math.random();
                if (r > 0.6) {
                    fireConfettiCannon(true);
                    fireConfettiCannon(false);
                } else if (r > 0.3) {
                    fireConfettiCannon(true);
                } else {
                    fireConfettiCannon(false);
                }
            }

        }, 30);

        // Initial burst on load to make it instantly epic
        setTimeout(() => {
            fireConfettiCannon(true);
            fireConfettiCannon(false);
            createBalloon();
            createBalloon();
        }, 100);

        return interval;
    }
};