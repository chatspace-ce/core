module.exports = {
    name: "Celestial Cycle",
    render: function(container) {
        const orbitDuration = 16000; // 16 seconds for a full day/night cycle

        // --- 1. SETUP THE SUN ---
        const sunOrbit = document.createElement('div');
        sunOrbit.style.position = 'absolute';
        sunOrbit.style.inset = '0'; // Fills container
        sunOrbit.style.pointerEvents = 'none';
        sunOrbit.style.zIndex = '120';

        const sun = document.createElement('div');
        sun.style.position = 'absolute';
        sun.style.top = '-40px'; // Distance from center
        sun.style.left = '50%';
        sun.style.width = '45px';
        sun.style.height = '45px';
        sun.style.marginLeft = '-22.5px';
        sun.style.borderRadius = '50%';
        sun.style.background = 'radial-gradient(circle, #fff 0%, #FFDF00 40%, #FF8C00 100%)';
        sun.style.boxShadow = '0 0 30px #FFDF00, 0 0 60px #FF8C00';
        sunOrbit.appendChild(sun);
        container.appendChild(sunOrbit);

        // --- 2. SETUP THE MOON ---
        const moonOrbit = document.createElement('div');
        moonOrbit.style.position = 'absolute';
        moonOrbit.style.inset = '0';
        moonOrbit.style.pointerEvents = 'none';
        moonOrbit.style.zIndex = '120';

        const moon = document.createElement('div');
        moon.style.position = 'absolute';
        moon.style.bottom = '-40px'; // Opposite side of orbit
        moon.style.left = '50%';
        moon.style.width = '35px';
        moon.style.height = '35px';
        moon.style.marginLeft = '-17.5px';
        moon.style.borderRadius = '50%';
        // Pure CSS Crescent Moon!
        moon.style.boxShadow = 'inset -8px -8px 0 0 #e4e4e7, 0 0 20px rgba(139, 92, 246, 0.6)';
        moon.style.transform = 'rotate(45deg)'; // Tilt the crescent
        moonOrbit.appendChild(moon);
        container.appendChild(moonOrbit);

        // --- ORBIT ANIMATIONS ---
        // The orbits rotate 360 degrees. To stop the sun/moon from spinning upside down,
        // they get a simultaneous counter-rotation animation!
        sunOrbit.animate([ { transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' } ], { duration: orbitDuration, iterations: Infinity });
        sun.animate([ { transform: 'rotate(0deg)' }, { transform: 'rotate(-360deg)' } ], { duration: orbitDuration, iterations: Infinity });

        moonOrbit.animate([ { transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' } ], { duration: orbitDuration, iterations: Infinity });
        moon.animate([ { transform: 'rotate(-45deg)' }, { transform: 'rotate(-405deg)' } ], { duration: orbitDuration, iterations: Infinity });

        // --- 3. DYNAMIC PARTICLES (Stars & Sunbeams) ---
        const startTime = Date.now();

        const interval = setInterval(() => {
            const elapsed = (Date.now() - startTime) % orbitDuration;
            const isDay = elapsed < (orbitDuration / 2); // First 8 seconds is Day

            const particle = document.createElement('div');
            particle.style.position = 'absolute';
            particle.style.pointerEvents = 'none';
            particle.style.zIndex = '90';

            if (isDay) {
                // DAY PHASE: Golden Light Motes floating outward
                particle.style.width = '4px';
                particle.style.height = '4px';
                particle.style.background = '#FFDF00';
                particle.style.boxShadow = '0 0 10px #FFDF00';
                particle.style.borderRadius = '50%';
                particle.style.left = '50%';
                particle.style.top = '50%';
                container.appendChild(particle);

                const angle = Math.random() * Math.PI * 2;
                const distance = 80 + Math.random() * 40;
                const destX = Math.cos(angle) * distance + 'px';
                const destY = Math.sin(angle) * distance + 'px';

                const anim = particle.animate([
                    { transform: 'translate(0,0) scale(0)', opacity: 1 },
                    { transform: `translate(${destX}, ${destY}) scale(1.5)`, opacity: 0 }
                ], { duration: 1500 + Math.random() * 1000, easing: 'ease-out' });
                anim.onfinish = () => particle.remove();

            } else {
                // NIGHT PHASE: Twinkling Stars appearing in the background
                particle.innerText = '✦';
                particle.style.color = Math.random() > 0.5 ? '#e4e4e7' : '#06b6d4';
                particle.style.fontSize = (Math.random() * 10 + 8) + 'px';
                particle.style.filter = 'drop-shadow(0 0 5px #fff)';
                particle.style.left = (Math.random() * 140 - 20) + '%';
                particle.style.top = (Math.random() * 140 - 20) + '%';
                container.appendChild(particle);

                const anim = particle.animate([
                    { opacity: 0, transform: 'scale(0.5)' },
                    { opacity: 1, transform: 'scale(1.2)', offset: 0.5 },
                    { opacity: 0, transform: 'scale(0.8)' }
                ], { duration: 2000 + Math.random() * 2000, easing: 'ease-in-out' });
                anim.onfinish = () => particle.remove();
            }
        }, 80); // Spawn particles every 80ms

        return interval;
    }
};