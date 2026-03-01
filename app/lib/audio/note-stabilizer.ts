import { frequencyToMidi, midiToNoteName } from "./note-utils";

export class MonophonicNoteDetector {
  private currentCandidate: string | null = null;
  private candidateCount: number = 0;
  private stableNote: string | null = null;
  
  // Configuration
  // Piano range is A0 (27.5Hz) to C8 (4186Hz)
  private minFrequency: number = 27.5;
  private maxFrequency: number = 4200;
  private minClarity: number = 0.5; 
  
  // Consistency threshold prevents transient noises/typing from triggering fake notes
  private consistencyThreshold: number = 2; // Reduced back to 2 to catch fast high notes like A6 and C7
  
  // Debounce logic for note release
  private releaseCounter: number = 0;
  private releaseThreshold: number = 15; // Increased to 15 frames (~250ms) to aggressively prevent single notes splitting into multiple

  process(frequency: number, clarity: number): string | null {
    // Dynamic minimum clarity: lower threshold for higher frequencies
    // since high piano strings decay extremely fast into noise
    let dynamicMinClarity = this.minClarity;
    if (frequency > 1000) dynamicMinClarity = 0.4;
    if (frequency > 2000) dynamicMinClarity = 0.3;

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

    if (this.candidateCount >= this.consistencyThreshold) {
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
