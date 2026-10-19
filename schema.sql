-- Run this entire file in Supabase Dashboard > SQL Editor.
-- Create one Supabase Auth user for the doctor manually; keep public sign-ups disabled.
-- IMPORTANT: Review local privacy, retention, and health-data requirements before real use.

create extension if not exists pgcrypto;
  
create table if not exists public.daily_token_counters (
  token_date date primary key,
  last_number integer not null default 0 check (last_number >= 0)
);

create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  token_date date not null default (now() at time zone 'Asia/Kolkata')::date,
  token_number text not null,
  full_name text not null check (char_length(full_name) between 2 and 100),
  mobile text not null check (char_length(mobile) between 8 and 16),
  age_dob text not null check (char_length(age_dob) between 1 and 30),
  gender text not null check (gender in ('Female','Male','Non-binary','Prefer not to say','Other')),
  reason text not null check (reason in ('General consultation','Follow-up visit','Report review','Prescription consultation','Other')),
  reason_notes text check (reason_notes is null or char_length(reason_notes) <= 300),
  status text not null default 'Waiting' check (status in ('Waiting','Completed')),
  created_at timestamptz not null default now(),
  unique (token_date, token_number)
);

alter table public.patients enable row level security;
alter table public.daily_token_counters enable row level security;

-- No direct anonymous table reads/writes. Doctor access requires Supabase Auth.
drop policy if exists "Authenticated clinic staff can read patients" on public.patients;
create policy "Authenticated clinic staff can read patients"
  on public.patients for select to authenticated using (true);

drop policy if exists "Authenticated clinic staff can update patients" on public.patients;
create policy "Authenticated clinic staff can update patients"
  on public.patients for update to authenticated using (true) with check (true);

-- Only the RPC can insert a registration from the public form.
revoke all on public.patients from anon, authenticated;
grant select, update on public.patients to authenticated;
revoke all on public.daily_token_counters from anon, authenticated;

create or replace function public.register_patient(
  p_full_name text,
  p_mobile text,
  p_age_dob text,
  p_gender text,
  p_reason text,
  p_reason_notes text default null
)
returns table(token_number text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_date date := (now() at time zone 'Asia/Kolkata')::date;
  v_number integer;
  v_token text;
begin
  if p_full_name is null or char_length(trim(p_full_name)) < 2 or char_length(trim(p_full_name)) > 100 then
    raise exception 'Invalid name';
  end if;
  if p_mobile is null or trim(p_mobile) !~ '^\+?[0-9]{8,15}$' then
    raise exception 'Invalid mobile number';
  end if;
  if p_age_dob is null or char_length(trim(p_age_dob)) < 1 or char_length(trim(p_age_dob)) > 30 then
    raise exception 'Invalid age or date of birth';
  end if;
  if p_gender not in ('Female','Male','Non-binary','Prefer not to say','Other') then
    raise exception 'Invalid gender';
  end if;
  if p_reason not in ('General consultation','Follow-up visit','Report review','Prescription consultation','Other') then
    raise exception 'Invalid appointment reason';
  end if;
  if p_reason_notes is not null and char_length(p_reason_notes) > 300 then
    raise exception 'Note too long';
  end if;

  insert into public.daily_token_counters(token_date, last_number)
  values (v_date, 1)
  on conflict (token_date) do update
    set last_number = public.daily_token_counters.last_number + 1
  returning last_number into v_number;

  v_token := 'T' || to_char(v_date, 'YYMMDD') || '-' || lpad(v_number::text, 3, '0');

  insert into public.patients(token_date, token_number, full_name, mobile, age_dob, gender, reason, reason_notes)
  values (v_date, v_token, trim(p_full_name), trim(p_mobile), trim(p_age_dob), p_gender, p_reason, nullif(trim(p_reason_notes), ''));

  return query select v_token;
end;
$$;

-- The function is intentionally callable without login so patients can register.
-- It validates inputs but is still publicly callable; production needs abuse protection
-- such as CAPTCHA/rate limiting at a trusted server or edge function.
revoke all on function public.register_patient(text,text,text,text,text,text) from public;
grant execute on function public.register_patient(text,text,text,text,text,text) to anon, authenticated;

-- Enable realtime events for the dashboard. If already included, ignore duplicate membership errors.
do $$
begin
  alter publication supabase_realtime add table public.patients;
exception when duplicate_object then null;
when others then
  raise notice 'Could not add patients to supabase_realtime automatically. Enable it in Database > Publications if needed: %', SQLERRM;
end $$;
