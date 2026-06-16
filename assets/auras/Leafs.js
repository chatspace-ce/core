module.exports = {
    name: "Autumn Winds",
    render: function(container) {
        let tickCount = 0;

        const interval = setInterval(() => {
            tickCount++;

            // --- 1. TUMBLING LEAVES ---
            const leaf = document.createElement('div');
            leaf.style.position = 'absolute';
            leaf.style.pointerEvents = 'none';
            leaf.style.zIndex = '115';

            const leaves = ['🍂', '🍁', '🍃'];
            leaf.innerText = leaves[Math.floor(Math.random() * leaves.length)];
            leaf.style.fontSize = (Math.random() * 12 + 10) + 'px';

            // Depth of field - blur some leaves to make them look closer/further
            if (Math.random() > 0.7) leaf.style.filter = 'blur(1.5px)';

            // Spawn mostly on the right side so wind blows them left
            leaf.style.left = (Math.random() * 40 + 80) + '%';
            leaf.style.top = (Math.random() * 60 - 20) + '%';
            container.appendChild(leaf);

            // 3D Tumbling Math
            const endX = -(Math.random() * 150 + 150) + 'px'; // Blows hard left
            const endY = (Math.random() * 100 + 50) + 'px';   // Blows slightly down

            const rotX = Math.random() * 720;
            const rotY = Math.random() * 720;
            const rotZ = Math.random() * 360;

            const leafAnim = leaf.animate([
                { transform: 'translate(0px, 0px) rotateX(0deg) rotateY(0deg) rotateZ(0deg)', opacity: 0 },
                { transform: `translate(${parseFloat(endX)*0.2}px, ${parseFloat(endY)*0.2}px) rotateX(${rotX*0.2}deg) rotateY(${rotY*0.2}deg) rotateZ(${rotZ*0.2}deg)`, opacity: 1, offset: 0.1 },
                { transform: `translate(${endX}, ${endY}) rotateX(${rotX}deg) rotateY(${rotY}deg) rotateZ(${rotZ}deg)`, opacity: 0 }
            ], {
                duration: 1500 + Math.random() * 1500,
                easing: 'cubic-bezier(0.25, 0.1, 0.25, 1)' // Fast start, coasts smoothly
            });
            leafAnim.onfinish = () => leaf.remove();

            // --- 2. VISUAL WIND GUSTS ---
            if (tickCount % 15 === 0) {
                const gust = document.createElement('div');
                gust.style.position = 'absolute';
                gust.style.pointerEvents = 'none';
                gust.style.zIndex = '95'; // Behind the avatar

                // Creates a fast-moving, streaking line
                gust.style.height = '2px';
                gust.style.width = (Math.random() * 60 + 40) + 'px';
                gust.style.background = 'linear-gradient(90deg, transparent, rgba(245, 158, 11, 0.4), transparent)';
                gust.style.borderRadius = '2px';

                gust.style.left = '120%';
                gust.style.top = (Math.random() * 100) + '%';
                container.appendChild(gust);

                // Shoots extremely fast across the screen right-to-left
                const gustAnim = gust.animate([
                    { transform: 'translateX(0px)', opacity: 0 },
                    { transform: 'translateX(-100px)', opacity: 1, offset: 0.2 },
                    { transform: 'translateX(-300px)', opacity: 0 }
                ], { duration: 600 + Math.random() * 400, easing: 'linear' });
                gustAnim.onfinish = () => gust.remove();
            }

        }, 60);

        return interval;
    }
};