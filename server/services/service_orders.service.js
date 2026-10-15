import * as ordenes from "../models/service_order.model.js";
import * as servicios from "../models/order_service.model.js";
import * as manoDeObra from "../models/order_labor.model.js";
import * as clientes from "../models/client.model.js";
import * as vehiculos from "../models/vehicle.model.js";
import * as usuarios from "../models/user.model.js";
import { AppError, errores } from "../utils/errors.js";

// T027/T057: lógica de negocio de órdenes (VS-02 a VS-07, RN-2 a RN-4, Q2).

/**
 * Valida el kilometraje de entrada contra el del vehículo (RN-3, RN-4, CA-6).
 * Devuelve `{ aplicarCorreccion, motivo }`; lanza AppError si no cumple.
 */
export function validarKilometraje({
  entryMileage,
  kilometrajePrevio = 0,
  rol,
  motivoCorreccion,
}) {
  if (!Number.isInteger(entryMileage) || entryMileage < 0) {
    throw errores.validation([
      {
        field: "entryMileage",
        message: "El kilometraje de entrada debe ser un entero mayor o igual a 0.",
      },
    ]);
  }

  // Solo ADMIN puede enviar el motivo de corrección (RN-4).
  const motivoPresente =
    motivoCorreccion != null && String(motivoCorreccion).trim() !== "";
  if (motivoPresente && rol !== "ADMIN") {
    throw errores.forbidden();
  }

  const motivo =
    motivoPresente && String(motivoCorreccion).trim().length >= 10
      ? String(motivoCorreccion).trim()
      : null;

  if (entryMileage < Number(kilometrajePrevio)) {
    if (rol !== "ADMIN" || !motivo) {
      throw errores.mileageLowerThanPrevious();
    }
    return { aplicarCorreccion: true, motivo };
  }

  return { aplicarCorreccion: false, motivo };
}

/** VS-02: el asignado debe existir, estar activo y ser mecánico (Q2). */
async function verificarMecanico(mechanicId) {
  if (!Number.isInteger(mechanicId) || mechanicId <= 0) {
    throw errores.mechanicRequired();
  }
  const mecanico = await usuarios.buscarUsuarioPorId(mechanicId);
  if (!mecanico) {
    throw errores.mechanicNotFound();
  }
  if (mecanico.role !== "MECHANIC" || !mecanico.active) {
    throw errores.invalidMechanic();
  }
  return mecanico;
}

export async function list(filtros = {}, usuario) {
  const pagina = Math.max(1, Number(filtros.page) || 1);
  const porPagina = Math.min(100, Math.max(1, Number(filtros.limit) || 10));

  // R-07 (US4): el mecánico siempre lista solo las suyas; cualquier
  // ?mechanicId que envíe se ignora a favor de su propio usuario.
  const esMecanico = usuario.role === "MECHANIC";

  const { orders, total } = await ordenes.listar({
    status: filtros.status ? String(filtros.status).trim() : "",
    mechanicId: esMecanico
      ? usuario.id
      : filtros.mechanicId
        ? Number(filtros.mechanicId)
        : null,
    vehicleId: filtros.vehicleId ? Number(filtros.vehicleId) : null,
    q: filtros.q ? String(filtros.q).trim() : "",
    pagina,
    porPagina,
  });

  return { orders, total };
}

export async function getById(id, usuario) {
  const order = await ordenes.buscarPorId(id);
  if (!order) {
    throw errores.serviceOrderNotFound();
  }
  // R-07 (US4): el mecánico solo accede a sus propias órdenes (403, no 404).
  if (usuario.role === "MECHANIC" && order.mechanicId !== usuario.id) {
    throw errores.forbidden();
  }
  // US5: servicios y mano de obra reales (CA-4).
  return {
    order,
    services: await servicios.listarPorOrden(id),
    labor: await manoDeObra.listarPorOrden(id),
  };
}

/** Los mecánicos activos para el selector de asignación (Q2). */
export async function listarMecanicos() {
  const mecanicos = await usuarios.listarUsuarios({
    role: "MECHANIC",
    active: true,
  });
  return mecanicos.map((mecanico) => ({
    id: mecanico.id,
    name: mecanico.name,
    username: mecanico.username,
  }));
}

export async function create(datos, usuario) {
  if (!Number.isInteger(datos.clientId) || datos.clientId <= 0) {
    throw new AppError(400, "CLIENT_REQUIRED", "La orden debe tener un cliente.");
  }
  const cliente = await clientes.buscarPorId(datos.clientId);
  if (!cliente) {
    throw errores.notFound("CLIENT_NOT_FOUND", "Cliente no encontrado.");
  }

  if (!Number.isInteger(datos.vehicleId) || datos.vehicleId <= 0) {
    throw errores.vehicleRequired();
  }
  const vehiculo = await vehiculos.buscarPorId(datos.vehicleId);
  if (!vehiculo) {
    throw errores.notFound("VEHICLE_NOT_FOUND", "Vehículo no encontrado.");
  }

  // VS-01/VA-03 (US3): el vehículo debe pertenecer al cliente de la orden.
  if (Number(vehiculo.clientId) !== Number(datos.clientId)) {
    throw errores.vehicleClientMismatch();
  }

  const mecanico = await verificarMecanico(datos.mechanicId);

  // RN-3/RN-4: kilometraje contra el previo, con corrección solo de ADMIN.
  const correccion = validarKilometraje({
    entryMileage: datos.entryMileage,
    kilometrajePrevio: Number(vehiculo.currentMileage),
    rol: usuario.role,
    motivoCorreccion: datos.mileageCorrectionReason,
  });

  const orden = await ordenes.insertar({
    clientId: datos.clientId,
    vehicleId: datos.vehicleId,
    mechanicId: mecanico.id,
    entryMileage: datos.entryMileage,
    reportedProblem: datos.reportedProblem,
    mileageCorrectionReason: correccion.motivo,
  });

  // VS-04: al crear, el kilometraje del vehículo pasa al de entrada.
  await vehiculos.actualizar(vehiculo.id, {
    currentMileage: datos.entryMileage,
  });

  return orden;
}

export async function update(id, datos, usuario) {
  const existente = await ordenes.buscarPorId(id);
  if (!existente) {
    throw errores.serviceOrderNotFound();
  }

  // VS-07: la orden entregada solo la corrige el administrador.
  if (existente.status === "DELIVERED" && usuario.role !== "ADMIN") {
    throw errores.orderDelivered();
  }

  const aActualizar = {};
  if (datos.reportedProblem !== undefined) {
    aActualizar.reportedProblem = datos.reportedProblem;
  }
  if (datos.mechanicId !== undefined) {
    const mecanico = await verificarMecanico(datos.mechanicId);
    aActualizar.mechanicId = mecanico.id;
  }

  return ordenes.actualizar(id, aActualizar);
}

/**
 * Permisos del trabajo de la orden (R-06): ADMIN en cualquier orden y
 * MECHANIC solo en las suyas; la recepción queda fuera por la autorización
 * de la ruta. VS-07: la orden entregada solo la corrige el administrador.
 */
async function verificarTrabajador(id, usuario) {
  const orden = await ordenes.buscarPorId(id);
  if (!orden) {
    throw errores.serviceOrderNotFound();
  }
  if (usuario.role === "MECHANIC" && orden.mechanicId !== usuario.id) {
    throw errores.forbidden();
  }
  if (orden.status === "DELIVERED" && usuario.role !== "ADMIN") {
    throw errores.orderDelivered();
  }
  return orden;
}

/** Registra diagnóstico, observaciones y recomendaciones (R-06, US5/US7). */
export async function registrarTrabajo(id, datos, usuario) {
  await verificarTrabajador(id, usuario);
  const aActualizar = {};
  if (datos.diagnosis !== undefined) {
    aActualizar.diagnosis = datos.diagnosis;
  }
  if (datos.observations !== undefined) {
    aActualizar.observations = datos.observations;
  }
  if (datos.recommendations !== undefined) {
    aActualizar.recommendations = datos.recommendations;
  }
  return ordenes.actualizar(id, aActualizar);
}

export async function agregarServicio(id, datos, usuario) {
  const orden = await verificarTrabajador(id, usuario);
  return servicios.insertar({
    orderId: orden.id,
    description: datos.description,
    unitPrice: datos.unitPrice ?? 0,
  });
}

export async function eliminarServicio(id, serviceId, usuario) {
  await verificarTrabajador(id, usuario);
  const borrado = await servicios.eliminar(id, serviceId);
  if (!borrado) {
    throw errores.orderItemNotFound();
  }
  return true;
}

export async function agregarManoDeObra(id, datos, usuario) {
  const orden = await verificarTrabajador(id, usuario);
  return manoDeObra.insertar({
    orderId: orden.id,
    concept: datos.concept,
    hours: datos.hours,
    hourlyRate: datos.hourlyRate ?? 0,
  });
}

export async function eliminarManoDeObra(id, laborId, usuario) {
  await verificarTrabajador(id, usuario);
  const borrado = await manoDeObra.eliminar(id, laborId);
  if (!borrado) {
    throw errores.orderItemNotFound();
  }
  return true;
}

// T066: máquina de estados de la orden (R-02, Q1, CA-5).

/** Etiquetas en español de los estados (contrato service-orders.md). */
export const etiquetasEstadoOrden = {
  RECEIVED: "Recibido",
  DIAGNOSIS: "Diagnóstico",
  IN_REPAIR: "En reparación",
  WAITING_PART: "Esperando refacción",
  FINISHED: "Terminado",
  DELIVERED: "Entregado",
};

/**
 * Transiciones permitidas: avance lineal; WAITING_PART sale hacia el estado
 * de origen (waiting_origin) y DELIVERED no tiene salidas (CA-5, CA-8).
 */
export const transicionesOrden = {
  RECEIVED: ["DIAGNOSIS"],
  DIAGNOSIS: ["IN_REPAIR", "WAITING_PART"],
  IN_REPAIR: ["FINISHED", "WAITING_PART"],
  WAITING_PART: [],
  FINISHED: ["DELIVERED"],
  DELIVERED: [],
};

function etiquetaEstado(status) {
  return etiquetasEstadoOrden[status] ?? status;
}

/**
 * Calcula la transición de estado de la orden. Al entrar a WAITING_PART
 * guarda el estado de origen (waiting_origin) y al salir se restaura
 * exactamente a él; sin saltos, retrocesos ni salidas de DELIVERED.
 * Lanza INVALID_STATUS_TRANSITION (400) si no está permitida.
 */
export function calcularTransicion({
  statusActual,
  nuevoStatus,
  waitingOrigin = null,
}) {
  const rechazo = () =>
    errores.invalidStatusTransition(
      `La orden no puede pasar de ${etiquetaEstado(statusActual)} a ${etiquetaEstado(nuevoStatus)}.`,
    );

  if (!transicionesOrden[statusActual] || statusActual === nuevoStatus) {
    throw rechazo();
  }

  // WAITING_PART solo sale hacia el estado desde el que se entró.
  if (statusActual === "WAITING_PART") {
    if (nuevoStatus !== waitingOrigin) {
      throw rechazo();
    }
    return { status: nuevoStatus, waitingOrigin: null };
  }

  if (!transicionesOrden[statusActual].includes(nuevoStatus)) {
    throw rechazo();
  }

  if (nuevoStatus === "WAITING_PART") {
    return { status: "WAITING_PART", waitingOrigin: statusActual };
  }

  return { status: nuevoStatus, waitingOrigin: null };
}

/** Aplica el cambio de estado con permisos y máquina de estados (T066/T067). */
export async function cambiarEstado(id, nuevoStatus, usuario) {
  const orden = await ordenes.buscarPorId(id);
  if (!orden) {
    throw errores.serviceOrderNotFound();
  }

  // Permisos (Q1, CA-7): ADMIN en cualquier orden y MECHANIC solo en las
  // suyas; la recepción queda fuera por la autorización de la ruta.
  if (usuario.role === "MECHANIC" && orden.mechanicId !== usuario.id) {
    throw errores.forbidden();
  }

  const interno = await ordenes.buscarEstado(id);
  const transicion = calcularTransicion({
    statusActual: interno.status,
    nuevoStatus,
    waitingOrigin: interno.waitingOrigin,
  });

  return ordenes.actualizar(id, {
    status: transicion.status,
    waitingOrigin: transicion.waitingOrigin,
  });
}
