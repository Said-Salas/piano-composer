import { useState, useRef, useEffect, useCallback } from "react";
import { AudioPitchAnalyzer } from "../lib/audio/pitch";
import { MonophonicNoteDetector } from "../lib/audio/note-stabilizer";
import { NoteRecorder } from "../lib/recording/note-recorder";
import { Note } from "../types";
import { supabase } from "../lib/supabase";

export function useAudioRecorder() {
  const [isAudioReady, setIsAudioReady] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [detectedNote, setDetectedNote] = useState<string | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [volume, setVolume] = useState(0);

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
      
      // Persist state
      localStorage.setItem("mic_enabled", "true");
      
      // Start the loop
      const loop = () => {
        if (!analyzerRef.current || !detectorRef.current) return;

        const { frequency, clarity } = analyzerRef.current.getPitch();
        
        // Simple volume estimation for visual feedback
        // We can get this from the clarity or add a method to analyzer
        // For now, let's use clarity as a proxy for signal strength/quality
        setVolume(clarity);

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
      localStorage.removeItem("mic_enabled");
    }
  }, []);

  // Auto-start if previously enabled and user is logged in
  useEffect(() => {
    const checkAutoStart = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const micEnabled = localStorage.getItem("mic_enabled");
      
      if (session?.user && micEnabled === "true") {
        initializeAudio();
      }
    };
    
    checkAutoStart();
  }, [initializeAudio]);

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

  // Manual note addition (for digital piano)
  const addManualNote = useCallback((pitch: string) => {
    if (!isRecordingRef.current || !recorderRef.current) return;
    
    // Simulate a detected note for the recorder
    // We need to simulate "Note On" then "Note Off"
    // But since our recorder is designed for continuous stream, 
    // we can just directly inject a note into the notes array
    // OR we can feed the recorder.
    
    // Better: use the recorder's internal logic if possible, or just bypass it for manual triggers
    // Since digital keys are instantaneous "presses", we can just add a note with default duration
    
    const newNote: Note = {
      id: crypto.randomUUID(),
      pitch,
      startTime: performance.now() - (recorderRef.current['startTime'] || 0), // Hacky access to private prop? No.
      duration: 1000 // Default duration
    };
    
    // Actually, we should just use the setNotes directly if we are recording
    // But we need the correct relative start time
    
    // Let's expose a public method on recorder or just duplicate the logic
    // The recorder tracks start time.
    
    // Let's just feed the recorder "process" with the note for a few frames? No.
    
    // Let's add a public method to recorder: recordManualNote(pitch)
    recorderRef.current.recordManualNote(pitch);
    
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
    volume,
    setNotes,
    initializeAudio,
    startRecording,
    stopRecording,
    updateNote,
    addManualNote
  };
}
