import { frequencyToMidi, midiToNoteName } from "./note-utils";

export class MonophonicNoteDetector {
  private currentCandidate: string | null = null;
  private candidateCount: number = 0;
  private stableNote: string | null = null;
  
  // Configuration
  // Piano range is C1 (65.4Hz) to C8 (4186Hz)
  private minFrequency: number = 63.0; // Slightly below C1 to allow slight detuning
  private maxFrequency: number = 4200;
  private minClarity: number = 0.3; 
  
  // Consistency threshold prevents transient noises/typing from triggering fake notes
  // We use a dynamic threshold now based on clarity to handle fast playing.
  
  // Debounce logic for note release
  private releaseCounter: number = 0;
  private releaseThreshold: number = 15; // Increased to 15 frames (~250ms) to aggressively prevent single notes splitting into multiple

  process(frequency: number, clarity: number): string | null {
    // Dynamic minimum clarity: lower threshold for higher frequencies
    // since high piano strings decay extremely fast into noise
    let dynamicMinClarity = this.minClarity;
    if (frequency > 1000) dynamicMinClarity = 0.25;
    if (frequency > 2000) dynamicMinClarity = 0.2;

    // We filter out low clarity signals (background noise/transients) and out of bounds frequencies
    if (clarity < dynamicMinClarity || frequency < this.minFrequency || frequency > this.maxFrequency) {
      // Signal lost
      if (this.stableNote) {
        this.releaseCounter++;
        if (this.releaseCounter < this.releaseThreshold) {
          // Keep holding the note for a few frames to bridge gaps
          return this.stableNote;
        }
      }
      
      this.currentCandidate = null;
      this.candidateCount = 0;
      this.stableNote = null;
      this.releaseCounter = 0;
      return null;
    }

    const midi = frequencyToMidi(frequency);
    const note = midiToNoteName(midi);

    // Reset release counter since we have a signal
    this.releaseCounter = 0;

    if (note === this.currentCandidate) {
      this.candidateCount++;
    } else {
      this.currentCandidate = note;
      this.candidateCount = 1;
    }

    // DYNAMIC CONSISTENCY THRESHOLD:
    // This makes the algorithm much smarter during fast, blurry playing (polyphony).
    // When multiple keys ring together, they create a blurry sound wave with "false" pitches
    // that jump around. Real, fresh key presses have high clarity.
    // By requiring blurry signals to be stable for longer, we filter out the "crazy" errors.
    let requiredConsistency = 5; // Default strict threshold for blurry/complex sounds (~80ms)
    
    if (clarity > 0.85) {
      requiredConsistency = 2; // Very clear, fast detection (~30ms)
    } else if (clarity > 0.70) {
      requiredConsistency = 3; // Clear enough (~50ms)
    } else if (clarity > 0.50) {
      requiredConsistency = 4; // Getting blurry (~65ms)
    }

    if (this.candidateCount >= requiredConsistency) {
      // If we are switching notes, ensure we don't just flicker
      this.stableNote = note;
    }

    return this.stableNote;
  }
  
  reset() {
    this.currentCandidate = null;
    this.candidateCount = 0;
    this.stableNote = null;
    this.releaseCounter = 0;
  }
}
