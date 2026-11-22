export function playPing(context: AudioContext, frequency = 660) {
  if (context.state !== "running") return;
  const tone = context.createOscillator();
  const volume = context.createGain();
  tone.frequency.value = frequency;
  volume.gain.setValueAtTime(0.12, context.currentTime);
  volume.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.24);
  tone.connect(volume).connect(context.destination);
  tone.start();
  tone.stop(context.currentTime + 0.25);
}
