-- Forus · Etapa 4: medidas corporales, fotos de progreso, revisión semanal y bloque de fase.
-- Ejecutar completo en Supabase → SQL Editor, DESPUÉS de 0001. Se puede volver a ejecutar sin romper nada.
-- Solo agrega cosas: no borra ni modifica datos existentes.

-- ─────────────── Fases: los ajustes semanales conservan el inicio del bloque ───────────────
alter table public.phases add column if not exists block_start date;

-- ──────────────────────────────── Tablas nuevas ────────────────────────────────
-- Una fila por día (id = "<user_id>:<fecha>"), en cm.
create table if not exists public.body_measurements (
  id         text primary key,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date       date not null,
  waist      numeric,
  hip        numeric,
  chest      numeric,
  arm        numeric,
  thigh      numeric,
  neck       numeric,
  note       text,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, date)
);

-- Datos de cada foto. El archivo vive en Storage: progress-photos/<user_id>/<id>.jpg
create table if not exists public.progress_photos (
  id         text primary key,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date       date not null,
  pose       text not null default 'frente' check (pose in ('frente', 'perfil', 'espalda')),
  path       text not null,
  width      int,
  height     int,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Qué se decidió en cada revisión semanal (id = "<user_id>:<domingo de la revisión>").
create table if not exists public.weekly_checkins (
  id         text primary key,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  week_start date not null,
  phase_id   text,
  status     text not null check (status in ('aplicado', 'esperar', 'visto')),
  delta_kcal numeric not null default 0,
  data       jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, week_start)
);

-- ─────────────── Triggers, índices, seguridad por fila y permisos (igual que 0001) ───────────────
do $$
declare
  t text;
begin
  foreach t in array array['body_measurements', 'progress_photos', 'weekly_checkins']
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

-- ───────────────────────── Fotos: bucket privado ─────────────────────────
-- Máximo 5 MB por archivo (la app las achica a ~200 KB) y solo JPEG/WebP.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('progress-photos', 'progress-photos', false, 5242880, array['image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Cada persona solo ve, sube y borra archivos dentro de su carpeta (<user_id>/...).
drop policy if exists "forus_fotos_propias" on storage.objects;
create policy "forus_fotos_propias" on storage.objects
  for all to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = (select auth.uid()::text))
  with check (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = (select auth.uid()::text));
