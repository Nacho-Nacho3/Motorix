import { pool } from "../config/db.js";
import { errores } from "../utils/errors.js";
import { taller } from "../config/taller.js";
import * as ticketsModel from "../models/ticket.model.js";
import { sumarTotales } from "./order-total.service.js";

// T035: generación y lectura del ticket (US3, CA-4/CA-5, FR-009 a FR-011,
// R-05, RN-10). El contenido NUNCA se almacena: cada lectura se recalcula
// desde la orden con la misma fórmula que el cobro (R-03), de modo que el
// comprobante y el total cobrado no pueden divergir.

/** Estados en los que la orden admite ticket (mismos que el cobro, VN-02). */
const ESTADOS_CON_TICKET = ["FINISHED", "DELIVERED"];

const dosDecimales = (valor) => Number(valor ?? 0).toFixed(2);

/**
 * Folio derivado del id (R-05, FR-011): `TCK-` con 6 dígitos, sin contador
 * ni columna propia. El mismo id produce siempre el mismo folio.
 */
export function folioDeTicket(id) {
  return `TCK-${String(id).padStart(6, "0")}`;
}

/** Orden mínima para verificar existencia y estado; `null` si no existe. */
async function buscarOrdenBasica(orderId) {
  const [filas] = await pool.query(
    "SELECT id, status FROM service_orders WHERE id = ? LIMIT 1",
    [orderId],
  );
  return filas[0] ?? null;
}

/**
 * Cliente y vehículo del comprobante: etiqueta «marca modelo año», placas y
 * kilometraje de entrada (CA-4).
 */
async function datosDeContexto(orderId) {
  const [filas] = await pool.query(
    `SELECT o.entry_mileage AS entryMileage,
            c.id AS clientId, c.name AS clientName, c.phone AS clientPhone,
            v.id AS vehicleId, v.brand, v.model, v.year,
            v.license_plate AS licensePlate
       FROM service_orders o
       JOIN clients c ON c.id = o.client_id
       JOIN vehicles v ON v.id = o.vehicle_id
      WHERE o.id = ?
      LIMIT 1`,
    [orderId],
  );
  const fila = filas[0];
  return {
    client: {
      id: Number(fila.clientId),
      name: fila.clientName,
      phone: fila.clientPhone,
    },
    vehicle: {
      id: Number(fila.vehicleId),
      label: `${fila.brand} ${fila.model} ${fila.year}`,
      licensePlate: fila.licensePlate,
      entryMileage: Number(fila.entryMileage),
    },
  };
}

/** Secciones de trabajo con importes como cadenas de 2 decimales. */
async function seccionesDeTrabajo(orderId) {
  const [servicios] = await pool.query(
    "SELECT id, description, unit_price AS unitPrice FROM order_services WHERE order_id = ? ORDER BY id",
    [orderId],
  );
  const [manoDeObra] = await pool.query(
    "SELECT id, concept, hours, hourly_rate AS hourlyRate FROM order_labor WHERE order_id = ? ORDER BY id",
    [orderId],
  );
  const [refacciones] = await pool.query(
    `SELECT op.id, p.part_code AS partCode, p.name, op.quantity,
            p.sale_price AS salePrice
       FROM order_parts op
       JOIN parts p ON p.id = op.part_id
      WHERE op.order_id = ?
      ORDER BY op.created_at ASC, op.id ASC`,
    [orderId],
  );

  const services = servicios.map((fila) => ({
    id: Number(fila.id),
    description: fila.description,
    unitPrice: dosDecimales(fila.unitPrice),
  }));

  const labor = manoDeObra.map((fila) => ({
    id: Number(fila.id),
    concept: fila.concept,
    hours: dosDecimales(fila.hours),
    hourlyRate: dosDecimales(fila.hourlyRate),
    // Subtotal con la MISMA fórmula que suma el total (R-03): las filas del
    // ticket siempre cuadran con el total impreso.
    subtotal: sumarTotales({ manoDeObra: [fila] }).laborSubtotal,
  }));

  const parts = refacciones.map((fila) => ({
    id: Number(fila.id),
    partCode: fila.partCode,
    name: fila.name,
    quantity: Number(fila.quantity),
    unitPrice: dosDecimales(fila.salePrice),
    subtotal: sumarTotales({ refacciones: [fila] }).partsSubtotal,
  }));

  return { services, labor, parts, filas: { servicios, manoDeObra, refacciones } };
}

/** Pago `PAID` de la orden o `null` si aún no hay cobro (escenario 4). */
async function pagoEfectivo(orderId) {
  const [filas] = await pool.query(
    `SELECT method, status, amount
       FROM payments
      WHERE order_id = ? AND status = 'PAID'
      ORDER BY id DESC
      LIMIT 1`,
    [orderId],
  );
  if (filas.length === 0) return null;
  return {
    method: filas[0].method,
    status: filas[0].status,
    amount: dosDecimales(filas[0].amount),
  };
}

/** Arma el objeto ticket completo del contrato (contenido calculado). */
async function armarTicket(filaTicket) {
  const orderId = filaTicket.orderId;
  const [contexto, trabajo, pago] = await Promise.all([
    datosDeContexto(orderId),
    seccionesDeTrabajo(orderId),
    pagoEfectivo(orderId),
  ]);

  return {
    id: filaTicket.id,
    folio: folioDeTicket(filaTicket.id),
    orderId,
    issuedBy: filaTicket.issuedBy,
    issuedByName: filaTicket.issuedByName,
    createdAt: filaTicket.createdAt,
    workshop: { name: taller.name, address: taller.address, phone: taller.phone },
    client: contexto.client,
    vehicle: contexto.vehicle,
    services: trabajo.services,
    labor: trabajo.labor,
    parts: trabajo.parts,
    totals: sumarTotales(trabajo.filas),
    payment: pago,
  };
}

/**
 * Genera el ticket de una orden terminada o entregada. Idempotente: si ya
 * existe se devuelve tal cual (200 en lugar de 201, FR-011).
 *
 * @returns {Promise<{ticket: object, creado: boolean}>}
 */
export async function generarTicket(orderId, usuario) {
  const orden = await buscarOrdenBasica(orderId);
  if (!orden) throw errores.serviceOrderNotFound();
  if (!ESTADOS_CON_TICKET.includes(orden.status)) {
    throw errores.orderNotFinished();
  }

  const { creado } = await ticketsModel.crear({
    orderId,
    issuedBy: usuario.id,
  });
  const fila = await ticketsModel.buscarPorOrden(orderId);
  return { ticket: await armarTicket(fila), creado };
}

/**
 * Contenido calculado del ticket existente (GET); sin ticket se responde
 * 404 TICKET_NOT_FOUND y se genera con POST.
 */
export async function obtenerTicket(orderId) {
  const orden = await buscarOrdenBasica(orderId);
  if (!orden) throw errores.serviceOrderNotFound();

  const fila = await ticketsModel.buscarPorOrden(orderId);
  if (!fila) throw errores.ticketNotFound();

  return armarTicket(fila);
}
