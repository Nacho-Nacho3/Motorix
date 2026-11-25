import request from "supertest";
import { app } from "../../app.js";
import { pool } from "../../config/db.js";
import * as clientes from "../../models/client.model.js";
import * as vehiculos from "../../models/vehicle.model.js";
import { crearPoolDePrueba, aplicarMigraciones, limpiarBaseDePrueba } from "../helpers/db.js";
import { tokenPara, conToken } from "../helpers/usuarios.js";

// T094: reporte de ingresos por periodo (US4, CA-6, CA-7, CA-10, SC-006).
let poolPrueba;
let admin;
let headersAdmin;
let headersRecepcion;
let headersMecanico;
let idOrden;

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
  admin = await tokenPara({ username: "admin", role: "ADMIN" });
  headersAdmin = conToken(admin.token);
  headersRecepcion = conToken(
    (await tokenPara({ username: "recepcion", role: "RECEPTIONIST" })).token,
  );
  const mecanico = await tokenPara({ username: "mecanico", role: "MECHANIC" });
  headersMecanico = conToken(mecanico.token);

  const cliente = await clientes.crear({ name: "Cliente ing", phone: "5544445555", email: "ing@correo.mx" });
  const vehiculo = await vehiculos.crear({
    clientId: cliente.id,
    brand: "Nissan",
    model: "Versa",
    year: 2020,
    licensePlate: "ING0001",
    vin: null,
    currentMileage: 1000,
  });
  const orden = await request(app)
    .post("/api/service-orders")
    .set(headersRecepcion)
    .send({
      clientId: cliente.id,
      vehicleId: vehiculo.id,
      mechanicId: mecanico.usuario.id,
      entryMileage: 2000,
      reportedProblem: "Ingresos",
    });
  idOrden = orden.body.data.order.id;
});

/** Inserta un pago con fecha de pago explícita (`updated_at`). */
async function pago({ monto, metodo = "CASH", estado = "PAID", fecha }) {
  await poolPrueba.query(
    `INSERT INTO payments (order_id, amount, method, status, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [idOrden, monto, metodo, estado, admin.usuario.id, fecha, fecha],
  );
}

const ingresos = (query = "", headers = headersAdmin) =>
  request(app).get(`/api/reports/income${query}`).set(headers);

function texto(fecha) {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;
}

describe("Conteo de pagos", () => {
  test("cuenta solo los pagos PAID del periodo, por día y método", async () => {
    await pago({ monto: "1000.10", fecha: "2026-03-05 10:00:00" });
    await pago({ monto: "250.05", fecha: "2026-03-05 18:30:00" });
    await pago({ monto: "300.00", metodo: "TRANSFER", fecha: "2026-03-05 12:00:00" });
    await pago({ monto: "400.00", metodo: "CARD", fecha: "2026-03-06 09:00:00" });
    await pago({ monto: "999.00", estado: "PENDING", fecha: "2026-03-05 11:00:00" });
    await pago({ monto: "888.00", estado: "REJECTED", fecha: "2026-03-05 11:00:00" });
    await pago({ monto: "777.00", estado: "CANCELLED", fecha: "2026-03-06 11:00:00" });

    const respuesta = await ingresos("?from=2026-03-01&to=2026-03-31");

    expect(respuesta.status).toBe(200);
    const { rows, totals, from, to, truncated } = respuesta.body.data;
    expect({ from, to, truncated }).toEqual({ from: "2026-03-01", to: "2026-03-31", truncated: false });
    expect(rows).toEqual([
      { date: "2026-03-05", method: "CASH", count: 2, total: "1250.15" },
      { date: "2026-03-05", method: "TRANSFER", count: 1, total: "300.00" },
      { date: "2026-03-06", method: "CARD", count: 1, total: "400.00" },
    ]);
    expect(totals).toEqual({
      count: 4,
      total: "1950.15",
      byMethod: [
        { method: "CARD", count: 1, total: "400.00" },
        { method: "CASH", count: 2, total: "1250.15" },
        { method: "TRANSFER", count: 1, total: "300.00" },
      ],
    });
  });

  test("coincide al centavo con una suma independiente de la tabla payments", async () => {
    // Importes con decimales que en coma flotante acumulan error (0.1 + 0.2).
    const montos = ["0.10", "0.20", "0.30", "19.99", "19.99", "19.99", "1234.56", "0.01", "0.07"];
    for (const [i, monto] of montos.entries()) {
      await pago({ monto, metodo: i % 2 ? "CARD" : "CASH", fecha: `2026-04-${String(10 + (i % 3)).padStart(2, "0")} 10:00:00` });
    }

    const respuesta = await ingresos("?from=2026-04-01&to=2026-04-30");

    const [[{ centavos }]] = await poolPrueba.query(
      `SELECT CAST(ROUND(SUM(amount) * 100) AS SIGNED) AS centavos FROM payments
        WHERE status = 'PAID' AND DATE(updated_at) BETWEEN '2026-04-01' AND '2026-04-30'`,
    );
    const esperado = (Number(centavos) / 100).toFixed(2);
    expect(respuesta.body.data.totals.total).toBe(esperado);

    const sumaFilas = respuesta.body.data.rows.reduce((suma, fila) => suma + Math.round(Number(fila.total) * 100), 0);
    expect(sumaFilas).toBe(Number(centavos));
    const sumaMetodos = respuesta.body.data.totals.byMethod.reduce(
      (suma, fila) => suma + Math.round(Number(fila.total) * 100),
      0,
    );
    expect(sumaMetodos).toBe(Number(centavos));
    expect(respuesta.body.data.totals.count).toBe(montos.length);
  });

  test("los límites del rango son inclusivos y se corta por hora local", async () => {
    await pago({ monto: "10.00", fecha: "2026-05-01 00:00:00" });
    await pago({ monto: "20.00", fecha: "2026-05-31 23:59:59" });
    await pago({ monto: "40.00", fecha: "2026-04-30 23:59:59" });
    await pago({ monto: "80.00", fecha: "2026-06-01 00:00:00" });

    const respuesta = await ingresos("?from=2026-05-01&to=2026-05-31");

    expect(respuesta.body.data.totals).toMatchObject({ count: 2, total: "30.00" });
  });

  test("un periodo sin pagos devuelve filas vacías y totales en 0.00", async () => {
    const respuesta = await ingresos("?from=2026-01-01&to=2026-01-31");

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.rows).toEqual([]);
    expect(respuesta.body.data.totals).toEqual({ count: 0, total: "0.00", byMethod: [] });
  });

  test("por omisión usa el mes en curso, del primer día a hoy", async () => {
    const hoy = new Date();
    const primero = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    await pago({ monto: "55.50", fecha: `${texto(hoy)} 09:00:00` });

    const respuesta = await ingresos();

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.from).toBe(texto(primero));
    expect(respuesta.body.data.to).toBe(texto(hoy));
    expect(respuesta.body.data.totals.total).toBe("55.50");
  });

  test("tope de 500 filas: truncated verdadero cuando se supera", async () => {
    // 3 métodos x 200 días = 600 grupos (fecha, método): más que el tope de filas.
    const valores = [];
    for (let i = 0; i < 200; i += 1) {
      const dia = new Date(2025, 0, 1 + i);
      for (const metodo of ["CASH", "CARD", "TRANSFER"]) {
        valores.push([idOrden, "1.00", metodo, "PAID", admin.usuario.id, `${texto(dia)} 10:00:00`, `${texto(dia)} 10:00:00`]);
      }
    }
    await poolPrueba.query(
      "INSERT INTO payments (order_id, amount, method, status, created_by, created_at, updated_at) VALUES ?",
      [valores],
    );

    const respuesta = await ingresos("?from=2025-01-01&to=2025-12-31");

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.truncated).toBe(true);
    expect(respuesta.body.data.rows).toHaveLength(500);
    // Los totales salen de todos los registros, no solo de las filas devueltas.
    expect(respuesta.body.data.totals).toMatchObject({ count: 600, total: "600.00" });
  });
});

describe("Validación de la consulta (CA-6)", () => {
  test.each([
    ["to anterior a from", "?from=2026-03-10&to=2026-03-01"],
    ["rango de más de 366 días", "?from=2025-01-01&to=2026-03-01"],
    ["fecha con formato inválido", "?from=10/03/2026"],
    ["fecha inexistente", "?from=2026-02-31"],
    ["texto como fecha", "?to=ayer"],
    ["format desconocido", "?format=xml"],
  ])("rechaza %s con 400 VALIDATION_ERROR", async (_n, query) => {
    const respuesta = await ingresos(query);

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe("VALIDATION_ERROR");
    expect(respuesta.body.error.message).toMatch(/[a-záéíóú]/i);
  });

  test("acepta un rango de exactamente 366 días", async () => {
    const respuesta = await ingresos("?from=2026-01-01&to=2027-01-01");

    expect(respuesta.status).toBe(200);
  });

  test("solo desde: hasta hoy; solo hasta: desde el primer día de ese mes", async () => {
    expect((await ingresos("?from=2026-01-01")).status).toBe(200);
    const soloHasta = await ingresos("?to=2026-03-15");
    expect(soloHasta.status).toBe(200);
    expect(soloHasta.body.data.from).toBe("2026-03-01");
  });
});

describe("Permisos (CA-10)", () => {
  test("recepción y mecánico reciben 403 FORBIDDEN", async () => {
    for (const headers of [headersRecepcion, headersMecanico]) {
      const respuesta = await ingresos("", headers);
      expect(respuesta.status).toBe(403);
      expect(respuesta.body.error.code).toBe("FORBIDDEN");
    }
  });

  test("sin token responde 401", async () => {
    expect((await request(app).get("/api/reports/income")).status).toBe(401);
  });

  test("el reporte es de solo lectura: no acepta escrituras", async () => {
    for (const metodo of ["post", "put", "patch", "delete"]) {
      const respuesta = await request(app)[metodo]("/api/reports/income").set(headersAdmin).send({});
      expect([404, 405]).toContain(respuesta.status);
    }
  });
});
