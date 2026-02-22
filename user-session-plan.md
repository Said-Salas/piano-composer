# User Session & Recording Persistence Plan

## Overview
To allow users to save their recordings and access them across devices, we will implement a user session system using **Google OAuth** and a cloud database.

## Technology Stack
- **Authentication**: Supabase Auth (Google Provider) or NextAuth.js (with Google Provider).
  - *Recommendation*: **Supabase Auth** is easiest to integrate if we also use Supabase for the database.
- **Database**: Supabase (PostgreSQL).
- **Frontend**: Existing Next.js App Router.

## Data Model

### `users` (Managed by Auth Provider)
- `id`: UUID (Primary Key)
- `email`: String
- `full_name`: String
- `avatar_url`: String

### `songs`
- `id`: UUID (Primary Key)
- `user_id`: UUID (Foreign Key -> users.id)
- `title`: String
- `created_at`: Timestamp
- `updated_at`: Timestamp
- `bpm`: Integer (default 120)
- `notes`: JSONB (Stores the array of Note objects)
  - Structure: `[{ id, pitch, startTime, duration }, ...]`

## Implementation Steps

### Phase 1: Infrastructure Setup
1.  **Create Supabase Project**: Set up a new project in Supabase dashboard.
2.  **Configure Auth**: Enable Google Provider in Supabase Auth settings.
3.  **Create Tables**: Run SQL to create `songs` table with Row Level Security (RLS) policies.
    - Policy: Users can only select/insert/update/delete their own songs (`auth.uid() = user_id`).

### Phase 2: Client Integration
1.  **Install Dependencies**: `npm install @supabase/supabase-js`
2.  **Environment Variables**: Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to `.env.local`.
3.  **Auth Component**: Create a `LoginButton` component that triggers `supabase.auth.signInWithOAuth({ provider: 'google' })`.
4.  **Session Management**: Use `onAuthStateChange` to track the logged-in user and store in React Context or Zustand store.

### Phase 3: Song Management
1.  **Save Functionality**:
    - Add "Save Song" button in the UI.
    - Opens a modal to name the song.
    - Calls `supabase.from('songs').insert({ ... })`.
2.  **Load Functionality**:
    - Add "My Songs" sidebar or modal.
    - Fetches `supabase.from('songs').select('*').order('created_at', { ascending: false })`.
    - Clicking a song loads the `notes` into the `useAudioRecorder` state.

### Phase 4: UI Updates
1.  **Header**: Add User Avatar / Logout button when logged in.
2.  **Song Title**: Display current song title in the header.
3.  **Feedback**: Add toast notifications for "Saving...", "Saved!", "Error".

## Security Considerations
- **RLS (Row Level Security)** is critical. Ensure no user can access another user's songs via the API.
- **Validation**: Validate the `notes` JSON structure before saving to prevent corrupted data.

## Future Enhancements
- **Sharing**: Allow users to make songs "public" and share a link.
- **Collaboration**: Real-time editing (advanced).
