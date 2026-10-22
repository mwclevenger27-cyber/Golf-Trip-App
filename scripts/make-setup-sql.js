// Builds supabase/setup.sql from the course data. Run: node scripts/make-setup-sql.js
import { writeFileSync } from 'node:fs';
import { COURSES, ROSTER } from '../src/lib/courses.js';

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const json = (v) => `${q(JSON.stringify(v))}::jsonb`;

const rounds = COURSES.map((c, i) =>
  `  (${i + 1}, ${q(c.name)}, ${q(c.day_label)}, ${q(c.play_date)}, ${q(c.tee_time)}, ${json(c.holes)}, ${json(c.tees)}, ${q(c.tee_name)}, ${q(c.note)})`,
).join(',\n');

const players = ROSTER.map((name, i) => `  (${q(name)}, ${q(i % 2 === 0 ? 'A' : 'B')}, 0)`).join(',\n');

const sql = `-- Golf Trip App database setup.
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
${rounds}
on conflict (round_no) do nothing;

insert into players (name, team, start_index)
select * from (values
${players}
) as v(name, team, start_index)
where not exists (select 1 from players);
`;

writeFileSync(new URL('../supabase/setup.sql', import.meta.url), sql);
console.log('wrote supabase/setup.sql');
