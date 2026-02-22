-- Create songs table
create table public.songs (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  user_id uuid references auth.users not null,
  title text not null default 'Untitled Song',
  bpm integer default 120,
  notes jsonb not null default '[]'::jsonb
);

-- Enable Row Level Security (RLS)
alter table public.songs enable row level security;

-- Create policies
create policy "Users can view their own songs"
  on public.songs for select
  using (auth.uid() = user_id);

create policy "Users can insert their own songs"
  on public.songs for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own songs"
  on public.songs for update
  using (auth.uid() = user_id);

create policy "Users can delete their own songs"
  on public.songs for delete
  using (auth.uid() = user_id);
