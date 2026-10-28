// Web Audio API Synthetic Sound Engine for AGV Vehicle Simulation

let audioCtx = null;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Plays a synthesized tone using Web Audio API oscillators.
 * @param {number} freq Frequency in Hz
 * @param {string} type Oscillator type ('sine', 'square', 'triangle', 'sawtooth')
 * @param {number} duration Duration in seconds
 * @param {number} volume Volume multiplier (0.0 to 1.0)
 */
function playTone(freq = 440, type = 'sine', duration = 0.2, volume = 0.15) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);

    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (err) {
    console.warn('Audio synthesis warning:', err);
  }
}

/**
 * Sound library mapping zone & event types to differentiated tones
 */
export const SoundEffects = {
  // Start route tone (double ascending chime)
  playStart: () => {
    playTone(523.25, 'triangle', 0.15, 0.2); // C5
    setTimeout(() => playTone(659.25, 'triangle', 0.25, 0.2), 150); // E5
  },

  // Stop arrival tones by location color / level
  playArrivalOrange: () => {
    // Orange locations (Niveles 1 y 2): Dual harmonic chime
    playTone(587.33, 'sine', 0.2, 0.25); // D5
    setTimeout(() => playTone(880, 'sine', 0.3, 0.25), 120); // A5
  },

  playArrivalRed: () => {
    // Red locations (Nivel 2 Superior / Montacargas): High pitch alarm chime
    playTone(880, 'square', 0.15, 0.15); // A5
    setTimeout(() => playTone(1046.5, 'square', 0.25, 0.15), 100); // C6
  },

  playArrivalYellow: () => {
    // Yellow locations (Nivel 1 Manual): Soft pleasant pulse
    playTone(440, 'sine', 0.25, 0.2); // A4
  },

  playArrivalStandard: () => {
    // Standard Slate locations: Neutral single beep
    playTone(523.25, 'sine', 0.18, 0.15); // C5
  },

  playArrivalForColor: (color) => {
    if (color === 'orange') SoundEffects.playArrivalOrange();
    else if (color === 'red') SoundEffects.playArrivalRed();
    else if (color === 'yellow') SoundEffects.playArrivalYellow();
    else SoundEffects.playArrivalStandard();
  },

  // Manual step motor sound
  playManualStep: () => {
    playTone(329.63, 'triangle', 0.08, 0.12); // E4
  },

  // Emergency stop or alert sound
  playAlert: () => {
    playTone(220, 'sawtooth', 0.3, 0.25); // A3
    setTimeout(() => playTone(196, 'sawtooth', 0.3, 0.25), 200); // G3
  },

  // Route completion fanfare
  playComplete: () => {
    playTone(523.25, 'triangle', 0.12, 0.2); // C5
    setTimeout(() => playTone(659.25, 'triangle', 0.12, 0.2), 120); // E5
    setTimeout(() => playTone(783.99, 'triangle', 0.12, 0.2), 240); // G5
    setTimeout(() => playTone(1046.5, 'triangle', 0.35, 0.25), 360); // C6
  }
};
