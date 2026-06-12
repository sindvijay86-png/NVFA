-- NVFC schema. Supabase → SQL Editor में paste करके Run करो.

create table if not exists coaches (
  code text primary key,            -- e.g. NVFC-RAJU-07 (always uppercase)
  name text not null,
  village text,
  created_at timestamptz default now()
);

create table if not exists plans (
  id uuid primary key default gen_random_uuid(),
  coach_code text references coaches(code),
  created_at timestamptz default now(),
  title text,
  payload jsonb,                    -- full plan: blocks, thinking, motivation talk, philosophy
  drills text[] default '{}'        -- drill names, for anti-repeat
);

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  coach_code text references coaches(code),
  created_at timestamptz default now(),
  week_start date,
  sessions int,
  avg_attendance int,
  went_well text,
  challenge text,
  kaizen_moment text
);

-- पहले coaches यहाँ जोड़ो:
insert into coaches (code, name, village) values
  ('NVFC-DJ-01', 'DJ', 'HQ')
on conflict (code) do nothing;

-- नया coach जोड़ने के लिए:
-- insert into coaches (code, name, village) values ('NVFC-RAJU-07', 'राजू', 'गाँव का नाम');
