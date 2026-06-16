insert into matches (source_match_id, home_team, away_team, home_code, away_code, stage, kickoff_at, home_score, away_score)
values
  ('wc-1', 'Portugal', 'Morocco', 'PT', 'MA', 'Group Stage', now() + interval '2 day', null, null),
  ('wc-2', 'France', 'Brazil', 'FR', 'BR', 'Group Stage', now() + interval '3 day', null, null),
  ('wc-3', 'Argentina', 'Germany', 'AR', 'DE', 'Group Stage', now() + interval '4 day', null, null),
  ('wc-4', 'Spain', 'Japan', 'ES', 'JP', 'Group Stage', now() + interval '5 day', null, null),
  ('wc-5', 'Portugal', 'USA', 'PT', 'US', 'Group Stage', now() - interval '2 day', 2, 1),
  ('wc-6', 'England', 'Portugal', 'GB', 'PT', 'Group Stage', now() - interval '5 day', 0, 0)
on conflict (source_match_id) do nothing;
