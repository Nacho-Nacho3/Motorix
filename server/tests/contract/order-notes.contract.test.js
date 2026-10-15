import request from "supertest";
import { app } from "../../app.js";
import { pool } from "../../config/db.js";
import * as clientes from "../../models/client.model.js";
import * as vehiculos from "../../models/vehicle.model.js";
import { crearPoolDePrueba, aplicarMigraciones, limpiarBaseDePrueba } from "../helpers/db.js";
import { tokenPara, conToken } from "../helpers/usuarios.js";

// T071: contrato de PATCH /api/service-orders/{id}/work con notes (US7).
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
    phone: `55${String(80000000 + contadorOrdenes).slice(-8)}`,
    email: `cliente-cn${contadorOrdenes}@correo.mx`,
  });
  const vehiculo = await vehiculos.crear({
    clientId: cliente.id,
    brand: "Toyota",
    model: "Corolla",
    year: 2020,
    licensePlate: `M${String(contadorOrdenes).padStart(7, "0")}`,
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

describe("Contrato de PATCH .../work con notas (US7)", () => {
  test("con observations y recommendations responde 200 con data.order (sobre)", async () => {
    const orden = await crearOrden();

    const respuesta = await request(app)
      .patch(`/api/service-orders/${orden.id}/work`)
      .set(headersMecanico)
      .send({
        observations: "Discos en buen estado",
        recommendations: "Revisar frenos en 5,000 km",
      });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.ok).toBe(true);
    expect(respuesta.body.data.order).toEqual(
      expect.objectContaining({
        id: orden.id,
        status: "RECEIVED",
        observations: "Discos en buen estado",
        recommendations: "Revisar frenos en 5,000 km",
      }),
    );
  });

  test("400 VALIDATION_ERROR con observations vacías (mensaje en español)", async () => {
    const orden = await crearOrden();

    const respuesta = await request(app)
      .patch(`/api/service-orders/${orden.id}/work`)
      .set(headersMecanico)
      .send({ observations: "" });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe("VALIDATION_ERROR");
    expect(respuesta.body.error.details[0].message).toBe(
      "Las observaciones no pueden quedar vacías.",
    );
  });

  test("400 VALIDATION_ERROR sin ningún campo", async () => {
    const orden = await crearOrden();

    const respuesta = await request(app)
      .patch(`/api/service-orders/${orden.id}/work`)
      .set(headersMecanico)
      .send({});

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe("VALIDATION_ERROR");
    expect(respuesta.body.error.details[0].message).toBe(
      "Debes enviar al menos un campo a actualizar.",
    );
  });

  test("solo recommendations también es válido (200)", async () => {
    const orden = await crearOrden();

    const respuesta = await request(app)
      .patch(`/api/service-orders/${orden.id}/work`)
      .set(headersMecanico)
      .send({ recommendations: "Revisar frenos en 5,000 km" });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.order.recommendations).toBe(
      "Revisar frenos en 5,000 km",
    );
    expect(respuesta.body.data.order.observations).toBeNull();
  });
});
