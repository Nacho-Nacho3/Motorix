import request from "supertest";
import { app } from "../../app.js";
import { pool } from "../../config/db.js";
import * as clientes from "../../models/client.model.js";
import * as vehiculos from "../../models/vehicle.model.js";
import { crearPoolDePrueba, aplicarMigraciones, limpiarBaseDePrueba } from "../helpers/db.js";
import { tokenPara, conToken } from "../helpers/usuarios.js";

// T031: contrato del ticket (US3) contra
// specs/004-pagos-tickets-dashboard/contracts/tickets.md.
// Sobre {ok,data}, folio derivado del id, contenido calculado (RN-10),
// idempotencia 201/200 y los códigos de error documentados.

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

/** Orden en RECEIVED (para ORDER_NOT_FINISHED). */
async function crearOrden() {
  contadorOrdenes += 1;
  const cliente = await clientes.crear({
    name: `Cliente tc${contadorOrdenes}`,
    phone: `55${String(90000000 + contadorOrdenes).slice(-8)}`,
    email: `cliente-tc${contadorOrdenes}@correo.mx`,
  });
  const vehiculo = await vehiculos.crear({
    clientId: cliente.id,
    brand: "Nissan",
    model: "Versa",
    year: 2020,
    licensePlate: `C${String(contadorOrdenes).padStart(7, "0")}`,
    vin: null,
    currentMileage: 44000,
  });
  const creada = await request(app)
    .post("/api/service-orders")
    .set(headersRecepcion)
    .send({
      clientId: cliente.id,
      vehicleId: vehiculo.id,
      mechanicId: idMecanico,
      entryMileage: 45000,
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

/** Verifica la forma completa del objeto ticket documentada en el contrato. */
function esperarFormaDeTicket(ticket, { orderId }) {
  expect(ticket).toEqual(
    expect.objectContaining({
      id: expect.any(Number),
      folio: expect.stringMatching(/^TCK-\d{6}$/),
      orderId,
      issuedBy: expect.any(Number),
      issuedByName: expect.any(String),
      createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/),
      workshop: { name: expect.any(String), address: null, phone: null },
      client: {
        id: expect.any(Number),
        name: expect.any(String),
        phone: expect.any(String),
      },
      vehicle: {
        id: expect.any(Number),
        label: expect.any(String),
        licensePlate: expect.any(String),
        entryMileage: expect.any(Number),
      },
      services: expect.any(Array),
      labor: expect.any(Array),
      parts: expect.any(Array),
      totals: {
        servicesSubtotal: expect.stringMatching(/^\d+\.\d{2}$/),
        laborSubtotal: expect.stringMatching(/^\d+\.\d{2}$/),
        partsSubtotal: expect.stringMatching(/^\d+\.\d{2}$/),
        total: expect.stringMatching(/^\d+\.\d{2}$/),
      },
      payment: null,
    }),
  );
}

describe("Contrato de tickets (US3) — contracts/tickets.md", () => {
  test("POST responde 201 sobre {ok,data} con el objeto ticket completo", async () => {
    const orden = await crearOrdenTerminada();

    const respuesta = await request(app)
      .post(`/api/service-orders/${orden.id}/ticket`)
      .set(headersRecepcion);

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.ok).toBe(true);
    esperarFormaDeTicket(respuesta.body.data.ticket, { orderId: orden.id });
    expect(respuesta.body.data.ticket.totals.total).toBe("1450.00");
  });

  test("idempotencia: el POST repetido devuelve 200 con el mismo ticket", async () => {
    const orden = await crearOrdenTerminada();

    const primero = await request(app)
      .post(`/api/service-orders/${orden.id}/ticket`)
      .set(headersRecepcion);
    expect(primero.status).toBe(201);

    const segundo = await request(app)
      .post(`/api/service-orders/${orden.id}/ticket`)
      .set(headersRecepcion);
    expect(segundo.status).toBe(200);
    expect(segundo.body.ok).toBe(true);
    expect(segundo.body.data.ticket).toEqual(primero.body.data.ticket);
  });

  test("GET devuelve 200 con el contenido calculado y payment null sin pago", async () => {
    const orden = await crearOrdenTerminada();
    await request(app)
      .post(`/api/service-orders/${orden.id}/ticket`)
      .set(headersRecepcion)
      .expect(201);

    const respuesta = await request(app)
      .get(`/api/service-orders/${orden.id}/ticket`)
      .set(headersRecepcion);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.ok).toBe(true);
    esperarFormaDeTicket(respuesta.body.data.ticket, { orderId: orden.id });
  });

  test("códigos ORDER_NOT_FINISHED, TICKET_NOT_FOUND y FORBIDDEN", async () => {
    const enCurso = await crearOrden();
    const noTerminada = await request(app)
      .post(`/api/service-orders/${enCurso.id}/ticket`)
      .set(headersRecepcion);
    expect(noTerminada.status).toBe(400);
    expect(noTerminada.body.error.code).toBe("ORDER_NOT_FINISHED");

    const orden = await crearOrdenTerminada();
    const sinTicket = await request(app)
      .get(`/api/service-orders/${orden.id}/ticket`)
      .set(headersRecepcion);
    expect(sinTicket.status).toBe(404);
    expect(sinTicket.body.error.code).toBe("TICKET_NOT_FOUND");

    await request(app)
      .post(`/api/service-orders/${orden.id}/ticket`)
      .set(headersRecepcion)
      .expect(201);
    const mecanicoPost = await request(app)
      .post(`/api/service-orders/${orden.id}/ticket`)
      .set(headersMecanico);
    expect(mecanicoPost.status).toBe(403);
    expect(mecanicoPost.body.error.code).toBe("FORBIDDEN");

    const mecanicoGet = await request(app)
      .get(`/api/service-orders/${orden.id}/ticket`)
      .set(headersMecanico);
    expect(mecanicoGet.status).toBe(403);
    expect(mecanicoGet.body.error.code).toBe("FORBIDDEN");
  });
});
