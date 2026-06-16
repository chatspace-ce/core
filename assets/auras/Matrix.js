module.exports = {
    name: "Matrix",
    render: function(container) {
        // Japanese Katakana + Numbers for authentic Matrix look
        const chars = "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ1234567890";

        const interval = setInterval(() => {
            const drop = document.createElement('div');
            drop.style.position = 'absolute';
            drop.style.pointerEvents = 'none';
            drop.style.zIndex = '110'; // Drops slightly over the avatar

            // Random character styling
            drop.innerText = chars.charAt(Math.floor(Math.random() * chars.length));
            drop.style.color = '#fff'; // White core
            drop.style.textShadow = '0 0 5px #0f0, 0 0 10px #0f0, 0 0 20px #0f0'; // Heavy green glow
            drop.style.fontFamily = 'monospace';
            drop.style.fontSize = (Math.random() * 12 + 10) + 'px';
            drop.style.fontWeight = '900';

            // Start at a random horizontal position, slightly above the avatar
            drop.style.left = (Math.random() * 100) + '%';
            drop.style.top = '-20%';

            container.appendChild(drop);

            // Falling animation
            const duration = 1000 + Math.random() * 1500;
            const anim = drop.animate([
                { transform: 'translateY(0px)', opacity: 0 },
                { transform: 'translateY(20px)', opacity: 1, offset: 0.1 },
                { transform: 'translateY(200px)', opacity: 0.8, offset: 0.8 },
                { transform: 'translateY(250px)', opacity: 0 }
            ], {
                duration: duration,
                easing: 'linear'
            });

            anim.onfinish = () => drop.remove();
        }, 60); // Spawns a new character every 60ms

        return interval;
    }
};