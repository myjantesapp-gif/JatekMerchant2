let audioContext: AudioContext | null = null;
let oscillator: OscillatorNode | null = null;
let gain: GainNode | null = null;
let toneInterval: number | null = null;
let vibrationInterval: number | null = null;
let highTone = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (audioContext) return audioContext;

  const AudioContextConstructor = window.AudioContext
    || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) return null;

  audioContext = new AudioContextConstructor();
  return audioContext;
}

/** Call from a pointer/key gesture so browsers can resume audio after autoplay blocking. */
export async function unlockAudioContext(): Promise<boolean> {
  const context = getAudioContext();
  if (!context) return false;
  if (context.state !== 'running') {
    try {
      await context.resume();
    } catch {
      return false;
    }
  }
  return context.state === 'running';
}

export function isOrderAlarmAudible(): boolean {
  return oscillator !== null && audioContext?.state === 'running';
}

function vibrateForOrder(): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate([500, 200, 500]);
  }
}

/** Starts one bounded-volume urgent double-tone loop; repeated calls are harmless. */
export function startOrderAlarm(): void {
  if (oscillator) return;

  const context = getAudioContext();
  if (!context) return;

  oscillator = context.createOscillator();
  gain = context.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(880, context.currentTime);
  // Keep headroom to avoid clipping on device speakers.
  gain.gain.setValueAtTime(0.24, context.currentTime);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();

  toneInterval = window.setInterval(() => {
    if (!audioContext || !oscillator) return;
    highTone = !highTone;
    oscillator.frequency.setTargetAtTime(highTone ? 1174 : 880, audioContext.currentTime, 0.025);
  }, 300);

  vibrateForOrder();
  vibrationInterval = window.setInterval(vibrateForOrder, 2400);
}

/** Immediately stops audio, scheduled tone changes, and vibration. */
export function stopOrderAlarm(): void {
  if (toneInterval !== null) window.clearInterval(toneInterval);
  if (vibrationInterval !== null) window.clearInterval(vibrationInterval);
  toneInterval = null;
  vibrationInterval = null;

  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(0);
  }

  if (oscillator) {
    try {
      oscillator.stop();
    } catch {
      // It may already have stopped during a browser audio-device reset.
    }
    oscillator.disconnect();
  }
  gain?.disconnect();
  oscillator = null;
  gain = null;
  highTone = false;
}