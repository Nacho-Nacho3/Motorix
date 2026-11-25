import request from "supertest";
import { app } from "../../app.js";
import { pool } from "../../config/db.js";
import * as clientes from "../../models/client.model.js";
import * as vehiculos from "../../models/vehicle.model.js";
import { crearPoolDePrueba, aplicarMigraciones, limpiarBaseDePrueba } from "../helpers/db.js";
import { tokenPara, conToken } from "../helpers/usuarios.js";

// T103: servicios más frecuentes y productividad por mecánico (US5, CA-6, CA-7,
// SC-006, D-07, D-19). Se prueban contra sumas independientes de las tablas.
let poolPrueba;
let headersAdmin;
let headersRecepcion;
let mecanicos;
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
  headersAdmin = conToken((await tokenPara({ username: "admin", role: "ADMIN" })).token);
  headersRecepcion = conToken(
    (await tokenPara({ username: "recepcion", role: "RECEPTIONIST" })).token,
  );
  mecanicos = [
    await tokenPara({ username: "mec-ana", role: "MECHANIC", name: "Ana Mecánica" }),
    await tokenPara({ username: "mec-beto", role: "MECHANIC", name: "Beto Mecánico" }),
  ];
});

async function tipo(name) {
  const respuesta = await request(app)
    .post("/api/service-types")
    .set(headersAdmin)
    .send({ name, intervalDays: 90 });
  return respuesta.body.data;
}

/**
 * Orden con servicios (tipo o null) y mano de obra, llevada a `estado`, con la
 * fecha de terminación indicada. `estimada` marca la aproximación de la migración.
 */
async function orden({
  mecanico,
  servicios = [],
  labor = [],
  estado = "FINISHED",
  terminada = "2026-03-10 12:00:00",
  estimada = 0,
}) {
  contador += 1;
  const cliente = await clientes.crear({
    name: `Cliente rp${contador}`,
    phone: `55${String(20000000 + contador).slice(-8)}`,
    email: `cliente-rp${contador}@correo.mx`,
  });
  const vehiculo = await vehiculos.crear({
    clientId: cliente.id,
    brand: "Nissan",
    model: "Versa",
    year: 2020,
    licensePlate: `R${String(contador).padStart(7, "0")}`,
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
      reportedProblem: "Reporte",
    });
  const creada = alta.body.data.order;
  for (const [descripcion, tipoId, precio] of servicios) {
    const respuesta = await request(app)
      .post(`/api/service-orders/${creada.id}/services`)
      .set(conToken(mecanico.token))
      .send({ description: descripcion, unitPrice: precio, ...(tipoId ? { serviceTypeId: tipoId } : {}) });
    expect(respuesta.status).toBe(201);
  }
  for (const [horas, tarifa] of labor) {
    const respuesta = await request(app)
      .post(`/api/service-orders/${creada.id}/labor`)
      .set(conToken(mecanico.token))
      .send({ concept: "Mano de obra", hours: horas, hourlyRate: tarifa });
    expect(respuesta.status).toBe(201);
  }
  const camino = ["DIAGNOSIS", "IN_REPAIR", "FINISHED", "DELIVERED"];
  for (const status of camino.slice(0, camino.indexOf(estado) + 1)) {
    await request(app)
      .patch(`/api/service-orders/${creada.id}/status`)
      .set(status === "DELIVERED" ? headersAdmin : conToken(mecanico.token))
      .send({ status });
  }
  if (terminada) {
    await poolPrueba.query(
      "UPDATE service_orders SET finished_at = ?, finished_at_estimated = ? WHERE id = ?",
      [terminada, estimada, creada.id],
    );
  }
  return creada;
}

const servicios = (query = "?from=2026-03-01&to=2026-03-31", headers = headersAdmin) =>
  request(app).get(`/api/reports/services${query}`).set(headers);
const productividad = (query = "?from=2026-03-01&to=2026-03-31", headers = headersAdmin) =>
  request(app).get(`/api/reports/productivity${query}`).set(headers);

describe("GET /api/reports/services", () => {
  test("agrupa por tipo, ordena de más a menos frecuentes y agrupa las líneas sin tipo", async () => {
    const aceite = await tipo("Cambio de aceite");
    const frenos = await tipo("Revisión de frenos");
    const [ana, beto] = mecanicos;
    await orden({ mecanico: ana, servicios: [["Aceite", aceite.id, 600], ["Frenos", frenos.id, 400], ["Lavado", null, 100]] });
    await orden({ mecanico: beto, servicios: [["Aceite", aceite.id, 650.5], ["Aceite", aceite.id, 600], ["Sin tipo", null, 50.25]] });
    await orden({ mecanico: ana, estado: "DELIVERED", servicios: [["Frenos", frenos.id, 410]] });

    const respuesta = await servicios();

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.rows).toEqual([
      { serviceTypeId: aceite.id, serviceType: "Cambio de aceite", count: 3, amount: "1850.50" },
      { serviceTypeId: frenos.id, serviceType: "Revisión de frenos", count: 2, amount: "810.00" },
      { serviceTypeId: null, serviceType: "Sin tipo de servicio", count: 2, amount: "150.25" },
    ]);
    expect(respuesta.body.data.totals).toEqual({ count: 7, amount: "2810.75" });
  });

  test("coincide al centavo con la suma independiente de order_services", async () => {
    const [ana] = mecanicos;
    await orden({
      mecanico: ana,
      servicios: [["a", null, 0.1], ["b", null, 0.2], ["c", null, 19.99], ["d", null, 19.99], ["e", null, 1234.56]],
    });

    const respuesta = await servicios();

    const [[{ centavos, lineas }]] = await poolPrueba.query(
      `SELECT CAST(ROUND(SUM(os.unit_price) * 100) AS SIGNED) AS centavos, COUNT(*) AS lineas
         FROM order_services os JOIN service_orders o ON o.id = os.order_id
        WHERE o.status IN ('FINISHED','DELIVERED')`,
    );
    expect(respuesta.body.data.totals.amount).toBe((Number(centavos) / 100).toFixed(2));
    expect(respuesta.body.data.totals.count).toBe(Number(lineas));
  });

  test("solo cuentan órdenes terminadas o entregadas con finished_at dentro del rango", async () => {
    const [ana] = mecanicos;
    await orden({ mecanico: ana, servicios: [["dentro", null, 100]] });
    await orden({ mecanico: ana, servicios: [["en curso", null, 500]], estado: "IN_REPAIR", terminada: null });
    await orden({ mecanico: ana, servicios: [["otro mes", null, 700]], terminada: "2026-04-02 09:00:00" });
    await orden({ mecanico: ana, servicios: [["límite inicial", null, 10]], terminada: "2026-03-01 00:00:00" });
    await orden({ mecanico: ana, servicios: [["límite final", null, 20]], terminada: "2026-03-31 23:59:59" });

    const respuesta = await servicios();

    expect(respuesta.body.data.totals).toEqual({ count: 3, amount: "130.00" });
  });

  test("sin órdenes en el periodo: filas vacías y totales en cero", async () => {
    const respuesta = await servicios("?from=2025-01-01&to=2025-01-31");

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toMatchObject({ rows: [], totals: { count: 0, amount: "0.00" }, truncated: false });
  });

  test("un tipo desactivado después de usarse sigue apareciendo con su nombre", async () => {
    const aceite = await tipo("Cambio de aceite");
    await orden({ mecanico: mecanicos[0], servicios: [["Aceite", aceite.id, 100]] });
    await request(app).patch(`/api/service-types/${aceite.id}`).set(headersAdmin).send({ active: false });

    const respuesta = await servicios();

    expect(respuesta.body.data.rows[0].serviceType).toBe("Cambio de aceite");
  });
});

describe("GET /api/reports/productivity", () => {
  test("cuenta las órdenes terminadas por mecánico y suma su mano de obra con la regla del total", async () => {
    const [ana, beto] = mecanicos;
    await orden({ mecanico: ana, labor: [[1.33, 99.99], [2, 300]] });
    await orden({ mecanico: ana, labor: [[0.5, 200]], estado: "DELIVERED" });
    await orden({ mecanico: beto, labor: [[3, 150.5]] });

    const respuesta = await productividad();

    expect(respuesta.status).toBe(200);
    const { rows, totals, approximateDates } = respuesta.body.data;
    expect(rows).toEqual([
      { mechanicId: ana.usuario.id, mechanicName: "Ana Mecánica", ordersFinished: 2, laborAmount: "832.99" },
      { mechanicId: beto.usuario.id, mechanicName: "Beto Mecánico", ordersFinished: 1, laborAmount: "451.50" },
    ]);
    expect(totals).toEqual({ ordersFinished: 3, laborAmount: "1284.49" });
    expect(approximateDates).toBe(0);
  });

  test("coincide al centavo con una suma independiente de order_labor (redondeo por línea)", async () => {
    const [ana, beto] = mecanicos;
    await orden({ mecanico: ana, labor: [[1.33, 99.99], [0.33, 33.33], [2.67, 12.34]] });
    await orden({ mecanico: beto, labor: [[7.77, 11.11], [0.01, 0.99]] });

    const respuesta = await productividad();

    const [[{ centavos }]] = await poolPrueba.query(
      `SELECT CAST(SUM(ROUND(ol.hours * ol.hourly_rate * 100)) AS SIGNED) AS centavos
         FROM order_labor ol JOIN service_orders o ON o.id = ol.order_id
        WHERE o.status IN ('FINISHED','DELIVERED')`,
    );
    expect(respuesta.body.data.totals.laborAmount).toBe((Number(centavos) / 100).toFixed(2));
    const suma = respuesta.body.data.rows.reduce((s, f) => s + Math.round(Number(f.laborAmount) * 100), 0);
    expect(suma).toBe(Number(centavos));
  });

  test("la mano de obra coincide con el laborSubtotal que calcula el total de la orden", async () => {
    const [ana] = mecanicos;
    const creada = await orden({ mecanico: ana, labor: [[1.33, 99.99], [0.33, 33.33]] });

    const reporte = await productividad();
    const total = await request(app).get(`/api/service-orders/${creada.id}/total`).set(headersAdmin);

    const subtotal = total.body.data.laborSubtotal ?? total.body.data.totals?.laborSubtotal;
    expect(reporte.body.data.rows[0].laborAmount).toBe(subtotal);
  });

  test("un mecánico con órdenes sin mano de obra aparece con 0.00", async () => {
    await orden({ mecanico: mecanicos[0] });

    const respuesta = await productividad();

    expect(respuesta.body.data.rows).toEqual([
      expect.objectContaining({ ordersFinished: 1, laborAmount: "0.00" }),
    ]);
  });

  test("las órdenes sin terminar o fuera del rango no cuentan", async () => {
    const [ana] = mecanicos;
    await orden({ mecanico: ana, labor: [[1, 100]] });
    await orden({ mecanico: ana, labor: [[1, 900]], estado: "IN_REPAIR", terminada: null });
    await orden({ mecanico: ana, labor: [[1, 800]], terminada: "2026-02-28 23:59:59" });

    const respuesta = await productividad();

    expect(respuesta.body.data.totals).toEqual({ ordersFinished: 1, laborAmount: "100.00" });
  });

  test("approximateDates cuenta las órdenes del rango con fecha aproximada", async () => {
    const [ana] = mecanicos;
    await orden({ mecanico: ana, estimada: 1 });
    await orden({ mecanico: ana, estimada: 1 });
    await orden({ mecanico: ana, estimada: 0 });
    await orden({ mecanico: ana, estimada: 1, terminada: "2026-05-05 10:00:00" });

    const respuesta = await productividad();

    expect(respuesta.body.data.approximateDates).toBe(2);
    expect(respuesta.body.data.totals.ordersFinished).toBe(3);
  });

  test("sin órdenes: filas vacías, totales en cero y approximateDates 0", async () => {
    const respuesta = await productividad("?from=2025-01-01&to=2025-01-31");

    expect(respuesta.body.data).toMatchObject({
      rows: [],
      totals: { ordersFinished: 0, laborAmount: "0.00" },
      approximateDates: 0,
    });
  });
});

describe("Permisos y validación (CA-6, CA-10)", () => {
  test.each(["services", "productivity"])("%s: recepción y mecánico reciben 403", async (nombre) => {
    for (const headers of [headersRecepcion, conToken(mecanicos[0].token)]) {
      const respuesta = await request(app).get(`/api/reports/${nombre}`).set(headers);
      expect(respuesta.status).toBe(403);
      expect(respuesta.body.error.code).toBe("FORBIDDEN");
    }
  });

  test.each(["services", "productivity"])("%s: rango inválido da 400 VALIDATION_ERROR", async (nombre) => {
    for (const query of ["?from=2026-03-10&to=2026-03-01", "?from=2025-01-01&to=2026-03-01", "?from=x"]) {
      const respuesta = await request(app).get(`/api/reports/${nombre}${query}`).set(headersAdmin);
      expect(respuesta.status).toBe(400);
      expect(respuesta.body.error.code).toBe("VALIDATION_ERROR");
    }
  });

  test.each(["services", "productivity"])("%s: por omisión el mes en curso", async (nombre) => {
    const respuesta = await request(app).get(`/api/reports/${nombre}`).set(headersAdmin);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.from).toMatch(/-01$/);
  });
});
