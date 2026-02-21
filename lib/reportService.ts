export interface PlayerReportData {
    nombre: string;
    puntosPrevios: number;
    puntosActuales: number;
}

export interface ReportPayload {
    diaSemana: string;
    fechaStr: string;
    anfitrion: string;
    ganadores: string;
    jugadores: PlayerReportData[];
}

/**
 * Función Pura: Generador de Reporte Final en Texto Plano
 * Requisitos Estrictos Cumplidos:
 * - Sin efectos secundarios
 * - Sin llamadas externas (bases de datos, APIs)
 * - Mantiene el formato exacto estipulado por el requerimiento normativo
 * - Ordena por puntaje Total descendentemente
 * - Jugadores ausentes procesan sus puntos actuales como 0
 * 
 * @param payload Datos inyectados desde UI
 * @returns String exacto formateado
 */
export function generateFinalReportString(payload: ReportPayload): string {
    // 1. Inmutabilidad: Clonar arreglo
    const jugadoresOrdenados = [...payload.jugadores];

    // 2. Ordenamiento: Mayor total a menor total
    jugadoresOrdenados.sort((a, b) => {
        const totalA = a.puntosPrevios + a.puntosActuales;
        const totalB = b.puntosPrevios + b.puntosActuales;
        return totalB - totalA;
    });

    // 3. Encabezado exacto
    // Nótese que se respeta exactamente el formato:
    // "Dominó [día] [fecha] anfitrión: [nombre]"
    // "Ganaron:"
    // "[ganadores]"
    // Y un salto de línea luego del encabezado.
    const header = `Dominó ${payload.diaSemana} ${payload.fechaStr} anfitrión: ${payload.anfitrion} \nGanaron:\n${payload.ganadores}\n\n`;

    // 4. Filas del cuerpo:
    // "X- Nombre: previos+actuales = total"
    const bodyRows = jugadoresOrdenados.map((jugador, index) => {
        const totalFinal = jugador.puntosPrevios + jugador.puntosActuales;
        return `${index + 1}- ${jugador.nombre}: ${jugador.puntosPrevios}+${jugador.puntosActuales} = ${totalFinal}`;
    });

    // 5. Retorno del String Final
    return header + bodyRows.join('\n');
}
