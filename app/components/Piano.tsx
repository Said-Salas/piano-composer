"use client";

import { useEffect, useState, useRef } from "react";
import * as Tone from "tone";
import { getNoteColor } from "../lib/audio/note-utils";

interface PianoProps {
  highlightedNote?: string | null;
  onNotePlay?: (note: string) => void;
}

export default function Piano({ highlightedNote, onNotePlay }: PianoProps) {
  const [sampler, setSampler] = useState<Tone.Sampler | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize Audio Engine with Sampler
  useEffect(() => {
    const newSampler = new Tone.Sampler({
      urls: {
        A0: "A0.mp3",
        C1: "C1.mp3",
        "D#1": "Ds1.mp3",
        "F#1": "Fs1.mp3",
        A1: "A1.mp3",
        C2: "C2.mp3",
        "D#2": "Ds2.mp3",
        "F#2": "Fs2.mp3",
        A2: "A2.mp3",
        C3: "C3.mp3",
        "D#3": "Ds3.mp3",
        "F#3": "Fs3.mp3",
        A3: "A3.mp3",
        C4: "C4.mp3",
        "D#4": "Ds4.mp3",
        "F#4": "Fs4.mp3",
        A4: "A4.mp3",
        C5: "C5.mp3",
        "D#5": "Ds5.mp3",
        "F#5": "Fs5.mp3",
        A5: "A5.mp3",
        C6: "C6.mp3",
        "D#6": "Ds6.mp3",
        "F#6": "Fs6.mp3",
        A6: "A6.mp3",
        C7: "C7.mp3",
        "D#7": "Ds7.mp3",
        "F#7": "Fs7.mp3",
        A7: "A7.mp3",
        C8: "C8.mp3"
      },
      release: 4,
      baseUrl: "https://tonejs.github.io/audio/salamander/",
      onload: () => {
        setIsLoaded(true);
      }
    }).toDestination();
    
    setSampler(newSampler);

    // Cleanup
    return () => {
      newSampler.dispose();
    };
  }, []);

  const playNote = (note: string) => {
    if (!sampler || !isLoaded) return;
    // Tone.start() is required by browsers on first interaction
    Tone.start(); 
    sampler.triggerAttack(note);
    
    if (onNotePlay) {
      onNotePlay(note);
    }
  };

  const stopNote = (note: string) => {
    if (!sampler || !isLoaded) return;
    sampler.triggerRelease(note);
  };

  // Generate 4 octaves for the demo (C3 to B6)
  const octaves = [2, 3, 4, 5, 6];

  return (
    <div className="w-full max-w-full relative">
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 z-50 rounded-xl">
          <div className="text-blue-400 font-medium animate-pulse">Loading Piano Sounds...</div>
        </div>
      )}
      
      <div 
        ref={containerRef}
        className="flex overflow-x-auto p-4 bg-gray-900 min-h-[200px] items-center rounded-xl border border-gray-800 shadow-xl scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-800 w-full"
      >
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

  return (
    <div className="relative">
      {/* White Key */}
      <button
        className={`w-12 h-40 border border-gray-300 rounded-b-md active:bg-gray-200 flex items-end justify-center pb-2 z-10 hover:bg-gray-50 transition-all duration-75 ${
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
          className={`absolute w-8 h-24 border border-gray-800 rounded-b-sm z-20 top-0 -right-4 active:bg-gray-800 transition-all duration-75 ${
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
