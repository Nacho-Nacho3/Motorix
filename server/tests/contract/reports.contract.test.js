import request from "supertest";
import { app } from "../../app.js";
import { pool } from "../../config/db.js";
import * as clientes from "../../models/client.model.js";
import * as vehiculos from "../../models/vehicle.model.js";
import { crearPoolDePrueba, aplicarMigraciones, limpiarBaseDePrueba } from "../helpers/db.js";
import { tokenPara, conToken } from "../helpers/usuarios.js";

// T095: contrato de los reportes (specs/007-reportes-configuracion/contracts/reports.md).
// Se amplía con cada reporte; hoy cubre el de ingresos.
let poolPrueba;
let admin;
let headersAdmin;
let headersRecepcion;

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
  const recepcion = await tokenPara({ username: "recepcion", role: "RECEPTIONIST" });
  headersRecepcion = conToken(recepcion.token);
  const mecanico = await tokenPara({ username: "mecanico", role: "MECHANIC" });
  const cliente = await clientes.crear({ name: "Cliente ct", phone: "5566667777", email: "rep@correo.mx" });
  const vehiculo = await vehiculos.crear({
    clientId: cliente.id,
    brand: "Nissan",
    model: "Versa",
    year: 2020,
    licensePlate: "REP0001",
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
      reportedProblem: "Reporte",
    });
  await poolPrueba.query(
    `INSERT INTO payments (order_id, amount, method, status, created_by, created_at, updated_at)
     VALUES (?, 1850.00, 'CASH', 'PAID', ?, '2026-11-03 10:00:00', '2026-11-03 10:00:00')`,
    [orden.body.data.order.id, admin.usuario.id],
  );
});

describe("Contrato de GET /api/reports/income", () => {
  test("responde {ok, data:{from,to,rows,totals,truncated}} con los tipos del contrato", async () => {
    const respuesta = await request(app)
      .get("/api/reports/income?from=2026-11-01&to=2026-11-30")
      .set(headersAdmin);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.ok).toBe(true);
    const { data } = respuesta.body;
    expect(Object.keys(data).sort()).toEqual(["from", "rows", "to", "totals", "truncated"]);
    expect(data.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(data.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(typeof data.truncated).toBe("boolean");
    expect(data.rows[0]).toEqual({
      date: "2026-11-03",
      method: "CASH",
      count: 1,
      total: "1850.00",
    });
    expect(Object.keys(data.totals).sort()).toEqual(["byMethod", "count", "total"]);
    expect(data.totals.total).toMatch(/^\d+\.\d{2}$/);
    expect(data.totals.byMethod[0]).toEqual({ method: "CASH", count: 1, total: "1850.00" });
  });

  test("los importes son cadenas de dos decimales y los conteos enteros", async () => {
    const { body } = await request(app)
      .get("/api/reports/income?from=2026-11-01&to=2026-11-30")
      .set(headersAdmin);

    for (const fila of body.data.rows) {
      expect(fila.total).toMatch(/^\d+\.\d{2}$/);
      expect(Number.isInteger(fila.count)).toBe(true);
    }
    expect(Number.isInteger(body.data.totals.count)).toBe(true);
  });

  test("los errores traen {ok:false, error:{code,message}}", async () => {
    const validacion = await request(app)
      .get("/api/reports/income?from=2026-12-01&to=2026-11-01")
      .set(headersAdmin);
    expect(validacion.status).toBe(400);
    expect(validacion.body).toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR", message: expect.any(String) },
    });

    const prohibido = await request(app).get("/api/reports/income").set(headersRecepcion);
    expect(prohibido.status).toBe(403);
    expect(prohibido.body.error.code).toBe("FORBIDDEN");
  });
});

describe("Contrato de GET /api/reports/services", () => {
  test("rows {serviceTypeId, serviceType, count, amount} y totals {count, amount}", async () => {
    const respuesta = await request(app)
      .get("/api/reports/services?from=2026-11-01&to=2026-11-30")
      .set(headersAdmin);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.ok).toBe(true);
    const { data } = respuesta.body;
    expect(Object.keys(data).sort()).toEqual(["from", "rows", "to", "totals", "truncated"]);
    expect(Object.keys(data.totals).sort()).toEqual(["amount", "count"]);
    expect(data.totals.amount).toMatch(/^\d+\.\d{2}$/);
    expect(Array.isArray(data.rows)).toBe(true);
  });
});

describe("Contrato de GET /api/reports/productivity", () => {
  test("rows {mechanicId, mechanicName, ordersFinished, laborAmount}, totals y approximateDates", async () => {
    const respuesta = await request(app)
      .get("/api/reports/productivity?from=2026-11-01&to=2026-11-30")
      .set(headersAdmin);

    expect(respuesta.status).toBe(200);
    const { data } = respuesta.body;
    expect(Object.keys(data).sort()).toEqual(
      ["approximateDates", "from", "rows", "to", "totals", "truncated"],
    );
    expect(Object.keys(data.totals).sort()).toEqual(["laborAmount", "ordersFinished"]);
    expect(Number.isInteger(data.approximateDates)).toBe(true);
    expect(data.totals.laborAmount).toMatch(/^\d+\.\d{2}$/);
  });

  test("con datos la fila trae los cuatro campos del contrato", async () => {
    const mecanico = await tokenPara({ username: "mecanico-rp", role: "MECHANIC", name: "Mecánico" });
    const cliente = await clientes.crear({ name: "Cliente rp", phone: "5577778888", email: "rp@correo.mx" });
    const vehiculo = await vehiculos.crear({
      clientId: cliente.id,
      brand: "Nissan",
      model: "Versa",
      year: 2020,
      licensePlate: "RP00001",
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
        reportedProblem: "Productividad",
      });
    const id = alta.body.data.order.id;
    await request(app)
      .post(`/api/service-orders/${id}/labor`)
      .set(conToken(mecanico.token))
      .send({ concept: "Mano de obra", hours: 2, hourlyRate: 300 });
    for (const status of ["DIAGNOSIS", "IN_REPAIR", "FINISHED"]) {
      await request(app)
        .patch(`/api/service-orders/${id}/status`)
        .set(conToken(mecanico.token))
        .send({ status });
    }
    await poolPrueba.query("UPDATE service_orders SET finished_at = '2026-11-10 10:00:00' WHERE id = ?", [id]);

    const respuesta = await request(app)
      .get("/api/reports/productivity?from=2026-11-01&to=2026-11-30")
      .set(headersAdmin);

    expect(respuesta.body.data.rows).toEqual([
      {
        mechanicId: mecanico.usuario.id,
        mechanicName: "Mecánico",
        ordersFinished: 1,
        laborAmount: "600.00",
      },
    ]);
  });
});
