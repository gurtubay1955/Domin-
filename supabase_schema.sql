-- 🏗️ ESQUEMA DE BASE DE DATOS PITOMATE V2.0 (SUPABASE)

-- 1. PLAYERS (Maestro de Jugadores)
CREATE TABLE IF NOT EXISTS players (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    name TEXT NOT NULL,          -- Nombre real (Ej: 'Rodrigo')
    nickname TEXT,               -- Apodo (Ej: 'Rodri')
    avatar_url TEXT,             -- URL de foto
    is_active BOOLEAN DEFAULT true
);

-- 2. TOURNAMENTS (Las Jornadas)
CREATE TABLE IF NOT EXISTS tournaments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    date DATE NOT NULL,          -- Fecha del torneo
    host_name TEXT NOT NULL,     -- Nombre del anfitrión (Ej: 'Rodrigo')
    status TEXT DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'finished')),
    metadata JSONB               -- Configuración extra
);

-- 3. PAIRS (Parejas generadas por sorteo)
CREATE TABLE IF NOT EXISTS pairs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    player1_name TEXT NOT NULL,  -- Guardamos nombres strings por simplicidad inicial
    player2_name TEXT NOT NULL,
    pair_number INTEGER NOT NULL -- 1 a 8
);

-- 4. MATCHES (Partidas y Resultados)
CREATE TABLE IF NOT EXISTS matches (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
    
    -- Identificación de Parejas (Referencia ID o número)
    pair_a_id UUID REFERENCES pairs(id),
    pair_b_id UUID REFERENCES pairs(id),
    
    -- Nombres (Snapshots para historial inmutable)
    pair_a_names JSONB NOT NULL, -- ["Rodri", "Paco"]
    pair_b_names JSONB NOT NULL, -- ["Beto", "Alex"]

    -- Puntuación Final
    score_a INTEGER NOT NULL DEFAULT 0,
    score_b INTEGER NOT NULL DEFAULT 0,

    -- 📊 ESTADÍSTICAS AVANZADAS (NUEVO)
    hands_a INTEGER DEFAULT 0,   -- Manos ganadas por Pareja A
    hands_b INTEGER DEFAULT 0,   -- Manos ganadas por Pareja B
    
    -- Tipo de Victoria (Calculado)
    -- 'double' (100-0), 'single' (100-50), 'none' (Normal)
    -- Guardamos el status desde la perspectiva del GANADOR o global
    termination_type TEXT CHECK (termination_type IN ('none', 'single', 'double')),
    
    duration_seconds INTEGER,    -- Duración de la partida
    winner_pair UUID,            -- ID de la pareja ganadora (opcional, redundante pero útil)
    timestamp BIGINT             -- Timestamp original del cliente
);

-- 5. POLÍTICAS DE SEGURIDAD (RLS)
-- Permitir lectura pública (anon) y escritura autenticada (usaremos anon key por ahora para simplificar)
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE pairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

-- Política ABIERTA para desarrollo (CUIDADO: Cambiar en producción)
CREATE POLICY "Public Read Access" ON players FOR SELECT USING (true);
CREATE POLICY "Public Read Access" ON tournaments FOR SELECT USING (true);
CREATE POLICY "Public Read Access" ON pairs FOR SELECT USING (true);
CREATE POLICY "Public Read Access" ON matches FOR SELECT USING (true);

CREATE POLICY "Public Insert Access" ON players FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Insert Access" ON tournaments FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Insert Access" ON pairs FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Insert Access" ON matches FOR INSERT WITH CHECK (true);
