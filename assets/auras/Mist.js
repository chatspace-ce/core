module.exports = {
    name: "Mist",
    render: function(container) {
        // Generates a new puff of mist every 250ms
        const interval = setInterval(() => {
            const mist = document.createElement('div');

            // Create a blurry, cloudy blob
            const size = 60 + Math.random() * 60; // Random size between 60px and 120px
            mist.style.width = size + 'px';
            mist.style.height = size + 'px';
            mist.style.position = 'absolute';
            mist.style.borderRadius = '50%';
            mist.style.pointerEvents = 'none';
            mist.style.filter = 'blur(15px)'; // Makes it look like gas/fog

            // Radial gradient fading to transparent edges
            mist.style.background = 'radial-gradient(circle, rgba(200, 220, 255, 0.25) 0%, rgba(200, 220, 255, 0) 70%)';

            // Start randomly near the lower half of the avatar
            mist.style.left = (Math.random() * 80 - 10) + '%';
            mist.style.top = (60 + Math.random() * 40) + '%';

            container.appendChild(mist);

            // Calculate a slow, drifting path
            const driftX = (Math.random() * 60 - 30) + 'px';
            const driftY = -(Math.random() * 60 + 40) + 'px';

            const anim = mist.animate([
                { transform: 'translate(0, 0) scale(0.8)', opacity: 0 },
                { opacity: 1, offset: 0.3 }, // Fade in slowly
                { opacity: 1, offset: 0.7 }, // Hold visibility
                { transform: `translate(${driftX}, ${driftY}) scale(1.5)`, opacity: 0 } // Expand and fade out
            ], {
                duration: 4000 + Math.random() * 2000, // Lasts 4 to 6 seconds
                easing: 'ease-out'
            });

            anim.onfinish = () => mist.remove();

        }, 250);

        return interval;
    }
};