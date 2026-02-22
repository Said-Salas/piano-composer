export const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export const NOTE_COLORS: Record<string, string> = {
  "C": "bg-purple-500",
  "C#": "bg-purple-800",
  "D": "bg-green-500",
  "D#": "bg-green-800",
  "E": "bg-yellow-500",
  "F": "bg-orange-500",
  "F#": "bg-orange-800",
  "G": "bg-red-500",
  "G#": "bg-red-800",
  "A": "bg-pink-500",
  "A#": "bg-pink-800",
  "B": "bg-blue-500",
};

export function getNoteColor(noteName: string): string {
  // Extract note name without octave (e.g. "C#4" -> "C#")
  const match = noteName.match(/^([A-G]#?)/);
  if (!match) return "bg-gray-500";
  return NOTE_COLORS[match[1]] || "bg-gray-500";
}

export function frequencyToMidi(frequency: number): number {
  if (frequency <= 0) return -1;
  return Math.round(69 + 12 * Math.log2(frequency / 440));
}

export function midiToNoteName(midi: number): string {
  if (midi < 0) return "";
  const noteIndex = midi % 12;
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[noteIndex]}${octave}`;
}

export function noteNameToMidi(noteName: string): number {
    const match = noteName.match(/^([A-G]#?)(\d+)$/);
    if (!match) return -1;
    const note = match[1];
    const octave = parseInt(match[2]);
    const noteIndex = NOTE_NAMES.indexOf(note);
    if (noteIndex === -1) return -1;
    return (octave + 1) * 12 + noteIndex;
}

export function frequencyToNote(frequency: number): string {
  const midi = frequencyToMidi(frequency);
  return midiToNoteName(midi);
}

export function isFrequencyInNoteRange(frequency: number, midi: number): boolean {
    // Check if frequency is within some cents of the target MIDI note
    // This can be used for stricter acceptance
    const targetFreq = 440 * Math.pow(2, (midi - 69) / 12);
    const ratio = frequency / targetFreq;
    const cents = 1200 * Math.log2(ratio);
    return Math.abs(cents) < 50; // Within 50 cents (quarter tone)
}
