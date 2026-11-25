// Tiny WebAudio sound effects for Golden Ladle, synthesized on the spot:
// no audio files, no network, and silence when the browser has no audio.

export function createSoundboard() {
  let context = null;
  let muted = false;

  function ensureContext() {
    if (!context) {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        context = new AudioContext();
      } catch {
        context = null;
      }
    }
    if (context && context.state === 'suspended') context.resume();
    return context;
  }

  function tone(freq, seconds, type, gainValue, slideTo) {
    if (muted) return;
    const audio = ensureContext();
    if (!audio) return;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = type || 'sine';
    oscillator.frequency.setValueAtTime(freq, audio.currentTime);
    if (slideTo) oscillator.frequency.exponentialRampToValueAtTime(slideTo, audio.currentTime + seconds);
    gain.gain.setValueAtTime(gainValue || 0.12, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + seconds);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + seconds);
  }

  function noiseBurst(seconds, gainValue) {
    if (muted) return;
    const audio = ensureContext();
    if (!audio) return;
    const length = Math.floor(audio.sampleRate * seconds);
    const buffer = audio.createBuffer(1, length, audio.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) data[index] = (Math.random() * 2 - 1) * (1 - index / length);
    const source = audio.createBufferSource();
    source.buffer = buffer;
    const gain = audio.createGain();
    gain.gain.value = gainValue || 0.08;
    source.connect(gain);
    gain.connect(audio.destination);
    source.start();
  }

  return {
    unlock() { ensureContext(); },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    play(event) {
      if (event === 'take' || event === 'place') tone(520, 0.08, 'triangle', 0.1);
      else if (event === 'chop-tick') noiseBurst(0.05, 0.12);
      else if (event === 'chop-done') { tone(420, 0.09, 'triangle', 0.12); tone(640, 0.12, 'triangle', 0.1); }
      else if (event === 'cook-done') tone(880, 0.15, 'sine', 0.12, 1320);
      else if (event === 'burnt') tone(180, 0.3, 'sawtooth', 0.1, 90);
      else if (event === 'serve') { tone(660, 0.12, 'sine', 0.14); setTimeout(() => tone(990, 0.2, 'sine', 0.14), 110); }
      else if (event === 'plate-ready') tone(740, 0.12, 'triangle', 0.12, 1100);
      else if (event === 'baste') noiseBurst(0.12, 0.1);
      else if (event === 'expire') tone(320, 0.35, 'sawtooth', 0.1, 140);
      else if (event === 'error') tone(140, 0.15, 'square', 0.07);
      else if (event === 'trash') noiseBurst(0.08, 0.08);
      else if (event === 'game-over') { tone(392, 0.25, 'triangle', 0.12); setTimeout(() => tone(311, 0.4, 'triangle', 0.12), 220); }
    },
  };
}
