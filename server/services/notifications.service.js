import { pool } from "../config/db.js";
import { listarMantenimientos } from "./maintenances.service.js";
import * as partes from "../models/part.model.js";
import * as citas from "../models/appointment.model.js";
import { leidasDe, marcarLeido } from "../models/notification_read.model.js";
import { notificationKeySchema } from "../validators/notifications.js";
import { formatearError } from "../middlewares/validate.js";
import {
  construirClave,
  esOrdenDetenida,
  severidadStock,
} from "../utils/notification-rules.js";

// T014: centro de avisos (Sprint 6, US1, contrato notifications.md).
// Los avisos se calculan en cada consulta (P-1, RN-10): aquí no hay caché
// ni tabla de avisos, solo la de lecturas por usuario (P-15).

/** Orden y rótulos fijos de los grupos (el contrato manda la estructura). */
const GRUPOS = [
  { tipo: "MAINTENANCE", etiqueta: "Mantenimientos" },
  { tipo: "APPOINTMENT", etiqueta: "Citas de hoy" },
  { tipo: "STOCK", etiqueta: "Stock" },
  { tipo: "ORDER_STOPPED", etiqueta: "Órdenes detenidas" },
];

/**
 * Matriz de rol P-6/CA-4 (D-08): qué grupos recibe cada rol. Los grupos
 * siempre están presentes (aunque vacíos) para que la UI no cambie de
 * estructura. Se abre por historia: US2 agrega RECEPTIONIST sin stock,
 * US3 confirma stock solo de ADMIN y US5 agrega MECHANIC con sus órdenes.
 */
const GRUPOS_POR_ROL = {
  ADMIN: ["MAINTENANCE", "APPOINTMENT", "STOCK", "ORDER_STOPPED"],
  // T033 (US2): recepción recibe mantenimientos, citas y órdenes
  // detenidas —nunca stock— (CA-4, FR-004).
  RECEPTIONIST: ["MAINTENANCE", "APPOINTMENT", "ORDER_STOPPED"],
  MECHANIC: [],
};

/** Estados de orden en español para el detalle del aviso. */
const ESTADOS_ORDEN = {
  RECEIVED: "recibida",
  DIAGNOSIS: "diagnóstico",
  IN_REPAIR: "en reparación",
  WAITING_PART: "esperando refacciones",
};

/** Fecha local en YYYY-MM-DD (para filtrar la cita de hoy, D-02). */
function fechaLocal(dias = 0) {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + dias);
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

function detalleMantenimiento(mantenimiento) {
  if (mantenimiento.state === "OVERDUE") {
    if (mantenimiento.nextDueDate) {
      const objetivo =
        mantenimiento.nextDueMileage != null
          ? ` · objetivo ${mantenimiento.nextDueMileage} km`
          : "";
      return `Venció el ${mantenimiento.nextDueDate}${objetivo}`;
    }
    return `Kilometraje objetivo superado: ${mantenimiento.nextDueMileage} km`;
  }
  if (mantenimiento.nextDueDate) {
    const dias =
      mantenimiento.daysRemaining != null
        ? ` (faltan ${mantenimiento.daysRemaining} días)`
        : "";
    return `Vence el ${mantenimiento.nextDueDate}${dias}`;
  }
  return `Faltan ${mantenimiento.mileageRemaining ?? 0} km`;
}

/**
 * Avisos de mantenimiento UPCOMING/OVERDUE (RN-11: estados con sus warns).
 * T034 (US2, FR-005): el cálculo es EXACTAMENTE el de la lista y del
 * dashboard — `listarMantenimientos()` aplica `calcularEstadoMantenimiento`
 * —, así el indicador «Vencido»/«Próximo» y la severidad del aviso
 * (`OVERDUE`/`UPCOMING`, contrato notifications.md) coinciden 1:1 con los
 * módulos (SC-002, CA-5).
 */
async function avisosMantenimientos() {
  const { maintenances } = await listarMantenimientos();
  return maintenances
    .filter((mantenimiento) => mantenimiento.state !== "NORMAL")
    .map((mantenimiento) => ({
      key: construirClave("MAINTENANCE", mantenimiento.id, mantenimiento.state),
      // read se resuelve contra notification_reads en obtenerAvisos.
      read: false,
      title:
        mantenimiento.state === "OVERDUE"
          ? `Mantenimiento vencido — ${mantenimiento.vehicleLabel}`
          : `Mantenimiento próximo — ${mantenimiento.vehicleLabel}`,
      detail: detalleMantenimiento(mantenimiento),
      severity: mantenimiento.state,
      navigation: { route: "/maintenance", entityId: mantenimiento.id },
    }));
}

/** Citas de hoy sin importar su estado (D-02, clarify). */
async function avisosCitas() {
  const { appointments } = await citas.listar({
    date: fechaLocal(),
    porPagina: 1000,
  });
  return appointments.map((cita) => ({
    key: construirClave("APPOINTMENT", cita.id, "TODAY"),
    read: false,
    title: `Cita de hoy — ${cita.vehicleLabel}`,
    detail: `${cita.time} · ${cita.reason}`,
    severity: "TODAY",
    navigation: { route: "/appointments", entityId: cita.id },
  }));
}

/** Refacciones con stock ≤ mínimo (LOW) o agotadas (OUT). */
async function avisosStock() {
  const alertas = await partes.listar({ low: true });
  return alertas.map((parte) => {
    const severity = severidadStock(parte.stockCurrent);
    return {
      key: construirClave("STOCK", parte.id, severity),
      read: false,
      title:
        severity === "OUT"
          ? `Stock agotado — ${parte.name}`
          : `Stock bajo — ${parte.name}`,
      detail:
        severity === "OUT"
          ? `Sin existencias (mínimo ${parte.stockMin})`
          : `Quedan ${parte.stockCurrent} piezas (mínimo ${parte.stockMin})`,
      severity,
      navigation: { route: "/inventory", entityId: parte.id },
    };
  });
}

/**
 * Órdenes sin cambios por más de 2 días en estado no terminal (D-01, P-3).
 * La consulta SQL hace el prefiltrado y `esOrdenDetenida` re-aplica el mismo
 * criterio. Para MECHANIC el alcance queda acotado a sus órdenes (D-08);
 * el grupo se habilita en US5.
 */
async function avisosOrdenesDetenidas(usuario) {
  const condiciones = [
    "so.status NOT IN ('FINISHED', 'DELIVERED')",
    "so.updated_at <= DATE_SUB(NOW(), INTERVAL 2 DAY)",
  ];
  const parametros = [];
  if (usuario.role === "MECHANIC") {
    condiciones.push("so.mechanic_id = ?");
    parametros.push(usuario.id);
  }

  const [filas] = await pool.query(
    `SELECT so.id, so.status, so.updated_at AS updatedAt,
            CONCAT(v.brand, ' ', v.model, ' ', v.license_plate) AS vehicleLabel,
            c.name AS clientName,
            so.reported_problem AS reportedProblem
       FROM service_orders so
       JOIN vehicles v ON v.id = so.vehicle_id
       JOIN clients c ON c.id = so.client_id
      WHERE ${condiciones.join(" AND ")}
      ORDER BY so.updated_at ASC`,
    parametros,
  );

  const ahora = new Date();
  return filas
    .filter((fila) => esOrdenDetenida(fila, ahora))
    .map((fila) => {
      const dias = Math.floor(
        (ahora.getTime() - new Date(fila.updatedAt).getTime()) / 86400000,
      );
      // T041 (US4, aceptación 1): la orden queda identificable con el
      // vehículo en el rótulo y el cliente más el problema en el detalle.
      const detalle = [
        `Sin cambios desde hace ${dias} días (${
          ESTADOS_ORDEN[fila.status] ?? fila.status
        })`,
        fila.clientName,
        fila.reportedProblem ? `«${fila.reportedProblem}»` : null,
      ]
        .filter(Boolean)
        .join(" · ");
      return {
        key: construirClave("ORDER_STOPPED", fila.id, fila.status),
        read: false,
        title: `Orden detenida — ${fila.vehicleLabel}`,
        detail: detalle,
        severity: fila.status,
        navigation: { route: "/orders", entityId: fila.id },
      };
    });
}

async function construirItems(tipo, usuario) {
  switch (tipo) {
    case "MAINTENANCE":
      return avisosMantenimientos();
    case "APPOINTMENT":
      return avisosCitas();
    case "STOCK":
      // T038 (US3, FR-004/RN-15): defensa en profundidad — además de la
      // matriz de roles, el stock solo se construye para ADMIN.
      if (usuario.role !== "ADMIN") return [];
      return avisosStock();
    case "ORDER_STOPPED":
      return avisosOrdenesDetenidas(usuario);
    default:
      return [];
  }
}

/**
 * Centro de avisos del usuario autenticado (contrato notifications.md):
 * los 4 grupos siempre presentes, sus ítems con `read` resuelto contra
 * `notification_reads` y `unreadCount` = avisos actuales no leídos (P-15).
 */
export async function obtenerAvisos(usuario) {
  const permitidos = new Set(GRUPOS_POR_ROL[usuario.role] ?? []);
  const leidas = await leidasDe(usuario.id);

  const groups = [];
  let unreadCount = 0;

  for (const { tipo, etiqueta } of GRUPOS) {
    const items = permitidos.has(tipo)
      ? await construirItems(tipo, usuario)
      : [];
    for (const item of items) {
      item.read = leidas.has(item.key);
      if (!item.read) unreadCount += 1;
    }
    groups.push({ type: tipo, label: etiqueta, items });
  }

  return { unreadCount, groups };
}

/**
 * T026 (US6, FR-006, P-7): marca una clave como leída para el usuario del
 * token. Valida la clave con el schema del contrato, hace el upsert
 * idempotente y devuelve el `unreadCount` **recalculado** para que la campana
 * se actualice en el mismo viaje (D-03). Una clave bien formada sin aviso
 * activo se acepta (fila inocua).
 */
export async function registrarLectura(usuario, key) {
  const resultado = notificationKeySchema.safeParse({ key });
  if (!resultado.success) throw formatearError(resultado.error);

  await marcarLeido(usuario.id, resultado.data.key);
  const { unreadCount } = await obtenerAvisos(usuario);
  return { read: true, unreadCount };
}
