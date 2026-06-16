module.exports = {
    name: "Easter Magic",
    render: function(container) {
        // --- 1. SPRING PASTEL MEADOW GLOW ---
        const base = document.createElement('div');
        base.style.position = 'absolute';
        base.style.inset = '-10px';
        base.style.borderRadius = '20px';
        base.style.background = 'linear-gradient(180deg, transparent 40%, rgba(186, 255, 201, 0.3) 70%, rgba(255, 179, 186, 0.4) 100%)';
        base.style.filter = 'blur(10px)';
        base.style.pointerEvents = 'none';
        base.style.zIndex = '100';
        container.appendChild(base);

        base.animate([
            { opacity: 0.5, filter: 'blur(10px) hue-rotate(0deg)' },
            { opacity: 1, filter: 'blur(15px) hue-rotate(30deg)' },
            { opacity: 0.5, filter: 'blur(10px) hue-rotate(0deg)' }
        ], { duration: 5000, iterations: Infinity, easing: 'ease-in-out' });

        const emojis = ['🌸', '🌼', '🌷', '🥚', '✨'];
        let tickCount = 0;

        const interval = setInterval(() => {
            tickCount++;

            // --- 2. FLOATING PETALS & EGGS (Every ~300ms) ---
            if (tickCount % 10 === 0) {
                const petal = document.createElement('div');
                petal.style.position = 'absolute';
                petal.style.pointerEvents = 'none';
                petal.style.zIndex = '105';

                const emoji = emojis[Math.floor(Math.random() * emojis.length)];
                petal.innerText = emoji;
                petal.style.fontSize = emoji === '🥚' ? '18px' : '14px';

                // If it's an egg, it floats UP from the grass. Otherwise, petals fall DOWN.
                const isEgg = emoji === '🥚';
                petal.style.left = (Math.random() * 120 - 10) + '%';
                petal.style.top = isEgg ? '100%' : '-20%';
                if (isEgg) petal.style.filter = `drop-shadow(0 0 5px rgba(255, 255, 255, 0.8)) hue-rotate(${Math.random() * 360}deg)`;

                container.appendChild(petal);

                const endY = isEgg ? -200 : 300;
                const swayX = (Math.random() * 80 - 40);
                const rot = (Math.random() * 360) + 'deg';

                const anim = petal.animate([
                    { transform: `translate(0, 0) rotate(0deg) scale(${isEgg ? 0 : 1})`, opacity: 0 },
                    { transform: `translate(${swayX / 2}px, ${endY * 0.5}px) rotate(${rot}) scale(1.2)`, opacity: 1, offset: 0.5 },
                    { transform: `translate(${swayX}px, ${endY}px) rotate(${rot}) scale(1)`, opacity: 0 }
                ], { duration: 3000 + Math.random() * 2000, easing: 'ease-in-out' });

                anim.onfinish = () => petal.remove();
            }

            // --- 3. THE HOPPING BUNNY (Every ~4 seconds) ---
            if (tickCount % 130 === 0) {
                const bunny = document.createElement('div');
                bunny.style.position = 'absolute';
                bunny.style.pointerEvents = 'none';
                bunny.style.zIndex = '120';
                bunny.innerText = Math.random() > 0.5 ? '🐇' : '🐰';
                bunny.style.fontSize = '32px';
                bunny.style.filter = 'drop-shadow(0 5px 10px rgba(0,0,0,0.4))';

                // 50% chance to hop left-to-right or right-to-left
                const fromLeft = Math.random() > 0.5;
                bunny.style.left = fromLeft ? '-30%' : '110%';
                bunny.style.bottom = '-15%';
                if (!fromLeft) bunny.style.transform = 'scaleX(-1)'; // Flip horizontally

                container.appendChild(bunny);

                // Multi-stage bounding animation using standard CSS Keyframe offsets
                const dist = fromLeft ? 250 : -250;
                const hopAnim = bunny.animate([
                    { transform: `translateX(0px) translateY(0px)`, offset: 0 },
                    { transform: `translateX(${dist * 0.25}px) translateY(-40px)`, offset: 0.25 },
                    { transform: `translateX(${dist * 0.5}px) translateY(0px)`, offset: 0.5 },
                    { transform: `translateX(${dist * 0.75}px) translateY(-40px)`, offset: 0.75 },
                    { transform: `translateX(${dist}px) translateY(0px)`, offset: 1 }
                ], { duration: 1500, easing: 'linear' });

                // Fade out immediately after the hops finish
                hopAnim.onfinish = () => {
                    const fade = bunny.animate([
                        { opacity: 1 }, { opacity: 0 }
                    ], { duration: 300 });
                    fade.onfinish = () => bunny.remove();
                };
            }

        }, 30);

        return interval;
    }
};