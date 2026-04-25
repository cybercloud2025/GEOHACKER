import { useEffect, useRef } from 'react';

export const MatrixRain = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d', { alpha: false }); // Optimization: disable alpha if not needed
        if (!ctx) return;

        // Optimization: Handle reduced motion
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (prefersReducedMotion) {
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            return;
        }

        let frameId: number;
        let lastTime = 0;
        const isMobile = window.innerWidth < 768;
        const fps = isMobile ? 20 : 30; // Lower FPS on mobile for Safari/Battery
        const interval = 1000 / fps;

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            initDrops();

            // Re-fill background on resize to avoid flickering
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        };

        const chars = 'アァカサタナハマヤャラワガザダバパイィキシチニヒミリヰギジヂビピウゥクスツヌフムユュルグズブヅプエェケセテネヘメレヱGEZE DEBE PEオォコソトノホモヨョロヲゴゾドボポヴッン0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const charArray = chars.split('');
        const fontSize = 14;
        let drops: number[] = [];

        const initDrops = () => {
            // Optimization: Fewer columns on mobile to reduce draw calls
            const isMobile = window.innerWidth < 768;
            const step = isMobile ? fontSize * 2 : fontSize;
            const columns = canvas.width / step;
            drops = new Array(Math.ceil(columns)).fill(1);
        };

        const draw = (timestamp: number) => {
            frameId = requestAnimationFrame(draw);

            const elapsed = timestamp - lastTime;
            if (elapsed < interval) return;
            lastTime = timestamp - (elapsed % interval);

            ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.font = `${fontSize}px monospace`;
            const isMobile = window.innerWidth < 768;
            const step = isMobile ? fontSize * 2 : fontSize;

            for (let i = 0; i < drops.length; i++) {
                const text = charArray[Math.floor(Math.random() * charArray.length)];
                ctx.fillStyle = Math.random() > 0.95 ? '#CCFF00' : '#00FF41';
                ctx.fillText(text, i * step, drops[i] * fontSize);

                if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
                    drops[i] = 0;
                }
                drops[i]++;
            }
        };

        window.addEventListener('resize', resize);
        resize();
        frameId = requestAnimationFrame(draw);

        return () => {
            cancelAnimationFrame(frameId);
            window.removeEventListener('resize', resize);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className="absolute inset-0 z-0 opacity-40 pointer-events-none"
        />
    );
};
