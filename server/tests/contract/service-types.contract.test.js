import request from "supertest";
import { app } from "../../app.js";
import { pool } from "../../config/db.js";
import { crearPoolDePrueba, aplicarMigraciones, limpiarBaseDePrueba } from "../helpers/db.js";
import { tokenPara, conToken } from "../helpers/usuarios.js";

// T044: contrato de tipos de servicio
// (specs/007-reportes-configuracion/contracts/service-types.md y
// changes-to-existing.md para los servicios de la orden).
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
});

const CAMPOS_TIPO = ["active", "id", "intervalDays", "intervalKm", "name", "usedInServices"];

describe("Contrato de /api/service-types", () => {
  test("POST responde 201 con el sobre {ok,data} y los campos del contrato", async () => {
    const respuesta = await request(app)
      .post("/api/service-types")
      .set(headersAdmin)
      .send({ name: "Cambio de aceite", intervalDays: 180, intervalKm: 5000 });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.ok).toBe(true);
    expect(Object.keys(respuesta.body.data).sort()).toEqual(CAMPOS_TIPO);
    expect(typeof respuesta.body.data.active).toBe("boolean");
    expect(respuesta.body.data.usedInServices).toBe(0);
  });

  test("GET responde un arreglo con los mismos campos", async () => {
    await request(app)
      .post("/api/service-types")
      .set(headersAdmin)
      .send({ name: "Afinación", intervalKm: 10000 });

    const respuesta = await request(app).get("/api/service-types").set(headersAdmin);

    expect(respuesta.status).toBe(200);
    expect(Array.isArray(respuesta.body.data)).toBe(true);
    expect(Object.keys(respuesta.body.data[0]).sort()).toEqual(CAMPOS_TIPO);
  });

  test("PATCH responde 200 con el tipo actualizado", async () => {
    const { id } = (
      await request(app)
        .post("/api/service-types")
        .set(headersAdmin)
        .send({ name: "Afinación", intervalKm: 10000 })
    ).body.data;

    const respuesta = await request(app)
      .patch(`/api/service-types/${id}`)
      .set(headersAdmin)
      .send({ active: false });

    expect(respuesta.status).toBe(200);
    expect(Object.keys(respuesta.body.data).sort()).toEqual(CAMPOS_TIPO);
  });

  test("los errores traen {ok:false, error:{code,message}} en español", async () => {
    const validacion = await request(app)
      .post("/api/service-types")
      .set(headersAdmin)
      .send({ name: "X" });
    expect(validacion.status).toBe(400);
    expect(validacion.body.ok).toBe(false);
    expect(validacion.body.error.code).toBe("VALIDATION_ERROR");
    expect(Array.isArray(validacion.body.error.details)).toBe(true);

    await request(app)
      .post("/api/service-types")
      .set(headersAdmin)
      .send({ name: "Repetido", intervalDays: 1 });
    const repetido = await request(app)
      .post("/api/service-types")
      .set(headersAdmin)
      .send({ name: "repetido", intervalDays: 1 });
    expect(repetido.status).toBe(409);
    expect(repetido.body.error.code).toBe("SERVICE_TYPE_NAME_TAKEN");
    expect(typeof repetido.body.error.message).toBe("string");
  });

  test("lookup responde {id, name, intervalDays, intervalKm} solo con activos", async () => {
    await request(app)
      .post("/api/service-types")
      .set(headersAdmin)
      .send({ name: "Aceite", intervalDays: 180 });

    const respuesta = await request(app)
      .get("/api/service-types/lookup")
      .set(headersMecanico);

    expect(respuesta.status).toBe(200);
    expect(Object.keys(respuesta.body.data[0]).sort()).toEqual(
      ["id", "intervalDays", "intervalKm", "name"],
    );
  });

  test("403 FORBIDDEN para el listado con un rol distinto de ADMIN", async () => {
    const respuesta = await request(app).get("/api/service-types").set(headersMecanico);

    expect(respuesta.status).toBe(403);
    expect(respuesta.body.error.code).toBe("FORBIDDEN");
  });
});
