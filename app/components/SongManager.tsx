import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { Note } from "../types";

export interface SavedSong {
  id: string;
  title: string;
  created_at: string;
  notes: Note[];
}

export function SongManager({ 
  currentNotes, 
  onLoadSong 
}: { 
  currentNotes: Note[], 
  onLoadSong: (notes: Note[]) => void 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [songs, setSongs] = useState<SavedSong[]>([]);
  const [loading, setLoading] = useState(false);
  const [songTitle, setSongTitle] = useState("");
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchSongs();
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchSongs();
      else setSongs([]);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchSongs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('songs')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) console.error('Error fetching songs:', error);
    else setSongs(data || []);
    setLoading(false);
  };

  const saveSong = async () => {
    if (!user) return alert("Please sign in to save songs");
    if (!songTitle.trim()) return alert("Please enter a song title");
    if (currentNotes.length === 0) return alert("Record some notes first!");

    setLoading(true);
    const { error } = await supabase.from('songs').insert({
      user_id: user.id,
      title: songTitle,
      notes: currentNotes
    });

    if (error) {
      alert("Error saving song: " + error.message);
    } else {
      setSongTitle("");
      fetchSongs();
      alert("Song saved!");
    }
    setLoading(false);
  };

  const loadSong = (song: SavedSong) => {
    onLoadSong(song.notes);
    setIsOpen(false);
  };

  const deleteSong = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this song?")) return;
    
    const { error } = await supabase.from('songs').delete().match({ id });
    if (error) alert("Error deleting song");
    else fetchSongs();
  };

  if (!user) return null;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-full font-medium transition-colors text-sm border border-gray-700 flex items-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
        </svg>
        My Songs
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col shadow-2xl">
            <div className="p-6 border-b border-gray-800 flex justify-between items-center">
              <h2 className="text-xl font-bold text-white">My Songs</h2>
              <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 border-b border-gray-800 bg-gray-900/50">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Save Current Recording</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={songTitle}
                  onChange={(e) => setSongTitle(e.target.value)}
                  placeholder="Enter song title..."
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={saveSong}
                  disabled={loading || currentNotes.length === 0}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
                >
                  Save
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {loading && songs.length === 0 ? (
                <div className="text-center py-8 text-gray-500">Loading songs...</div>
              ) : songs.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No saved songs yet.</div>
              ) : (
                <div className="flex flex-col gap-1">
                  {songs.map((song) => (
                    <div
                      key={song.id}
                      onClick={() => loadSong(song)}
                      className="p-3 hover:bg-gray-800 rounded-lg cursor-pointer group flex justify-between items-center transition-colors"
                    >
                      <div>
                        <div className="font-medium text-white">{song.title}</div>
                        <div className="text-xs text-gray-500">
                          {new Date(song.created_at).toLocaleDateString()} • {song.notes.length} notes
                        </div>
                      </div>
                      <button
                        onClick={(e) => deleteSong(song.id, e)}
                        className="p-2 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
