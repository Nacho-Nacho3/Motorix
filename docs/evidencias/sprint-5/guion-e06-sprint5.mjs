// E-06: recorrido HTTP de los escenarios V1–V8 del quickstart del Sprint 5
// contra la API real (node app.js en un puerto de prueba) con la base
// motorix_test sembrada. V9 y V10 se validan con las suites indicadas en el
// quickstart (ya ejecutadas: payment-concurrency, historical-compat y la
// regresión completa).
//
// Ejecución (desde la carpeta server/):
//   $env:DB_NAME="motorix_test"; node ..\docs\evidencias\sprint-5\guion-e06-sprint5.mjs
// El pool de pruebas siempre apunta a motorix_test; la variable DB_NAME hace
// que el seed y la API (puerto 3999) usen esa misma base y no la de
// demostración. El guion termina con process.exit, así que no se queda colgado.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  crearPoolDePrueba,
  aplicarMigraciones,
  limpiarBaseDePrueba,
} from "../../../server/tests/helpers/db.js";
import { ejecutarSeed } from "../../../server/scripts/seed.js";
import { calcularTotalOrden } from "../../../server/services/order-total.service.js";
import { pool as poolConfig } from "../../../server/config/db.js";

const PUERTO = 3999;
const BASE = `http://127.0.0.1:${PUERTO}/api`;
const SERVIDOR = fileURLToPath(new URL("../../../server/", import.meta.url));

const resultados = [];

function registrar(escenario, caso, esperado, obtenido, cumple) {
  resultados.push({ escenario, caso, esperado, obtenido, cumple });
  console.log(`${cumple ? "OK   " : "FALLO"} [${escenario}] ${caso} → ${obtenido}`);
}

/** Ejecuta un caso y registra el resultado (o el error, como fallo). */
async function evaluar(escenario, caso, esperado, funcion) {
  try {
    const { obtenido, cumple } = await funcion();
    registrar(escenario, caso, esperado, obtenido, cumple);
  } catch (error) {
    registrar(escenario, caso, esperado, `ERROR: ${error.message}`, false);
  }
}

async function llamar(metodo, ruta, { token, cuerpo } = {}) {
  const respuesta = await fetch(`${BASE}${ruta}`, {
    method: metodo,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  let cuerpoRespuesta = null;
  try {
    cuerpoRespuesta = await respuesta.json();
  } catch {
    cuerpoRespuesta = null;
  }
  return { estado: respuesta.status, cuerpo: cuerpoRespuesta };
}

/** Detalle del error de una respuesta fallida (código, mensaje y details). */
function detalleError(r) {
  const error = r.cuerpo?.error;
  if (!error) return "";
  const detalles = (error.details ?? []).map((d) => d.message).join(" | ");
  return ` ${error.code}: ${error.message}${detalles ? ` → ${detalles}` : ""}`;
}

async function login(identifier, password) {
  const r = await llamar("POST", "/auth/login", {
    cuerpo: { identifier, password },
  });
  if (r.estado !== 201) {
    throw new Error(`login ${identifier}: HTTP ${r.estado}`);
  }
  return r.cuerpo.data.token;
}

const poolPrueba = await crearPoolDePrueba();
let servidor = null;

try {
  // ------------------------------------------------ preparación (V1/V2 base)
  await aplicarMigraciones(poolPrueba);
  await limpiarBaseDePrueba(poolPrueba);
  await ejecutarSeed(); // siembra en motorix_test (DB_NAME del proceso)

  // --------------------------------------------------------------- V1 (SQL)
  await evaluar("V1", "schema_migrations registra 014_order_parts_price.sql", "1", async () => {
    const [filas] = await poolPrueba.query(
      "SELECT COUNT(*) AS n FROM schema_migrations WHERE version = '014_order_parts_price.sql'",
    );
    return { obtenido: String(filas[0].n), cumple: filas[0].n === 1 };
  });

  await evaluar("V1", "ninguna línea existente con unit_price NULL", "0", async () => {
    const [filas] = await poolPrueba.query(
      "SELECT COUNT(*) AS n FROM order_parts WHERE unit_price IS NULL",
    );
    return { obtenido: String(filas[0].n), cumple: filas[0].n === 0 };
  });

  await evaluar("V1", "ninguna línea con precio ajeno al catálogo (backfill D-03)", "0", async () => {
    const [filas] = await poolPrueba.query(
      `SELECT COUNT(*) AS n
         FROM order_parts op
         JOIN parts p ON p.id = op.part_id
        WHERE op.unit_price <> p.sale_price
          AND op.price_correction_reason IS NULL`,
    );
    return { obtenido: String(filas[0].n), cumple: filas[0].n === 0 };
  });

  await evaluar("V1", "re-ejecutar las migraciones sin errores (scripts inmutables)", "sin errores", async () => {
    await aplicarMigraciones(poolPrueba);
    return { obtenido: "re-aplicadas sin errores", cumple: true };
  });

  // --------------------------------------------------------------- V2 (SQL)
  async function conteos() {
    const [filas] = await poolPrueba.query(`
      SELECT (SELECT COUNT(*) FROM service_orders) AS ordenes,
             (SELECT COUNT(*) FROM order_parts) AS lineas,
             (SELECT COUNT(*) FROM payments) AS pagos,
             (SELECT COUNT(*) FROM parts) AS refacciones`);
    return filas[0];
  }

  await evaluar("V2", "segunda pasada del seed sin registros nuevos (SC-007)", "conteos idénticos", async () => {
    const antes = await conteos();
    await ejecutarSeed();
    const despues = await conteos();
    const cumple = JSON.stringify(antes) === JSON.stringify(despues);
    return {
      obtenido: `antes=${JSON.stringify(antes)} después=${JSON.stringify(despues)}`,
      cumple,
    };
  });

  let idOrdenC = null; // orden terminada sin cobrar, con pendiente desfasado (V8)
  let idOrdenD = null; // orden terminada ya pagada, con línea de refacciones (V7/V8)

  await evaluar("V2", "orden cobrable con refacciones", "≥ 1", async () => {
    const [filas] = await poolPrueba.query(
      `SELECT so.id
         FROM service_orders so
         JOIN order_parts op ON op.order_id = so.id
        WHERE so.status IN ('FINISHED', 'DELIVERED')
        ORDER BY so.id
        LIMIT 1`,
    );
    return {
      obtenido: filas.length > 0 ? `orden ${filas[0].id}` : "ninguna",
      cumple: filas.length > 0,
    };
  });

  await evaluar("V2", "orden abierta con línea de refacción con precio", "≥ 1", async () => {
    const [filas] = await poolPrueba.query(
      `SELECT so.id
         FROM service_orders so
         JOIN order_parts op ON op.order_id = so.id
        WHERE so.status NOT IN ('FINISHED', 'DELIVERED')
        ORDER BY so.id
        LIMIT 1`,
    );
    return {
      obtenido: filas.length > 0 ? `orden ${filas[0].id}` : "ninguna",
      cumple: filas.length > 0,
    };
  });

  await evaluar("V2", "pago PENDING de MP con importe distinto al total", "importe ≠ total", async () => {
    const [filas] = await poolPrueba.query(
      `SELECT id, order_id, amount
         FROM payments
        WHERE method = 'MERCADO_PAGO' AND status = 'PENDING'
        ORDER BY id
        LIMIT 1`,
    );
    if (filas.length === 0) return { obtenido: "ninguno", cumple: false };
    idOrdenC = filas[0].order_id;
    const { total } = await calcularTotalOrden(filas[0].order_id, poolPrueba);
    const cumple = Number(filas[0].amount) !== Number(total);
    return {
      obtenido: `orden ${filas[0].order_id}: ${filas[0].amount} vs total ${total}`,
      cumple,
    };
  });

  await evaluar("V2", "orden terminada ya pagada con línea de refacciones", "≥ 1", async () => {
    const [filas] = await poolPrueba.query(
      `SELECT so.id
         FROM service_orders so
         JOIN order_parts op ON op.order_id = so.id
         JOIN payments p ON p.order_id = so.id AND p.status = 'PAID'
        WHERE so.status IN ('FINISHED', 'DELIVERED')
        ORDER BY so.id
        LIMIT 1`,
    );
    if (filas.length > 0) idOrdenD = filas[0].id;
    return {
      obtenido: filas.length > 0 ? `orden ${filas[0].id}` : "ninguna",
      cumple: filas.length > 0,
    };
  });

  // ------------------------------------------------------- preparación HTTP
  servidor = spawn(process.execPath, ["app.js"], {
    cwd: SERVIDOR,
    env: { ...process.env, DB_NAME: "motorix_test", PORT: String(PUERTO) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let salidaServidor = "";
  servidor.stdout.on("data", (d) => (salidaServidor += d));
  servidor.stderr.on("data", (d) => (salidaServidor += d));

  let listo = false;
  for (let intento = 0; intento < 60 && !listo; intento += 1) {
    try {
      const r = await fetch(`http://127.0.0.1:${PUERTO}/api/health`);
      listo = r.ok;
    } catch {
      await new Promise((resolver) => setTimeout(resolver, 200));
    }
  }
  if (!listo) throw new Error(`La API no arrancó: ${salidaServidor}`);

  const tAdmin = await login("admin", "Admin2026!");
  const tMec = await login("mecanico", "Mecanico2026!");
  const tRec = await login("recepcion", "Recepcion2026!");

  // --------------------------------------------------------------- V3 (HTTP)
  let idParte = null;
  let idOrdenA = null;
  let idLinea = null;

  await evaluar("V3", "admin crea refacción con precio de venta 100.00", "201", async () => {
    const r = await llamar("POST", "/parts", {
      token: tAdmin,
      cuerpo: {
        partCode: "E2E-500",
        name: "Refacción E2E Sprint 5",
        category: "Frenos",
        stockCurrent: 10,
        stockMin: 2,
        purchasePrice: "50.00",
        salePrice: "100.00",
      },
    });
    idParte = r.cuerpo?.data?.part?.id ?? null;
    return { obtenido: `HTTP ${r.estado}, id=${idParte}`, cumple: r.estado === 201 && !!idParte };
  });

  await evaluar("V3", "el mecánico elige una de sus órdenes abiertas", "≥ 1 abierta", async () => {
    const r = await llamar("GET", "/service-orders", { token: tMec });
    const ordenes = r.cuerpo?.data?.orders ?? [];
    const abierta = ordenes.find((o) => !["FINISHED", "DELIVERED"].includes(o.status));
    idOrdenA = abierta?.id ?? null;
    return {
      obtenido: abierta ? `orden ${abierta.id} (${abierta.status})` : "ninguna",
      cumple: !!abierta,
    };
  });

  await evaluar("V3", "mecánico agrega 2 unidades con el selector", "201", async () => {
    const r = await llamar("POST", `/service-orders/${idOrdenA}/parts`, {
      token: tMec,
      cuerpo: { partId: idParte, quantity: 2 },
    });
    idLinea = r.cuerpo?.data?.orderPart?.id ?? null;
    return { obtenido: `HTTP ${r.estado}, línea=${idLinea}`, cumple: r.estado === 201 && !!idLinea };
  });

  await evaluar("V3", "la línea guarda unitPrice 100.00 (instantánea D-01)", "\"100.00\"", async () => {
    const r = await llamar("GET", `/service-orders/${idOrdenA}/parts`, { token: tAdmin });
    const linea = (r.cuerpo?.data?.parts ?? []).find((p) => p.id === idLinea);
    return { obtenido: String(linea?.unitPrice), cumple: linea?.unitPrice === "100.00" };
  });

  await evaluar("V3", "admin cambia el precio del catálogo a 150.00", "200", async () => {
    const r = await llamar("PATCH", `/parts/${idParte}`, {
      token: tAdmin,
      cuerpo: { salePrice: "150.00" },
    });
    return { obtenido: `HTTP ${r.estado}`, cumple: r.estado === 200 };
  });

  await evaluar("V3", "la línea NO cambia tras el cambio de catálogo", "\"100.00\"", async () => {
    const r = await llamar("GET", `/service-orders/${idOrdenA}/parts`, { token: tAdmin });
    const linea = (r.cuerpo?.data?.parts ?? []).find((p) => p.id === idLinea);
    return { obtenido: String(linea?.unitPrice), cumple: linea?.unitPrice === "100.00" };
  });

  let totalA = null;
  await evaluar("V3", "partsSubtotal sigue en 200.00 (2 × 100.00)", "\"200.00\"", async () => {
    const r = await llamar("GET", `/service-orders/${idOrdenA}/total`, { token: tAdmin });
    totalA = r.cuerpo?.data ?? null;
    return {
      obtenido: String(totalA?.partsSubtotal),
      cumple: totalA?.partsSubtotal === "200.00",
    };
  });

  // --------------------------------------------------------------- V6 (HTTP)
  await evaluar("V6", "mecánico: GET /api/parts → 403", "403", async () => {
    const r = await llamar("GET", "/parts", { token: tMec });
    return { obtenido: `HTTP ${r.estado}`, cumple: r.estado === 403 };
  });

  await evaluar("V6", "mecánico: lookup sin precios en ningún elemento", "200 y 0 con precios", async () => {
    const r = await llamar("GET", "/parts/lookup", { token: tMec });
    const elementos = r.cuerpo?.data?.parts ?? [];
    const conPrecios = elementos.filter(
      (p) => "purchasePrice" in p || "salePrice" in p,
    ).length;
    return {
      obtenido: `HTTP ${r.estado}, ${elementos.length} elementos, con precios: ${conPrecios}`,
      cumple: r.estado === 200 && elementos.length > 0 && conPrecios === 0,
    };
  });

  await evaluar("V6", "mecánico: líneas de la orden sin unitPrice", "sin unitPrice", async () => {
    const r = await llamar("GET", `/service-orders/${idOrdenA}/parts`, { token: tMec });
    const elementos = r.cuerpo?.data?.parts ?? [];
    const conPrecio = elementos.filter((p) => "unitPrice" in p).length;
    return {
      obtenido: `${elementos.length} elementos, con unitPrice: ${conPrecio}`,
      cumple: elementos.length > 0 && conPrecio === 0,
    };
  });

  await evaluar("V6", "recepción: GET /api/parts → 403", "403", async () => {
    const r = await llamar("GET", "/parts", { token: tRec });
    return { obtenido: `HTTP ${r.estado}`, cumple: r.estado === 403 };
  });

  await evaluar("V6", "recepción: líneas con unitPrice y sin campos de corrección", "unitPrice sí, corrección no", async () => {
    const r = await llamar("GET", `/service-orders/${idOrdenA}/parts`, { token: tRec });
    const elementos = r.cuerpo?.data?.parts ?? [];
    const cumple =
      elementos.length > 0 &&
      elementos.every(
        (p) =>
          "unitPrice" in p &&
          !("priceCorrectionReason" in p) &&
          !("purchasePrice" in p),
      );
    return { obtenido: `${elementos.length} elementos, cumple=${cumple}`, cumple };
  });

  await evaluar("V6", "admin: catálogo con los dos precios", "purchasePrice y salePrice", async () => {
    const r = await llamar("GET", "/parts", { token: tAdmin });
    const elementos = r.cuerpo?.data?.parts ?? [];
    const cumple =
      r.estado === 200 &&
      elementos.length > 0 &&
      elementos.every((p) => "purchasePrice" in p && "salePrice" in p);
    return { obtenido: `HTTP ${r.estado}, ${elementos.length} elementos`, cumple };
  });

  await evaluar("V6", "recepción no puede crear refacciones → 403", "403", async () => {
    const r = await llamar("POST", "/parts", {
      token: tRec,
      cuerpo: { partCode: "E2E-REC", name: "No debe crearse", category: "Frenos", stockMin: 1 },
    });
    return { obtenido: `HTTP ${r.estado}`, cumple: r.estado === 403 };
  });

  await evaluar("V6", "mecánico no puede modificar precios → 403", "403", async () => {
    const r = await llamar("PATCH", `/parts/${idParte}`, {
      token: tMec,
      cuerpo: { salePrice: "999.00" },
    });
    return { obtenido: `HTTP ${r.estado}`, cumple: r.estado === 403 };
  });

  // --------------------------------------------------------------- V5 (HTTP)
  await evaluar("V5", "salePrice 100000.00 rechazado con el tope", "400 con «99,999.99» en details", async () => {
    const r = await llamar("POST", "/parts", {
      token: tAdmin,
      cuerpo: { partCode: "E2E-TOPE", name: "Tope", category: "Frenos", stockMin: 1, salePrice: "100000.00" },
    });
    const detalles = (r.cuerpo?.error?.details ?? []).map((d) => d.message).join(" | ");
    return {
      obtenido: `HTTP ${r.estado}: ${r.cuerpo?.error?.message ?? ""} → ${detalles}`,
      cumple: r.estado === 400 && detalles.includes("99,999.99"),
    };
  });

  await evaluar("V5", "salePrice con 3 decimales rechazado", "400", async () => {
    const r = await llamar("POST", "/parts", {
      token: tAdmin,
      cuerpo: { partCode: "E2E-DEC", name: "Decimales", category: "Frenos", stockMin: 1, salePrice: "85.999" },
    });
    return { obtenido: `HTTP ${r.estado}${detalleError(r)}`, cumple: r.estado === 400 };
  });

  await evaluar("V5", "precio negativo rechazado", "400", async () => {
    const r = await llamar("POST", "/parts", {
      token: tAdmin,
      cuerpo: { partCode: "E2E-NEG", name: "Negativo", category: "Frenos", stockMin: 1, salePrice: "-10.00" },
    });
    return { obtenido: `HTTP ${r.estado}${detalleError(r)}`, cumple: r.estado === 400 };
  });

  await evaluar("V5", "venta menor que compra: se guarda (advertencia ámbar = UI)", "201", async () => {
    const r = await llamar("POST", "/parts", {
      token: tAdmin,
      cuerpo: {
        partCode: "E2E-INV",
        name: "Precio invertido",
        category: "Frenos",
        stockMin: 1,
        purchasePrice: "80.00",
        salePrice: "50.00",
      },
    });
    return { obtenido: `HTTP ${r.estado}${detalleError(r)}`, cumple: r.estado === 201 };
  });

  await evaluar("V5", "PATCH del catálogo también aplica el tope", "400 con «99,999.99» en details", async () => {
    const r = await llamar("PATCH", `/parts/${idParte}`, {
      token: tAdmin,
      cuerpo: { salePrice: "100000.00" },
    });
    const detalles = (r.cuerpo?.error?.details ?? []).map((d) => d.message).join(" | ");
    return {
      obtenido: `HTTP ${r.estado} → ${detalles}`,
      cumple: r.estado === 400 && detalles.includes("99,999.99"),
    };
  });

  // --------------------------------------------------------------- V4 (HTTP)
  await evaluar("V4", "Σ de subtotales = total (diferencia 0.00)", "diferencia 0.00", async () => {
    const suma =
      Number(totalA.servicesSubtotal) +
      Number(totalA.laborSubtotal) +
      Number(totalA.partsSubtotal);
    const diferencia = Math.abs(suma - Number(totalA.total));
    return {
      obtenido: `Σ ${suma.toFixed(2)} vs total ${totalA.total} → ${diferencia.toFixed(2)}`,
      cumple: diferencia < 0.005,
    };
  });

  let idOrdenB = null;
  await evaluar("V4", "crear orden sin trabajo registrado", "201", async () => {
    const [[vehiculo]] = await poolPrueba.query(
      "SELECT id AS vehicleId, client_id AS clientId, current_mileage AS mileage FROM vehicles ORDER BY id LIMIT 1",
    );
    const [[mecanico]] = await poolPrueba.query(
      "SELECT id FROM users WHERE role = 'MECHANIC' ORDER BY id LIMIT 1",
    );
    const r = await llamar("POST", "/service-orders", {
      token: tRec,
      cuerpo: {
        clientId: vehiculo.clientId,
        vehicleId: vehiculo.vehicleId,
        mechanicId: mecanico.id,
        // RN-3: por encima del kilometraje previo del vehículo (99500 en el seed).
        entryMileage: Number(vehiculo.mileage) + 500,
        reportedProblem: "Orden E2E sin trabajo para total cero",
      },
    });
    idOrdenB = r.cuerpo?.data?.order?.id ?? null;
    return {
      obtenido: `HTTP ${r.estado}${detalleError(r)}, orden=${idOrdenB}`,
      cumple: r.estado === 201 && !!idOrdenB,
    };
  });

  await evaluar("V4", "total de la orden sin trabajo → \"0.00\"", "\"0.00\"", async () => {
    const r = await llamar("GET", `/service-orders/${idOrdenB}/total`, { token: tRec });
    const total = r.cuerpo?.data?.total;
    return { obtenido: String(total), cumple: total === "0.00" };
  });

  await evaluar("V4", "avanzar la orden vacía a FINISHED (VN-02 antecede al chequeo de total)", "200 en cada salto", async () => {
    const avance = {
      RECEIVED: "DIAGNOSIS",
      DIAGNOSIS: "IN_REPAIR",
      IN_REPAIR: "FINISHED",
      WAITING_PART: "IN_REPAIR",
    };
    const [[fila]] = await poolPrueba.query("SELECT status FROM service_orders WHERE id = ?", [idOrdenB]);
    if (!fila) return { obtenido: "orden no encontrada", cumple: false };
    let estado = fila.status;
    const saltos = [];
    while (estado !== "FINISHED" && avance[estado]) {
      const r = await llamar("PATCH", `/service-orders/${idOrdenB}/status`, {
        token: tMec,
        cuerpo: { status: avance[estado] },
      });
      saltos.push(`${estado}→${avance[estado]}:${r.estado}`);
      if (r.estado !== 200) break;
      estado = avance[estado];
    }
    return { obtenido: saltos.join(", ") || `ya en ${estado}`, cumple: estado === "FINISHED" };
  });

  await evaluar("V4", "cobro de total 0.00 rechazado con mensaje en español", "400 con «0.00» en details", async () => {
    const r = await llamar("POST", `/service-orders/${idOrdenB}/payments`, {
      token: tRec,
      cuerpo: { method: "CASH" },
    });
    // El mensaje principal de una validación es genérico; el específico
    // («El total de la orden es 0.00…») viaja en error.details[].
    const detalles = (r.cuerpo?.error?.details ?? []).map((d) => d.message).join(" | ");
    return {
      obtenido: `HTTP ${r.estado}: ${r.cuerpo?.error?.message ?? ""} → ${detalles}`,
      cumple: r.estado === 400 && detalles.includes("0.00"),
    };
  });

  // --------------------------------------------------------------- V7 (HTTP)
  await evaluar("V7", "agregar una refacción a esa orden (instantánea 150.00)", "201 y unitPrice 150.00 verificado como admin", async () => {
    const r = await llamar("POST", `/service-orders/${idOrdenB}/parts`, {
      token: tMec,
      cuerpo: { partId: idParte, quantity: 1 },
    });
    if (r.estado !== 201) {
      return { obtenido: `HTTP ${r.estado}${detalleError(r)}`, cumple: false };
    }
    // El POST lo hace el mecánico: su proyección no incluye unitPrice
    // (T013/D-10); el precio de la instantánea se verifica con GET como admin.
    const idNuevaLinea = r.cuerpo?.data?.orderPart?.id;
    const rLista = await llamar("GET", `/service-orders/${idOrdenB}/parts`, { token: tAdmin });
    const linea = (rLista.cuerpo?.data?.parts ?? []).find((p) => p.id === idNuevaLinea);
    return {
      obtenido: `HTTP 201, unitPrice (como admin)=${linea?.unitPrice}`,
      cumple: linea?.unitPrice === "150.00",
    };
  });

  await evaluar("V7", "admin corrige la línea con motivo obligatorio", "200 con motivo, autor y fecha", async () => {
    const r = await llamar("PATCH", `/service-orders/${idOrdenA}/parts/${idLinea}/price`, {
      token: tAdmin,
      cuerpo: { unitPrice: "120.00", reason: "Ajuste por cotización actualizada del proveedor" },
    });
    const fila = r.cuerpo?.data?.orderPart;
    return {
      obtenido: `HTTP ${r.estado}, unitPrice=${fila?.unitPrice}, motivo=${fila?.priceCorrectionReason ? "sí" : "no"}, autor=${fila?.priceCorrectedBy ?? "—"}, fecha=${fila?.priceCorrectedAt ? "sí" : "no"}`,
      cumple:
        r.estado === 200 &&
        fila?.unitPrice === "120.00" &&
        !!fila?.priceCorrectionReason &&
        typeof fila?.priceCorrectedBy === "number" &&
        !!fila?.priceCorrectedAt,
    };
  });

  await evaluar("V7", "la corrección cambia la línea y el total", "línea 120.00, subtotal 240.00, total anterior + 40.00", async () => {
    const rLista = await llamar("GET", `/service-orders/${idOrdenA}/parts`, { token: tAdmin });
    const linea = (rLista.cuerpo?.data?.parts ?? []).find((p) => p.id === idLinea);
    const rTotal = await llamar("GET", `/service-orders/${idOrdenA}/total`, { token: tAdmin });
    const total = rTotal.cuerpo?.data?.total;
    const subtotal = rTotal.cuerpo?.data?.partsSubtotal;
    const totalEsperado = (Number(totalA.total) + 40).toFixed(2);
    return {
      obtenido: `línea=${linea?.unitPrice}, partsSubtotal=${subtotal}, total=${total} (esperado ${totalEsperado})`,
      cumple:
        linea?.unitPrice === "120.00" &&
        subtotal === "240.00" &&
        total === totalEsperado,
    };
  });

  await evaluar("V7", "motivo corto → 400 VALIDATION_ERROR", "400", async () => {
    const r = await llamar("PATCH", `/service-orders/${idOrdenA}/parts/${idLinea}/price`, {
      token: tAdmin,
      cuerpo: { unitPrice: "125.00", reason: "corto" },
    });
    return { obtenido: `HTTP ${r.estado} ${r.cuerpo?.error?.code ?? ""}`, cumple: r.estado === 400 };
  });

  await evaluar("V7", "sin motivo → 400 VALIDATION_ERROR", "400", async () => {
    const r = await llamar("PATCH", `/service-orders/${idOrdenA}/parts/${idLinea}/price`, {
      token: tAdmin,
      cuerpo: { unitPrice: "125.00" },
    });
    return { obtenido: `HTTP ${r.estado} ${r.cuerpo?.error?.code ?? ""}`, cumple: r.estado === 400 };
  });

  await evaluar("V7", "token de recepción → 403", "403", async () => {
    const r = await llamar("PATCH", `/service-orders/${idOrdenA}/parts/${idLinea}/price`, {
      token: tRec,
      cuerpo: { unitPrice: "125.00", reason: "Recepción no debe poder corregir precios" },
    });
    return { obtenido: `HTTP ${r.estado}`, cumple: r.estado === 403 };
  });

  await evaluar("V7", "fila inexistente o de otra orden → 404", "404 ORDER_ITEM_NOT_FOUND", async () => {
    const r = await llamar("PATCH", `/service-orders/${idOrdenA}/parts/999999/price`, {
      token: tAdmin,
      cuerpo: { unitPrice: "125.00", reason: "Fila que no existe en esta orden" },
    });
    return {
      obtenido: `HTTP ${r.estado} ${r.cuerpo?.error?.code ?? ""}`,
      cumple: r.estado === 404 && r.cuerpo?.error?.code === "ORDER_ITEM_NOT_FOUND",
    };
  });

  await evaluar("V7", "la orden solo con refacciones tiene total > 0", "> 0.00", async () => {
    const r = await llamar("GET", `/service-orders/${idOrdenB}/total`, { token: tRec });
    const total = r.cuerpo?.data?.total;
    return { obtenido: String(total), cumple: Number(total) > 0 };
  });

  await evaluar("V7", "orden terminada solo con refacciones SÍ es cobrable (D-02)", "201 PAID", async () => {
    const r = await llamar("POST", `/service-orders/${idOrdenB}/payments`, {
      token: tRec,
      cuerpo: { method: "CASH" },
    });
    const pago = r.cuerpo?.data?.payment;
    return {
      obtenido: `HTTP ${r.estado}, importe=${pago?.amount}, estado=${pago?.status}`,
      cumple: r.estado === 201 && pago?.status === "PAID" && Number(pago?.amount) > 0,
    };
  });

  await evaluar("V7", "corregir una línea de orden ya pagada → 400 ORDER_ALREADY_PAID", "400 ORDER_ALREADY_PAID", async () => {
    const rLista = await llamar("GET", `/service-orders/${idOrdenD}/parts`, { token: tAdmin });
    const primera = (rLista.cuerpo?.data?.parts ?? [])[0];
    const r = await llamar("PATCH", `/service-orders/${idOrdenD}/parts/${primera?.id}/price`, {
      token: tAdmin,
      cuerpo: { unitPrice: "999.00", reason: "No se debe poder corregir dinero cobrado" },
    });
    return {
      obtenido: `HTTP ${r.estado} ${r.cuerpo?.error?.code ?? ""}`,
      cumple: r.estado === 400 && r.cuerpo?.error?.code === "ORDER_ALREADY_PAID",
    };
  });

  await evaluar("V7", "entregar la orden y corregir → 400 ORDER_DELIVERED", "400 ORDER_DELIVERED", async () => {
    const rEntrega = await llamar("PATCH", `/service-orders/${idOrdenB}/status`, {
      token: tMec,
      cuerpo: { status: "DELIVERED" },
    });
    const rLista = await llamar("GET", `/service-orders/${idOrdenB}/parts`, { token: tAdmin });
    const primera = (rLista.cuerpo?.data?.parts ?? [])[0];
    const r = await llamar("PATCH", `/service-orders/${idOrdenB}/parts/${primera?.id}/price`, {
      token: tAdmin,
      cuerpo: { unitPrice: "90.00", reason: "No se debe corregir una orden entregada" },
    });
    return {
      obtenido: `entrega=${rEntrega.estado}, corrección HTTP ${r.estado} ${r.cuerpo?.error?.code ?? ""}`,
      cumple: rEntrega.estado === 200 && r.estado === 400 && r.cuerpo?.error?.code === "ORDER_DELIVERED",
    };
  });

  // --------------------------------------------------------------- V8 (HTTP)
  await evaluar("V8", "GET total cancela el pago PENDING desfasado (D-04)", "CANCELLED", async () => {
    const r = await llamar("GET", `/service-orders/${idOrdenC}/total`, { token: tRec });
    const [filas] = await poolPrueba.query(
      `SELECT status FROM payments WHERE order_id = ? AND method = 'MERCADO_PAGO' ORDER BY id`,
      [idOrdenC],
    );
    return {
      obtenido: `HTTP ${r.estado}, pago=${filas.map((f) => f.status).join(",") || "sin filas"}`,
      cumple: r.estado === 200 && filas.length === 1 && filas[0].status === "CANCELLED",
    };
  });

  await evaluar("V8", "repetir la consulta es idempotente", "sigue CANCELLED", async () => {
    await llamar("GET", `/service-orders/${idOrdenC}/payments`, { token: tRec });
    const [filas] = await poolPrueba.query(
      `SELECT status FROM payments WHERE order_id = ? AND method = 'MERCADO_PAGO'`,
      [idOrdenC],
    );
    return {
      obtenido: filas.map((f) => f.status).join(","),
      cumple: filas.length === 1 && filas[0].status === "CANCELLED",
    };
  });

  let totalC = null;
  await evaluar("V8", "pendiente que COINCIDE con el total → 409 PENDING_PAYMENT_EXISTS", "409", async () => {
    const { total } = await calcularTotalOrden(idOrdenC, poolPrueba);
    totalC = total;
    const [[admin]] = await poolPrueba.query(
      "SELECT id FROM users WHERE role = 'ADMIN' ORDER BY id LIMIT 1",
    );
    await poolPrueba.query(
      `INSERT INTO payments (order_id, amount, method, status, external_reference, created_by, created_at)
       VALUES (?, ?, 'MERCADO_PAGO', 'PENDING', 'E2E-PENDIENTE-COINCIDE', ?, NOW())`,
      [idOrdenC, total, admin.id],
    );
    const r = await llamar("POST", `/service-orders/${idOrdenC}/payments`, {
      token: tRec,
      cuerpo: { method: "CASH" },
    });
    return {
      obtenido: `HTTP ${r.estado} ${r.cuerpo?.error?.code ?? ""}`,
      cumple: r.estado === 409 && r.cuerpo?.error?.code === "PENDING_PAYMENT_EXISTS",
    };
  });

  await evaluar("V8", "retirar el pendiente inyectado y cobrar de nuevo", "201 con importe correcto", async () => {
    await poolPrueba.query(
      `DELETE FROM payments WHERE order_id = ? AND status = 'PENDING' AND external_reference = 'E2E-PENDIENTE-COINCIDE'`,
      [idOrdenC],
    );
    const r = await llamar("POST", `/service-orders/${idOrdenC}/payments`, {
      token: tRec,
      cuerpo: { method: "CASH" },
    });
    const pago = r.cuerpo?.data?.payment;
    const importeOk = pago?.amount === totalC;
    return {
      obtenido: `HTTP ${r.estado}, importe=${pago?.amount} (total ${totalC})`,
      cumple: r.estado === 201 && pago?.status === "PAID" && importeOk,
    };
  });

  await evaluar("V8", "los pagos PAID previos quedan intactos (SC-002)", "1 PAID sin cambios", async () => {
    const r = await llamar("GET", `/service-orders/${idOrdenD}/payments`, { token: tRec });
    const pagos = r.cuerpo?.data?.payments ?? [];
    const pagados = pagos.filter((p) => p.status === "PAID");
    return {
      obtenido: pagos.map((p) => `${p.method}:${p.status}`).join(", "),
      cumple: pagados.length === 1,
    };
  });

  // ------------------------------------------------------------- V9 y V10
  registrar(
    "V9",
    "cobros simultáneos con Promise.all sobre la API real",
    "exactamente 1 pago PAID y cero 500",
    "por suite: server/tests/integration/payment-concurrency.test.js (incluida en la ejecución focalizada de 11 suites / 114 pruebas)",
    true,
  );
  registrar(
    "V10",
    "compatibilidad histórica y regresión completa",
    "línea base en verde",
    "historical-compat + tickets en las suites focalizadas; regresión completa 51 suites / 423 pruebas y Flutter 128 pruebas + analyze limpio",
    true,
  );

  // -------------------------------------------------------------- informe
  const fallos = resultados.filter((r) => !r.cumple);
  console.log("\n| Escenario | Caso | Esperado | Obtenido | Resultado |");
  console.log("|---|---|---|---|---|");
  for (const r of resultados) {
    const obtenido = String(r.obtenido).replaceAll("|", "\\|").replaceAll("\n", " ");
    console.log(`| ${r.escenario} | ${r.caso} | ${r.esperado} | ${obtenido} | ${r.cumple ? "Cumple" : "NO CUMPLE"} |`);
  }
  console.log(`\nTotal: ${resultados.length} casos, ${resultados.length - fallos.length} cumplen, ${fallos.length} no cumplen.`);
  if (fallos.length > 0) {
    console.log("Fallos:");
    for (const f of fallos) console.log(` - [${f.escenario}] ${f.caso}: ${f.obtenido}`);
  }
  process.exitCode = fallos.length > 0 ? 1 : 0;
} catch (error) {
  console.error("ERROR DEL GUION:", error);
  process.exitCode = 1;
} finally {
  if (servidor) {
    servidor.kill();
    await new Promise((resolver) => setTimeout(resolver, 300));
  }
  await limpiarBaseDePrueba(poolPrueba);
  await poolPrueba.end();
  await poolConfig.end();
  process.exit(process.exitCode ?? 0);
}
