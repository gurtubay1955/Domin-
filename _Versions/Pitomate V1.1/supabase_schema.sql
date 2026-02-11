-- ==========================================
-- SCRIPT DE INICIALIZACIÓN (PITOMATE V2)
-- ==========================================
-- Instrucciones: Copia TODO este código, pégalo en el SQL Editor y dale a RUN.

-- 1. Extensiones (Cimientos)
create extension if not exists "uuid-ossp";

-- 2. Eliminar tipos anteriores si existen (Limpieza profunda)
drop table if exists matches cascade;
drop table if exists pairs cascade;
drop table if exists tournaments cascade;
drop table if exists players cascade;
drop type if exists match_status;
drop type if exists tournament_status;

-- 3. Crear Tipos de Estado
create type tournament_status as enum ('planned', 'active', 'finished');
create type match_status as enum ('waiting', 'playing', 'finished', 'timed_out');

-- 4. Crear Tablas
create table players (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  nickname text,
  created_at timestamp with time zone default now()
);

create table tournaments (
  id uuid primary key default uuid_generate_v4(),
  date date not null default current_date,
  host_id uuid references players(id),
  status tournament_status default 'finished', -- 'finished' por defecto para el archivo de hoy
  config jsonb default '{}',
  created_at timestamp with time zone default now()
);

create table pairs (
  id uuid primary key default uuid_generate_v4(),
  tournament_id uuid references tournaments(id) on delete cascade,
  player1_id uuid references players(id),
  player2_id uuid references players(id),
  pair_number int,
  created_at timestamp with time zone default now()
);

create table matches (
  id uuid primary key default uuid_generate_v4(),
  tournament_id uuid references tournaments(id) on delete cascade,
  pair_a_id uuid references pairs(id),
  pair_b_id uuid references pairs(id),
  score_a int default 0,
  score_b int default 0,
  status match_status default 'finished',
  created_at timestamp with time zone default now()
);

-- 5. Abrir las puertas (Políticas de Seguridad RLS)
-- Ponemos esto en "Modo Libre" para que la app no pida login para guardar
alter table players enable row level security;
alter table tournaments enable row level security;
alter table pairs enable row level security;
alter table matches enable row level security;

create policy "Todo el mundo puede leer" on players for select using (true);
create policy "Todo el mundo puede insertar" on players for insert with check (true);

create policy "Todo el mundo puede leer" on tournaments for select using (true);
create policy "Todo el mundo puede insertar" on tournaments for insert with check (true);

create policy "Todo el mundo puede leer" on pairs for select using (true);
create policy "Todo el mundo puede insertar" on pairs for insert with check (true);

create policy "Todo el mundo puede leer" on matches for select using (true);
create policy "Todo el mundo puede insertar" on matches for insert with check (true);
