import * as Tone from "tone";
import { Note } from "@/app/types";

export class SongPlayer {
  private sampler: Tone.Sampler | null = null;
  private isPlaying: boolean = false;
  private currentPart: Tone.Part | null = null;
  private onPlaybackEnd: (() => void) | null = null;

  constructor(sampler: Tone.Sampler) {
    this.sampler = sampler;
  }

  async play(notes: Note[], onEnd?: () => void) {
    if (!this.sampler || notes.length === 0) return;
    
    this.stop(); // Stop any current playback
    this.isPlaying = true;
    this.onPlaybackEnd = onEnd || null;

    await Tone.start();
    Tone.Transport.cancel(); // Clear previous events

    // Sort notes by start time
    const sortedNotes = [...notes].sort((a, b) => a.startTime - b.startTime);
    
    // Calculate total duration
    const lastNote = sortedNotes[sortedNotes.length - 1];
    const totalDuration = (lastNote.startTime + lastNote.duration) / 1000; // seconds

    // Schedule notes
    // Tone.Part expects events in format: [time, value]
    // We'll use seconds for time
    const events = sortedNotes.map(note => ({
      time: note.startTime / 1000,
      note: note.pitch,
      duration: note.duration / 1000
    }));

    this.currentPart = new Tone.Part((time, event) => {
      this.sampler?.triggerAttackRelease(event.note, event.duration, time);
    }, events).start(0);

    // Schedule end callback
    Tone.Transport.scheduleOnce(() => {
      this.stop();
      if (this.onPlaybackEnd) this.onPlaybackEnd();
    }, totalDuration + 0.5); // Add buffer

    Tone.Transport.start();
  }

  stop() {
    if (!this.isPlaying) return;
    
    Tone.Transport.stop();
    Tone.Transport.cancel();
    if (this.currentPart) {
      this.currentPart.dispose();
      this.currentPart = null;
    }
    
    this.isPlaying = false;
  }

  getIsPlaying() {
    return this.isPlaying;
  }
}
