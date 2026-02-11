# Reglamento Oficial y Lógica del Torneo

> [!IMPORTANT]
> Este documento sirve como la "Verdad Única" para el Agente de Software. Cualquier discrepancia en el código debe corregirse para coincidir con este documento.

## 1. Configuración de la Partida (The Night)
- **Formato**: Parejas Fijas (sorteadas al inicio de la noche).
- **Sistema**: Round Robin (Todos contra todos).
- **Mesas**: Simultáneas.

### Variantes de Duración (Configurable al inicio)
1.  **Modo Estándar**: A **100 puntos**.
2.  **Modo Tiempo Límite**: Partidas de **40 minutos**.
    - *Condición de victoria*: Al sonar la alarma, gana la pareja con mayor puntuación en ese instante.

## 2. Puntuación de la Mano (Hand Scoring)
El conteo de puntos sigue las reglas estándar de la FID/FMD:
- **Cierre Normal (Domino)**:
    - La pareja ganadora suma los puntos de las fichas restantes de la pareja perdedora.
    - Se asume que el ganador tiene 0 puntos en mano.
- **Cierre Trancado (Blocked Game)**:
    - Gana la pareja con **menos puntos** (pip count) en sus fichas.
    - **Puntos**: Al ganador se le suman los puntos de la pareja perdedora (la que se quedó con más puntos).
    - *Nota*: En caso de empate en puntos de fichas en una tranca, la regla estándar suele anular la mano o otorgar puntos al "mano", pero asumiremos por ahora que no hay empate o se repite, salvo instrucción contraria.

## 3. Ganador de la Noche (The Thursday Winner)
Se determina al finalizar todas las rondas programadas.

1.  **Criterio 1 (Principal)**: Mayor número de partidas ganadas.
2.  **Criterio 2 (Desempate)**: Mejor Diferencial de Puntos.
    - Fórmula: `Puntos Favor - Puntos Contra`.
    - Ejemplo: Pareja A (+50) vs Pareja B (+110). Gana B.

## 4. Puntuación de la Temporada (The 16 Thursdays)
Puntuación individual acumulativa para el ranking anual:
- **Ausente**: 0 puntos.
- **Asistente (No Ganador)**: 1 punto.
- **Ganador de la Noche**: 2 puntos (1 por asistencia + 1 por victoria).

## 5. Logística y Advertencias
### Escenario de 16 Jugadores (8 Parejas)
- **Rondas necesarias**: 7 rondas (para jugar todos contra todos).
- **Mesas activas**: 4 mesas simultáneas.
- **Tiempo estimado**: ~4 horas 40 minutos.
- **Decisión**: **ACEPTADA**. ("Venimos a jugar, no a dormir").

### Escenario de 12 Jugadores (6 Parejas)
- **Rondas necesarias**: 5 rondas.
- **Tiempo estimado**: 5 * 40 = 200 min (**3 horas 20 min**). Más manejable.

## 6. Especificación de Diseño (Frontend)
Basado en la referencia visual proporcionada:
- **Estilo**: Skeuomórfico/Limpio. "Pizarra" o "Mesa de juego".
- **Paleta**: Fondo marrón oscuro (#4A3B32), Textos blancos/tiza.
- **Layout**:
    - Columna Izquierda: "Nosotros" (Nombre 1, Nombre 2).
    - Columna Derecha: "Ellos" (Nombre 1, Nombre 2).
    - Centro: Línea divisoria y Meta (100).
    - Inputs: Botones grandes o campos tipo "tarjeta" para ingresar el puntaje de cada mano.
    - Totales: Sumatoria automática grande en la parte inferior.
