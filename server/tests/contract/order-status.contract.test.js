import request from "supertest";
import { app } from "../../app.js";
import { pool } from "../../config/db.js";
import * as clientes from "../../models/client.model.js";
import * as vehiculos from "../../models/vehicle.model.js";
import { crearPoolDePrueba, aplicarMigraciones, limpiarBaseDePrueba } from "../helpers/db.js";
import { tokenPara, conToken } from "../helpers/usuarios.js";

// T065: contrato de PATCH /api/service-orders/{id}/status (US6).
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

async function crearOrden() {
  contadorOrdenes += 1;
  const cliente = await clientes.crear({
    name: `Cliente ${contadorOrdenes}`,
    phone: `55${String(60000000 + contadorOrdenes).slice(-8)}`,
    email: `cliente-st${contadorOrdenes}@correo.mx`,
  });
  const vehiculo = await vehiculos.crear({
    clientId: cliente.id,
    brand: "Toyota",
    model: "Corolla",
    year: 2020,
    licensePlate: `T${String(contadorOrdenes).padStart(7, "0")}`,
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
  return respuesta.body.data.order;
}

describe("Contrato de PATCH .../status (US6)", () => {
  test("responde con sobre {ok,data:{order}} y la orden actualizada", async () => {
    const orden = await crearOrden();

    const respuesta = await request(app)
      .patch(`/api/service-orders/${orden.id}/status`)
      .set(headersMecanico)
      .send({ status: "DIAGNOSIS" });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.ok).toBe(true);
    expect(respuesta.body.data.order.id).toBe(orden.id);
    expect(respuesta.body.data.order.status).toBe("DIAGNOSIS");
    expect(respuesta.body.data.order.updatedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/,
    );
  });

  test("400 INVALID_STATUS_TRANSITION con mensaje en español", async () => {
    const orden = await crearOrden();

    const respuesta = await request(app)
      .patch(`/api/service-orders/${orden.id}/status`)
      .set(headersMecanico)
      .send({ status: "DELIVERED" });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe("INVALID_STATUS_TRANSITION");
    expect(respuesta.body.error.message).toBe(
      "La orden no puede pasar de Recibido a Entregado.",
    );
  });

  test("403 FORBIDDEN con sobre de error en español para RECEPTIONIST", async () => {
    const orden = await crearOrden();

    const respuesta = await request(app)
      .patch(`/api/service-orders/${orden.id}/status`)
      .set(headersRecepcion)
      .send({ status: "DIAGNOSIS" });

    expect(respuesta.status).toBe(403);
    expect(respuesta.body.data).toBeUndefined();
    expect(respuesta.body.error.code).toBe("FORBIDDEN");
    expect(respuesta.body.error.message).toBe(
      "No tienes permisos para realizar esta acción.",
    );
  });

  test("400 VALIDATION_ERROR si falta el estado", async () => {
    const orden = await crearOrden();

    const respuesta = await request(app)
      .patch(`/api/service-orders/${orden.id}/status`)
      .set(headersMecanico)
      .send({});

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe("VALIDATION_ERROR");
  });

  test("400 VALIDATION_ERROR con un estado que no existe", async () => {
    const orden = await crearOrden();

    const respuesta = await request(app)
      .patch(`/api/service-orders/${orden.id}/status`)
      .set(headersMecanico)
      .send({ status: "CANCELADO" });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe("VALIDATION_ERROR");
  });
});
