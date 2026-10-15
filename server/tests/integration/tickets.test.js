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

// T030: ticket de servicio (US3, CA-4/CA-5, FR-011, R-05, RN-10/RN-15).
// Un ticket por orden (order_id ÚNICO): el POST es idempotente y el
// contenido se calcula al servirlo (nada se almacena del desglose).

let poolPrueba;
let headersAdmin;
let headersRecepcion;
let headersMecanico;
let idRecepcion;
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
  idRecepcion = recepcion.usuario.id;

  const mecanico = await tokenPara({
    username: "mecanico-uno",
    role: "MECHANIC",
    name: "Mecánico Uno",
  });
  headersMecanico = conToken(mecanico.token);
  idMecanico = mecanico.usuario.id;
});

let contadorOrdenes = 0;

async function crearOrden() {
  contadorOrdenes += 1;
  const cliente = await clientes.crear({
    name: `Cliente tk${contadorOrdenes}`,
    phone: `55${String(60000000 + contadorOrdenes).slice(-8)}`,
    email: `cliente-tk${contadorOrdenes}@correo.mx`,
  });
  const vehiculo = await vehiculos.crear({
    clientId: cliente.id,
    brand: "Nissan",
    model: "Versa",
    year: 2020,
    licensePlate: `T${String(contadorOrdenes).padStart(7, "0")}`,
    vin: null,
    currentMileage: 44000,
  });
  const respuesta = await request(app)
    .post("/api/service-orders")
    .set(headersRecepcion)
    .send({
      clientId: cliente.id,
      vehicleId: vehiculo.id,
      mechanicId: idMecanico,
      entryMileage: 45000,
      reportedProblem: "Ruido al frenar",
    });
  expect(respuesta.status).toBe(201);
  return { ...respuesta.body.data.order, cliente, vehiculo };
}

/** Orden FINISHED con servicios (850), mano de obra (600) y refacción (1700). */
async function ordenTerminada() {
  const orden = await crearOrden();

  const servicio = await request(app)
    .post(`/api/service-orders/${orden.id}/services`)
    .set(headersMecanico)
    .send({ description: "Afinación mayor", unitPrice: 850 });
  expect(servicio.status).toBe(201);

  const manoDeObra = await request(app)
    .post(`/api/service-orders/${orden.id}/labor`)
    .set(headersMecanico)
    .send({ concept: "Instalación de refacción", hours: 2, hourlyRate: 300 });
  expect(manoDeObra.status).toBe(201);

  const parte = await request(app)
    .post("/api/parts")
    .set(headersAdmin)
    .send({
      partCode: `TK${String(contadorOrdenes).padStart(5, "0")}`,
      name: "Balatas traseras",
      category: "Frenos",
      stockCurrent: 10,
      stockMin: 5,
      salePrice: "850.00",
    });
  expect(parte.status).toBe(201);

  const uso = await request(app)
    .post(`/api/service-orders/${orden.id}/parts`)
    .set(headersMecanico)
    .send({ partId: parte.body.data.part.id, quantity: 2 });
  expect(uso.status).toBe(201);

  for (const status of ["DIAGNOSIS", "IN_REPAIR", "FINISHED"]) {
    const cambio = await request(app)
      .patch(`/api/service-orders/${orden.id}/status`)
      .set(headersMecanico)
      .send({ status });
    expect(cambio.status).toBe(200);
  }

  return orden;
}

async function generarTicket(orden, headers = headersRecepcion) {
  return request(app)
    .post(`/api/service-orders/${orden.id}/ticket`)
    .set(headers);
}

async function consultarTicket(orden, headers = headersRecepcion) {
  return request(app)
    .get(`/api/service-orders/${orden.id}/ticket`)
    .set(headers);
}

async function contarTickets() {
  const [filas] = await poolPrueba.query("SELECT COUNT(*) AS total FROM tickets");
  return Number(filas[0].total);
}

describe("POST /api/service-orders/{id}/ticket (US3, FR-011)", () => {
  test("crea el ticket de una orden terminada con folio derivado del id", async () => {
    const orden = await ordenTerminada();

    const respuesta = await generarTicket(orden);

    expect(respuesta.status).toBe(201);
    const ticket = respuesta.body.data.ticket;
    expect(ticket).toBeDefined();
    expect(ticket.orderId).toBe(orden.id);
    // Folio = "TCK-" + id con 6 dígitos (R-05: sin contador propio).
    expect(ticket.folio).toMatch(/^TCK-\d{6}$/);
    expect(ticket.folio).toBe(`TCK-${String(ticket.id).padStart(6, "0")}`);
    expect(ticket.issuedBy).toBe(idRecepcion);
    expect(await contarTickets()).toBe(1);
  });

  test("el segundo POST devuelve el mismo ticket: idempotente y sin duplicados", async () => {
    const orden = await ordenTerminada();

    const primero = await generarTicket(orden);
    expect(primero.status).toBe(201);

    const segundo = await generarTicket(orden);
    expect(segundo.status).toBe(200);
    expect(segundo.body.data.ticket.id).toBe(primero.body.data.ticket.id);
    expect(segundo.body.data.ticket.folio).toBe(primero.body.data.ticket.folio);
    expect(await contarTickets()).toBe(1);
  });

  test("una orden en curso responde 400 ORDER_NOT_FINISHED", async () => {
    const orden = await crearOrden();

    const intento = await generarTicket(orden);
    expect(intento.status).toBe(400);
    expect(intento.body.error.code).toBe("ORDER_NOT_FINISHED");
    expect(await contarTickets()).toBe(0);
  });

  test("una orden inexistente responde 404 SERVICE_ORDER_NOT_FOUND", async () => {
    const respuesta = await request(app)
      .post("/api/service-orders/99999999/ticket")
      .set(headersRecepcion);

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.code).toBe("SERVICE_ORDER_NOT_FOUND");
  });

  test("el rol MECHANIC recibe 403 FORBIDDEN (RN-15)", async () => {
    const orden = await ordenTerminada();

    const respuesta = await generarTicket(orden, headersMecanico);

    expect(respuesta.status).toBe(403);
    expect(respuesta.body.error.code).toBe("FORBIDDEN");
  });
});

describe("GET /api/service-orders/{id}/ticket (US3, CA-4)", () => {
  test("devuelve el contenido completo calculado del comprobante", async () => {
    const orden = await ordenTerminada();
    const creada = await generarTicket(orden);
    expect(creada.status).toBe(201);

    const consulta = await consultarTicket(orden);

    expect(consulta.status).toBe(200);
    const ticket = consulta.body.data.ticket;

    expect(ticket.folio).toBe(creada.body.data.ticket.folio);
    // Taller (R-05: datos fijos hasta que exista un módulo de ajustes).
    expect(ticket.workshop).toEqual({ name: "Motorix", address: null, phone: null });
    // Cliente y vehículo.
    expect(ticket.client).toEqual({
      id: orden.cliente.id,
      name: orden.cliente.name,
      phone: orden.cliente.phone,
    });
    expect(ticket.vehicle).toEqual({
      id: orden.vehiculo.id,
      label: "Nissan Versa 2020",
      licensePlate: orden.vehiculo.licensePlate,
      entryMileage: 45000,
    });
    // Servicios y mano de obra con horas × tarifa.
    expect(ticket.services).toHaveLength(1);
    expect(ticket.services[0].description).toBe("Afinación mayor");
    expect(ticket.services[0].unitPrice).toBe("850.00");
    expect(ticket.labor).toHaveLength(1);
    expect(ticket.labor[0]).toEqual(
      expect.objectContaining({
        concept: "Instalación de refacción",
        hours: "2.00",
        hourlyRate: "300.00",
        subtotal: "600.00",
      }),
    );
    // Refacciones con cantidad y precio vigente (R-03).
    expect(ticket.parts).toHaveLength(1);
    expect(ticket.parts[0]).toEqual(
      expect.objectContaining({
        name: "Balatas traseras",
        quantity: 2,
        unitPrice: "850.00",
        subtotal: "1700.00",
      }),
    );
    // Subtotales y total con la fórmula única (CA-4).
    expect(ticket.totals).toEqual({
      servicesSubtotal: "850.00",
      laborSubtotal: "600.00",
      partsSubtotal: "1700.00",
      total: "3150.00",
    });
    expect(ticket.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
  });

  test("sin pago el campo payment es null (US3 escenario 4)", async () => {
    const orden = await ordenTerminada();
    await generarTicket(orden);

    const consulta = await consultarTicket(orden);

    expect(consulta.status).toBe(200);
    expect(consulta.body.data.ticket.payment).toBeNull();
  });

  test("con un pago efectivo devuelve method, status y amount", async () => {
    const orden = await ordenTerminada();
    const pago = await request(app)
      .post(`/api/service-orders/${orden.id}/payments`)
      .set(headersRecepcion)
      .send({ method: "CASH", amount: "3150.00" });
    expect(pago.status).toBe(201);
    await generarTicket(orden);

    const consulta = await consultarTicket(orden);

    expect(consulta.status).toBe(200);
    expect(consulta.body.data.ticket.payment).toEqual({
      method: "CASH",
      status: "PAID",
      amount: "3150.00",
    });
  });

  test("sin ticket generado responde 404 TICKET_NOT_FOUND", async () => {
    const orden = await ordenTerminada();

    const consulta = await consultarTicket(orden);

    expect(consulta.status).toBe(404);
    expect(consulta.body.error.code).toBe("TICKET_NOT_FOUND");
  });

  test("una orden inexistente responde 404 SERVICE_ORDER_NOT_FOUND", async () => {
    const consulta = await request(app)
      .get("/api/service-orders/99999999/ticket")
      .set(headersRecepcion);

    expect(consulta.status).toBe(404);
    expect(consulta.body.error.code).toBe("SERVICE_ORDER_NOT_FOUND");
  });

  test("el rol MECHANIC recibe 403 FORBIDDEN (RN-15)", async () => {
    const orden = await ordenTerminada();
    await generarTicket(orden);

    const consulta = await consultarTicket(orden, headersMecanico);

    expect(consulta.status).toBe(403);
    expect(consulta.body.error.code).toBe("FORBIDDEN");
  });
});
