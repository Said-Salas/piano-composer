export class AudioPitchAnalyzer {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaStream: MediaStream | null = null;
  private buffer: Float32Array;
  private sampleRate: number = 44100;

  constructor() {
    // Increased buffer size to 4096 to better detect low frequencies (bass notes)
    // 4096 samples @ 44.1kHz = ~93ms window
    this.buffer = new Float32Array(4096);
  }

  async start(): Promise<void> {
    if (this.audioContext) return;

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.audioContext = new AudioContextClass();
    this.sampleRate = this.audioContext.sampleRate;
    
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: false,
          autoGainControl: false,
          noiseSuppression: false,
          channelCount: 1
        } 
      });
      
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 4096; // Matches buffer size
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

    this.analyser.getFloatTimeDomainData(this.buffer);
    return this.autoCorrelate(this.buffer, this.sampleRate);
  }

  private autoCorrelate(buffer: Float32Array, sampleRate: number): { frequency: number; clarity: number } {
    const SIZE = buffer.length;
    let sumOfSquares = 0;
    for (let i = 0; i < SIZE; i++) {
      const val = buffer[i];
      sumOfSquares += val * val;
    }
    const rootMeanSquare = Math.sqrt(sumOfSquares / SIZE);

    // Lowered RMS threshold to detect quieter notes (especially high/low ends)
    if (rootMeanSquare < 0.005) { 
      return { frequency: -1, clarity: 0 };
    }

    // Autocorrelation
    // We only correlate the first half to ensure we have enough overlap
    const MAX_SAMPLES = Math.floor(SIZE / 2);
    const correlations = new Float32Array(MAX_SAMPLES);

    for (let offset = 0; offset < MAX_SAMPLES; offset++) {
      let correlation = 0;
      // Unrolled loop or optimized math could go here, but JS engines are decent
      for (let i = 0; i < MAX_SAMPLES; i++) {
        correlation += buffer[i] * buffer[i + offset];
      }
      correlations[offset] = correlation;
    }

    // Normalize
    const maxCorrelation = correlations[0];
    if (maxCorrelation > 0.00001) {
        for (let i = 0; i < MAX_SAMPLES; i++) {
            correlations[i] /= maxCorrelation;
        }
    }

    // Find first peak
    // We skip the main lobe at lag 0. We look for the first descent, then the first ascent.
    let d = 0;
    while (correlations[d] > correlations[d + 1] && d < MAX_SAMPLES - 1) d++;
    
    // Find the max peak in the rest of the buffer
    let maxval = -1, maxpos = -1;
    for (let i = d; i < MAX_SAMPLES; i++) {
      if (correlations[i] > maxval) {
        maxval = correlations[i];
        maxpos = i;
      }
    }
    
    // Octave Error Correction (Fix for B5 -> E4)
    // Sometimes the fundamental is weaker than the first harmonic (octave up)
    // or sub-harmonics appear stronger.
    // We check if there are significant peaks at integer fractions of the maxpos (T0).
    // E.g. if T0 = 100 (441Hz), check if there is a strong peak at 50 (882Hz) -> this would mean we detected the sub-harmonic
    // Or if T0 = 50 (882Hz), check if there is a peak at 100 (441Hz) -> this would mean we detected the harmonic
    
    // Actually, for autocorrelation:
    // T0 is the period in samples.
    // Higher frequency = Smaller T0.
    // Lower frequency = Larger T0.
    
    // If we detect E4 (329Hz, T0 ~= 134) instead of B5 (987Hz, T0 ~= 44),
    // 134 is approx 3 * 44. This means we are detecting the 3rd sub-harmonic (period is 3x longer).
    // This happens when the fundamental is weak or missing.
    
    // To fix this, we should look for the *first* strong peak, not just the *highest* peak.
    // A "strong" peak is one that is close to the max value (e.g. > 0.8 * maxval).
    
    let T0 = maxpos;
    
    // Search for earlier strong peaks to avoid sub-harmonic errors (detecting a lower note than actual)
    const threshold = 0.85 * maxval;
    for (let i = d; i < maxpos; i++) {
        if (correlations[i] > threshold) {
            // Found an earlier strong peak!
            // But wait, is it a local maximum?
            if (correlations[i] > correlations[i-1] && correlations[i] > correlations[i+1]) {
                 T0 = i;
                 break;
            }
        }
    }

    // Parabolic interpolation for better precision
    if (T0 > 0 && T0 < MAX_SAMPLES - 1) {
        const x1 = correlations[T0 - 1];
        const x2 = correlations[T0];
        const x3 = correlations[T0 + 1];
        const a = (x1 + x3 - 2 * x2) / 2;
        const b = (x3 - x1) / 2;
        if (a) T0 = T0 - b / (2 * a);
    }

    return { frequency: sampleRate / T0, clarity: maxval };
  }
}
