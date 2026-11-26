import request from "supertest";
import { app } from "../../app.js";
import { pool } from "../../config/db.js";
import * as clientes from "../../models/client.model.js";
import * as vehiculos from "../../models/vehicle.model.js";
import { crearPoolDePrueba, aplicarMigraciones, limpiarBaseDePrueba } from "../helpers/db.js";
import { tokenPara, conToken } from "../helpers/usuarios.js";

// T081: ninguna respuesta expone datos reservados (US10, CA-24, SC-013).
let poolPrueba;
let tokens;
let idOrden;
let idParte;
let idMecanico;

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
  const admin = await tokenPara({ username: "admin", role: "ADMIN" });
  const recepcion = await tokenPara({ username: "recepcion", role: "RECEPTIONIST" });
  const mecanico = await tokenPara({ username: "mecanico", role: "MECHANIC" });
  idMecanico = mecanico.usuario.id;
  tokens = {
    ADMIN: conToken(admin.token),
    RECEPTIONIST: conToken(recepcion.token),
    MECHANIC: conToken(mecanico.token),
  };

  const cliente = await clientes.crear({ name: "Cliente ex", phone: "5533334444", email: "ex@correo.mx" });
  const vehiculo = await vehiculos.crear({
    clientId: cliente.id,
    brand: "Nissan",
    model: "Versa",
    year: 2020,
    licensePlate: "EXP0001",
    vin: null,
    currentMileage: 1000,
  });
  const parte = await request(app)
    .post("/api/parts")
    .set(tokens.ADMIN)
    .send({
      partCode: "EXP-001",
      name: "Balatas",
      category: "Frenos",
      stockCurrent: 10,
      stockMin: 2,
      purchasePrice: "321.45",
      salePrice: "850.00",
    });
  idParte = parte.body.data.part.id;
  const orden = await request(app)
    .post("/api/service-orders")
    .set(tokens.RECEPTIONIST)
    .send({
      clientId: cliente.id,
      vehicleId: vehiculo.id,
      mechanicId: idMecanico,
      entryMileage: 2000,
      reportedProblem: "Exposición",
    });
  idOrden = orden.body.data.order.id;
  await request(app)
    .post(`/api/service-orders/${idOrden}/parts`)
    .set(tokens.MECHANIC)
    .send({ partId: idParte, quantity: 1 });
  await request(app)
    .post(`/api/service-orders/${idOrden}/services`)
    .set(tokens.MECHANIC)
    .send({ description: "Servicio", unitPrice: 100 });
  for (const status of ["DIAGNOSIS", "IN_REPAIR", "FINISHED"]) {
    await request(app)
      .patch(`/api/service-orders/${idOrden}/status`)
      .set(tokens.MECHANIC)
      .send({ status });
  }
  await request(app).post(`/api/service-orders/${idOrden}/ticket`).set(tokens.RECEPTIONIST);
  await request(app)
    .post(`/api/service-orders/${idOrden}/payments`)
    .set(tokens.RECEPTIONIST)
    .send({ method: "CASH" });
});

/** Endpoints de lectura de usuarios, refacciones, órdenes, pagos y tickets. */
const LECTURAS = () => [
  "/api/users",
  `/api/users/1`,
  "/api/parts",
  "/api/parts/lookup",
  `/api/parts/${idParte}/movements`,
  "/api/service-orders",
  `/api/service-orders/${idOrden}`,
  `/api/service-orders/${idOrden}/parts`,
  `/api/service-orders/${idOrden}/total`,
  `/api/service-orders/${idOrden}/payments`,
  `/api/service-orders/${idOrden}/ticket`,
  "/api/auth/me",
  "/api/dashboard",
  "/api/notifications",
];

const RESERVADOS = /"(password|passwordHash|password_hash|token|hash)"\s*:/i;
const CLAVES_COSTO = /"(purchasePrice|purchase_price|unitCost|unit_cost|costAmount)"\s*:/;

describe("Sin contraseñas, hashes ni tokens (CA-24)", () => {
  for (const rol of ["ADMIN", "RECEPTIONIST", "MECHANIC"]) {
    test(`ninguna respuesta de lectura expone datos de autenticación al rol ${rol}`, async () => {
      for (const ruta of LECTURAS()) {
        const respuesta = await request(app).get(ruta).set(tokens[rol]);
        const texto = JSON.stringify(respuesta.body);

        expect(texto).not.toMatch(RESERVADOS);
        expect(texto).not.toContain("$2a$");
        expect(texto).not.toContain("$2b$");
      }
    });
  }

  test("las respuestas de alta y edición de usuarios tampoco las exponen", async () => {
    const alta = await request(app)
      .post("/api/users")
      .set(tokens.ADMIN)
      .send({
        username: "nuevo",
        name: "Nuevo",
        email: "nuevo@motorix.local",
        password: "Secreta2026!",
        role: "MECHANIC",
      });
    const edicion = await request(app)
      .patch(`/api/users/${alta.body.data.user.id}`)
      .set(tokens.ADMIN)
      .send({ password: "OtraClave2026!" });

    for (const respuesta of [alta, edicion]) {
      const texto = JSON.stringify(respuesta.body);
      expect(texto).not.toMatch(RESERVADOS);
      expect(texto).not.toContain("Secreta2026!");
      expect(texto).not.toContain("OtraClave2026!");
    }
  });

  test("solo el login devuelve un token", async () => {
    const login = await request(app)
      .post("/api/auth/login")
      .send({ identifier: "admin", password: "Prueba2026!" });

    expect(login.body.data.token).toEqual(expect.any(String));
    const me = await request(app).get("/api/auth/me").set(tokens.ADMIN);
    expect(JSON.stringify(me.body)).not.toMatch(/"token"/);
  });
});

describe("Precios reservados al rol (CA-24)", () => {
  test("ADMIN recibe el precio de compra de las refacciones", async () => {
    const respuesta = await request(app).get("/api/parts").set(tokens.ADMIN);

    expect(JSON.stringify(respuesta.body)).toContain("321.45");
  });

  test("recepción y mecánico no reciben precios de compra ni costos en ningún endpoint", async () => {
    for (const rol of ["RECEPTIONIST", "MECHANIC"]) {
      for (const ruta of LECTURAS()) {
        const respuesta = await request(app).get(ruta).set(tokens[rol]);
        const texto = JSON.stringify(respuesta.body);

        expect(texto).not.toMatch(CLAVES_COSTO);
        expect(texto).not.toContain("321.45");
      }
    }
  });

  test("el catálogo de refacciones y los reportes de costo son solo para ADMIN", async () => {
    for (const rol of ["RECEPTIONIST", "MECHANIC"]) {
      const catalogo = await request(app).get("/api/parts").set(tokens[rol]);
      expect(catalogo.status).toBe(403);
    }
  });
});

// T132: la misma comprobación sobre las respuestas de escritura de usuarios,
// refacciones, órdenes, pagos y tickets (CA-24: «cada endpoint»).
describe("Respuestas de escritura (CA-24)", () => {
  /** Llama al endpoint, exige que tenga éxito y devuelve la respuesta. */
  async function escribir(rol, metodo, ruta, cuerpo) {
    const peticion = request(app)[metodo](ruta).set(tokens[rol]);
    const respuesta = await (cuerpo ? peticion.send(cuerpo) : peticion);
    const texto = JSON.stringify(respuesta.body);

    expect([ruta, respuesta.status < 300]).toEqual([ruta, true]);
    expect(texto).not.toMatch(RESERVADOS);
    expect(texto).not.toContain("$2a$");
    expect(texto).not.toContain("$2b$");
    if (rol !== "ADMIN") {
      expect(texto).not.toMatch(CLAVES_COSTO);
      expect(texto).not.toContain("321.45");
    }
    return respuesta;
  }

  test("órdenes, tickets y pagos no exponen datos reservados a recepción ni al mecánico", async () => {
    const [[base]] = await poolPrueba.query(
      "SELECT client_id, vehicle_id FROM service_orders WHERE id = ?",
      [idOrden],
    );
    const alta = await escribir("RECEPTIONIST", "post", "/api/service-orders", {
      clientId: base.client_id,
      vehicleId: base.vehicle_id,
      mechanicId: idMecanico,
      entryMileage: 3000,
      reportedProblem: "Segunda visita",
    });
    const orden = `/api/service-orders/${alta.body.data.order.id}`;

    await escribir("RECEPTIONIST", "patch", orden, { reportedProblem: "Ruido" });
    await escribir("MECHANIC", "patch", `${orden}/work`, { diagnosis: "Revisión" });
    const conServicio = await escribir("MECHANIC", "post", `${orden}/services`, {
      description: "Ajuste",
      unitPrice: 50,
    });
    const conObra = await escribir("MECHANIC", "post", `${orden}/labor`, {
      concept: "Mano de obra",
      hours: 1,
      hourlyRate: 100,
    });
    await escribir("MECHANIC", "post", `${orden}/parts`, { partId: idParte, quantity: 1 });

    const [[servicio]] = await poolPrueba.query(
      "SELECT MAX(id) AS id FROM order_services WHERE order_id = ?",
      [alta.body.data.order.id],
    );
    const [[obra]] = await poolPrueba.query(
      "SELECT MAX(id) AS id FROM order_labor WHERE order_id = ?",
      [alta.body.data.order.id],
    );
    expect(conServicio.body.ok && conObra.body.ok).toBe(true);
    await escribir("MECHANIC", "delete", `${orden}/services/${servicio.id}`);
    await escribir("MECHANIC", "delete", `${orden}/labor/${obra.id}`);

    for (const status of ["DIAGNOSIS", "IN_REPAIR", "FINISHED"]) {
      await escribir("MECHANIC", "patch", `${orden}/status`, { status });
    }
    await escribir("RECEPTIONIST", "post", `${orden}/ticket`);

    const [pendiente] = await poolPrueba.query(
      `INSERT INTO payments (order_id, amount, method, status, created_by)
       VALUES (?, '850.00', 'MERCADO_PAGO', 'PENDING', ?)`,
      [alta.body.data.order.id, idMecanico],
    );
    await escribir("RECEPTIONIST", "post", `${orden}/payments/${pendiente.insertId}/cancel`);
    await escribir("RECEPTIONIST", "post", `${orden}/payments`, { method: "CASH" });
  });

  test("las escrituras de refacciones y de precios del administrador no exponen datos de acceso", async () => {
    await escribir("ADMIN", "patch", `/api/parts/${idParte}`, { salePrice: "900.00" });
    await escribir("ADMIN", "post", `/api/parts/${idParte}/movements`, {
      movementType: "IN",
      quantity: 2,
    });
    const [[linea]] = await poolPrueba.query(
      "SELECT id FROM order_parts WHERE order_id = ? LIMIT 1",
      [idOrden],
    );
    await poolPrueba.query("DELETE FROM payments WHERE order_id = ?", [idOrden]);
    await escribir(
      "ADMIN",
      "patch",
      `/api/service-orders/${idOrden}/parts/${linea.id}/price`,
      { unitPrice: "875.00", reason: "Precio capturado con error" },
    );
  });
});
