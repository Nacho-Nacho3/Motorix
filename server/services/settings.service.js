import { taller, margenesMantenimiento } from "../config/taller.js";
import * as settings from "../models/settings.model.js";

// T013: configuración del taller con valores de respaldo (Sprint 7, FR-004,
// D-16, research P-2 y P-3). Si falta una clave rige el valor que ya regía, de
// modo que una instalación existente sigue funcionando sin intervención.

/** Valores de respaldo, en la misma forma que la configuración resuelta. */
function valoresDeRespaldo() {
  return {
    shop: { name: taller.name, address: taller.address, phone: taller.phone },
    maintenance: {
      warnDays: margenesMantenimiento.warnDays,
      warnKm: margenesMantenimiento.warnKm,
    },
  };
}

/** Texto opcional: vacío o ausente equivale a «sin valor». */
const textoOpcional = (valor, respaldo) =>
  valor === undefined ? respaldo : valor === "" ? null : valor;

const entero = (valor, respaldo) =>
  valor === undefined || valor === "" ? respaldo : Number(valor);

/**
 * Configuración completa `{ shop, maintenance, defaults }`: el valor guardado
 * o el de respaldo, clave por clave. `defaults` permite a la pantalla ofrecer
 * «restablecer».
 */
export async function obtenerConfiguracion() {
  const filas = await settings.obtenerTodas();
  const guardado = new Map(filas.map((fila) => [fila.key, fila.value]));
  const respaldo = valoresDeRespaldo();

  return {
    shop: {
      name: guardado.get("shop.name") ?? respaldo.shop.name,
      address: textoOpcional(guardado.get("shop.address"), respaldo.shop.address),
      phone: textoOpcional(guardado.get("shop.phone"), respaldo.shop.phone),
    },
    maintenance: {
      warnDays: entero(guardado.get("maintenance.warn_days"), respaldo.maintenance.warnDays),
      warnKm: entero(guardado.get("maintenance.warn_km"), respaldo.maintenance.warnKm),
    },
    defaults: respaldo,
  };
}

/**
 * Márgenes efectivos de un mantenimiento (D-16): el valor propio cuando no es
 * `NULL` y el del taller cuando lo es, columna por columna. Un 0 propio se
 * respeta (no se confunde con `NULL`).
 */
export function resolverMargenes(fila, config) {
  const propio = (valor) => valor !== null && valor !== undefined;
  return {
    warnDays: propio(fila.warn_days) ? Number(fila.warn_days) : config.maintenance.warnDays,
    warnKm: propio(fila.warn_km) ? Number(fila.warn_km) : config.maintenance.warnKm,
  };
}
