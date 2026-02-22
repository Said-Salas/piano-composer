import { useState, useRef, useEffect } from "react";
import { Note } from "../types";
import { getNoteColor, noteNameToMidi } from "../lib/audio/note-utils";

interface TimelineProps {
  notes: Note[];
  onUpdateNote?: (id: string, updates: Partial<Note>) => void;
}

export default function Timeline({ notes, onUpdateNote }: TimelineProps) {
  // Constants
  const PIXELS_PER_SECOND = 100;
  const ROW_HEIGHT = 40; // Taller rows for better visibility
  const NOTE_CLASSES = ["B", "A#", "A", "G#", "G", "F#", "F", "E", "D#", "D", "C#", "C"]; // Top to bottom
  const TOTAL_ROWS = NOTE_CLASSES.length;
  
  // Calculate total width based on last note end time
  const lastNoteEnd = notes.reduce((max, note) => Math.max(max, note.startTime + note.duration), 0);
  const containerWidth = Math.max((lastNoteEnd / 1000) * PIXELS_PER_SECOND + 400, 1200);

  // Resize state
  const [resizingNoteId, setResizingNoteId] = useState<string | null>(null);
  const resizeStartXRef = useRef<number>(0);
  const resizeStartDurationRef = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle resize
  const handleResizeStart = (e: React.MouseEvent, note: Note) => {
    e.stopPropagation();
    e.preventDefault();
    setResizingNoteId(note.id);
    resizeStartXRef.current = e.clientX;
    resizeStartDurationRef.current = note.duration;
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizingNoteId || !onUpdateNote) return;
      
      const deltaX = e.clientX - resizeStartXRef.current;
      const deltaDuration = (deltaX / PIXELS_PER_SECOND) * 1000;
      const newDuration = Math.max(100, resizeStartDurationRef.current + deltaDuration); // Min 100ms
      
      onUpdateNote(resizingNoteId, { duration: newDuration });
    };

    const handleMouseUp = () => {
      setResizingNoteId(null);
    };

    if (resizingNoteId) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [resizingNoteId, onUpdateNote]);

  return (
    <div 
      ref={containerRef}
      className="w-full h-[500px] overflow-auto border border-gray-800 rounded-lg bg-gray-950 relative shadow-inner scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900 select-none"
    >
      <div 
        className="relative" 
        style={{ 
          height: `${TOTAL_ROWS * ROW_HEIGHT}px`,
          width: `${containerWidth}px`
        }}
      >
        {/* Grid Background */}
        {NOTE_CLASSES.map((noteClass, i) => {
           const isBlackKey = noteClass.includes("#");
           
           return (
             <div 
               key={noteClass} 
               className={`absolute w-full border-b border-gray-800/50 box-border flex items-center ${isBlackKey ? "bg-gray-900/50" : "bg-gray-900/10"}`}
               style={{ 
                 top: i * ROW_HEIGHT, 
                 height: ROW_HEIGHT 
               }}
             >
               {/* Note Labels on the left */}
               <span className="sticky left-0 text-xs font-bold text-gray-500 px-2 bg-gray-900/90 z-10 h-full flex items-center border-r border-gray-800 w-12 justify-center">
                 {noteClass}
               </span>
             </div>
           );
        })}

        {/* Vertical Time Grid Lines (every second) */}
        {Array.from({ length: Math.ceil(containerWidth / PIXELS_PER_SECOND) }).map((_, i) => (
          <div
            key={i}
            className="absolute top-0 bottom-0 border-r border-gray-800/30 pointer-events-none"
            style={{ left: i * PIXELS_PER_SECOND }}
          >
            <span className="sticky top-0 text-[10px] text-gray-600 pl-1 bg-gray-950/50">
              {i}s
            </span>
          </div>
        ))}

        {/* Notes */}
        {notes.map((note) => {
          // Extract note class (e.g. "C#4" -> "C#")
          const match = note.pitch.match(/^([A-G]#?)/);
          if (!match) return null;
          const noteClass = match[1];
          
          const rowIndex = NOTE_CLASSES.indexOf(noteClass);
          if (rowIndex === -1) return null;
          
          const top = rowIndex * ROW_HEIGHT;
          const left = (note.startTime / 1000) * PIXELS_PER_SECOND;
          const width = (note.duration / 1000) * PIXELS_PER_SECOND;
          const colorClass = getNoteColor(note.pitch);

          return (
            <div
              key={note.id}
              className={`absolute rounded-md border border-white/20 shadow-sm flex items-center justify-center overflow-hidden ${colorClass} hover:brightness-110 transition-colors cursor-grab active:cursor-grabbing group`}
              style={{
                top: `${top + 4}px`, // +4 for spacing
                left: `${left}px`,
                width: `${Math.max(width, 10)}px`, // Min visual width
                height: `${ROW_HEIGHT - 8}px`, // -8 for spacing
                zIndex: 20
              }}
            >
              <span className="text-xs font-bold text-white/90 drop-shadow-md px-1 truncate pointer-events-none">
                {note.pitch}
              </span>
              
              {/* Resize Handle */}
              {onUpdateNote && (
                <div 
                  className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize hover:bg-white/30 active:bg-white/50 transition-colors z-30"
                  onMouseDown={(e) => handleResizeStart(e, note)}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
