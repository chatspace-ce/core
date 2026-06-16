module.exports = {
    name: "Music",
    render: function(container) {
        const notes = ['♪', '♫', '♬', '♩'];
        // Hooks directly into your client's active theme variables!
        const colors = ['var(--accent)', 'var(--primary)', 'var(--secondary)', 'var(--gold)', 'var(--danger)'];

        const interval = setInterval(() => {
            const note = document.createElement('div');
            note.textContent = notes[Math.floor(Math.random() * notes.length)];
            note.style.position = 'absolute';
            note.style.pointerEvents = 'none';
            note.style.fontWeight = 'bold';

            // Randomize size and color
            note.style.fontSize = (Math.random() * 14 + 14) + 'px';
            const color = colors[Math.floor(Math.random() * colors.length)];
            note.style.color = color;
            note.style.textShadow = `0 0 10px ${color}`; // Gives the notes a neon glow

            // Spawn near the bottom/center
            note.style.left = (Math.random() * 80 + 10) + '%';
            note.style.top = (Math.random() * 30 + 60) + '%';

            container.appendChild(note);

            // Calculate a wavy, swaying path upwards
            const sway = (Math.random() * 60 - 30);
            const rotateStart = (Math.random() * 60 - 30);
            const rotateEnd = (Math.random() * 90 - 45);

            const anim = note.animate([
                { transform: `translate(0, 0) rotate(${rotateStart}deg) scale(0)`, opacity: 0 },
                { transform: `translate(${sway / 2}px, -50px) rotate(0deg) scale(1.2)`, opacity: 1, offset: 0.2 },
                { transform: `translate(${sway}px, -100px) rotate(${rotateEnd}deg) scale(1)`, opacity: 0.8, offset: 0.8 },
                { transform: `translate(${sway * 1.5}px, -150px) rotate(${rotateEnd * 1.5}deg) scale(0.8)`, opacity: 0 }
            ], {
                duration: 2500 + Math.random() * 1500,
                easing: 'ease-in-out'
            });

            anim.onfinish = () => note.remove();

        }, 350);

        return interval;
    }
};