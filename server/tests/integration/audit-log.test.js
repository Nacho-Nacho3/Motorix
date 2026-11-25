import request from "supertest";
import { app } from "../../app.js";
import { pool } from "../../config/db.js";
import { rutasAudit } from "../../routes/audit.routes.js";
import * as clientes from "../../models/client.model.js";
import * as vehiculos from "../../models/vehicle.model.js";
import { crearPoolDePrueba, aplicarMigraciones, limpiarBaseDePrueba } from "../helpers/db.js";
import { tokenPara, conToken, loginViaApi, PASSWORD_PRUEBA } from "../helpers/usuarios.js";

// T078: bitácora de acciones sensibles (US10, CA-20, CA-21, SC-011).
let poolPrueba;
let admin;
let headersAdmin;
let headersRecepcion;
let headersMecanico;
let idMecanico;
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
  admin = await tokenPara({ username: "admin", role: "ADMIN", name: "Administrador" });
  headersAdmin = conToken(admin.token);
  headersRecepcion = conToken(
    (await tokenPara({ username: "recepcion", role: "RECEPTIONIST" })).token,
  );
  const mecanico = await tokenPara({ username: "mecanico", role: "MECHANIC" });
  headersMecanico = conToken(mecanico.token);
  idMecanico = mecanico.usuario.id;
});

async function registros(action) {
  const [filas] = await poolPrueba.query(
    `SELECT id, user_id AS userId, actor, action, entity_type AS entityType,
            entity_id AS entityId, detail, created_at AS createdAt
       FROM audit_log ${action ? "WHERE action = ?" : ""} ORDER BY id`,
    action ? [action] : [],
  );
  return filas;
}

const bitacora = (query = "", headers = headersAdmin) =>
  request(app).get(`/api/audit-log${query}`).set(headers);

async function crearParte(extra = {}) {
  contador += 1;
  const respuesta = await request(app)
    .post("/api/parts")
    .set(headersAdmin)
    .send({
      partCode: `AU${String(contador).padStart(5, "0")}`,
      name: "Filtro",
      category: "Motor",
      stockCurrent: 10,
      stockMin: 2,
      purchasePrice: "100.00",
      salePrice: "150.00",
      ...extra,
    });
  expect(respuesta.status).toBe(201);
  return respuesta.body.data.part;
}

async function crearOrden() {
  contador += 1;
  const cliente = await clientes.crear({
    name: `Cliente au${contador}`,
    phone: `55${String(30000000 + contador).slice(-8)}`,
    email: `cliente-au${contador}@correo.mx`,
  });
  const vehiculo = await vehiculos.crear({
    clientId: cliente.id,
    brand: "Nissan",
    model: "Versa",
    year: 2020,
    licensePlate: `A${String(contador).padStart(7, "0")}`,
    vin: null,
    currentMileage: 1000,
  });
  const respuesta = await request(app)
    .post("/api/service-orders")
    .set(headersRecepcion)
    .send({
      clientId: cliente.id,
      vehicleId: vehiculo.id,
      mechanicId: idMecanico,
      entryMileage: 2000,
      reportedProblem: "Auditoría",
    });
  expect(respuesta.status).toBe(201);
  return respuesta.body.data.order;
}

describe("Acciones registradas", () => {
  test("LOGIN_FAILED con usuario existente y con identificador desconocido", async () => {
    await loginViaApi("recepcion", "ClaveMala2026!");
    await loginViaApi("fantasma", "ClaveMala2026!");

    const filas = await registros("LOGIN_FAILED");

    expect(filas).toHaveLength(2);
    expect(filas[0].actor).toBe("recepcion");
    expect(filas[0].userId).not.toBeNull();
    expect(filas[0].detail).toContain("recepcion");
    expect(filas[1].actor).toBe("fantasma");
    expect(filas[1].userId).toBeNull();
    expect(filas[1].createdAt).toBeTruthy();
  });

  test("el identificador de un login fallido se recorta a 100 caracteres", async () => {
    await loginViaApi("x".repeat(300), "ClaveMala2026!");

    const [fila] = await registros("LOGIN_FAILED");

    expect(fila.actor.length).toBeLessThanOrEqual(100);
    expect(fila.detail).not.toContain("x".repeat(101));
  });

  test("ACCOUNT_LOCKED al bloquearse la cuenta, con los minutos", async () => {
    for (let i = 0; i < 5; i += 1) await loginViaApi("recepcion", "ClaveMala2026!");

    const bloqueos = await registros("ACCOUNT_LOCKED");
    const fallos = await registros("LOGIN_FAILED");

    expect(bloqueos).toHaveLength(1);
    expect(bloqueos[0].actor).toBe("recepcion");
    expect(bloqueos[0].detail).toContain("15");
    expect(fallos).toHaveLength(5);
  });

  test("USER_CREATED con el rol, sin contraseña ni hash", async () => {
    const respuesta = await request(app)
      .post("/api/users")
      .set(headersAdmin)
      .send({
        username: "nuevo",
        name: "Usuario Nuevo",
        email: "nuevo@motorix.local",
        password: "Secreta2026!",
        role: "MECHANIC",
      });
    expect(respuesta.status).toBe(201);

    const [fila] = await registros("USER_CREATED");

    expect(fila).toMatchObject({
      actor: "admin",
      userId: admin.usuario.id,
      entityType: "USER",
      entityId: respuesta.body.data.user.id,
    });
    expect(fila.detail).toContain("MECHANIC");
    expect(fila.detail).not.toContain("Secreta2026!");
  });

  test("USER_UPDATED en cambio de rol y en baja o reactivación, y no en otros cambios", async () => {
    const { usuario } = await tokenPara({ username: "otro", role: "RECEPTIONIST" });

    await request(app).patch(`/api/users/${usuario.id}`).set(headersAdmin).send({ role: "MECHANIC" });
    await request(app).patch(`/api/users/${usuario.id}`).set(headersAdmin).send({ active: false });
    await request(app).patch(`/api/users/${usuario.id}`).set(headersAdmin).send({ active: true });
    await request(app).patch(`/api/users/${usuario.id}`).set(headersAdmin).send({ name: "Otro Nombre" });

    const filas = await registros("USER_UPDATED");

    expect(filas).toHaveLength(3);
    expect(filas[0].detail).toContain("RECEPTIONIST");
    expect(filas[0].detail).toContain("MECHANIC");
    expect(filas[0].entityId).toBe(usuario.id);
    expect(filas[1].detail).toContain("campo: active");
    expect(filas[2].detail).toContain("campo: active");
  });

  test("restablecer la contraseña de otro usuario no escribe la contraseña en la bitácora", async () => {
    const { usuario } = await tokenPara({ username: "otro", role: "RECEPTIONIST" });

    await request(app)
      .patch(`/api/users/${usuario.id}`)
      .set(headersAdmin)
      .send({ password: "NuevaClave2026!" });

    const todas = JSON.stringify(await registros());
    expect(todas).not.toContain("NuevaClave2026!");
  });

  test("SETTINGS_UPDATED al cambiar la configuración", async () => {
    await request(app)
      .patch("/api/settings")
      .set(headersAdmin)
      .send({ shop: { name: "Taller Auditado" } });

    const [fila] = await registros("SETTINGS_UPDATED");

    expect(fila.detail).toContain("Taller Auditado");
    expect(fila.entityType).toBe("SETTINGS");
  });

  test("PART_PRICE_CHANGED solo cuando cambia un precio", async () => {
    const parte = await crearParte();

    await request(app).patch(`/api/parts/${parte.id}`).set(headersAdmin).send({ name: "Filtro nuevo" });
    expect(await registros("PART_PRICE_CHANGED")).toHaveLength(0);

    await request(app).patch(`/api/parts/${parte.id}`).set(headersAdmin).send({ salePrice: "180.00" });
    await request(app).patch(`/api/parts/${parte.id}`).set(headersAdmin).send({ purchasePrice: "120.00" });
    // El mismo valor no es un cambio.
    await request(app).patch(`/api/parts/${parte.id}`).set(headersAdmin).send({ salePrice: "180.00" });

    const filas = await registros("PART_PRICE_CHANGED");
    expect(filas).toHaveLength(2);
    expect(filas[0].entityType).toBe("PART");
    expect(filas[0].entityId).toBe(parte.id);
    expect(filas[0].detail).toContain("150.00");
    expect(filas[0].detail).toContain("180.00");
    expect(filas[1].detail).toContain("120.00");
  });

  test("ORDER_PART_PRICE_CORRECTED con el precio anterior y el nuevo", async () => {
    const parte = await crearParte({ salePrice: "200.00" });
    const orden = await crearOrden();
    const uso = await request(app)
      .post(`/api/service-orders/${orden.id}/parts`)
      .set(headersMecanico)
      .send({ partId: parte.id, quantity: 1 });
    expect(uso.status).toBe(201);
    const [[linea]] = await poolPrueba.query("SELECT id FROM order_parts WHERE order_id = ?", [orden.id]);

    const correccion = await request(app)
      .patch(`/api/service-orders/${orden.id}/parts/${linea.id}/price`)
      .set(headersAdmin)
      .send({ unitPrice: "260.00", reason: "Precio capturado de otra pieza" });
    expect(correccion.status).toBe(200);

    const [fila] = await registros("ORDER_PART_PRICE_CORRECTED");

    expect(fila).toMatchObject({ actor: "admin", entityType: "ORDER_PART", entityId: linea.id });
    expect(fila.detail).toContain("200.00");
    expect(fila.detail).toContain("260.00");
  });

  test("PAYMENT_CANCELLED al cancelar un intento de Mercado Pago pendiente", async () => {
    const orden = await crearOrden();
    const [pago] = await poolPrueba.query(
      `INSERT INTO payments (order_id, amount, method, status, created_by)
       VALUES (?, 100, 'MERCADO_PAGO', 'PENDING', ?)`,
      [orden.id, admin.usuario.id],
    );

    const cancelacion = await request(app)
      .post(`/api/service-orders/${orden.id}/payments/${pago.insertId}/cancel`)
      .set(headersAdmin);
    expect(cancelacion.status).toBe(200);

    const [fila] = await registros("PAYMENT_CANCELLED");

    expect(fila).toMatchObject({ actor: "admin", entityType: "PAYMENT", entityId: pago.insertId });
    expect(fila.detail).toContain("100.00");
  });

  test("TERMS_PUBLISHED al publicar una versión nueva", async () => {
    await request(app)
      .post("/api/terms")
      .set(headersAdmin)
      .send({ termsText: "Nuevos", privacyText: "Nuevo aviso" });

    const [fila] = await registros("TERMS_PUBLISHED");

    expect(fila.entityType).toBe("TERMS");
    expect(fila.detail).toContain("2");
  });
});

describe("GET /api/audit-log", () => {
  async function sembrar() {
    await loginViaApi("recepcion", "ClaveMala2026!");
    await request(app).patch("/api/settings").set(headersAdmin).send({ shop: { name: "Uno" } });
    await request(app).patch("/api/settings").set(headersAdmin).send({ shop: { name: "Dos" } });
  }

  test("devuelve los registros del más reciente al más antiguo con su forma", async () => {
    await sembrar();

    const respuesta = await bitacora();

    expect(respuesta.status).toBe(200);
    const { items, total, page, pageSize } = respuesta.body.data;
    expect({ total, page, pageSize }).toEqual({ total: 3, page: 1, pageSize: 50 });
    expect(items.map((i) => i.action)).toEqual([
      "SETTINGS_UPDATED",
      "SETTINGS_UPDATED",
      "LOGIN_FAILED",
    ]);
    expect(Object.keys(items[0]).sort()).toEqual(
      ["action", "actor", "createdAt", "detail", "entityId", "entityType", "id", "userId"],
    );
    expect(items[0].createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
    expect(items[0].id).toBeGreaterThan(items[1].id);
  });

  test("filtra por action, userId y rango de fechas", async () => {
    await sembrar();

    const porAccion = await bitacora("?action=LOGIN_FAILED");
    expect(porAccion.body.data.items).toHaveLength(1);

    const porUsuario = await bitacora(`?userId=${admin.usuario.id}`);
    expect(porUsuario.body.data.items.every((i) => i.userId === admin.usuario.id)).toBe(true);
    expect(porUsuario.body.data.total).toBe(2);

    const hoy = new Date();
    const f = (d) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const ayer = new Date(hoy.getTime() - 86400000);
    const manana = new Date(hoy.getTime() + 86400000);
    expect((await bitacora(`?from=${f(hoy)}&to=${f(hoy)}`)).body.data.total).toBe(3);
    expect((await bitacora(`?from=${f(manana)}`)).body.data.total).toBe(0);
    expect((await bitacora(`?to=${f(ayer)}`)).body.data.total).toBe(0);
  });

  test("pagina con pageSize por omisión de 50 y máximo de 200", async () => {
    await sembrar();

    const pagina = await bitacora("?pageSize=1&page=2");
    expect(pagina.body.data).toMatchObject({ page: 2, pageSize: 1, total: 3 });
    expect(pagina.body.data.items).toHaveLength(1);

    expect((await bitacora("?pageSize=1000")).body.data.pageSize).toBe(200);
  });

  test.each([
    ["from con formato inválido", "?from=2026-13-45"],
    ["from con texto", "?from=ayer"],
    ["to anterior a from", "?from=2026-11-10&to=2026-11-01"],
    ["action fuera del catálogo", "?action=BORRAR_TODO"],
    ["userId no entero", "?userId=abc"],
    ["page cero", "?page=0"],
    ["pageSize cero", "?pageSize=0"],
    ["pageSize no numérico", "?pageSize=x"],
  ])("rechaza %s con 400 VALIDATION_ERROR", async (_n, query) => {
    const respuesta = await bitacora(query);

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe("VALIDATION_ERROR");
  });

  test("solo ADMIN: recepción y mecánico reciben 403", async () => {
    for (const headers of [headersRecepcion, headersMecanico]) {
      const respuesta = await bitacora("", headers);
      expect(respuesta.status).toBe(403);
      expect(respuesta.body.error.code).toBe("FORBIDDEN");
    }
  });
});

describe("Solo inserción (CA-20)", () => {
  test("el router montado solo expone GET", () => {
    const metodos = rutasAudit.stack
      .filter((capa) => capa.route)
      .flatMap((capa) => Object.keys(capa.route.methods));

    expect(metodos.length).toBeGreaterThan(0);
    expect([...new Set(metodos)]).toEqual(["get"]);
  });

  test("ninguna petición de escritura crea, edita ni borra registros", async () => {
    await request(app).patch("/api/settings").set(headersAdmin).send({ shop: { name: "Uno" } });
    const antes = await registros();

    for (const metodo of ["post", "put", "patch", "delete"]) {
      const respuesta = await request(app)[metodo]("/api/audit-log/1").set(headersAdmin).send({ detail: "x" });
      expect([404, 405]).toContain(respuesta.status);
      const sinId = await request(app)[metodo]("/api/audit-log").set(headersAdmin).send({ detail: "x" });
      expect([404, 405]).toContain(sinId.status);
    }

    expect(await registros()).toEqual(antes);
  });
});

describe("Sin datos reservados (CA-21)", () => {
  test("ningún detalle contiene contraseñas, hashes, tokens ni datos de tarjeta", async () => {
    await loginViaApi("recepcion", "ClaveMala2026!");
    const { usuario } = await tokenPara({ username: "otro", role: "RECEPTIONIST" });
    const creado = await request(app)
      .post("/api/users")
      .set(headersAdmin)
      .send({
        username: "secreto",
        name: "Con Secreto",
        email: "secreto@motorix.local",
        password: "Secreta2026!",
        role: "RECEPTIONIST",
      });
    await request(app).patch(`/api/users/${usuario.id}`).set(headersAdmin).send({ role: "MECHANIC", password: "OtraClave2026!" });
    await request(app).patch("/api/settings").set(headersAdmin).send({ shop: { name: "Seguro" } });
    const login = await loginViaApi("admin", PASSWORD_PRUEBA);
    const [[hash]] = await poolPrueba.query("SELECT password_hash AS h FROM users WHERE id = ?", [
      creado.body.data.user.id,
    ]);

    const texto = JSON.stringify(await registros());

    for (const prohibido of [
      "Secreta2026!",
      "ClaveMala2026!",
      "OtraClave2026!",
      PASSWORD_PRUEBA,
      hash.h,
      login.body.data.token,
      "$2a$",
      "$2b$",
    ]) {
      expect(texto).not.toContain(prohibido);
    }
    expect(texto).not.toMatch(/password|passwordHash|token|card|tarjeta/i);
  });
});
