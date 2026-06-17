create extension if not exists pgcrypto;

create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  source_match_id text unique,
  home_team text not null,
  away_team text not null,
  home_code text not null,
  away_code text not null,
  stage text,
  kickoff_at timestamptz not null,
  home_score int,
  away_score int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists predictions (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  guest_id text not null,
  guest_name text not null check (char_length(guest_name) between 2 and 40),
  country_code text not null check (char_length(country_code) = 2),
  vote_type text not null check (vote_type in ('home', 'draw', 'away')),
  created_at timestamptz not null default now()
);

alter table predictions add column if not exists guest_id text;
update predictions
set guest_id = coalesce(nullif(guest_id, ''), id::text)
where guest_id is null or guest_id = '';
alter table predictions alter column guest_id set not null;

create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  guest_name text not null check (char_length(guest_name) between 2 and 40),
  country_code text not null check (char_length(country_code) = 2),
  is_portugal boolean not null default false,
  message_text text not null check (char_length(message_text) between 1 and 280),
  created_at timestamptz not null default now()
);

create table if not exists winner_predictions (
  id uuid primary key default gen_random_uuid(),
  guest_id text not null,
  guest_name text not null check (char_length(guest_name) between 2 and 40),
  country_code text not null check (char_length(country_code) = 2),
  team_name text not null check (char_length(team_name) between 2 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_matches_kickoff on matches (kickoff_at);
create index if not exists idx_predictions_match on predictions (match_id, created_at desc);
create unique index if not exists idx_predictions_one_vote on predictions (match_id, guest_id);
create index if not exists idx_chat_match on chat_messages (match_id, created_at asc);
create unique index if not exists idx_winner_predictions_guest on winner_predictions (guest_id);
create index if not exists idx_winner_predictions_team on winner_predictions (team_name);

alter table matches enable row level security;
alter table predictions enable row level security;
alter table chat_messages enable row level security;
alter table winner_predictions enable row level security;

create policy "public read matches"
  on matches for select
  to anon, authenticated
  using (true);

create policy "public read predictions"
  on predictions for select
  to anon, authenticated
  using (true);

create policy "public insert predictions"
  on predictions for insert
  to anon, authenticated
  with check (
    char_length(guest_id) between 8 and 80
    and now() < (select m.kickoff_at from matches m where m.id = match_id)
  );

create policy "public read chat"
  on chat_messages for select
  to anon, authenticated
  using (true);

create policy "public insert chat"
  on chat_messages for insert
  to anon, authenticated
  with check (char_length(message_text) between 1 and 280);

create policy "public read winner predictions"
  on winner_predictions for select
  to anon, authenticated
  using (true);

create policy "public insert winner predictions"
  on winner_predictions for insert
  to anon, authenticated
  with check (
    char_length(guest_id) between 8 and 80
    and char_length(team_name) between 2 and 80
  );

create policy "public update winner predictions"
  on winner_predictions for update
  to anon, authenticated
  using (true)
  with check (
    char_length(guest_id) between 8 and 80
    and char_length(team_name) between 2 and 80
  );

create or replace function touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_matches_updated_at on matches;
create trigger trg_matches_updated_at
before update on matches
for each row
execute function touch_updated_at();

drop trigger if exists trg_winner_predictions_updated_at on winner_predictions;
create trigger trg_winner_predictions_updated_at
before update on winner_predictions
for each row
execute function touch_updated_at();
