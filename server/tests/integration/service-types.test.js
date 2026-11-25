import request from "supertest";
import { app } from "../../app.js";
import { pool } from "../../config/db.js";
import { crearPoolDePrueba, aplicarMigraciones, limpiarBaseDePrueba } from "../helpers/db.js";
import { tokenPara, conToken } from "../helpers/usuarios.js";

// T042: catálogo de tipos de servicio (US3, CA-4, CA-10, RN-12). Sin DELETE.
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
  headersAdmin = conToken((await tokenPara({ username: "admin", role: "ADMIN" })).token);
  headersRecepcion = conToken(
    (await tokenPara({ username: "recepcion", role: "RECEPTIONIST" })).token,
  );
  headersMecanico = conToken((await tokenPara({ username: "mecanico", role: "MECHANIC" })).token);
});

const crear = (cuerpo, headers = headersAdmin) =>
  request(app).post("/api/service-types").set(headers).send(cuerpo);
const editar = (id, cuerpo, headers = headersAdmin) =>
  request(app).patch(`/api/service-types/${id}`).set(headers).send(cuerpo);
const listar = (query = "", headers = headersAdmin) =>
  request(app).get(`/api/service-types${query}`).set(headers);

const ACEITE = { name: "Cambio de aceite", intervalDays: 180, intervalKm: 5000 };

describe("Alta de tipos de servicio", () => {
  test("crea con nombre e intervalos y responde 201 con usedInServices 0", async () => {
    const respuesta = await crear(ACEITE);

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data).toMatchObject({
      name: "Cambio de aceite",
      intervalDays: 180,
      intervalKm: 5000,
      active: true,
      usedInServices: 0,
    });
    expect(typeof respuesta.body.data.id).toBe("number");
  });

  test("acepta un solo intervalo (días o kilómetros)", async () => {
    const dias = await crear({ name: "Revisión de frenos", intervalDays: 180 });
    const km = await crear({ name: "Afinación", intervalKm: 10000 });

    expect(dias.status).toBe(201);
    expect(dias.body.data.intervalKm).toBeNull();
    expect(km.status).toBe(201);
    expect(km.body.data.intervalDays).toBeNull();
  });

  test("un nombre repetido, sin distinguir mayúsculas, da 409 SERVICE_TYPE_NAME_TAKEN", async () => {
    await crear(ACEITE);

    const repetido = await crear({ ...ACEITE, name: "CAMBIO DE ACEITE" });

    expect(repetido.status).toBe(409);
    expect(repetido.body.error.code).toBe("SERVICE_TYPE_NAME_TAKEN");
    expect((await listar()).body.data).toHaveLength(1);
  });

  test.each([
    ["sin ningún intervalo", { name: "X" }],
    ["intervalo en días de 0", { name: "X", intervalDays: 0 }],
    ["intervalo en km negativo", { name: "X", intervalKm: -5 }],
    ["intervalo no entero", { name: "X", intervalDays: 10.5 }],
    ["más de 3650 días", { name: "X", intervalDays: 3651 }],
    ["más de 1,000,000 km", { name: "X", intervalKm: 1000001 }],
    ["nombre vacío", { name: "  ", intervalDays: 10 }],
    ["nombre de más de 100 caracteres", { name: "N".repeat(101), intervalDays: 10 }],
    ["intervalo como texto", { name: "X", intervalDays: "10" }],
  ])("rechaza %s con 400 VALIDATION_ERROR", async (_n, cuerpo) => {
    const respuesta = await crear(cuerpo);

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe("VALIDATION_ERROR");
    expect((await listar()).body.data).toHaveLength(0);
  });

  test("acepta los máximos exactos de 3650 días y 1,000,000 km", async () => {
    const respuesta = await crear({ name: "Máximo", intervalDays: 3650, intervalKm: 1000000 });
    expect(respuesta.status).toBe(201);
  });
});

describe("Edición y desactivación", () => {
  test("PATCH parcial de nombre, intervalos y estado", async () => {
    const { id } = (await crear(ACEITE)).body.data;

    const nombre = await editar(id, { name: "Aceite y filtro" });
    expect(nombre.status).toBe(200);
    expect(nombre.body.data.name).toBe("Aceite y filtro");
    expect(nombre.body.data.intervalDays).toBe(180);

    const intervalos = await editar(id, { intervalDays: 90, intervalKm: 4000 });
    expect(intervalos.body.data).toMatchObject({ intervalDays: 90, intervalKm: 4000 });

    const inactivo = await editar(id, { active: false });
    expect(inactivo.body.data.active).toBe(false);
    const activo = await editar(id, { active: true });
    expect(activo.body.data.active).toBe(true);
  });

  test("se puede quitar un intervalo con null si queda otro", async () => {
    const { id } = (await crear(ACEITE)).body.data;

    const quitado = await editar(id, { intervalKm: null });

    expect(quitado.status).toBe(200);
    expect(quitado.body.data.intervalKm).toBeNull();
    expect(quitado.body.data.intervalDays).toBe(180);
  });

  test("no se pueden quitar los dos intervalos", async () => {
    const { id } = (await crear(ACEITE)).body.data;

    const respuesta = await editar(id, { intervalDays: null, intervalKm: null });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe("VALIDATION_ERROR");
    const [tipo] = (await listar()).body.data;
    expect(tipo.intervalDays).toBe(180);
  });

  test("quitar el último intervalo que queda también se rechaza", async () => {
    const { id } = (await crear({ name: "Solo días", intervalDays: 30 })).body.data;

    const respuesta = await editar(id, { intervalDays: null });

    expect(respuesta.status).toBe(400);
  });

  test("renombrar a un nombre existente da 409 y un PATCH vacío da 400", async () => {
    await crear(ACEITE);
    const { id } = (await crear({ name: "Afinación", intervalKm: 10000 })).body.data;

    const repetido = await editar(id, { name: "cambio de aceite" });
    expect(repetido.status).toBe(409);
    expect(repetido.body.error.code).toBe("SERVICE_TYPE_NAME_TAKEN");

    expect((await editar(id, {})).status).toBe(400);
  });

  test("un id inexistente da 404 NOT_FOUND", async () => {
    const respuesta = await editar(9999, { name: "Nada" });

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.code).toBe("NOT_FOUND");
  });

  test("no existe ninguna ruta DELETE", async () => {
    const { id } = (await crear(ACEITE)).body.data;

    const respuesta = await request(app).delete(`/api/service-types/${id}`).set(headersAdmin);

    expect(respuesta.status).toBe(404);
    expect((await listar()).body.data).toHaveLength(1);
  });
});

describe("Listado y lookup", () => {
  test("GET filtra por active y cuenta las líneas que lo usan", async () => {
    const { id } = (await crear(ACEITE)).body.data;
    const otro = (await crear({ name: "Afinación", intervalKm: 10000 })).body.data;
    await editar(otro.id, { active: false });

    const todos = (await listar()).body.data;
    const activos = (await listar("?active=true")).body.data;
    const inactivos = (await listar("?active=false")).body.data;

    expect(todos).toHaveLength(2);
    expect(activos.map((t) => t.id)).toEqual([id]);
    expect(inactivos.map((t) => t.id)).toEqual([otro.id]);
    expect(todos.every((t) => t.usedInServices === 0)).toBe(true);
  });

  test("lookup devuelve solo tipos activos, sin contadores, a los tres roles", async () => {
    await crear(ACEITE);
    const inactivo = (await crear({ name: "Afinación", intervalKm: 10000 })).body.data;
    await editar(inactivo.id, { active: false });

    for (const headers of [headersAdmin, headersRecepcion, headersMecanico]) {
      const respuesta = await request(app).get("/api/service-types/lookup").set(headers);

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.data).toHaveLength(1);
      expect(Object.keys(respuesta.body.data[0]).sort()).toEqual(
        ["id", "intervalDays", "intervalKm", "name"],
      );
    }
  });
});

describe("Permisos (CA-10)", () => {
  test("recepción y mecánico reciben 403 en listado, alta y edición", async () => {
    const { id } = (await crear(ACEITE)).body.data;

    for (const headers of [headersRecepcion, headersMecanico]) {
      expect((await listar("", headers)).status).toBe(403);
      const alta = await crear({ name: "Intruso", intervalDays: 10 }, headers);
      expect(alta.status).toBe(403);
      expect(alta.body.error.code).toBe("FORBIDDEN");
      expect((await editar(id, { name: "Hackeado" }, headers)).status).toBe(403);
    }
    expect((await listar()).body.data[0].name).toBe("Cambio de aceite");
  });
});
