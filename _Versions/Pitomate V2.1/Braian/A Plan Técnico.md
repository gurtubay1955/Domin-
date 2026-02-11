# Plan Técnico: Arquitectura y Base de Datos

## 1. Stack Tecnológico

- **Frontend**: **Next.js 14** (App Router).
    - *Razón*: Rapidez de desarrollo, soporte PWA nativo, fácil despliegue.
    - **UI**: TailwindCSS (para el diseño "Pizarra" personalizado) + Framer Motion (para animaciones de fichas/puntos).
- **Backend**: **Supabase** (PostgreSQL + Auth + Realtime).
    - *Razón*: La funcionalidad "Realtime" es crítica para que todas las mesas vean el cronómetro y la tabla de posiciones actualizada al instante.
    - *Alternativa Local*: SQLite para desarrollo inicial, pero SQL es mandatorio por las estadísticas complejas.

## 2. Infraestructura y Costos (Recomendación del Agente de Software)

### Opción Recomendada: Nube "Serverless" (Costo $0)
Para este proyecto, usar una laptop en casa es **desaconsejable** (problemas de conexión, IP, batería). La mejor opción profesional y gratuita es:

1.  **Base de Datos**: **Supabase** (Free Tier).
    - **Costo**: $0/mes para siempre (hasta 500MB, que son millones de partidas de dominó).
    - **Ventajas**:
        - Accesible desde cualquier lugar (celular en 4G/5G).
        - **Realtime**: Si una mesa anota puntos, el "Dashboard Central" se actualiza al instante sin recargar.
        - Autenticación segura incluida (para que cada amigo tenga su login).
2.  **Hosting de la App**: **Vercel** (Hobby Tier).
    - **Costo**: $0/mes.
    - **Ventajas**: Creado por los mismos dueños de Next.js. La app carga instantánea en todo el mundo.

### Comparativa
| Opción | Costo | Pros | Contras |
| :--- | :--- | :--- | :--- |
| **Supabase + Vercel** | **Gratis** | Profesional, Rápido, Realtime, Seguro. | Ninguno para este volumen. |
| **Laptop en Casa** | Gratis | Control total físico. | Complejo de configurar (IPs). Si cierras la laptop, se cae el torneo. |
| **AWS / GoDaddy** | $$ Variable | Estándar de industria. | Complejo de configurar. Fácil generar costos sorpresa. |

## 3. Esquema de Base de Datos (Relacional)

### Tablas Principales

#### `players`
Maestro de los "16 amigos".
- `id` (UUID)
- `name` (Text): Nombre real.
- `nickname` (Text): Apodo para la pizarra.
- `avatar_url` (Text): Foto opcional.

#### `tournaments` (Los Jueves)
Cada evento semanal es un torneo.
- `id` (UUID)
- `date` (Date): Fecha del jueves.
- `host_id` (FK -> players): El anfitrión de la cena.
- `status` (Enum): 'planned', 'active', 'finished'.
- `config` (JSON): { "max_points": 100, "max_time": 40, "players_count": 16 }.

#### `tournament_attendance`
Quiénes asistieron ese jueves (para el Round Robin).
- `tournament_id` (FK)
- `player_id` (FK)

#### `pairs` (Las Parejas de la Noche)
Se generan aleatoriamente al activar el torneo.
- `id` (UUID)
- `tournament_id` (FK)
- `player1_id` (FK)
- `player2_id` (FK)
- `pair_number` (Int): 1-8 (para asignar mesas/roles).

#### `matches` (Las Partidas)
Los cruces generados por el Round Robin.
- `id` (UUID)
- `tournament_id` (FK)
- `round_number` (Int): 1-7.
- `table_number` (Int): 1-4.
- `pair_a_id` (FK)
- `pair_b_id` (FK)
- `score_a` (Int): Puntos actuales (ej. 85).
- `score_b` (Int): Puntos actuales (ej. 92).
- `status` (Enum): 'waiting', 'playing', 'finished', 'timed_out'.
- `winner_pair_id` (FK): Null hasta terminar.

#### `match_hands` (Histórico de Manos - Pizarra)
Cada renglón de la "pizarra" en la imagen.
- `id` (UUID)
- `match_id` (FK)
- `hand_number` (Int): 1, 2, 3...
- `points_a` (Int): Lo que sumó la pareja A en esa mano.
- `points_b` (Int): Lo que sumó la pareja B en esa mano.
- `timestamp` (Time): Para calcular duración por mano.

## 3. Arquitectura Frontend (Componentes Clave)

1.  **`TournamentSetupWizard`**:
    - Selección de jugadores presentes (Checklist de los 16).
    - Sorteo animado de parejas (Efecto dramático).
    - Generación de fixture (Algoritmo Round Robin).

2.  **`ActiveMatchView` (La Pizarra)**:
    - *Basado en la imagen*: Fondo oscuro, tipografía "Handwritten".
    - **Header**: Cronómetro global sincronizado.
    - **ScoreBoard**: Columnas "Nosotros" vs "Ellos".
    - **Keypad**: Teclado numérico grande para ingresar puntos rápidos.

3.  **`LeaderboardLive`**:
    - Ranking en tiempo real que se proyecta o ve en celulares.
    - Criterios de ordenamiento (Ganados > Diferencial).

4.  **`StatsDashboard`**:
    - Histórico acumulado de los 16 jueves.

---

## Próximos Pasos Técnicos
1.  Inicializar proyecto Next.js + Tailwind.
2.  Configurar temas y fuentes (Chalkboard/Handwritten).
3.  Implementar la base de datos (Script SQL).
