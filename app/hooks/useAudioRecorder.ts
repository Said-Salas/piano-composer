import { useState, useRef, useEffect, useCallback } from "react";
import { AudioPitchAnalyzer } from "../lib/audio/pitch";
import { MonophonicNoteDetector } from "../lib/audio/note-stabilizer";
import { NoteRecorder } from "../lib/recording/note-recorder";
import { Note } from "../types";

export function useAudioRecorder() {
  const [isAudioReady, setIsAudioReady] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [detectedNote, setDetectedNote] = useState<string | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);

  const analyzerRef = useRef<AudioPitchAnalyzer | null>(null);
  const detectorRef = useRef<MonophonicNoteDetector | null>(null);
  const recorderRef = useRef<NoteRecorder | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  
  // Use a ref to track recording state inside the animation loop
  const isRecordingRef = useRef(false);

  // Initialize audio engine
  const initializeAudio = useCallback(async () => {
    if (analyzerRef.current) return;

    try {
      analyzerRef.current = new AudioPitchAnalyzer();
      detectorRef.current = new MonophonicNoteDetector();
      recorderRef.current = new NoteRecorder((note) => {
        setNotes((prev) => [...prev, note]);
      });

      await analyzerRef.current.start();
      setIsAudioReady(true);
      
      // Start the loop
      const loop = () => {
        if (!analyzerRef.current || !detectorRef.current) return;

        const { frequency, clarity } = analyzerRef.current.getPitch();
        const stableNote = detectorRef.current.process(frequency, clarity);

        setDetectedNote(stableNote);

        if (recorderRef.current && isRecordingRef.current) {
          recorderRef.current.process(stableNote);
        }

        animationFrameRef.current = requestAnimationFrame(loop);
      };
      loop();
      
    } catch (err) {
      console.error("Failed to initialize audio:", err);
      setIsAudioReady(false);
    }
  }, []);

  const startRecording = useCallback(() => {
    if (!recorderRef.current) return;
    setNotes([]); // Clear previous notes
    recorderRef.current.start();
    setIsRecording(true);
    isRecordingRef.current = true;
  }, []);

  const stopRecording = useCallback(() => {
    if (!recorderRef.current) return;
    recorderRef.current.stop();
    setIsRecording(false);
    isRecordingRef.current = false;
  }, []);

  const updateNote = useCallback((id: string, updates: Partial<Note>) => {
    setNotes(prevNotes => 
      prevNotes.map(note => 
        note.id === id ? { ...note, ...updates } : note
      )
    );
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (analyzerRef.current) {
        analyzerRef.current.stop();
      }
    };
  }, []);

  return {
    isAudioReady,
    isRecording,
    detectedNote,
    notes,
    initializeAudio,
    startRecording,
    stopRecording,
    updateNote
  };
}
