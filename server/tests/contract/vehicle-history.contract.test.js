import request from "supertest";
import { app } from "../../app.js";
import { pool } from "../../config/db.js";
import * as clientes from "../../models/client.model.js";
import * as vehiculos from "../../models/vehicle.model.js";
import * as ordenes from "../../models/service_order.model.js";
import { crearPoolDePrueba, aplicarMigraciones, limpiarBaseDePrueba } from "../helpers/db.js";
import { tokenPara, conToken } from "../helpers/usuarios.js";

// T009: contrato de GET /api/vehicles/{id}/history contra
// specs/003-historial-mantenimiento-inventario/contracts/vehicle-history.md.
let poolPrueba;
let headersMecanico;
let headersRecepcion;
let idMecanico;
let idCliente;
let idVehiculo;

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

  const mec = await tokenPara({ username: "mecanico", role: "MECHANIC", name: "Mecánico Uno" });
  headersMecanico = conToken(mec.token);
  idMecanico = mec.usuario.id;

  const recepcion = await tokenPara({
    username: "recepcion",
    role: "RECEPTIONIST",
    name: "Recepción",
  });
  headersRecepcion = conToken(recepcion.token);

  const cliente = await clientes.crear({
    name: "Juan Pérez",
    phone: "5512345678",
    email: "juan@correo.mx",
  });
  idCliente = cliente.id;

  const vehiculo = await vehiculos.crear({
    clientId: idCliente,
    brand: "Toyota",
    model: "Corolla",
    year: 2020,
    licensePlate: "ABC1234",
    vin: null,
    currentMileage: 48500,
  });
  idVehiculo = vehiculo.id;
});

async function crearOrdenTerminada(entryMileage = 46000) {
  const orden = await ordenes.insertar({
    clientId: idCliente,
    vehicleId: idVehiculo,
    mechanicId: idMecanico,
    entryMileage,
    reportedProblem: "Ruido al frenar",
  });
  await pool.query(
    "UPDATE service_orders SET status = 'FINISHED', created_at = '2026-09-01 10:00:00' WHERE id = ?",
    [orden.id],
  );
  return orden;
}

describe("Contrato de GET /api/vehicles/{id}/history", () => {
  test("responde sobre {ok,data} con vehicle y entries completos (200)", async () => {
    const orden = await crearOrdenTerminada();

    const respuesta = await request(app)
      .get(`/api/vehicles/${idVehiculo}/history`)
      .set(headersMecanico);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.ok).toBe(true);

    const { vehicle, entries } = respuesta.body.data;
    expect(vehicle).toMatchObject({
      id: idVehiculo,
      label: "Toyota Corolla ABC1234",
      clientName: "Juan Pérez",
      currentMileage: 48500,
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      orderId: orden.id,
      date: "2026-09-01",
      status: "FINISHED",
      entryMileage: 46000,
      reportedProblem: "Ruido al frenar",
    });
    expect(entries[0]).toHaveProperty("diagnosis");
    expect(entries[0]).toHaveProperty("services");
    expect(entries[0]).toHaveProperty("labor");
    expect(entries[0]).toHaveProperty("parts");
    expect(entries[0]).toHaveProperty("observations");
    expect(entries[0]).toHaveProperty("recommendations");
    expect(entries[0]).toHaveProperty("mechanicName");
  });

  test("con services terminados devuelve entries vacío como arreglo []", async () => {
    await crearOrdenTerminada(); // orden en RECEIVED (sin estado actualizado)
    await pool.query("UPDATE service_orders SET status = 'RECEIVED'");

    const respuesta = await request(app)
      .get(`/api/vehicles/${idVehiculo}/history`)
      .set(headersMecanico);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.entries).toEqual([]);
  });

  test("vehículo inexistente responde {ok:false,error} con VEHICLE_NOT_FOUND (404)", async () => {
    const respuesta = await request(app)
      .get("/api/vehicles/424242/history")
      .set(headersMecanico);

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.ok).toBe(false);
    expect(respuesta.body.error.code).toBe("VEHICLE_NOT_FOUND");
    expect(typeof respuesta.body.error.message).toBe("string");
  });

  test("RECEPTIONIST responde {ok:false,error} con FORBIDDEN (403)", async () => {
    const respuesta = await request(app)
      .get(`/api/vehicles/${idVehiculo}/history`)
      .set(headersRecepcion);

    expect(respuesta.status).toBe(403);
    expect(respuesta.body.ok).toBe(false);
    expect(respuesta.body.error.code).toBe("FORBIDDEN");
  });

  test("sin token responde 401 UNAUTHORIZED (convención compartida)", async () => {
    const respuesta = await request(app).get(`/api/vehicles/${idVehiculo}/history`);

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error.code).toBe("UNAUTHORIZED");
  });
});
