import { pool } from "../config/db.js";
import { taller, margenesMantenimiento } from "../config/taller.js";
import * as settings from "../models/settings.model.js";
import * as auditoria from "./audit.service.js";

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

// T025: actualización parcial con bitácora (Sprint 7, contracts/settings.md).
const CLAVES = {
  shop: { name: "shop.name", address: "shop.address", phone: "shop.phone" },
  maintenance: { warnDays: "maintenance.warn_days", warnKm: "maintenance.warn_km" },
};

/** Valor actual de una campo tal como se compara y se guarda (texto). */
function valorActual(config, seccion, campo) {
  const valor = config[seccion][campo];
  return valor === null || valor === undefined ? "" : String(valor);
}

/**
 * Guarda solo las claves enviadas, en una transacción, y registra
 * `SETTINGS_UPDATED` por cada valor que realmente cambia (anterior y nuevo).
 * Devuelve la configuración completa ya actualizada.
 */
export async function actualizar(patch, usuario) {
  const antes = await obtenerConfiguracion();
  const cambios = [];

  for (const [seccion, campos] of Object.entries(patch)) {
    for (const [campo, valor] of Object.entries(campos ?? {})) {
      const nuevo = valor === null || valor === undefined ? "" : String(valor);
      const anterior = valorActual(antes, seccion, campo);
      if (nuevo === anterior) continue;
      cambios.push({ clave: CLAVES[seccion][campo], anterior, nuevo });
    }
  }

  if (cambios.length > 0) {
    const conexion = await pool.getConnection();
    try {
      await conexion.beginTransaction();
      for (const cambio of cambios) {
        await settings.guardar(cambio.clave, cambio.nuevo, usuario.id, conexion);
      }
      await conexion.commit();
    } catch (error) {
      await conexion.rollback();
      throw error;
    } finally {
      conexion.release();
    }
    for (const cambio of cambios) {
      await auditoria.registrar({
        user: usuario,
        action: "SETTINGS_UPDATED",
        entityType: "SETTINGS",
        datos: { field: cambio.clave, from: cambio.anterior, to: cambio.nuevo },
      });
    }
  }

  return obtenerConfiguracion();
}
