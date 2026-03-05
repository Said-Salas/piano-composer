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

    // 1. Try a short window first (512 samples ~11ms) to catch fast-decaying high notes (C6, A6, etc)
    const shortBuffer = this.buffer.subarray(0, 512);
    // Extra low RMS threshold to pick up quiet high notes
    const shortResult = this.yinPitchDetection(shortBuffer, this.sampleRate, 0.00005, true);
    
    // If the short window detects a clear, high pitch (> 800 Hz ~ G5), trust it.
    if (shortResult.clarity > 0.4 && shortResult.frequency > 800) {
      return shortResult;
    }

    // 2. Fallback to full window (2048 samples) for mid and low notes
    // Lowered RMS threshold (0.0003) to make the app more sensitive to quiet piano notes
    return this.yinPitchDetection(this.buffer, this.sampleRate, 0.0003, false);
  }

  private yinPitchDetection(buffer: Float32Array, sampleRate: number, rmsThreshold: number, isShortBuffer: boolean): { frequency: number; clarity: number } {
    const SIZE = buffer.length;
    let sumOfSquares = 0;
    for (let i = 0; i < SIZE; i++) {
      const val = buffer[i];
      sumOfSquares += val * val;
    }
    const rootMeanSquare = Math.sqrt(sumOfSquares / SIZE);

    if (rootMeanSquare < rmsThreshold) { 
      return { frequency: -1, clarity: 0 };
    }

    const halfSize = Math.floor(SIZE / 2);
    const diff = new Float32Array(halfSize);
    
    // 1. Difference function
    for (let tau = 0; tau < halfSize; tau++) {
      let deltaSum = 0;
      for (let i = 0; i < halfSize; i++) {
        const delta = buffer[i] - buffer[i + tau];
        deltaSum += delta * delta;
      }
      diff[tau] = deltaSum;
    }

    // 2. Cumulative mean normalized difference function
    const cmndf = new Float32Array(halfSize);
    cmndf[0] = 1;
    let runningSum = 0;
    for (let tau = 1; tau < halfSize; tau++) {
      runningSum += diff[tau];
      cmndf[tau] = diff[tau] * tau / runningSum;
    }

    // 3. Find the first local minimum below the absolute threshold
    let tauEstimate = -1;
    let minTau = -1;
    let minCmndf = Infinity;
    
    // We do a full pass to find the global minimum first
    for (let tau = 1; tau < halfSize - 1; tau++) {
       // Is it a local minimum?
       if (cmndf[tau] < cmndf[tau-1] && cmndf[tau] < cmndf[tau+1]) {
           if (cmndf[tau] < minCmndf) {
               minCmndf = cmndf[tau];
               minTau = tau;
           }
       }
    }

    if (minTau === -1) {
        return { frequency: -1, clarity: 0 };
    }

    // Now we do a second pass to find the fundamental
    for (let tau = 1; tau < halfSize - 1; tau++) {
       if (cmndf[tau] < cmndf[tau-1] && cmndf[tau] < cmndf[tau+1]) {
           // Calculate dynamic margin based on tau.
           // High frequencies (small tau) have naturally shallower dips, so we allow a larger margin.
           // Low frequencies (large tau) have strong harmonics, so we require a very strict margin.
           let margin = Math.max(0.015, 0.08 * (1 - tau / 400));
           let threshold = minCmndf + margin;

           // Also require an absolute max of 0.25 to avoid picking pure noise
           if (cmndf[tau] <= threshold && cmndf[tau] < 0.25) {
               tauEstimate = tau;
               break;
           }
       }
    }

    if (tauEstimate === -1) {
      // Fallback to global minimum if it's reasonable
      if (minCmndf < 0.25) {
        tauEstimate = minTau;
      } else {
        return { frequency: -1, clarity: 0 };
      }
    }

    // 4. Parabolic interpolation for better precision
    if (tauEstimate > 0 && tauEstimate < halfSize - 1) {
      const s0 = cmndf[tauEstimate - 1];
      const s1 = cmndf[tauEstimate];
      const s2 = cmndf[tauEstimate + 1];
      
      const a = (s0 + s2 - 2 * s1) / 2;
      const b = (s2 - s0) / 2;
      if (a !== 0) {
        tauEstimate = tauEstimate - b / (2 * a);
      }
    }

    const pitch = sampleRate / tauEstimate;
    // Clarity is inversly proportional to the CMNDF dip value
    const clarity = Math.max(0, 1 - cmndf[Math.round(tauEstimate)]);

    return { frequency: pitch, clarity };
  }
}
