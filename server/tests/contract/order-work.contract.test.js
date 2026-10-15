import request from "supertest";
import { app } from "../../app.js";
import { pool } from "../../config/db.js";
import * as clientes from "../../models/client.model.js";
import * as vehiculos from "../../models/vehicle.model.js";
import * as ordenes from "../../models/service_order.model.js";
import { crearPoolDePrueba, aplicarMigraciones, limpiarBaseDePrueba } from "../helpers/db.js";
import { tokenPara, conToken } from "../helpers/usuarios.js";

// T051: contrato de services/labor según contracts/service-orders.md (US5).
let poolPrueba;
let headersRecepcion;
let headersMecanico;
let idMecanico;

const ORDEN = {
  entryMileage: 86000,
  reportedProblem: "Ruido al frenar",
};

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

  const mec1 = await tokenPara({
    username: "mecanico-uno",
    role: "MECHANIC",
    name: "Mecánico Uno",
  });
  headersMecanico = conToken(mec1.token);
  idMecanico = mec1.usuario.id;
});

let contadorOrdenes = 0;

async function crearOrden({ status } = {}) {
  contadorOrdenes += 1;
  const cliente = await clientes.crear({
    name: `Cliente ${contadorOrdenes}`,
    phone: `55${String(40000000 + contadorOrdenes).slice(-8)}`,
    email: `cliente-cw${contadorOrdenes}@correo.mx`,
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
  const respuesta = await request(app)
    .post("/api/service-orders")
    .set(headersRecepcion)
    .send({
      clientId: cliente.id,
      vehicleId: vehiculo.id,
      mechanicId: idMecanico,
      ...ORDEN,
    });
  expect(respuesta.status).toBe(201);
  const orden = respuesta.body.data.order;
  if (status) await ordenes.actualizar(orden.id, { status });
  return orden;
}

describe("Contrato de services y labor (US5)", () => {
  test("POST .../services responde 201 con data.service (sobre)", async () => {
    const orden = await crearOrden();

    const respuesta = await request(app)
      .post(`/api/service-orders/${orden.id}/services`)
      .set(headersMecanico)
      .send({ description: "Cambio de pastillas delanteras", unitPrice: 450.0 });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data.service).toEqual({
      id: expect.any(Number),
      orderId: orden.id,
      description: "Cambio de pastillas delanteras",
      unitPrice: 450,
      createdAt: expect.stringMatching(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/,
      ),
    });
  });

  test("DELETE .../services responde 200 con data.deleted true", async () => {
    const orden = await crearOrden();
    const servicio = await request(app)
      .post(`/api/service-orders/${orden.id}/services`)
      .set(headersMecanico)
      .send({ description: "Fila a corregir", unitPrice: 100 });

    const respuesta = await request(app)
      .delete(
        `/api/service-orders/${orden.id}/services/${servicio.body.data.service.id}`,
      )
      .set(headersMecanico);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toEqual({ deleted: true });
  });

  test("DELETE de un servicio que no pertenece a la orden responde 404 ORDER_ITEM_NOT_FOUND", async () => {
    const ordenA = await crearOrden();
    const ordenB = await crearOrden();
    const servicioDeB = await request(app)
      .post(`/api/service-orders/${ordenB.id}/services`)
      .set(headersMecanico)
      .send({ description: "De otra orden", unitPrice: 100 });

    const respuesta = await request(app)
      .delete(
        `/api/service-orders/${ordenA.id}/services/${servicioDeB.body.data.service.id}`,
      )
      .set(headersMecanico);

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.code).toBe("ORDER_ITEM_NOT_FOUND");
    expect(respuesta.body.error.message).toBe(
      "El registro indicado no existe o no pertenece a la orden.",
    );
  });

  test("POST .../labor responde 201 con data.labor (sobre)", async () => {
    const orden = await crearOrden();

    const respuesta = await request(app)
      .post(`/api/service-orders/${orden.id}/labor`)
      .set(headersMecanico)
      .send({ concept: "Cambiar pastillas delanteras", hours: 1.5, hourlyRate: 350.0 });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data.labor).toEqual({
      id: expect.any(Number),
      orderId: orden.id,
      concept: "Cambiar pastillas delanteras",
      hours: 1.5,
      hourlyRate: 350,
      createdAt: expect.stringMatching(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/,
      ),
    });
  });

  test("DELETE .../labor responde 200 con data.deleted true", async () => {
    const orden = await crearOrden();
    const trabajo = await request(app)
      .post(`/api/service-orders/${orden.id}/labor`)
      .set(headersMecanico)
      .send({ concept: "Fila a corregir", hours: 1, hourlyRate: 350 });

    const respuesta = await request(app)
      .delete(
        `/api/service-orders/${orden.id}/labor/${trabajo.body.data.labor.id}`,
      )
      .set(headersMecanico);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toEqual({ deleted: true });
  });

  test("ORDER_DELIVERED en orden entregada para rol distinto de ADMIN", async () => {
    const orden = await crearOrden({ status: "DELIVERED" });

    const respuesta = await request(app)
      .post(`/api/service-orders/${orden.id}/services`)
      .set(headersMecanico)
      .send({ description: "Post-entrega", unitPrice: 100 });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe("ORDER_DELIVERED");
    expect(respuesta.body.error.message).toBe(
      "La orden ya fue entregada; solo el administrador puede corregirla.",
    );
  });
});
