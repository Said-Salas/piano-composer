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
    // Low RMS threshold to pick up quiet high notes
    const shortResult = this.yinPitchDetection(shortBuffer, this.sampleRate, 0.0005, true);
    
    // If the short window detects a clear, high pitch (> 800 Hz ~ G5), trust it.
    if (shortResult.clarity > 0.6 && shortResult.frequency > 800) {
      return shortResult;
    }

    // 2. Fallback to full window (2048 samples) for mid and low notes
    // Higher RMS threshold (0.0015) to ignore typing noise
    return this.yinPitchDetection(this.buffer, this.sampleRate, 0.0015, false);
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

    // 3. Find all local minima
    let minima: {tau: number, val: number}[] = [];
    for (let tau = 1; tau < halfSize - 1; tau++) {
       if (cmndf[tau] < cmndf[tau-1] && cmndf[tau] < cmndf[tau+1]) {
           minima.push({tau, val: cmndf[tau]});
       }
    }

    if (minima.length === 0) {
        return { frequency: -1, clarity: 0 };
    }

    // 4. Select the best minimum
    let tauEstimate = -1;
    let absoluteThreshold = isShortBuffer ? 0.35 : 0.20; // High notes have worse correlation, allow higher threshold

    for (let i = 0; i < minima.length; i++) {
        let m = minima[i];
        if (m.val < absoluteThreshold) {
            // Found a candidate.
            // Pianos have strong 2nd harmonics, causing an early dip (e.g., A3 when A2 is played).
            // To prevent Octave UP errors, we look ahead to see if there is a deeper dip (the true fundamental).
            let foundDeeper = false;
            for (let j = i + 1; j < minima.length; j++) {
                // If a later dip is significantly deeper, the current one is just a harmonic.
                // We require the later dip to be at least 20% deeper to justify skipping the current one.
                if (minima[j].val < m.val * 0.8) {
                    foundDeeper = true;
                    break;
                }
            }
            
            if (!foundDeeper) {
                tauEstimate = m.tau;
                break;
            }
        }
    }

    if (tauEstimate === -1) {
      return { frequency: -1, clarity: 0 };
    }

    // 5. Parabolic interpolation for better precision
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
