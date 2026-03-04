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
      if (detectedNote !== this.activeNote.pitch) {
        // Only stop tracking if we actually have a different note or silence
        this.activeNote = null;
        
        if (detectedNote) {
          this.recordNewNote(detectedNote, relativeTime, false);
        }
      }
    } else {
      if (detectedNote) {
        this.recordNewNote(detectedNote, relativeTime, false);
      }
    }
  }

  private manualNoteBlocks: Map<string, number> = new Map();
  private lastManualNoteTime: Map<string, number> = new Map();

  // Manually record a note (e.g. from digital piano click)
  recordManualNote(pitch: string) {
    if (!this.isRecording) return;
    
    const currentTime = performance.now();

    // Debounce manual clicks (prevent double-firing from UI bugs or touch screens)
    const lastTime = this.lastManualNoteTime.get(pitch) || 0;
    if (currentTime - lastTime < 150) {
      return; 
    }
    this.lastManualNoteTime.set(pitch, currentTime);

    const relativeTime = currentTime - this.startTime;
    
    this.recordNewNote(pitch, relativeTime, true);
    
    // Block microphone from recording this same pitch for 1.5 seconds
    // because the digital piano sound will ring out and be picked up by the mic.
    this.manualNoteBlocks.set(pitch, currentTime + 1500);
  }

  private recordNewNote(pitch: string, startTime: number, isManual: boolean) {
    if (!isManual) {
      // Check if this pitch is blocked because it was just played on the digital piano
      const blockUntil = this.manualNoteBlocks.get(pitch);
      if (blockUntil && performance.now() < blockUntil) {
        return; // Ignore this mic input
      }
    }

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

    if (!isManual) {
      this.activeNote = {
        pitch,
        startTime
      };
    } else {
      // Clear active note so the microphone starts fresh
      this.activeNote = null;
    }
  }

  getNotes() {
    return this.notes;
  }
}
