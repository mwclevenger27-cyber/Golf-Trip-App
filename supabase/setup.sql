-- Golf Trip App database setup.
-- Paste this whole file into Supabase > SQL Editor > New query, then press Run.
-- It is safe to run on a brand new project. Running it again does not wipe scores,
-- and it adds anything new that later versions of the app need.

create table if not exists settings (
  id int primary key default 1 check (id = 1),
  trip_name text not null default 'The Trip',
  team_a_name text not null default 'Team A',
  team_b_name text not null default 'Team B',
  team_format text not null default 'bestball' check (team_format in ('aggregate', 'bestball', 'matchplay')),
  updated_at timestamptz not null default now()
);

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  team text not null default 'A' check (team in ('A', 'B')),
  start_index numeric(4, 1) not null default 0,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists rounds (
  id uuid primary key default gen_random_uuid(),
  round_no int not null unique,
  name text not null,
  day_label text not null default '',
  play_date date,
  tee_time text not null default '',
  holes jsonb not null,
  tees jsonb not null,
  tee_name text not null,
  note text not null default ''
);

create table if not exists foursomes (
  round_id uuid not null references rounds on delete cascade,
  player_id uuid not null references players on delete cascade,
  group_no int not null,
  primary key (round_id, player_id)
);

-- One row per player per hole, so two groups saving at once never overwrite each other.
create table if not exists scores (
  round_id uuid not null references rounds on delete cascade,
  player_id uuid not null references players on delete cascade,
  hole int not null check (hole between 1 and 18),
  strokes int not null check (strokes between 1 and 20),
  updated_at timestamptz not null default now(),
  primary key (round_id, player_id, hole)
);

-- Group chat. Automatic posts (birdies, blowups, par streaks) carry an
-- event_key so each one is posted once and can be removed if a score is fixed.
create table if not exists messages (
  id bigint generated always as identity primary key,
  player_id uuid references players on delete set null,
  kind text not null default 'chat' check (kind in ('chat', 'event')),
  body text not null check (length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
alter table messages add column if not exists event_key text unique;

-- Anyone with the link can read and write. It is a private trip app, not a bank.
do $$
declare t text;
begin
  foreach t in array array['settings', 'players', 'rounds', 'foursomes', 'scores', 'messages'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "trip access" on %I', t);
    execute format('create policy "trip access" on %I for all to anon, authenticated using (true) with check (true)', t);
    begin
      execute format('alter publication supabase_realtime add table %I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

insert into settings (id) values (1) on conflict (id) do nothing;

insert into rounds (round_no, name, day_label, play_date, tee_time, holes, tees, tee_name, note) values
  (1, 'World Tour Golf Links', 'Thu, Apr 1', '2027-04-01', '2:21 PM', '[{"par":4,"si":15},{"par":5,"si":3},{"par":3,"si":7},{"par":4,"si":5},{"par":5,"si":1},{"par":4,"si":11},{"par":3,"si":9},{"par":4,"si":13},{"par":4,"si":17},{"par":4,"si":12},{"par":5,"si":10},{"par":3,"si":18},{"par":4,"si":2},{"par":3,"si":14},{"par":5,"si":8},{"par":4,"si":6},{"par":4,"si":16},{"par":4,"si":4}]'::jsonb, '[{"name":"Black","yards":6525,"rating":71.8,"slope":132},{"name":"Gold","yards":6214,"rating":70.5,"slope":129},{"name":"Silver","yards":5826,"rating":68.5,"slope":123}]'::jsonb, 'Gold', 'Has several sets of nines. Check which ones you are playing.'),
  (2, 'Myrtle Beach National South Creek', 'Fri, Apr 2 AM', '2027-04-02', '8:20 AM', '[{"par":4,"si":4},{"par":5,"si":2},{"par":4,"si":14},{"par":3,"si":18},{"par":4,"si":10},{"par":5,"si":8},{"par":4,"si":12},{"par":3,"si":16},{"par":4,"si":6},{"par":5,"si":1},{"par":4,"si":11},{"par":4,"si":9},{"par":3,"si":15},{"par":4,"si":13},{"par":4,"si":5},{"par":5,"si":3},{"par":3,"si":17},{"par":4,"si":7}]'::jsonb, '[{"name":"Blue","yards":6416,"rating":70.5,"slope":123},{"name":"White","yards":6089,"rating":69.1,"slope":118},{"name":"Gold","yards":5710,"rating":67.3,"slope":112}]'::jsonb, 'Blue', ''),
  (3, 'Myrtle Beach National King''s North', 'Fri, Apr 2 PM', '2027-04-02', '2:07 PM', '[{"par":5,"si":10},{"par":4,"si":8},{"par":4,"si":12},{"par":3,"si":16},{"par":4,"si":14},{"par":5,"si":2},{"par":4,"si":6},{"par":3,"si":18},{"par":4,"si":4},{"par":5,"si":13},{"par":4,"si":11},{"par":3,"si":17},{"par":4,"si":3},{"par":4,"si":9},{"par":5,"si":1},{"par":4,"si":7},{"par":3,"si":15},{"par":4,"si":5}]'::jsonb, '[{"name":"Black","yards":7017,"rating":74.2,"slope":137},{"name":"Gold","yards":6481,"rating":71.1,"slope":131},{"name":"White","yards":6024,"rating":69.3,"slope":125},{"name":"Blue","yards":5662,"rating":67.5,"slope":118}]'::jsonb, 'Gold', ''),
  (4, 'Arrowhead Country Club', 'Sat, Apr 3', '2027-04-03', '8:42 AM', '[{"par":5,"si":11},{"par":4,"si":1},{"par":3,"si":13},{"par":4,"si":5},{"par":3,"si":17},{"par":5,"si":7},{"par":4,"si":3},{"par":4,"si":15},{"par":4,"si":9},{"par":4,"si":10},{"par":3,"si":18},{"par":4,"si":2},{"par":3,"si":8},{"par":5,"si":16},{"par":4,"si":6},{"par":4,"si":14},{"par":3,"si":12},{"par":5,"si":4}]'::jsonb, '[{"name":"Back","yards":6519,"rating":70.1,"slope":133},{"name":"Middle","yards":6130,"rating":68.6,"slope":126},{"name":"Forward","yards":5324,"rating":67.1,"slope":119}]'::jsonb, 'Middle', 'Has 27 holes (Cypress, Lakes, Waterway). Check which nines you are playing.')
on conflict (round_no) do nothing;

insert into players (name, team, start_index)
select * from (values
  ('Brayden West', 'A', 0),
  ('Noah West', 'B', 0),
  ('Derek Null', 'A', 0),
  ('Grant Kiser', 'B', 0),
  ('Tanner Black', 'A', 0),
  ('Eric Price', 'B', 0),
  ('Lucas Maynard', 'A', 0),
  ('Blake Jordan', 'B', 0),
  ('Blake Hogan', 'A', 0),
  ('Shawn Moore', 'B', 0),
  ('Kade Sword', 'A', 0),
  ('Tristan Johnson', 'B', 0),
  ('Morgan O''Brian', 'A', 0),
  ('Bryant Payne', 'B', 0),
  ('Brock Turner', 'A', 0),
  ('Matthew Clevenger', 'B', 0)
) as v(name, team, start_index)
where not exists (select 1 from players);
