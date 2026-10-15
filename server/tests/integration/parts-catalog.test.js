import request from "supertest";
import { app } from "../../app.js";
import { pool } from "../../config/db.js";
import {
  crearPoolDePrueba,
  aplicarMigraciones,
  limpiarBaseDePrueba,
} from "../helpers/db.js";
import { tokenPara, conToken } from "../helpers/usuarios.js";

// T040: catálogo de refacciones (US5, FR-008, FR-012, RN-15, SC-008, CA-4).
// El alta registra el movimiento IN inicial en la misma transacción y el
// stockCurrent devuelto debe coincidir con el saldo real.

let poolPrueba;
let headersAdmin;
let idAdmin;
let headersMecanico;
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

  const admin = await tokenPara({ username: "admin", role: "ADMIN", name: "Administrador" });
  headersAdmin = conToken(admin.token);
  idAdmin = admin.usuario.id;

  const mec = await tokenPara({ username: "mecanico", role: "MECHANIC", name: "Mecánico Uno" });
  headersMecanico = conToken(mec.token);

  const recepcion = await tokenPara({
    username: "recepcion",
    role: "RECEPTIONIST",
    name: "Recepción",
  });
  headersRecepcion = conToken(recepcion.token);
});

const REFACCION = {
  partCode: "BAL-001",
  name: "Balatas traseras",
  category: "Frenos",
  brand: "Bosch",
  stockCurrent: 10,
  stockMin: 5,
  purchasePrice: "420.00",
  salePrice: "850.00",
};

async function crearParte(cuerpo) {
  const respuesta = await request(app)
    .post("/api/parts")
    .set(headersAdmin)
    .send(cuerpo);
  return respuesta;
}

describe("Catálogo de refacciones (US5, CA-4)", () => {
  test("alta 201 con el IN inicial en la misma transacción y stockCurrent coincidente (FR-008, FR-012)", async () => {
    const respuesta = await crearParte(REFACCION);

    expect(respuesta.status).toBe(201);
    const part = respuesta.body.data.part;
    expect(part).toMatchObject({
      partCode: "BAL-001",
      name: "Balatas traseras",
      category: "Frenos",
      brand: "Bosch",
      stockCurrent: 10,
      stockMin: 5,
      purchasePrice: "420.00",
      salePrice: "850.00",
      lowStock: false,
    });
    expect(part.id).toBeGreaterThan(0);
    expect(part.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);

    const [movimientos] = await poolPrueba.query(
      "SELECT * FROM inventory_movements WHERE part_id = ?",
      [part.id],
    );
    expect(movimientos).toHaveLength(1);
    expect(movimientos[0]).toMatchObject({
      movement_type: "IN",
      quantity: 10,
      order_id: null,
      created_by: idAdmin,
    });
  });

  test("alta sin stock inicial → 201 sin movimiento IN", async () => {
    const respuesta = await crearParte({
      partCode: "FIL-000",
      name: "Filtro de aceite",
      category: "Filtros",
      stockMin: 2,
    });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data.part.stockCurrent).toBe(0);

    const [movimientos] = await poolPrueba.query(
      "SELECT * FROM inventory_movements WHERE part_id = ?",
      [respuesta.body.data.part.id],
    );
    expect(movimientos).toHaveLength(0);
  });

  test("partCode repetido → 400 PART_CODE_DUPLICATED", async () => {
    const primera = await crearParte(REFACCION);
    expect(primera.status).toBe(201);

    const repetida = await crearParte({ ...REFACCION, name: "Otra balata" });

    expect(repetida.status).toBe(400);
    expect(repetida.body.error.code).toBe("PART_CODE_DUPLICATED");
  });

  test("name, category o stockMin faltantes → 400 VALIDATION_ERROR", async () => {
    for (const campoFaltante of ["name", "category", "stockMin"]) {
      const cuerpo = { ...REFACCION };
      delete cuerpo[campoFaltante];

      const respuesta = await crearParte(cuerpo);

      expect(respuesta.status).toBe(400);
      expect(respuesta.body.error.code).toBe("VALIDATION_ERROR");
    }
  });

  test("precios, stock o stock mínimo negativos → 400 VALIDATION_ERROR (RN-8)", async () => {
    const casos = [
      { stockCurrent: -1 },
      { stockMin: -5 },
      { purchasePrice: "-1.00" },
      { salePrice: "-0.01" },
      { purchasePrice: "420.999" }, // más de 2 decimales
    ];

    for (const ajuste of casos) {
      const respuesta = await crearParte({
        partCode: `NEG-${Math.random().toString(36).slice(2, 8)}`,
        name: "Refacción inválida",
        category: "Pruebas",
        stockMin: 1,
        ...ajuste,
      });

      expect(respuesta.status).toBe(400);
      expect(respuesta.body.error.code).toBe("VALIDATION_ERROR");
    }
  });

  test("GET filtra por código, nombre o categoría y calcula lowStock (SC-004, CA-7)", async () => {
    await crearParte({ ...REFACCION, stockCurrent: 4 }); // 4 ≤ 5 → lowStock
    await crearParte({
      partCode: "FIL-002",
      name: "Filtro de aceite",
      category: "Filtros",
      stockCurrent: 20,
      stockMin: 5,
    });
    await crearParte({
      partCode: "BUJ-003",
      name: "Bujía iridium",
      category: "Encendido",
      stockCurrent: 1,
      stockMin: 3,
      purchasePrice: "90.00",
      salePrice: "180.00",
    });

    const todos = await request(app).get("/api/parts").set(headersAdmin);
    expect(todos.status).toBe(200);
    expect(todos.body.data.total).toBe(3);
    // lowStockCount es global: alimenta el contador del filtro (CA-7).
    expect(todos.body.data.lowStockCount).toBe(2);
    const porCodigo = Object.fromEntries(
      todos.body.data.parts.map((part) => [part.partCode, part.lowStock]),
    );
    expect(porCodigo).toEqual({
      "BAL-001": true,
      "FIL-002": false,
      "BUJ-003": true,
    });

    const porCodigoBuscado = await request(app)
      .get("/api/parts?q=BAL")
      .set(headersAdmin);
    expect(porCodigoBuscado.status).toBe(200);
    expect(porCodigoBuscado.body.data.total).toBe(1);
    expect(porCodigoBuscado.body.data.lowStockCount).toBe(2);
    expect(porCodigoBuscado.body.data.parts[0].partCode).toBe("BAL-001");

    const porNombre = await request(app)
      .get("/api/parts?q=Balatas traseras")
      .set(headersAdmin);
    expect(porNombre.body.data.total).toBe(1);

    const porCategoria = await request(app)
      .get("/api/parts?q=Frenos")
      .set(headersAdmin);
    expect(porCategoria.body.data.total).toBe(1);
    expect(porCategoria.body.data.parts[0].partCode).toBe("BAL-001");

    const soloBajos = await request(app)
      .get("/api/parts?low=true")
      .set(headersAdmin);
    expect(soloBajos.body.data.total).toBe(2);
    for (const part of soloBajos.body.data.parts) {
      expect(part.lowStock).toBe(true);
    }

    const sinResultados = await request(app)
      .get("/api/parts?q=NOEXISTE")
      .set(headersAdmin);
    expect(sinResultados.status).toBe(200);
    expect(sinResultados.body.data.parts).toEqual([]);
    expect(sinResultados.body.data.total).toBe(0);
  });

  test("PATCH edita lo editable sin tocar stockCurrent ni partCode", async () => {
    const creada = await crearParte(REFACCION);
    const id = creada.body.data.part.id;

    const respuesta = await request(app)
      .patch(`/api/parts/${id}`)
      .set(headersAdmin)
      .send({
        name: "Balatas traseras reforzadas",
        category: "Frenos y suspensión",
        brand: "Brembo",
        stockMin: 8,
        purchasePrice: "430.50",
        salePrice: "900.00",
      });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.part).toMatchObject({
      partCode: "BAL-001", // inmutable
      stockCurrent: 10, // solo se mueve con movimientos (R-05)
      name: "Balatas traseras reforzadas",
      category: "Frenos y suspensión",
      brand: "Brembo",
      stockMin: 8,
      purchasePrice: "430.50",
      salePrice: "900.00",
    });
    // 10 de stock con mínimo 8 → no es stock bajo.
    expect(respuesta.body.data.part.lowStock).toBe(false);
  });

  test("PATCH no acepta stockCurrent, partCode ni cuerpo vacío → 400 VALIDATION_ERROR", async () => {
    const creada = await crearParte(REFACCION);
    const id = creada.body.data.part.id;

    const conStock = await request(app)
      .patch(`/api/parts/${id}`)
      .set(headersAdmin)
      .send({ stockCurrent: 99 });
    expect(conStock.status).toBe(400);
    expect(conStock.body.error.code).toBe("VALIDATION_ERROR");

    const conCodigo = await request(app)
      .patch(`/api/parts/${id}`)
      .set(headersAdmin)
      .send({ partCode: "OTRO-1" });
    expect(conCodigo.status).toBe(400);
    expect(conCodigo.body.error.code).toBe("VALIDATION_ERROR");

    const vacio = await request(app)
      .patch(`/api/parts/${id}`)
      .set(headersAdmin)
      .send({});
    expect(vacio.status).toBe(400);
    expect(vacio.body.error.code).toBe("VALIDATION_ERROR");

    const detalle = await request(app).get("/api/parts").set(headersAdmin);
    expect(detalle.body.data.parts[0].stockCurrent).toBe(10);
    expect(detalle.body.data.parts[0].partCode).toBe("BAL-001");
  });

  test("refacción inexistente en PATCH → 404 PART_NOT_FOUND", async () => {
    const respuesta = await request(app)
      .patch("/api/parts/999999")
      .set(headersAdmin)
      .send({ name: "Ya no existe" });

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.code).toBe("PART_NOT_FOUND");
  });

  test("MECHANIC y RECEPTIONIST reciben 403 en GET, POST y PATCH (R-07, RN-15, SC-008)", async () => {
    const creada = await crearParte(REFACCION);
    const id = creada.body.data.part.id;

    for (const headers of [headersMecanico, headersRecepcion]) {
      const get = await request(app).get("/api/parts").set(headers);
      expect(get.status).toBe(403);
      expect(get.body.error.code).toBe("FORBIDDEN");

      const post = await request(app)
        .post("/api/parts")
        .set(headers)
        .send(REFACCION);
      expect(post.status).toBe(403);
      expect(post.body.error.code).toBe("FORBIDDEN");

      const patch = await request(app)
        .patch(`/api/parts/${id}`)
        .set(headers)
        .send({ name: "Intento" });
      expect(patch.status).toBe(403);
      expect(patch.body.error.code).toBe("FORBIDDEN");
    }
  });

  test("GET sin token → 401 UNAUTHORIZED (convención compartida)", async () => {
    const respuesta = await request(app).get("/api/parts");

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error.code).toBe("UNAUTHORIZED");
  });
});
