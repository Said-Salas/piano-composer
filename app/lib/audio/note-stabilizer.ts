import { frequencyToMidi, midiToNoteName } from "./note-utils";

export class MonophonicNoteDetector {
  private currentCandidate: string | null = null;
  private candidateCount: number = 0;
  private stableNote: string | null = null;
  
  // Configuration
  // Piano range is A0 (27.5Hz) to C8 (4186Hz)
  private minFrequency: number = 27.5;
  private maxFrequency: number = 4200;
  private minClarity: number = 0.8;
  private consistencyThreshold: number = 3; // frames

  process(frequency: number, clarity: number): string | null {
    // Check if signal is valid
    if (clarity < this.minClarity || frequency < this.minFrequency || frequency > this.maxFrequency) {
      // If signal is lost, we reset candidate tracking
      // But we might want to hold the stable note for a moment (release time)
      // For now, simple: silence breaks the note immediately
      this.currentCandidate = null;
      this.candidateCount = 0;
      this.stableNote = null;
      return null;
    }

    const midi = frequencyToMidi(frequency);
    const note = midiToNoteName(midi);

    if (note === this.currentCandidate) {
      this.candidateCount++;
    } else {
      this.currentCandidate = note;
      this.candidateCount = 1;
    }

    if (this.candidateCount >= this.consistencyThreshold) {
      this.stableNote = note;
    } else {
        // If candidate is not stable yet, do we return the old stable note?
        // If the old stable note is different from candidate, we are in transition.
        // Let's return the stable note only if it matches the current candidate (which is building up)
        // OR if the candidate count is low, maybe we are just seeing noise, so keep returning stable?
        
        // Simple logic: return the last stable note until a new one takes over or silence occurs.
        // But if silence occurred (above), stableNote is null.
        // If we are here, we have a signal but it's not stable yet.
        // If we have a stable note from before, and it's different from candidate,
        // we should probably keep returning it until candidate takes over?
        // No, that delays the change.
        
        // Let's stick to: only return what is currently stable.
        // If we are transitioning C -> D, and D is not stable yet, 
        // we might return C (if C was stable) or null.
        // If we return C, we extend C's duration.
        // If we return null, we have a gap.
        // Gaps are fine for piano (staccato).
    }

    return this.stableNote;
  }
  
  reset() {
    this.currentCandidate = null;
    this.candidateCount = 0;
    this.stableNote = null;
  }
}
