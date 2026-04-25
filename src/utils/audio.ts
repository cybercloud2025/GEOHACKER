export const playAlarm = (durationMs: number = 3000) => {
    const AudioContext = window.AudioContext || (window as Window & { webkitAudioContext?: typeof window.AudioContext }).webkitAudioContext;
    if (!AudioContext) return;

    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth'; // Harsh sound
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(880, ctx.currentTime + 0.5); // Siren effect

    // Modulate frequency for a siren effect
    const lfo = ctx.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = 5; // 5 Hz modulation
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 500;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    lfo.start();

    gain.gain.setValueAtTime(0.5, ctx.currentTime);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();

    setTimeout(() => {
        osc.stop();
        lfo.stop();
        ctx.close();
    }, durationMs);
};
