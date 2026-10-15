import request from "supertest";
import { app } from "../../app.js";
import { pool } from "../../config/db.js";
import * as clientes from "../../models/client.model.js";
import * as vehiculos from "../../models/vehicle.model.js";
import { crearPoolDePrueba, aplicarMigraciones, limpiarBaseDePrueba } from "../helpers/db.js";
import { tokenPara, conToken, crearUsuarioPrueba } from "../helpers/usuarios.js";

// T024: contrato de /api/service-orders contra contracts/service-orders.md.
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

async function crearBase() {
  const cliente = await clientes.crear({
    name: "Juan Pérez",
    phone: "5512345678",
    email: "juan@correo.mx",
  });
  const vehiculo = await vehiculos.crear({
    clientId: cliente.id,
    brand: "Toyota",
    model: "Corolla",
    year: 2020,
    licensePlate: "ABC1234",
    vin: null,
    currentMileage: 85000,
  });
  const mecanico = await crearUsuarioPrueba({
    username: "mecanico",
    role: "MECHANIC",
    name: "Mecánico Demo",
  });
  return { cliente, vehiculo, mecanico };
}

async function crearOrden(base) {
  const respuesta = await request(app)
    .post("/api/service-orders")
    .set(headers)
    .send({
      clientId: base.cliente.id,
      vehicleId: base.vehiculo.id,
      mechanicId: base.mecanico.id,
      ...ORDEN,
    });
  return respuesta.body.data.order;
}

describe("Permisos de /api/service-orders (CA-7)", () => {
  test("MECHANIC recibe 403 FORBIDDEN en POST y PATCH", async () => {
    const base = await crearBase();
    const orden = await crearOrden(base);
    const { token: tokenMecanico } = await tokenPara({
      username: "mecanico-que-escribe",
      role: "MECHANIC",
      name: "Mecánico",
    });
    const headersMecanico = conToken(tokenMecanico);

    const post = await request(app)
      .post("/api/service-orders")
      .set(headersMecanico)
      .send({
        clientId: base.cliente.id,
        vehicleId: base.vehiculo.id,
        mechanicId: base.mecanico.id,
        ...ORDEN,
      });
    expect(post.status).toBe(403);
    expect(post.body.error.code).toBe("FORBIDDEN");

    const patch = await request(app)
      .patch(`/api/service-orders/${orden.id}`)
      .set(headersMecanico)
      .send({ reportedProblem: "Intento de mecánico" });
    expect(patch.status).toBe(403);
    expect(patch.body.error.code).toBe("FORBIDDEN");
  });

  test("sin token responde 401 UNAUTHORIZED", async () => {
    const respuesta = await request(app).get("/api/service-orders");

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error.code).toBe("UNAUTHORIZED");
  });
});

describe("Formato de respuesta (sobre JSON)", () => {
  test("GET responde {ok:true,data:{orders,total}} con el objeto resumen", async () => {
    const base = await crearBase();
    await crearOrden(base);

    const respuesta = await request(app)
      .get("/api/service-orders")
      .set(headers);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.ok).toBe(true);
    expect(respuesta.body.data.total).toBe(1);
    expect(respuesta.body.data.orders).toEqual([
      {
        id: expect.any(Number),
        clientId: base.cliente.id,
        clientName: "Juan Pérez",
        vehicleId: base.vehiculo.id,
        vehicleLabel: "Toyota Corolla ABC1234",
        mechanicId: base.mecanico.id,
        mechanicName: "Mecánico Demo",
        status: "RECEIVED",
        entryMileage: 86000,
        reportedProblem: "Ruido al frenar",
        createdAt: expect.stringMatching(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/,
        ),
        updatedAt: expect.stringMatching(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/,
        ),
      },
    ]);
  });

  test("POST 201 devuelve la orden con estado RECEIVED", async () => {
    const base = await crearBase();

    const respuesta = await request(app)
      .post("/api/service-orders")
      .set(headers)
      .send({
        clientId: base.cliente.id,
        vehicleId: base.vehiculo.id,
        mechanicId: base.mecanico.id,
        ...ORDEN,
      });

    expect(respuesta.status).toBe(201);
    const orden = respuesta.body.data.order;
    expect(orden.id).toEqual(expect.any(Number));
    expect(orden.clientName).toBe("Juan Pérez");
    expect(orden.vehicleLabel).toBe("Toyota Corolla ABC1234");
    expect(orden.mechanicName).toBe("Mecánico Demo");
    expect(orden.status).toBe("RECEIVED");
    expect(orden.entryMileage).toBe(86000);
    expect(orden.reportedProblem).toBe("Ruido al frenar");
    expect(orden.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
  });

  test("GET /{id} devuelve data.order con detalle y arreglos (CA-4)", async () => {
    const base = await crearBase();
    const orden = await crearOrden(base);

    const respuesta = await request(app)
      .get(`/api/service-orders/${orden.id}`)
      .set(headers);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.order.id).toBe(orden.id);
    expect(respuesta.body.data.order.diagnosis).toBeNull();
    expect(respuesta.body.data.order.observations).toBeNull();
    expect(respuesta.body.data.order.recommendations).toBeNull();
    expect(respuesta.body.data.order.mileageCorrectionReason).toBeNull();
    expect(respuesta.body.data.services).toEqual([]);
    expect(respuesta.body.data.labor).toEqual([]);
  });
});

describe("Códigos de negocio nuevos (contracts/README.md)", () => {
  test("404 SERVICE_ORDER_NOT_FOUND con mensaje en español", async () => {
    const respuesta = await request(app)
      .get("/api/service-orders/99999")
      .set(headers);

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.code).toBe("SERVICE_ORDER_NOT_FOUND");
    expect(respuesta.body.error.message).toBe(
      "La orden de servicio solicitada no existe.",
    );
  });

  test("400 VEHICLE_REQUIRED sin vehicleId", async () => {
    const base = await crearBase();

    const respuesta = await request(app)
      .post("/api/service-orders")
      .set(headers)
      .send({
        clientId: base.cliente.id,
        mechanicId: base.mecanico.id,
        ...ORDEN,
      });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe("VEHICLE_REQUIRED");
    expect(respuesta.body.error.message).toBe(
      "Debes seleccionar un vehículo.",
    );
  });

  test("400 MECHANIC_REQUIRED sin mechanicId", async () => {
    const base = await crearBase();

    const respuesta = await request(app)
      .post("/api/service-orders")
      .set(headers)
      .send({
        clientId: base.cliente.id,
        vehicleId: base.vehiculo.id,
        ...ORDEN,
      });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe("MECHANIC_REQUIRED");
    expect(respuesta.body.error.message).toBe(
      "Debes asignar un mecánico a la orden.",
    );
  });

  test("404 MECHANIC_NOT_FOUND con mensaje en español", async () => {
    const base = await crearBase();

    const respuesta = await request(app)
      .post("/api/service-orders")
      .set(headers)
      .send({
        clientId: base.cliente.id,
        vehicleId: base.vehiculo.id,
        mechanicId: 99999,
        ...ORDEN,
      });

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.code).toBe("MECHANIC_NOT_FOUND");
    expect(respuesta.body.error.message).toBe(
      "El mecánico indicado no existe.",
    );
  });

  test("400 INVALID_MECHANIC con mensaje en español", async () => {
    const base = await crearBase();
    const administrador = await crearUsuarioPrueba({
      username: "otro-admin",
      role: "ADMIN",
      name: "Otro Admin",
    });

    const respuesta = await request(app)
      .post("/api/service-orders")
      .set(headers)
      .send({
        clientId: base.cliente.id,
        vehicleId: base.vehiculo.id,
        mechanicId: administrador.id,
        ...ORDEN,
      });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe("INVALID_MECHANIC");
    expect(respuesta.body.error.message).toBe(
      "El usuario indicado no es un mecánico activo.",
    );
  });

  test("400 MILEAGE_LOWER_THAN_PREVIOUS con mensaje en español", async () => {
    const base = await crearBase();

    const respuesta = await request(app)
      .post("/api/service-orders")
      .set(headers)
      .send({
        clientId: base.cliente.id,
        vehicleId: base.vehiculo.id,
        mechanicId: base.mecanico.id,
        entryMileage: 80000,
        reportedProblem: "Ruido al frenar",
      });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe("MILEAGE_LOWER_THAN_PREVIOUS");
    expect(respuesta.body.error.message).toBe(
      "El kilometraje de entrada no puede ser menor que el registrado previamente.",
    );
  });
});

describe("Listado de mecánicos para asignar (GET /mechanics)", () => {
  test("ADMIN y RECEPTIONIST reciben los mecánicos activos", async () => {
    await crearUsuarioPrueba({
      username: "mecanico-a",
      role: "MECHANIC",
      name: "Ana Mecánica",
    });
    await crearUsuarioPrueba({
      username: "mecanico-b",
      role: "MECHANIC",
      name: "Bruno Mecánico",
    });
    await crearUsuarioPrueba({
      username: "mecanico-inactivo",
      role: "MECHANIC",
      name: "Inactivo",
      active: 0,
    });

    const { token: tokenAdmin } = await tokenPara({
      username: "admin",
      role: "ADMIN",
      name: "Administración",
    });

    const comoAdmin = await request(app)
      .get("/api/service-orders/mechanics")
      .set(conToken(tokenAdmin));
    expect(comoAdmin.status).toBe(200);
    expect(comoAdmin.body.data.mechanics).toHaveLength(2);
    expect(comoAdmin.body.data.mechanics[0]).toEqual({
      id: expect.any(Number),
      name: "Ana Mecánica",
      username: "mecanico-a",
    });

    const comoRecepcion = await request(app)
      .get("/api/service-orders/mechanics")
      .set(headers);
    expect(comoRecepcion.status).toBe(200);
    expect(comoRecepcion.body.data.mechanics).toHaveLength(2);
  });

  test("MECHANIC recibe 403 en /mechanics", async () => {
    const { token: tokenMecanico } = await tokenPara({
      username: "mecanico",
      role: "MECHANIC",
      name: "Mecánico",
    });

    const respuesta = await request(app)
      .get("/api/service-orders/mechanics")
      .set(conToken(tokenMecanico));

    expect(respuesta.status).toBe(403);
    expect(respuesta.body.error.code).toBe("FORBIDDEN");
  });
});
