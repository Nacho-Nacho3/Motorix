import request from "supertest";
import { app } from "../../app.js";
import { pool } from "../../config/db.js";
import * as clientes from "../../models/client.model.js";
import * as vehiculos from "../../models/vehicle.model.js";
import {
  crearPoolDePrueba,
  aplicarMigraciones,
  limpiarBaseDePrueba,
} from "../helpers/db.js";
import { tokenPara, conToken } from "../helpers/usuarios.js";

// T049: panel de control (US5, CA-6, FR-012, RN-10/RN-15).
// Un solo endpoint exclusivo de ADMIN que calcula los 8 indicadores en cada
// consulta a partir de los módulos existentes (sin caché ni tablas derivadas).

let poolPrueba;
let headersAdmin;
let headersRecepcion;
let headersMecanico;
let idMecanico;

beforeAll(async () => {
  poolPrueba = await crearPoolDePrueba();
  await aplicarMigraciones(poolPrueba);
  await limpiarBaseDePrueba(poolPrueba);
});

afterAll(async () => {
  await poolPrueba.end();
  await pool.end();
});

beforeEach(async () => {
  await limpiarBaseDePrueba(poolPrueba);

  const admin = await tokenPara({ username: "admin", role: "ADMIN", name: "Administración" });
  headersAdmin = conToken(admin.token);

  const recepcion = await tokenPara({
    username: "recepcion",
    role: "RECEPTIONIST",
    name: "Recepción",
  });
  headersRecepcion = conToken(recepcion.token);

  const mecanico = await tokenPara({
    username: "mecanico-uno",
    role: "MECHANIC",
    name: "Mecánico Uno",
  });
  headersMecanico = conToken(mecanico.token);
  idMecanico = mecanico.usuario.id;
});

let contador = 0;

/** Fecha local YYYY-MM-DD desplazada `dias` desde hoy (para citas/MTTO). */
function fecha(dias) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  const anio = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

async function crearClienteYVehiculo() {
  contador += 1;
  const cliente = await clientes.crear({
    name: `Cliente d${contador}`,
    phone: `55${String(40000000 + contador).slice(-8)}`,
    email: `cliente-d${contador}@correo.mx`,
  });
  const vehiculo = await vehiculos.crear({
    clientId: cliente.id,
    brand: "Toyota",
    model: "Corolla",
    year: 2021,
    licensePlate: `D${String(contador).padStart(7, "0")}`,
    vin: null,
    currentMileage: 40000,
  });
  return { cliente, vehiculo };
}

/** Vehículo adicional del mismo cliente (para tener varios mantenimientos). */
async function crearSoloVehiculo(cliente) {
  contador += 1;
  return vehiculos.crear({
    clientId: cliente.id,
    brand: "Toyota",
    model: "Corolla",
    year: 2021,
    licensePlate: `V${String(contador).padStart(7, "0")}`,
    vin: null,
    currentMileage: 40000,
  });
}

async function crearOrden({ cliente, vehiculo }) {
  const creada = await request(app)
    .post("/api/service-orders")
    .set(headersAdmin)
    .send({
      clientId: cliente.id,
      vehicleId: vehiculo.id,
      mechanicId: idMecanico,
      entryMileage: 40000,
      reportedProblem: "Ruido al acelerar",
    });
  expect(creada.status).toBe(201);
  return creada.body.data.order;
}

async function cambiarEstado(orden, status) {
  const respuesta = await request(app)
    .patch(`/api/service-orders/${orden.id}/status`)
    .set(headersAdmin)
    .send({ status });
  expect(respuesta.status).toBe(200);
}

/** Cita insertada directamente para fijar fecha y estado (hoy relativo). */
async function crearCita({ cliente, vehiculo }, dias, status) {
  await poolPrueba.query(
    `INSERT INTO appointments
       (client_id, vehicle_id, appointment_date, appointment_time, reason, status)
     VALUES (?, ?, ?, '10:00:00', 'Revisión de frenos', ?)`,
    [cliente.id, vehiculo.id, fecha(dias), status],
  );
}

async function crearMantenimiento({ vehiculo }, dias) {
  const respuesta = await request(app)
    .post("/api/maintenances")
    .set(headersAdmin)
    .send({ vehicleId: vehiculo.id, nextDueDate: fecha(dias) });
  expect([200, 201]).toContain(respuesta.status);
}

async function crearRefaccion(partCode, stockCurrent, stockMin) {
  const respuesta = await request(app)
    .post("/api/parts")
    .set(headersAdmin)
    .send({
      partCode,
      name: `Refacción ${partCode}`,
      category: "Frenos",
      stockCurrent,
      stockMin,
      salePrice: "250.00",
    });
  expect(respuesta.status).toBe(201);
}

describe("GET /api/dashboard (US5, CA-6, FR-012)", () => {
  test("los 8 contadores coinciden con los datos reales del taller", async () => {
    // Vehículo atendido con orden FINISHED.
    const v1 = await crearClienteYVehiculo();
    const o1 = await crearOrden(v1);
    for (const status of ["DIAGNOSIS", "IN_REPAIR", "FINISHED"]) {
      await cambiarEstado(o1, status);
    }

    // Vehículo atendido con orden DELIVERED.
    const v2 = await crearClienteYVehiculo();
    const o2 = await crearOrden(v2);
    for (const status of ["DIAGNOSIS", "IN_REPAIR", "FINISHED", "DELIVERED"]) {
      await cambiarEstado(o2, status);
    }

    // Vehículo en reparación con DOS órdenes activas (1 vehículo, 2 órdenes).
    const v3 = await crearClienteYVehiculo();
    await crearOrden(v3);
    await crearOrden(v3);

    // Citas: 2 futuras vigentes; la pasada y la cancelada no cuentan.
    await crearCita(v1, 1, "PENDING");
    await crearCita(v2, 2, "CONFIRMED");
    await crearCita(v3, -1, "PENDING");
    await crearCita(v3, 3, "CANCELED");

    // Mantenimientos: 1 por vencer, 1 vencido y 1 normal (no cuenta).
    await crearMantenimiento(v1, 10);
    await crearMantenimiento(v2, -10);
    await crearMantenimiento(v3, 60);

    // Refacciones: 1 con stock bajo y 1 normal (no cuenta).
    await crearRefaccion("LOW-001", 2, 5);
    await crearRefaccion("OK-001", 10, 3);

    const respuesta = await request(app)
      .get("/api/dashboard")
      .set(headersAdmin);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.summary).toEqual({
      vehiclesAttended: 2,
      vehiclesInRepair: 1,
      ordersPending: 2,
      ordersFinished: 2,
      nextAppointments: 2,
      upcomingMaintenances: 1,
      overdueMaintenances: 1,
      lowStockCount: 1,
    });
  });

  test("RECEPTIONIST y MECHANIC reciben 403 FORBIDDEN (RN-15, FR-012)", async () => {
    const recepcion = await request(app)
      .get("/api/dashboard")
      .set(headersRecepcion);
    expect(recepcion.status).toBe(403);
    expect(recepcion.body.error.code).toBe("FORBIDDEN");

    const mecanico = await request(app)
      .get("/api/dashboard")
      .set(headersMecanico);
    expect(mecanico.status).toBe(403);
    expect(mecanico.body.error.code).toBe("FORBIDDEN");
  });

  test("taller vacío: los 8 contadores en cero y los arreglos vacíos (escenario 3)", async () => {
    const respuesta = await request(app)
      .get("/api/dashboard")
      .set(headersAdmin);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.summary).toEqual({
      vehiclesAttended: 0,
      vehiclesInRepair: 0,
      ordersPending: 0,
      ordersFinished: 0,
      nextAppointments: 0,
      upcomingMaintenances: 0,
      overdueMaintenances: 0,
      lowStockCount: 0,
    });
    expect(respuesta.body.data.recentOrders).toEqual([]);
    expect(respuesta.body.data.nextAppointments).toEqual([]);
    expect(respuesta.body.data.maintenances).toEqual({ upcoming: [], overdue: [] });
    expect(respuesta.body.data.lowStockParts).toEqual([]);
  });

  test("sin sesión responde 401 UNAUTHORIZED", async () => {
    const respuesta = await request(app).get("/api/dashboard");
    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error.code).toBe("UNAUTHORIZED");
  });
});

// T059: detalle del panel (US6, CA-6, SC-007, RN-10). Las listas se calculan
// en la MISMA consulta que el resumen y con los límites de contracts/dashboard.md.
describe("Detalle del panel (US6, T059)", () => {
  test("lista las 4 secciones con los límites 5/5/5/todas/todas", async () => {
    const { cliente, vehiculo } = await crearClienteYVehiculo();

    // 6 órdenes → recentOrders se queda con las 5 más recientes.
    const ordenes = [];
    for (let i = 0; i < 6; i += 1) {
      ordenes.push(await crearOrden({ cliente, vehiculo }));
    }
    // La más reciente lleva un servicio: su total debe ser 500.00 (R-03
    // calculado, sin columna almacenada).
    const ultima = ordenes[ordenes.length - 1];
    const servicio = await request(app)
      .post(`/api/service-orders/${ultima.id}/services`)
      .set(headersMecanico)
      .send({ description: "Afinación mayor", unitPrice: 500 });
    expect(servicio.status).toBe(201);

    // 6 citas futuras → nextAppointments se queda con las 5 más próximas
    // (incluye la CONFIRMED del día más cercano).
    await crearCita({ cliente, vehiculo }, 1, "CONFIRMED");
    for (let dias = 2; dias <= 6; dias += 1) {
      await crearCita({ cliente, vehiculo }, dias, "PENDING");
    }

    // 6 mantenimientos por vencer → upcoming limita a 5 (los más próximos);
    // 2 vencidos → overdue los devuelve todos; el NORMAL no aparece.
    for (let dias = 10; dias <= 15; dias += 1) {
      const vehiculoMtto = await crearSoloVehiculo(cliente);
      await crearMantenimiento({ vehiculo: vehiculoMtto }, dias);
    }
    for (const dias of [-10, -5]) {
      const vehiculoMtto = await crearSoloVehiculo(cliente);
      await crearMantenimiento({ vehiculo: vehiculoMtto }, dias);
    }
    await crearMantenimiento({ vehiculo: await crearSoloVehiculo(cliente) }, 60);

    // 3 refacciones con stock bajo y 1 normal → lowStockParts devuelve todas.
    await crearRefaccion("LOW-001", 2, 5);
    await crearRefaccion("LOW-002", 3, 5);
    await crearRefaccion("LOW-003", 4, 10);
    await crearRefaccion("OK-101", 50, 5);

    const respuesta = await request(app)
      .get("/api/dashboard")
      .set(headersAdmin);

    expect(respuesta.status).toBe(200);
    const { data } = respuesta.body;

    // recentOrders: exactamente las 5 órdenes más nuevas por updatedAt.
    const idsEsperados = ordenes
      .slice(1)
      .map((orden) => orden.id)
      .reverse();
    expect(data.recentOrders.map((orden) => orden.id)).toEqual(idsEsperados);
    const [masReciente] = data.recentOrders;
    expect(Object.keys(masReciente).sort()).toEqual(
      ["id", "clientName", "vehicleLabel", "status", "total", "updatedAt"].sort(),
    );
    expect(masReciente.clientName).toBe(cliente.name);
    expect(masReciente.vehicleLabel).toContain(vehiculo.licensePlate);
    expect(masReciente.status).toBe("RECEIVED");
    expect(masReciente.total).toBe("500.00");
    expect(masReciente.updatedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/,
    );

    // nextAppointments: las 5 citas más próximas primero, con la CONFIRMED.
    expect(data.nextAppointments).toHaveLength(5);
    expect(data.nextAppointments.map((cita) => cita.appointmentDate)).toEqual([
      fecha(1),
      fecha(2),
      fecha(3),
      fecha(4),
      fecha(5),
    ]);
    const [citaCercana] = data.nextAppointments;
    expect(Object.keys(citaCercana).sort()).toEqual(
      [
        "id",
        "clientName",
        "vehicleLabel",
        "appointmentDate",
        "appointmentTime",
        "reason",
        "status",
      ].sort(),
    );
    expect(citaCercana.status).toBe("CONFIRMED");
    expect(citaCercana.appointmentTime).toBe("10:00:00");
    expect(citaCercana.reason).toBe("Revisión de frenos");
    expect(citaCercana.clientName).toBe(cliente.name);
    expect(citaCercana.vehicleLabel).toContain(vehiculo.licensePlate);

    // Mantenimientos: 5 próximos por urgencia y fecha; todos los vencidos.
    expect(data.maintenances.upcoming).toHaveLength(5);
    expect(
      data.maintenances.upcoming.map((mtto) => mtto.daysRemaining),
    ).toEqual([10, 11, 12, 13, 14]);
    expect(Object.keys(data.maintenances.upcoming[0]).sort()).toEqual(
      [
        "id",
        "vehicleLabel",
        "clientName",
        "nextDueDate",
        "nextDueMileage",
        "daysRemaining",
        "mileageRemaining",
      ].sort(),
    );
    expect(data.maintenances.upcoming[0].nextDueMileage).toBeNull();
    expect(data.maintenances.upcoming[0].mileageRemaining).toBeNull();

    expect(data.maintenances.overdue).toHaveLength(2);
    expect(data.maintenances.overdue.map((mtto) => mtto.nextDueDate)).toEqual([
      fecha(-10),
      fecha(-5),
    ]);
    expect(data.maintenances.overdue[0].daysRemaining).toBe(-10);
    expect(data.maintenances.overdue[0].mileageRemaining).toBeNull();

    // lowStockParts: TODAS las refacciones en alerta (sin límite).
    expect(data.lowStockParts).toHaveLength(3);
    expect(
      data.lowStockParts.map((parte) => parte.partCode).sort(),
    ).toEqual(["LOW-001", "LOW-002", "LOW-003"]);
    expect(Object.keys(data.lowStockParts[0]).sort()).toEqual(
      ["id", "partCode", "name", "stockCurrent", "stockMin"].sort(),
    );

    // El resumen de la misma respuesta sigue cuadrando con el detalle.
    expect(data.summary.ordersFinished).toBe(0);
    expect(data.summary.upcomingMaintenances).toBe(6);
    expect(data.summary.overdueMaintenances).toBe(2);
    expect(data.summary.lowStockCount).toBe(3);
    expect(data.summary.nextAppointments).toBe(6);
  });

  test("entregar una orden cambia contadores y detalle en la misma respuesta (SC-007)", async () => {
    const { cliente, vehiculo } = await crearClienteYVehiculo();
    const orden = await crearOrden({ cliente, vehiculo });
    for (const status of ["DIAGNOSIS", "IN_REPAIR"]) {
      await cambiarEstado(orden, status);
    }

    let respuesta = await request(app).get("/api/dashboard").set(headersAdmin);
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.summary.ordersFinished).toBe(0);
    expect(respuesta.body.data.summary.vehiclesAttended).toBe(0);
    expect(respuesta.body.data.recentOrders[0].status).toBe("IN_REPAIR");

    await cambiarEstado(orden, "FINISHED");
    respuesta = await request(app).get("/api/dashboard").set(headersAdmin);
    expect(respuesta.body.data.summary.ordersFinished).toBe(1);
    expect(respuesta.body.data.summary.vehiclesAttended).toBe(1);
    expect(respuesta.body.data.recentOrders[0].status).toBe("FINISHED");

    await cambiarEstado(orden, "DELIVERED");
    respuesta = await request(app).get("/api/dashboard").set(headersAdmin);
    expect(respuesta.body.data.summary.ordersFinished).toBe(1);
    expect(respuesta.body.data.summary.vehiclesAttended).toBe(1);
    expect(respuesta.body.data.recentOrders[0].status).toBe("DELIVERED");
  });
});
