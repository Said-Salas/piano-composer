"use client";

import { useState } from "react";
import { useAudioRecorder } from "./hooks/useAudioRecorder";
import Piano from "./components/Piano";
import Timeline from "./components/Timeline";
import { AuthButton } from "./components/AuthButton";
import { SongManager } from "./components/SongManager";
import { supabase } from "./lib/supabase";

export default function Home() {
  const {
    isAudioReady,
    isRecording,
    isPlaying,
    playbackTime,
    detectedNote,
    notes,
    volume,
    currentSong,
    canUndo,
    canRedo,
    setNotes,
    initializeAudio,
    startRecording,
    stopRecording,
    playSong,
    stopSong,
    updateNote,
    deleteNote,
    addManualNote,
    undo,
    redo,
    commitCurrentNotesToHistory,
    handleLoadSong,
    setCurrentSong
  } = useAudioRecorder();

  const [isSaving, setIsSaving] = useState(false);

  const saveChanges = async () => {
    if (!currentSong) return;
    setIsSaving(true);
    const { error } = await supabase.from('songs').update({
      notes: notes
    }).eq('id', currentSong.id);
    
    setIsSaving(false);
    if (!error) {
       alert("Changes saved successfully!");
       setCurrentSong({ ...currentSong, notes });
    } else {
       alert("Error saving: " + error.message);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-8 bg-black text-white gap-8 font-sans">
      <header className="w-full max-w-5xl flex justify-between items-center border-b border-gray-800 pb-4">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            Piano Composer
          </h1>
          <SongManager currentNotes={notes} onLoadSong={handleLoadSong} />
        </div>
        
        <div className="flex gap-4 items-center">
          <AuthButton />
          
          {!isAudioReady ? (
            <button
              onClick={initializeAudio}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-full font-medium transition-colors"
            >
              Enable Microphone
            </button>
          ) : (
            <div className="flex gap-4 items-center pl-4 border-l border-gray-800">
              <div className="flex items-center gap-2 px-3 py-1 bg-gray-900 rounded-full border border-gray-700">
                <div className={`w-2 h-2 rounded-full ${detectedNote ? "bg-green-500 animate-pulse" : "bg-gray-600"}`} />
                <span className="text-sm font-mono text-gray-400 w-8 text-center">
                  {detectedNote || "--"}
                </span>
              </div>
              
              {/* Playback Controls */}
              {notes.length > 0 && !isRecording && (
                <div className="flex gap-2">
                  {!isPlaying ? (
                    <button
                      onClick={playSong}
                      className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-full font-medium transition-colors flex items-center gap-2 border border-gray-700"
                    >
                      <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                      Play
                    </button>
                  ) : (
                    <button
                      onClick={stopSong}
                      className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-full font-medium transition-colors flex items-center gap-2 border border-gray-700"
                    >
                      <svg className="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M6 6h12v12H6z" />
                      </svg>
                      Stop
                    </button>
                  )}
                </div>
              )}

              {/* Recording Controls */}
              {!isRecording ? (
                <button
                  onClick={startRecording}
                  disabled={isPlaying}
                  className={`px-6 py-2 bg-red-600 hover:bg-red-500 rounded-full font-medium transition-colors flex items-center gap-2 ${isPlaying ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="w-3 h-3 bg-white rounded-full" />
                  Record
                </button>
              ) : (
                <button
                  onClick={stopRecording}
                  className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-full font-medium transition-colors flex items-center gap-2 border border-red-500/50"
                >
                  <div className="w-3 h-3 bg-red-500 rounded-sm animate-pulse" />
                  Stop
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      <div className="w-full max-w-5xl flex flex-col gap-8 flex-1">
        {/* Timeline Section */}
        <section className="flex flex-col gap-2">
          <div className="flex justify-between items-end">
            <div className="flex items-center gap-4">
              <h2 className="text-gray-400 text-sm uppercase tracking-wider font-semibold ml-1">
                Timeline
              </h2>
              {/* Edit Controls: Undo, Redo, Save Changes */}
              {(!isRecording && notes.length > 0) && (
                <div className="flex items-center gap-1 border-l border-gray-800 pl-4">
                  <button 
                    onClick={undo}
                    disabled={!canUndo}
                    className={`p-1.5 rounded-md flex items-center justify-center transition-colors ${canUndo ? "text-gray-300 hover:bg-gray-800" : "text-gray-700 cursor-not-allowed"}`}
                    title="Undo (Ctrl+Z)"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                    </svg>
                  </button>
                  <button 
                    onClick={redo}
                    disabled={!canRedo}
                    className={`p-1.5 rounded-md flex items-center justify-center transition-colors ${canRedo ? "text-gray-300 hover:bg-gray-800" : "text-gray-700 cursor-not-allowed"}`}
                    title="Redo (Ctrl+Shift+Z)"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" transform="scale(-1, 1)">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                    </svg>
                  </button>
                  
                  {currentSong && (
                    <button
                      onClick={saveChanges}
                      disabled={isSaving}
                      className="ml-2 px-3 py-1 text-xs bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-500/30 rounded-md font-medium transition-colors disabled:opacity-50"
                    >
                      {isSaving ? "Saving..." : "Save Changes"}
                    </button>
                  )}
                </div>
              )}
            </div>
            <p className="text-xs text-gray-600">
              Drag notes to move or resize
            </p>
          </div>
          <Timeline 
            notes={notes} 
            playbackTime={playbackTime} 
            isRecording={isRecording}
            onUpdateNote={updateNote} 
            onDeleteNote={deleteNote} 
            onUpdateNoteEnd={commitCurrentNotesToHistory} 
          />
        </section>

        {/* Piano Section */}
        <section className="flex flex-col gap-2 items-center justify-center flex-1 min-h-[300px]">
          <Piano highlightedNote={detectedNote} onNotePlay={addManualNote} />
          
          <div className="mt-8 text-center text-gray-500 max-w-md text-sm">
            <p>
              Play notes on your real piano (or sing!) to see them light up.
              <br />
              Press <strong>Record</strong> to capture your melody to the timeline.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
