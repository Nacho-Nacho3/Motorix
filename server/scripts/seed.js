import { fileURLToPath } from "node:url";
import { pool } from "../config/db.js";
import { crearCuentasIniciales } from "./create-admin.js";
import { buscarPorTelefono as buscarClientePorTelefono, crear as crearCliente } from "../models/client.model.js";
import { buscarPorPlaca, buscarPorId as buscarVehiculo, crear as crearVehiculo, actualizar as actualizarVehiculo } from "../models/vehicle.model.js";
import * as citas from "../models/appointment.model.js";
import * as ordenes from "../models/service_order.model.js";
import * as servicios from "../models/order_service.model.js";
import * as manoDeObra from "../models/order_labor.model.js";
import * as mantenimientos from "../models/maintenance.model.js";
import { buscarPorCodigo as buscarPartePorCodigo } from "../models/part.model.js";
import * as inventario from "../services/inventory.service.js";
import { calcularTotalOrden } from "../services/order-total.service.js";
import { registrarPago } from "../services/payments.service.js";
import { generarTicket } from "../services/tickets.service.js";

// T025/T040/T051/T075/T077/T064: seed idempotente. Re-ejecutarlo no duplica
// registros (Principio III): cada sección se omite si su tabla ya tiene filas
// o, en pagos y tickets, si la orden ya tiene el suyo (idempotente por orden).

const CLIENTES_EJEMPLO = [
  { name: "Juan Pérez", phone: "5512345678", email: "juan@correo.mx" },
  { name: "María López", phone: "5523456789", email: "maria@correo.mx" },
  { name: "Carlos Sánchez", phone: "5534567890", email: "carlos@correo.mx" },
];

// Cada vehículo apunta a un cliente por teléfono (el seed de clientes corre antes).
const VEHICULOS_EJEMPLO = [
  {
    cliente: "5512345678",
    brand: "Toyota",
    model: "Corolla",
    year: 2020,
    licensePlate: "ABC1234",
    vin: null,
    currentMileage: 85000,
  },
  {
    cliente: "5512345678",
    brand: "Nissan",
    model: "Versa",
    year: 2019,
    licensePlate: "DEF5678",
    vin: "JN1BZ4DM0KW000001",
    currentMileage: 120500,
  },
  {
    cliente: "5523456789",
    brand: "Volkswagen",
    model: "Gol",
    year: 2018,
    licensePlate: "GHI9012",
    vin: null,
    currentMileage: 98300,
  },
];

// T075: citas y órdenes de ejemplo (Sprint 2). Idempotencia por tabla: si ya
// existe al menos un registro, no se crea nada nuevo (SC-007, Principio III).
const CITAS_EJEMPLO = [
  { cliente: "5512345678", placas: "ABC1234", date: "2026-10-20", time: "09:00", reason: "Revisión de frenos", status: "PENDING" },
  { cliente: "5512345678", placas: "DEF5678", date: "2026-10-21", time: "11:30", reason: "Cambio de aceite y filtro", status: "CONFIRMED" },
  { cliente: "5523456789", placas: "GHI9012", date: "2026-10-22", time: "15:00", reason: "Diagnóstico de ruido al estacionar", status: "IN_PROGRESS" },
  { cliente: "5512345678", placas: "ABC1234", date: "2026-10-08", time: "10:00", reason: "Cambio de llantas", status: "CANCELED" },
];

const ORDENES_EJEMPLO = [
  {
    placas: "ABC1234",
    entryMileage: 86000,
    reportedProblem: "Ruido al frenar al detener el vehículo",
    status: "DIAGNOSIS",
    diagnosis: "Pastillas delanteras desgastadas",
    observations: "Discos en buen estado",
    recommendations: "Revisar los frenos en 5,000 km",
    servicios: [{ description: "Cambio de pastillas delanteras", unitPrice: 450 }],
    manoDeObra: [{ concept: "Cambiar pastillas delanteras", hours: 1.5, hourlyRate: 350 }],
  },
  {
    placas: "DEF5678",
    entryMileage: 121000,
    reportedProblem: "Falla eléctrica intermitente en el tablero",
    status: "IN_REPAIR",
    diagnosis: "Fusible principal en corto",
    observations: "Se localizó el corto en el arnés del tablero",
    recommendations: null,
    servicios: [{ description: "Reparación de arnés del tablero", unitPrice: 780 }],
    manoDeObra: [{ concept: "Diagnóstico eléctrico", hours: 2, hourlyRate: 350 }],
  },
  {
    placas: "GHI9012",
    entryMileage: 99000,
    reportedProblem: "Vibración al frenar a alta velocidad",
    status: "FINISHED",
    diagnosis: "Discos delanteros con desgaste irregular",
    observations: "Se rectificaron los discos delanteros",
    recommendations: "Revalidar el torque de las ruedas a los 500 km",
    servicios: [{ description: "Rectificado de discos delanteros", unitPrice: 620 }],
    manoDeObra: [{ concept: "Rectificado y montaje de discos", hours: 2.5, hourlyRate: 350 }],
  },
  // T064 (Sprint 4): SEGUNDA orden terminada; queda SIN pago para demostrar
  // el cobro desde cero (quickstart V1/V2). La primera terminada (GHI9012)
  // es la que recibe el pago en efectivo y su ticket TCK-….
  {
    placas: "ABC1234",
    entryMileage: 99500,
    reportedProblem: "Mantenimiento de 100,000 km y revisión general",
    status: "FINISHED",
    diagnosis: "Servicio programado pendiente",
    observations: "Servicio completo realizado y niveles revisados",
    recommendations: "Próximo servicio a los 105,000 km",
    servicios: [{ description: "Servicio de mantenimiento programado", unitPrice: 780 }],
    manoDeObra: [{ concept: "Servicio de 100,000 km", hours: 2, hourlyRate: 350 }],
  },
];

// T077: refacciones de ejemplo (Sprint 3). Dos quedan en alerta de stock
// bajo (AMO-003 bajo mínimo y FUS-004 agotado) para ver CA-7 en caliente;
// con los seis el quickstart V1 encuentra catálogo y alertas.
const REFACCIONES_EJEMPLO = [
  {
    partCode: "BAL-001",
    name: "Balatas traseras",
    category: "Frenos",
    brand: "Bosch",
    stockCurrent: 12,
    stockMin: 5,
    purchasePrice: "420.00",
    salePrice: "850.00",
  },
  {
    partCode: "FIL-002",
    name: "Filtro de aceite",
    category: "Filtros",
    brand: "Mann",
    stockCurrent: 20,
    stockMin: 6,
    purchasePrice: "90.00",
    salePrice: "180.00",
  },
  {
    partCode: "AMO-003",
    name: "Amortiguador delantero",
    category: "Suspensión",
    brand: "Monroe",
    stockCurrent: 3,
    stockMin: 4,
    purchasePrice: "780.00",
    salePrice: "1450.00",
  },
  {
    partCode: "FUS-004",
    name: "Fusible 10A",
    category: "Eléctrica",
    brand: "Bosch",
    stockCurrent: 0,
    stockMin: 2,
    purchasePrice: "25.00",
    salePrice: "60.00",
  },
  {
    partCode: "LLT-005",
    name: "Llanta 15 pulgadas",
    category: "Llantas",
    brand: "Michelin",
    stockCurrent: 8,
    stockMin: 4,
    purchasePrice: "1200.00",
    salePrice: "2100.00",
  },
  {
    partCode: "BOM-006",
    name: "Bomba de agua",
    category: "Motor",
    brand: "Gates",
    stockCurrent: 6,
    stockMin: 3,
    purchasePrice: "650.00",
    salePrice: "1200.00",
  },
];

async function contar(tabla) {
  const [filas] = await pool.query(`SELECT COUNT(*) AS total FROM ${tabla}`);
  return filas[0].total;
}

/** Primer ADMIN activo; sin él no se siembran filas con `created_by`. */
async function primerAdmin() {
  const [admins] = await pool.query(
    "SELECT id FROM users WHERE role = 'ADMIN' AND active = 1 ORDER BY id LIMIT 1",
  );
  return admins.length > 0 ? admins[0].id : null;
}

export async function crearClientesDeEjemplo() {
  const creados = [];
  const omitidos = [];

  for (const cliente of CLIENTES_EJEMPLO) {
    const existente = await buscarClientePorTelefono(cliente.phone);
    if (existente) {
      omitidos.push(cliente.name);
      continue;
    }
    await crearCliente(cliente);
    creados.push(cliente.name);
  }

  return { creados, omitidos };
}

export async function crearVehiculosDeEjemplo() {
  const creados = [];
  const omitidos = [];

  for (const vehiculo of VEHICULOS_EJEMPLO) {
    const placaExistente = await buscarPorPlaca(vehiculo.licensePlate);
    if (placaExistente) {
      omitidos.push(vehiculo.licensePlate);
      continue;
    }

    const dueno = await buscarClientePorTelefono(vehiculo.cliente);
    if (!dueno) {
      // Sin propietario no se guarda (RN-1): se omite en silencio.
      omitidos.push(vehiculo.licensePlate);
      continue;
    }

    await crearVehiculo({
      clientId: dueno.id,
      brand: vehiculo.brand,
      model: vehiculo.model,
      year: vehiculo.year,
      licensePlate: vehiculo.licensePlate,
      vin: vehiculo.vin,
      currentMileage: vehiculo.currentMileage,
    });
    creados.push(vehiculo.licensePlate);
  }

  return { creados, omitidos };
}

/** T075: 4 citas en estados distintos; si ya hay citas, no se crea nada. */
export async function crearCitasDeEjemplo() {
  const existentes = await contar("appointments");
  if (existentes > 0) return { creadas: 0, omitidas: existentes };

  let creadas = 0;
  for (const ejemplo of CITAS_EJEMPLO) {
    const cliente = await buscarClientePorTelefono(ejemplo.cliente);
    const vehiculo = await buscarPorPlaca(ejemplo.placas);
    if (!cliente || !vehiculo) continue;

    const cita = await citas.insertar({
      clientId: cliente.id,
      vehicleId: vehiculo.id,
      date: ejemplo.date,
      time: ejemplo.time,
      reason: ejemplo.reason,
      notes: "Cita de ejemplo del seed (Sprint 2).",
    });
    if (ejemplo.status !== "PENDING") {
      await citas.actualizar(cita.id, { status: ejemplo.status });
    }
    creadas += 1;
  }
  return { creadas, omitidas: 0 };
}

/**
 * T075/T064: 4 órdenes con servicios y mano de obra. La idempotencia es POR
 * ORDEN (patrón de clientes/refacciones, Principio III): cada ejemplo se
 * omite si su `reported_problem` ya existe, de modo que una base sembrada en
 * sprints previos completa la nueva orden terminada sin duplicar ninguna.
 */
export async function crearOrdenesDeEjemplo() {
  const [mecanicos] = await pool.query(
    "SELECT id FROM users WHERE role = 'MECHANIC' AND active = 1 ORDER BY id LIMIT 1",
  );
  if (mecanicos.length === 0) {
    // Sin mecánico activo no se asignan órdenes (RN-3, Q2).
    return { creadas: 0, omitidas: 0 };
  }

  let creadas = 0;
  let omitidas = 0;
  for (const ejemplo of ORDENES_EJEMPLO) {
    const [duplicadas] = await pool.query(
      "SELECT id FROM service_orders WHERE reported_problem = ? LIMIT 1",
      [ejemplo.reportedProblem],
    );
    if (duplicadas.length > 0) {
      omitidas += 1;
      continue;
    }

    const existente = await buscarPorPlaca(ejemplo.placas);
    if (!existente) continue;
    const vehiculo = await buscarVehiculo(existente.id);
    if (!vehiculo) continue;

    const orden = await ordenes.insertar({
      clientId: vehiculo.clientId,
      vehicleId: vehiculo.id,
      mechanicId: mecanicos[0].id,
      entryMileage: ejemplo.entryMileage,
      reportedProblem: ejemplo.reportedProblem,
    });
    await ordenes.actualizar(orden.id, {
      status: ejemplo.status,
      diagnosis: ejemplo.diagnosis,
      observations: ejemplo.observations,
      recommendations: ejemplo.recommendations,
    });
    // VS-04: el kilometraje del vehículo pasa al de la orden.
    await actualizarVehiculo(vehiculo.id, {
      currentMileage: ejemplo.entryMileage,
    });

    for (const servicio of ejemplo.servicios) {
      await servicios.insertar({ orderId: orden.id, ...servicio });
    }
    for (const trabajo of ejemplo.manoDeObra) {
      await manoDeObra.insertar({ orderId: orden.id, ...trabajo });
    }
    creadas += 1;
  }
  return { creadas, omitidas };
}

/**
 * T077: refacciones con stock y movimientos IN iniciales (Sprint 3, FR-019).
 * `createPart` escribe la refacción y su entrada IN en la misma transacción;
 * la idempotencia es por código (como clientes y vehículos), de modo que un
 * catálogo existente se completa sin duplicar nada.
 */
export async function crearPartesDeEjemplo(creadoPor) {
  let creadas = 0;
  let omitidas = 0;

  for (const ejemplo of REFACCIONES_EJEMPLO) {
    const existente = await buscarPartePorCodigo(ejemplo.partCode);
    if (existente) {
      omitidas += 1;
      continue;
    }
    await inventario.createPart(ejemplo, creadoPor);
    creadas += 1;
  }
  return { creadas, omitidas };
}

/**
 * T077: un mantenimiento por vehículo de ejemplo, uno por estado (CA-3):
 * ABC1234 Vencido, DEF5678 Próximo y GHI9012 Normal — idempotencia por
 * vehículo (la tabla tiene fila única, R-03).
 */
export async function crearMantenimientosDeEjemplo(registradoPor) {
  const objetivos = [
    {
      placas: "ABC1234",
      nextDueDate: "2026-09-15",
      nextDueMileage: 84000,
      recommendations: "Cambio de aceite y filtro; revisar niveles de líquidos.",
    },
    {
      placas: "DEF5678",
      nextDueDate: "2026-10-25",
      nextDueMileage: 121300,
      recommendations: "Alinear y balancear; revisar pastillas de freno.",
    },
    {
      placas: "GHI9012",
      nextDueDate: "2026-12-20",
      nextDueMileage: 101000,
      recommendations: "Cambio de correa de distribución a los 105,000 km.",
    },
  ];

  let creados = 0;
  let omitidos = 0;
  for (const objetivo of objetivos) {
    const vehiculo = await buscarPorPlaca(objetivo.placas);
    if (!vehiculo) continue;

    const [existentes] = await pool.query(
      "SELECT id FROM maintenance WHERE vehicle_id = ? LIMIT 1",
      [vehiculo.id],
    );
    if (existentes.length > 0) {
      omitidos += 1;
      continue;
    }

    await mantenimientos.upsert({
      vehicleId: vehiculo.id,
      nextDueDate: objetivo.nextDueDate,
      nextDueMileage: objetivo.nextDueMileage,
      warnDays: 30,
      warnKm: 500,
      recommendations: objetivo.recommendations,
      registeredBy: registradoPor,
    });
    creados += 1;
  }
  return { creados, omitidos };
}

/**
 * T077: la orden FINISHED de ejemplo ya usó una refacción (CA-5, US7, V6):
 * una fila en `order_parts` con su salida OUT y el stock descontado.
 */
export async function crearUsoDeOrdenDeEjemplo() {
  const existentes = await contar("order_parts");
  if (existentes > 0) return { creados: 0, omitidos: existentes };

  const [ordenes] = await pool.query(
    `SELECT id, mechanic_id AS mechanicId
       FROM service_orders
      WHERE status = 'FINISHED' AND mechanic_id IS NOT NULL
      ORDER BY id
      LIMIT 1`,
  );
  const [partes] = await pool.query("SELECT id FROM parts ORDER BY id LIMIT 1");
  if (ordenes.length === 0 || partes.length === 0) {
    return { creados: 0, omitidos: 0 };
  }

  // El servicio exige al mecánico dueño de la orden (Q5): se usa el asignado.
  await inventario.agregarRefaccionOrden(
    ordenes[0].id,
    { partId: partes[0].id, quantity: 2 },
    { id: ordenes[0].mechanicId, role: "MECHANIC" },
  );
  return { creados: 1, omitidos: 0 };
}

/**
 * T064: cobro en efectivo y ticket de la PRIMERA orden terminada (Sprint 4,
 * FR-018, CA-1/CA-4, R-11). Idempotencia POR ORDEN: si la orden ya tiene
 * pago o ticket se omite, así que re-ejecutar el seed no duplica nada.
 *
 * La SEGUNDA orden terminada queda deliberadamente SIN pago para demostrar
 * el cobro desde cero (quickstart V1/V2): por eso el seed ahora siembra dos
 * órdenes terminadas. El importe sale de la fórmula R-03 (sin columna): el
 * pago siempre cuadra con el total de la orden.
 */
export async function crearPagoYTicketDeEjemplo(usuario) {
  // Solo las órdenes terminadas DEL EJEMPLO: así el cobro cae siempre en la
  // primera (GHI9012, que ya usa refacción) y la segunda (ABC1234) queda
  // limpia para el demo, aunque la base tenga otras órdenes de prueba.
  const problemasTerminados = ORDENES_EJEMPLO.filter(
    (ejemplo) => ejemplo.status === "FINISHED" || ejemplo.status === "DELIVERED",
  ).map((ejemplo) => ejemplo.reportedProblem);
  if (problemasTerminados.length === 0) return { pago: false, ticket: false };

  const [terminadas] = await pool.query(
    `SELECT id FROM service_orders
      WHERE status IN ('FINISHED', 'DELIVERED')
        AND reported_problem IN (${problemasTerminados.map(() => "?").join(", ")})
      ORDER BY id ASC`,
    problemasTerminados,
  );
  if (terminadas.length === 0) return { pago: false, ticket: false };

  const ordenAAbonar = terminadas[0];

  const [pagosPrevios] = await pool.query(
    "SELECT COUNT(*) AS total FROM payments WHERE order_id = ?",
    [ordenAAbonar.id],
  );
  let pago = false;
  if (Number(pagosPrevios[0].total) === 0) {
    const { total } = await calcularTotalOrden(ordenAAbonar.id);
    await registrarPago(ordenAAbonar.id, { method: "CASH", amount: total }, usuario);
    pago = true;
  }

  const [ticketsPrevios] = await pool.query(
    "SELECT COUNT(*) AS total FROM tickets WHERE order_id = ?",
    [ordenAAbonar.id],
  );
  let ticket = false;
  if (Number(ticketsPrevios[0].total) === 0) {
    await generarTicket(ordenAAbonar.id, usuario);
    ticket = true;
  }

  return { pago, ticket };
}

export async function ejecutarSeed() {
  const cuentas = await crearCuentasIniciales();
  const clientes = await crearClientesDeEjemplo();
  const vehiculos = await crearVehiculosDeEjemplo();
  const citasDeEjemplo = await crearCitasDeEjemplo();
  const ordenesDeEjemplo = await crearOrdenesDeEjemplo();

  const admin = await primerAdmin();
  const partesDeEjemplo = admin
    ? await crearPartesDeEjemplo(admin)
    : { creadas: 0, omitidas: 0 };
  const mantenimientosDeEjemplo = admin
    ? await crearMantenimientosDeEjemplo(admin)
    : { creados: 0, omitidos: 0 };
  const usoDeOrden = await crearUsoDeOrdenDeEjemplo();
  // Después del uso de refacciones: el ticket de ejemplo ya la incluye (CA-4).
  const pagoYTicket = admin
    ? await crearPagoYTicketDeEjemplo({ id: admin, role: "ADMIN" })
    : { pago: false, ticket: false };

  return {
    usuarios: {
      creadas: cuentas.creadas,
      omitidas: cuentas.omitidas,
    },
    clientes: {
      creados: clientes.creados,
      omitidos: clientes.omitidos,
    },
    vehiculos: {
      creados: vehiculos.creados,
      omitidos: vehiculos.omitidos,
    },
    citas: citasDeEjemplo,
    ordenes: ordenesDeEjemplo,
    refacciones: partesDeEjemplo,
    mantenimientos: mantenimientosDeEjemplo,
    usosDeOrden: usoDeOrden,
    pagoYTicket,
  };
}

const esEjecucionDirecta =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (esEjecucionDirecta) {
  const resumen = await ejecutarSeed();
  console.log("Seed completado:");
  console.log(
    `  - Usuarios: ${resumen.usuarios.creadas.length} creados, ` +
      `${resumen.usuarios.omitidas.length} ya existentes`,
  );
  console.log(
    `  - Clientes: ${resumen.clientes.creados.length} creados, ` +
      `${resumen.clientes.omitidos.length} ya existentes`,
  );
  console.log(
    `  - Vehículos: ${resumen.vehiculos.creados.length} creados, ` +
      `${resumen.vehiculos.omitidos.length} ya existentes`,
  );
  console.log(
    `  - Citas: ${resumen.citas.creadas} creadas, ` +
      `${resumen.citas.omitidas} ya existentes`,
  );
  console.log(
    `  - Órdenes: ${resumen.ordenes.creadas} creadas, ` +
      `${resumen.ordenes.omitidas} ya existentes`,
  );
  console.log(
    `  - Refacciones: ${resumen.refacciones.creadas} creadas, ` +
      `${resumen.refacciones.omitidas} ya existentes`,
  );
  console.log(
    `  - Mantenimientos: ${resumen.mantenimientos.creados} creados, ` +
      `${resumen.mantenimientos.omitidos} ya existentes`,
  );
  console.log(
    `  - Usos de orden: ${resumen.usosDeOrden.creados} creados, ` +
      `${resumen.usosDeOrden.omitidos} ya existentes`,
  );
  console.log(
    `  - Cobro y ticket: ${resumen.pagoYTicket.pago ? "pago PAID registrado" : "pago ya existente u orden sin terminar"}, ` +
      `${resumen.pagoYTicket.ticket ? "ticket generado" : "ticket ya existente u orden sin terminar"}`,
  );
  await pool.end();
}
