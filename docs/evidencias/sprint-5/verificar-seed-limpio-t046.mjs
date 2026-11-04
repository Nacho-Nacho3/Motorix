// T046: el seed en una base LIMPIA se ejecuta dos veces sin duplicar nada y
// deja los tres escenarios del Sprint 5. Usa motorix_test (los tests la
// vacían en su beforeAll) y la limpia al terminar.
//
// Ejecución (desde la carpeta server/):
//   $env:DB_NAME="motorix_test"; node ..\docs\evidencias\sprint-5\verificar-seed-limpio-t046.mjs
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  crearPoolDePrueba,
  aplicarMigraciones,
  limpiarBaseDePrueba,
} from "../../../server/tests/helpers/db.js";
import { calcularTotalOrden } from "../../../server/services/order-total.service.js";

const SERVER = fileURLToPath(new URL("../../../server/", import.meta.url));
const pool = await crearPoolDePrueba();
await aplicarMigraciones(pool);
await limpiarBaseDePrueba(pool);

try {
  // Seed DOS veces contra la base vacía.
  for (let pasada = 1; pasada <= 2; pasada++) {
    const salida = execFileSync(process.execPath, ["scripts/seed.js"], {
      cwd: SERVER,
      env: { ...process.env, DB_NAME: "motorix_test" },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    console.log(`--- pasada ${pasada} ---`);
    console.log(salida.trim());
  }

  const [abiertas] = await pool.query(`
    SELECT so.id AS orden, so.status AS estado, op.unit_price AS precioLinea,
           p.part_code AS refaccion
      FROM order_parts op
      JOIN service_orders so ON so.id = op.order_id
      JOIN parts p ON p.id = op.part_id
     WHERE so.status NOT IN ('FINISHED', 'DELIVERED')`);
  console.log("(b) líneas en órdenes abiertas:", JSON.stringify(abiertas));

  const [pendientes] = await pool.query(`
    SELECT id, order_id AS orden, amount AS importe,
           external_reference AS referencia
      FROM payments
     WHERE method = 'MERCADO_PAGO' AND status = 'PENDING'`);
  for (const pago of pendientes) {
    const { total } = await calcularTotalOrden(pago.orden, pool);
    console.log(
      "(c) pago PENDING desfasado:",
      JSON.stringify({
        ...pago,
        total,
        distintoAlTotal: String(pago.importe) !== String(total),
      }),
    );
  }

  const [cobrables] = await pool.query(`
    SELECT so.id AS orden, so.status AS estado, COUNT(op.id) AS lineas
      FROM service_orders so
      JOIN order_parts op ON op.order_id = so.id
     WHERE so.status IN ('FINISHED', 'DELIVERED')
     GROUP BY so.id, so.status`);
  console.log("(a) órdenes cobrables con refacciones:", JSON.stringify(cobrables));

  const [conteos] = await pool.query(`
    SELECT (SELECT COUNT(*) FROM service_orders) AS ordenes,
           (SELECT COUNT(*) FROM order_parts) AS lineas,
           (SELECT COUNT(*) FROM payments) AS pagos,
           (SELECT COUNT(*) FROM parts) AS refacciones,
           (SELECT COUNT(*) FROM tickets) AS tickets`);
  console.log("Conteos tras las dos pasadas:", JSON.stringify(conteos[0]));
} finally {
  await limpiarBaseDePrueba(pool);
  await pool.end();
}
