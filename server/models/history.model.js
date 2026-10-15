import { pool } from "../config/db.js";

// T011: historial de servicios del vehículo (US1, FR-001, FR-002).
// El historial se calcula en cada consulta sobre las tablas del Sprint 2:
// no existen tablas ni vistas derivadas (RN-10, R-04).

const DECIMAL = (valor) => (valor == null ? null : Number(valor).toFixed(2));

/** Vehículo con su cliente para la cabecera del historial. */
export async function buscarVehiculoConCliente(vehicleId) {
  const [filas] = await pool.query(
    `SELECT v.id,
            CONCAT(v.brand, ' ', v.model, ' ', v.license_plate) AS label,
            c.name AS clientName,
            v.current_mileage AS currentMileage
       FROM vehicles v
       JOIN clients c ON c.id = v.client_id
      WHERE v.id = ?`,
    [vehicleId],
  );
  return filas[0] ?? null;
}

/** Ítems de servicios, mano de obra y refacciones agrupados por orden. */
async function itemsPorOrden(ids) {
  const [servicios] = await pool.query(
    `SELECT order_id AS orderId, description, unit_price AS unitPrice
       FROM order_services
      WHERE order_id IN (?)
      ORDER BY id`,
    [ids],
  );
  const [manoObra] = await pool.query(
    `SELECT order_id AS orderId, concept, hours, hourly_rate AS hourlyRate
       FROM order_labor
      WHERE order_id IN (?)
      ORDER BY id`,
    [ids],
  );
  const [refacciones] = await pool.query(
    `SELECT op.order_id AS orderId, p.part_code AS partCode, p.name, op.quantity
       FROM order_parts op
       JOIN parts p ON p.id = op.part_id
      WHERE op.order_id IN (?)
      ORDER BY op.id`,
    [ids],
  );

  const agrupar = (filas) => {
    const mapa = new Map();
    for (const fila of filas) {
      const clave = Number(fila.orderId);
      if (!mapa.has(clave)) mapa.set(clave, []);
      mapa.get(clave).push(fila);
    }
    return mapa;
  };

  return {
    servicios: agrupar(servicios),
    manoObra: agrupar(manoObra),
    refacciones: agrupar(refacciones),
  };
}

/**
 * Órdenes FINISHED/DELIVERED del vehículo en cronológico descendente
 * (del más reciente al más antiguo), con sus ítems agregados (SC-001).
 */
export async function listarPorVehiculo(vehicleId) {
  const [ordenes] = await pool.query(
    `SELECT so.id,
            DATE(so.created_at) AS date,
            so.status,
            so.entry_mileage AS entryMileage,
            so.reported_problem AS reportedProblem,
            so.diagnosis,
            so.observations,
            so.recommendations,
            u.name AS mechanicName
       FROM service_orders so
       JOIN users u ON u.id = so.mechanic_id
      WHERE so.vehicle_id = ?
        AND so.status IN ('FINISHED', 'DELIVERED')
      ORDER BY so.created_at DESC, so.id DESC`,
    [vehicleId],
  );
  if (ordenes.length === 0) return [];

  const ids = ordenes.map((orden) => Number(orden.id));
  const { servicios, manoObra, refacciones } = await itemsPorOrden(ids);

  return ordenes.map((orden) => {
    const clave = Number(orden.id);
    return {
      orderId: orden.id,
      date: orden.date,
      status: orden.status,
      entryMileage: orden.entryMileage,
      reportedProblem: orden.reportedProblem,
      diagnosis: orden.diagnosis,
      services: (servicios.get(clave) ?? []).map((fila) => ({
        description: fila.description,
        unitPrice: DECIMAL(fila.unitPrice),
      })),
      labor: (manoObra.get(clave) ?? []).map((fila) => ({
        concept: fila.concept,
        hours: DECIMAL(fila.hours),
        hourlyRate: DECIMAL(fila.hourlyRate),
      })),
      parts: (refacciones.get(clave) ?? []).map((fila) => ({
        partCode: fila.partCode,
        name: fila.name,
        quantity: fila.quantity,
      })),
      observations: orden.observations,
      recommendations: orden.recommendations,
      mechanicName: orden.mechanicName,
    };
  });
}
