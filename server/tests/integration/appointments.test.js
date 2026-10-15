import request from "supertest";
import { app } from "../../app.js";
import { pool } from "../../config/db.js";
import * as clientes from "../../models/client.model.js";
import * as vehiculos from "../../models/vehicle.model.js";
import { crearPoolDePrueba, aplicarMigraciones, limpiarBaseDePrueba } from "../helpers/db.js";
import { tokenPara, conToken } from "../helpers/usuarios.js";

// T007: alta, consulta, edición y cancelación de citas (US1, VA-01 a VA-05).
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
  // El token se emite DESPUÉS de limpiar: authenticate revalida el usuario.
  const { token } = await tokenPara({
    username: "recepcion",
    role: "RECEPTIONIST",
    name: "Recepción",
  });
  headers = conToken(token);
});

/** Crea un cliente con su vehículo de prueba. */
async function crearClienteYVehiculo({
  nombre = "Juan Pérez",
  phone = "5512345678",
  email = "juan@correo.mx",
  placas = "ABC1234",
} = {}) {
  const cliente = await clientes.crear({ name: nombre, phone, email });
  const vehiculo = await vehiculos.crear({
    clientId: cliente.id,
    brand: "Toyota",
    model: "Corolla",
    year: 2020,
    licensePlate: placas,
    vin: null,
    currentMileage: 50000,
  });
  return { cliente, vehiculo };
}

describe("Alta de citas (VA-01 a VA-03)", () => {
  test("crea una cita con cliente y vehículo válidos en estado PENDING (201)", async () => {
    const { cliente, vehiculo } = await crearClienteYVehiculo();

    const respuesta = await request(app)
      .post("/api/appointments")
      .set(headers)
      .send({ ...CITA, clientId: cliente.id, vehicleId: vehiculo.id });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data.appointment.status).toBe("PENDING");
    expect(respuesta.body.data.appointment.clientId).toBe(cliente.id);
    expect(respuesta.body.data.appointment.vehicleId).toBe(vehiculo.id);
    expect(respuesta.body.data.appointment.date).toBe("2026-10-20");
    expect(respuesta.body.data.appointment.time).toBe("09:30");
  });

  test("responde 400 VALIDATION_ERROR con datos vacíos", async () => {
    const respuesta = await request(app)
      .post("/api/appointments")
      .set(headers)
      .send({});

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe("VALIDATION_ERROR");
    const campos = respuesta.body.error.details.map((detalle) => detalle.field);
    expect(campos).toEqual(expect.arrayContaining(["date", "time", "reason"]));
    expect(respuesta.body.error.details[0].message).toMatch(/\w/);
  });

  test("responde 400 CLIENT_REQUIRED y 400 VEHICLE_REQUIRED sin referencias", async () => {
    const { cliente, vehiculo } = await crearClienteYVehiculo();

    const sinCliente = await request(app)
      .post("/api/appointments")
      .set(headers)
      .send({ ...CITA, vehicleId: vehiculo.id });
    expect(sinCliente.status).toBe(400);
    expect(sinCliente.body.error.code).toBe("CLIENT_REQUIRED");

    const sinVehiculo = await request(app)
      .post("/api/appointments")
      .set(headers)
      .send({ ...CITA, clientId: cliente.id });
    expect(sinVehiculo.status).toBe(400);
    expect(sinVehiculo.body.error.code).toBe("VEHICLE_REQUIRED");
  });

  test("responde 404 con referencias inexistentes sin crear la cita", async () => {
    const { cliente, vehiculo } = await crearClienteYVehiculo();

    const clienteFalso = await request(app)
      .post("/api/appointments")
      .set(headers)
      .send({ ...CITA, clientId: 99999, vehicleId: vehiculo.id });
    expect(clienteFalso.status).toBe(404);
    expect(clienteFalso.body.error.code).toBe("CLIENT_NOT_FOUND");

    const vehiculoFalso = await request(app)
      .post("/api/appointments")
      .set(headers)
      .send({ ...CITA, clientId: cliente.id, vehicleId: 99999 });
    expect(vehiculoFalso.status).toBe(404);
    expect(vehiculoFalso.body.error.code).toBe("VEHICLE_NOT_FOUND");

    const listado = await request(app).get("/api/appointments").set(headers);
    expect(listado.body.data.total).toBe(0);
  });

  test("rechaza un vehículo que no pertenece al cliente (VA-03)", async () => {
    const { cliente } = await crearClienteYVehiculo();
    const otro = await crearClienteYVehiculo({
      nombre: "María López",
      phone: "5523456789",
      email: "maria@correo.mx",
      placas: "XYZ9876",
    });

    const respuesta = await request(app)
      .post("/api/appointments")
      .set(headers)
      .send({ ...CITA, clientId: cliente.id, vehicleId: otro.vehiculo.id });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe("VEHICLE_CLIENT_MISMATCH");
  });
});

describe("Consulta de la agenda", () => {
  test("filtra por fecha, estado y texto (cliente o placas)", async () => {
    const uno = await crearClienteYVehiculo();
    await request(app)
      .post("/api/appointments")
      .set(headers)
      .send({ ...CITA, clientId: uno.cliente.id, vehicleId: uno.vehiculo.id });

    const dos = await crearClienteYVehiculo({
      nombre: "Luis Mendoza",
      phone: "5533445566",
      email: "luis@correo.mx",
      placas: "XYZ9876",
    });
    await request(app)
      .post("/api/appointments")
      .set(headers)
      .send({
        ...CITA,
        date: "2026-10-21",
        time: "11:00",
        reason: "Alineación",
        clientId: dos.cliente.id,
        vehicleId: dos.vehiculo.id,
      });

    const porFecha = await request(app)
      .get("/api/appointments")
      .query({ date: "2026-10-20" })
      .set(headers);
    expect(porFecha.status).toBe(200);
    expect(porFecha.body.data.total).toBe(1);
    expect(porFecha.body.data.appointments[0].date).toBe("2026-10-20");

    const porEstado = await request(app)
      .get("/api/appointments")
      .query({ status: "PENDING" })
      .set(headers);
    expect(porEstado.body.data.total).toBe(2);

    const porCliente = await request(app)
      .get("/api/appointments")
      .query({ q: "Luis" })
      .set(headers);
    expect(porCliente.body.data.total).toBe(1);

    const porPlacas = await request(app)
      .get("/api/appointments")
      .query({ q: "ABC1234" })
      .set(headers);
    expect(porPlacas.body.data.total).toBe(1);

    const sinResultados = await request(app)
      .get("/api/appointments")
      .query({ q: "no-existe" })
      .set(headers);
    expect(sinResultados.body.data.total).toBe(0);
    expect(sinResultados.body.data.appointments).toEqual([]);
  });

  test("devuelve 404 APPOINTMENT_NOT_FOUND con id inexistente", async () => {
    const sinToken = await request(app).get("/api/appointments/99999").set(headers);

    expect(sinToken.status).toBe(404);
    expect(sinToken.body.error.code).toBe("APPOINTMENT_NOT_FOUND");
  });
});

describe("Edición y cancelación (VA-04, VA-05)", () => {
  async function crearCita() {
    const { cliente, vehiculo } = await crearClienteYVehiculo();
    const respuesta = await request(app)
      .post("/api/appointments")
      .set(headers)
      .send({ ...CITA, clientId: cliente.id, vehicleId: vehiculo.id });
    return respuesta.body.data.appointment;
  }

  test("edita fecha, hora y motivo de una cita activa (200)", async () => {
    const cita = await crearCita();

    const respuesta = await request(app)
      .patch(`/api/appointments/${cita.id}`)
      .set(headers)
      .send({ date: "2026-10-22", time: "15:45", reason: "Cambio de aceite" });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.appointment.id).toBe(cita.id);
    expect(respuesta.body.data.appointment.date).toBe("2026-10-22");
    expect(respuesta.body.data.appointment.time).toBe("15:45");
    expect(respuesta.body.data.appointment.reason).toBe("Cambio de aceite");
  });

  test("la cancelación confirmada deja la cita en CANCELED", async () => {
    const cita = await crearCita();

    const respuesta = await request(app)
      .patch(`/api/appointments/${cita.id}`)
      .set(headers)
      .send({ status: "CANCELED" });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.appointment.status).toBe("CANCELED");
  });

  test("rechaza una transición inválida con INVALID_STATUS_TRANSITION", async () => {
    const cita = await crearCita();

    const respuesta = await request(app)
      .patch(`/api/appointments/${cita.id}`)
      .set(headers)
      .send({ status: "COMPLETED" });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe("INVALID_STATUS_TRANSITION");
    expect(respuesta.body.error.message).toMatch(/Pendiente|Completada/);
  });

  test("una cita completada responde 400 APPOINTMENT_CLOSED al editarla", async () => {
    const cita = await crearCita();
    for (const status of ["CONFIRMED", "IN_PROGRESS", "COMPLETED"]) {
      const avance = await request(app)
        .patch(`/api/appointments/${cita.id}`)
        .set(headers)
        .send({ status });
      expect(avance.status).toBe(200);
    }

    const edicion = await request(app)
      .patch(`/api/appointments/${cita.id}`)
      .set(headers)
      .send({ reason: "Ya no hace falta" });
    expect(edicion.status).toBe(400);
    expect(edicion.body.error.code).toBe("APPOINTMENT_CLOSED");

    const reactivacion = await request(app)
      .patch(`/api/appointments/${cita.id}`)
      .set(headers)
      .send({ status: "PENDING" });
    expect(reactivacion.status).toBe(400);
    expect(reactivacion.body.error.code).toBe("APPOINTMENT_CLOSED");
  });

  test("responde 400 VALIDATION_ERROR si no se envía ningún campo", async () => {
    const cita = await crearCita();

    const respuesta = await request(app)
      .patch(`/api/appointments/${cita.id}`)
      .set(headers)
      .send({});

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe("VALIDATION_ERROR");
  });
});
