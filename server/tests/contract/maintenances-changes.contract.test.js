import request from "supertest";
import { app } from "../../app.js";
import { pool } from "../../config/db.js";
import * as clientes from "../../models/client.model.js";
import * as vehiculos from "../../models/vehicle.model.js";
import { crearPoolDePrueba, aplicarMigraciones, limpiarBaseDePrueba } from "../helpers/db.js";
import { tokenPara, conToken } from "../helpers/usuarios.js";

// T034: cambios de contrato de mantenimientos en el Sprint 7
// (specs/007-reportes-configuracion/contracts/changes-to-existing.md).
let poolPrueba;
let headersAdmin;
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
  headersAdmin = conToken((await tokenPara({ username: "admin", role: "ADMIN" })).token);
  const cliente = await clientes.crear({
    name: "Cliente contrato",
    phone: "5512345670",
    email: "contrato@correo.mx",
  });
  const vehiculo = await vehiculos.crear({
    clientId: cliente.id,
    brand: "Nissan",
    model: "Versa",
    year: 2021,
    licensePlate: "CTR0001",
    vin: null,
    currentMileage: 5000,
  });
  idVehiculo = vehiculo.id;
});

const alta = (cuerpo) =>
  request(app)
    .post("/api/maintenances")
    .set(headersAdmin)
    .send({ vehicleId: idVehiculo, nextDueMileage: 6000, ...cuerpo });

describe("Contrato de mantenimientos (Sprint 7)", () => {
  test("la respuesta trae warnDaysCustom y warnKmCustom booleanos", async () => {
    const respuesta = await alta({});

    expect(respuesta.status).toBe(201);
    const mantenimiento = respuesta.body.data.maintenance;
    expect(typeof mantenimiento.warnDaysCustom).toBe("boolean");
    expect(typeof mantenimiento.warnKmCustom).toBe("boolean");
    expect(Number.isInteger(mantenimiento.warnDays)).toBe(true);
    expect(Number.isInteger(mantenimiento.warnKm)).toBe(true);
  });

  test("warnDays y warnKm son opcionales: omitidos o null → 201", async () => {
    expect((await alta({})).status).toBe(201);
    expect([200, 201]).toContain((await alta({ warnDays: null, warnKm: null })).status);
  });

  test("warnDays y warnKm siguen siendo enteros no negativos", async () => {
    for (const cuerpo of [{ warnDays: -1 }, { warnKm: -1 }, { warnDays: 1.5 }, { warnKm: "x" }]) {
      const respuesta = await alta(cuerpo);
      expect(respuesta.status).toBe(400);
      expect(respuesta.body.error.code).toBe("VALIDATION_ERROR");
    }
  });

  test("el GET de la lista también trae los campos nuevos", async () => {
    await alta({ warnDays: 3 });

    const lista = await request(app).get("/api/maintenances").set(headersAdmin);

    const [mantenimiento] = lista.body.data.maintenances;
    expect(mantenimiento.warnDaysCustom).toBe(true);
    expect(mantenimiento.warnKmCustom).toBe(false);
  });
});
