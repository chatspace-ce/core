module.exports = {
    name: "Heavy Rain",
    render: function(container) {
        // --- 1. SETUP THE BASE PUDDLE ---
        const puddle = document.createElement('div');
        puddle.style.position = 'absolute';
        puddle.style.bottom = '15px'; // Sits at the bottom of the aura container
        puddle.style.left = '15%';
        puddle.style.width = '70%'; // Wide oval shape
        puddle.style.height = '30px';
        puddle.style.borderRadius = '50%'; // Makes it an ellipse
        puddle.style.background = 'rgba(100, 150, 255, 0.15)'; // Watery tint
        puddle.style.boxShadow = 'inset 0 0 10px rgba(255, 255, 255, 0.4), 0 5px 15px rgba(50, 100, 255, 0.3)';
        puddle.style.pointerEvents = 'none';
        puddle.style.zIndex = '100'; // Under the rain
        container.appendChild(puddle);

        let tickCount = 0;

        // --- 2. MAIN RAIN LOOP ---
        const interval = setInterval(() => {
            tickCount++;

            // --- A. SPAWN RAINDROPS ---
            const drop = document.createElement('div');
            drop.style.position = 'absolute';
            drop.style.pointerEvents = 'none';
            drop.style.zIndex = '110';

            // Motion-blurred raindrop shape
            const width = Math.random() < 0.2 ? 2 : 1; // Occasional thick drops
            const height = Math.random() * 30 + 30; // 30px to 60px long streaks
            drop.style.width = width + 'px';
            drop.style.height = height + 'px';
            drop.style.background = 'linear-gradient(to bottom, rgba(255,255,255,0), rgba(180,220,255,0.8))';
            drop.style.borderRadius = '50%';

            // Random start position (wider than container to account for slant)
            const startX = (Math.random() * 140) - 20;
            drop.style.left = startX + '%';
            drop.style.top = '-20%';

            container.appendChild(drop);

            // Falling animation (Slight right-to-left slant)
            const fallDuration = 250 + Math.random() * 150; // Super fast!
            const fallAnim = drop.animate([
                { transform: 'translate(0px, 0px) rotate(5deg)', opacity: 0.8 },
                { transform: `translate(-15px, 250px) rotate(5deg)`, opacity: 0 } // Falls down and slightly left
            ], {
                duration: fallDuration,
                easing: 'linear'
            });

            // --- B. SPAWN SPLASHES & RIPPLES ON IMPACT ---
            fallAnim.onfinish = () => {
                drop.remove();

                // Only spawn splashes for SOME drops to save performance & look realistic
                if (Math.random() > 0.4) {
                    // Create 2-3 tiny splash droplets
                    const splashCount = Math.floor(Math.random() * 2) + 2;
                    for(let i = 0; i < splashCount; i++) {
                        const splash = document.createElement('div');
                        splash.style.position = 'absolute';
                        splash.style.pointerEvents = 'none';
                        splash.style.width = '2px';
                        splash.style.height = '2px';
                        splash.style.background = 'rgba(200, 230, 255, 0.9)';
                        splash.style.borderRadius = '50%';
                        splash.style.left = `calc(${startX}% - 15px)`; // Matches where the drop landed
                        splash.style.bottom = (20 + Math.random() * 10) + 'px'; // Random height in puddle
                        splash.style.zIndex = '115';
                        container.appendChild(splash);

                        // Physics-like bounce (up and out)
                        const bounceX = (Math.random() * 30 - 15) + 'px';
                        const bounceY = -(Math.random() * 20 + 10) + 'px';

                        const splashAnim = splash.animate([
                            { transform: 'translate(0, 0)', opacity: 1 },
                            { transform: `translate(${bounceX}, ${bounceY})`, opacity: 0.8, offset: 0.5 },
                            { transform: `translate(${bounceX}, 5px)`, opacity: 0 } // Gravity pulls it back down
                        ], {
                            duration: 300 + Math.random() * 200,
                            easing: 'cubic-bezier(0.25, 1, 0.5, 1)' // Decelerates going up
                        });
                        splashAnim.onfinish = () => splash.remove();
                    }
                }
            };

            // --- C. SPAWN RIPPLES IN THE PUDDLE (Every ~4th tick) ---
            if (tickCount % 4 === 0) {
                const ripple = document.createElement('div');
                ripple.style.position = 'absolute';
                ripple.style.pointerEvents = 'none';
                ripple.style.border = '1px solid rgba(255, 255, 255, 0.6)';
                ripple.style.borderRadius = '50%';
                ripple.style.width = '30px';
                ripple.style.height = '10px';
                ripple.style.left = (Math.random() * 60 + 20) + '%'; // Keep inside puddle
                ripple.style.bottom = (15 + Math.random() * 15) + 'px';
                ripple.style.transform = 'translateX(-50%)'; // Center it
                ripple.style.zIndex = '105';
                container.appendChild(ripple);

                const rippleAnim = ripple.animate([
                    { transform: 'translateX(-50%) scale(0.5)', opacity: 1 },
                    { transform: 'translateX(-50%) scale(2.5)', opacity: 0 }
                ], {
                    duration: 600 + Math.random() * 400,
                    easing: 'ease-out'
                });

                rippleAnim.onfinish = () => ripple.remove();
            }

        }, 25); // Extremely fast interval (25ms) for a dense downpour effect

        return interval;
    }
};