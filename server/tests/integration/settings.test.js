import request from "supertest";
import { app } from "../../app.js";
import { pool } from "../../config/db.js";
import { crearPoolDePrueba, aplicarMigraciones, limpiarBaseDePrueba } from "../helpers/db.js";
import { tokenPara, conToken } from "../helpers/usuarios.js";

// T020: configuración del taller por la API (US1, CA-1, CA-3, CA-10).
let poolPrueba;
let headersAdmin;
let headersRecepcion;
let headersMecanico;

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
  headersAdmin = conToken(
    (await tokenPara({ username: "admin", role: "ADMIN", name: "Administración" })).token,
  );
  headersRecepcion = conToken(
    (await tokenPara({ username: "recepcion", role: "RECEPTIONIST" })).token,
  );
  headersMecanico = conToken((await tokenPara({ username: "mecanico", role: "MECHANIC" })).token);
});

const obtener = (headers = headersAdmin) => request(app).get("/api/settings").set(headers);
const modificar = (cuerpo, headers = headersAdmin) =>
  request(app).patch("/api/settings").set(headers).send(cuerpo);

async function bitacora(action = "SETTINGS_UPDATED") {
  const [filas] = await poolPrueba.query(
    "SELECT actor, user_id AS userId, action, detail FROM audit_log WHERE action = ? ORDER BY id",
    [action],
  );
  return filas;
}

describe("GET /api/settings", () => {
  test("sin valores guardados devuelve los valores de respaldo", async () => {
    const respuesta = await obtener();

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toEqual({
      shop: { name: "Motorix", address: null, phone: null },
      maintenance: { warnDays: 30, warnKm: 500 },
      defaults: {
        shop: { name: "Motorix", address: null, phone: null },
        maintenance: { warnDays: 30, warnKm: 500 },
      },
    });
  });

  test("recepción y mecánico reciben 403 FORBIDDEN", async () => {
    for (const headers of [headersRecepcion, headersMecanico]) {
      const respuesta = await obtener(headers);
      expect(respuesta.status).toBe(403);
      expect(respuesta.body.error.code).toBe("FORBIDDEN");
    }
  });

  test("sin token responde 401", async () => {
    const respuesta = await request(app).get("/api/settings");
    expect(respuesta.status).toBe(401);
  });
});

describe("PATCH /api/settings", () => {
  test("guarda de forma parcial y devuelve el objeto completo", async () => {
    const respuesta = await modificar({
      shop: { name: "Taller Pérez", phone: "3511234567" },
    });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.shop).toEqual({
      name: "Taller Pérez",
      address: null,
      phone: "3511234567",
    });
    expect(respuesta.body.data.maintenance).toEqual({ warnDays: 30, warnKm: 500 });

    const despues = await modificar({ shop: { address: "Av. Juárez 120" } });
    expect(despues.body.data.shop).toEqual({
      name: "Taller Pérez",
      address: "Av. Juárez 120",
      phone: "3511234567",
    });
    expect((await obtener()).body.data.shop.name).toBe("Taller Pérez");
  });

  test("una dirección vacía se guarda como sin dirección", async () => {
    await modificar({ shop: { address: "Av. Juárez 120" } });

    const respuesta = await modificar({ shop: { address: "" } });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.shop.address).toBeNull();
  });

  test.each([
    ["nombre vacío", { shop: { name: "" } }],
    ["nombre de más de 100 caracteres", { shop: { name: "N".repeat(101) } }],
    ["dirección de más de 200 caracteres", { shop: { address: "D".repeat(201) } }],
    ["teléfono de más de 30 caracteres", { shop: { phone: "1".repeat(31) } }],
    ["cuerpo vacío", {}],
    ["shop vacío", { shop: {} }],
    ["clave desconocida", { shop: { name: "Ok", color: "rojo" } }],
    ["sección desconocida", { otra: { x: 1 } }],
  ])("rechaza %s con 400 VALIDATION_ERROR y conserva el valor anterior", async (_n, cuerpo) => {
    await modificar({ shop: { name: "Taller Previo" } });

    const respuesta = await modificar(cuerpo);

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe("VALIDATION_ERROR");
    expect(respuesta.body.error.message).toMatch(/[a-záéíóú]/i);
    expect((await obtener()).body.data.shop.name).toBe("Taller Previo");
  });

  test("recepción y mecánico reciben 403 y no se escribe nada", async () => {
    for (const headers of [headersRecepcion, headersMecanico]) {
      const respuesta = await modificar({ shop: { name: "Intruso" } }, headers);
      expect(respuesta.status).toBe(403);
      expect(respuesta.body.error.code).toBe("FORBIDDEN");
    }
    expect((await obtener()).body.data.shop.name).toBe("Motorix");
    expect(await bitacora()).toHaveLength(0);
  });

  test("cada cambio escribe SETTINGS_UPDATED con el valor anterior y el nuevo", async () => {
    await modificar({ shop: { name: "Taller Uno" } });
    await modificar({ shop: { name: "Taller Dos" } });

    const filas = await bitacora();

    expect(filas).toHaveLength(2);
    expect(filas[0].actor).toBe("admin");
    expect(filas[0].detail).toContain("shop.name");
    expect(filas[0].detail).toContain("Motorix");
    expect(filas[0].detail).toContain("Taller Uno");
    expect(filas[1].detail).toContain("Taller Uno");
    expect(filas[1].detail).toContain("Taller Dos");
  });

  test("un valor igual al guardado no genera registro", async () => {
    await modificar({ shop: { name: "Taller Uno" } });
    await modificar({ shop: { name: "Taller Uno" } });

    expect(await bitacora()).toHaveLength(1);
  });
});
