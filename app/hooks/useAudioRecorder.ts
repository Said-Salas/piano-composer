import { useState, useRef, useEffect, useCallback } from "react";
import { AudioPitchAnalyzer } from "../lib/audio/pitch";
import { MonophonicNoteDetector } from "../lib/audio/note-stabilizer";
import { NoteRecorder } from "../lib/recording/note-recorder";
import { SongPlayer } from "../lib/audio/player";
import { Note } from "../types";
import { supabase } from "../lib/supabase";
import * as Tone from "tone";

export function useAudioRecorder() {
  const [isAudioReady, setIsAudioReady] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [detectedNote, setDetectedNote] = useState<string | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [volume, setVolume] = useState(0);

  const analyzerRef = useRef<AudioPitchAnalyzer | null>(null);
  const detectorRef = useRef<MonophonicNoteDetector | null>(null);
  const recorderRef = useRef<NoteRecorder | null>(null);
  const playerRef = useRef<SongPlayer | null>(null);
  const samplerRef = useRef<Tone.Sampler | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  
  // Use a ref to track recording state inside the animation loop
  const isRecordingRef = useRef(false);
  const isPlayingRef = useRef(false);

  // Initialize audio engine
  const initializeAudio = useCallback(async () => {
    if (analyzerRef.current) return;

    try {
      analyzerRef.current = new AudioPitchAnalyzer();
      detectorRef.current = new MonophonicNoteDetector();
      recorderRef.current = new NoteRecorder((note) => {
        setNotes((prev) => [...prev, note]);
      });

      // Initialize Sampler for playback
      samplerRef.current = new Tone.Sampler({
        urls: {
          A0: "A0.mp3", C1: "C1.mp3", "D#1": "Ds1.mp3", "F#1": "Fs1.mp3", A1: "A1.mp3",
          C2: "C2.mp3", "D#2": "Ds2.mp3", "F#2": "Fs2.mp3", A2: "A2.mp3",
          C3: "C3.mp3", "D#3": "Ds3.mp3", "F#3": "Fs3.mp3", A3: "A3.mp3",
          C4: "C4.mp3", "D#4": "Ds4.mp3", "F#4": "Fs4.mp3", A4: "A4.mp3",
          C5: "C5.mp3", "D#5": "Ds5.mp3", "F#5": "Fs5.mp3", A5: "A5.mp3",
          C6: "C6.mp3", "D#6": "Ds6.mp3", "F#6": "Fs6.mp3", A6: "A6.mp3",
          C7: "C7.mp3", "D#7": "Ds7.mp3", "F#7": "Fs7.mp3", A7: "A7.mp3",
          C8: "C8.mp3"
        },
        release: 4,
        baseUrl: "https://tonejs.github.io/audio/salamander/",
      }).toDestination();

      playerRef.current = new SongPlayer(samplerRef.current);

      await analyzerRef.current.start();
      setIsAudioReady(true);
      
      // Persist state
      localStorage.setItem("mic_enabled", "true");
      
      // Start the loop
      const loop = () => {
        // Update playback time if playing
        if (isPlayingRef.current) {
          setPlaybackTime(Tone.Transport.seconds);
        } else if (Tone.Transport.state !== "started" && playbackTime !== 0) {
          // Reset if stopped externally or finished
          // Actually, let's keep the last position or reset?
          // For now, reset to 0 when not playing is simpler for UI
          // But we need to be careful not to flicker.
          // Let's just rely on isPlaying state to reset in the UI or here.
        }

        if (!analyzerRef.current || !detectorRef.current) {
           animationFrameRef.current = requestAnimationFrame(loop);
           return;
        }

        const { frequency, clarity } = analyzerRef.current.getPitch();
        
        // Boost clarity for testing and debugging, or use volume if it's very loud
        const effectiveClarity = clarity;

        setVolume(effectiveClarity);

        const stableNote = detectorRef.current.process(frequency, effectiveClarity);
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

  const playSong = useCallback(async () => {
    if (!playerRef.current || notes.length === 0) return;
    setIsPlaying(true);
    isPlayingRef.current = true;
    await playerRef.current.play(notes, () => {
      setIsPlaying(false);
      isPlayingRef.current = false;
      setPlaybackTime(0);
    });
  }, [notes]);

  const stopSong = useCallback(() => {
    if (!playerRef.current) return;
    playerRef.current.stop();
    setIsPlaying(false);
    isPlayingRef.current = false;
    setPlaybackTime(0);
  }, []);

  const updateNote = useCallback((id: string, updates: Partial<Note>) => {
    setNotes(prevNotes => 
      prevNotes.map(note => 
        note.id === id ? { ...note, ...updates } : note
      )
    );
  }, []);

  const addManualNote = useCallback((pitch: string) => {
    if (!isRecordingRef.current || !recorderRef.current) return;
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
      if (playerRef.current) {
        playerRef.current.stop();
      }
      if (samplerRef.current) {
        samplerRef.current.dispose();
      }
    };
  }, []);

  return {
    isAudioReady,
    isRecording,
    isPlaying,
    playbackTime,
    detectedNote,
    notes,
    volume,
    setNotes,
    initializeAudio,
    startRecording,
    stopRecording,
    playSong,
    stopSong,
    updateNote,
    addManualNote
  };
}
