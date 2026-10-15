import * as panelModel from "../models/dashboard.model.js";
import * as mantenimientosServicio from "./maintenances.service.js";
import * as partesModel from "../models/part.model.js";
import { calcularTotalOrden } from "./order-total.service.js";

// T053/T061: composición del panel de control (US5/US6, CA-6, FR-012, RN-10).
// El `summary` y el detalle se arman SIEMPRE desde los módulos existentes en
// la MISMA ejecución (SC-007, sin caché ni tablas derivadas):
//
// - Mantenimientos: `listarMantenimientos()` entrega la lista con el estado
//   calculado y YA ordenada por urgencia (OVERDUE → UPCOMING → NORMAL); de
//   ahí salen los dos contadores y las dos listas del detalle. Es la MISMA
//   función pura `calcularEstadoMantenimiento` de la lista del módulo.
// - Stock bajo: `partes.listar({low: true})` usa el mismo filtro que
//   `GET /api/parts?low=true` (`stock_current <= stock_min`); el contador es
//   la longitud de esa misma lista (detalle y contador nunca se desincronizan).
// - Totales de las órdenes recientes: fórmula R-03 sin columna almacenada.

/** Límites del detalle (contracts/dashboard.md). */
const LIMITE_ORDENES = 5;
const LIMITE_CITAS = 5;
const LIMITE_MANTENIMIENTOS = 5;

/** Objeto de mantenimiento exactamente con los campos del contrato. */
function aDetalleMantenimiento(mantenimiento) {
  return {
    id: mantenimiento.id,
    vehicleLabel: mantenimiento.vehicleLabel,
    clientName: mantenimiento.clientName,
    nextDueDate: mantenimiento.nextDueDate,
    nextDueMileage: mantenimiento.nextDueMileage,
    daysRemaining: mantenimiento.daysRemaining,
    mileageRemaining: mantenimiento.mileageRemaining,
  };
}

export async function obtenerDashboard() {
  const [
    vehiculosAtendidos,
    vehiculosEnReparacion,
    ordenesPendientes,
    ordenesTerminadas,
    citasProximas,
    listadoMantenimientos,
    alertasStock,
  ] = await Promise.all([
    panelModel.contarVehiculosAtendidos(),
    panelModel.contarVehiculosEnReparacion(),
    panelModel.contarOrdenesPendientes(),
    panelModel.contarOrdenesTerminadas(),
    panelModel.contarCitasProximas(),
    mantenimientosServicio.listarMantenimientos(),
    partesModel.listar({ low: true }),
  ]);

  const mantenimientos = listadoMantenimientos.maintenances;
  // El contador usa TODOS los registros; la lista del detalle aplica el
  // límite de 5 (por eso se filtra antes de recortar).
  const todosPorVencer = mantenimientos.filter(
    (mantenimiento) => mantenimiento.state === "UPCOMING",
  );
  const porVencer = todosPorVencer.slice(0, LIMITE_MANTENIMIENTOS);
  const vencidos = mantenimientos.filter(
    (mantenimiento) => mantenimiento.state === "OVERDUE",
  );

  // Totales calculados en la MISMA consulta (R-03); Promise.all los resuelve
  // en paralelo sobre las 5 órdenes más recientes.
  const filasOrdenes = await panelModel.listarOrdenesRecientes(
    LIMITE_ORDENES,
  );
  const recientes = await Promise.all(
    filasOrdenes.map(async (fila) => ({
      id: fila.id,
      clientName: fila.clientName,
      vehicleLabel: fila.vehicleLabel,
      status: fila.status,
      total: (await calcularTotalOrden(fila.id)).total,
      updatedAt: fila.updatedAt,
    })),
  );

  const citas = await panelModel.listarCitasProximas(LIMITE_CITAS);

  return {
    summary: {
      vehiclesAttended: vehiculosAtendidos,
      vehiclesInRepair: vehiculosEnReparacion,
      ordersPending: ordenesPendientes,
      ordersFinished: ordenesTerminadas,
      nextAppointments: citasProximas,
      upcomingMaintenances: todosPorVencer.length,
      overdueMaintenances: vencidos.length,
      lowStockCount: alertasStock.length,
    },
    recentOrders: recientes,
    nextAppointments: citas,
    maintenances: {
      upcoming: porVencer.map(aDetalleMantenimiento),
      overdue: vencidos.map(aDetalleMantenimiento),
    },
    lowStockParts: alertasStock.map((parte) => ({
      id: parte.id,
      partCode: parte.partCode,
      name: parte.name,
      stockCurrent: parte.stockCurrent,
      stockMin: parte.stockMin,
    })),
  };
}
