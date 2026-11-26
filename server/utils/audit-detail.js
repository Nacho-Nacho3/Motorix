// T015: catálogo cerrado de acciones de la bitácora y saneado del detalle
// (Sprint 7, CA-20, CA-21, research P-13). El detalle se arma con una lista
// blanca por acción: nunca contraseñas, hashes, tokens ni datos de tarjeta.

/** Campos permitidos por acción, con su etiqueta en el texto del detalle. */
const LISTA_BLANCA = {
  LOGIN_FAILED: { identifier: "usuario" },
  ACCOUNT_LOCKED: { minutes: "minutos" },
  USER_CREATED: { role: "rol" },
  USER_UPDATED: { field: "campo", from: "anterior", to: "nuevo" },
  SETTINGS_UPDATED: { field: "campo", from: "anterior", to: "nuevo" },
  PART_PRICE_CHANGED: { field: "campo", from: "anterior", to: "nuevo" },
  ORDER_PART_PRICE_CORRECTED: { from: "anterior", to: "nuevo", reason: "motivo" },
  PAYMENT_CANCELLED: {
    orderId: "orden",
    method: "método",
    amount: "importe",
    reason: "motivo",
  },
  TERMS_PUBLISHED: { version: "versión" },
};

export const ACCIONES = Object.freeze(Object.keys(LISTA_BLANCA));

/** Tope de cada valor y del detalle completo (data-model.md: VARCHAR(500)). */
const MAX_VALOR = 100;
const MAX_DETALLE = 500;

/** Una clave o un nombre de campo que parece reservado nunca se registra. */
const RESERVADO = /pass|contrase|hash|token|secret|card|tarjeta|cvv|clave/i;

export const esAccionValida = (accion) => ACCIONES.includes(accion);

/**
 * Arma el texto del detalle para una acción. Rechaza acciones fuera del
 * catálogo; ignora toda clave que no esté en la lista blanca y, cuando el
 * campo modificado parece reservado, omite los valores anterior y nuevo.
 */
export function sanearDetalle(accion, datos = {}) {
  if (!esAccionValida(accion)) {
    throw new Error(`Acción de bitácora fuera del catálogo: ${accion}`);
  }

  const permitidos = LISTA_BLANCA[accion];
  const campoReservado =
    typeof datos.field === "string" && RESERVADO.test(datos.field);
  const partes = [];

  for (const [clave, etiqueta] of Object.entries(permitidos)) {
    if (RESERVADO.test(clave)) continue;
    if (campoReservado && (clave === "from" || clave === "to")) continue;
    const valor = datos[clave];
    if (valor === undefined || valor === null || valor === "") continue;
    partes.push(`${etiqueta}: ${String(valor).slice(0, MAX_VALOR)}`);
  }

  return partes.join("; ").slice(0, MAX_DETALLE);
}
