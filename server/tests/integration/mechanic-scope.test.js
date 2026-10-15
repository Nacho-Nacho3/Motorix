import request from "supertest";
import { app } from "../../app.js";
import { pool } from "../../config/db.js";
import * as clientes from "../../models/client.model.js";
import * as vehiculos from "../../models/vehicle.model.js";
import { crearPoolDePrueba, aplicarMigraciones, limpiarBaseDePrueba } from "../helpers/db.js";
import { tokenPara, conToken } from "../helpers/usuarios.js";

// T044: aislamiento R-07 de los mecánicos (US4, CA-3).
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

/** Crea cliente + vehículo y registra la orden asignada a `asignado`. */
async function crearOrden({ asignado, nombre, placas }) {
  contadorOrdenes += 1;
  const cliente = await clientes.crear({
    name: nombre,
    phone: `55${String(10000000 + contadorOrdenes).slice(-8)}`,
    email: `cliente${contadorOrdenes}@correo.mx`,
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

describe("Aislamiento R-07 de los mecánicos (CA-3)", () => {
  test("MECHANIC lista solo sus órdenes (WHERE mechanic_id)", async () => {
    const mia1 = await crearOrden({
      asignado: idMecanico,
      nombre: "Juan Pérez",
      placas: "ABC1234",
    });
    const mia2 = await crearOrden({
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
    expect(respuesta.body.data.total).toBe(2);
    const ids = respuesta.body.data.orders.map((orden) => orden.id).sort();
    expect(ids).toEqual([mia1.id, mia2.id].sort());
    for (const orden of respuesta.body.data.orders) {
      expect(orden.mechanicId).toBe(idMecanico);
    }
  });

  test("el detalle de una orden ajena responde 403 FORBIDDEN (no 404)", async () => {
    const ajena = await crearOrden({
      asignado: idOtroMecanico,
      nombre: "Luis Mendoza",
      placas: "XYZ9876",
    });
    const propia = await crearOrden({
      asignado: idMecanico,
      nombre: "Juan Pérez",
      placas: "ABC1234",
    });

    const detallePropia = await request(app)
      .get(`/api/service-orders/${propia.id}`)
      .set(conToken(tokenMecanico));
    expect(detallePropia.status).toBe(200);

    const detalleAjena = await request(app)
      .get(`/api/service-orders/${ajena.id}`)
      .set(conToken(tokenMecanico));
    expect(detalleAjena.status).toBe(403);
    expect(detalleAjena.body.error.code).toBe("FORBIDDEN");
  });

  test("ADMIN y RECEPTIONIST listan todas las órdenes", async () => {
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

    const { token: tokenAdmin } = await tokenPara({
      username: "admin",
      role: "ADMIN",
      name: "Administración",
    });

    const comoAdmin = await request(app)
      .get("/api/service-orders")
      .set(conToken(tokenAdmin));
    expect(comoAdmin.body.data.total).toBe(3);

    const comoRecepcion = await request(app)
      .get("/api/service-orders")
      .set(headers);
    expect(comoRecepcion.body.data.total).toBe(3);
  });

  test("?mechanicId ajeno se ignora para MECHANIC", async () => {
    await crearOrden({
      asignado: idMecanico,
      nombre: "Juan Pérez",
      placas: "ABC1234",
    });
    await crearOrden({
      asignado: idOtroMecanico,
      nombre: "Luis Mendoza",
      placas: "XYZ9876",
    });

    const respuesta = await request(app)
      .get("/api/service-orders")
      .query({ mechanicId: idOtroMecanico })
      .set(conToken(tokenMecanico));

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.total).toBe(1);
    expect(respuesta.body.data.orders[0].mechanicId).toBe(idMecanico);
  });
});
