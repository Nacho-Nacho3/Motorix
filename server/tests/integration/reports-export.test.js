import request from "supertest";
import { app } from "../../app.js";
import { pool } from "../../config/db.js";
import * as clientes from "../../models/client.model.js";
import * as vehiculos from "../../models/vehicle.model.js";
import { crearPoolDePrueba, aplicarMigraciones, limpiarBaseDePrueba } from "../helpers/db.js";
import { tokenPara, conToken } from "../helpers/usuarios.js";

// T120: exportación CSV de los cinco reportes (US7, CA-9, SC-007, P-10). El CSV
// sale de las mismas filas que el JSON para los mismos filtros.
let poolPrueba;
let admin;
let headersAdmin;
let headersRecepcion;
let headersMecanico;

const RANGO = "from=2026-03-01&to=2026-03-31";
const BOM = "﻿";

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
  const mecanico = await tokenPara({ username: "mecanico", role: "MECHANIC", name: "Peña, Mecánico" });
  headersMecanico = conToken(mecanico.token);
  await sembrar(mecanico);
});

/** Un día de marzo con pagos, servicios (uno con nombre malicioso), mano de obra y refacciones. */
async function sembrar(mecanico) {
  const tipo = await request(app)
    .post("/api/service-types")
    .set(headersAdmin)
    .send({ name: "=SUMA(1;1)", intervalDays: 30 });
  const parte = await request(app)
    .post("/api/parts")
    .set(headersAdmin)
    .send({
      partCode: "EXP-001",
      name: "=1+1 Filtro, \"premium\"",
      category: "Motor",
      stockCurrent: 20,
      stockMin: 1,
      purchasePrice: "60.00",
      salePrice: "150.00",
    });
  await request(app)
    .post("/api/parts")
    .set(headersAdmin)
    .send({
      partCode: "EXP-002",
      name: "Sin costo",
      category: "Motor",
      stockCurrent: 5,
      stockMin: 1,
      purchasePrice: "0.00",
      salePrice: "99.90",
    });
  const cliente = await clientes.crear({ name: "Cliente ex", phone: "5500001111", email: "ex@correo.mx" });
  const vehiculo = await vehiculos.crear({
    clientId: cliente.id,
    brand: "Nissan",
    model: "Versa",
    year: 2020,
    licensePlate: "EXP0001",
    vin: null,
    currentMileage: 1000,
  });
  const alta = await request(app)
    .post("/api/service-orders")
    .set(headersRecepcion)
    .send({
      clientId: cliente.id,
      vehicleId: vehiculo.id,
      mechanicId: mecanico.usuario.id,
      entryMileage: 2000,
      reportedProblem: "Exportar",
    });
  const id = alta.body.data.order.id;
  const mec = conToken(mecanico.token);
  await request(app)
    .post(`/api/service-orders/${id}/services`)
    .set(mec)
    .send({ description: "Con tipo", unitPrice: 600, serviceTypeId: tipo.body.data.id });
  await request(app).post(`/api/service-orders/${id}/services`).set(mec).send({ description: "Sin tipo", unitPrice: 100 });
  await request(app)
    .post(`/api/service-orders/${id}/labor`)
    .set(mec)
    .send({ concept: "Mano de obra", hours: 1.33, hourlyRate: 99.99 });
  await request(app).post(`/api/service-orders/${id}/parts`).set(mec).send({ partId: parte.body.data.part.id, quantity: 4 });
  const sin = await poolPrueba.query("SELECT id FROM parts WHERE part_code = 'EXP-002'");
  await request(app).post(`/api/service-orders/${id}/parts`).set(mec).send({ partId: sin[0][0].id, quantity: 2 });
  for (const status of ["DIAGNOSIS", "IN_REPAIR", "FINISHED"]) {
    await request(app).patch(`/api/service-orders/${id}/status`).set(mec).send({ status });
  }
  await poolPrueba.query("UPDATE service_orders SET finished_at = '2026-03-10 12:00:00' WHERE id = ?", [id]);
  await poolPrueba.query("UPDATE inventory_movements SET created_at = '2026-03-02 09:00:00'");
  await poolPrueba.query("UPDATE inventory_movements SET created_at = '2026-03-10 12:00:00' WHERE movement_type = 'OUT'");
  await poolPrueba.query(
    `INSERT INTO payments (order_id, amount, method, status, created_by, created_at, updated_at)
     VALUES (?, 1250.15, 'CASH', 'PAID', ?, '2026-03-10 13:00:00', '2026-03-10 13:00:00'),
            (?, 300.00, 'TRANSFER', 'PAID', ?, '2026-03-11 10:00:00', '2026-03-11 10:00:00')`,
    [id, admin.usuario.id, id, admin.usuario.id],
  );
}

/** Lector mínimo de CSV: comillas dobles, comas y saltos dentro de comillas. */
function leerCsv(texto) {
  const sinBom = texto.startsWith(BOM) ? texto.slice(1) : texto;
  const filas = [];
  let fila = [];
  let celda = "";
  let entreComillas = false;
  for (let i = 0; i < sinBom.length; i += 1) {
    const c = sinBom[i];
    if (entreComillas) {
      if (c === '"' && sinBom[i + 1] === '"') {
        celda += '"';
        i += 1;
      } else if (c === '"') entreComillas = false;
      else celda += c;
    } else if (c === '"') entreComillas = true;
    else if (c === ",") {
      fila.push(celda);
      celda = "";
    } else if (c === "\r") {
      // se ignora; el salto lo cierra \n
    } else if (c === "\n") {
      fila.push(celda);
      filas.push(fila);
      fila = [];
      celda = "";
    } else celda += c;
  }
  return filas;
}

const pedir = (nombre, formato, query = RANGO, headers = headersAdmin) =>
  request(app)
    .get(`/api/reports/${nombre}?${query}${formato ? `&format=${formato}` : ""}`)
    .set(headers)
    .buffer(true)
    .parse((respuesta, devolver) => {
      let datos = "";
      respuesta.setEncoding("utf8");
      respuesta.on("data", (trozo) => (datos += trozo));
      respuesta.on("end", () => devolver(null, datos));
    });

const jsonDe = async (nombre, query = RANGO) =>
  (await request(app).get(`/api/reports/${nombre}?${query}`).set(headersAdmin)).body.data;

const ENCABEZADOS = {
  income: ["Fecha", "Método", "Pagos", "Importe"],
  services: ["Tipo de servicio", "Cantidad", "Importe"],
  productivity: ["Mecánico", "Órdenes terminadas", "Mano de obra"],
  "parts-margin": ["Código", "Refacción", "Unidades", "Ventas", "Costo", "Margen", "Unidades sin costo", "Ventas sin costo"],
  "inventory-rotation": ["Código", "Refacción", "Unidades salidas", "Existencia promedio", "Rotación"],
};

describe("Respuesta CSV", () => {
  test.each(Object.keys(ENCABEZADOS))("%s responde 200 text/csv con attachment y el nombre del reporte y el periodo", async (nombre) => {
    const respuesta = await pedir(nombre, "csv");

    expect(respuesta.status).toBe(200);
    expect(respuesta.headers["content-type"]).toBe("text/csv; charset=utf-8");
    expect(respuesta.headers["content-disposition"]).toBe(
      `attachment; filename="reporte-${nombre}-2026-03-01-2026-03-31.csv"`,
    );
    expect(respuesta.body.startsWith(BOM)).toBe(true);
  });

  test.each(Object.keys(ENCABEZADOS))("%s trae los encabezados en español del contrato", async (nombre) => {
    const filas = leerCsv((await pedir(nombre, "csv")).body);

    expect(filas[0]).toEqual(ENCABEZADOS[nombre]);
  });

  test("el nombre del archivo usa el periodo por omisión cuando no se envía", async () => {
    const respuesta = await pedir("income", "csv", "");

    expect(respuesta.headers["content-disposition"]).toMatch(
      /^attachment; filename="reporte-income-\d{4}-\d{2}-01-\d{4}-\d{2}-\d{2}\.csv"$/,
    );
  });

  test("sin format o con format=json responde JSON como antes", async () => {
    for (const formato of [undefined, "json"]) {
      const respuesta = await request(app)
        .get(`/api/reports/income?${RANGO}${formato ? `&format=${formato}` : ""}`)
        .set(headersAdmin);
      expect(respuesta.status).toBe(200);
      expect(respuesta.headers["content-type"]).toMatch(/application\/json/);
      expect(respuesta.body.ok).toBe(true);
    }
  });
});

describe("El CSV coincide fila por fila con el JSON (CA-9, SC-007)", () => {
  test("ingresos: filas por fecha y método más la fila TOTAL", async () => {
    const json = await jsonDe("income");
    const filas = leerCsv((await pedir("income", "csv")).body);

    const etiqueta = { CASH: "Efectivo", CARD: "Tarjeta", TRANSFER: "Transferencia", MERCADO_PAGO: "Mercado Pago" };
    expect(filas.slice(1, -1)).toEqual(
      json.rows.map((r) => [r.date, etiqueta[r.method], String(r.count), r.total]),
    );
    expect(filas.at(-1)).toEqual(["TOTAL", "", String(json.totals.count), json.totals.total]);
    expect(json.rows).toHaveLength(2);
  });

  test("servicios", async () => {
    const json = await jsonDe("services");
    const filas = leerCsv((await pedir("services", "csv")).body);

    expect(filas.slice(1).map((f) => [f[1], f[2]])).toEqual(
      json.rows.map((r) => [String(r.count), r.amount]),
    );
    expect(filas.slice(1)).toHaveLength(json.rows.length);
    expect(json.rows).toHaveLength(2);
  });

  test("productividad", async () => {
    const json = await jsonDe("productivity");
    const filas = leerCsv((await pedir("productivity", "csv")).body);

    expect(filas.slice(1)).toEqual(
      json.rows.map((r) => [r.mechanicName, String(r.ordersFinished), r.laborAmount]),
    );
    // El nombre con coma sobrevive al entrecomillado.
    expect(filas[1][0]).toBe("Peña, Mecánico");
  });

  test("margen de refacciones", async () => {
    const json = await jsonDe("parts-margin");
    const filas = leerCsv((await pedir("parts-margin", "csv")).body);

    expect(filas.slice(1).map((f) => f.slice(2))).toEqual(
      json.rows.map((r) => [
        String(r.units),
        r.salesAmount,
        r.costAmount,
        r.marginAmount,
        String(r.unitsWithoutCost),
        r.salesWithoutCost,
      ]),
    );
    expect(json.rows).toHaveLength(2);
  });

  test("rotación: la rotación nula sale como «Sin existencia»", async () => {
    await poolPrueba.query("UPDATE parts SET stock_current = 0 WHERE part_code = 'EXP-002'");
    const json = await jsonDe("inventory-rotation");
    const filas = leerCsv((await pedir("inventory-rotation", "csv")).body);

    expect(filas.slice(1).map((f) => [f[0], f[2], f[3]])).toEqual(
      json.rows.map((r) => [r.partCode, String(r.unitsOut), r.averageStock]),
    );
    json.rows.forEach((r, i) => {
      expect(filas[i + 1][4]).toBe(r.rotation === null ? "Sin existencia" : r.rotation);
    });
  });

  test("los mismos filtros dan el mismo contenido: otro periodo cambia ambos", async () => {
    const vacioJson = await jsonDe("income", "from=2025-01-01&to=2025-01-31");
    const vacioCsv = leerCsv((await pedir("income", "csv", "from=2025-01-01&to=2025-01-31")).body);

    expect(vacioJson.rows).toEqual([]);
    expect(vacioCsv).toEqual([ENCABEZADOS.income, ["TOTAL", "", "0", "0.00"]]);
  });
});

describe("Sin datos y neutralización de fórmulas", () => {
  test.each(["services", "productivity", "parts-margin", "inventory-rotation"])(
    "%s sin datos devuelve solo los encabezados",
    async (nombre) => {
      const filas = leerCsv((await pedir(nombre, "csv", "from=2025-01-01&to=2025-01-31")).body);

      expect(filas).toEqual([ENCABEZADOS[nombre]]);
    },
  );

  test("un tipo de servicio que empieza con = sale neutralizado en el reporte de servicios", async () => {
    const texto = (await pedir("services", "csv")).body;
    const filas = leerCsv(texto);

    const celdas = filas.slice(1).map((f) => f[0]);
    expect(celdas).toContain("'=SUMA(1;1)");
    expect(celdas.some((c) => c.startsWith("="))).toBe(false);
  });

  test("una refacción que empieza con = sale neutralizada, con comas y comillas bien escapadas", async () => {
    const filas = leerCsv((await pedir("parts-margin", "csv")).body);

    const nombres = filas.slice(1).map((f) => f[1]);
    expect(nombres).toContain("'=1+1 Filtro, \"premium\"");
    for (const tabla of ["parts-margin", "inventory-rotation"]) {
      const celdas = leerCsv((await pedir(tabla, "csv")).body).flat();
      expect(celdas.some((c) => /^[=+\-@]/.test(c) && !/^-?\d+(\.\d+)?$/.test(c))).toBe(false);
    }
  });

  test("los márgenes negativos no se confunden con fórmulas", async () => {
    await poolPrueba.query("UPDATE order_parts SET unit_cost = 400 WHERE unit_cost IS NOT NULL");

    const filas = leerCsv((await pedir("parts-margin", "csv")).body);

    const margenes = filas.slice(1).map((f) => f[5]);
    expect(margenes.some((m) => m.startsWith("-"))).toBe(true);
    expect(margenes.some((m) => m.startsWith("'"))).toBe(false);
  });
});

describe("Permisos y validación", () => {
  test.each(Object.keys(ENCABEZADOS))("%s CSV: recepción y mecánico reciben 403", async (nombre) => {
    for (const headers of [headersRecepcion, headersMecanico]) {
      const respuesta = await request(app)
        .get(`/api/reports/${nombre}?${RANGO}&format=csv`)
        .set(headers);
      expect(respuesta.status).toBe(403);
      expect(respuesta.body.error.code).toBe("FORBIDDEN");
    }
  });

  test.each(Object.keys(ENCABEZADOS))("%s CSV: un rango inválido da 400 en JSON, no un archivo", async (nombre) => {
    const respuesta = await request(app)
      .get(`/api/reports/${nombre}?from=2026-03-10&to=2026-03-01&format=csv`)
      .set(headersAdmin);

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe("VALIDATION_ERROR");
  });

  test("un format desconocido da 400", async () => {
    const respuesta = await request(app)
      .get(`/api/reports/income?${RANGO}&format=xlsx`)
      .set(headersAdmin);

    expect(respuesta.status).toBe(400);
  });
});
