import { pool } from "../../config/db.js";
import { ejecutarSeed } from "../../scripts/seed.js";
import { crearPoolDePrueba, aplicarMigraciones, limpiarBaseDePrueba } from "../helpers/db.js";

// T126: idempotencia de los seeds del Sprint 7 (CA-12). Correr el seed ampliado
// dos veces no duplica tipos de servicio, configuración, pagos de ejemplo ni
// líneas de refacción, y la segunda corrida informa 0 registros nuevos.
let poolPrueba;

beforeAll(async () => {
  poolPrueba = await crearPoolDePrueba();
  await aplicarMigraciones(poolPrueba);
  await limpiarBaseDePrueba(poolPrueba);
});

afterAll(async () => {
  await poolPrueba.end();
  await pool.end();
});

const TABLAS = [
  "users",
  "clients",
  "vehicles",
  "appointments",
  "service_orders",
  "order_services",
  "order_labor",
  "order_parts",
  "parts",
  "inventory_movements",
  "maintenance",
  "payments",
  "tickets",
  "settings",
  "service_types",
];

async function conteos() {
  const resultado = {};
  for (const tabla of TABLAS) {
    const [[fila]] = await poolPrueba.query(`SELECT COUNT(*) AS total FROM \`${tabla}\``);
    resultado[tabla] = Number(fila.total);
  }
  return resultado;
}

describe("Seed del Sprint 7", () => {
  let primera;
  let segunda;
  let tras1;
  let tras2;

  beforeAll(async () => {
    await limpiarBaseDePrueba(poolPrueba);
    primera = await ejecutarSeed();
    tras1 = await conteos();
    segunda = await ejecutarSeed();
    tras2 = await conteos();
  }, 60000);

  test("la primera corrida crea la configuración, los tipos, los ingresos y el margen", () => {
    expect(primera.configuracion.creadas).toBe(3);
    expect(primera.tiposDeServicio.creados).toBe(3);
    expect(primera.tiposDeServicio.enlazadas).toBeGreaterThan(0);
    expect(primera.ingresos.creados).toBe(9);
    expect(primera.margen.lineas).toBe(4);
    expect(tras1.settings).toBe(3);
    expect(tras1.service_types).toBe(3);
    expect(tras1.payments).toBeGreaterThanOrEqual(9);
  });

  test("la segunda corrida informa 0 registros nuevos en cada sección del sprint", () => {
    expect(segunda.configuracion).toEqual({ creadas: 0, omitidas: 3 });
    expect(segunda.tiposDeServicio).toMatchObject({ creados: 0, omitidos: 3, enlazadas: 0 });
    expect(segunda.ingresos).toEqual({ creados: 0, omitidos: 9 });
    expect(segunda.margen.lineas).toBe(0);
    expect(segunda.terminaciones.ajustadas).toBe(0);
    expect(segunda.mantenimientos.creados).toBe(0);
  });

  test("ninguna tabla cambia de tamaño con la segunda corrida", () => {
    expect(tras2).toEqual(tras1);
  });

  test("los datos del sprint quedan coherentes", async () => {
    const [[sinCosto]] = await poolPrueba.query(
      "SELECT COUNT(*) AS total FROM order_parts WHERE unit_cost IS NULL",
    );
    expect(Number(sinCosto.total)).toBeGreaterThanOrEqual(1);

    const [[conTipo]] = await poolPrueba.query(
      "SELECT COUNT(*) AS total FROM order_services WHERE service_type_id IS NOT NULL",
    );
    const [[sinTipo]] = await poolPrueba.query(
      "SELECT COUNT(*) AS total FROM order_services WHERE service_type_id IS NULL",
    );
    expect(Number(conTipo.total)).toBeGreaterThan(0);
    expect(Number(sinTipo.total)).toBeGreaterThan(0);

    const [[propios]] = await poolPrueba.query(
      "SELECT COUNT(*) AS total FROM maintenance WHERE warn_days IS NULL",
    );
    expect(Number(propios.total)).toBeGreaterThan(0);

    const [[terminadas]] = await poolPrueba.query(
      `SELECT COUNT(*) AS total FROM service_orders
        WHERE status IN ('FINISHED','DELIVERED') AND finished_at IS NULL`,
    );
    expect(Number(terminadas.total)).toBe(0);
  });
});
