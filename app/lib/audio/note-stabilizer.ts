import { frequencyToMidi, midiToNoteName } from "./note-utils";

export class MonophonicNoteDetector {
  private currentCandidate: string | null = null;
  private candidateCount: number = 0;
  private stableNote: string | null = null;
  
  // Configuration
  // Piano range is A0 (27.5Hz) to C8 (4186Hz)
  private minFrequency: number = 27.5;
  private maxFrequency: number = 4200;
  private minClarity: number = 0.6;
  
  // Increased threshold for low notes to prevent double triggering
  // Low notes oscillate slower, so we need more frames to be sure
  private consistencyThreshold: number = 5; // Increased from 3 to 5 frames (~80ms at 60fps)

  // Debounce logic for note release
  private releaseCounter: number = 0;
  private releaseThreshold: number = 5; // Frames to wait before releasing a note

  process(frequency: number, clarity: number): string | null {
    // Check if signal is valid
    if (clarity < this.minClarity || frequency < this.minFrequency || frequency > this.maxFrequency) {
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
