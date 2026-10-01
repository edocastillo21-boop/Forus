-- Forus · esquema del MVP (Etapa 3)
-- Ejecutar completo en Supabase → SQL Editor. Se puede volver a ejecutar sin romper nada.
--
-- Principios:
--   · Cada fila pertenece a un usuario (user_id) y solo ese usuario la ve (RLS).
--   · Los ids los genera la app (texto), así se puede crear todo sin señal y subirlo después.
--   · updated_at lo fija el servidor: la app baja "lo nuevo desde la última vez" con ese campo.
--   · Nada se borra de verdad desde la app: deleted_at marca el borrado para que se sincronice.
--   · El registro está cerrado: solo pueden crear cuenta los correos de public.allowed_emails.

-- ─────────────────────────────── Utilidades ───────────────────────────────
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

-- ──────────────────────────────── Tablas ─────────────────────────────────
create table if not exists public.profiles (
  id            text primary key,
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name          text not null default '',
  sex           text not null default 'm' check (sex in ('m', 'f')),
  birth_date    date,
  height_cm     numeric,
  activity      text,
  experience    text,
  goal          text,
  diet          text,
  meals_per_day int,
  budget        text,
  training_days int[] not null default '{}',
  session_min   int,
  training_time text,
  equipment     text[] not null default '{}',
  dislikes      text[] not null default '{}',
  allergies     text not null default '',
  timezone      text,
  prefs         jsonb not null default '{}',
  consent_at    text,
  onboarded_at  text,
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  constraint profiles_id_is_user check (id = user_id::text)
);

create table if not exists public.phases (
  id              text primary key,
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type            text not null,
  start_date      date not null,
  end_date        date,
  rate_kg_week    numeric not null default 0,
  start_weight    numeric,
  goal_weight     numeric,
  bmr             numeric,
  tdee            numeric,
  kcal            numeric not null,
  protein_g       numeric not null,
  carbs_g         numeric not null,
  fat_g           numeric not null,
  protein_per_kg  numeric,
  fat_pct         numeric,
  activity_factor numeric,
  training_kcal   numeric,
  cycling         boolean not null default false,
  status          text not null default 'activa',
  notes           text,
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create table if not exists public.routines (
  id         text primary key,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null,
  split      text,
  level      text,
  days       jsonb not null default '[]',
  notes      text,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.mesocycles (
  id          text primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  routine_id  text not null,
  name        text not null,
  start_date  date not null,
  weeks       int not null,
  deload_week int,
  rir_plan    int[] not null default '{}',
  schedule    jsonb not null default '{}',
  status      text not null default 'activo',
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create table if not exists public.workout_sessions (
  id           text primary key,
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date         date not null,
  routine_id   text,
  mesocycle_id text,
  day_index    int,
  day_name     text not null default '',
  week         int,
  started_at   text not null,
  ended_at     text,
  status       text not null default 'en_curso',
  bodyweight   numeric,
  notes        text,
  exercises    jsonb not null default '[]',
  volume_kg    numeric not null default 0,
  sets_done    int not null default 0,
  prs          jsonb not null default '[]',
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

-- Alimentos creados por el usuario (el catálogo general viene dentro de la app).
create table if not exists public.foods (
  id         text primary key,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null,
  brand      text,
  barcode    text,
  group_code text,
  kcal       numeric not null default 0,
  protein    numeric not null default 0,
  carbs      numeric not null default 0,
  fat        numeric not null default 0,
  fiber      numeric not null default 0,
  sugar      numeric not null default 0,
  sodium     numeric not null default 0,
  portions   jsonb not null default '[]',
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.food_log_entries (
  id         text primary key,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date       date not null,
  meal       text not null,
  food_ref   text not null,
  name       text not null,
  grams      numeric not null default 0,
  portion    text,
  qty        numeric,
  kcal       numeric not null default 0,
  protein    numeric not null default 0,
  carbs      numeric not null default 0,
  fat        numeric not null default 0,
  fiber      numeric not null default 0,
  source     text,
  created_at text,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.saved_meals (
  id         text primary key,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null,
  items      jsonb not null default '[]',
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Un registro por día (id = "<user_id>:<fecha>").
create table if not exists public.day_logs (
  id         text primary key,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date       date not null,
  water_ml   int not null default 0,
  note       text,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, date)
);

create table if not exists public.body_weights (
  id         text primary key,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date       date not null,
  weight_kg  numeric not null,
  body_fat   numeric,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, date)
);

-- ─────────────── Triggers, índices, seguridad por fila y permisos ───────────────
do $$
declare
  t text;
begin
  foreach t in array array['profiles', 'phases', 'routines', 'mesocycles', 'workout_sessions', 'foods', 'food_log_entries', 'saved_meals', 'day_logs', 'body_weights']
  loop
    execute format('drop trigger if exists touch_updated_at on public.%I', t);
    execute format('create trigger touch_updated_at before insert or update on public.%I for each row execute function public.touch_updated_at()', t);
    execute format('create index if not exists %I on public.%I (user_id, updated_at)', t || '_user_updated_idx', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "solo_propias" on public.%I', t);
    execute format('create policy "solo_propias" on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end;
$$;

-- ───────────────────────── Registro cerrado ─────────────────────────
-- Lista de correos autorizados. Sin políticas: nadie la puede leer desde la app.
create table if not exists public.allowed_emails (
  email text primary key
);
alter table public.allowed_emails enable row level security;
revoke all on public.allowed_emails from anon, authenticated;

create or replace function public.check_allowed_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.allowed_emails a where lower(a.email) = lower(new.email)) then
    raise exception 'Correo no autorizado para Forus';
  end if;
  return new;
end;
$$;

drop trigger if exists forus_check_allowed_email on auth.users;
create trigger forus_check_allowed_email
  before insert on auth.users
  for each row execute function public.check_allowed_email();

-- ───────────────────────── Eliminar mi cuenta ─────────────────────────
-- Borra el usuario que llama; sus filas se van en cascada.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Sin sesión';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
revoke execute on function public.check_allowed_email() from public, anon, authenticated;
grant execute on function public.check_allowed_email() to supabase_auth_admin;
