"use client";

import { useEffect, useState } from "react";
import * as Tone from "tone";
import { getNoteColor } from "../lib/audio/note-utils";

interface PianoProps {
  highlightedNote?: string | null;
}

export default function Piano({ highlightedNote }: PianoProps) {
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
  const octaves = [2, 3, 4, 5, 6];

  return (
    <div className="flex flex-wrap justify-center p-4 bg-gray-900 rounded-xl border border-gray-800 shadow-xl gap-y-4">
    {octaves.map((octave) => (
      <div key={octave} className="flex shrink-0 relative">
        <Key 
          note={`C${octave}`} 
          blackNote={`C#${octave}`} 
          onPlay={playNote} 
          onStop={stopNote} 
          highlightedNote={highlightedNote}
        />
        <Key 
          note={`D${octave}`} 
          blackNote={`D#${octave}`} 
          onPlay={playNote} 
          onStop={stopNote} 
          highlightedNote={highlightedNote}
        />
        <Key 
          note={`E${octave}`} 
          onPlay={playNote} 
          onStop={stopNote} 
          highlightedNote={highlightedNote}
        />
        <Key 
          note={`F${octave}`} 
          blackNote={`F#${octave}`} 
          onPlay={playNote} 
          onStop={stopNote} 
          highlightedNote={highlightedNote}
        />
        <Key 
          note={`G${octave}`} 
          blackNote={`G#${octave}`} 
          onPlay={playNote} 
          onStop={stopNote} 
          highlightedNote={highlightedNote}
        />
        <Key 
          note={`A${octave}`} 
          blackNote={`A#${octave}`} 
          onPlay={playNote} 
          onStop={stopNote} 
          highlightedNote={highlightedNote}
        />
        <Key 
          note={`B${octave}`} 
          onPlay={playNote} 
          onStop={stopNote} 
          highlightedNote={highlightedNote}
        />
      </div>
    ))}

    <div className="flex shrink-0 relative">
       <Key 
         note="C7" 
         onPlay={playNote} 
         onStop={stopNote} 
         highlightedNote={highlightedNote}
       />
    </div>
  </div>
  );
}

// Sub-component for individual keys
function Key({
  note,
  blackNote,
  onPlay,
  onStop,
  highlightedNote,
}: {
  note: string;
  blackNote?: string;
  onPlay: (n: string) => void;
  onStop: (n: string) => void;
  highlightedNote?: string | null;
}) {
  const isWhiteActive = highlightedNote === note;
  const isBlackActive = highlightedNote === blackNote;
  
  // Get dynamic color for active state
  const whiteActiveColor = getNoteColor(note);
  const blackActiveColor = blackNote ? getNoteColor(blackNote) : "";

  // We need to map the Tailwind classes to actual colors for the shadow/border if we want to match exactly,
  // but for now let's just use the bg color class.
  // Note: Tailwind classes like "bg-purple-500" work directly.
  
  return (
    <div className="relative">
      {/* White Key */}
      <button
        className={`w-10 h-32 md:w-12 md:h-40 border border-gray-300 rounded-b-md active:bg-gray-200 flex items-end justify-center pb-2 z-10 hover:bg-gray-50 transition-all duration-75 ${
          isWhiteActive ? `${whiteActiveColor} text-white border-transparent transform scale-[0.98]` : "bg-white text-gray-500"
        }`}
        onMouseDown={() => onPlay(note)}
        onMouseUp={() => onStop(note)}
        onMouseLeave={() => onStop(note)}
      >
        <span className="text-xs font-bold">{note}</span>
      </button>

      {/* Black Key (Overlay) */}
      {blackNote && (
        <button
          className={`absolute w-6 h-20 md:w-8 md:h-24 border border-gray-800 rounded-b-sm z-20 top-0 -right-3 md:-right-4 active:bg-gray-800 transition-all duration-75 ${
            isBlackActive ? `${blackActiveColor} border-transparent transform scale-[0.98]` : "bg-black"
          }`}
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
