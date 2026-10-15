import request from "supertest";
import { app } from "../../app.js";
import { pool } from "../../config/db.js";
import * as clientes from "../../models/client.model.js";
import * as vehiculos from "../../models/vehicle.model.js";
import { crearPoolDePrueba, aplicarMigraciones, limpiarBaseDePrueba } from "../helpers/db.js";
import { tokenPara, conToken, crearUsuarioPrueba } from "../helpers/usuarios.js";

// T038: vinculación orden ↔ cliente/vehículo (US3, VS-01/VA-03, RN-2).
let poolPrueba;
let headers;

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
  const { token } = await tokenPara({
    username: "recepcion",
    role: "RECEPTIONIST",
    name: "Recepción",
  });
  headers = conToken(token);
});

async function crearBase({
  nombre = "Juan Pérez",
  phone = "5512345678",
  email = "juan@correo.mx",
  placas = "ABC1234",
  usernameMecanico = "mecanico",
} = {}) {
  const cliente = await clientes.crear({ name: nombre, phone, email });
  const vehiculo = await vehiculos.crear({
    clientId: cliente.id,
    brand: "Toyota",
    model: "Corolla",
    year: 2020,
    licensePlate: placas,
    vin: null,
    currentMileage: 85000,
  });
  const mecanico = await crearUsuarioPrueba({
    username: usernameMecanico,
    role: "MECHANIC",
    name: "Mecánico Demo",
  });
  return { cliente, vehiculo, mecanico };
}

async function crearOrden(base, extras = {}) {
  const respuesta = await request(app)
    .post("/api/service-orders")
    .set(headers)
    .send({
      clientId: base.cliente.id,
      vehicleId: base.vehiculo.id,
      mechanicId: base.mecanico.id,
      ...ORDEN,
      ...extras,
    });
  return respuesta;
}

describe("Vinculación cliente–vehículo (VS-01, VA-03)", () => {
  test("rechaza un vehículo que no pertenece al cliente (400 VEHICLE_CLIENT_MISMATCH)", async () => {
    const base = await crearBase();
    const otro = await crearBase({
      nombre: "María López",
      phone: "5523456789",
      email: "maria@correo.mx",
      placas: "XYZ9876",
      usernameMecanico: "mecanico2",
    });

    const respuesta = await request(app)
      .post("/api/service-orders")
      .set(headers)
      .send({
        clientId: base.cliente.id,
        vehicleId: otro.vehiculo.id,
        mechanicId: base.mecanico.id,
        ...ORDEN,
      });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe("VEHICLE_CLIENT_MISMATCH");
    expect(respuesta.body.error.message).toBe(
      "El vehículo seleccionado no pertenece al cliente indicado.",
    );

    // La orden rechazada no deja registro (RN-2 sin registro).
    const listado = await request(app)
      .get("/api/service-orders")
      .set(headers);
    expect(listado.body.data.total).toBe(0);
  });

  test("sin clientId responde 400 CLIENT_REQUIRED", async () => {
    const base = await crearBase();

    const respuesta = await request(app)
      .post("/api/service-orders")
      .set(headers)
      .send({
        vehicleId: base.vehiculo.id,
        mechanicId: base.mecanico.id,
        ...ORDEN,
      });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe("CLIENT_REQUIRED");
    expect(respuesta.body.error.message).toBe(
      "La orden debe tener un cliente.",
    );
  });

  test("con ?vehicleId= solo devuelve las órdenes de ese vehículo", async () => {
    const base = await crearBase();
    const primera = await crearOrden(base);
    expect(primera.status).toBe(201);

    const otro = await crearBase({
      nombre: "María López",
      phone: "5523456789",
      email: "maria@correo.mx",
      placas: "XYZ9876",
      usernameMecanico: "mecanico2",
    });
    const ajena = await crearOrden(otro);
    expect(ajena.status).toBe(201);

    const porVehiculo = await request(app)
      .get("/api/service-orders")
      .query({ vehicleId: base.vehiculo.id })
      .set(headers);
    expect(porVehiculo.status).toBe(200);
    expect(porVehiculo.body.data.total).toBe(1);
    expect(porVehiculo.body.data.orders[0].id).toBe(
      primera.body.data.order.id,
    );
    expect(porVehiculo.body.data.orders[0].vehicleId).toBe(base.vehiculo.id);

    const inexistente = await request(app)
      .get("/api/service-orders")
      .query({ vehicleId: 99999 })
      .set(headers);
    expect(inexistente.body.data.total).toBe(0);
    expect(inexistente.body.data.orders).toEqual([]);
  });
});
