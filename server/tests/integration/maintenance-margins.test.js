import request from "supertest";
import { app } from "../../app.js";
import { pool } from "../../config/db.js";
import * as clientes from "../../models/client.model.js";
import * as vehiculos from "../../models/vehicle.model.js";
import { crearPoolDePrueba, aplicarMigraciones, limpiarBaseDePrueba } from "../helpers/db.js";
import { tokenPara, conToken } from "../helpers/usuarios.js";

// T033: márgenes de «Próximo» del mantenimiento (US2, CA-3, SC-002, SC-003,
// D-16, D-17). NULL en warn_days / warn_km = «usar el valor del taller».
let poolPrueba;
let headersAdmin;
let contador = 0;

function fechaRelativa(dias) {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + dias);
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

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
  headersAdmin = conToken(
    (await tokenPara({ username: "admin", role: "ADMIN", name: "Administrador" })).token,
  );
});

async function nuevoVehiculo() {
  contador += 1;
  const cliente = await clientes.crear({
    name: `Cliente mm${contador}`,
    phone: `55${String(80000000 + contador).slice(-8)}`,
    email: `cliente-mm${contador}@correo.mx`,
  });
  const vehiculo = await vehiculos.crear({
    clientId: cliente.id,
    brand: "Toyota",
    model: "Corolla",
    year: 2020,
    licensePlate: `M${String(contador).padStart(7, "0")}`,
    vin: null,
    currentMileage: 10000,
  });
  return vehiculo;
}

/** Alta de mantenimiento por la API con los días indicados hasta la fecha objetivo. */
async function altaMantenimiento(dias, extra = {}) {
  const vehiculo = await nuevoVehiculo();
  const respuesta = await request(app)
    .post("/api/maintenances")
    .set(headersAdmin)
    .send({ vehicleId: vehiculo.id, nextDueDate: fechaRelativa(dias), ...extra });
  expect([200, 201]).toContain(respuesta.status);
  return respuesta.body.data.maintenance;
}

const configurar = (maintenance) =>
  request(app).patch("/api/settings").set(headersAdmin).send({ maintenance });
const listar = async () =>
  (await request(app).get("/api/maintenances").set(headersAdmin)).body.data.maintenances;

describe("Márgenes por taller (D-16)", () => {
  test("sin valor guardado rigen 30 días y 500 km (CA-3, SC-003)", async () => {
    const dentro = await altaMantenimiento(25);
    const fuera = await altaMantenimiento(40);

    expect(dentro.warnDays).toBe(30);
    expect(dentro.warnKm).toBe(500);
    expect(dentro.state).toBe("UPCOMING");
    expect(fuera.state).toBe("NORMAL");
  });

  test("cambiar el margen del taller reclasifica los mantenimientos sin antelación propia", async () => {
    const mantenimiento = await altaMantenimiento(40);
    expect(mantenimiento.state).toBe("NORMAL");

    const cambio = await configurar({ warnDays: 45 });
    expect(cambio.status).toBe(200);

    const [actual] = await listar();
    expect(actual.warnDays).toBe(45);
    expect(actual.state).toBe("UPCOMING");

    await configurar({ warnDays: 10 });
    const [reducido] = await listar();
    expect(reducido.warnDays).toBe(10);
    expect(reducido.state).toBe("NORMAL");
  });

  test("el mantenimiento con antelación propia la conserva al cambiar el taller", async () => {
    const propio = await altaMantenimiento(40, { warnDays: 5 });
    expect(propio.warnDays).toBe(5);
    expect(propio.state).toBe("NORMAL");

    await configurar({ warnDays: 90 });

    const [actual] = await listar();
    expect(actual.warnDays).toBe(5);
    expect(actual.state).toBe("NORMAL");
  });

  test("un 0 propio se respeta y no se confunde con «usar el valor del taller»", async () => {
    const mantenimiento = await altaMantenimiento(3, { warnDays: 0 });

    expect(mantenimiento.warnDays).toBe(0);
    expect(mantenimiento.warnDaysCustom).toBe(true);
    expect(mantenimiento.state).toBe("NORMAL");
  });

  test("el margen en kilómetros del taller también aplica", async () => {
    const vehiculo = await nuevoVehiculo();
    const alta = await request(app)
      .post("/api/maintenances")
      .set(headersAdmin)
      .send({ vehicleId: vehiculo.id, nextDueMileage: 10800 });
    expect(alta.body.data.maintenance.state).toBe("NORMAL");

    await configurar({ warnKm: 1000 });

    const [actual] = await listar();
    expect(actual.warnKm).toBe(1000);
    expect(actual.state).toBe("UPCOMING");
  });
});

describe("Alta con y sin antelación propia", () => {
  test("sin warnDays ni warnKm guarda NULL y marca los dos como del taller", async () => {
    const mantenimiento = await altaMantenimiento(20);

    expect(mantenimiento.warnDaysCustom).toBe(false);
    expect(mantenimiento.warnKmCustom).toBe(false);
    const [[fila]] = await poolPrueba.query(
      "SELECT warn_days AS d, warn_km AS k FROM maintenance WHERE id = ?",
      [mantenimiento.id],
    );
    expect(fila).toEqual({ d: null, k: null });
  });

  test("con null explícito también guarda NULL", async () => {
    const mantenimiento = await altaMantenimiento(20, { warnDays: null, warnKm: null });

    expect(mantenimiento.warnDaysCustom).toBe(false);
    expect(mantenimiento.warnKmCustom).toBe(false);
  });

  test("con número lo guarda como propio y lo refleja en warnDaysCustom y warnKmCustom", async () => {
    const mantenimiento = await altaMantenimiento(20, { warnDays: 7, warnKm: 100 });

    expect(mantenimiento.warnDays).toBe(7);
    expect(mantenimiento.warnKm).toBe(100);
    expect(mantenimiento.warnDaysCustom).toBe(true);
    expect(mantenimiento.warnKmCustom).toBe(true);
  });

  test("cada columna se resuelve por separado", async () => {
    await configurar({ warnKm: 800 });

    const mantenimiento = await altaMantenimiento(20, { warnDays: 7 });

    expect(mantenimiento.warnDays).toBe(7);
    expect(mantenimiento.warnDaysCustom).toBe(true);
    expect(mantenimiento.warnKm).toBe(800);
    expect(mantenimiento.warnKmCustom).toBe(false);
  });

  test("reemplazar el registro sin antelación vuelve a «usar el valor del taller»", async () => {
    const vehiculo = await nuevoVehiculo();
    await request(app)
      .post("/api/maintenances")
      .set(headersAdmin)
      .send({ vehicleId: vehiculo.id, nextDueDate: fechaRelativa(20), warnDays: 7 });

    const reemplazo = await request(app)
      .post("/api/maintenances")
      .set(headersAdmin)
      .send({ vehicleId: vehiculo.id, nextDueDate: fechaRelativa(20) });

    expect(reemplazo.status).toBe(200);
    expect(reemplazo.body.data.maintenance.warnDaysCustom).toBe(false);
  });
});

describe("Coincidencia entre módulos (SC-002)", () => {
  test("lista, dashboard, centro de avisos y clientes por avisar coinciden tras cambiar los márgenes", async () => {
    await altaMantenimiento(-3); // vencido
    await altaMantenimiento(20); // próximo con 30 días
    await altaMantenimiento(40); // normal con 30 días
    await altaMantenimiento(60, { warnDays: 90 }); // próximo por antelación propia

    for (const margen of [30, 45, 70]) {
      await configurar({ warnDays: margen });

      const lista = await listar();
      const vencidos = lista.filter((m) => m.state === "OVERDUE").length;
      const proximos = lista.filter((m) => m.state === "UPCOMING").length;

      const dashboard = (await request(app).get("/api/dashboard").set(headersAdmin)).body.data;
      expect(dashboard.summary.overdueMaintenances).toBe(vencidos);
      expect(dashboard.summary.upcomingMaintenances).toBe(proximos);

      const avisos = (await request(app).get("/api/notifications").set(headersAdmin)).body.data;
      const grupo = avisos.groups.find((g) => g.type === "MAINTENANCE");
      expect(grupo ? grupo.items.length : 0).toBe(vencidos + proximos);

      const porAvisar = (await request(app).get("/api/client-notices").set(headersAdmin)).body.data;
      const deMantenimiento = porAvisar.filter((f) => f.motive.startsWith("MAINTENANCE_"));
      expect(deMantenimiento.filter((f) => f.motive === "MAINTENANCE_OVERDUE")).toHaveLength(vencidos);
      expect(deMantenimiento.filter((f) => f.motive === "MAINTENANCE_UPCOMING")).toHaveLength(proximos);
    }
  });
});

describe("Límites de PATCH /api/settings para los márgenes", () => {
  test.each([
    ["warnDays negativo", { warnDays: -1 }],
    ["warnDays mayor que 365", { warnDays: 366 }],
    ["warnDays no entero", { warnDays: 10.5 }],
    ["warnDays como texto", { warnDays: "10" }],
    ["warnKm negativo", { warnKm: -5 }],
    ["warnKm mayor que 20,000", { warnKm: 20001 }],
    ["warnKm no entero", { warnKm: 100.5 }],
  ])("rechaza %s con 400 VALIDATION_ERROR y conserva el valor anterior", async (_n, cuerpo) => {
    await configurar({ warnDays: 20, warnKm: 300 });

    const respuesta = await configurar(cuerpo);

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe("VALIDATION_ERROR");
    const actual = (await request(app).get("/api/settings").set(headersAdmin)).body.data;
    expect(actual.maintenance).toEqual({ warnDays: 20, warnKm: 300 });
  });

  test("acepta los límites exactos 0, 365 y 20,000", async () => {
    expect((await configurar({ warnDays: 0, warnKm: 0 })).status).toBe(200);
    const maximo = await configurar({ warnDays: 365, warnKm: 20000 });
    expect(maximo.status).toBe(200);
    expect(maximo.body.data.maintenance).toEqual({ warnDays: 365, warnKm: 20000 });
  });
});
