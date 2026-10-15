import request from "supertest";
import { app } from "../../app.js";
import { pool } from "../../config/db.js";
import * as clientes from "../../models/client.model.js";
import * as vehiculos from "../../models/vehicle.model.js";
import { crearPoolDePrueba, aplicarMigraciones, limpiarBaseDePrueba } from "../helpers/db.js";
import { tokenPara, conToken, crearUsuarioPrueba } from "../helpers/usuarios.js";

// T039: contrato del filtro ?vehicleId= y VEHICLE_CLIENT_MISMATCH (US3).
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

async function crearOrden(base, kilometraje = ORDEN.entryMileage) {
  return request(app)
    .post("/api/service-orders")
    .set(headers)
    .send({
      clientId: base.cliente.id,
      vehicleId: base.vehiculo.id,
      mechanicId: base.mecanico.id,
      ...ORDEN,
      entryMileage: kilometraje,
    });
}

describe("GET /api/service-orders?vehicleId= (contrato US3)", () => {
  test("responde con sobre, paginación y solo las órdenes del vehículo", async () => {
    const base = await crearBase();
    await crearOrden(base, 86000);
    await crearOrden(base, 86500);
    const otro = await crearBase({
      nombre: "María López",
      phone: "5523456789",
      email: "maria@correo.mx",
      placas: "XYZ9876",
      usernameMecanico: "mecanico2",
    });
    await crearOrden(otro, 30000);

    const respuesta = await request(app)
      .get("/api/service-orders")
      .query({ vehicleId: base.vehiculo.id, limit: 1 })
      .set(headers);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.ok).toBe(true);
    expect(respuesta.body.data.total).toBe(2);
    expect(respuesta.body.data.orders).toHaveLength(1);
    expect(respuesta.body.data.orders[0]).toEqual({
      id: expect.any(Number),
      clientId: base.cliente.id,
      clientName: "Juan Pérez",
      vehicleId: base.vehiculo.id,
      vehicleLabel: "Toyota Corolla ABC1234",
      mechanicId: base.mecanico.id,
      mechanicName: "Mecánico Demo",
      status: "RECEIVED",
      entryMileage: expect.any(Number),
      reportedProblem: "Ruido al frenar",
      createdAt: expect.stringMatching(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/,
      ),
      updatedAt: expect.stringMatching(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/,
      ),
    });
  });

  test("400 VEHICLE_CLIENT_MISMATCH con error.message en español", async () => {
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
  });
});
