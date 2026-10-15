import request from "supertest";
import { app } from "../../app.js";
import { pool } from "../../config/db.js";
import { crearPoolDePrueba, aplicarMigraciones, limpiarBaseDePrueba } from "../helpers/db.js";
import { tokenPara, conToken } from "../helpers/usuarios.js";

// T050: contrato del panel (US5) contra
// specs/004-pagos-tickets-dashboard/contracts/dashboard.md.
// Sobre {ok,data}: `summary` con exactamente los 8 contadores numéricos,
// los arreglos de detalle y 403 exclusivo de ADMIN (RN-15, FR-012).

const CONTADORES = [
  "vehiclesAttended",
  "vehiclesInRepair",
  "ordersPending",
  "ordersFinished",
  "nextAppointments",
  "upcomingMaintenances",
  "overdueMaintenances",
  "lowStockCount",
];

let poolPrueba;
let headersAdmin;
let headersRecepcion;
let headersMecanico;

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

  const admin = await tokenPara({ username: "admin", role: "ADMIN", name: "Administración" });
  headersAdmin = conToken(admin.token);
  const recepcion = await tokenPara({ username: "recepcion", role: "RECEPTIONIST" });
  headersRecepcion = conToken(recepcion.token);
  const mecanico = await tokenPara({ username: "mecanico-uno", role: "MECHANIC" });
  headersMecanico = conToken(mecanico.token);
});

function obtenerDashboard(headers = headersAdmin) {
  return request(app).get("/api/dashboard").set(headers);
}

describe("Contrato del panel (US5) — contracts/dashboard.md", () => {
  test("responde {ok,data} con summary de los 8 contadores y los arreglos", async () => {
    const respuesta = await obtenerDashboard();

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.ok).toBe(true);

    const { data } = respuesta.body;
    expect(Object.keys(data.summary).sort()).toEqual([...CONTADORES].sort());
    for (const contador of CONTADORES) {
      expect(typeof data.summary[contador]).toBe("number");
      expect(Number.isInteger(data.summary[contador])).toBe(true);
    }

    // Arreglos de detalle (US5 los entrega vacíos; US6 los llena).
    expect(Array.isArray(data.recentOrders)).toBe(true);
    expect(Array.isArray(data.nextAppointments)).toBe(true);
    expect(data.maintenances).toEqual({ upcoming: [], overdue: [] });
    expect(Array.isArray(data.lowStockParts)).toBe(true);
  });

  test("sin datos, el resumen viene en cero y todos los arreglos vacíos", async () => {
    const respuesta = await obtenerDashboard();

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toEqual({
      summary: {
        vehiclesAttended: 0,
        vehiclesInRepair: 0,
        ordersPending: 0,
        ordersFinished: 0,
        nextAppointments: 0,
        upcomingMaintenances: 0,
        overdueMaintenances: 0,
        lowStockCount: 0,
      },
      recentOrders: [],
      nextAppointments: [],
      maintenances: { upcoming: [], overdue: [] },
      lowStockParts: [],
    });
  });

  test("403 FORBIDDEN para roles que no son ADMIN", async () => {
    const recepcion = await obtenerDashboard(headersRecepcion);
    expect(recepcion.status).toBe(403);
    expect(recepcion.body.error.code).toBe("FORBIDDEN");

    const mecanico = await obtenerDashboard(headersMecanico);
    expect(mecanico.status).toBe(403);
    expect(mecanico.body.error.code).toBe("FORBIDDEN");
  });
});
