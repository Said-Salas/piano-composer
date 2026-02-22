import { Note } from "@/app/types";

export class NoteRecorder {
  private isRecording: boolean = false;
  private startTime: number = 0;
  private activeNote: { pitch: string; startTime: number } | null = null;
  private notes: Note[] = [];
  private onNoteRecorded: ((note: Note) => void) | null = null;

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
    this.finishActiveNote();
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
      // If the detected note is different (or null/silence), finish the active note
      if (detectedNote !== this.activeNote.pitch) {
        this.finishActiveNote(currentTime);
        
        // If the new detection is a valid note, start a new one
        if (detectedNote) {
          this.startNewNote(detectedNote, relativeTime);
        }
      }
      // If detectedNote is the same, we just continue (do nothing)
    } else {
      // No active note, but we detected one -> start it
      if (detectedNote) {
        this.startNewNote(detectedNote, relativeTime);
      }
    }
  }

  private startNewNote(pitch: string, startTime: number) {
    this.activeNote = {
      pitch,
      startTime
    };
  }

  private finishActiveNote(endTime: number = performance.now()) {
    if (!this.activeNote) return;

    const duration = endTime - (this.startTime + this.activeNote.startTime);
    
    // Filter out very short blips (e.g. < 50ms) if desired, 
    // but the stabilizer should have handled most jitter.
    if (duration > 50) {
      const newNote: Note = {
        id: crypto.randomUUID(),
        pitch: this.activeNote.pitch,
        startTime: this.activeNote.startTime,
        duration: duration
      };

      this.notes.push(newNote);
      if (this.onNoteRecorded) {
        this.onNoteRecorded(newNote);
      }
    }

    this.activeNote = null;
  }

  getNotes() {
    return this.notes;
  }
}
