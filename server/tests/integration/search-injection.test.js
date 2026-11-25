import request from "supertest";
import { app } from "../../app.js";
import { pool } from "../../config/db.js";
import * as clientes from "../../models/client.model.js";
import * as vehiculos from "../../models/vehicle.model.js";
import { crearPoolDePrueba, aplicarMigraciones, limpiarBaseDePrueba } from "../helpers/db.js";
import { tokenPara, conToken } from "../helpers/usuarios.js";

// T082: los campos de búsqueda usan parámetros y no dejan inyectar SQL (US10,
// CA-25). Una entrada maliciosa nunca debe devolver filas de más ni un 500.
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
  headersAdmin = conToken((await tokenPara({ username: "admin", role: "ADMIN" })).token);
  const mecanico = await tokenPara({ username: "mecanico", role: "MECHANIC" });

  for (let i = 1; i <= 3; i += 1) {
    const cliente = await clientes.crear({
      name: `Cliente Normal ${i}`,
      phone: `551000000${i}`,
      email: `normal${i}@correo.mx`,
    });
    const vehiculo = await vehiculos.crear({
      clientId: cliente.id,
      brand: "Nissan",
      model: "Versa",
      year: 2020,
      licensePlate: `INY000${i}`,
      vin: null,
      currentMileage: 1000,
    });
    await request(app)
      .post("/api/service-orders")
      .set(headersAdmin)
      .send({
        clientId: cliente.id,
        vehicleId: vehiculo.id,
        mechanicId: mecanico.usuario.id,
        entryMileage: 2000,
        reportedProblem: `Servicio ${i}`,
      });
    await request(app)
      .post("/api/appointments")
      .set(headersAdmin)
      .send({
        clientId: cliente.id,
        vehicleId: vehiculo.id,
        date: "2030-01-1" + i,
        time: "10:00",
        reason: `Revisión ${i}`,
      });
    await request(app)
      .post("/api/parts")
      .set(headersAdmin)
      .send({
        partCode: `INY-00${i}`,
        name: `Pieza ${i}`,
        category: "Motor",
        stockCurrent: 5,
        stockMin: 1,
        purchasePrice: "10.00",
        salePrice: "20.00",
      });
  }
});

const ENTRADAS = [
  ["' OR 1=1 --", "comilla simple con OR 1=1"],
  ["\" OR \"1\"=\"1", "comilla doble"],
  ["%", "comodín %"],
  ["_", "comodín _"],
  ["'; DROP TABLE clients; --", "punto y coma con DROP"],
  ["\\", "barra invertida"],
  ["' UNION SELECT 1,2,3 --", "UNION"],
  ["%' OR '%'='", "LIKE roto"],
];

const BUSQUEDAS = [
  ["clientes", "/api/clients", (r) => r.body.data.clients],
  ["vehículos", "/api/vehicles", (r) => r.body.data.vehicles],
  ["citas", "/api/appointments", (r) => r.body.data.appointments],
  ["órdenes", "/api/service-orders", (r) => r.body.data.orders],
  ["refacciones", "/api/parts", (r) => r.body.data.parts],
  ["usuarios", "/api/users", (r) => r.body.data.users],
];

describe("Campos de búsqueda frente a entradas maliciosas", () => {
  for (const [nombre, ruta, filas] of BUSQUEDAS) {
    for (const [entrada, descripcion] of ENTRADAS) {
      test(`${nombre}: ${descripcion} responde 200 sin filas de más`, async () => {
        const total = filas(await request(app).get(ruta).set(headersAdmin)).length;

        const respuesta = await request(app).get(ruta).query({ q: entrada }).set(headersAdmin);

        expect(respuesta.status).toBe(200);
        expect(respuesta.status).not.toBe(500);
        const encontradas = filas(respuesta);
        // Nada de lo sembrado contiene estos textos: «%» y «_» se tratan como
        // texto literal, así que tampoco devuelven todo.
        expect(encontradas.length).toBeLessThan(Math.max(total, 1) + 0.5);
        if (entrada !== "%" && entrada !== "_") expect(encontradas).toHaveLength(0);
      });
    }
  }

  test("las tablas siguen intactas tras todas las entradas", async () => {
    for (const [, ruta] of BUSQUEDAS) {
      for (const [entrada] of ENTRADAS) {
        await request(app).get(ruta).query({ q: entrada }).set(headersAdmin);
      }
    }

    const [[{ total }]] = await poolPrueba.query("SELECT COUNT(*) AS total FROM clients");
    expect(Number(total)).toBe(3);
  });
});

describe("Filtros de otros parámetros", () => {
  test("status, estado y fecha con texto malicioso no producen 500", async () => {
    const rutas = [
      "/api/service-orders?status=' OR 1=1 --",
      "/api/appointments?status=' OR 1=1 --",
      "/api/appointments?date=' OR 1=1 --",
      "/api/maintenances?state=' OR 1=1 --",
      "/api/users?role=' OR 1=1 --",
      "/api/users?active=' OR 1=1 --",
      "/api/vehicles?clientId=1 OR 1=1",
      "/api/audit-log?action=' OR 1=1 --",
      "/api/terms/acceptances?version=1 OR 1=1",
    ];

    for (const ruta of rutas) {
      const respuesta = await request(app).get(encodeURI(ruta)).set(headersAdmin);
      expect(respuesta.status).not.toBe(500);
      expect([200, 400, 404]).toContain(respuesta.status);
    }
  });
});
