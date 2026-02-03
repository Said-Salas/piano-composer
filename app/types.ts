export type Note = {
    id: string
    pitch: string
    startTime: number
    duration: number
    color?: string
}

export type Song = {
    title: string
    notes: Note[]
    bpm: number
}