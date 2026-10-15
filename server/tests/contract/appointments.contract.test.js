import request from "supertest";
import { app } from "../../app.js";
import { pool } from "../../config/db.js";
import * as clientes from "../../models/client.model.js";
import * as vehiculos from "../../models/vehicle.model.js";
import { crearPoolDePrueba, aplicarMigraciones, limpiarBaseDePrueba } from "../helpers/db.js";
import { tokenPara, conToken } from "../helpers/usuarios.js";

// T008: contrato de /api/appointments contra contracts/appointments.md.
let poolPrueba;
let headers;

const CITA = {
  date: "2026-10-20",
  time: "09:30",
  reason: "Servicio de 10,000 km",
  notes: "Llega puntual",
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

async function crearClienteYVehiculo() {
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
    currentMileage: 50000,
  });
  return { cliente, vehiculo };
}

async function crearCita() {
  const { cliente, vehiculo } = await crearClienteYVehiculo();
  const respuesta = await request(app)
    .post("/api/appointments")
    .set(headers)
    .send({ ...CITA, clientId: cliente.id, vehicleId: vehiculo.id });
  return respuesta.body.data.appointment;
}

describe("Permisos de /api/appointments (CA-7)", () => {
  test("MECHANIC recibe 403 FORBIDDEN en GET, POST y PATCH", async () => {
    const { token: tokenMecanico } = await tokenPara({
      username: "mecanico",
      role: "MECHANIC",
      name: "Mecánico",
    });
    const headersMecanico = conToken(tokenMecanico);
    const cita = await crearCita();

    const lista = await request(app).get("/api/appointments").set(headersMecanico);
    expect(lista.status).toBe(403);
    expect(lista.body.error.code).toBe("FORBIDDEN");

    const detalle = await request(app)
      .get(`/api/appointments/${cita.id}`)
      .set(headersMecanico);
    expect(detalle.status).toBe(403);

    const post = await request(app)
      .post("/api/appointments")
      .set(headersMecanico)
      .send(CITA);
    expect(post.status).toBe(403);

    const patch = await request(app)
      .patch(`/api/appointments/${cita.id}`)
      .set(headersMecanico)
      .send({ status: "CANCELED" });
    expect(patch.status).toBe(403);
    expect(patch.body.error.code).toBe("FORBIDDEN");
  });

  test("sin token responde 401 UNAUTHORIZED", async () => {
    const respuesta = await request(app).get("/api/appointments");

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error.code).toBe("UNAUTHORIZED");
  });
});

describe("Formato de respuesta (sobre JSON)", () => {
  test("GET responde {ok:true,data:{appointments,total}}", async () => {
    await crearCita();

    const respuesta = await request(app).get("/api/appointments").set(headers);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.ok).toBe(true);
    expect(respuesta.body.data.total).toBe(1);
    expect(respuesta.body.data.appointments).toHaveLength(1);
  });

  test("POST 201 devuelve el objeto cita completo del contrato", async () => {
    const { cliente, vehiculo } = await crearClienteYVehiculo();

    const respuesta = await request(app)
      .post("/api/appointments")
      .set(headers)
      .send({ ...CITA, clientId: cliente.id, vehicleId: vehiculo.id });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data.appointment).toEqual({
      id: expect.any(Number),
      clientId: cliente.id,
      clientName: "Juan Pérez",
      vehicleId: vehiculo.id,
      vehicleLabel: "Toyota Corolla ABC1234",
      date: "2026-10-20",
      time: "09:30",
      reason: "Servicio de 10,000 km",
      notes: "Llega puntual",
      status: "PENDING",
      createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/),
      updatedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/),
    });
  });

  test("GET /{id} responde 200 con data.appointment", async () => {
    const cita = await crearCita();

    const respuesta = await request(app)
      .get(`/api/appointments/${cita.id}`)
      .set(headers);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.appointment.id).toBe(cita.id);
    expect(respuesta.body.data.appointment.vehicleLabel).toBe(
      "Toyota Corolla ABC1234",
    );
  });
});

describe("Códigos de negocio nuevos (contracts/README.md)", () => {
  test("404 APPOINTMENT_NOT_FOUND con mensaje en español", async () => {
    const respuesta = await request(app).get("/api/appointments/99999").set(headers);

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.code).toBe("APPOINTMENT_NOT_FOUND");
    expect(respuesta.body.error.message).toBe("La cita solicitada no existe.");
  });

  test("400 VEHICLE_REQUIRED sin vehicleId", async () => {
    const { cliente } = await crearClienteYVehiculo();

    const respuesta = await request(app)
      .post("/api/appointments")
      .set(headers)
      .send({
        date: CITA.date,
        time: CITA.time,
        reason: CITA.reason,
        clientId: cliente.id,
      });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe("VEHICLE_REQUIRED");
    expect(respuesta.body.error.message).toBe("Debes seleccionar un vehículo.");
  });

  test("400 VEHICLE_CLIENT_MISMATCH con mensaje en español", async () => {
    const { cliente } = await crearClienteYVehiculo();
    const otro = await clientes.crear({
      name: "María López",
      phone: "5523456789",
      email: "maria@correo.mx",
    });
    const vehiculoAjeno = await vehiculos.crear({
      clientId: otro.id,
      brand: "Nissan",
      model: "Versa",
      year: 2021,
      licensePlate: "XYZ9876",
      vin: null,
      currentMileage: 30000,
    });

    const respuesta = await request(app)
      .post("/api/appointments")
      .set(headers)
      .send({ ...CITA, clientId: cliente.id, vehicleId: vehiculoAjeno.id });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe("VEHICLE_CLIENT_MISMATCH");
    expect(respuesta.body.error.message).toBe(
      "El vehículo seleccionado no pertenece al cliente indicado.",
    );
  });

  test("400 INVALID_STATUS_TRANSITION con mensaje en español", async () => {
    const cita = await crearCita();

    const respuesta = await request(app)
      .patch(`/api/appointments/${cita.id}`)
      .set(headers)
      .send({ status: "COMPLETED" });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe("INVALID_STATUS_TRANSITION");
    expect(respuesta.body.error.message).toMatch(/completada/i);
  });

  test("400 APPOINTMENT_CLOSED con mensaje en español", async () => {
    const cita = await crearCita();
    await request(app)
      .patch(`/api/appointments/${cita.id}`)
      .set(headers)
      .send({ status: "CANCELED" });

    const respuesta = await request(app)
      .patch(`/api/appointments/${cita.id}`)
      .set(headers)
      .send({ reason: "Motivo nuevo" });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe("APPOINTMENT_CLOSED");
    expect(respuesta.body.error.message).toBe(
      "La cita ya está completada o cancelada y no se puede modificar.",
    );
  });
});
