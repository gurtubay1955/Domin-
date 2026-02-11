/**
 * Sound Service - Synthesized Audio for PWA
 * Uses Web Audio API to generate retro-style sound effects.
 * zero-dependency, zero-assets, 100% offline ready.
 */

// Singleton AudioContext
let audioCtx: AudioContext | null = null;

const getContext = () => {
    if (typeof window === 'undefined') return null;
    if (!audioCtx) {
        // Handle browser policies (user interaction required)
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    return audioCtx;
};

export const playClick = () => {
    const ctx = getContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

    osc.start();
    osc.stop(ctx.currentTime + 0.1);
};

export const playScore = () => {
    const ctx = getContext();
    if (!ctx) return;

    // Coin sound: Two tones quickly
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.type = 'square';
    osc1.frequency.setValueAtTime(987.77, now); // B5
    gain1.gain.setValueAtTime(0.1, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    osc1.start(now);
    osc1.stop(now + 0.1);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(1318.51, now + 0.1); // E6
    gain2.gain.setValueAtTime(0.1, now + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    osc2.start(now + 0.1);
    osc2.stop(now + 0.3);
};

export const playZapatero = (type: 'single' | 'double' = 'single') => {
    const ctx = getContext();
    if (!ctx) return;

    // Womp womp (Slide down)
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.linearRampToValueAtTime(50, now + 0.8);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.8);

    osc.start(now);
    osc.stop(now + 0.8);

    // If double, play a second one overlapping
    if (type === 'double') {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.type = 'sawtooth';
        osc2.frequency.setValueAtTime(150, now + 0.1);
        osc2.frequency.linearRampToValueAtTime(40, now + 1.0);
        gain2.gain.setValueAtTime(0.2, now + 0.1);
        gain2.gain.linearRampToValueAtTime(0.01, now + 1.0);
        osc2.start(now + 0.1);
        osc2.stop(now + 1.0);
    }
};

export const playVictory = () => {
    const ctx = getContext();
    if (!ctx) return;

    // Major Arpeggio
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C Major

    notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const time = now + (i * 0.15);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, time);

        gain.gain.setValueAtTime(0.15, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.4);

        osc.start(time);
        osc.stop(time + 0.4);
    });
};
