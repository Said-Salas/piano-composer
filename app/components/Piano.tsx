"use client"

import { useEffect, useState } from 'react'
import * as Tone from 'tone'

export const Piano = () => {
    const [synth, setSynth] = useState<Tone.PolySynth | null>(null)

    useEffect(() => {
        const newSynth = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: 'triangle'},
            envelope: {attack: 0.01, decay: 0.1, sustain: 0.3, release: 1}
        }).toDestination()
    
        setSynth(newSynth)

        return () => { 
            newSynth.dispose()
        }
    }, [])

    const playNote = (note: string) => {
        if(!synth) return
        Tone.start()
        synth.triggerAttack(note)
    }

}



