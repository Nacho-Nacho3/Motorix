import * as modelo from "../models/client_notice.model.js";
import { errores } from "../utils/errors.js";
import { calcularEstadoMantenimiento } from "../utils/maintenance-state.js";

// T053: servicio de clientes por avisar (Sprint 6, US7, contrato
// client-notices.md). Solo registra lo que una persona ya habló con el
// cliente: el sistema no envía mensajes (CA-7, CA-10).

const ROTULOS = {
  ORDER_READY: "Orden terminada sin entregar",
  APPOINTMENT_TOMORROW: "Cita de mañana",
  MAINTENANCE_UPCOMING: "Mantenimiento por vencer",
  MAINTENANCE_OVERDUE: "Mantenimiento vencido",
};

/** Orden de presentación estable por motivo (P-8). */
const ORDEN_MOTIVO = [
  "ORDER_READY",
  "APPOINTMENT_TOMORROW",
  "MAINTENANCE_OVERDUE",
  "MAINTENANCE_UPCOMING",
];

function filaDeLista(base, motive, detail) {
  return {
    clientId: base.clientId,
    clientName: base.clientName,
    phone: base.phone,
    motive,
    motiveLabel: ROTULOS[motive],
    sourceId: base.sourceId,
    detail,
    // La nota se guarda al registrar el aviso; en la lista siempre es null.
    note: null,
    createdAt: base.createdAt,
  };
}

function detalleMantenimiento(fila, estado) {
  const prefijo = `Mantenimiento de ${fila.vehicleLabel}`;
  if (fila.nextDueDate) {
    return estado === "OVERDUE"
      ? `${prefijo} — venció el ${fila.nextDueDate}`
      : `${prefijo} — vence el ${fila.nextDueDate}`;
  }
  return estado === "OVERDUE"
    ? `${prefijo} — superó los ${fila.nextDueMileage} km`
    : `${prefijo} — objetivo de ${fila.nextDueMileage} km`;
}

/**
 * Lista de clientes por avisar: una fila por (cliente, hecho sin avisar).
 * Si el mismo cliente tiene dos motivos aparece en dos filas (CA-11).
 */
export async function listarPendientes() {
  const { ordenes, citas, mantenimientos, avisados } = await modelo.pendientes();
  const filas = [];

  for (const orden of ordenes) {
    filas.push(
      filaDeLista(
        orden,
        "ORDER_READY",
        `Orden #${orden.sourceId} — ${orden.brand} ${orden.model} ${orden.year} (${orden.licensePlate})`,
      ),
    );
  }

  for (const cita of citas) {
    filas.push(
      filaDeLista(
        cita,
        "APPOINTMENT_TOMORROW",
        `Cita de mañana a las ${cita.time} — ${cita.brand} ${cita.model} (${cita.licensePlate}) · ${cita.reason}`,
      ),
    );
  }

  for (const mantenimiento of mantenimientos) {
    // Misma regla que la lista y el dashboard de mantenimientos (CA-5).
    const { state } = calcularEstadoMantenimiento({
      nextDueDate: mantenimiento.nextDueDate,
      nextDueMileage: mantenimiento.nextDueMileage,
      warnDays: mantenimiento.warnDays,
      warnKm: mantenimiento.warnKm,
      kilometrajeActual: mantenimiento.currentMileage,
    });
    if (state !== "UPCOMING" && state !== "OVERDUE") continue;
    const motive = `MAINTENANCE_${state}`;
    const clave = `${mantenimiento.clientId}:${motive}:${mantenimiento.sourceId}`;
    if (avisados.has(clave)) continue;
    filas.push(
      filaDeLista(mantenimiento, motive, detalleMantenimiento(mantenimiento, state)),
    );
  }

  filas.sort(
    (a, b) =>
      ORDEN_MOTIVO.indexOf(a.motive) - ORDEN_MOTIVO.indexOf(b.motive) ||
      a.clientName.localeCompare(b.clientName, "es") ||
      a.sourceId - b.sourceId,
  );

  // El contrato pide un `id` numérico: la lista es calculada (aún no hay fila
  // en client_notices), así que el id es la posición estable en esta respuesta.
  return filas.map((fila, indice) => ({ id: indice + 1, ...fila }));
}

/**
 * Registra que se avisó al cliente por un hecho (CA-11, D-07). Valida que el
 * cliente exista y que el hecho exista y corresponda al motivo y al cliente
 * (404 `NOT_FOUND`). Devuelve el registro y si fue alta; repetir no duplica.
 */
export async function registrarAviso(usuario, { clientId, type, sourceId, note }) {
  if (!(await modelo.existeCliente(clientId))) {
    throw errores.notFound("NOT_FOUND", "El cliente no existe.");
  }
  if (!(await modelo.hechoDelCliente(type, sourceId, clientId))) {
    throw errores.notFound(
      "NOT_FOUND",
      "El hecho indicado no existe o no corresponde a ese cliente y motivo.",
    );
  }

  const nota = typeof note === "string" && note.trim() !== "" ? note.trim() : null;
  return modelo.registrar({
    clientId,
    type,
    sourceId,
    note: nota,
    notifiedBy: usuario.id,
  });
}
