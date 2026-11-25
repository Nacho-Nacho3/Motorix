import * as modelo from "../models/service_type.model.js";
import { errores } from "../utils/errors.js";
import { MENSAJE_SIN_INTERVALO } from "../validators/service_types.js";

// T048: catálogo de tipos de servicio (Sprint 7, US3, CA-4, RN-12). El tipo se
// desactiva, nunca se borra.

const sinIntervalo = () =>
  errores.validation([{ field: "intervalDays", message: MENSAJE_SIN_INTERVALO }]);

export const listar = ({ active } = {}) =>
  modelo.listar({ active: active === undefined ? undefined : active === "true" });

export const listarParaSelector = () => modelo.listarActivos();

/** El nombre es único sin distinguir mayúsculas (colación `_unicode_ci`). */
async function verificarNombreLibre(name, idPropio) {
  const existente = await modelo.buscarPorNombre(name);
  if (existente && existente.id !== idPropio) throw errores.serviceTypeNameTaken();
}

export async function crear(datos, usuario) {
  await verificarNombreLibre(datos.name);
  try {
    return await modelo.crear({ ...datos, createdBy: usuario.id });
  } catch (error) {
    // Carrera entre dos altas con el mismo nombre: gana la clave única.
    if (error.code === "ER_DUP_ENTRY") throw errores.serviceTypeNameTaken();
    throw error;
  }
}

export async function actualizar(id, cambios) {
  const actual = await modelo.buscarPorId(id);
  if (!actual) {
    throw errores.notFound("NOT_FOUND", "El tipo de servicio no existe.");
  }
  if (cambios.name !== undefined) await verificarNombreLibre(cambios.name, id);

  // Debe quedar al menos un intervalo tras aplicar el cambio.
  const dias = cambios.intervalDays !== undefined ? cambios.intervalDays : actual.intervalDays;
  const km = cambios.intervalKm !== undefined ? cambios.intervalKm : actual.intervalKm;
  if (dias == null && km == null) throw sinIntervalo();

  try {
    return await modelo.actualizar(id, cambios);
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") throw errores.serviceTypeNameTaken();
    throw error;
  }
}

/** Para `agregarServicio`: el tipo debe existir y estar activo. */
export async function verificarTipoActivo(serviceTypeId) {
  const tipo = await modelo.buscarPorId(serviceTypeId);
  if (!tipo || !tipo.active) {
    throw errores.validation([
      {
        field: "serviceTypeId",
        message: "El tipo de servicio indicado no existe o está desactivado.",
      },
    ]);
  }
  return tipo;
}
