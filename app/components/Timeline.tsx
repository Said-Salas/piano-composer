import { Note } from "../types";

interface TimelineProps {
  notes: Note[];
}

export default function Timeline({ notes }: TimelineProps) {
  if (notes.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500 border border-dashed border-gray-700 rounded-lg">
        No notes recorded yet. Play something!
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto border border-gray-800 rounded-lg bg-gray-900/50 p-4">
      <div className="flex gap-2 min-w-max pb-2">
        {notes.map((note, index) => (
          <div
            key={note.id}
            className="flex flex-col items-center justify-center p-2 bg-gray-800 rounded border border-gray-700 min-w-[60px]"
          >
            <span className="text-xs text-gray-400 mb-1">{index + 1}</span>
            <span className="text-lg font-bold text-white">{note.pitch}</span>
            <div className="text-[10px] text-gray-500 mt-1 flex flex-col items-center">
              <span>{(note.startTime / 1000).toFixed(2)}s</span>
              <span>{(note.duration / 1000).toFixed(2)}s</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
