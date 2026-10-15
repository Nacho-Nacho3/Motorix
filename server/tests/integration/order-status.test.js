import request from "supertest";
import { app } from "../../app.js";
import { pool } from "../../config/db.js";
import * as clientes from "../../models/client.model.js";
import * as vehiculos from "../../models/vehicle.model.js";
import { crearPoolDePrueba, aplicarMigraciones, limpiarBaseDePrueba } from "../helpers/db.js";
import { tokenPara, conToken } from "../helpers/usuarios.js";

// T064: cambio de estado de la orden por la API (US6, CA-5, R-02).
let poolPrueba;
let headersRecepcion;
let headersMecanico;
let tokenAdmin;
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
  headersRecepcion = conToken(recepcion.token);

  const mec1 = await tokenPara({
    username: "mecanico-uno",
    role: "MECHANIC",
    name: "Mecánico Uno",
  });
  headersMecanico = conToken(mec1.token);
  idMecanico = mec1.usuario.id;

  const mec2 = await tokenPara({
    username: "mecanico-dos",
    role: "MECHANIC",
    name: "Mecánico Dos",
  });
  idOtroMecanico = mec2.usuario.id;

  const admin = await tokenPara({
    username: "admin",
    role: "ADMIN",
    name: "Administración",
  });
  tokenAdmin = admin.token;
});

let contadorOrdenes = 0;

async function crearOrden({ asignado } = {}) {
  contadorOrdenes += 1;
  const cliente = await clientes.crear({
    name: `Cliente ${contadorOrdenes}`,
    phone: `55${String(50000000 + contadorOrdenes).slice(-8)}`,
    email: `cliente-s${contadorOrdenes}@correo.mx`,
  });
  const vehiculo = await vehiculos.crear({
    clientId: cliente.id,
    brand: "Toyota",
    model: "Corolla",
    year: 2020,
    licensePlate: `S${String(contadorOrdenes).padStart(7, "0")}`,
    vin: null,
    currentMileage: 85000,
  });
  const respuesta = await request(app)
    .post("/api/service-orders")
    .set(headersRecepcion)
    .send({
      clientId: cliente.id,
      vehicleId: vehiculo.id,
      mechanicId: asignado ?? idMecanico,
      ...ORDEN,
    });
  expect(respuesta.status).toBe(201);
  return respuesta.body.data.order;
}

async function cambiarEstado(orden, status, headers) {
  return request(app)
    .patch(`/api/service-orders/${orden.id}/status`)
    .set(headers)
    .send({ status });
}

describe("Cambio de estado de la orden (US6, CA-5)", () => {
  test("el mecánico recorre el flujo completo con 200", async () => {
    const orden = await crearOrden();

    for (const status of ["DIAGNOSIS", "IN_REPAIR", "FINISHED", "DELIVERED"]) {
      const respuesta = await cambiarEstado(orden, status, headersMecanico);
      expect(respuesta.status).toBe(200);
      expect(respuesta.body.data.order.status).toBe(status);
    }
  });

  test("un salto inválido responde 400 INVALID_STATUS_TRANSITION", async () => {
    const orden = await crearOrden();

    const respuesta = await cambiarEstado(orden, "FINISHED", headersMecanico);

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe("INVALID_STATUS_TRANSITION");
    expect(respuesta.body.error.message).toBe(
      "La orden no puede pasar de Recibido a Terminado.",
    );
  });

  test("WAITING_PART regresa al estado desde el que se entró", async () => {
    const orden = await crearOrden();

    // Desde DIAGNOSIS: la refacción llega y vuelve a DIAGNOSIS.
    await cambiarEstado(orden, "DIAGNOSIS", headersMecanico);
    const espera1 = await cambiarEstado(orden, "WAITING_PART", headersMecanico);
    expect(espera1.body.data.order.status).toBe("WAITING_PART");
    const salida1 = await cambiarEstado(orden, "DIAGNOSIS", headersMecanico);
    expect(salida1.body.data.order.status).toBe("DIAGNOSIS");

    // Desde IN_REPAIR: la salida a un destino que no es el origen se rechaza
    // y, cuando llega la refacción, vuelve a IN_REPAIR.
    await cambiarEstado(orden, "IN_REPAIR", headersMecanico);
    const espera2 = await cambiarEstado(orden, "WAITING_PART", headersMecanico);
    expect(espera2.body.data.order.status).toBe("WAITING_PART");
    const salidaInvalida = await cambiarEstado(orden, "FINISHED", headersMecanico);
    expect(salidaInvalida.status).toBe(400);
    expect(salidaInvalida.body.error.code).toBe("INVALID_STATUS_TRANSITION");
    const salida2 = await cambiarEstado(orden, "IN_REPAIR", headersMecanico);
    expect(salida2.body.data.order.status).toBe("IN_REPAIR");
  });

  test("RECEPTIONIST recibe 403 en el cambio de estado", async () => {
    const orden = await crearOrden();

    const respuesta = await cambiarEstado(orden, "DIAGNOSIS", headersRecepcion);

    expect(respuesta.status).toBe(403);
    expect(respuesta.body.error.code).toBe("FORBIDDEN");
  });

  test("MECHANIC de orden ajena recibe 403", async () => {
    const orden = await crearOrden();
    const { token: tokenOtro } = await tokenPara({
      username: "mecanico-dos-otro",
      role: "MECHANIC",
      name: "Mecánico Dos Otro",
    });
    expect(idOtroMecanico).toBeGreaterThan(0);

    const respuesta = await cambiarEstado(orden, "DIAGNOSIS", conToken(tokenOtro));

    expect(respuesta.status).toBe(403);
    expect(respuesta.body.error.code).toBe("FORBIDDEN");
  });

  test("ADMIN puede cambiar el estado de cualquier orden", async () => {
    const orden = await crearOrden();

    const respuesta = await cambiarEstado(orden, "DIAGNOSIS", conToken(tokenAdmin));

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.order.status).toBe("DIAGNOSIS");
  });
});
