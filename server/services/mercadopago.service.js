import { mercadoPagoConfig } from "../config/mercadopago.js";
import { errores } from "../utils/errors.js";

// T044: integración completa con Mercado Pago en sandbox (US4, R-04, CA-3,
// CA-7). Único módulo que habla con el proveedor: usa el `fetch` global de
// Node (sin SDK, sin dependencias nuevas) y acepta un cliente HTTP
// inyectable para que las pruebas simulen el proveedor sin red (RN-14: la
// app nunca ve ni almacena datos de tarjeta; la captura ocurre allá).
//
// Flujo R-04 (sin webhooks en el MVP):
//   1. crearPreferenciaPago → preferencia de Checkout Pro (initPoint).
//   2. consultarPago → busca el pago por external_reference = paymentId y
//      mapea approved → PAID, rejected → REJECTED, resto → PENDING.

const URL_BASE = "https://api.mercadopago.com";

/** Cliente HTTP por defecto: `fetch` global de Node. */
async function clientePorDefecto(url, opciones) {
  return fetch(url, opciones);
}

let clienteHttp = clientePorDefecto;

/**
 * Inyecta un cliente HTTP simulado para las pruebas (sin red). `null`
 * restaura el `fetch` real.
 */
export function usarClienteHttp(cliente) {
  clienteHttp = cliente ?? clientePorDefecto;
}

/** Verifica credenciales o responde 409 «no disponible» (R-04). */
function exigirCredenciales() {
  if (!mercadoPagoConfig.configurado) {
    throw errores.mercadoPagoNotConfigured();
  }
}

/** Ejecuta la petición y devuelve el JSON; cualquier falla → 502. */
async function pedirJson(url, opciones, mensajeFallo) {
  let respuesta;
  try {
    respuesta = await clienteHttp(url, opciones);
  } catch {
    throw errores.mercadoPagoError();
  }
  if (!respuesta || respuesta.ok !== true) {
    throw errores.mercadoPagoError(mensajeFallo);
  }
  try {
    return await respuesta.json();
  } catch {
    throw errores.mercadoPagoError(mensajeFallo);
  }
}

function encabezado() {
  return { Authorization: `Bearer ${mercadoPagoConfig.accessToken}` };
}

/**
 * Crea la preferencia de Checkout Pro para el pago `PENDING` (R-04.1).
 *
 * @param {{paymentId: number, orderId: number, amount: string}} datosPago
 * @returns {Promise<{initPoint: string, preferenceId: string}>}
 * @throws {AppError} 409 sin credenciales · 502 si el proveedor falla
 */
export async function crearPreferenciaPago({ paymentId, orderId, amount }) {
  // Sin credenciales el método no está disponible: la transacción del alta
  // se revierte y los métodos manuales siguen operando (R-04, T022).
  exigirCredenciales();

  const fallo =
    "No fue posible crear la preferencia de pago de Mercado Pago; intenta de nuevo.";
  const datos = await pedirJson(
    `${URL_BASE}/checkout/preferences`,
    {
      method: "POST",
      headers: { ...encabezado(), "Content-Type": "application/json" },
      body: JSON.stringify({
        // El proveedor referencia a nuestro pago (RN-13: sin huérfanos).
        external_reference: String(paymentId),
        items: [
          {
            id: `orden-${orderId}`,
            title: `Orden de servicio #${orderId}`,
            quantity: 1,
            unit_price: Number(amount),
            currency_id: "MXN",
          },
        ],
      }),
    },
    fallo,
  );

  const initPoint = datos?.init_point;
  if (!initPoint) throw errores.mercadoPagoError(fallo);

  return {
    initPoint,
    preferenceId: datos.id != null ? String(datos.id) : String(initPoint),
  };
}

/** Mapea el estado del proveedor a la máquina R-04 (T044). */
export function mapearEstadoPago(estadoProveedor) {
  if (estadoProveedor === "approved") return "PAID";
  if (estadoProveedor === "rejected") return "REJECTED";
  return "PENDING";
}

/**
 * Consulta al proveedor el resultado del pago buscándolo por
 * `external_reference = paymentId` (R-04.4).
 *
 * @returns {Promise<"PAID" | "REJECTED" | "PENDING">} sin resultado o en
 *   proceso → `PENDING` (el pago permanece pendiente).
 * @throws {AppError} 409 sin credenciales · 502 si el proveedor falla
 */
export async function consultarPago(paymentId) {
  exigirCredenciales();

  const datos = await pedirJson(
    `${URL_BASE}/v1/payments/search?external_reference=${encodeURIComponent(
      String(paymentId),
    )}`,
    { method: "GET", headers: encabezado() },
    "Mercado Pago no respondió. Intenta verificar el estado de nuevo.",
  );

  const primero = Array.isArray(datos?.results) ? datos.results[0] : null;
  if (!primero) return "PENDING";
  return mapearEstadoPago(primero.status);
}
