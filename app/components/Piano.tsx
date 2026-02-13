"use client";

import { useEffect, useState } from "react";
import * as Tone from "tone";

export default function Piano() {
  const [synth, setSynth] = useState<Tone.PolySynth | null>(null);

  // Initialize Audio Engine
  useEffect(() => {
    const newSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" }, // Simpler, softer sound
      envelope: { attack: 0.01, decay: 0.1, sustain: 0.3, release: 1 },
    }).toDestination();
    
    setSynth(newSynth);

    // Cleanup
    return () => {
      newSynth.dispose();
    };
  }, []);

  const playNote = (note: string) => {
    if (!synth) return;
    // Tone.start() is required by browsers on first interaction
    Tone.start(); 
    synth.triggerAttack(note);
  };

  const stopNote = (note: string) => {
    if (!synth) return;
    synth.triggerRelease(note);
  };

  // Generate 4 octaves for the demo (C3 to B6)
  const octaves = [3, 4, 5, 6];

  return (
    <div className="flex overflow-x-auto p-4 bg-gray-900 min-h-[200px] items-center">
      {octaves.map((octave) => (
        <div key={octave} className="flex shrink-0">
          {/* C Group */}
          <Key note={`C${octave}`} blackNote={`C#${octave}`} onPlay={playNote} onStop={stopNote} />
          <Key note={`D${octave}`} blackNote={`D#${octave}`} onPlay={playNote} onStop={stopNote} />
          <Key note={`E${octave}`} onPlay={playNote} onStop={stopNote} />
          
          {/* F Group */}
          <Key note={`F${octave}`} blackNote={`F#${octave}`} onPlay={playNote} onStop={stopNote} />
          <Key note={`G${octave}`} blackNote={`G#${octave}`} onPlay={playNote} onStop={stopNote} />
          <Key note={`A${octave}`} blackNote={`A#${octave}`} onPlay={playNote} onStop={stopNote} />
          <Key note={`B${octave}`} onPlay={playNote} onStop={stopNote} />
        </div>
      ))}
    </div>
  );
}

// Sub-component for individual keys
function Key({
  note,
  blackNote,
  onPlay,
  onStop,
}: {
  note: string;
  blackNote?: string;
  onPlay: (n: string) => void;
  onStop: (n: string) => void;
}) {
  return (
    <div className="relative">
      {/* White Key */}
      <button
        className="w-12 h-40 bg-white border border-gray-300 rounded-b-md active:bg-gray-200 flex items-end justify-center pb-2 z-10 hover:bg-gray-50"
        onMouseDown={() => onPlay(note)}
        onMouseUp={() => onStop(note)}
        onMouseLeave={() => onStop(note)}
      >
        <span className="text-gray-500 text-xs font-bold">{note}</span>
      </button>

      {/* Black Key (Overlay) */}
      {blackNote && (
        <button
          className="absolute w-8 h-24 bg-black border border-gray-800 rounded-b-sm z-20 top-0 -right-4 active:bg-gray-800"
          onMouseDown={(e) => {
            e.stopPropagation(); // Prevent triggering the white key
            onPlay(blackNote);
          }}
          onMouseUp={(e) => {
            e.stopPropagation();
            onStop(blackNote);
          }}
          onMouseLeave={(e) => {
             e.stopPropagation();
             onStop(blackNote);
          }}
        />
      )}
    </div>
  );
}