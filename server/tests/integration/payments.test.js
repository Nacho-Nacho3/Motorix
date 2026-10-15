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

// T008: pagos de una orden (US1, CA-1, SC-001/SC-004, RN-13/15, R-07, Q1).
// El total se calcula (R-03, sin columna) y el cobro exige la orden
// terminada o entregada con importe exacto; un solo pago PAID por orden.

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
    name: `Cliente ${contadorOrdenes}`,
    phone: `55${String(70000000 + contadorOrdenes).slice(-8)}`,
    email: `cliente-pg${contadorOrdenes}@correo.mx`,
  });
  const vehiculo = await vehiculos.crear({
    clientId: cliente.id,
    brand: "Toyota",
    model: "Corolla",
    year: 2020,
    licensePlate: `P${String(contadorOrdenes).padStart(7, "0")}`,
    vin: null,
    currentMileage: 85000,
  });
  const respuesta = await request(app)
    .post("/api/service-orders")
    .set(headersRecepcion)
    .send({
      clientId: cliente.id,
      vehicleId: vehiculo.id,
      mechanicId: idMecanico,
      entryMileage: 86000,
      reportedProblem: "Ruido al frenar",
    });
  expect(respuesta.status).toBe(201);
  return respuesta.body.data.order;
}

/** Orden terminada con servicios, mano de obra y una refacción (total 3150.00). */
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
    .send({ concept: "Instalación de balatas", hours: 2, hourlyRate: 300 });
  expect(manoDeObra.status).toBe(201);

  const parte = await request(app)
    .post("/api/parts")
    .set(headersAdmin)
    .send({
      partCode: `BAL-${String(contadorOrdenes).padStart(4, "0")}`,
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

async function registrarPago(orden, cuerpo, headers = headersRecepcion) {
  return request(app)
    .post(`/api/service-orders/${orden.id}/payments`)
    .set(headers)
    .send(cuerpo);
}

describe("GET /api/service-orders/{id}/total (US1, R-03, CA-4)", () => {
  test("devuelve subtotales y total calculado de servicios, mano de obra y refacciones", async () => {
    const orden = await ordenTerminada();

    const respuesta = await request(app)
      .get(`/api/service-orders/${orden.id}/total`)
      .set(headersRecepcion);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.ok).toBe(true);
    expect(respuesta.body.data).toMatchObject({
      orderId: orden.id,
      servicesSubtotal: "850.00",
      laborSubtotal: "600.00",
      partsSubtotal: "1700.00",
      total: "3150.00",
    });
  });

  test("una orden sin trabajo devuelve 0.00 en todos los campos", async () => {
    const orden = await crearOrden();

    const respuesta = await request(app)
      .get(`/api/service-orders/${orden.id}/total`)
      .set(headersRecepcion);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toMatchObject({
      servicesSubtotal: "0.00",
      laborSubtotal: "0.00",
      partsSubtotal: "0.00",
      total: "0.00",
    });
  });

  test("responde 404 SERVICE_ORDER_NOT_FOUND con id inexistente", async () => {
    const respuesta = await request(app)
      .get("/api/service-orders/99999999/total")
      .set(headersRecepcion);

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.code).toBe("SERVICE_ORDER_NOT_FOUND");
  });

  test("el rol MECHANIC recibe 403 FORBIDDEN (RN-15, matriz R-08)", async () => {
    const orden = await ordenTerminada();

    const respuesta = await request(app)
      .get(`/api/service-orders/${orden.id}/total`)
      .set(headersMecanico);

    expect(respuesta.status).toBe(403);
    expect(respuesta.body.error.code).toBe("FORBIDDEN");
  });
});

describe("POST /api/service-orders/{id}/payments (US1, CA-1, Q1)", () => {
  test("un pago en efectivo con el importe exacto queda PAID con amount = total", async () => {
    const orden = await ordenTerminada();

    const respuesta = await registrarPago(orden, { method: "CASH", amount: "3150.00" });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.ok).toBe(true);
    expect(respuesta.body.data.payment).toMatchObject({
      orderId: orden.id,
      amount: "3150.00",
      method: "CASH",
      status: "PAID",
      externalReference: null,
      createdBy: idRecepcion,
      createdByName: "Recepción",
    });
    expect(respuesta.body.data.initPoint).toBeNull();
  });

  test("sin amount el backend usa el total calculado de la orden", async () => {
    const orden = await ordenTerminada();

    const respuesta = await registrarPago(orden, { method: "CASH" });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data.payment.amount).toBe("3150.00");
    expect(respuesta.body.data.payment.status).toBe("PAID");
  });

  test("el pago persiste tras reconsultar la lista (SC-004)", async () => {
    const orden = await ordenTerminada();
    const creada = await registrarPago(orden, { method: "CARD", amount: "3150.00" });
    expect(creada.status).toBe(201);

    const consulta = await request(app)
      .get(`/api/service-orders/${orden.id}/payments`)
      .set(headersRecepcion);

    expect(consulta.status).toBe(200);
    expect(consulta.body.data.payments).toHaveLength(1);
    expect(consulta.body.data.payments[0]).toMatchObject({
      id: creada.body.data.payment.id,
      method: "CARD",
      status: "PAID",
      amount: "3150.00",
    });
    expect(consulta.body.data.total).toBe("3150.00");
  });

  test("un segundo pago sobre la misma orden responde 400 ORDER_ALREADY_PAID", async () => {
    const orden = await ordenTerminada();
    expect((await registrarPago(orden, { method: "CASH" })).status).toBe(201);

    const segunda = await registrarPago(orden, { method: "CARD" });

    expect(segunda.status).toBe(400);
    expect(segunda.body.error.code).toBe("ORDER_ALREADY_PAID");

    // Solo existe el primer pago (SC-004: sin duplicados).
    const consulta = await request(app)
      .get(`/api/service-orders/${orden.id}/payments`)
      .set(headersRecepcion);
    expect(consulta.body.data.payments).toHaveLength(1);
  });

  test("un importe distinto del total responde 400 PAYMENT_AMOUNT_MISMATCH (Q1)", async () => {
    const orden = await ordenTerminada();

    const parcial = await registrarPago(orden, { method: "CASH", amount: "100.00" });

    expect(parcial.status).toBe(400);
    expect(parcial.body.error.code).toBe("PAYMENT_AMOUNT_MISMATCH");

    const consulta = await request(app)
      .get(`/api/service-orders/${orden.id}/payments`)
      .set(headersRecepcion);
    expect(consulta.body.data.payments).toHaveLength(0);
  });

  test("una orden en curso responde 400 ORDER_NOT_PAYABLE", async () => {
    const orden = await crearOrden();

    const respuesta = await registrarPago(orden, { method: "CASH" });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe("ORDER_NOT_PAYABLE");
  });

  test("una orden inexistente responde 404 SERVICE_ORDER_NOT_FOUND", async () => {
    const respuesta = await request(app)
      .post("/api/service-orders/99999999/payments")
      .set(headersRecepcion)
      .send({ method: "CASH" });

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.code).toBe("SERVICE_ORDER_NOT_FOUND");
  });

  test("un método no soportado responde 400 VALIDATION_ERROR", async () => {
    const orden = await ordenTerminada();

    const respuesta = await registrarPago(orden, { method: "BITCOIN" });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe("VALIDATION_ERROR");
    expect(respuesta.body.error.details[0].message).toMatch(/método/i);
  });

  test("el rol MECHANIC recibe 403 FORBIDDEN al listar y al registrar (RN-15)", async () => {
    const orden = await ordenTerminada();

    const listar = await request(app)
      .get(`/api/service-orders/${orden.id}/payments`)
      .set(headersMecanico);
    expect(listar.status).toBe(403);
    expect(listar.body.error.code).toBe("FORBIDDEN");

    const crear = await registrarPago(orden, { method: "CASH" }, headersMecanico);
    expect(crear.status).toBe(403);
    expect(crear.body.error.code).toBe("FORBIDDEN");
  });
});

describe("GET /api/service-orders/{id}/payments (US1)", () => {
  test("lista los pagos más recientes primero y suma solo los PAID", async () => {
    const orden = await ordenTerminada();

    // Historial previo rechazado (como lo dejaría un intento MP fallido, US4):
    // se inserta directamente para poder verificar el orden y la suma.
    await poolPrueba.query(
      `INSERT INTO payments (order_id, amount, method, status, created_by, created_at)
       VALUES (?, 3150.00, 'MERCADO_PAGO', 'REJECTED', ?, DATE_SUB(NOW(), INTERVAL 1 DAY))`,
      [orden.id, idRecepcion],
    );

    const creada = await registrarPago(orden, { method: "CASH", amount: "3150.00" });
    expect(creada.status).toBe(201);

    const consulta = await request(app)
      .get(`/api/service-orders/${orden.id}/payments`)
      .set(headersRecepcion);

    expect(consulta.status).toBe(200);
    const { payments, total } = consulta.body.data;
    expect(payments).toHaveLength(2);
    // Más reciente primero: el pago registrado vía API antes que el rechazado.
    expect(payments[0].status).toBe("PAID");
    expect(payments[1].status).toBe("REJECTED");
    // Solo los PAID suman (los rechazados/cancelados no bloquean ni suman, Q1).
    expect(total).toBe("3150.00");
  });

  test("sin pagos devuelve arreglo vacío y total 0.00", async () => {
    const orden = await ordenTerminada();

    const consulta = await request(app)
      .get(`/api/service-orders/${orden.id}/payments`)
      .set(headersRecepcion);

    expect(consulta.status).toBe(200);
    expect(consulta.body.data.payments).toEqual([]);
    expect(consulta.body.data.total).toBe("0.00");
  });
});

// T022: Mercado Pago sin credenciales y los 4 métodos del negocio (US2, CA-2,
// R-04, FR-002). Prueba escrita primero: debe fallar antes de T024 a T027.
describe("US2 - Mercado Pago y métodos del negocio (T022)", () => {
  let accessToken;
  let publicKey;

  beforeEach(() => {
    // Fuerza el entorno sin credenciales del proveedor (R-04): si el
    // desarrollador tiene un .env con MP se limpia solo para estas pruebas.
    accessToken = process.env.MP_ACCESS_TOKEN;
    publicKey = process.env.MP_PUBLIC_KEY;
    delete process.env.MP_ACCESS_TOKEN;
    delete process.env.MP_PUBLIC_KEY;
  });

  afterEach(() => {
    if (accessToken === undefined) delete process.env.MP_ACCESS_TOKEN;
    else process.env.MP_ACCESS_TOKEN = accessToken;
    if (publicKey === undefined) delete process.env.MP_PUBLIC_KEY;
    else process.env.MP_PUBLIC_KEY = publicKey;
  });

  test("MERCADO_PAGO sin credenciales responde 409 y no deja pago persistido", async () => {
    const orden = await ordenTerminada();

    const intento = await registrarPago(orden, {
      method: "MERCADO_PAGO",
      amount: "3150.00",
    });

    expect(intento.status).toBe(409);
    expect(intento.body.error.code).toBe("MERCADO_PAGO_NOT_CONFIGURED");
    expect(typeof intento.body.error.message).toBe("string");

    // Sin pago persistido: la transacción se revierte (R-04, T027).
    const consulta = await request(app)
      .get(`/api/service-orders/${orden.id}/payments`)
      .set(headersRecepcion);
    expect(consulta.body.data.payments).toEqual([]);

    // Los métodos manuales siguen funcionando aunque MP no esté configurado.
    const manual = await registrarPago(orden, { method: "CASH" });
    expect(manual.status).toBe(201);
    expect(manual.body.data.payment.status).toBe("PAID");
  });

  test("los 3 métodos manuales quedan registrados con su method visible (CA-2)", async () => {
    for (const method of ["CASH", "CARD", "TRANSFER"]) {
      const orden = await ordenTerminada();

      const creada = await registrarPago(orden, { method, amount: "3150.00" });
      expect(creada.status).toBe(201);
      expect(creada.body.data.payment.method).toBe(method);

      const consulta = await request(app)
        .get(`/api/service-orders/${orden.id}/payments`)
        .set(headersRecepcion);
      expect(consulta.body.data.payments[0].method).toBe(method);
      expect(consulta.body.data.total).toBe("3150.00");
    }
  });

  test("el cuerpo con status propio responde 400 VALIDATION_ERROR", async () => {
    const orden = await ordenTerminada();

    const respuesta = await registrarPago(orden, {
      method: "CASH",
      amount: "3150.00",
      status: "PAID",
    });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe("VALIDATION_ERROR");
  });
});
