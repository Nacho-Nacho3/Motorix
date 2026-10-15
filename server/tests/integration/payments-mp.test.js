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
import { usarClienteHttp } from "../../services/mercadopago.service.js";

// T041: flujo Mercado Pago en modo sandbox SIMULADO (US4, CA-3, CA-7, R-04,
// RN-14). El cliente HTTP se inyecta desde la prueba: cero red, cero SDK.
// El mapeo es approved → PAID, rejected → REJECTED, resto → PENDING.

let poolPrueba;
let headersRecepcion;
let headersMecanico;
let idMecanico;
let tokenOriginal;

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

  // Credenciales de sandbox simuladas para este archivo de pruebas.
  tokenOriginal = process.env.MP_ACCESS_TOKEN;
  process.env.MP_ACCESS_TOKEN = "TEST-token-simulado";
});

afterEach(() => {
  if (tokenOriginal === undefined) delete process.env.MP_ACCESS_TOKEN;
  else process.env.MP_ACCESS_TOKEN = tokenOriginal;
  // Devuelve el cliente real (fetch global) al terminar cada prueba.
  usarClienteHttp(null);
});

/** Respuesta simulada con la forma mínima que consume el servicio. */
function respuesta(datos, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => datos,
  };
}

let contadorOrdenes = 0;

async function crearOrden() {
  contadorOrdenes += 1;
  const cliente = await clientes.crear({
    name: `Cliente mp${contadorOrdenes}`,
    phone: `55${String(50000000 + contadorOrdenes).slice(-8)}`,
    email: `cliente-mp${contadorOrdenes}@correo.mx`,
  });
  const vehiculo = await vehiculos.crear({
    clientId: cliente.id,
    brand: "Toyota",
    model: "Corolla",
    year: 2021,
    licensePlate: `M${String(contadorOrdenes).padStart(7, "0")}`,
    vin: null,
    currentMileage: 30000,
  });
  const creada = await request(app)
    .post("/api/service-orders")
    .set(headersRecepcion)
    .send({
      clientId: cliente.id,
      vehicleId: vehiculo.id,
      mechanicId: idMecanico,
      entryMileage: 31000,
      reportedProblem: "No enciende",
    });
  expect(creada.status).toBe(201);
  return creada.body.data.order;
}

/** Orden FINISHED con un solo servicio de 850.00 (total 850.00). */
async function ordenTerminada() {
  const orden = await crearOrden();

  const servicio = await request(app)
    .post(`/api/service-orders/${orden.id}/services`)
    .set(headersMecanico)
    .send({ description: "Diagnóstico eléctrico", unitPrice: 850 });
  expect(servicio.status).toBe(201);

  for (const status of ["DIAGNOSIS", "IN_REPAIR", "FINISHED"]) {
    const cambio = await request(app)
      .patch(`/api/service-orders/${orden.id}/status`)
      .set(headersMecanico)
      .send({ status });
    expect(cambio.status).toBe(200);
  }
  return orden;
}

async function registrarPago(orden, cuerpo) {
  return request(app)
    .post(`/api/service-orders/${orden.id}/payments`)
    .set(headersRecepcion)
    .send(cuerpo);
}

function sincronizar(orden, paymentId, headers = headersRecepcion) {
  return request(app)
    .post(`/api/service-orders/${orden.id}/payments/${paymentId}/sync`)
    .set(headers);
}

function cancelar(orden, paymentId, headers = headersRecepcion) {
  return request(app)
    .post(`/api/service-orders/${orden.id}/payments/${paymentId}/cancel`)
    .set(headers);
}

async function estadoDePago(paymentId) {
  const [filas] = await poolPrueba.query("SELECT status FROM payments WHERE id = ?", [
    paymentId,
  ]);
  return filas.length === 0 ? null : filas[0].status;
}

/** Cliente simulado que responde la creación de la preferencia. */
function clientePreferencia() {
  usarClienteHttp(async (url, opciones) => {
    if (!url.includes("/checkout/preferences")) {
      throw new Error(`URL inesperada: ${url}`);
    }
    expect(opciones.method).toBe("POST");
    return respuesta(
      {
        id: "pref-999",
        init_point:
          "https://sandbox.mercadopago.com.mx/checkout/v1/redirect?pref_id=pref-999",
      },
      201,
    );
  });
}

/** Cliente simulado que responde la búsqueda del pago por external_reference. */
function clienteBusqueda(resultado) {
  usarClienteHttp(async (url) => {
    if (!url.includes("/v1/payments/search")) {
      throw new Error(`URL inesperada: ${url}`);
    }
    return respuesta({ results: resultado === null ? [] : [resultado] });
  });
}

/** Alta de un pago MP con la preferencia simulada; devuelve la respuesta. */
async function crearPagoMP(orden) {
  clientePreferencia();
  const creada = await registrarPago(orden, { method: "MERCADO_PAGO" });
  expect(creada.status).toBe(201);
  return creada.body.data;
}

describe("US4 - Mercado Pago simulado (T041, CA-3)", () => {
  test("el alta MP crea un pago PENDING con initPoint y externalReference", async () => {
    const orden = await ordenTerminada();

    const datos = await crearPagoMP(orden);

    expect(datos.payment.status).toBe("PENDING");
    expect(datos.payment.method).toBe("MERCADO_PAGO");
    expect(datos.payment.amount).toBe("850.00");
    expect(datos.initPoint).toBe(
      "https://sandbox.mercadopago.com.mx/checkout/v1/redirect?pref_id=pref-999",
    );
    // Referencia de la preferencia del proveedor en el pago (contrato).
    expect(datos.payment.externalReference).toBe("pref-999");
    expect(await estadoDePago(datos.payment.id)).toBe("PENDING");
  });

  test("sync con resultado aprobado lleva el pago a PAID", async () => {
    const orden = await ordenTerminada();
    const { payment } = await crearPagoMP(orden);

    clienteBusqueda({ status: "approved", id: "12345" });
    const sync = await sincronizar(orden, payment.id);

    expect(sync.status).toBe(200);
    expect(sync.body.data.payment.status).toBe("PAID");
    expect(await estadoDePago(payment.id)).toBe("PAID");
  });

  test("sync con resultado rechazado lleva el pago a REJECTED", async () => {
    const orden = await ordenTerminada();
    const { payment } = await crearPagoMP(orden);

    clienteBusqueda({ status: "rejected", id: "12345" });
    const sync = await sincronizar(orden, payment.id);

    expect(sync.status).toBe(200);
    expect(sync.body.data.payment.status).toBe("REJECTED");
    expect(await estadoDePago(payment.id)).toBe("REJECTED");
  });

  test("sync en proceso mantiene el pago PENDING", async () => {
    const orden = await ordenTerminada();
    const { payment } = await crearPagoMP(orden);

    clienteBusqueda({ status: "in_process", id: "12345" });
    const sync = await sincronizar(orden, payment.id);

    expect(sync.status).toBe(200);
    expect(sync.body.data.payment.status).toBe("PENDING");
    expect(await estadoDePago(payment.id)).toBe("PENDING");
  });

  test("cancel deja el pago CANCELLED y la orden acepta otro intento", async () => {
    const orden = await ordenTerminada();
    const { payment } = await crearPagoMP(orden);

    const cancelacion = await cancelar(orden, payment.id);
    expect(cancelacion.status).toBe(200);
    expect(cancelacion.body.data.payment.status).toBe("CANCELLED");
    expect(await estadoDePago(payment.id)).toBe("CANCELLED");

    // Q1: un pago cancelado no bloquea un reintento (ya no está PENDING).
    const reintento = await registrarPago(orden, { method: "CASH" });
    expect(reintento.status).toBe(201);
    expect(reintento.body.data.payment.status).toBe("PAID");
  });

  test("sync o cancel sobre método manual o estado terminal responden 409", async () => {
    const ordenManual = await ordenTerminada();
    const manual = await registrarPago(ordenManual, { method: "CASH" });
    expect(manual.status).toBe(201);
    const manualId = manual.body.data.payment.id;

    const syncManual = await sincronizar(ordenManual, manualId);
    expect(syncManual.status).toBe(409);
    expect(syncManual.body.error.code).toBe("INVALID_PAYMENT_TRANSITION");

    const cancelManual = await cancelar(ordenManual, manualId);
    expect(cancelManual.status).toBe(409);
    expect(cancelManual.body.error.code).toBe("INVALID_PAYMENT_TRANSITION");

    // Estado terminal: un MP ya REJECTED no admite ni sync ni cancel.
    const ordenMP = await ordenTerminada();
    const { payment } = await crearPagoMP(ordenMP);
    clienteBusqueda({ status: "rejected" });
    const rechazado = await sincronizar(ordenMP, payment.id);
    expect(rechazado.status).toBe(200);

    const syncTerminal = await sincronizar(ordenMP, payment.id);
    expect(syncTerminal.status).toBe(409);
    expect(syncTerminal.body.error.code).toBe("INVALID_PAYMENT_TRANSITION");

    const cancelTerminal = await cancelar(ordenMP, payment.id);
    expect(cancelTerminal.status).toBe(409);
    expect(cancelTerminal.body.error.code).toBe("INVALID_PAYMENT_TRANSITION");
  });

  test("un pago de otra orden responde 404 PAYMENT_NOT_FOUND", async () => {
    const ordenA = await ordenTerminada();
    const { payment } = await crearPagoMP(ordenA);
    const ordenB = await ordenTerminada();

    const syncAjeno = await sincronizar(ordenB, payment.id);
    expect(syncAjeno.status).toBe(404);
    expect(syncAjeno.body.error.code).toBe("PAYMENT_NOT_FOUND");

    const cancelAjeno = await cancelar(ordenB, payment.id);
    expect(cancelAjeno.status).toBe(404);
    expect(cancelAjeno.body.error.code).toBe("PAYMENT_NOT_FOUND");

    const inexistente = await sincronizar(ordenB, 99999999);
    expect(inexistente.status).toBe(404);
    expect(inexistente.body.error.code).toBe("PAYMENT_NOT_FOUND");
  });

  test("una falla del proveedor simulado responde 502 sin cambiar el estado", async () => {
    const orden = await ordenTerminada();
    const { payment } = await crearPagoMP(orden);

    usarClienteHttp(async () => {
      throw new Error("El proveedor no responde");
    });
    const sync = await sincronizar(orden, payment.id);

    expect(sync.status).toBe(502);
    expect(sync.body.error.code).toBe("MERCADO_PAGO_ERROR");
    expect(await estadoDePago(payment.id)).toBe("PENDING");
  });

  test("sin credenciales el alta y el sync responden 409 NO_CONFIGURED", async () => {
    const orden = await ordenTerminada();
    const { payment } = await crearPagoMP(orden);

    delete process.env.MP_ACCESS_TOKEN;

    // El sync consulta al proveedor: sin credenciales → «no disponible».
    const sync = await sincronizar(orden, payment.id);
    expect(sync.status).toBe(409);
    expect(sync.body.error.code).toBe("MERCADO_PAGO_NOT_CONFIGURED");
    expect(await estadoDePago(payment.id)).toBe("PENDING");

    // En una orden sin pagos el alta MP tampoco pasa sin credenciales
    // (con la orden que ya tiene el PENDING mandaría VN-05, US1).
    const ordenLimpia = await ordenTerminada();
    const sinCredenciales = await registrarPago(ordenLimpia, { method: "MERCADO_PAGO" });
    expect(sinCredenciales.status).toBe(409);
    expect(sinCredenciales.body.error.code).toBe("MERCADO_PAGO_NOT_CONFIGURED");

    const [pagos] = await poolPrueba.query(
      "SELECT COUNT(*) AS total FROM payments WHERE order_id = ?",
      [ordenLimpia.id],
    );
    expect(Number(pagos[0].total)).toBe(0);
  });

  test("el rol MECHANIC recibe 403 en sync y cancel (RN-15)", async () => {
    const orden = await ordenTerminada();
    const { payment } = await crearPagoMP(orden);

    const syncMecanico = await sincronizar(orden, payment.id, headersMecanico);
    expect(syncMecanico.status).toBe(403);
    expect(syncMecanico.body.error.code).toBe("FORBIDDEN");

    const cancelMecanico = await cancelar(orden, payment.id, headersMecanico);
    expect(cancelMecanico.status).toBe(403);
    expect(cancelMecanico.body.error.code).toBe("FORBIDDEN");
  });
});
