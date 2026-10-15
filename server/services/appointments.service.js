import * as citas from "../models/appointment.model.js";
import * as clientes from "../models/client.model.js";
import * as vehiculos from "../models/vehicle.model.js";
import { AppError, errores } from "../utils/errors.js";

// T011: lógica de negocio de citas (VA-01 a VA-05, FR-001 a FR-005).

// Máquina de transiciones (FR-005, Q3): avance lineal, cancelación desde
// cualquier estado activo; COMPLETED y CANCELED son finales (VA-05).
const TRANSICIONES_CITA = {
  PENDING: ["CONFIRMED", "CANCELED"],
  CONFIRMED: ["IN_PROGRESS", "CANCELED"],
  IN_PROGRESS: ["COMPLETED", "CANCELED"],
  COMPLETED: [],
  CANCELED: [],
};

const ETIQUETAS_CITA = {
  PENDING: "Pendiente",
  CONFIRMED: "Confirmada",
  IN_PROGRESS: "En proceso",
  COMPLETED: "Completada",
  CANCELED: "Cancelada",
};

const ESTADOS_CERRADOS = ["COMPLETED", "CANCELED"];

/** Estados a los que puede pasar la cita desde su estado actual. */
export function estadosSiguientesCita(estadoActual) {
  return [...(TRANSICIONES_CITA[estadoActual] ?? [])];
}

/** true si la transición está permitida en la máquina de estados. */
export function puedeTransicionarCita(estadoActual, nuevoEstado) {
  return estadosSiguientesCita(estadoActual).includes(nuevoEstado);
}

function etiqueta(estado) {
  return ETIQUETAS_CITA[estado] ?? estado;
}

function esIdValido(valor) {
  return Number.isInteger(valor) && valor > 0;
}

/** VA-01 a VA-03: referencias obligatorias, existentes y coincidentes. */
async function verificarReferencias({ clientId, vehicleId }) {
  if (!esIdValido(clientId)) {
    throw new AppError(400, "CLIENT_REQUIRED", "La cita debe tener un cliente.");
  }
  const cliente = await clientes.buscarPorId(clientId);
  if (!cliente) {
    throw errores.notFound("CLIENT_NOT_FOUND", "Cliente no encontrado.");
  }

  if (!esIdValido(vehicleId)) {
    throw errores.vehicleRequired();
  }
  const vehiculo = await vehiculos.buscarPorId(vehicleId);
  if (!vehiculo) {
    throw errores.notFound("VEHICLE_NOT_FOUND", "Vehículo no encontrado.");
  }

  if (vehiculo.clientId !== clientId) {
    throw errores.vehicleClientMismatch();
  }
}

export async function list({ date, status, q, page, limit } = {}) {
  const pagina = Math.max(1, Number(page) || 1);
  const porPagina = Math.min(100, Math.max(1, Number(limit) || 10));

  if (status && !TRANSICIONES_CITA[status]) {
    throw errores.validation([
      { field: "status", message: "Estado de cita no válido." },
    ]);
  }

  const { appointments, total } = await citas.listar({
    date: date ? String(date).trim() : "",
    status: status ? String(status).trim() : "",
    q: q ? String(q).trim() : "",
    pagina,
    porPagina,
  });

  return { appointments, total };
}

export async function getById(id) {
  const appointment = await citas.buscarPorId(id);
  if (!appointment) {
    throw errores.appointmentNotFound();
  }
  return { appointment };
}

export async function create(datos) {
  await verificarReferencias(datos);

  return citas.insertar({
    clientId: Number(datos.clientId),
    vehicleId: Number(datos.vehicleId),
    date: datos.date,
    time: datos.time,
    reason: datos.reason,
    notes: datos.notes || null,
  });
}

export async function update(id, datos) {
  const existente = await citas.buscarPorId(id);
  if (!existente) {
    throw errores.appointmentNotFound();
  }

  // VA-05: la cita cerrada se conserva como historial: ni se edita ni se reabre.
  if (ESTADOS_CERRADOS.includes(existente.status)) {
    throw errores.appointmentClosed();
  }

  // VA-04: solo avance lineal o cancelación desde un estado activo.
  if (datos.status !== undefined && !puedeTransicionarCita(existente.status, datos.status)) {
    throw errores.invalidStatusTransition(
      `La cita no puede pasar de ${etiqueta(existente.status)} a ${etiqueta(datos.status)}.`,
    );
  }

  return citas.actualizar(id, datos);
}
