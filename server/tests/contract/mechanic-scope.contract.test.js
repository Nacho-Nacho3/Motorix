import request from "supertest";
import { app } from "../../app.js";
import { pool } from "../../config/db.js";
import * as clientes from "../../models/client.model.js";
import * as vehiculos from "../../models/vehicle.model.js";
import { crearPoolDePrueba, aplicarMigraciones, limpiarBaseDePrueba } from "../helpers/db.js";
import { tokenPara, conToken } from "../helpers/usuarios.js";

// T045: contrato del aislamiento R-07 (US4, CA-3): sobre de error en español.
let poolPrueba;
let headers;
let tokenMecanico;
let idMecanico;
let idOtroMecanico;

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
  headers = conToken(recepcion.token);

  const mec1 = await tokenPara({
    username: "mecanico-uno",
    role: "MECHANIC",
    name: "Mecánico Uno",
  });
  tokenMecanico = mec1.token;
  idMecanico = mec1.usuario.id;

  const mec2 = await tokenPara({
    username: "mecanico-dos",
    role: "MECHANIC",
    name: "Mecánico Dos",
  });
  idOtroMecanico = mec2.usuario.id;
});

let contadorOrdenes = 0;

async function crearOrden({ asignado, nombre, placas }) {
  contadorOrdenes += 1;
  const cliente = await clientes.crear({
    name: nombre,
    phone: `55${String(20000000 + contadorOrdenes).slice(-8)}`,
    email: `cliente-c${contadorOrdenes}@correo.mx`,
  });
  const vehiculo = await vehiculos.crear({
    clientId: cliente.id,
    brand: "Toyota",
    model: "Corolla",
    year: 2020,
    licensePlate: placas,
    vin: null,
    currentMileage: 85000,
  });
  const respuesta = await request(app)
    .post("/api/service-orders")
    .set(headers)
    .send({
      clientId: cliente.id,
      vehicleId: vehiculo.id,
      mechanicId: asignado,
      ...ORDEN,
    });
  expect(respuesta.status).toBe(201);
  return respuesta.body.data.order;
}

describe("Aislamiento de mecánicos (CA-3, R-07)", () => {
  test("GET /api/service-orders como MECHANIC devuelve total solo de las suyas", async () => {
    await crearOrden({
      asignado: idMecanico,
      nombre: "Juan Pérez",
      placas: "ABC1234",
    });
    await crearOrden({
      asignado: idMecanico,
      nombre: "Ana Ruiz",
      placas: "DEF5678",
    });
    await crearOrden({
      asignado: idOtroMecanico,
      nombre: "Luis Mendoza",
      placas: "XYZ9876",
    });

    const respuesta = await request(app)
      .get("/api/service-orders")
      .set(conToken(tokenMecanico));

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.ok).toBe(true);
    expect(respuesta.body.data.total).toBe(2);
    for (const orden of respuesta.body.data.orders) {
      expect(orden.mechanicId).toBe(idMecanico);
      expect(orden.mechanicName).toBe("Mecánico Uno");
    }
  });

  test("GET /{id} ajeno responde 403 con sobre de error en español", async () => {
    const ajena = await crearOrden({
      asignado: idOtroMecanico,
      nombre: "Luis Mendoza",
      placas: "XYZ9876",
    });

    const respuesta = await request(app)
      .get(`/api/service-orders/${ajena.id}`)
      .set(conToken(tokenMecanico));

    expect(respuesta.status).toBe(403);
    expect(respuesta.body.data).toBeUndefined();
    expect(respuesta.body.error.code).toBe("FORBIDDEN");
    expect(respuesta.body.error.message).toBe(
      "No tienes permisos para realizar esta acción.",
    );
  });
});
