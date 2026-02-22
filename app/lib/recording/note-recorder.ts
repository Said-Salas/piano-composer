import { Note } from "@/app/types";

export class NoteRecorder {
  private isRecording: boolean = false;
  private startTime: number = 0;
  private activeNote: { pitch: string; startTime: number } | null = null;
  private notes: Note[] = [];
  private onNoteRecorded: ((note: Note) => void) | null = null;
  private defaultDuration: number = 1000; // 1 second default duration

  constructor(onNoteRecorded?: (note: Note) => void) {
    this.onNoteRecorded = onNoteRecorded || null;
  }

  start() {
    this.isRecording = true;
    this.startTime = performance.now();
    this.notes = [];
    this.activeNote = null;
  }

  stop() {
    this.activeNote = null; // Just clear active note, don't record it if it's hanging
    this.isRecording = false;
    return this.notes;
  }

  // Process a new frame's detected note
  process(detectedNote: string | null) {
    if (!this.isRecording) return;

    const currentTime = performance.now();
    const relativeTime = currentTime - this.startTime;

    // If we have an active note
    if (this.activeNote) {
      // If the detected note is different (or null/silence), we consider the previous note "finished"
      // BUT per requirements, we don't care about the release time for duration.
      // We just need to stop tracking it so we can start a new one if needed.
      if (detectedNote !== this.activeNote.pitch) {
        this.activeNote = null;
        
        // If the new detection is a valid note, start a new one immediately
        if (detectedNote) {
          this.recordNewNote(detectedNote, relativeTime);
        }
      }
      // If detectedNote is the same, we just continue (do nothing)
    } else {
      // No active note, but we detected one -> start it
      if (detectedNote) {
        this.recordNewNote(detectedNote, relativeTime);
      }
    }
  }

  private recordNewNote(pitch: string, startTime: number) {
    // Immediately create and emit the note with fixed duration
    const newNote: Note = {
      id: crypto.randomUUID(),
      pitch,
      startTime,
      duration: this.defaultDuration
    };

    this.notes.push(newNote);
    if (this.onNoteRecorded) {
      this.onNoteRecorded(newNote);
    }

    // Set as active so we don't re-trigger it while holding
    this.activeNote = {
      pitch,
      startTime
    };
  }

  getNotes() {
    return this.notes;
  }
}
