module.exports = {
    name: "Independence Pro",
    render: function(container) {
        // --- HIGH-FIDELITY ASSETS ---
        const usaFlagURI = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA3NDEwIDM5MDAiPjxyZWN0IHdpZHRoPSI3NDEwIiBoZWlnaHQ9IjM5MDAiIGZpbGw9IiNiMjIyMzQiLz48ZyBmaWxsPSIjZmZmIj48cmVjdCB5PSIwIiB3aWR0aD0iNzQxMCIgaGVpZ2h0PSIzMDAiLz48cmVjdCB5PSI2MDAiIHdpZHRoPSI3NDEwIiBoZWlnaHQ9IjMwMCIvPjxyZWN0IHk9IjEyMDAiIHdpZHRoPSI3NDEwIiBoZWlnaHQ9IjMwMCIvPjxyZWN0IHk9IjE4MDAiIHdpZHRoPSI3NDEwIiBoZWlnaHQ9IjMwMCIvPjxyZWN0IHk9IjI0MDAiIHdpZHRoPSI3NDEwIiBoZWlnaHQ9IjMwMCIvPjxyZWN0IHk9IjMwMDAiIHdpZHRoPSI3NDEwIiBoZWlnaHQ9IjMwMCIvPjxyZWN0IHk9IjM2MDAiIHdpZHRoPSI3NDEwIiBoZWlnaHQ9IjMwMCIvPjwvZz48cmVjdCB3aWR0aD0iMjk2NCIgaGVpZ2h0PSIyMTAwIiBmaWxsPSIjM2MzYjZlIi8+PGcgZmlsbD0iI2ZmZiI+PHBhdHRlcm4gaWQ9InMiIHdpZHRoPSI0OTQiIGhlaWdodD0iNDIwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48ZyB0cmFuc2Zvcm09InRyYW5zbGF0ZSgyNDcsMjEwKSI+PHBvbHlnb24gcG9pbnRzPSIwLC0xMjIgMzYsLTQ4IDExNiwtNDggNTIsMSAxNiwyMyAwLDk4IC0xNiwyMyAtNTIsMSAtMTE2LC00OCAtMzYsLTQ4Ii8+PC9nPjwvcGF0dGVybj48cmVjdCB3aWR0aD0iMjk2NCIgaGVpZ2h0PSIyMTAwIiBmaWxsPSJ1cmwoI3MpIi8+PHJlY3QgeD0iMjQ3IiB5PSIyMTAiIHdpZHRoPSIyNDcwIiBoZWlnaHQ9IjE2ODAiIGZpbGw9InVybCgNcykiLz48L2c+PC9zdmc+";

        // Allow explosions to bleed significantly outside the avatar box
        container.style.inset = '-60px';
        container.style.zIndex = '105';

        // --- LAYER 0: ATMOSPHERIC AMBIENT GLOW ---
        const backdrop = document.createElement('div');
        backdrop.style.position = 'absolute';
        backdrop.style.inset = '30px';
        backdrop.style.borderRadius = '50%';
        backdrop.style.background = 'radial-gradient(circle at center, rgba(255,0,0,0.1) 0%, rgba(255,255,255,0.05) 50%, rgba(0,0,255,0.1) 100%)';
        backdrop.style.filter = 'blur(20px)';
        backdrop.style.pointerEvents = 'none';
        backdrop.style.zIndex = '90';
        container.appendChild(backdrop);

        backdrop.animate([
            { transform: 'scale(0.8)', opacity: 0.5 },
            { transform: 'scale(1.1)', opacity: 1 },
            { transform: 'scale(0.8)', opacity: 0.5 }
        ], { duration: 5000, iterations: Infinity, easing: 'ease-in-out' });

        // --- LAYER 1: 3D FOREGROUND FLAGS ---
        const createFlag = (isLeft) => {
            const flagWrapper = document.createElement('div');
            flagWrapper.style.position = 'absolute';
            flagWrapper.style.width = '85px';
            flagWrapper.style.height = '55px';
            flagWrapper.style.bottom = '25px';
            flagWrapper.style.zIndex = '120';
            flagWrapper.style.filter = 'drop-shadow(0 15px 20px rgba(0,0,0,0.9))';

            if (isLeft) {
                flagWrapper.style.left = '20px';
                flagWrapper.style.transformOrigin = 'bottom left';
            } else {
                flagWrapper.style.right = '20px';
                flagWrapper.style.transformOrigin = 'bottom right';
            }

            const flagImg = document.createElement('div');
            flagImg.style.width = '100%';
            flagImg.style.height = '100%';
            flagImg.style.backgroundImage = `url(${usaFlagURI})`;
            flagImg.style.backgroundSize = 'cover';
            flagImg.style.backgroundPosition = 'center';
            flagImg.style.borderRadius = '5px';
            flagImg.style.border = '1px solid rgba(255,255,255,0.4)';
            flagImg.style.overflow = 'hidden';
            flagImg.style.position = 'relative';

            // Fabric Shimmer
            const shimmer = document.createElement('div');
            shimmer.style.position = 'absolute';
            shimmer.style.inset = '0';
            shimmer.style.background = 'linear-gradient(110deg, transparent 0%, rgba(255,255,255,0.5) 50%, transparent 100%)';
            shimmer.style.backgroundSize = '200% 100%';
            flagImg.appendChild(shimmer);

            flagWrapper.appendChild(flagImg);
            container.appendChild(flagWrapper);

            const baseRot = isLeft ? -20 : 20;
            const waveRot = isLeft ? -6 : 6;

            flagWrapper.animate([
                { transform: `rotate(${baseRot}deg) skewY(${isLeft ? -3 : 3}deg)` },
                { transform: `rotate(${baseRot + waveRot}deg) skewY(${isLeft ? 5 : -5}deg)` },
                { transform: `rotate(${baseRot}deg) skewY(${isLeft ? -3 : 3}deg)` }
            ], { duration: 2500, iterations: Infinity, easing: 'ease-in-out', delay: isLeft ? 0 : 400 });

            shimmer.animate([
                { backgroundPosition: '200% 0' },
                { backgroundPosition: '-200% 0' }
            ], { duration: 2500, iterations: Infinity, easing: 'ease-in-out', delay: isLeft ? 0 : 400 });
        };

        createFlag(true);
        createFlag(false);

        // --- LAYER 2: ADVANCED FIREWORKS ENGINE ---
        const colors = ['#ff3b30', '#ffffff', '#007aff', '#ffcc00'];

        const launchFirework = () => {
            const startX = (Math.random() * 80 + 10) + '%';
            const targetY = -(Math.random() * 90 + 50); // High explosions

            // Core color and optional secondary color for double-rings
            const colorA = colors[Math.floor(Math.random() * colors.length)];
            let colorB = colors[Math.floor(Math.random() * colors.length)];
            const isDoubleRing = Math.random() > 0.6; // 40% chance of a massive double explosion

            const isForeground = Math.random() > 0.4;
            const zIndex = isForeground ? '115' : '85';

            // 1. The Rocket Trail
            const rocket = document.createElement('div');
            rocket.style.position = 'absolute';
            rocket.style.width = '3px';
            rocket.style.height = '25px';
            rocket.style.background = 'linear-gradient(to top, transparent, #fff)';
            rocket.style.borderRadius = '10px';
            rocket.style.boxShadow = `0 0 15px ${colorA}`;
            rocket.style.left = startX;
            rocket.style.bottom = '15%';
            rocket.style.zIndex = zIndex;
            container.appendChild(rocket);

            const launchAnim = rocket.animate([
                { transform: 'translateY(0) scaleY(1)', opacity: 1 },
                { transform: `translateY(${targetY}px) scaleY(0.5)`, opacity: 0 }
            ], { duration: 600 + Math.random() * 200, easing: 'ease-out' });

            launchAnim.onfinish = () => {
                rocket.remove();

                const burstRect = rocket.getBoundingClientRect();
                const containerRect = container.getBoundingClientRect();
                const originX = burstRect.left - containerRect.left;
                const originY = burstRect.top - containerRect.top + targetY;

                // 2. Illumination Flash (Lights up the avatar environment)
                const flash = document.createElement('div');
                flash.style.position = 'absolute';
                flash.style.width = '150px';
                flash.style.height = '150px';
                flash.style.background = `radial-gradient(circle, ${colorA} 0%, transparent 70%)`;
                flash.style.left = (originX - 75) + 'px';
                flash.style.top = (originY - 75) + 'px';
                flash.style.zIndex = zIndex;
                flash.style.pointerEvents = 'none';
                flash.style.mixBlendMode = 'screen';
                container.appendChild(flash);

                const flashAnim = flash.animate([
                    { transform: 'scale(0.5)', opacity: 0.8 },
                    { transform: 'scale(2)', opacity: 0 }
                ], { duration: 400, easing: 'ease-out' });
                flashAnim.onfinish = () => flash.remove();

                // 3. The Particle Explosion
                const particleCount = isDoubleRing ? 36 : 24;

                for (let i = 0; i < particleCount; i++) {
                    const spark = document.createElement('div');
                    spark.style.position = 'absolute';
                    spark.style.width = '6px';
                    spark.style.height = '6px';
                    spark.style.borderRadius = '50%';

                    // Determine if this particle is inner ring or outer ring
                    const isInner = isDoubleRing && i % 2 === 0;
                    const pColor = isInner ? colorB : colorA;

                    spark.style.background = Math.random() > 0.2 ? pColor : '#ffffff';
                    spark.style.boxShadow = `0 0 12px ${spark.style.background}, 0 0 25px ${spark.style.background}`;
                    spark.style.left = originX + 'px';
                    spark.style.top = originY + 'px';
                    spark.style.zIndex = zIndex;
                    container.appendChild(spark);

                    const angleStr = (i * (360 / particleCount));
                    const angleRad = angleStr * (Math.PI / 180);

                    // Inner ring travels less distance
                    const baseDist = isInner ? 40 : 80;
                    const distance = baseDist + Math.random() * 30;

                    const tx = Math.cos(angleRad) * distance;
                    const ty = Math.sin(angleRad) * distance;

                    // Streaking effect: Stretches the particle along its path
                    const rot = angleStr + 'deg';

                    const sparkAnim = spark.animate([
                        // Explode outward (stretched)
                        { transform: `translate(0, 0) rotate(${rot}) scaleX(3) scaleY(0.5)`, opacity: 1 },
                        // Hit apex (rounds out)
                        { transform: `translate(${tx * 0.9}px, ${ty * 0.9}px) rotate(${rot}) scaleX(1) scaleY(1)`, opacity: 0.9, offset: 0.5 },
                        // Gravity takes over, falls and burns out
                        { transform: `translate(${tx}px, ${ty + 60}px) rotate(${rot}) scale(0)`, opacity: 0 }
                    ], {
                        duration: 1200 + Math.random() * 600,
                        easing: 'cubic-bezier(0.1, 1, 0.2, 1)'
                    });

                    sparkAnim.onfinish = () => spark.remove();
                }
            };
        };

        // Engine Loop
        let tickCount = 0;
        const interval = setInterval(() => {
            tickCount++;

            // Ambient floating sparklers
            if (tickCount % 15 === 0) {
                const star = document.createElement('div');
                star.style.position = 'absolute';
                star.style.width = '4px';
                star.style.height = '4px';
                star.style.background = '#fff';
                star.style.borderRadius = '50%';
                star.style.boxShadow = '0 0 10px #fff, 0 0 20px #ffcc00';
                star.style.left = (Math.random() * 100) + '%';
                star.style.bottom = '-10%';
                star.style.zIndex = '110';
                container.appendChild(star);

                const driftX = (Math.random() * 80 - 40) + 'px';

                const anim = star.animate([
                    { transform: 'translate(0, 0) scale(0)', opacity: 0 },
                    { transform: `translate(${driftX}, -150px) scale(1)`, opacity: 0.8, offset: 0.5 },
                    { transform: `translate(${driftX * 2}, -300px) scale(0)`, opacity: 0 }
                ], { duration: 2500 + Math.random() * 2000, easing: 'ease-in-out' });

                anim.onfinish = () => star.remove();
            }

            // Launch Controller (Occasional Barrages)
            if (tickCount % 70 === 0) {
                launchFirework(); // Always launch at least 1

                // 30% chance to launch a barrage of 2 or 3!
                if (Math.random() > 0.7) {
                    setTimeout(launchFirework, 200);
                    if (Math.random() > 0.5) setTimeout(launchFirework, 450);
                }
            }

        }, 30);

        return interval;
    }
};