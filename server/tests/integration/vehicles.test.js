import request from "supertest";
import { app } from "../../app.js";
import { pool } from "../../config/db.js";
import * as clientes from "../../models/client.model.js";
import * as vehiculos from "../../models/vehicle.model.js";
import { crearPoolDePrueba, aplicarMigraciones, limpiarBaseDePrueba } from "../helpers/db.js";
import { tokenPara, conToken } from "../helpers/usuarios.js";

// T043: registro de vehículos con permisos por rol y visibilidad
// desde la ficha del cliente (CA-4).
let poolPrueba;

const NUEVO_VEHICULO = {
  brand: "Toyota",
  model: "Corolla",
  year: 2020,
  licensePlate: "ABC1234",
  vin: null,
  currentMileage: 85000,
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
});

describe("Permisos por rol en /api/vehicles", () => {
  test("MECHANIC puede leer pero no escribir (403 en POST y PATCH)", async () => {
    const cliente = await clientes.crear({
      name: "Juan Pérez",
      phone: "5512345678",
      email: "juan@correo.mx",
    });
    const vehiculo = await vehiculos.crear({
      clientId: cliente.id,
      ...NUEVO_VEHICULO,
    });
    const { token } = await tokenPara({
      username: "mecanico",
      role: "MECHANIC",
      name: "Mecánico",
    });
    const headers = conToken(token);

    const lista = await request(app).get("/api/vehicles").set(headers);
    expect(lista.status).toBe(200);

    const detalle = await request(app)
      .get(`/api/vehicles/${vehiculo.id}`)
      .set(headers);
    expect(detalle.status).toBe(200);

    const post = await request(app)
      .post("/api/vehicles")
      .set(headers)
      .send({ ...NUEVO_VEHICULO, clientId: cliente.id });
    expect(post.status).toBe(403);
    expect(post.body.error.code).toBe("FORBIDDEN");

    const patch = await request(app)
      .patch(`/api/vehicles/${vehiculo.id}`)
      .set(headers)
      .send({ currentMileage: 1 });
    expect(patch.status).toBe(403);
  });

  test("RECEPTIONIST registra vehículos (201)", async () => {
    const cliente = await clientes.crear({
      name: "Ana Torres",
      phone: "5577889900",
      email: "ana@correo.mx",
    });
    const { token } = await tokenPara({
      username: "recepcion",
      role: "RECEPTIONIST",
      name: "Recepción",
    });

    const post = await request(app)
      .post("/api/vehicles")
      .set(conToken(token))
      .send({ ...NUEVO_VEHICULO, clientId: cliente.id });

    expect(post.status).toBe(201);
    expect(post.body.data.vehicle.clientName).toBe("Ana Torres");
  });

  test("sin token la lista responde 401 UNAUTHORIZED", async () => {
    const respuesta = await request(app).get("/api/vehicles");

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error.code).toBe("UNAUTHORIZED");
  });
});

describe("El vehículo aparece en la ficha del cliente (CA-4)", () => {
  test("GET /api/clients/:id lista los vehículos del cliente", async () => {
    const cliente = await clientes.crear({
      name: "Juan Pérez",
      phone: "5512345678",
      email: "juan@correo.mx",
    });
    await vehiculos.crear({ clientId: cliente.id, ...NUEVO_VEHICULO });
    await vehiculos.crear({
      clientId: cliente.id,
      brand: "Nissan",
      model: "Versa",
      year: 2019,
      licensePlate: "DEF5678",
      vin: null,
      currentMileage: 120500,
    });
    const { token } = await tokenPara({
      username: "recepcion",
      role: "RECEPTIONIST",
      name: "Recepción",
    });

    const respuesta = await request(app)
      .get(`/api/clients/${cliente.id}`)
      .set(conToken(token));

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.vehicles).toHaveLength(2);
    expect(respuesta.body.data.vehicles.map((v) => v.licensePlate).sort()).toEqual(
      ["ABC1234", "DEF5678"],
    );
    expect(respuesta.body.data.vehicles[0]).not.toHaveProperty("clientName");
  });

  test("el listado de clientes cuenta los vehículos (vehicleCount)", async () => {
    const cliente = await clientes.crear({
      name: "Juan Pérez",
      phone: "5512345678",
      email: "juan@correo.mx",
    });
    await vehiculos.crear({ clientId: cliente.id, ...NUEVO_VEHICULO });
    const { token } = await tokenPara({
      username: "recepcion",
      role: "RECEPTIONIST",
      name: "Recepción",
    });

    const respuesta = await request(app)
      .get("/api/clients")
      .set(conToken(token));

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.clients[0].vehicleCount).toBe(1);
  });
});
