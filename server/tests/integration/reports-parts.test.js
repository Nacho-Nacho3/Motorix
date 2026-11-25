import request from "supertest";
import { app } from "../../app.js";
import { pool } from "../../config/db.js";
import * as clientes from "../../models/client.model.js";
import * as vehiculos from "../../models/vehicle.model.js";
import { crearPoolDePrueba, aplicarMigraciones, limpiarBaseDePrueba } from "../helpers/db.js";
import { tokenPara, conToken } from "../helpers/usuarios.js";

// T111: costo y margen de refacciones y rotación de inventario (US6, CA-6, CA-8,
// SC-006, D-05, D-08). Se prueban contra sumas independientes de las tablas.
let poolPrueba;
let admin;
let headersAdmin;
let headersRecepcion;
let headersMecanico;
let mecanico;
let contador = 0;

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
  mecanico = await tokenPara({ username: "mecanico", role: "MECHANIC" });
  headersMecanico = conToken(mecanico.token);
});

async function parte(codigo, nombre, { compra = "100.00", venta = "250.00", stock = 50 } = {}) {
  const respuesta = await request(app)
    .post("/api/parts")
    .set(headersAdmin)
    .send({
      partCode: codigo,
      name: nombre,
      category: "Motor",
      stockCurrent: stock,
      stockMin: 1,
      purchasePrice: compra,
      salePrice: venta,
    });
  expect(respuesta.status).toBe(201);
  return respuesta.body.data.part;
}

/** Orden terminada el día indicado con una línea por cada [parte, cantidad]. */
async function orden(lineas, terminada = "2026-03-10 12:00:00") {
  contador += 1;
  const cliente = await clientes.crear({
    name: `Cliente mg${contador}`,
    phone: `55${String(40000000 + contador).slice(-8)}`,
    email: `cliente-mg${contador}@correo.mx`,
  });
  const vehiculo = await vehiculos.crear({
    clientId: cliente.id,
    brand: "Nissan",
    model: "Versa",
    year: 2020,
    licensePlate: `G${String(contador).padStart(7, "0")}`,
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
      reportedProblem: "Margen",
    });
  const id = alta.body.data.order.id;
  for (const [p, cantidad] of lineas) {
    const uso = await request(app)
      .post(`/api/service-orders/${id}/parts`)
      .set(headersMecanico)
      .send({ partId: p.id, quantity: cantidad });
    expect(uso.status).toBe(201);
  }
  for (const status of ["DIAGNOSIS", "IN_REPAIR", "FINISHED"]) {
    await request(app).patch(`/api/service-orders/${id}/status`).set(headersMecanico).send({ status });
  }
  if (terminada) {
    await poolPrueba.query("UPDATE service_orders SET finished_at = ? WHERE id = ?", [terminada, id]);
  }
  return id;
}

const margen = (query = "?from=2026-03-01&to=2026-03-31", headers = headersAdmin) =>
  request(app).get(`/api/reports/parts-margin${query}`).set(headers);
const rotacion = (query = "?from=2026-03-01&to=2026-03-31", headers = headersAdmin) =>
  request(app).get(`/api/reports/inventory-rotation${query}`).set(headers);

describe("GET /api/reports/parts-margin", () => {
  test("calcula ventas, costo y margen por refacción con el costo congelado de cada línea", async () => {
    const filtro = await parte("FIL-002", "Filtro de aceite", { compra: "60.00", venta: "150.00" });
    const balata = await parte("BAL-001", "Balatas", { compra: "400.00", venta: "850.00" });
    await orden([[filtro, 4], [balata, 1]]);
    await orden([[filtro, 2]]);

    const respuesta = await margen();

    expect(respuesta.status).toBe(200);
    // De mayor a menor venta.
    expect(respuesta.body.data.rows).toEqual([
      {
        partId: filtro.id,
        partCode: "FIL-002",
        name: "Filtro de aceite",
        units: 6,
        salesAmount: "900.00",
        costAmount: "360.00",
        marginAmount: "540.00",
        unitsWithoutCost: 0,
        salesWithoutCost: "0.00",
      },
      {
        partId: balata.id,
        partCode: "BAL-001",
        name: "Balatas",
        units: 1,
        salesAmount: "850.00",
        costAmount: "400.00",
        marginAmount: "450.00",
        unitsWithoutCost: 0,
        salesWithoutCost: "0.00",
      },
    ]);
    expect(respuesta.body.data.totals).toEqual({
      units: 7,
      salesAmount: "1750.00",
      costAmount: "760.00",
      marginAmount: "990.00",
      unitsWithoutCost: 0,
      salesWithoutCost: "0.00",
    });
  });

  test("el costo es el de cada línea aunque el precio de compra cambie después", async () => {
    const filtro = await parte("FIL-002", "Filtro", { compra: "60.00", venta: "150.00" });
    await orden([[filtro, 2]]);
    await request(app).patch(`/api/parts/${filtro.id}`).set(headersAdmin).send({ purchasePrice: "100.00" });
    await orden([[filtro, 2]]);

    const respuesta = await margen();

    expect(respuesta.body.data.rows[0].costAmount).toBe("320.00"); // 2×60 + 2×100
  });

  test("las líneas sin costo se excluyen del margen y salen aparte (D-05)", async () => {
    const con = await parte("CON-001", "Con costo", { compra: "100.00", venta: "250.00" });
    const sin = await parte("SIN-001", "Sin costo", { compra: "0.00", venta: "300.00" });
    await orden([[con, 2], [sin, 3]]);
    // Misma refacción con y sin costo: una línea con costo y otra sin.
    await orden([[con, 1]]);
    await poolPrueba.query("UPDATE order_parts SET unit_cost = NULL WHERE part_id = ? ORDER BY id DESC LIMIT 1", [con.id]);

    const { rows, totals } = (await margen()).body.data;

    const filaCon = rows.find((r) => r.partCode === "CON-001");
    expect(filaCon).toMatchObject({
      units: 3,
      salesAmount: "750.00",
      costAmount: "200.00",
      marginAmount: "300.00", // (500 de ventas con costo) − 200
      unitsWithoutCost: 1,
      salesWithoutCost: "250.00",
    });
    const filaSin = rows.find((r) => r.partCode === "SIN-001");
    expect(filaSin).toMatchObject({
      units: 3,
      salesAmount: "900.00",
      costAmount: "0.00",
      marginAmount: "0.00",
      unitsWithoutCost: 3,
      salesWithoutCost: "900.00",
    });
    expect(totals).toMatchObject({
      units: 6,
      salesAmount: "1650.00",
      costAmount: "200.00",
      marginAmount: "300.00",
      unitsWithoutCost: 4,
      salesWithoutCost: "1150.00",
    });
  });

  test("cumple las relaciones del contrato en cada fila y en los totales", async () => {
    const a = await parte("REL-001", "A", { compra: "33.33", venta: "99.99" });
    const b = await parte("REL-002", "B", { compra: "0.00", venta: "12.34" });
    await orden([[a, 3], [b, 2]]);
    await orden([[a, 1]]);
    await poolPrueba.query("UPDATE order_parts SET unit_cost = NULL WHERE part_id = ? ORDER BY id LIMIT 1", [a.id]);

    const { rows, totals } = (await margen()).body.data;

    const c = (texto) => Math.round(Number(texto) * 100);
    for (const fila of [...rows, totals]) {
      // margen = ventas con costo − costo, y ventas con costo = ventas − ventas sin costo.
      const ventasConCosto = c(fila.salesAmount) - c(fila.salesWithoutCost);
      expect(c(fila.marginAmount)).toBe(ventasConCosto - c(fila.costAmount));
      expect(fila.units).toBeGreaterThanOrEqual(fila.unitsWithoutCost);
    }
    expect(totals.units).toBe(rows.reduce((s, f) => s + f.units, 0));
    expect(c(totals.salesAmount)).toBe(rows.reduce((s, f) => s + c(f.salesAmount), 0));
  });

  test("coincide al centavo con una suma independiente de order_parts", async () => {
    const a = await parte("IND-001", "A", { compra: "19.99", venta: "29.99" });
    const b = await parte("IND-002", "B", { compra: "0.33", venta: "0.77" });
    await orden([[a, 7], [b, 13]]);
    await orden([[a, 3], [b, 9]]);

    const { totals } = (await margen()).body.data;

    const [[suma]] = await poolPrueba.query(
      `SELECT CAST(SUM(op.quantity * ROUND(op.unit_price * 100)) AS SIGNED) AS ventas,
              CAST(SUM(op.quantity * ROUND(op.unit_cost * 100)) AS SIGNED) AS costo,
              CAST(SUM(op.quantity) AS SIGNED) AS unidades
         FROM order_parts op JOIN service_orders o ON o.id = op.order_id
        WHERE o.status IN ('FINISHED','DELIVERED')`,
    );
    expect(totals.salesAmount).toBe((Number(suma.ventas) / 100).toFixed(2));
    expect(totals.costAmount).toBe((Number(suma.costo) / 100).toFixed(2));
    expect(totals.marginAmount).toBe(((Number(suma.ventas) - Number(suma.costo)) / 100).toFixed(2));
    expect(totals.units).toBe(Number(suma.unidades));
  });

  test("solo cuentan órdenes terminadas con finished_at dentro del rango", async () => {
    const a = await parte("RNG-001", "A", { compra: "10.00", venta: "20.00" });
    await orden([[a, 1]]);
    await orden([[a, 5]], "2026-04-02 10:00:00");
    await orden([[a, 7]], "2026-02-28 23:59:59");

    const { totals } = (await margen()).body.data;

    expect(totals.units).toBe(1);
  });

  test("sin líneas en el periodo: filas vacías y totales en cero", async () => {
    const { rows, totals, truncated } = (await margen("?from=2025-01-01&to=2025-01-31")).body.data;

    expect(rows).toEqual([]);
    expect(totals).toEqual({
      units: 0,
      salesAmount: "0.00",
      costAmount: "0.00",
      marginAmount: "0.00",
      unitsWithoutCost: 0,
      salesWithoutCost: "0.00",
    });
    expect(truncated).toBe(false);
  });
});

describe("GET /api/reports/inventory-rotation", () => {
  async function movimiento(part, tipo, cantidad, fecha) {
    await poolPrueba.query(
      `INSERT INTO inventory_movements (part_id, movement_type, quantity, created_by, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [part.id, tipo, cantidad, admin.usuario.id, fecha],
    );
  }

  test("reconstruye la existencia desde los movimientos del periodo y los posteriores", async () => {
    const filtro = await parte("ROT-001", "Filtro", { stock: 20 });
    await poolPrueba.query("UPDATE inventory_movements SET created_at = '2026-02-01 08:00:00' WHERE part_id = ?", [filtro.id]);
    await movimiento(filtro, "OUT", 6, "2026-03-10 10:00:00");
    await movimiento(filtro, "ADJUSTMENT", -1, "2026-03-20 10:00:00");
    await movimiento(filtro, "OUT", 2, "2026-04-05 10:00:00"); // posterior al periodo
    await poolPrueba.query("UPDATE parts SET stock_current = 11 WHERE id = ?", [filtro.id]);

    const respuesta = await rotacion();

    expect(respuesta.status).toBe(200);
    // Cierre 11 + 2 = 13; inicio 13 + 6 + 1 = 20; promedio 16.5; salen 6.
    expect(respuesta.body.data.rows).toEqual([
      {
        partId: filtro.id,
        partCode: "ROT-001",
        name: "Filtro",
        unitsOut: 6,
        averageStock: "16.50",
        rotation: "0.36",
      },
    ]);
    expect(respuesta.body.data.totals).toEqual({ unitsOut: 6 });
  });

  test("una refacción que entra y sale por completo dentro del periodo, sin inicio, usa el promedio de inicio y cierre", async () => {
    const agotada = await parte("ROT-002", "Agotada", { stock: 5 });
    await poolPrueba.query("UPDATE inventory_movements SET created_at = '2026-03-02 08:00:00' WHERE part_id = ?", [agotada.id]);
    await movimiento(agotada, "OUT", 5, "2026-03-03 08:00:00");
    await poolPrueba.query("UPDATE parts SET stock_current = 0 WHERE id = ?", [agotada.id]);

    const { rows } = (await rotacion()).body.data;

    const fila = rows.find((r) => r.partCode === "ROT-002");
    // Inicio 0 (antes del IN), cierre 0: la existencia promedio es 0.
    expect(fila.unitsOut).toBe(5);
    expect(fila.averageStock).toBe("0.00");
    expect(fila.rotation).toBeNull();
  });

  test("una refacción sin existencia ni movimientos no aparece; una sin movimientos pero con existencia sí, con rotación 0.00", async () => {
    const quieta = await parte("ROT-003", "Quieta", { stock: 8 });
    await poolPrueba.query("UPDATE inventory_movements SET created_at = '2026-01-01 08:00:00' WHERE part_id = ?", [quieta.id]);
    const vacia = await parte("ROT-004", "Vacía", { stock: 1 });
    await poolPrueba.query("UPDATE inventory_movements SET created_at = '2026-01-01 08:00:00' WHERE part_id = ?", [vacia.id]);
    await movimiento(vacia, "OUT", 1, "2026-01-05 08:00:00");
    await poolPrueba.query("UPDATE parts SET stock_current = 0 WHERE id = ?", [vacia.id]);

    const { rows } = (await rotacion()).body.data;

    expect(rows.map((r) => r.partCode)).toEqual(["ROT-003"]);
    expect(rows[0]).toMatchObject({ unitsOut: 0, averageStock: "8.00", rotation: "0.00" });
  });

  test("sin refacciones el reporte va vacío", async () => {
    const respuesta = await rotacion();

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toMatchObject({ rows: [], totals: { unitsOut: 0 }, truncated: false });
  });
});

describe("Permisos y validación (CA-6, CA-8)", () => {
  test.each(["parts-margin", "inventory-rotation"])("%s: recepción y mecánico reciben 403", async (nombre) => {
    for (const headers of [headersRecepcion, headersMecanico]) {
      const respuesta = await request(app).get(`/api/reports/${nombre}`).set(headers);
      expect(respuesta.status).toBe(403);
      expect(respuesta.body.error.code).toBe("FORBIDDEN");
    }
  });

  test.each(["parts-margin", "inventory-rotation"])("%s: rango inválido da 400", async (nombre) => {
    for (const query of ["?from=2026-03-10&to=2026-03-01", "?from=2025-01-01&to=2026-03-01"]) {
      const respuesta = await request(app).get(`/api/reports/${nombre}${query}`).set(headersAdmin);
      expect(respuesta.status).toBe(400);
      expect(respuesta.body.error.code).toBe("VALIDATION_ERROR");
    }
  });
});
