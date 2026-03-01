# 🗂️ Registro de Versionado (Changelog) - Torneo de Dominó

Este documento es la fuente de verdad para el historial de versiones del proyecto. Cada cambio significativo debe ser registrado aquí antes de ser subido a Vercel.

---

## [10.0.0] - 2026-03-01
### Añadido
- **PLATINUM STATS:** Saneamiento completo de la base de datos histórica.
- **Sincronización Real:** Inyectados los resultados oficiales al 26 de febrero (Anfitrión: Mayito).
- **Consolidación Individual:** Los puntos de campeonato reflejan ahora `Asistencias + Victorias` reales.

## [9.1.1] - 2026-03-01
### Corregido
- **iPhone Layout Fix:** Eliminado un artefacto visual ("bloque negro") en la cabecera provocado por elementos decorativos con Blur en Safari móvil.
- Sincronización de componentes de versionado (`VersionChecker`, `package.json`).

## [9.1.0] - 2026-03-01
### Añadido
- **Reset Nuclear en Resultados:** El botón "Iniciar Nueva Jornada" ahora ejecuta un `DELETE` en cascada en la base de datos para borrar jornadas de prueba sin ensuciar la analítica.
- **Sistematización de Versionado:** Creación de este documento (`VERSIONADO.md`) para seguimiento riguroso.
- **Blindaje de Querys:** Añadido `.limit(1)` a las consultas de torneo por fecha para evitar colisiones con datos huérfanos del simulador.

### Corregido
- Estabilización de la función `deactivateTournament` para que sea asíncrona y destructiva.
- Mejora en la limpieza de la base de datos de testeo local.

---

## [9.0.0] - 2026-02-28
### Añadido
- **Lanzamiento TITANIUM:** Refactorización visual extrema con estética premium y modo oscuro.
- **Protocolo de Anotador Único (Soft-Lock):** Implementación de `isSpectator` para evitar colisiones en la pizarra.
- **Sincronía Host Real-time:** Sincronización inmediata del nombre del anfitrión entre dispositivos.

---

## [8.0.0] - 2026-02-27
### Añadido
- **Reconexión Mágica:** Capacidad de recuperar el estado del torneo tras pérdida de conexión.
- **Sincronía Global:** Implementación de polling y subscripciones globales.
- **Generador Estocástico:** Algoritmo de sorteo de parejas Round Robin.
