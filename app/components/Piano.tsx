"use client"

import { useEffect, useState } from 'react'
import * as Tone from 'tone'

export const Piano = () => {
  const [synth, setSynth] = useState<Tone.PolySynth | null>(null)

  useEffect(() => {
    const newSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.01, decay: 0.1, sustain: 0.3, release: 1 }
    }).toDestination()

    setSynth(newSynth)

    return () => {
      newSynth.dispose()
    }
  }, [])

  const playNote = (note: string) => {
    if (!synth) return
    Tone.start()
    synth.triggerAttack(note)
  }

  const stopNote = (note: string) => {
    if (!synth) return
    synth.triggerRelease(note)
  }

  const octaves = [3, 4, 5, 6]

  return (
    <div className='flex overflow-x-auto p-4 bg-gray-900 min-h-[200px] items-center'>
      {octaves.map(octave => (
        <div key={octave} className='flex shrink-0'>
          <Key note={`C${octave}`} blackNote={`C#${octave}`} onPlay={playNote} onStop={stopNote} />
          <Key note={`D${octave}`} blackNote={`D#${octave}`} onPlay={playNote} onStop={stopNote} />
          <Key note={`E${octave}`} onPlay={playNote} onStop={stopNote} />
          <Key note={`F${octave}`} blackNote={`F#${octave}`} onPlay={playNote} onStop={stopNote} />
          <Key note={`G${octave}`} blackNote={`G#${octave}`} onPlay={playNote} onStop={stopNote} />
          <Key note={`A${octave}`} blackNote={`A#${octave}`} onPlay={playNote} onStop={stopNote} />
          <Key note={`B${octave}`} onPlay={playNote} onStop={stopNote} />
        </div>
      ))}
      
      <div className='flex shrink-0'>
        <Key note='C7' onPlay={playNote} onStop={stopNote} />
      </div>
    </div>
  )
}