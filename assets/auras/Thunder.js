module.exports = {
    name: "Thunder",
    render: function(container) {
        const interval = setInterval(() => {
            // Erratic timing: Only strike 20% of the time the interval ticks
            if (Math.random() > 0.2) return;

            const bolt = document.createElement('div');
            bolt.textContent = '⚡';
            bolt.style.position = 'absolute';
            bolt.style.fontSize = (Math.random() * 20 + 20) + 'px';
            bolt.style.left = (Math.random() * 100) + '%';
            bolt.style.top = (Math.random() * 100) + '%';
            bolt.style.pointerEvents = 'none';
            bolt.style.filter = 'drop-shadow(0 0 15px #eab308)'; // Intense yellow glow

            container.appendChild(bolt);

            // Strobe flash animation
            const randomRotation = (Math.random() * 60 - 30) + 'deg';
            const anim = bolt.animate([
                { opacity: 0, transform: `scale(2) rotate(${randomRotation})` },
                { opacity: 1, transform: `scale(1) rotate(${randomRotation})`, offset: 0.1 },
                { opacity: 0, transform: `scale(1.2) rotate(${randomRotation})`, offset: 0.2 },
                { opacity: 1, transform: `scale(1) rotate(${randomRotation})`, offset: 0.3 },
                { opacity: 0, transform: `scale(1) rotate(${randomRotation})` }
            ], {
                duration: 300 + Math.random() * 200, // Very fast flash
                easing: 'linear'
            });

            anim.onfinish = () => bolt.remove();
        }, 100); // Evaluates every 100ms for that erratic storm feel

        return interval;
    }
};