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
  const CLAVES_COSTO = /"(purchasePrice|purchase_price|unitCost|unit_cost|costAmount)"\s*:/;

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
