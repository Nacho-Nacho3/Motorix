import request from "supertest";
import { app } from "../../app.js";
import { pool } from "../../config/db.js";
import * as clientes from "../../models/client.model.js";
import * as vehiculos from "../../models/vehicle.model.js";
import { crearPoolDePrueba, aplicarMigraciones, limpiarBaseDePrueba } from "../helpers/db.js";
import { tokenPara, conToken } from "../helpers/usuarios.js";
import { usarClienteHttp } from "../../services/mercadopago.service.js";

// T009: contrato de los pagos de una orden (US1) contra
// specs/004-pagos-tickets-dashboard/contracts/payments.md.
// Sobre {ok,data}, importes como cadena de 2 decimales, initPoint null en
// métodos manuales, enums de método/estado y los códigos de error documentados.

const METODOS = ["CASH", "CARD", "TRANSFER", "MERCADO_PAGO"];
const ESTADOS = ["PENDING", "PAID", "REJECTED", "CANCELLED"];

let poolPrueba;
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
  const recepcion = await tokenPara({
    username: "recepcion",
    role: "RECEPTIONIST",
    name: "Recepción",
  });
  headersRecepcion = conToken(recepcion.token);
  const mecanico = await tokenPara({ username: "mecanico-uno", role: "MECHANIC" });
  headersMecanico = conToken(mecanico.token);
  idMecanico = mecanico.usuario.id;
});

let contadorOrdenes = 0;

/** Orden en RECEIVED (sin terminar), para el caso ORDER_NOT_PAYABLE. */
async function crearOrden() {
  contadorOrdenes += 1;
  const cliente = await clientes.crear({
    name: `Cliente ct${contadorOrdenes}`,
    phone: `55${String(80000000 + contadorOrdenes).slice(-8)}`,
    email: `cliente-ct${contadorOrdenes}@correo.mx`,
  });
  const vehiculo = await vehiculos.crear({
    clientId: cliente.id,
    brand: "Toyota",
    model: "Corolla",
    year: 2020,
    licensePlate: `C${String(contadorOrdenes).padStart(7, "0")}`,
    vin: null,
    currentMileage: 85000,
  });
  const creada = await request(app)
    .post("/api/service-orders")
    .set(headersRecepcion)
    .send({
      clientId: cliente.id,
      vehicleId: vehiculo.id,
      mechanicId: idMecanico,
      entryMileage: 86000,
      reportedProblem: "Ruido al frenar",
    });
  expect(creada.status).toBe(201);
  return creada.body.data.order;
}

async function crearOrdenTerminada() {
  const orden = await crearOrden();

  await request(app)
    .post(`/api/service-orders/${orden.id}/services`)
    .set(headersMecanico)
    .send({ description: "Afinación mayor", unitPrice: 850 })
    .expect(201);
  await request(app)
    .post(`/api/service-orders/${orden.id}/labor`)
    .set(headersMecanico)
    .send({ concept: "Instalación", hours: 2, hourlyRate: 300 })
    .expect(201);

  for (const status of ["DIAGNOSIS", "IN_REPAIR", "FINISHED"]) {
    await request(app)
      .patch(`/api/service-orders/${orden.id}/status`)
      .set(headersMecanico)
      .send({ status })
      .expect(200);
  }
  return orden;
}

/** Verifica la forma del objeto pago documentada en el contrato. */
function esperarFormaDePago(pago, { orderId }) {
  expect(pago).toEqual(
    expect.objectContaining({
      id: expect.any(Number),
      orderId,
      amount: expect.any(String),
      method: expect.stringMatching(`^(${METODOS.join("|")})$`),
      status: expect.stringMatching(`^(${ESTADOS.join("|")})$`),
      createdBy: expect.any(Number),
      createdByName: expect.any(String),
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    }),
  );
  // Referencia del proveedor: null en manuales, cadena en MP (RN-14).
  expect(pago.externalReference === null || typeof pago.externalReference === "string").toBe(true);
  // Importe como cadena con exactamente 2 decimales.
  expect(pago.amount).toMatch(/^\d+\.\d{2}$/);
}

describe("Contrato de pagos (US1) — contracts/payments.md", () => {
  test("GET total responde sobre {ok,data} con subtotales y total como cadenas", async () => {
    const orden = await crearOrdenTerminada();

    const respuesta = await request(app)
      .get(`/api/service-orders/${orden.id}/total`)
      .set(headersRecepcion);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.ok).toBe(true);
    const data = respuesta.body.data;
    expect(Object.keys(data).sort()).toEqual(
      ["laborSubtotal", "orderId", "partsSubtotal", "servicesSubtotal", "total"].sort(),
    );
    for (const campo of ["servicesSubtotal", "laborSubtotal", "partsSubtotal", "total"]) {
      expect(data[campo]).toMatch(/^\d+\.\d{2}$/);
    }
    expect(data.total).toBe("1450.00"); // 850 servicios + 600 mano de obra
  });

  test("POST responde 201 sobre {ok,data} con payment y initPoint null (manual)", async () => {
    const orden = await crearOrdenTerminada();

    const respuesta = await request(app)
      .post(`/api/service-orders/${orden.id}/payments`)
      .set(headersRecepcion)
      .send({ method: "CASH", amount: "1450.00" });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.ok).toBe(true);
    expect(respuesta.body.data).toHaveProperty("payment");
    esperarFormaDePago(respuesta.body.data.payment, { orderId: orden.id });
    expect(respuesta.body.data.payment.amount).toBe("1450.00");
    expect(respuesta.body.data.payment.status).toBe("PAID");
    expect(respuesta.body.data.initPoint).toBeNull();
  });

  test("GET payments responde sobre {ok,data} con payments y total", async () => {
    const orden = await crearOrdenTerminada();
    await request(app)
      .post(`/api/service-orders/${orden.id}/payments`)
      .set(headersRecepcion)
      .send({ method: "TRANSFER" })
      .expect(201);

    const respuesta = await request(app)
      .get(`/api/service-orders/${orden.id}/payments`)
      .set(headersRecepcion);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.ok).toBe(true);
    expect(Array.isArray(respuesta.body.data.payments)).toBe(true);
    expect(respuesta.body.data.total).toMatch(/^\d+\.\d{2}$/);
    for (const pago of respuesta.body.data.payments) {
      esperarFormaDePago(pago, { orderId: orden.id });
    }
  });

  test("amount en la respuesta conserva 2 decimales aunque el total suba de nivel", async () => {
    const orden = await crearOrdenTerminada();

    const respuesta = await request(app)
      .post(`/api/service-orders/${orden.id}/payments`)
      .set(headersRecepcion)
      .send({ method: "CASH" });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data.payment.amount).toBe("1450.00");
  });

  test("códigos de error documentados: PAYMENT_AMOUNT_MISMATCH, ORDER_ALREADY_PAID, ORDER_NOT_PAYABLE, VALIDATION_ERROR", async () => {
    const orden = await crearOrdenTerminada();

    const mismatch = await request(app)
      .post(`/api/service-orders/${orden.id}/payments`)
      .set(headersRecepcion)
      .send({ method: "CASH", amount: "10.00" });
    expect(mismatch.status).toBe(400);
    expect(mismatch.body).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "PAYMENT_AMOUNT_MISMATCH" }),
    });

    await request(app)
      .post(`/api/service-orders/${orden.id}/payments`)
      .set(headersRecepcion)
      .send({ method: "CASH" })
      .expect(201);
    const yaPagada = await request(app)
      .post(`/api/service-orders/${orden.id}/payments`)
      .set(headersRecepcion)
      .send({ method: "CARD" });
    expect(yaPagada.status).toBe(400);
    expect(yaPagada.body.error.code).toBe("ORDER_ALREADY_PAID");

    const ordenEnCurso = await crearOrden();
    const noCobrable = await request(app)
      .post(`/api/service-orders/${ordenEnCurso.id}/payments`)
      .set(headersRecepcion)
      .send({ method: "CASH" });
    expect(noCobrable.status).toBe(400);
    expect(noCobrable.body.error.code).toBe("ORDER_NOT_PAYABLE");

    const invalido = await request(app)
      .post(`/api/service-orders/${orden.id}/payments`)
      .set(headersRecepcion)
      .send({ method: "BITCOIN" });
    expect(invalido.status).toBe(400);
    expect(invalido.body.error.code).toBe("VALIDATION_ERROR");
    expect(invalido.body.error.details[0].message).toMatch(/método/i);
  });

  test("códigos FORBIDDEN y SERVICE_ORDER_NOT_FOUND", async () => {
    const orden = await crearOrdenTerminada();

    const totalMecanico = await request(app)
      .get(`/api/service-orders/${orden.id}/total`)
      .set(headersMecanico);
    expect(totalMecanico.status).toBe(403);
    expect(totalMecanico.body.error.code).toBe("FORBIDDEN");

    const listaMecanico = await request(app)
      .get(`/api/service-orders/${orden.id}/payments`)
      .set(headersMecanico);
    expect(listaMecanico.status).toBe(403);
    expect(listaMecanico.body.error.code).toBe("FORBIDDEN");

    const noExiste = await request(app)
      .get("/api/service-orders/99999999/payments")
      .set(headersRecepcion);
    expect(noExiste.status).toBe(404);
    expect(noExiste.body.error.code).toBe("SERVICE_ORDER_NOT_FOUND");
  });
});

// T042: contratos de sync y cancel contra contracts/payments.md (US4, CA-3).
describe("Contrato de sync y cancel (US4) — contracts/payments.md", () => {
  let tokenOriginal;

  beforeEach(() => {
    tokenOriginal = process.env.MP_ACCESS_TOKEN;
    process.env.MP_ACCESS_TOKEN = "TEST-token-contrato";
  });

  afterEach(() => {
    if (tokenOriginal === undefined) delete process.env.MP_ACCESS_TOKEN;
    else process.env.MP_ACCESS_TOKEN = tokenOriginal;
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

  /** Preferencia simulada + alta MP; devuelve el cuerpo del 201. */
  async function crearPagoMP(orden) {
    usarClienteHttp(async (url) => {
      if (url.includes("/checkout/preferences")) {
        return respuesta({ id: "pref-ct", init_point: "https://sandbox.mp/pref-ct" }, 201);
      }
      throw new Error(`URL inesperada: ${url}`);
    });
    const creada = await request(app)
      .post(`/api/service-orders/${orden.id}/payments`)
      .set(headersRecepcion)
      .send({ method: "MERCADO_PAGO" });
    expect(creada.status).toBe(201);
    return creada.body.data;
  }

  function sync(orden, paymentId, headers = headersRecepcion) {
    return request(app)
      .post(`/api/service-orders/${orden.id}/payments/${paymentId}/sync`)
      .set(headers);
  }

  function cancel(orden, paymentId, headers = headersRecepcion) {
    return request(app)
      .post(`/api/service-orders/${orden.id}/payments/${paymentId}/cancel`)
      .set(headers);
  }

  test("initPoint no nulo para MP y payment con externalReference", async () => {
    const orden = await crearOrdenTerminada();

    const datos = await crearPagoMP(orden);

    expect(datos).toHaveProperty("payment");
    expect(datos.initPoint).toBe("https://sandbox.mp/pref-ct");
    esperarFormaDePago(datos.payment, { orderId: orden.id });
    expect(datos.payment.status).toBe("PENDING");
    expect(typeof datos.payment.externalReference).toBe("string");
    expect(datos.payment.externalReference.length).toBeGreaterThan(0);
  });

  test("sync responde 200 sobre {ok,data} con payment actualizado", async () => {
    const orden = await crearOrdenTerminada();
    const { payment } = await crearPagoMP(orden);

    usarClienteHttp(async () => respuesta({ results: [{ status: "approved" }] }));
    const respuestaSync = await sync(orden, payment.id);

    expect(respuestaSync.status).toBe(200);
    expect(respuestaSync.body.ok).toBe(true);
    esperarFormaDePago(respuestaSync.body.data.payment, { orderId: orden.id });
    expect(respuestaSync.body.data.payment.status).toBe("PAID");
  });

  test("cancel responde 200 con payment CANCELLED", async () => {
    const orden = await crearOrdenTerminada();
    const { payment } = await crearPagoMP(orden);

    const respuestaCancel = await cancel(orden, payment.id);

    expect(respuestaCancel.status).toBe(200);
    expect(respuestaCancel.body.ok).toBe(true);
    esperarFormaDePago(respuestaCancel.body.data.payment, { orderId: orden.id });
    expect(respuestaCancel.body.data.payment.status).toBe("CANCELLED");
  });

  test("códigos: INVALID_PAYMENT_TRANSITION, PAYMENT_NOT_FOUND, NO_CONFIGURED y MERCADO_PAGO_ERROR", async () => {
    // Método manual → sync y cancel con 409 (máquina de estados R-04).
    const ordenManual = await crearOrdenTerminada();
    const manual = await request(app)
      .post(`/api/service-orders/${ordenManual.id}/payments`)
      .set(headersRecepcion)
      .send({ method: "CASH" })
      .expect(201);
    const manualId = manual.body.data.payment.id;

    const syncManual = await sync(ordenManual, manualId);
    expect(syncManual.status).toBe(409);
    expect(syncManual.body.error.code).toBe("INVALID_PAYMENT_TRANSITION");

    // Pago que no pertenece a la orden → 404.
    const ordenMP = await crearOrdenTerminada();
    const { payment } = await crearPagoMP(ordenMP);
    const ordenAjena = await crearOrdenTerminada();
    const syncAjeno = await sync(ordenAjena, payment.id);
    expect(syncAjeno.status).toBe(404);
    expect(syncAjeno.body.error.code).toBe("PAYMENT_NOT_FOUND");

    // Proveedor simulado que no responde → 502 sin cambio de estado.
    usarClienteHttp(async () => {
      throw new Error("proveedor fuera de servicio");
    });
    const syncFallido = await sync(ordenMP, payment.id);
    expect(syncFallido.status).toBe(502);
    expect(syncFallido.body.error.code).toBe("MERCADO_PAGO_ERROR");

    // Sin credenciales → 409 (el sync consulta al proveedor).
    delete process.env.MP_ACCESS_TOKEN;
    const sinCredenciales = await sync(ordenMP, payment.id);
    expect(sinCredenciales.status).toBe(409);
    expect(sinCredenciales.body.error.code).toBe("MERCADO_PAGO_NOT_CONFIGURED");
  });

  test("FORBIDDEN para MECHANIC en sync y cancel", async () => {
    const orden = await crearOrdenTerminada();
    const { payment } = await crearPagoMP(orden);

    const syncMecanico = await sync(orden, payment.id, headersMecanico);
    expect(syncMecanico.status).toBe(403);
    expect(syncMecanico.body.error.code).toBe("FORBIDDEN");

    const cancelMecanico = await cancel(orden, payment.id, headersMecanico);
    expect(cancelMecanico.status).toBe(403);
    expect(cancelMecanico.body.error.code).toBe("FORBIDDEN");
  });
});
