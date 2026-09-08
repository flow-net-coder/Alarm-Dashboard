// Web Audio Sound Synthesizer for Alarm Dings

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export function unlockAudio() {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0.001;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.01);
  } catch (e) {
    console.warn('Audio unlock warning:', e);
  }
}

export function playDing(freq = 587.33, duration = 1.2, count = 1) {
  try {
    const ctx = getAudioContext();
    for (let i = 0; i < count; i++) {
      const startTime = ctx.currentTime + i * 0.35;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.99, startTime + duration);

      gain.gain.setValueAtTime(0.4, startTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(freq * 2.76, startTime);
      gain2.gain.setValueAtTime(0.12, startTime);
      gain2.gain.exponentialRampToValueAtTime(0.0001, startTime + duration * 0.5);

      osc.connect(gain);
      osc2.connect(gain2);
      gain.connect(ctx.destination);
      gain2.connect(ctx.destination);

      osc.start(startTime);
      osc2.start(startTime);
      osc.stop(startTime + duration);
      osc2.stop(startTime + duration);
    }
  } catch (err) {
    console.error('Audio playback error:', err);
  }
}

export function playSound(soundType: string, dingCount = 1) {
  unlockAudio();
  switch (soundType) {
    case 'Soft chimes':
      playDing(659.25, 1.2, dingCount);
      break;
    case 'Woodland':
      playDing(523.25, 0.8, dingCount);
      break;
    case 'Low tide':
      playDing(440.0, 1.5, dingCount);
      break;
    case 'Night air':
      playDing(783.99, 1.4, dingCount);
      break;
    case 'Single Ding':
      playDing(880.0, 1.0, 1);
      break;
    case 'Multi-Ding (Urgent)':
      playDing(698.46, 0.7, Math.max(dingCount, 3));
      break;
    default:
      playDing(587.33, 1.0, dingCount);
      break;
  }
}
