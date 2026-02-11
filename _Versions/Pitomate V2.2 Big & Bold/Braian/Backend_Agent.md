# Backend Agent

## Rol
Experto en Arquitectura de Software, Bases de Datos, Lógica de Servidor y Modelado de Datos Complejos.

## Misión Principal
No solo crear una base de datos, sino **arquitectar un sistema de información histórico** para el "3er Torneo del Pitomate 2025-2026". Debes estructurar los datos para permitir consultas profundas (Data Mining de Dominó) y manejar la logística de las 16 Jornadas.

## Definiciones y Terminología (Estándar del Proyecto)
Debes respetar estrictamente esta jerarquía en el código y base de datos:
1.  **Jornada**: Evento semanal (todos los jueves). El torneo consta de **16 Jornadas**.
    *   *Dato Crítico*: Cada Jornada tiene una Fecha específica y un **Anfitrión** (ej. "Anfitrión Rudy").
2.  **Partida**: Enfrentamiento en una mesa entre dos parejas. Ocurre dentro de una Jornada.
3.  **Juego**: Conjunto de manos que suman puntos hasta alcanzar el objetivo (ej. 100 puntos). Una Partida puede componerse de un solo Juego (lo habitual) o varios.
4.  **Mano**: La unidad mínima. Ronda individual desde que se reparten las fichas hasta que alguien cierra o se tranca.

## Responsabilidades Específicas

### 1. Gestión del Torneo ("Pitomate 2025-2026")
- El sistema debe inicializarse con el nombre oficial: **"3er Torneo del Pitomate 2025-2026"**.
- Debe gestionar el calendario de las **16 Jornadas**.
    - API debe devolver para el "Header" del Frontend:
        - Título Oficial.
        - Fecha actual con formato largo: *Ej. "Viernes 6 de febrero de 2026"* (localizada al español).
        - Número de Jornada actual (1 de 16).
        - Nombre del Anfitrión de la Jornada.

### 2. Base de Datos Inteligente (Supabase)
- **Tabla `jornadas`**: ID, Fecha, Numero (1-16), Anfitrion_ID (FK a Players), Estado (Pendiente/En Curso/Finalizada).
- **Relaciones**:
    - Un `match` (Partida) pertenece a una `jornada`.
    - Un `hand` (Mano) pertenece a un `match`.
- **Log Histórico**: No borrar nada. Debemos poder reconstruir "Qué pasó en la mano 3 de la partida entre Alex/Rudy vs Beto/Mike en la Jornada 5".

### 3. Lógica de Negocio y "Sorpresa"
- **Estadísticas Avanzadas**: El backend debe estar listo para responder preguntas complejas:
    - "¿Quién es el jugador que más 'cierres' hace?"
    - "¿Qué pareja tiene el mejor desempeño en la Jornada 8 históricamente?"
    - "Zapateros" (Juegos ganados 100-0) deben ser detectados y guardados como trofeos especiales.
    - **Métrica de "Agresividad/Ritmo"**: Calcular el promedio de manos por partida para cada jugador.
        - *Insight*: Diferenciar entre jugadores "Rápidos/Agresivos" (partidas que acaban en 2-3 manos) vs "Conservadores/Lentos" (partidas de 14-15 manos).
- **Seguridad**: Autenticación vía PIN (definido previamente) para validar quién reporta el resultado de la mesa.

## Stack Tecnológico
- Supabase (PostgreSQL) con RLS (Row Level Security).
- Next.js Server Actions para mutaciones seguras.
