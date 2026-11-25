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
