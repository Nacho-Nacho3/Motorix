import request from "supertest";
import { app } from "../../app.js";
import { pool } from "../../config/db.js";
import * as clientes from "../../models/client.model.js";
import * as vehiculos from "../../models/vehicle.model.js";
import { crearPoolDePrueba, aplicarMigraciones, limpiarBaseDePrueba } from "../helpers/db.js";
import { tokenPara, conToken } from "../helpers/usuarios.js";

// T110: costo congelado por línea de refacción (US6, D-05, research P-8, CA-8).
let poolPrueba;
let headersAdmin;
let headersRecepcion;
let headersMecanico;
let idMecanico;
let idOrden;
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
  headersAdmin = conToken((await tokenPara({ username: "admin", role: "ADMIN" })).token);
  headersRecepcion = conToken(
    (await tokenPara({ username: "recepcion", role: "RECEPTIONIST" })).token,
  );
  const mecanico = await tokenPara({ username: "mecanico", role: "MECHANIC" });
  headersMecanico = conToken(mecanico.token);
  idMecanico = mecanico.usuario.id;

  const cliente = await clientes.crear({ name: "Cliente uc", phone: "5588889999", email: "uc@correo.mx" });
  const vehiculo = await vehiculos.crear({
    clientId: cliente.id,
    brand: "Nissan",
    model: "Versa",
    year: 2020,
    licensePlate: "UCS0001",
    vin: null,
    currentMileage: 1000,
  });
  const orden = await request(app)
    .post("/api/service-orders")
    .set(headersRecepcion)
    .send({
      clientId: cliente.id,
      vehicleId: vehiculo.id,
      mechanicId: idMecanico,
      entryMileage: 2000,
      reportedProblem: "Costo",
    });
  idOrden = orden.body.data.order.id;
});

async function crearParte(purchasePrice, salePrice = "500.00") {
  contador += 1;
  const respuesta = await request(app)
    .post("/api/parts")
    .set(headersAdmin)
    .send({
      partCode: `UC${String(contador).padStart(5, "0")}`,
      name: `Pieza ${contador}`,
      category: "Motor",
      stockCurrent: 20,
      stockMin: 2,
      purchasePrice,
      salePrice,
    });
  expect(respuesta.status).toBe(201);
  return respuesta.body.data.part;
}

const usar = (partId, quantity = 1) =>
  request(app)
    .post(`/api/service-orders/${idOrden}/parts`)
    .set(headersMecanico)
    .send({ partId, quantity });

async function lineas() {
  const [filas] = await poolPrueba.query(
    "SELECT id, unit_price AS unitPrice, unit_cost AS unitCost FROM order_parts WHERE order_id = ? ORDER BY id",
    [idOrden],
  );
  return filas;
}

describe("Costo guardado al agregar la refacción", () => {
  test("guarda unit_cost con el precio de compra vigente", async () => {
    const parte = await crearParte("321.45");

    const respuesta = await usar(parte.id, 2);

    expect(respuesta.status).toBe(201);
    const [fila] = await lineas();
    expect(fila.unitCost).toBe("321.45");
    expect(fila.unitPrice).toBe("500.00");
  });

  test("con precio de compra 0 guarda NULL (sin costo registrado)", async () => {
    const parte = await crearParte("0.00");

    await usar(parte.id);

    const [fila] = await lineas();
    expect(fila.unitCost).toBeNull();
  });

  test("un cambio posterior del precio de compra no altera las líneas ya agregadas", async () => {
    const parte = await crearParte("100.00");
    await usar(parte.id);

    await request(app).patch(`/api/parts/${parte.id}`).set(headersAdmin).send({ purchasePrice: "180.00" });
    await usar(parte.id);

    const [primera, segunda] = await lineas();
    expect(primera.unitCost).toBe("100.00");
    expect(segunda.unitCost).toBe("180.00");
  });

  test("un cambio del precio de compra a 0 no borra el costo de líneas anteriores", async () => {
    const parte = await crearParte("100.00");
    await usar(parte.id);

    await request(app).patch(`/api/parts/${parte.id}`).set(headersAdmin).send({ purchasePrice: "0.00" });

    expect((await lineas())[0].unitCost).toBe("100.00");
  });

  test("la corrección administrativa del precio de venta no toca el costo", async () => {
    const parte = await crearParte("100.00");
    await usar(parte.id);
    const [linea] = await lineas();

    const correccion = await request(app)
      .patch(`/api/service-orders/${idOrden}/parts/${linea.id}/price`)
      .set(headersAdmin)
      .send({ unitPrice: "700.00", reason: "Precio capturado de otra pieza" });
    expect(correccion.status).toBe(200);

    const [despues] = await lineas();
    expect(despues.unitPrice).toBe("700.00");
    expect(despues.unitCost).toBe("100.00");
  });
});

describe("El costo nunca llega a quien no es ADMIN (CA-8)", () => {
  test("ni la respuesta del alta, ni las listas, ni el detalle lo exponen a ningún rol", async () => {
    const parte = await crearParte("321.45");
    const alta = await usar(parte.id);

    const respuestas = [alta];
    for (const headers of [headersAdmin, headersRecepcion, headersMecanico]) {
      respuestas.push(await request(app).get(`/api/service-orders/${idOrden}/parts`).set(headers));
      respuestas.push(await request(app).get(`/api/service-orders/${idOrden}`).set(headers));
      respuestas.push(await request(app).get(`/api/service-orders/${idOrden}/total`).set(headers));
    }
    for (const respuesta of respuestas) {
      const texto = JSON.stringify(respuesta.body);
      expect(texto).not.toMatch(/unitCost|unit_cost|purchasePrice|purchase_price/);
      expect(texto).not.toContain("321.45");
    }
  });

  test("la proyección por rol del Sprint 5 no cambia: el mecánico no recibe precios", async () => {
    const parte = await crearParte("100.00", "850.00");
    await usar(parte.id);

    const mecanico = await request(app).get(`/api/service-orders/${idOrden}/parts`).set(headersMecanico);
    const recepcion = await request(app).get(`/api/service-orders/${idOrden}/parts`).set(headersRecepcion);

    expect(mecanico.body.data.parts[0]).not.toHaveProperty("unitPrice");
    expect(recepcion.body.data.parts[0].unitPrice).toBe("850.00");
  });
});
