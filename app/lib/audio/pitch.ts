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

  private mpmPitchDetection(buffer: Float32Array, sampleRate: number): { frequency: number; clarity: number } {
    const SIZE = buffer.length;
    let sumOfSquares = 0;
    for (let i = 0; i < SIZE; i++) {
      const val = buffer[i];
      sumOfSquares += val * val;
    }
    const rootMeanSquare = Math.sqrt(sumOfSquares / SIZE);

    // Increased RMS threshold to ignore typing and background noise
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
    
    // Skip the first positive lobe (the lag=0 peak)
    while (pos < halfSize - 1 && nsdf[pos] > 0) {
      pos++;
    }

    while (pos < halfSize - 1) {
      // Find next positive zero crossing
      while (pos < halfSize - 1 && nsdf[pos] <= 0) {
        pos++;
      }
      if (pos >= halfSize - 1) break;

      let curMaxPos = pos;
      // Find the peak in this positive lobe
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

    // If the signal is too noisy, don't guess a pitch
    // 0.5 allows high notes (which decay fast) but rejects pure noise
    if (highestPeakVal < 0.5) {
        return { frequency: -1, clarity: highestPeakVal };
    }

    // The core of MPM: the threshold avoids octave errors by selecting the first
    // prominent peak rather than the absolute highest peak (which might be a sub-harmonic).
    // A high k-value (0.95) ensures we don't accidentally pick a harmonic instead of the fundamental.
    const threshold = 0.95 * highestPeakVal;

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
