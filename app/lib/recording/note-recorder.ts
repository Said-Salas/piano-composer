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

  // Manually record a note (e.g. from digital piano click)
  recordManualNote(pitch: string) {
    if (!this.isRecording) return;
    
    const currentTime = performance.now();
    const relativeTime = currentTime - this.startTime;
    
    this.recordNewNote(pitch, relativeTime, true);
    
    // For manual notes, we do not want to set activeNote.
    // Setting activeNote = null ensures that if the microphone ALSO picks up the digital piano sound,
    // the process() method won't get confused. However, we need to prevent double entry if both trigger.
    // The boolean flag `isManual` handles this by temporarily blocking the microphone from recording the same note.
  }

  private recordNewNote(pitch: string, startTime: number, isManual: boolean) {
    // If a manual note just triggered, don't let the microphone record the exact same note immediately
    if (!isManual && this.notes.length > 0) {
      const lastNote = this.notes[this.notes.length - 1];
      // If the microphone tries to record the same pitch within 300ms of a manual click, block it.
      if (lastNote.pitch === pitch && (startTime - lastNote.startTime) < 300) {
        return;
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
