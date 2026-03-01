export class AudioPitchAnalyzer {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaStream: MediaStream | null = null;
  private buffer: Float32Array;
  private sampleRate: number = 44100;

  constructor() {
    // 2048 samples @ 44.1kHz = ~46ms window. Good balance for fast high notes and low notes down to ~45Hz
    this.buffer = new Float32Array(2048);
  }

  async start(): Promise<void> {
    if (this.audioContext) return;

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.audioContext = new AudioContextClass();
    this.sampleRate = this.audioContext.sampleRate;
    
    try {
      // First, get basic permission to read device labels
      let tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Enumerate devices to find the built-in MacBook microphone
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(d => d.kind === 'audioinput');
      
      const builtInMic = audioInputs.find(d => 
        d.label.toLowerCase().includes('built-in') || 
        d.label.toLowerCase().includes('macbook')
      );
      
      let targetDeviceId = builtInMic?.deviceId;
      
      // Stop the temporary stream
      tempStream.getTracks().forEach(t => t.stop());

      const constraints: any = {
        audio: {
          echoCancellation: false,
          autoGainControl: false,
          noiseSuppression: false,
          channelCount: 1
        }
      };
      
      if (targetDeviceId) {
        constraints.audio.deviceId = { exact: targetDeviceId };
      }

      this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048; // Matches buffer size
      source.connect(this.analyser);
      
      this.buffer = new Float32Array(this.analyser.fftSize);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      throw err;
    }
  }

  stop(): void {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.analyser = null;
  }

  getPitch(): { frequency: number; clarity: number } {
    if (!this.analyser) return { frequency: 0, clarity: 0 };

    this.analyser.getFloatTimeDomainData(this.buffer as any);
    return this.mpmPitchDetection(this.buffer, this.sampleRate);
  }

  // Added logic to calculate average amplitude per sample block (rms)
  // to dynamically adjust the clarity threshold for high notes
  // which naturally have weaker clarity values.
  private mpmPitchDetection(buffer: Float32Array, sampleRate: number): { frequency: number; clarity: number } {
    const SIZE = buffer.length;
    let sumOfSquares = 0;
    for (let i = 0; i < SIZE; i++) {
      const val = buffer[i];
      sumOfSquares += val * val;
    }
    const rootMeanSquare = Math.sqrt(sumOfSquares / SIZE);

    if (rootMeanSquare < 0.003) { 
      return { frequency: -1, clarity: 0 };
    }

    const halfSize = Math.floor(SIZE / 2);
    const nsdf = new Float32Array(halfSize);

    for (let tau = 0; tau < halfSize; tau++) {
      let acf = 0;
      let m = 0;
      for (let i = 0; i < halfSize; i++) {
        const val1 = buffer[i];
        const val2 = buffer[i + tau];
        acf += val1 * val2;
        m += val1 * val1 + val2 * val2;
      }
      nsdf[tau] = m === 0 ? 0 : (2 * acf) / m;
    }

    let maxPositions: number[] = [];
    let pos = 0;
    
    while (pos < halfSize - 1 && nsdf[pos] > 0) {
      pos++;
    }

    while (pos < halfSize - 1) {
      while (pos < halfSize - 1 && nsdf[pos] <= 0) {
        pos++;
      }
      if (pos >= halfSize - 1) break;

      let curMaxPos = pos;
      while (pos < halfSize - 1 && nsdf[pos] > 0) {
        if (nsdf[pos] > nsdf[curMaxPos]) {
          curMaxPos = pos;
        }
        pos++;
      }
      
      maxPositions.push(curMaxPos);
    }

    if (maxPositions.length === 0) {
      return { frequency: -1, clarity: 0 };
    }

    let highestPeakVal = -1;
    for (const p of maxPositions) {
      if (nsdf[p] > highestPeakVal) {
        highestPeakVal = nsdf[p];
      }
    }

    if (highestPeakVal < 0.5) {
        return { frequency: -1, clarity: highestPeakVal };
    }

    // Octave UP error fix (e.g. D3 detected as D4):
    // Pianos produce a very strong 2nd harmonic (octave up). If we just take the first peak that crosses 0.95,
    // we sometimes miss the fundamental if it is slightly weaker than the harmonic.
    // Standard MPM uses an adaptive threshold for this. We lower the k-value to 0.85 
    // to ensure we catch the earlier (lower frequency) fundamental peak, even if the harmonic is slightly taller.
    const threshold = 0.85 * highestPeakVal;

    let bestTau = -1;
    for (const p of maxPositions) {
      if (nsdf[p] >= threshold) {
        bestTau = p;
        break;
      }
    }

    if (bestTau === -1) {
      return { frequency: -1, clarity: 0 };
    }

    // Parabolic interpolation for better precision
    let tauEstimate = bestTau;
    if (bestTau > 0 && bestTau < halfSize - 1) {
      const s0 = nsdf[bestTau - 1];
      const s1 = nsdf[bestTau];
      const s2 = nsdf[bestTau + 1];
      
      const a = (s0 + s2 - 2 * s1) / 2;
      const b = (s2 - s0) / 2;
      if (a !== 0) {
        tauEstimate = bestTau - b / (2 * a);
      }
    }

    const pitch = sampleRate / tauEstimate;
    return { frequency: pitch, clarity: highestPeakVal };
  }
}
