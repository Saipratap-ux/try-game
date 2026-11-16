class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;

  public setMuted(mute: boolean) {
    this.muted = mute;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  private ensureContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return null;
        this.ctx = new AudioCtx();
      }
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  public playTone(freq: number, duration = 0.12, type: OscillatorType = 'sine', volume = 0.12) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      // Ignore audio scheduling errors
    }
  }

  public click() {
    this.playTone(540, 0.06, 'triangle', 0.08);
  }

  public match() {
    this.playTone(523.25, 0.12, 'sine', 0.12);
    setTimeout(() => this.playTone(659.25, 0.14, 'sine', 0.12), 70);
  }

  public bounce() {
    this.playTone(330, 0.08, 'square', 0.06);
  }

  public hit() {
    this.playTone(180, 0.14, 'sawtooth', 0.1);
  }

  public win() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, idx) => {
      setTimeout(() => this.playTone(n, 0.22, 'triangle', 0.12), idx * 90);
    });
  }

  public animalCall(animal: 'cat' | 'dog' | 'cow' | 'duck' | 'lion' | 'frog') {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.14, now);

    if (animal === 'cat') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(620, now);
      osc.frequency.linearRampToValueAtTime(860, now + 0.16);
      osc.frequency.linearRampToValueAtTime(480, now + 0.42);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.44);
      osc.start(now);
      osc.stop(now + 0.45);
    } else if (animal === 'dog') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(240, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.14);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      osc.start(now);
      osc.stop(now + 0.18);
    } else if (animal === 'cow') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(135, now);
      osc.frequency.linearRampToValueAtTime(115, now + 0.55);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.58);
      osc.start(now);
      osc.stop(now + 0.6);
    } else if (animal === 'duck') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(380, now);
      osc.frequency.linearRampToValueAtTime(310, now + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
      osc.start(now);
      osc.stop(now + 0.18);
    } else if (animal === 'lion') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.5);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.52);
      osc.start(now);
      osc.stop(now + 0.55);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(460, now + 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      osc.start(now);
      osc.stop(now + 0.15);
    }
  }
}

export const soundFx = new SoundEngine();
