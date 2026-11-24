import request from "supertest";
import { app } from "../../app.js";
import { pool } from "../../config/db.js";
import * as clientes from "../../models/client.model.js";
import * as vehiculos from "../../models/vehicle.model.js";
import { crearPoolDePrueba, aplicarMigraciones, limpiarBaseDePrueba } from "../helpers/db.js";
import { tokenPara, conToken } from "../helpers/usuarios.js";

// T011: contrato de GET /api/notifications contra
// specs/006-notificaciones-internas/contracts/notifications.md.
// La matriz por rol se prueba en US2/US3/US5; aquí solo ADMIN y 401.

let poolPrueba;
let headersAdmin;

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
  const admin = await tokenPara({ username: "admin", role: "ADMIN", name: "Administrador" });
  headersAdmin = conToken(admin.token);
});

/** Un aviso real de cada grupo para verificar los campos del contrato. */
async function cargarUnAvisoPorGrupo() {
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
    currentMileage: 48500,
  });

  await request(app)
    .post("/api/maintenances")
    .set(headersAdmin)
    .send({ vehicleId: vehiculo.id, nextDueDate: "2020-01-01" });

  await request(app)
    .post("/api/parts")
    .set(headersAdmin)
    .send({
      partCode: "BAL-001",
      name: "Balatas traseras",
      category: "Frenos",
      stockCurrent: 4,
      stockMin: 5,
    });
}

describe("Contrato de GET /api/notifications", () => {
  test("responde {ok,data} con unreadCount y groups con las 4 claves de tipo (200)", async () => {
    await cargarUnAvisoPorGrupo();

    const respuesta = await request(app).get("/api/notifications").set(headersAdmin);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.ok).toBe(true);

    const { unreadCount, groups } = respuesta.body.data;
    expect(typeof unreadCount).toBe("number");
    expect(Array.isArray(groups)).toBe(true);
    expect(groups).toHaveLength(4);
    expect(groups.map((grupo) => grupo.type)).toEqual([
      "MAINTENANCE",
      "APPOINTMENT",
      "STOCK",
      "ORDER_STOPPED",
    ]);
    for (const grupo of groups) {
      expect(typeof grupo.label).toBe("string");
      expect(grupo.label.length).toBeGreaterThan(0);
      expect(Array.isArray(grupo.items)).toBe(true);
    }
  });

  test("cada ítem trae key, read, severity, navigation y su texto en español", async () => {
    await cargarUnAvisoPorGrupo();

    const respuesta = await request(app).get("/api/notifications").set(headersAdmin);
    const items = respuesta.body.data.groups.flatMap((grupo) => grupo.items);
    expect(items.length).toBeGreaterThan(0);

    for (const item of items) {
      expect(typeof item.key).toBe("string");
      expect(item.key).toMatch(/^[A-Z_]+:\d+:[A-Z_]+$/);
      expect(typeof item.read).toBe("boolean");
      expect(typeof item.severity).toBe("string");
      expect(typeof item.title).toBe("string");
      expect(item.title.length).toBeGreaterThan(0);
      expect(typeof item.detail).toBe("string");
      expect(item.navigation).toEqual({
        route: expect.any(String),
        entityId: expect.any(Number),
      });
    }

    const stock = respuesta.body.data.groups.find(
      (grupo) => grupo.type === "STOCK",
    ).items[0];
    expect(stock.key).toMatch(/^STOCK:\d+:LOW$/);
    expect(stock.severity).toBe("LOW");
    expect(stock.navigation.route).toBe("/inventory");
  });

  test("sin avisos responde unreadCount 0 con los grupos presentes y vacíos", async () => {
    const respuesta = await request(app).get("/api/notifications").set(headersAdmin);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.unreadCount).toBe(0);
    expect(respuesta.body.data.groups).toHaveLength(4);
    expect(
      respuesta.body.data.groups.every((grupo) => grupo.items.length === 0),
    ).toBe(true);
  });

  test("sin token responde 401 UNAUTHORIZED (convención compartida)", async () => {
    const respuesta = await request(app).get("/api/notifications");

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.ok).toBe(false);
    expect(respuesta.body.error.code).toBe("UNAUTHORIZED");
  });
});
