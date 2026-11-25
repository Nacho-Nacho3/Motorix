import request from "supertest";
import { app } from "../../app.js";
import { pool } from "../../config/db.js";
import { ACCIONES } from "../../utils/audit-detail.js";
import { crearPoolDePrueba, aplicarMigraciones, limpiarBaseDePrueba } from "../helpers/db.js";
import { tokenPara, conToken } from "../helpers/usuarios.js";

// T083: contrato de la bitácora (specs/007-reportes-configuracion/contracts/audit-log.md).
let poolPrueba;
let headersAdmin;
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
  headersAdmin = conToken((await tokenPara({ username: "admin", role: "ADMIN" })).token);
  headersMecanico = conToken((await tokenPara({ username: "mecanico", role: "MECHANIC" })).token);
  await request(app).patch("/api/settings").set(headersAdmin).send({ shop: { name: "Contrato" } });
});

describe("Contrato de GET /api/audit-log", () => {
  test("responde {ok, data:{page,pageSize,total,items}} con los campos del contrato", async () => {
    const respuesta = await request(app).get("/api/audit-log").set(headersAdmin);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.ok).toBe(true);
    expect(Object.keys(respuesta.body.data).sort()).toEqual(["items", "page", "pageSize", "total"]);
    const [item] = respuesta.body.data.items;
    expect(item).toEqual({
      id: expect.any(Number),
      createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/),
      userId: expect.any(Number),
      actor: "admin",
      action: "SETTINGS_UPDATED",
      entityType: "SETTINGS",
      entityId: null,
      detail: expect.any(String),
    });
  });

  test("el catálogo de acciones tiene exactamente las nueve del contrato", () => {
    expect([...ACCIONES].sort()).toEqual(
      [
        "ACCOUNT_LOCKED",
        "LOGIN_FAILED",
        "ORDER_PART_PRICE_CORRECTED",
        "PART_PRICE_CHANGED",
        "PAYMENT_CANCELLED",
        "SETTINGS_UPDATED",
        "TERMS_PUBLISHED",
        "USER_CREATED",
        "USER_UPDATED",
      ],
    );
  });

  test("cada acción del catálogo es un filtro válido", async () => {
    for (const action of ACCIONES) {
      const respuesta = await request(app).get(`/api/audit-log?action=${action}`).set(headersAdmin);
      expect(respuesta.status).toBe(200);
    }
  });

  test("los errores traen {ok:false, error:{code,message}}", async () => {
    const validacion = await request(app).get("/api/audit-log?action=NO_EXISTE").set(headersAdmin);
    expect(validacion.status).toBe(400);
    expect(validacion.body).toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR", message: expect.any(String) },
    });

    const prohibido = await request(app).get("/api/audit-log").set(headersMecanico);
    expect(prohibido.status).toBe(403);
    expect(prohibido.body.error.code).toBe("FORBIDDEN");
  });
});
