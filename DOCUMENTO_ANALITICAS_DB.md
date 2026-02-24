# 📊 Pitomate Analytics & Arquitectura de Base de Datos

Este documento describe detalladamente la topología de la base de datos (PostgreSQL en Supabase) y las lógicas matemáticas utilizadas para independizar los **Standings Oficiales** (Récord de Campeonato) de las **Analíticas Avanzadas** (Métricas de Rendimiento y Fricción).

---

## 1. Topología de la Base de Datos (Esquema)

### 1.1 `tournaments` (Torneos / Jornadas)
Representa un día de juego o sesión específica.
*   `id` (UUID): Identificador único del torneo.
*   `date` (DATE): Fecha de la jornada.
*   `host_name` (TEXT): Nombre del anfitrión designado.
*   `status` (TEXT): Estado actual (`planned`, `active`, `finished`).
*   `rules_id` (UUID): (Opcional) Enlace a configuraciones de puntuación para escalabilidad futura.

### 1.2 `pairs` (Parejas Efímeras)
Registra los equipos formados exclusivamente para una jornada en particular.
*   `id` (UUID): Identificador único de la pareja.
*   `tournament_id` (UUID): Referencia a la tabla `tournaments`.
*   `pair_number` (INTEGER): Número asignado en la mesa (Ej: 1 al 14).
*   `player1_name` (TEXT): Nombre exacto del primer integrante.
*   `player2_name` (TEXT): Nombre exacto del segundo integrante.

### 1.3 `matches` (Registro de Partidas)
El corazón transaccional del sistema. Guarda el resultado definitivo "End-State" de cada enfrentamiento.
*   `id` (UUID): Identificador de la partida.
*   `tournament_id` (UUID): Jornada a la que pertenece.
*   `pair_a_id` / `pair_b_id` (UUID): Identificadores de las parejas contendientes.
*   `pair_a_names` / `pair_b_names` (JSONB): Snapshots inmutables de nombres (Ej: `["Paco", "Beto"]`) para evitar que modificaciones o desbandadas futuras rompan el historial.
*   `score_a` / `score_b` (INTEGER): Puntos logrados (100 a X).
*   `hands_a` / `hands_b` (INTEGER): Total de manos ganadas por cada lado (Contadores globales útiles sin desglose granular).
*   `termination_type` (TEXT): Bandera especial del final (`none` = normal, `single` = Zapatero Sencillo, `double` = Zapatero Doble).
*   `winner_pair` (UUID): Identificador explícito del equipo vencedor.
*   `timestamp` (BIGINT): Fecha y hora UNIX de finalización.

### 1.4 `match_hands` (Resolución Granular de Manos)
Tabla introducida para permitir analítica profunda tipo "Fricción", almacenando lo que ocurre paso a paso en el juego sin contaminar el Standing oficial.
*   `id` (UUID): Identificador único.
*   `match_id` (UUID): Referencia a la partida en la tabla `matches`.
*   `hand_number` (INTEGER): Conteo secuencial de la mano jugada (Mano 1, Mano 2...).
*   `score_a` / `score_b` (INTEGER): Marcador acumulado como estaba exactamente al concluir esa mano.
*   `points_earned_a` / `points_earned_b` (INTEGER): Puntos adquiridos estrictamente por cuenta y obra en el transcurso de *esa sola* mano.
*   `winner_team` (CHAR): 'A', 'B' indicando el equipo que cobró. Puede incluir 'T' para manos trancadas sin puntos.

### 1.5 `tournament_rules` (Motor de Reglas y Configuración - Para escalar)
Tabla de infraestructura preparada por si alguna vez el comite pitomate altera las reglas centrales.
*   Campos base variables como: `points_for_win`, `points_for_attendance`, `threshold_single_shoe`.

---

## 2. Lógica Base: Puntuación Oficial (Individual Standings)

Al concluir una partida, el Backend o la aplicación móvil **NO** inyecta los "Puntos de Campeonato" definitivos en base a fórmulas de código en la misma partida, evitando desestabilizaciones del historial. La lectura del campeonato y los rankings se genera dinámicamente mediante la vista (SQL View) `view_player_standings`.

### Consideraciones Matemáticas Oficiales:
*   **Enfoque:** La sumatoria obedece siempre y en todo momento al desempeño de un **Jugador Indvidual**, marginando temporalidad de parejas (las cuales cambian o rompen).
*   **Puntos de Asistencia (+1):** Si un jugador aparece listado jugando al menos *una* vez dentro de un torneo (`tournament_id`), se suma automáticamente 1 Punto a su récord histórico a manera de Puntos de Asistencia de Jornada.
*   **Puntos de Victoria (+1):** Si el equipo de un jugador anota `>= 100` puntos, dicho jugador recibe 1 Punto adicional por adjudicarse esa victoria.
*   **Puntos por Derrota / Ausencias (0):** Derrotas no restan ni suman. Faltar a la jornada no aporta Puntos de Asistencia.
*   **Aislamiento de Goleadas:** Ningún método de victoria excepcional (ni Dobles Zapatos a cero, ni blanqueadas) aporta multiplicadores extras sobre los totales Oficiales del Circuito.
*   **Ecuación Standings:** `Suma(Asistencias Únicas por Jornada) + Suma(Victorias Totales)`.

---

## 3. Lógica Base: Domino Analytics (Métricas Avanzadas)

Todo el ambiente y tableros bajo el nombre de "Domino Analytics" viven matemática y lógicamente asilados de la tabla de posiciones anterior. Su propósito es exprimir los estadísticos secundarios en `matches` y `match_hands` apoyados mayormente por la vista de reportaría `view_match_analytics`.

### 3.1 Índice de Fricción
Categoriza el flujo del juego, midiendo cuánto desgaste, defensa mutua o nivel de tensión imperó en el partido sin importar de qué lado calló la moneda.
*   **Cálculo Mecánico:** Evaluando `∑(hands_a + hands_b)` por la partida. Significa total de piedras tiradas que llegaron a puntos.
*   **Las Trincheras (Fricción Alta):** Partidas extensas en recuento de manos (ej: 10, 11 o 14). Denotan un juego trancado, defensas recias, goteo de puntuaciones muy minúsculas o dominios repartidos ecuánimemente mano a mano.  
*   **La Táctica Blitzkrieg (Fricción Baja):** Partidas extremadamente veloces (3 a 5 manos totales). Sugiere un torbellino rápido de juego por superioridad abrumadora o conteo de piedras caras con el contrario en mesa.

### 3.2 Índice Ofensivo / Veneno (Eficiencia por Mano - PPM)
Evalúa un parámetro fundamental: "La puntería o el filo". De quien ganó la partida, que tan eficiente fue al cobrar sus fichas.
*   **Fórmula (PPM):** `Puntaje Total Final de la Pareja Victoriosa / Total de Manos cobradas por la Pareja Victoriosa`.
*   **Condicionamiento:** Se evalúa exclusivamente a los triunfadores del encuentro `(Mano con score >= 100)`.
*   **Ejemplo A (Alta Letalidad, > 30 PPM):** Un equipo que suma 108 puntos cobrando en solo 3 manos tiene `36.0 PPM`. Representa una altísima letalidad de ataque (cada vez que dominan se llevan piedras gordas).
*   **Ejemplo B (Letalidad Pobre, < 14 PPM):** Si la dupla necesita pescar 8 de las manos efectuadas para poder rascar los `100` Puntos, ostentan `12.5 PPM`. Fueron persistentes, pero no destructivos.

### 3.3 Índice de Humillación / Impacto (Zapateros Recíprocos)
Rastrea blanqueos netos en el desarrollo táctico del puntaje. Mide el control o la disparidad absoluta entre rivales, sirviendo puramente como elemento de honor, récord personal de "Agresividad", pero ajeno al "Standings".
*   **Rango Zapatero Doble:** Victoria perfecta o inmaculada: `Ganador >= 100` y `Perdedor = 0` (`termination_type = double`).
*   **Rango Zapatero Sencillo:** Victoria por paliza asimétrica: `Ganador >= 100` y `0 < Perdedor <= 50` (`termination_type = single`).
*   Estas marcas se adhieren individualmente al jugador, generando una hoja de Trofeos otorgados al rival (Agresión) y Trofeos incrustados por el rival (Deshonra temporal).
