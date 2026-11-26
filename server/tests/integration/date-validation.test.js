import request from "supertest";
import { app } from "../../app.js";
import { pool } from "../../config/db.js";
import * as clientes from "../../models/client.model.js";
import * as vehiculos from "../../models/vehicle.model.js";
import { crearPoolDePrueba, aplicarMigraciones, limpiarBaseDePrueba } from "../helpers/db.js";
import { tokenPara, conToken } from "../helpers/usuarios.js";

// Defecto D-02 de la auditoría del MVP: una fecha u hora con buen formato pero
// inexistente («2026-02-31», «25:00») debe responder 400 y no 500.
let poolPrueba;
let headers;
let ids;

beforeAll(async () => {
  poolPrueba = await crearPoolDePrueba();
  await aplicarMigraciones(poolPrueba);
});

afterAll(async () => {
  await poolPrueba.end();
  await pool.end();
});

beforeEach(async () => {
  await limpiarBaseDePrueba(poolPrueba);
  headers = conToken((await tokenPara({ username: "admin", role: "ADMIN" })).token);
  const cliente = await clientes.crear({ name: "Cliente", phone: "5511112222", email: "c@correo.mx" });
  const vehiculo = await vehiculos.crear({
    clientId: cliente.id,
    brand: "Nissan",
    model: "Versa",
    year: 2020,
    licensePlate: "FEC0001",
    vin: null,
    currentMileage: 1000,
  });
  ids = { clientId: cliente.id, vehicleId: vehiculo.id };
});

const crearCita = (cambios) =>
  request(app)
    .post("/api/appointments")
    .set(headers)
    .send({ ...ids, date: "2026-12-15", time: "10:00", reason: "Revisión", ...cambios });

function esperarError(respuesta, campo) {
  expect(respuesta.status).toBe(400);
  expect(respuesta.body.error.code).toBe("VALIDATION_ERROR");
  expect(JSON.stringify(respuesta.body.error)).toContain(`"${campo}"`);
}

describe("Citas con fecha u hora inexistentes (D-02)", () => {
  test.each(["2026-02-31", "2026-02-29", "2026-13-01", "2026-04-31", "2026-00-10", "0000-01-01"])(
    "rechaza la fecha %s con 400",
    async (date) => {
      esperarError(await crearCita({ date }), "date");
    },
  );

  test.each(["24:00", "25:10", "10:60", "99:99"])("rechaza la hora %s con 400", async (time) => {
    esperarError(await crearCita({ time }), "time");
  });

  test.each([
    ["2028-02-29", "00:00"],
    ["2026-12-31", "23:59"],
  ])("acepta los límites válidos %s %s", async (date, time) => {
    const respuesta = await crearCita({ date, time });

    expect(respuesta.status).toBe(201);
  });

  test("tampoco se puede editar una cita con una fecha inexistente", async () => {
    const alta = await crearCita({});
    const respuesta = await request(app)
      .patch(`/api/appointments/${alta.body.data.appointment.id}`)
      .set(headers)
      .send({ date: "2026-02-31" });

    esperarError(respuesta, "date");
  });

  test("filtrar la agenda por una fecha inexistente responde 400", async () => {
    const respuesta = await request(app).get("/api/appointments?date=2026-02-31").set(headers);

    esperarError(respuesta, "date");
  });
});

describe("Mantenimiento con fecha inexistente (D-02)", () => {
  test("rechaza la fecha objetivo con 400", async () => {
    const respuesta = await request(app)
      .post("/api/maintenances")
      .set(headers)
      .send({ vehicleId: ids.vehicleId, nextDueDate: "2026-02-31" });

    esperarError(respuesta, "nextDueDate");
  });
});
